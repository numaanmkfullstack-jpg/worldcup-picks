"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLink = {
  href: string;
  label: string;
};

type NavLinksProps = {
  links: NavLink[];
  userName?: string;
};

export function NavLinks({ links, userName }: NavLinksProps) {
  const pathname = usePathname();

  return (
    <nav className="nav-links" aria-label="Main navigation">
      {links.map((link) => {
        const isActive = pathname === link.href;

        return (
          <Link aria-current={isActive ? "page" : undefined} className={isActive ? "active" : undefined} key={link.href} href={link.href}>
            {link.label}
          </Link>
        );
      })}
      {userName ? (
        <>
          <span className="nav-user">{userName}</span>
          <form action="/api/auth/logout" method="post">
            <button className="nav-button" type="submit">
              Logout
            </button>
          </form>
        </>
      ) : (
        <>
          <Link className={pathname === "/login" ? "active" : undefined} href="/login">
            Login
          </Link>
          <Link className={pathname === "/signup" ? "active" : undefined} href="/signup">
            Signup
          </Link>
        </>
      )}
    </nav>
  );
}
