"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { InsightDocLogo } from "./InsightDocLogo";
import { IconName, UiIcon } from "./UiIcon";

const links: { href: string; icon: IconName; label: string }[] = [
  { href: "/dashboard", icon: "overview", label: "Overview" },
  { href: "/chat", icon: "chat", label: "Chat with Documents" },
  { href: "/documents", icon: "document", label: "My Documents" },
  { href: "/workspaces", icon: "workspace", label: "Workspaces" },
  { href: "/history", icon: "history", label: "Chat History" },
  { href: "/favorites", icon: "favorite", label: "Favorites" },
  { href: "/settings", icon: "settings", label: "Settings" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const path = usePathname();
  const [open, setOpen] = useState(false);

  if (loading || !user) return <div className="screen-loader">Loading InsightDoc…</div>;

  return (
    <div className="app-shell">
      <button className="mobile-menu" type="button" onClick={() => setOpen(!open)} aria-label="Toggle navigation" aria-expanded={open}>
        <UiIcon name="menu" />
      </button>
      <aside className={open ? "sidebar open" : "sidebar"}>
        <InsightDocLogo light />
        <nav aria-label="Main navigation">
          {links.map(({ href, icon, label }) => (
            <Link key={href} href={href} className={path === href ? "active" : ""} aria-current={path === href ? "page" : undefined} onClick={() => setOpen(false)}>
              <span><UiIcon name={icon} /></span>{label}
            </Link>
          ))}
        </nav>
        <div className="account">
          <div className="avatar">{user.email[0].toUpperCase()}</div>
          <div><b>Your account</b><small title={user.email}>{user.email}</small></div>
          <button type="button" onClick={logout} aria-label="Log out" title="Log out"><UiIcon name="logout" /></button>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
