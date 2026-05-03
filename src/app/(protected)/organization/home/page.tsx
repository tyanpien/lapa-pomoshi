"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";
import {
  addOrganizationGreeting,
  deleteOrganizationGreeting,
  getOrganizationCabinetEventName,
  getOrganizationGreetings,
  updateOrganizationGreeting,
} from "@/shared/lib/organizationCabinet";
import { getCurrentOrganizationAnimals, getOrganizationAnimalsEventName } from "@/shared/lib/organizationAnimals";

const initialState = {
  petName: "",
  text: "",
  photoUrl: "",
  linkedAnimalId: "",
};

export default function OrganizationHomeGreetingsPage() {
  const [form, setForm] = useState(initialState);
  const [greetings, setGreetings] = useState(getOrganizationGreetings());
  const [animals, setAnimals] = useState(getCurrentOrganizationAnimals());
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [editingGreetingId, setEditingGreetingId] = useState<number | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const cabinetEventName = getOrganizationCabinetEventName();
    const animalsEventName = getOrganizationAnimalsEventName();
    const sync = () => {
      setGreetings(getOrganizationGreetings());
      setAnimals(getCurrentOrganizationAnimals());
    };
    sync();
    window.addEventListener(cabinetEventName, sync);
    window.addEventListener(animalsEventName, sync);
    return () => {
      window.removeEventListener(cabinetEventName, sync);
      window.removeEventListener(animalsEventName, sync);
    };
  }, []);

  useEffect(() => {
    const closeMenu = () => setOpenMenuId(null);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  const visibleGreetings = useMemo(() => {
    const query = search.trim().toLowerCase();
    return greetings.filter((item) => {
      if (!query) return true;
      return item.petName.toLowerCase().includes(query) || item.text.toLowerCase().includes(query);
    });
  }, [greetings, search]);

  const handlePhotoSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") return;
      setForm((prev) => ({ ...prev, photoUrl: result }));
    };
    reader.readAsDataURL(file);
  };

  const animalsById = useMemo(() => {
    return new Map(animals.map((animal) => [animal.id, animal]));
  }, [animals]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.petName.trim() || !form.text.trim()) return;

    const payload = {
      petName: form.petName.trim(),
      text: form.text.trim(),
      photoUrl: form.photoUrl.trim() || undefined,
      linkedAnimalId: form.linkedAnimalId ? Number(form.linkedAnimalId) : undefined,
    };

    if (editingGreetingId) {
      updateOrganizationGreeting(editingGreetingId, payload);
    } else {
      addOrganizationGreeting(payload);
    }

    setForm(initialState);
    setCreateModalOpen(false);
    setEditingGreetingId(null);
  };

  const openEditModal = (greetingId: number) => {
    const greeting = greetings.find((item) => item.id === greetingId);
    if (!greeting) return;

    setForm({
      petName: greeting.petName || "",
      text: greeting.text || "",
      photoUrl: greeting.photoUrl || "",
      linkedAnimalId: greeting.linkedAnimalId ? String(greeting.linkedAnimalId) : "",
    });
    setEditingGreetingId(greetingId);
    setCreateModalOpen(true);
    setOpenMenuId(null);
  };

  const handleDelete = (greetingId: number) => {
    const isConfirmed = window.confirm("Удалить публикацию?");
    if (!isConfirmed) return;
    deleteOrganizationGreeting(greetingId);
    setOpenMenuId(null);
  };

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Привет из дома</h1>
            <button
              className={styles.addLink}
              type="button"
              onClick={() => {
                setForm(initialState);
                setEditingGreetingId(null);
                setCreateModalOpen(true);
              }}
            >
              Добавить публикацию
            </button>
          </div>

          <div className={styles.filters}>
            <input
              className={styles.searchInput}
              placeholder="Найти"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        {visibleGreetings.length === 0 ? (
          <div className={styles.emptyState}>Публикаций пока нет.</div>
        ) : (
          <section className={styles.list}>
            {visibleGreetings.map((item) => (
              <article key={item.id} className={styles.requestCard}>
                <div className={styles.cover}>
                  <img src={item.photoUrl?.trim() || "/cat-placeholder.jpg"} alt={item.petName} />
                </div>

                <div className={styles.requestBody}>
                  <div className={styles.cardActions}>
                    <button
                      className={styles.menuButton}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setOpenMenuId((prev) => (prev === item.id ? null : item.id));
                      }}
                    >
                      ⋮
                    </button>
                    {openMenuId === item.id ? (
                      <div className={styles.menuDropdown} onClick={(event) => event.stopPropagation()}>
                        <button type="button" onClick={() => openEditModal(item.id)}>
                          Редактировать
                        </button>
                        <button type="button" onClick={() => handleDelete(item.id)}>
                          Удалить публикацию
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <h3 className={styles.requestName}>{item.petName}</h3>
                  <div className={styles.tags}>
                    <span>Привет из дома</span>
                    {item.linkedAnimalId && animalsById.get(item.linkedAnimalId) ? (
                      <span>Животное: {animalsById.get(item.linkedAnimalId)?.name}</span>
                    ) : null}
                  </div>
                  <p className={styles.organizationLine}>{item.text}</p>
                  <p className={styles.metaLine}>
                    {new Date(item.createdAt).toLocaleDateString("ru-RU", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>

      {isCreateModalOpen ? (
        <div className={styles.modalOverlay} onClick={() => setCreateModalOpen(false)}>
          <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
            <h2 className={styles.modalTitle}>{editingGreetingId ? "Редактировать публикацию" : "Добавить публикацию"}</h2>

            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.formGrid}>
                <label className={styles.label}>
                  Имя питомца
                  <input
                    className={styles.input}
                    value={form.petName}
                    onChange={(e) => setForm((prev) => ({ ...prev, petName: e.target.value }))}
                    required
                  />
                </label>

                <label className={styles.label}>
                  Прикрепить фото
                  <input className={styles.input} type="file" accept="image/*" onChange={handlePhotoSelect} />
                </label>

                <label className={styles.label}>
                  Привязать к животному (необязательно)
                  <select
                    className={styles.select}
                    value={form.linkedAnimalId}
                    onChange={(e) => setForm((prev) => ({ ...prev, linkedAnimalId: e.target.value }))}
                  >
                    <option value="">Без привязки</option>
                    {animals.map((animal) => (
                      <option key={animal.id} value={animal.id}>
                        {animal.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className={styles.label}>
                Текст
                <textarea
                  className={styles.textarea}
                  value={form.text}
                  onChange={(e) => setForm((prev) => ({ ...prev, text: e.target.value }))}
                  required
                />
              </label>

              <div className={styles.actions}>
                <button type="submit" className={styles.primaryButton}>
                  {editingGreetingId ? "Сохранить" : "Опубликовать"}
                </button>
                <button type="button" className={styles.secondaryButton} onClick={() => setForm(initialState)}>
                  Очистить форму
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
