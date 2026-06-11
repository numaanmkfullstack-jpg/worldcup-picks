import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hasDatabase, requireSql } from "@/lib/db";

export const sessionCookieName = "wc_session";

type SessionPayload = {
  userId: string;
  exp: number;
};

export type CurrentUser = {
  id: string;
  email: string;
  displayName: string;
  mustChangePassword: boolean;
  organizationId: string | null;
  organizationName: string | null;
  role: "admin" | "member" | null;
};

export function shouldUseSecureCookie(request: Request) {
  const url = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto");

  return url.protocol === "https:" || forwardedProto === "https";
}

type CurrentUserRow = {
  id: string;
  email: string;
  display_name: string;
  must_change_password: boolean;
  organization_id: string | null;
  organization_name: string | null;
  role: "admin" | "member" | null;
};

function base64Url(value: string) {
  return Buffer.from(value).toString("base64url");
}

function unbase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function getAuthSecret() {
  return process.env.AUTH_SECRET || "dev-only-change-me-before-sharing";
}

function sign(value: string) {
  return createHmac("sha256", getAuthSecret()).update(value).digest("base64url");
}

export function createSessionToken(userId: string) {
  const payload: SessionPayload = {
    userId,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 14,
  };
  const body = base64Url(JSON.stringify(payload));

  return `${body}.${sign(body)}`;
}

export async function readSessionUserId() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  if (!token) {
    return null;
  }

  const [body, signature] = token.split(".");
  if (!body || !signature) {
    return null;
  }

  const expected = sign(body);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(unbase64Url(body)) as SessionPayload;
    if (!payload.userId || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload.userId;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!hasDatabase) {
    return null;
  }

  const userId = await readSessionUserId();
  if (!userId) {
    return null;
  }

  const db = requireSql();
  const rows = await db`
    SELECT
      u.id,
      u.email,
      u.display_name,
      u.must_change_password,
      om.organization_id,
      o.name AS organization_name,
      om.role
    FROM app_users u
    LEFT JOIN organization_members om ON om.user_id = u.id
    LEFT JOIN organizations o ON o.id = om.organization_id
    WHERE u.id = ${userId}
      AND u.disabled_at IS NULL
    ORDER BY CASE WHEN om.role = 'admin' THEN 0 ELSE 1 END, om.joined_at ASC
    LIMIT 1
  `;

  const row = (rows as CurrentUserRow[])[0];
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    mustChangePassword: row.must_change_password,
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    role: row.role,
  };
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  if (user.mustChangePassword) {
    redirect("/change-password");
  }

  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") {
    redirect("/");
  }

  return user;
}

export async function hasAnyUsers() {
  if (!hasDatabase) {
    return false;
  }

  const db = requireSql();
  const rows = await db`SELECT COUNT(*)::integer AS count FROM app_users`;

  return ((rows as { count: number }[])[0]?.count ?? 0) > 0;
}
