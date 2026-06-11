import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requireSql } from "@/lib/db";
import { hashPassword, isStrongEnoughPassword } from "@/lib/passwords";

export async function POST(request: Request) {
  const admin = await getCurrentUser();
  if (!admin || admin.mustChangePassword) {
    return NextResponse.json({ error: "You must be logged in." }, { status: 401 });
  }

  if (admin.role !== "admin" || !admin.organizationId) {
    return NextResponse.json({ error: "Only admins can create users." }, { status: 403 });
  }

  const body = (await request.json()) as {
    email?: string;
    displayName?: string;
    password?: string;
  };

  if (!body.email || !body.displayName || !body.password) {
    return NextResponse.json({ error: "Name, email, and temporary password are required." }, { status: 400 });
  }

  if (!isStrongEnoughPassword(body.password)) {
    return NextResponse.json({ error: "Temporary password must be at least 8 characters." }, { status: 400 });
  }

  const email = body.email.trim().toLowerCase();
  const db = requireSql();
  const userRows = await db`
    INSERT INTO app_users (
      email,
      display_name,
      password_hash,
      password_set_at,
      must_change_password,
      invited_by_user_id
    )
    VALUES (${email}, ${body.displayName.trim()}, ${hashPassword(body.password)}, now(), true, ${admin.id})
    ON CONFLICT (email) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        password_hash = EXCLUDED.password_hash,
        password_set_at = now(),
        must_change_password = true,
        invited_by_user_id = ${admin.id},
        disabled_at = NULL
    RETURNING id
  `;
  const userId = (userRows as { id: string }[])[0].id;

  await db`
    INSERT INTO organization_members (organization_id, user_id, role)
    VALUES (${admin.organizationId}, ${userId}, 'member')
    ON CONFLICT (organization_id, user_id) DO UPDATE
    SET role = CASE
      WHEN organization_members.role = 'admin' THEN 'admin'::org_role
      ELSE 'member'::org_role
    END
  `;

  return NextResponse.json({ message: "User created. Give them the temporary password so they can log in and reset it." });
}
