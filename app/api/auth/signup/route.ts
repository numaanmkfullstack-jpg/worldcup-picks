import { NextResponse } from "next/server";
import { createSessionToken, hasAnyUsers, sessionCookieName, shouldUseSecureCookie } from "@/lib/auth";
import { hasDatabase, requireSql } from "@/lib/db";
import { readRequestBody, redirectWithMessage } from "@/lib/form";
import { hashPassword, isStrongEnoughPassword } from "@/lib/passwords";

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "matchday-crew";
}

export async function POST(request: Request) {
  const wantsJson = request.headers.get("content-type")?.includes("application/json") ?? false;

  if (!hasDatabase) {
    return wantsJson
      ? NextResponse.json({ error: "Add DATABASE_URL before creating the first admin." }, { status: 400 })
      : redirectWithMessage(request, "/signup", "error", "Add DATABASE_URL before creating the first admin.");
  }

  const body = await readRequestBody(request);

  if (!body.email || !body.displayName || !body.orgName || !body.password) {
    return wantsJson
      ? NextResponse.json({ error: "All fields are required." }, { status: 400 })
      : redirectWithMessage(request, "/signup", "error", "All fields are required.");
  }

  if (!isStrongEnoughPassword(body.password)) {
    return wantsJson
      ? NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 })
      : redirectWithMessage(request, "/signup", "error", "Password must be at least 8 characters.");
  }

  if (await hasAnyUsers()) {
    return wantsJson
      ? NextResponse.json({ error: "First signup is closed. Ask an admin to invite you." }, { status: 403 })
      : redirectWithMessage(request, "/signup", "error", "First signup is closed. Ask an admin to invite you.");
  }

  const email = body.email.trim().toLowerCase();
  const db = requireSql();
  const userRows = await db`
    INSERT INTO app_users (email, display_name, password_hash, password_set_at, must_change_password)
    VALUES (${email}, ${body.displayName.trim()}, ${hashPassword(body.password)}, now(), false)
    RETURNING id
  `;
  const userId = (userRows as { id: string }[])[0].id;

  const orgRows = await db`
    INSERT INTO organizations (name, slug, created_by_user_id)
    VALUES (${body.orgName}, ${slugify(body.orgName)}, ${userId})
    RETURNING id
  `;
  const orgId = (orgRows as { id: string }[])[0].id;

  await db`
    INSERT INTO organization_members (organization_id, user_id, role)
    VALUES (${orgId}, ${userId}, 'admin')
  `;

  const response = wantsJson
    ? NextResponse.json({ message: "Admin created.", redirectTo: "/" })
    : NextResponse.redirect(new URL("/", request.url), 303);
  response.cookies.set(sessionCookieName, createSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(request),
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });

  return response;
}
