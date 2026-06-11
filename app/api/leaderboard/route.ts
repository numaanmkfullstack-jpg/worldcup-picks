import { NextResponse } from "next/server";
import { getLeaderboard } from "@/lib/queries";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const orgId = url.searchParams.get("orgId") ?? undefined;
  const leaderboard = await getLeaderboard(orgId);

  return NextResponse.json({ leaderboard });
}
