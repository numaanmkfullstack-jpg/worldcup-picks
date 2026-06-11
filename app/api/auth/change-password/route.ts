import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requireSql } from "@/lib/db";
import { readRequestBody, redirectWithMessage } from "@/lib/form";
import { hashPassword, isStrongEnoughPassword } from "@/lib/passwords";

export async function POST(request: Request) {
  const wantsJson = request.headers.get("content-type")?.includes("application/json") ?? false;
  const user = await getCurrentUser();
  if (!user) {
    return wantsJson
      ? NextResponse.json({ error: "You must be logged in." }, { status: 401 })
      : redirectWithMessage(request, "/login", "error", "You must be logged in.");
  }

  const body = await readRequestBody(request);
  if (!body.newPassword || !isStrongEnoughPassword(body.newPassword)) {
    return wantsJson
      ? NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 })
      : redirectWithMessage(request, "/change-password", "error", "New password must be at least 8 characters.");
  }

  const db = requireSql();
  await db`
    UPDATE app_users
    SET password_hash = ${hashPassword(body.newPassword)},
        password_set_at = now(),
        must_change_password = false
    WHERE id = ${user.id}
  `;

  return wantsJson
    ? NextResponse.json({ message: "Password changed.", redirectTo: "/" })
    : NextResponse.redirect(new URL("/", request.url), 303);
}
