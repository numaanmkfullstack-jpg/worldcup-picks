import { Trophy } from "lucide-react";
import Link from "next/link";
import { NavLinks } from "@/components/NavLinks";
import { getCurrentUser } from "@/lib/auth";

const memberLinks = [
  { href: "/fixtures", label: "Fixtures" },
  { href: "/predict", label: "Predict" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/org", label: "Org" },
];

const adminLinks = [
  { href: "/fixtures", label: "Fixtures" },
  { href: "/predict", label: "Predict" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/users", label: "Users" },
  { href: "/admin", label: "Admin" },
];

export async function Nav() {
  const user = await getCurrentUser();
  const links = user?.role === "admin" ? adminLinks : memberLinks;

  return (
    <header className="top-nav">
      <Link className="brand" href="/">
        <span className="brand-mark">
          <Trophy size={18} />
        </span>
        World Cup Picks
      </Link>
      <NavLinks links={links} userName={user?.displayName} />
    </header>
  );
}
