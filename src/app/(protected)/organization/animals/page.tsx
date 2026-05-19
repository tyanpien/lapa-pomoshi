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
import { meOrganizationApi } from "@/shared/api/endpoints/meOrganization";
import { getOrganizationCabinetEventName } from "@/shared/lib/organizationCabinet";
import { mergeApiAndLocalAnimals } from "@/shared/lib/organizationPublicWards";
import { useOrganizationPublicCabinetPayload } from "@/shared/lib/hooks/useOrganizationPublicCabinetPayload";
import { formatAnimalSpeciesLabel } from "@/shared/lib/animalSpeciesLabels";
import { formatCatalogLabel } from "@/shared/lib/formatCatalogLabel";
import {
  CATALOG_OTHER_LABEL,
  CHARACTER_OTHER_SLUG,
  HEALTH_CARE_OTHER_SLUG,
} from "@/shared/lib/animalCatalogOther";

type CatalogTagOption = { id: string; label: string };

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
  healthCareSlugs: string[];
  healthCareOther: string;
  characterSlugs: string[];
  characterOther: string;
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
  healthCareSlugs: [],
  healthCareOther: "",
  characterSlugs: [],
  characterOther: "",
  status: "looking_for_home" as "looking_for_home" | "on_treatment" | "in_shelter",
  isUrgent: false,
  photoUrl: "",
};

function labelsFromSlugs(slugs: string[], options: CatalogTagOption[]): string[] {
  const byId = new Map(options.map((o) => [o.id, o.label]));
  return slugs
    .map((slug) => formatCatalogLabel(byId.get(slug) || slug))
    .filter(Boolean);
}

function toggleSlugList(list: string[], slug: string): string[] {
  return list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug];
}

function catalogSlugsForApi(slugs: string[]): string[] {
  return slugs.filter((s) => s !== HEALTH_CARE_OTHER_SLUG && s !== CHARACTER_OTHER_SLUG);
}

function otherTextIfChecked(slugs: string[], otherSlug: string, text: string): string | null {
  if (!slugs.includes(otherSlug)) return null;
  const trimmed = text.trim();
  return trimmed ? formatCatalogLabel(trimmed) : null;
}

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
  const [saveError, setSaveError] = useState<string | null>(null);
  const [healthCareOptions, setHealthCareOptions] = useState<CatalogTagOption[]>([]);
  const [characterOptions, setCharacterOptions] = useState<CatalogTagOption[]>([]);

  const animals = useMemo(
    () => mergeApiAndLocalAnimals(apiPayload.apiAnimals, localAnimals),
    [apiPayload.apiAnimals, localAnimals]
  );
  const apiAnimalIds = apiPayload.apiAnimalIds;
  const useMeCabinet = apiPayload.dataSource === "me" && apiPayload.organizationId != null;

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

  useEffect(() => {
    let cancelled = false;
    void animalsApi
      .getCatalogs()
      .then((data) => {
        if (cancelled || !data || typeof data !== "object") return;
        const row = data as {
          health_care_tags?: CatalogTagOption[];
          character_tags?: CatalogTagOption[];
        };
        setHealthCareOptions(
          (row.health_care_tags ?? []).map((o) => ({
            id: o.id,
            label: formatCatalogLabel(o.label),
          }))
        );
        setCharacterOptions(
          (row.character_tags ?? []).map((o) => ({
            id: o.id,
            label: formatCatalogLabel(o.label),
          }))
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const buildAnimalApiBody = () => {
    const speciesRaw = form.species.trim().toLowerCase();
    const species =
      speciesRaw.includes("кот") || speciesRaw.includes("cat")
        ? "cat"
        : speciesRaw.includes("соб") || speciesRaw.includes("dog")
          ? "dog"
          : speciesRaw.slice(0, 20) || "cat";
    return {
      name: form.name.trim(),
      species,
      breed: form.breed.trim() || null,
      sex: form.sex,
      age_months: Math.max(0, Number(form.ageMonths) || 0),
      location_city: form.city.trim() || null,
      full_description: form.description.trim() || null,
      health_features: form.healthFeatures.trim() || null,
      treatment_required: form.treatmentRequired.trim() || null,
      health_care_slugs: catalogSlugsForApi(form.healthCareSlugs),
      character_slugs: catalogSlugsForApi(form.characterSlugs),
      health_care_other: otherTextIfChecked(form.healthCareSlugs, HEALTH_CARE_OTHER_SLUG, form.healthCareOther),
      character_other: otherTextIfChecked(form.characterSlugs, CHARACTER_OTHER_SLUG, form.characterOther),
      status: form.status,
      is_urgent: form.isUrgent,
    };
  };

  const apiErrorMessage = (error: unknown) => {
    if (error instanceof Error && error.message.trim()) return error.message.trim();
    return "Не удалось сохранить данные на сервере. Попробуйте ещё раз.";
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaveError(null);
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
      healthCareSlugs: catalogSlugsForApi(form.healthCareSlugs),
      healthCareOther: form.healthCareOther,
      characterSlugs: catalogSlugsForApi(form.characterSlugs),
      characterOther: form.characterOther,
      healthChecklist: [
        ...labelsFromSlugs(catalogSlugsForApi(form.healthCareSlugs), healthCareOptions),
        ...(otherTextIfChecked(form.healthCareSlugs, HEALTH_CARE_OTHER_SLUG, form.healthCareOther)
          ? [otherTextIfChecked(form.healthCareSlugs, HEALTH_CARE_OTHER_SLUG, form.healthCareOther)!]
          : []),
      ],
      characterTags: [
        ...labelsFromSlugs(catalogSlugsForApi(form.characterSlugs), characterOptions),
        ...(otherTextIfChecked(form.characterSlugs, CHARACTER_OTHER_SLUG, form.characterOther)
          ? [otherTextIfChecked(form.characterSlugs, CHARACTER_OTHER_SLUG, form.characterOther)!]
          : []),
      ],
      status: form.status,
      isUrgent: form.isUrgent,
      photoUrl: form.photoUrl,
    };

    const doneLocal = () => {
      setForm(initialForm);
      setCreateModalOpen(false);
      setEditingAnimalId(null);
      reloadAnimals();
    };

    if (useMeCabinet) {
      const uploadDataUrlIfNeeded = async (animalId: number) => {
        if (!form.photoUrl?.startsWith("data:")) return;
        try {
          const r = await fetch(form.photoUrl);
          const blob = await r.blob();
          const file = new File([blob], "photo.jpg", { type: blob.type || "image/jpeg" });
          await animalsApi.uploadImage(animalId, file, true);
        } catch {
        }
      };

      if (editingAnimalId) {
        void meOrganizationApi
          .patchAnimal(editingAnimalId, buildAnimalApiBody())
          .then(async () => {
            await uploadDataUrlIfNeeded(editingAnimalId);
            window.dispatchEvent(new Event(getOrganizationCabinetEventName()));
            doneLocal();
          })
          .catch((error) => {
            setSaveError(apiErrorMessage(error));
          });
        return;
      }

      void meOrganizationApi
        .createAnimal(buildAnimalApiBody())
        .then(async (created) => {
          const row = created as { id?: unknown };
          const cid = typeof row?.id === "number" ? row.id : null;
          if (cid != null) await uploadDataUrlIfNeeded(cid);
          window.dispatchEvent(new Event(getOrganizationCabinetEventName()));
          doneLocal();
        })
        .catch((error) => {
          setSaveError(apiErrorMessage(error));
        });
      return;
    }

    if (editingAnimalId) {
      updateOrganizationAnimal(editingAnimalId, payload);
    } else {
      addOrganizationAnimal(payload);
    }

    doneLocal();
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

  const speciesForForm = (species: string | null | undefined, sex?: string | null): string =>
    formatAnimalSpeciesLabel(species, sex);

  const speciesForDisplay = (species: string | null | undefined, sex?: string | null): string =>
    formatAnimalSpeciesLabel(species, sex);

  const openEditModal = (animalId: number) => {
    const animal = animals.find((item) => item.id === animalId);
    if (!animal) return;

    setForm({
      name: animal.name || "",
      species: speciesForForm(animal.species, animal.sex),
      breed: animal.breed || "",
      sex: animal.sex === "female" ? "female" : "male",
      ageMonths: animal.age_months || 0,
      city: animal.location_city || "",
      description: animal.full_description || "",
      healthFeatures: animal.health_features || "",
      treatmentRequired: animal.treatment_required || "",
      healthCareSlugs: (() => {
        const slugs =
          animal.health_care_slugs?.length
            ? [...animal.health_care_slugs]
            : healthCareOptions
                .filter((o) =>
                  (animal.health_checklist ?? []).some(
                    (label) => label.trim().toLowerCase() === o.label.trim().toLowerCase()
                  )
                )
                .map((o) => o.id);
        if (animal.health_care_other?.trim()) slugs.push(HEALTH_CARE_OTHER_SLUG);
        return slugs;
      })(),
      healthCareOther: animal.health_care_other?.trim() || "",
      characterSlugs: (() => {
        const slugs =
          animal.character_slugs?.length
            ? [...animal.character_slugs]
            : characterOptions
                .filter((o) =>
                  (animal.character_tags ?? []).some(
                    (label) => label.trim().toLowerCase() === o.label.trim().toLowerCase()
                  )
                )
                .map((o) => o.id);
        if (animal.character_other?.trim()) slugs.push(CHARACTER_OTHER_SLUG);
        return slugs;
      })(),
      characterOther: animal.character_other?.trim() || "",
      status:
        animal.status === "looking_for_home" || animal.status === "on_treatment" || animal.status === "in_shelter"
          ? animal.status
          : "looking_for_home",
      isUrgent: Boolean(animal.is_urgent),
      photoUrl: animal.primary_photo_url || "",
    });
    setEditingAnimalId(animalId);
    setSaveError(null);
    setCreateModalOpen(true);
    setOpenMenuId(null);
  };

  const handleDelete = (animalId: number) => {
    if (useMeCabinet && apiAnimalIds.has(animalId)) {
      const ok = window.confirm("Отправить анкету в архив?");
      if (!ok) return;
      void meOrganizationApi.archiveAnimal(animalId).then(() => {
        window.dispatchEvent(new Event(getOrganizationCabinetEventName()));
        setOpenMenuId(null);
        reloadAnimals();
      });
      return;
    }
    if (apiAnimalIds.has(animalId)) return;
    const isConfirmed = window.confirm("Удалить карточку животного?");
    if (!isConfirmed) return;

    deleteOrganizationAnimal(animalId);
    setOpenMenuId(null);
    reloadAnimals();
  };

  const showAnimalCardMenu = (animalId: number) => {
    if (useMeCabinet) return true;
    return !apiAnimalIds.has(animalId);
  };

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <div className={styles.pageTop}>
          <div className={styles.topRow}>
            <h1 className={styles.title}>Подопечные</h1>
            <button
              className={styles.addBtn}
              type="button"
              onClick={() => {
                setEditingAnimalId(null);
                setForm(initialForm);
                setSaveError(null);
                setCreateModalOpen(true);
              }}
            >
              + Добавить животное
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
                    {showAnimalCardMenu(animal.id) ? (
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
                              {useMeCabinet && apiAnimalIds.has(animal.id) ? "В архив" : "Удалить анкету"}
                            </button>
                          </div>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                  <h3 className={styles.animalName}>{animal.name}</h3>
                  <div className={styles.tags}>
                    <span>{speciesForDisplay(animal.species, animal.sex)}</span>
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
            {saveError ? <p className={styles.saveError}>{saveError}</p> : null}
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
              <fieldset className={styles.checkboxFieldset}>
                <legend className={styles.checkboxLegend}>Здоровье и уход</legend>
                {healthCareOptions.length === 0 ? (
                  <p className={styles.checkboxHint}>Загрузка списка…</p>
                ) : (
                  <div className={styles.checkboxColumn}>
                    {healthCareOptions.map((option) => (
                      <label key={option.id} className={styles.checkboxOption}>
                        <input
                          type="checkbox"
                          checked={form.healthCareSlugs.includes(option.id)}
                          onChange={() =>
                            setForm((prev) => ({
                              ...prev,
                              healthCareSlugs: toggleSlugList(prev.healthCareSlugs, option.id),
                            }))
                          }
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                    <label className={styles.checkboxOption}>
                      <input
                        type="checkbox"
                        checked={form.healthCareSlugs.includes(HEALTH_CARE_OTHER_SLUG)}
                        onChange={() =>
                          setForm((prev) => ({
                            ...prev,
                            healthCareSlugs: toggleSlugList(prev.healthCareSlugs, HEALTH_CARE_OTHER_SLUG),
                            healthCareOther: prev.healthCareSlugs.includes(HEALTH_CARE_OTHER_SLUG)
                              ? ""
                              : prev.healthCareOther,
                          }))
                        }
                      />
                      <span>{CATALOG_OTHER_LABEL}</span>
                    </label>
                    {form.healthCareSlugs.includes(HEALTH_CARE_OTHER_SLUG) ? (
                      <input
                        className={styles.otherInput}
                        value={form.healthCareOther}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, healthCareOther: e.target.value }))
                        }
                        placeholder="Укажите свой вариант"
                      />
                    ) : null}
                  </div>
                )}
              </fieldset>

              <fieldset className={styles.checkboxFieldset}>
                <legend className={styles.checkboxLegend}>Особенности характера</legend>
                {characterOptions.length === 0 ? (
                  <p className={styles.checkboxHint}>Загрузка списка…</p>
                ) : (
                  <div className={styles.checkboxColumn}>
                    {characterOptions.map((option) => (
                      <label key={option.id} className={styles.checkboxOption}>
                        <input
                          type="checkbox"
                          checked={form.characterSlugs.includes(option.id)}
                          onChange={() =>
                            setForm((prev) => ({
                              ...prev,
                              characterSlugs: toggleSlugList(prev.characterSlugs, option.id),
                            }))
                          }
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                    <label className={styles.checkboxOption}>
                      <input
                        type="checkbox"
                        checked={form.characterSlugs.includes(CHARACTER_OTHER_SLUG)}
                        onChange={() =>
                          setForm((prev) => ({
                            ...prev,
                            characterSlugs: toggleSlugList(prev.characterSlugs, CHARACTER_OTHER_SLUG),
                            characterOther: prev.characterSlugs.includes(CHARACTER_OTHER_SLUG)
                              ? ""
                              : prev.characterOther,
                          }))
                        }
                      />
                      <span>{CATALOG_OTHER_LABEL}</span>
                    </label>
                    {form.characterSlugs.includes(CHARACTER_OTHER_SLUG) ? (
                      <input
                        className={styles.otherInput}
                        value={form.characterOther}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, characterOther: e.target.value }))
                        }
                        placeholder="Укажите свой вариант"
                      />
                    ) : null}
                  </div>
                )}
              </fieldset>

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
