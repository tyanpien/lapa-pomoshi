"use client";

import Link from "next/link";
import { useState } from "react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: Props) {
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40"
          onClick={onClose}
        />
      )}

      <div
        className={`fixed top-0 left-0 h-full w-64 bg-white z-50 transform transition-transform ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-4 flex flex-col gap-4">
          <button onClick={onClose}>Закрыть</button>

          <Link href="/">Главная</Link>
          <Link href="/help">Помочь</Link>
          <Link href="/urgent">Срочно</Link>

          <div>
            <button onClick={() => setIsCatalogOpen(!isCatalogOpen)}>
              Каталог
            </button>

            {isCatalogOpen && (
              <div className="ml-4 mt-2 flex flex-col gap-2">
                <Link href="/catalog/animals">Животные</Link>
                <Link href="/catalog/organizations">Организации</Link>
                <Link href="/catalog/volunteers">Волонтеры</Link>
              </div>
            )}
          </div>

          <Link href="/knowledge">База знаний</Link>
          <Link href="/events">Мероприятия</Link>
          <Link href="/profile">Личный кабинет</Link>
        </div>
      </div>
    </>
  );
}
