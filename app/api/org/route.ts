import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasDatabase, requireSql } from "@/lib/db";

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "matchday-crew";
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    name?: string;
  };

  if (!body.name) {
    return NextResponse.json({ error: "Org name is required." }, { status: 400 });
  }

  if (!hasDatabase) {
    return NextResponse.json({
      message: "Preview org created. Add DATABASE_URL to persist it in Neon.",
      inviteCode: "KICKOFF26",
    });
  }

  const db = requireSql();
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) {
    return NextResponse.json({ error: "Log in first." }, { status: 401 });
  }

  if (user.role !== "admin") {
    return NextResponse.json({ error: "Only admins can manage orgs." }, { status: 403 });
  }

  const orgRows = await db`
    INSERT INTO organizations (name, slug, created_by_user_id)
    VALUES (${body.name}, ${slugify(body.name)}, ${user.id})
    ON CONFLICT (slug) DO UPDATE
    SET name = EXCLUDED.name
    RETURNING id, invite_code
  `;
  const org = (orgRows as { id: string; invite_code: string }[])[0];

  await db`
    INSERT INTO organization_members (organization_id, user_id, role)
    VALUES (${org.id}, ${user.id}, 'admin')
    ON CONFLICT (organization_id, user_id) DO UPDATE
    SET role = 'admin'
  `;

  return NextResponse.json({
    message: "Org created in Neon. Share the invite code with friends.",
    inviteCode: org.invite_code,
  });
}
