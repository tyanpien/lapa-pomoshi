"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Animal } from "@/shared/api/endpoints/animals";
import { resolveAnimalAvatarSrc } from "@/shared/api/client";
import styles from "./createRequestModal.module.css";

type WardSelectProps = {
  animals: Animal[];
  value: string;
  onChange: (animalId: string) => void;
  placeholder?: string;
  allowEmpty?: boolean;
};

export function WardSelect({
  animals,
  value,
  onChange,
  placeholder = "Введите имя подопечного",
  allowEmpty = false,
}: WardSelectProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => animals.find((a) => String(a.id) === value) ?? null,
    [animals, value]
  );

  useEffect(() => {
    if (selected) setQuery(selected.name);
    else if (!value) setQuery("");
  }, [selected?.id, selected?.name, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return animals;
    return animals.filter((a) => a.name.toLowerCase().includes(q));
  }, [animals, query]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = (animal: Animal) => {
    onChange(String(animal.id));
    setQuery(animal.name);
    setOpen(false);
  };

  const clear = () => {
    onChange("");
    setQuery("");
    setOpen(false);
  };

  const clearIfMismatch = () => {
    if (selected && query.trim() !== selected.name) {
      onChange("");
    }
  };

  return (
    <div className={styles.wardSelect} ref={rootRef}>
      <input
        className={styles.fieldInput}
        type="text"
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange("");
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={clearIfMismatch}
        autoComplete="off"
      />
      <button
        type="button"
        className={`${styles.wardChevron} ${open ? styles.wardChevronOpen : ""}`}
        aria-label={open ? "Свернуть список" : "Развернуть список"}
        onClick={() => setOpen((v) => !v)}
      />
      {open && (allowEmpty || filtered.length > 0) ? (
        <ul className={styles.wardDropdown} role="listbox">
          {allowEmpty ? (
            <li role="option" aria-selected={!value}>
              <button
                type="button"
                className={`${styles.wardOption} ${!value ? styles.wardOptionActive : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={clear}
              >
                <span className={styles.wardName}>Общая заявка организации</span>
              </button>
            </li>
          ) : null}
          {filtered.map((animal) => {
            const active = String(animal.id) === value;
            const img = resolveAnimalAvatarSrc(
              animal.primary_photo_url,
              animal.photo_urls?.[0]
            );
            return (
              <li key={animal.id} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={`${styles.wardOption} ${active ? styles.wardOptionActive : ""}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(animal)}
                >
                  <img className={styles.wardThumb} src={img} alt="" />
                  <span className={styles.wardName}>{animal.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

