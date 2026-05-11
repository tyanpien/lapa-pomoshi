"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./cabinetLayout.module.css";

type NavItem = {
  id: string;
  href: string;
  label: string;
  aliases?: string[];
  skipActiveHighlight?: boolean;
};

const NAV: NavItem[] = [
  { id: "profile", href: "/organization/profile", label: "Профиль", aliases: ["/organization"] },
  { id: "my-requests", href: "/organization/requests", label: "Мои заявки" },
  { id: "my-animals", href: "/organization/animals", label: "Мои подопечные" },
  { id: "incoming-requests", href: "/organization/requests", label: "Входящие заявки", skipActiveHighlight: true },
  { id: "messages", href: "/messages", label: "Сообщения" },
  { id: "home", href: "/organization/home", label: "Привет из дома" },
  { id: "events", href: "/organization/events", label: "Мои мероприятия" },
  { id: "articles", href: "/organization/articles", label: "Мои статьи" },
  { id: "reports", href: "/organization/reports", label: "Мои отчеты" },
];

const isActive = (pathname: string, item: NavItem) => {
  if (item.skipActiveHighlight) return false;
  if (pathname === item.href) return true;
  if (item.aliases?.includes(pathname)) return true;
  return pathname.startsWith(`${item.href}/`);
};

export function OrganizationSidebar() {
  const pathname = usePathname() ?? "";

  return (
    <nav className={styles.nav} aria-label="Меню организации">
      {NAV.map((item) => {
        const active = isActive(pathname, item);
        const className = `${styles.navItem} ${active ? styles.navItemActive : ""}`.trim();
        return (
          <Link key={item.id} href={item.href} className={className} aria-current={active ? "page" : undefined}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

