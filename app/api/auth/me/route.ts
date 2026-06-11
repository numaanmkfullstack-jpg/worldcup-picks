import { NextResponse } from "next/server";
import { getCurrentUser, readSessionUserId } from "@/lib/auth";

export async function GET() {
  const sessionUserId = await readSessionUserId();
  const user = await getCurrentUser();

  return NextResponse.json({
    hasSessionCookie: Boolean(sessionUserId),
    user: user
      ? {
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          organizationName: user.organizationName,
          mustChangePassword: user.mustChangePassword,
        }
      : null,
  });
}
