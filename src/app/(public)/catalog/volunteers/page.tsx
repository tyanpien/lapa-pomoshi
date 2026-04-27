"use client";

import { useEffect, useState, useRef } from "react";
import styles from "./page.module.css";
import Link from "next/link";
import { volunteersApi, Volunteer, VolunteersCatalogs, CatalogOption } from "@/shared/api/endpoints/volunteers";
import { getImageUrl } from "@/shared/api/client";

const sortOptions = ["сначала свободные", "по рейтингу", "по опыту", "по задачам"];

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
  const [showCount, setShowCount] = useState(6);

  const cityRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);

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
    setShowCount(6);
  };

  const matchesCompetency = (volunteerCompentencies: string[], selectedCompetencyLabel: string): boolean => {
    const keywords = competencyMapping[selectedCompetencyLabel] || [selectedCompetencyLabel];
    return keywords.some(keyword =>
      volunteerCompentencies.some(vc => vc.toLowerCase().includes(keyword.toLowerCase()))
    );
  };

  let filteredVolunteers = volunteers.filter((v) => {
    const matchesSearch = search === "" ||
      v.full_name.toLowerCase().includes(search.toLowerCase());

    const matchesCity = city === "" || v.location_city === city;

    const matchesNearby = !showNearby;

    const matchesWithWhom =
      withWhom === "all" ||
      (withWhom === "cat" && v.animal_types?.includes("Кошки")) ||
      (withWhom === "dog" && v.animal_types?.includes("Собаки"));

    const matchesCompetencies =
      competenciesSelected.length === 0 ||
      competenciesSelected.every((comp) => matchesCompetency(v.competency_tags || [], comp));

    const matchesExperience =
      experience.length === 0 || experience.includes(v.experience_level_label);

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
      return (b.is_available ? 1 : 0) - (a.is_available ? 1 : 0);
    }
    if (sortBy === "по рейтингу") {
      return b.rating - a.rating;
    }
    if (sortBy === "по опыту") {
      const expOrder: Record<string, number> = {
        "Новичок": 1,
        "Опытный": 2,
        "Ветеринарное образование": 3
      };
      return (expOrder[b.experience_level_label] || 0) - (expOrder[a.experience_level_label] || 0);
    }
    if (sortBy === "по задачам") {
      return b.completed_tasks_count - a.completed_tasks_count;
    }
    return 0;
  });

  const displayedVolunteers = filteredVolunteers.slice(0, showCount);

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
              onClick={() => setShowCount(showCount + 6)}
            >
              Показать {filteredVolunteers.length} волонтеров
            </button>

            <button className={styles.reset} onClick={resetFilters}>
              Сбросить фильтры
            </button>
          </aside>

          <div className={styles.grid}>
            {displayedVolunteers.map((v) => (
              <div key={v.user_id} className={styles.volunteerCard}>
                <div className={styles.volunteerHeader}>
                  <div className={styles.avatar}>
                    <img
                      src={getImageUrl(v.avatar_url) || "/event.png"}
                      alt={v.full_name}
                    />
                  </div>
                  <div className={styles.volunteerInfo}>
                    <h3>{v.full_name}</h3>
                    <div className={styles.rating}>
                      <img src="/star.svg" alt="рейтинг" className={styles.infoIconR} />
                      {v.rating}
                    </div>
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
                  {v.competency_tags?.slice(0, 4).map((skill, idx) => (
                    <span key={idx} className={styles.skillTag}>
                      {skill}
                    </span>
                  ))}
                </div>

                <Link href={`/catalog/volunteers/${v.user_id}`} className={styles.messageBtn}>
                  Написать
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
