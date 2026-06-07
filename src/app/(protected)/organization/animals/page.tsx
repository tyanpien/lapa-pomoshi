"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
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
import { fetchOrgAnimalsAllPages, meOrganizationApi } from "@/shared/api/endpoints/meOrganization";
import type { Animal } from "@/shared/api/endpoints/animals";
import { getOrganizationCabinetEventName, getOrganizationProfile } from "@/shared/lib/organizationCabinet";
import { mapMeOrganizationAnimalRow } from "@/shared/lib/organizationMeCabinet";
import { mergeApiAndLocalAnimals } from "@/shared/lib/organizationPublicWards";
import { useOrganizationPublicCabinetPayload } from "@/shared/lib/hooks/useOrganizationPublicCabinetPayload";
import { formatAnimalSpeciesLabel } from "@/shared/lib/animalSpeciesLabels";
import { formatCatalogLabel } from "@/shared/lib/formatCatalogLabel";
import {
  combineAgeYearsMonths,
  formatAgeMonthsRu,
  splitAgeMonths,
} from "@/shared/lib/formatAgeMonthsRu";
import {
  CATALOG_OTHER_LABEL,
  CHARACTER_OTHER_SLUG,
  HEALTH_CARE_OTHER_SLUG,
} from "@/shared/lib/animalCatalogOther";
import {
  AnimalPhotoPicker,
  type AnimalFormPhoto,
} from "./components/AnimalPhotoPicker";
import { getImageUrl } from "@/shared/api/client";

type CatalogTagOption = { id: string; label: string };
type StatusFilter = "all" | "looking_for_home" | "on_treatment" | "in_shelter" | "archive";

const isArchivedAnimal = (animal: Animal) => animal.status === "archived";

type FormState = {
  name: string;
  species: string;
  breed: string;
  sex: "male" | "female";
  ageYears: number;
  ageMonthsPart: number;
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
  photos: AnimalFormPhoto[];
};

const initialForm: FormState = {
  name: "",
  species: "Собака",
  breed: "",
  sex: "male" as "male" | "female",
  ageYears: 0,
  ageMonthsPart: 0,
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
  photos: [],
};

function photosFromAnimal(animal: Animal): AnimalFormPhoto[] {
  if (animal.photos?.length) {
    return animal.photos.map((p) => ({
      key: `server-${p.id}`,
      id: p.id,
      previewUrl: p.url,
      isPrimary: p.is_primary,
      isPending: p.is_pending,
    }));
  }
  const urls =
    animal.photo_urls?.length
      ? animal.photo_urls
      : animal.primary_photo_url
        ? [animal.primary_photo_url]
        : [];
  return urls.map((url, index) => ({
    key: `legacy-${index}-${url}`,
    previewUrl: url.startsWith("http") || url.startsWith("data:") ? url : getImageUrl(url),
    isPrimary: index === 0,
  }));
}

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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [archivedAnimals, setArchivedAnimals] = useState<Animal[]>([]);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [ageYearsFocused, setAgeYearsFocused] = useState(false);
  const [ageMonthsFocused, setAgeMonthsFocused] = useState(false);
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

  const organizationTitle =
    getOrganizationProfile().organizationName?.trim() ||
    animals.find((a) => a.organization_name)?.organization_name ||
    "Организация";

  const reloadArchived = useCallback(async () => {
    if (!useMeCabinet || apiPayload.organizationId == null) {
      setArchivedAnimals([]);
      return;
    }
    setArchivedLoading(true);
    try {
      const rows = await fetchOrgAnimalsAllPages({ tab: "archive" });
      setArchivedAnimals(
        rows.map((row) =>
          mapMeOrganizationAnimalRow(
            row as Record<string, unknown>,
            organizationTitle,
            apiPayload.organizationId!
          )
        )
      );
    } catch {
      setArchivedAnimals([]);
    } finally {
      setArchivedLoading(false);
    }
  }, [useMeCabinet, apiPayload.organizationId, organizationTitle]);

  useEffect(() => {
    const eventName = getOrganizationAnimalsEventName();
    const cabinetEvent = getOrganizationCabinetEventName();
    const handleUpdate = () => {
      reloadAnimals();
      if (statusFilter === "archive" || statusFilter === "all") void reloadArchived();
    };
    window.addEventListener(eventName, handleUpdate);
    window.addEventListener(cabinetEvent, handleUpdate);
    return () => {
      window.removeEventListener(eventName, handleUpdate);
      window.removeEventListener(cabinetEvent, handleUpdate);
    };
  }, [statusFilter, reloadArchived]);

  useEffect(() => {
    if (statusFilter !== "archive" && statusFilter !== "all") return;
    void reloadArchived();
  }, [statusFilter, reloadArchived]);

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
      age_months: combineAgeYearsMonths(form.ageYears, form.ageMonthsPart),
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
      ageMonths: combineAgeYearsMonths(form.ageYears, form.ageMonthsPart),
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
      photoUrl: form.photos.find((p) => p.isPrimary)?.previewUrl ?? form.photos[0]?.previewUrl ?? "",
    };

    const doneLocal = () => {
      setForm(initialForm);
      setAgeYearsFocused(false);
      setAgeMonthsFocused(false);
      setCreateModalOpen(false);
      setEditingAnimalId(null);
      reloadAnimals();
    };

    if (useMeCabinet) {
      const uploadPendingLocalPhotos = async (animalId: number) => {
        const pending = form.photos.filter((p) => p.localFile && p.id == null);
        for (const photo of pending) {
          if (!photo.localFile) continue;
          await animalsApi.uploadImage(animalId, photo.localFile, photo.isPrimary);
        }
      };

      if (editingAnimalId) {
        void meOrganizationApi
          .patchAnimal(editingAnimalId, buildAnimalApiBody())
          .then(async () => {
            await uploadPendingLocalPhotos(editingAnimalId);
            if (form.photos.some((p) => p.localFile || p.isPending)) {
              await meOrganizationApi.patchAnimal(editingAnimalId, buildAnimalApiBody());
            }
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
          if (cid != null) {
            await uploadPendingLocalPhotos(cid);
            if (form.photos.length > 0) {
              await meOrganizationApi.patchAnimal(cid, buildAnimalApiBody());
            }
          }
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

  const sortedAnimals = useMemo(
    () =>
      [...animals].sort((a, b) => {
        if (a.is_urgent === b.is_urgent) return b.id - a.id;
        return a.is_urgent ? -1 : 1;
      }),
    [animals]
  );

  const activeAnimals = useMemo(
    () => sortedAnimals.filter((animal) => !isArchivedAnimal(animal)),
    [sortedAnimals]
  );

  const isArchiveView = statusFilter === "archive";
  const showAllWithArchive = statusFilter === "all";

  const matchesSearch = useCallback(
    (animal: Animal) => {
      const normalizedSearch = search.trim().toLowerCase();
      if (!normalizedSearch) return true;
      return (
        animal.name.toLowerCase().includes(normalizedSearch) ||
        (animal.breed || "").toLowerCase().includes(normalizedSearch) ||
        (animal.organization_name || "").toLowerCase().includes(normalizedSearch)
      );
    },
    [search]
  );

  const visibleAnimals = useMemo(() => {
    const archived = archivedAnimals.filter(matchesSearch);
    if (isArchiveView) return archived;

    const active = activeAnimals.filter((animal) => {
      if (!matchesSearch(animal)) return false;
      if (statusFilter === "all") return true;
      return animal.status === statusFilter;
    });

    if (showAllWithArchive) return [...active, ...archived];
    return active;
  }, [
    activeAnimals,
    archivedAnimals,
    isArchiveView,
    showAllWithArchive,
    matchesSearch,
    statusFilter,
  ]);

  const statusLabel = (status: string) => {
    if (status === "archived") return "архив";
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

    const age = splitAgeMonths(animal.age_months);
    setForm({
      name: animal.name || "",
      species: speciesForForm(animal.species, animal.sex),
      breed: animal.breed || "",
      sex: animal.sex === "female" ? "female" : "male",
      ageYears: age.years,
      ageMonthsPart: age.months,
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
      photos: photosFromAnimal(animal),
    });
    setEditingAnimalId(animalId);
    setAgeYearsFocused(false);
    setAgeMonthsFocused(false);
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
        void reloadArchived();
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

  const showAnimalCardMenu = (animal: Animal) => {
    if (isArchiveView || isArchivedAnimal(animal)) return false;
    if (useMeCabinet) return true;
    return !apiAnimalIds.has(animal.id);
  };

  const renderAnimalCard = (animal: Animal) => (
    <article key={animal.id} className={styles.animalCard}>
      <div className={styles.cover}>
        <img src={animal.primary_photo_url || "/placeholder.jpg"} alt={animal.name} />
        {animal.is_urgent && !isArchivedAnimal(animal) ? (
          <span className={styles.urgentBadge}>срочно</span>
        ) : null}
        {isArchiveView || isArchivedAnimal(animal) ? (
          <span className={`${styles.statusBadge} ${styles.archiveBadge}`}>архив</span>
        ) : (
          <span className={styles.statusBadge}>{statusLabel(animal.status)}</span>
        )}
      </div>
      <div className={styles.animalBody}>
        <div className={styles.cardActions}>
          {showAnimalCardMenu(animal) ? (
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
          <span>{formatAgeMonthsRu(animal.age_months)}</span>
        </div>
        <p className={styles.organizationLine}>{animal.organization_name || "Название организации"}</p>
        <Link className={styles.moreButton} href={`/catalog/animals/${animal.id}`}>
          Подробнее
        </Link>
      </div>
    </article>
  );

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <div className={styles.pageTop}>
          <div className={styles.topRow}>
            <h1 className={styles.title}>Подопечные</h1>
            {!isArchiveView ? (
              <button
                className={styles.addBtn}
                type="button"
                onClick={() => {
                  setEditingAnimalId(null);
                  setForm(initialForm);
                  setAgeYearsFocused(false);
                  setAgeMonthsFocused(false);
                  setSaveError(null);
                  setCreateModalOpen(true);
                }}
              >
                + Добавить животное
              </button>
            ) : null}
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
                className={`${styles.filterButton} ${
                  statusFilter === "in_shelter" ? styles.filterButtonActive : ""
                }`}
                onClick={() => setStatusFilter("in_shelter")}
              >
                В приюте
              </button>
              <button
                type="button"
                className={`${styles.filterButton} ${statusFilter === "archive" ? styles.filterButtonActive : ""}`}
                onClick={() => setStatusFilter("archive")}
              >
                Архив
              </button>
            </div>
          </div>
        </div>

        {archivedLoading && (isArchiveView || showAllWithArchive) && visibleAnimals.length === 0 ? (
          <div className={styles.emptyState}>Загрузка…</div>
        ) : visibleAnimals.length === 0 ? (
          <div className={styles.emptyState}>
            {isArchiveView
              ? useMeCabinet
                ? "В архиве пока нет подопечных."
                : "Архив доступен при работе с сервером."
              : "Пока нет добавленных животных."}
          </div>
        ) : (
          <section className={styles.list}>{visibleAnimals.map(renderAnimalCard)}</section>
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
                <div className={styles.label}>
                  <span>Возраст</span>
                  <div className={styles.ageInputs}>
                    <label className={styles.ageInputBox}>
                      <span className={styles.visuallyHidden}>Лет</span>
                      <input
                        className={styles.ageInput}
                        type="number"
                        min={0}
                        max={50}
                        value={form.ageYears === 0 && ageYearsFocused ? "" : form.ageYears}
                        onFocus={() => setAgeYearsFocused(true)}
                        onBlur={() => setAgeYearsFocused(false)}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            ageYears: Math.max(0, Number(e.target.value) || 0),
                          }))
                        }
                      />
                      <span className={styles.ageUnit} aria-hidden>
                        лет
                      </span>
                    </label>
                    <label className={styles.ageInputBox}>
                      <span className={styles.visuallyHidden}>Мес.</span>
                      <input
                        className={styles.ageInput}
                        type="number"
                        min={0}
                        max={11}
                        value={form.ageMonthsPart === 0 && ageMonthsFocused ? "" : form.ageMonthsPart}
                        onFocus={() => setAgeMonthsFocused(true)}
                        onBlur={() => setAgeMonthsFocused(false)}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            ageMonthsPart: Math.min(11, Math.max(0, Number(e.target.value) || 0)),
                          }))
                        }
                      />
                      <span className={styles.ageUnit} aria-hidden>
                        мес.
                      </span>
                    </label>
                  </div>
                </div>
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
              </div>

              <div className={styles.urgentRow}>
                <span>Срочный случай</span>
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={form.isUrgent}
                    onChange={(e) => setForm((prev) => ({ ...prev, isUrgent: e.target.checked }))}
                  />
                  <span className={styles.toggleSlider} />
                </label>
              </div>

              <AnimalPhotoPicker
                photos={form.photos}
                animalId={editingAnimalId}
                canUseApi={Boolean(editingAnimalId && apiAnimalIds.has(editingAnimalId))}
                onChange={(photos) => setForm((prev) => ({ ...prev, photos }))}
                onError={(message) => setSaveError(message)}
                onMutated={() => {
                  window.dispatchEvent(new Event(getOrganizationCabinetEventName()));
                  window.dispatchEvent(new Event(getOrganizationAnimalsEventName()));
                }}
              />

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

              <div className={styles.actions}>
                <button type="submit" className={styles.primaryButton}>
                  {editingAnimalId ? "Сохранить" : "Создать"}
                </button>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => {
                    setForm(initialForm);
                    setAgeYearsFocused(false);
                    setAgeMonthsFocused(false);
                  }}
                >
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
