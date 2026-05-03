"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import styles from "./page.module.css";
import Link from "next/link";
import { volunteersApi, Volunteer, VolunteersCatalogs, CatalogOption } from "@/shared/api/endpoints/volunteers";
import { getImageUrl } from "@/shared/api/client";
import { useUser } from "@/shared/lib/hooks/useUser";
import {
  VOLUNTEER_PROFILE_UPDATED_EVENT,
  readLinkedVolunteerCatalogUserId,
  readVolunteerDetailsFromStorage,
  resolveVolunteerCatalogIsAvailable,
} from "@/shared/lib/volunteerProfileStorage";
import {
  buildVolunteerCatalogCardChips,
  mergeVolunteerAnimalTypes,
  mergeVolunteerFilterCompetencyTags,
} from "@/shared/lib/volunteerCatalogEnrichment";

const sortOptions = ["сначала свободные", "по опыту", "все"];

const competencyMapping: Record<string, string[]> = {
  "Выгул / Уход": ["Выгул", "Уход"],
  "Фото / Видеосъемка": ["Фото", "Видеосъемка", "Фотосъемка"],
  "Передержка": ["Передержка"],
  "Тексты / Соцсети": ["Тексты", "Соцсети"],
  "Помощь руками": ["Руки", "Помощь руками"],
  "Автопомощь": ["Авто", "Автопомощь"],
  "Медицинская помощь": ["Медицинская помощь", "Медицина"],
};

export default function VolunteersPage() {
  const { userName } = useUser();
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [catalogs, setCatalogs] = useState<VolunteersCatalogs | null>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [openCity, setOpenCity] = useState(false);
  const [showNearby, setShowNearby] = useState(false);
  const [withWhom, setWithWhom] = useState<"all" | "cat" | "dog">("all");
  const [competenciesSelected, setCompetenciesSelected] = useState<string[]>([]);
  const [experience, setExperience] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState("сначала свободные");
  const [openSort, setOpenSort] = useState(false);
  const [catalogLocalTick, setCatalogLocalTick] = useState(0);

  const cityRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  const linkedCatalogSnapshot = useMemo(() => {
    void catalogLocalTick;
    const linkedId = readLinkedVolunteerCatalogUserId();
    const overlay =
      linkedId != null && userName?.trim()
        ? readVolunteerDetailsFromStorage(userName)
        : null;
    return { linkedId, overlay };
  }, [catalogLocalTick, userName]);

  useEffect(() => {
    const onProfilePersisted = () => setCatalogLocalTick((value) => value + 1);
    window.addEventListener(VOLUNTEER_PROFILE_UPDATED_EVENT, onProfilePersisted);
    return () => window.removeEventListener(VOLUNTEER_PROFILE_UPDATED_EVENT, onProfilePersisted);
  }, []);

  useEffect(() => {
    Promise.all([
      volunteersApi.getList(),
      volunteersApi.getCatalogs()
    ])
      .then(([volunteersData, catalogsData]) => {
        setVolunteers(volunteersData.items || []);
        setCatalogs(catalogsData);
        setLoading(false);
      })
      .catch(error => {
        console.error("Ошибка загрузки:", error);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (cityRef.current && !cityRef.current.contains(event.target as Node)) {
        setOpenCity(false);
      }
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setOpenSort(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const toggleCompetency = (value: string) => {
    setCompetenciesSelected(
      competenciesSelected.includes(value)
        ? competenciesSelected.filter((i) => i !== value)
        : [...competenciesSelected, value]
    );
  };

  const toggleExperience = (value: string) => {
    setExperience(
      experience.includes(value)
        ? experience.filter((i) => i !== value)
        : [...experience, value]
    );
  };

  const resetFilters = () => {
    setSearch("");
    setCity("");
    setShowNearby(false);
    setWithWhom("all");
    setCompetenciesSelected([]);
    setExperience([]);
    setSortBy("сначала свободные");
  };

  const matchesCompetency = (volunteerCompentencies: string[], selectedCompetencyLabel: string): boolean => {
    const keywords = competencyMapping[selectedCompetencyLabel] || [selectedCompetencyLabel];
    return keywords.some(keyword =>
      volunteerCompentencies.some(vc => vc.toLowerCase().includes(keyword.toLowerCase()))
    );
  };

  const volunteerEnrichmentFor = (v: Volunteer) =>
    linkedCatalogSnapshot.linkedId === v.user_id ? linkedCatalogSnapshot.overlay : null;

  const animalPoolHas = (pool: string[], label: string) =>
    pool.some((item) => item.toLowerCase() === label.toLowerCase());

  let filteredVolunteers = volunteers.filter((v) => {
    const enrichment = volunteerEnrichmentFor(v);
    const competencyPool = mergeVolunteerFilterCompetencyTags(v, enrichment);
    const animalPool = mergeVolunteerAnimalTypes(v, enrichment);

    const matchesSearch =
      search === "" || (v.full_name ?? "").toLowerCase().includes(search.toLowerCase());

    const matchesCity = city === "" || v.location_city === city;

    const matchesNearby = !showNearby;

    const matchesWithWhom =
      withWhom === "all" ||
      (withWhom === "cat" && animalPoolHas(animalPool, "Кошки")) ||
      (withWhom === "dog" && animalPoolHas(animalPool, "Собаки"));

    const matchesCompetencies =
      competenciesSelected.length === 0 ||
      competenciesSelected.every((comp) => matchesCompetency(competencyPool, comp));

    const matchesExperience =
      experience.length === 0 ||
      (v.experience_level_label != null && experience.includes(v.experience_level_label));

    return (
      matchesSearch &&
      matchesCity &&
      matchesNearby &&
      matchesWithWhom &&
      matchesCompetencies &&
      matchesExperience
    );
  });

  filteredVolunteers = [...filteredVolunteers].sort((a, b) => {
    if (sortBy === "сначала свободные") {
      const eff = (v: Volunteer) =>
        resolveVolunteerCatalogIsAvailable(v.is_available ?? false, volunteerEnrichmentFor(v));
      return (eff(b) ? 1 : 0) - (eff(a) ? 1 : 0);
    }
    if (sortBy === "по опыту") {
      const expOrder: Record<string, number> = {
        "Новичок": 1,
        "Опытный": 2,
        "Ветеринарное образование": 3
      };
      const rank = (label: string | null | undefined) =>
        label ? expOrder[label] ?? 0 : 0;
      return rank(b.experience_level_label) - rank(a.experience_level_label);
    }
    return 0;
  });

  const displayedVolunteers = filteredVolunteers;

  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.container}>
          <div className={styles.headerWithSort}>
            <h1>Волонтеры</h1>
          </div>
          <div className={styles.loading}>Загрузка...</div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <div className={styles.headerWithSort}>
          <h1>Волонтеры</h1>
          <div className={styles.sortDropdown} ref={sortRef}>
            <div
              className={styles.sortHeader}
              onClick={() => setOpenSort(!openSort)}
            >
              <img src="/sort.svg" alt="сортировка" className={styles.sortIcon} />
              {sortBy}
              <span>{openSort ? "▴" : "▾"}</span>
            </div>
            {openSort && (
              <div className={styles.sortList}>
                {sortOptions.map((option) => (
                  <div
                    key={option}
                    className={`${styles.sortItem} ${sortBy === option ? styles.activeSort : ""}`}
                    onClick={() => {
                      setSortBy(option);
                      setOpenSort(false);
                    }}
                  >
                    {option}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

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

            <div>
              <p>С кем готов работать</p>
              <div className={styles.buttons}>
                <button
                  className={withWhom === "cat" ? styles.activeBtn : ""}
                  onClick={() => setWithWhom("cat")}
                >
                  Кошки
                </button>
                <button
                  className={withWhom === "dog" ? styles.activeBtn : ""}
                  onClick={() => setWithWhom("dog")}
                >
                  Собаки
                </button>
                <button
                  className={withWhom === "all" ? styles.activeBtn : ""}
                  onClick={() => setWithWhom("all")}
                >
                  Все
                </button>
              </div>
            </div>

            <div>
              <p>Компетенции</p>
              <div className={styles.column}>
                {catalogs?.competencies?.map((comp: CatalogOption) => (
                  <label key={comp.id} className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={competenciesSelected.includes(comp.label)}
                      onChange={() => toggleCompetency(comp.label)}
                    />
                    <span className={styles.customCheckbox}></span>
                    {comp.label}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p>Опыт</p>
              <div className={styles.column}>
                {catalogs?.experience_levels?.map((exp: CatalogOption) => (
                  <label key={exp.id} className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={experience.includes(exp.label)}
                      onChange={() => toggleExperience(exp.label)}
                    />
                    <span className={styles.customCheckbox}></span>
                    {exp.label}
                  </label>
                ))}
              </div>
            </div>

            <button
              className={styles.showBtn}
              
            >
              Показать {filteredVolunteers.length} волонтеров
            </button>

            <button className={styles.reset} onClick={resetFilters}>
              Сбросить фильтры
            </button>
          </aside>

          <div className={styles.grid}>
            {displayedVolunteers.map((v) => {
              const enrichment = volunteerEnrichmentFor(v);
              const isAvailOnCard = resolveVolunteerCatalogIsAvailable(v.is_available ?? false, enrichment);
              const previewChips = buildVolunteerCatalogCardChips(v, enrichment, 6);
              return (
              <div key={v.user_id} className={styles.volunteerCard}>
                <div className={styles.volunteerHeader}>
                  <div className={styles.avatarWrap}>
                    <div className={styles.avatar}>
                      <img
                        src={getImageUrl(v.avatar_url) || "/event.png"}
                        alt={v.full_name ?? ""}
                      />
                    </div>
                    <span
                      className={`${styles.statusDot} ${isAvailOnCard ? styles.statusDotAvailable : styles.statusDotBusy}`}
                      role="img"
                      aria-label={isAvailOnCard ? "На связи" : "Занят"}
                    />
                  </div>
                  <div className={styles.volunteerInfo}>
                    <h3>{v.full_name}</h3>
                    <div className={styles.city}>
                      <img src="/org.svg" alt="город" className={styles.infoIcon} />
                      {v.location_city}
                    </div>
                  </div>
                </div>

                <div className={styles.experienceWrapper}>
                  <span className={styles.experienceBadge}>
                    {v.experience_level_label}
                  </span>
                  <span className={styles.tasksCompleted}>
                    {v.completed_tasks_count} выполненных задач
                  </span>
                </div>

                <div className={styles.skills}>
                  {previewChips.map((chip) => (
                    <span
                      key={`${chip.variant}-${chip.label}`}
                      className={[
                        styles.skillTag,
                        chip.variant === "format" ? styles.skillTagAccent : "",
                        chip.variant === "pet" ? styles.skillTagPetKind : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {chip.label}
                    </span>
                  ))}
                </div>

                <Link href={`/catalog/volunteers/${v.user_id}`} className={styles.messageBtn}>
                  Подробнее
                </Link>
              </div>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
