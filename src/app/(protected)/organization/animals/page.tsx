"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";
import {
  addOrganizationAnimal,
  deleteOrganizationAnimal,
  getCurrentOrganizationAnimals,
  getOrganizationAnimalsEventName,
  updateOrganizationAnimal,
} from "@/shared/lib/organizationAnimals";
import { animalsApi } from "@/shared/api/endpoints/animals";
import { getOrganizationCabinetEventName } from "@/shared/lib/organizationCabinet";
import { mergeApiAndLocalAnimals } from "@/shared/lib/organizationPublicWards";
import { useOrganizationPublicCabinetPayload } from "@/shared/lib/hooks/useOrganizationPublicCabinetPayload";

type FormState = {
  name: string;
  species: string;
  breed: string;
  sex: "male" | "female";
  ageMonths: number;
  city: string;
  description: string;
  healthFeatures: string;
  treatmentRequired: string;
  characterTags: string;
  status: "looking_for_home" | "on_treatment" | "in_shelter";
  isUrgent: boolean;
  photoUrl: string;
};

const initialForm: FormState = {
  name: "",
  species: "Собака",
  breed: "",
  sex: "male" as "male" | "female",
  ageMonths: 12,
  city: "",
  description: "",
  healthFeatures: "",
  treatmentRequired: "",
  characterTags: "",
  status: "looking_for_home" as "looking_for_home" | "on_treatment" | "in_shelter",
  isUrgent: false,
  photoUrl: "",
};

export default function OrganizationAnimalsPage() {
  const apiPayload = useOrganizationPublicCabinetPayload();
  const [form, setForm] = useState(initialForm);
  const [localAnimals, setLocalAnimals] = useState(getCurrentOrganizationAnimals());
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [editingAnimalId, setEditingAnimalId] = useState<number | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "looking_for_home" | "on_treatment" | "in_shelter">(
    "all"
  );

  const animals = useMemo(
    () => mergeApiAndLocalAnimals(apiPayload.apiAnimals, localAnimals),
    [apiPayload.apiAnimals, localAnimals]
  );
  const apiAnimalIds = apiPayload.apiAnimalIds;

  const reloadAnimals = () => {
    setLocalAnimals(getCurrentOrganizationAnimals());
  };

  useEffect(() => {
    const eventName = getOrganizationAnimalsEventName();
    const handleUpdate = () => reloadAnimals();
    window.addEventListener(eventName, handleUpdate);
    return () => window.removeEventListener(eventName, handleUpdate);
  }, []);

  useEffect(() => {
    const closeMenu = () => setOpenMenuId(null);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim() || !form.description.trim()) return;

    const payload = {
      name: form.name,
      species: form.species,
      breed: form.breed,
      sex: form.sex,
      ageMonths: Number(form.ageMonths),
      city: form.city,
      description: form.description,
      healthFeatures: form.healthFeatures,
      treatmentRequired: form.treatmentRequired,
      characterTags: form.characterTags
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      status: form.status,
      isUrgent: form.isUrgent,
      photoUrl: form.photoUrl,
    };

    if (editingAnimalId) {
      updateOrganizationAnimal(editingAnimalId, payload);
    } else {
      addOrganizationAnimal(payload);
    }

    setForm(initialForm);
    setCreateModalOpen(false);
    setEditingAnimalId(null);
    reloadAnimals();
  };

  const handlePhotoSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const editing = editingAnimalId;
    if (editing !== null && apiAnimalIds.has(editing)) {
      void animalsApi
        .uploadImage(editing, file, true)
        .then(() => {
          window.dispatchEvent(new Event(getOrganizationCabinetEventName()));
          window.dispatchEvent(new Event(getOrganizationAnimalsEventName()));
        })
        .catch(() => {})
        .finally(() => {
          event.target.value = "";
        });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") return;
      setForm((prev) => ({ ...prev, photoUrl: result }));
    };
    reader.readAsDataURL(file);
  };

  const sortedAnimals = useMemo(
    () =>
      [...animals].sort((a, b) => {
        if (a.is_urgent === b.is_urgent) return b.id - a.id;
        return a.is_urgent ? -1 : 1;
      }),
    [animals]
  );

  const visibleAnimals = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return sortedAnimals.filter((animal) => {
      const bySearch =
        !normalizedSearch ||
        animal.name.toLowerCase().includes(normalizedSearch) ||
        (animal.breed || "").toLowerCase().includes(normalizedSearch) ||
        (animal.organization_name || "").toLowerCase().includes(normalizedSearch);

      const byStatus = statusFilter === "all" || animal.status === statusFilter;
      return bySearch && byStatus;
    });
  }, [search, sortedAnimals, statusFilter]);

  const formatAge = (months: number) => {
    if (months < 12) {
      return `${months} ${months === 1 ? "месяц" : months < 5 ? "месяца" : "месяцев"}`;
    }

    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (!remainingMonths) {
      return `${years} ${years === 1 ? "год" : years < 5 ? "года" : "лет"}`;
    }

    return `${years} ${years === 1 ? "год" : years < 5 ? "года" : "лет"} ${remainingMonths} ${
      remainingMonths === 1 ? "месяц" : remainingMonths < 5 ? "месяца" : "месяцев"
    }`;
  };

  const statusLabel = (status: string) => {
    if (status === "looking_for_home") return "ищет дом";
    if (status === "on_treatment") return "на лечении";
    if (status === "looking_for_foster") return "ищет передержку";
    return "в приюте";
  };

  const openEditModal = (animalId: number) => {
    if (apiAnimalIds.has(animalId)) return;
    const animal = animals.find((item) => item.id === animalId);
    if (!animal) return;

    setForm({
      name: animal.name || "",
      species: animal.species || "Собака",
      breed: animal.breed || "",
      sex: animal.sex === "female" ? "female" : "male",
      ageMonths: animal.age_months || 0,
      city: animal.location_city || "",
      description: animal.full_description || "",
      healthFeatures: animal.health_features || "",
      treatmentRequired: animal.treatment_required || "",
      characterTags: animal.character_tags?.join(", ") || "",
      status:
        animal.status === "looking_for_home" || animal.status === "on_treatment" || animal.status === "in_shelter"
          ? animal.status
          : "looking_for_home",
      isUrgent: Boolean(animal.is_urgent),
      photoUrl: animal.primary_photo_url || "",
    });
    setEditingAnimalId(animalId);
    setCreateModalOpen(true);
    setOpenMenuId(null);
  };

  const handleDelete = (animalId: number) => {
    if (apiAnimalIds.has(animalId)) return;
    const isConfirmed = window.confirm("Удалить карточку животного?");
    if (!isConfirmed) return;

    deleteOrganizationAnimal(animalId);
    setOpenMenuId(null);
    reloadAnimals();
  };

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Подопечные</h1>
            <button
              className={styles.addLink}
              type="button"
              onClick={() => {
                setEditingAnimalId(null);
                setForm(initialForm);
                setCreateModalOpen(true);
              }}
            >
              Добавить животное
            </button>
          </div>
          <div className={styles.filters}>
            <input
              className={styles.searchInput}
              placeholder="Найти"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <div className={styles.statusFilters}>
              <button
                type="button"
                className={`${styles.filterButton} ${statusFilter === "all" ? styles.filterButtonActive : ""}`}
                onClick={() => setStatusFilter("all")}
              >
                Все
              </button>
              <button
                type="button"
                className={`${styles.filterButton} ${
                  statusFilter === "looking_for_home" ? styles.filterButtonActive : ""
                }`}
                onClick={() => setStatusFilter("looking_for_home")}
              >
                Ищет дом
              </button>
              <button
                type="button"
                className={`${styles.filterButton} ${
                  statusFilter === "on_treatment" ? styles.filterButtonActive : ""
                }`}
                onClick={() => setStatusFilter("on_treatment")}
              >
                На лечении
              </button>
              <button
                type="button"
                className={`${styles.filterButton} ${statusFilter === "in_shelter" ? styles.filterButtonActive : ""}`}
                onClick={() => setStatusFilter("in_shelter")}
              >
                В приюте
              </button>
            </div>
          </div>
        </div>

        {visibleAnimals.length === 0 ? (
          <div className={styles.emptyState}>Пока нет добавленных животных.</div>
        ) : (
          <section className={styles.list}>
            {visibleAnimals.map((animal) => (
              <article key={animal.id} className={styles.animalCard}>
                <div className={styles.cover}>
                  <img src={animal.primary_photo_url || "/cat-placeholder.jpg"} alt={animal.name} />
                  {animal.is_urgent ? <span className={styles.urgentBadge}>срочно</span> : null}
                  <span className={styles.statusBadge}>{statusLabel(animal.status)}</span>
                </div>
                <div className={styles.animalBody}>
                  <div className={styles.cardActions}>
                    {!apiAnimalIds.has(animal.id) ? (
                      <>
                        <button
                          className={styles.menuButton}
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setOpenMenuId((prev) => (prev === animal.id ? null : animal.id));
                          }}
                        >
                          ⋮
                        </button>
                        {openMenuId === animal.id ? (
                          <div className={styles.menuDropdown} onClick={(event) => event.stopPropagation()}>
                            <button type="button" onClick={() => openEditModal(animal.id)}>
                              Редактировать
                            </button>
                            <button type="button" onClick={() => handleDelete(animal.id)}>
                              Удалить анкету
                            </button>
                          </div>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                  <h3 className={styles.animalName}>{animal.name}</h3>
                  <div className={styles.tags}>
                    <span>{animal.species || "Не указан"}</span>
                    <span>{animal.breed || "Метис"}</span>
                    <span>{formatAge(animal.age_months)}</span>
                  </div>
                  <p className={styles.organizationLine}>{animal.organization_name || "Название организации"}</p>
                  <Link className={styles.moreButton} href={`/catalog/animals/${animal.id}`}>
                    Подробнее
                  </Link>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>

      {isCreateModalOpen ? (
        <div className={styles.modalOverlay} onClick={() => setCreateModalOpen(false)}>
          <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
            <h2 className={styles.modalTitle}>{editingAnimalId ? "Редактировать животное" : "Добавить животное"}</h2>
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.formGrid}>
                <label className={styles.label}>
                  Кличка*
                  <input
                    className={styles.input}
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </label>
                <label className={styles.label}>
                  Вид
                  <select
                    className={styles.select}
                    value={form.species}
                    onChange={(e) => setForm((prev) => ({ ...prev, species: e.target.value }))}
                  >
                    <option value="Собака">Собака</option>
                    <option value="Кот">Кот</option>
                  </select>
                </label>
                <label className={styles.label}>
                  Порода
                  <input
                    className={styles.input}
                    value={form.breed}
                    onChange={(e) => setForm((prev) => ({ ...prev, breed: e.target.value }))}
                  />
                </label>
                <label className={styles.label}>
                  Пол
                  <select
                    className={styles.select}
                    value={form.sex}
                    onChange={(e) => setForm((prev) => ({ ...prev, sex: e.target.value as "male" | "female" }))}
                  >
                    <option value="male">Мальчик</option>
                    <option value="female">Девочка</option>
                  </select>
                </label>
                <label className={styles.label}>
                  Возраст (в месяцах)
                  <input
                    className={styles.input}
                    type="number"
                    min={1}
                    value={form.ageMonths}
                    onChange={(e) => setForm((prev) => ({ ...prev, ageMonths: Number(e.target.value) }))}
                  />
                </label>
                <label className={styles.label}>
                  Город
                  <input
                    className={styles.input}
                    value={form.city}
                    onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
                  />
                </label>
                <label className={styles.label}>
                  Статус
                  <select
                    className={styles.select}
                    value={form.status}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        status: e.target.value as "looking_for_home" | "on_treatment" | "in_shelter",
                      }))
                    }
                  >
                    <option value="looking_for_home">Ищет дом</option>
                    <option value="on_treatment">На лечении</option>
                    <option value="in_shelter">В приюте</option>
                  </select>
                </label>
                <label className={styles.label}>
                  Прикрепить фото
                  <input className={styles.input} type="file" accept="image/*" onChange={handlePhotoSelect} />
                </label>
              </div>

              <label className={styles.label}>
                Краткая история / описание*
                <textarea
                  className={styles.textarea}
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  required
                />
              </label>
              <label className={styles.label}>
                Особенности здоровья
                <textarea
                  className={styles.textarea}
                  value={form.healthFeatures}
                  onChange={(e) => setForm((prev) => ({ ...prev, healthFeatures: e.target.value }))}
                />
              </label>
              <label className={styles.label}>
                Требуемое лечение
                <textarea
                  className={styles.textarea}
                  value={form.treatmentRequired}
                  onChange={(e) => setForm((prev) => ({ ...prev, treatmentRequired: e.target.value }))}
                />
              </label>
              <label className={styles.label}>
                Черты характера (через запятую)
                <input
                  className={styles.input}
                  value={form.characterTags}
                  onChange={(e) => setForm((prev) => ({ ...prev, characterTags: e.target.value }))}
                />
              </label>

              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={form.isUrgent}
                  onChange={(e) => setForm((prev) => ({ ...prev, isUrgent: e.target.checked }))}
                />
                Срочный случай
              </label>

              <div className={styles.actions}>
                <button type="submit" className={styles.primaryButton}>
                  {editingAnimalId ? "Сохранить" : "Создать"}
                </button>
                <button type="button" className={styles.secondaryButton} onClick={() => setForm(initialForm)}>
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
