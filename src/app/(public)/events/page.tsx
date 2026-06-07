"use client";

import { useState, useRef, useEffect } from "react";
import styles from "./page.module.css";
import { eventsApi, EventItem, EventsCatalogs } from "@/shared/api/endpoints/events";
import Link from "next/link";
import {
  getEventActionLabel,
  isEventListLinkDisabled,
} from "@/shared/lib/eventRegistration";

type Format = "all" | EventItem["format"];

export default function EventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [catalogs, setCatalogs] = useState<EventsCatalogs | null>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [format, setFormat] = useState<Format>("all");
  const [types, setTypes] = useState<string[]>([]);
  const [openCity, setOpenCity] = useState(false);
  const [showCount, setShowCount] = useState(6);

  const cityRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      eventsApi.getList(),
      eventsApi.getCatalogs(),
    ])
      .then(([eventsData, catalogsData]) => {
        setEvents(eventsData.items || []);
        setCatalogs(catalogsData);
        setLoading(false);
      })
      .catch((e) => {
        console.error(e);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (cityRef.current && !cityRef.current.contains(e.target as Node)) {
        setOpenCity(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggle = (value: string) => {
    setTypes((prev) =>
      prev.includes(value)
        ? prev.filter((i) => i !== value)
        : [...prev, value]
    );
  };

  const resetFilters = () => {
    setSearch("");
    setCity("");
    setFormat("all");
    setTypes([]);
    setShowCount(6);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const formatTime = (start: string, end: string | null) => {
    const startLabel = new Date(start).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    if (!end) return startLabel;
    return `${startLabel} — ${new Date(end).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
  };

  const filtered = events.filter((e) => {
    return (
      e.title.toLowerCase().includes(search.toLowerCase()) &&
      (city === "" || (e.city ?? "") === city) &&
      (format === "all" || e.format === format) &&
      (types.length === 0 || (e.help_type ? types.includes(e.help_type) : false))
    );
  });

  const displayed = filtered.slice(0, showCount);

  if (loading) return <div className={styles.loading}>Загрузка...</div>;

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <h1 className={styles.title}>Мероприятия</h1>

        <div className={styles.layout}>
          <aside className={styles.filters}>
            <input
              placeholder="Найти"
              className={styles.search}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div className={styles.dropdownFilter} ref={cityRef}>
              <div
                className={styles.dropdownHeader}
                onClick={() => setOpenCity(!openCity)}
              >
                {city || "Выберите город"}
                <span>{openCity ? "▴" : "▾"}</span>
              </div>

              {openCity && (
                <div className={styles.dropdownList}>
                  <div
                    className={styles.dropdownItem}
                    onClick={() => {
                      setCity("");
                      setOpenCity(false);
                    }}
                  >
                    Все города
                  </div>

                  {catalogs?.cities?.map((c: string) => (
                    <div
                      key={c}
                      className={styles.dropdownItem}
                      onClick={() => {
                        setCity(c);
                        setOpenCity(false);
                      }}
                    >
                      {c}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.block}>
              <p>Формат</p>
              <div className={styles.buttons}>
                {catalogs?.formats?.map((f) => (
                  <button
                    key={f.id}
                    className={format === f.id ? styles.activeBtn : ""}
                    onClick={() => setFormat(f.id as Format)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.block}>
              <p>Как помочь</p>
              <div className={styles.column}>
                {catalogs?.help_types?.map((t) => (
                  <label key={t.id} className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={types.includes(t.id)}
                      onChange={() => toggle(t.id)}
                    />
                    <span className={styles.customCheckbox}></span>
                    {t.label}
                  </label>
                ))}
              </div>
            </div>

            <button
              className={styles.showBtn}
              onClick={() => setShowCount((p) => p + 6)}
            >
              Показать {filtered.length} мероприятий
            </button>

            <button className={styles.reset} onClick={resetFilters}>
              Сбросить
            </button>
          </aside>

          <div className={styles.grid}>
            {displayed.map((e) => (
              <div key={e.id} className={styles.card}>
                <h3>{e.title}</h3>

                <div className={styles.date}>
                  <img src="/calendar.svg" alt="" />
                  <div>
                    <div>{formatDate(e.starts_at)}</div>
                    <span>{formatTime(e.starts_at, e.ends_at)}</span>
                  </div>
                </div>

                <p className={styles.org}>
                  Организатор: <b>{e.organization_name}</b>
                </p>

                <p className={styles.desc}>{e.summary}</p>

                <p className={styles.location}>
                  {e.city}, {e.address}
                </p>

                {isEventListLinkDisabled(e.registration_action) ? (
                  <span className={`${styles.action} ${styles.actionDisabled}`}>
                    {getEventActionLabel(e.registration_action)}
                  </span>
                ) : (
                  <Link href={`/events/${e.id}`} className={styles.action}>
                    {getEventActionLabel(e.registration_action)}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
