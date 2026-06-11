import { NextResponse } from "next/server";
import { createSessionToken, sessionCookieName, shouldUseSecureCookie } from "@/lib/auth";
import { hasDatabase, requireSql } from "@/lib/db";
import { readRequestBody, redirectWithMessage } from "@/lib/form";
import { verifyPassword } from "@/lib/passwords";

type LoginRow = {
  id: string;
  password_hash: string | null;
  must_change_password: boolean;
};

export async function POST(request: Request) {
  const wantsJson = request.headers.get("content-type")?.includes("application/json") ?? false;

  if (!hasDatabase) {
    return wantsJson
      ? NextResponse.json({ error: "Add DATABASE_URL before logging in." }, { status: 400 })
      : redirectWithMessage(request, "/login", "error", "Add DATABASE_URL before logging in.");
  }

  const body = await readRequestBody(request);
  if (!body.email || !body.password) {
    return wantsJson
      ? NextResponse.json({ error: "Email and password are required." }, { status: 400 })
      : redirectWithMessage(request, "/login", "error", "Email and password are required.");
  }

  const email = body.email.trim().toLowerCase();
  const db = requireSql();
  const rows = await db`
    SELECT id, password_hash, must_change_password
    FROM app_users
    WHERE email = ${email}
      AND disabled_at IS NULL
    LIMIT 1
  `;
  const user = (rows as LoginRow[])[0];

  if (!user || !verifyPassword(body.password, user.password_hash)) {
    return wantsJson
      ? NextResponse.json({ error: "Invalid email or password." }, { status: 401 })
      : redirectWithMessage(request, "/login", "error", "Invalid email or password.");
  }

  const redirectTo = user.must_change_password ? "/change-password" : "/";
  const response = wantsJson
    ? NextResponse.json({ message: "Logged in.", redirectTo })
    : NextResponse.redirect(new URL(redirectTo, request.url), 303);
  response.cookies.set(sessionCookieName, createSessionToken(user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(request),
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });

  return response;
}
