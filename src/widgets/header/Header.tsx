"use client";

import { useState } from "react";
import Link from "next/link";
import Sidebar from "../sidebar/Sidebar";

export default function Header() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);

  return (
    <>
      <header className="w-full h-16 bg-white border-b flex items-center justify-between px-6 relative">
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="flex flex-col gap-1"
        >
          <span className="w-6 h-[2px] bg-black"></span>
          <span className="w-6 h-[2px] bg-black"></span>
          <span className="w-6 h-[2px] bg-black"></span>
        </button>

        <nav className="flex gap-6 items-center">
          <Link href="/help">Помочь</Link>
          <Link href="/urgent">Срочно</Link>

          <div
            className="relative"
            onMouseEnter={() => setIsCatalogOpen(true)}
            onMouseLeave={() => setIsCatalogOpen(false)}
          >
            <span className="cursor-pointer">Каталог</span>

            {isCatalogOpen && (
              <div className="absolute top-6 left-0 bg-white border shadow-md p-4 flex flex-col gap-2 z-50">
                <Link href="/catalog/animals">Животные</Link>
                <Link href="/catalog/organizations">Организации</Link>
                <Link href="/catalog/volunteers">Волонтеры</Link>
              </div>
            )}
          </div>

          <Link href="/knowledge">База знаний</Link>
          <Link href="/events">Мероприятия</Link>
        </nav>

        <Link href="/login">Вход</Link>
      </header>

      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
    </>
  );
}
