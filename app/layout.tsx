import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Nav } from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "World Cup Picks",
  description: "Predict World Cup scores with your friends and climb the leaderboard.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <main className="app-shell">
          <Nav />
          {children}
        </main>
      </body>
    </html>
  );
}
