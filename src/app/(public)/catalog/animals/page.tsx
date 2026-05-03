"use client";

import { useEffect, useState, useRef } from "react";
import styles from "./page.module.css";
import Link from "next/link";
import { animalsApi, Animal } from "@/shared/api/endpoints/animals";
import { getImageUrl } from "@/shared/api/client";
import {
  getAllOrganizationAnimals,
  getOrganizationAnimalsEventName,
} from "@/shared/lib/organizationAnimals";

interface AgeGroup {
  id: string;
  label: string;
  min_months: number;
  max_months: number | null;
}

interface CatalogItem {
  id: string;
  label: string;
}

interface Organization {
  id: number;
  name: string;
}

interface CatalogsData {
  age_groups: AgeGroup[];
  features: CatalogItem[];
  organizations: Organization[];
}

export default function Page() {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [catalogs, setCatalogs] = useState<CatalogsData | null>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [type, setType] = useState<"all" | "cat" | "dog">("all");
  const [gender, setGender] = useState<string[]>([]);
  const [age, setAge] = useState<string[]>([]);
  const [status, setStatus] = useState<string[]>([]);
  const [features, setFeatures] = useState<string[]>([]);
  const [org, setOrg] = useState("");

  const [openFeatures, setOpenFeatures] = useState(false);
  const [openStatus, setOpenStatus] = useState(false);
  const [openOrg, setOpenOrg] = useState(false);

  const orgRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      animalsApi.getList(),
      animalsApi.getCatalogs()
    ])
      .then(([animalsData, catalogsData]) => {
        const apiAnimals = animalsData.items || [];
        const organizationAnimals = getAllOrganizationAnimals();
        setAnimals([...organizationAnimals, ...apiAnimals]);
        setCatalogs(catalogsData);
        setLoading(false);
      })
      .catch(error => {
        console.error("Ошибка загрузки:", error);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const eventName = getOrganizationAnimalsEventName();
    const handleUpdate = () => {
      setAnimals((previous) => {
        const externalAnimals = previous.filter((animal) => animal.id < 1_000_000_000_000);
        const organizationAnimals = getAllOrganizationAnimals();
        return [...organizationAnimals, ...externalAnimals];
      });
    };
    window.addEventListener(eventName, handleUpdate);
    return () => window.removeEventListener(eventName, handleUpdate);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (orgRef.current && !orgRef.current.contains(event.target as Node)) {
        setOpenOrg(false);
      }
      if (featuresRef.current && !featuresRef.current.contains(event.target as Node)) {
        setOpenFeatures(false);
      }
      if (statusRef.current && !statusRef.current.contains(event.target as Node)) {
        setOpenStatus(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>, animal: Animal) => {
    const species = normalizeSpecies(animal.species);
    e.currentTarget.src = species === "cat" ? "/cat-placeholder.jpg" : "/dog-placeholder.jpg";
  };

  const toggle = (value: string, list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>) => {
    setList(
      list.includes(value)
        ? list.filter(i => i !== value)
        : [...list, value]
    );
  };

  const resetFilters = (): void => {
    setType("all");
    setGender([]);
    setAge([]);
    setStatus([]);
    setFeatures([]);
    setOrg("");
  };

  const normalizeSpecies = (s: string): "cat" | "dog" | "other" => {
    if (!s) return "other";
    const val = s.toLowerCase().trim();
    
    const catKeywords = ["кот", "кош", "котёнок", "котенок", "котяра", "котик"];
    const dogKeywords = ["соб", "пёс", "пес", "щен", "собач", "дог", "dog", "псина", "собака"];
    
    if (catKeywords.some(keyword => val.includes(keyword))) {
      return "cat";
    }
    
    if (dogKeywords.some(keyword => val.includes(keyword))) {
      return "dog";
    }
    
    return "other";
  };

  const mapStatus = (status: string): string => {
    if (status === "looking_for_home") return "home";
    if (status === "on_treatment") return "treatment";
    if (status === "in_shelter") return "temporary";
    return status;
  };

  const formatAge = (months: number): string => {
    if (!months && months !== 0) return "Возраст не указан";
    if (months < 12) {
      return `${months} ${months === 1 ? "месяц" : months < 5 ? "месяца" : "месяцев"}`;
    }
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (remainingMonths === 0) {
      return `${years} ${years === 1 ? "год" : years < 5 ? "года" : "лет"}`;
    }
    return `${years} ${years === 1 ? "год" : years < 5 ? "года" : "лет"} ${remainingMonths} ${remainingMonths === 1 ? "месяц" : remainingMonths < 5 ? "месяца" : "месяцев"}`;
  };

  const matchAge = (months: number): boolean => {
    if (age.length === 0) return true;
    return age.some(ageId => {
      const group = catalogs?.age_groups?.find(g => g.id === ageId);
      if (!group) return true;
      const min = group.min_months ?? 0;
      const max = group.max_months ?? Infinity;
      return months >= min && months <= max;
    });
  };

  const sortByUrgent = (a: Animal, b: Animal): number => {
    if (a.is_urgent === b.is_urgent) return 0;
    return a.is_urgent ? -1 : 1;
  };

  const filtered = animals.filter(animal => {
    const species = normalizeSpecies(animal.species);
    const mappedStatus = mapStatus(animal.status);

    return (
      animal.name?.toLowerCase().includes(search.toLowerCase()) &&
      (type === "all" || species === type) &&
      (gender.length === 0 || gender.includes(animal.sex)) &&
      (status.length === 0 || status.includes(mappedStatus)) &&
      matchAge(animal.age_months) &&
      (features.length === 0 ||
        features.every(f => animal.catalog_features?.includes(f))) &&
      (org === "" || animal.organization_name === org)
    );
  });

  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.container}>
          <h1>Ищут дом</h1>
          <div className={styles.loading}>Загрузка...</div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <h1>Ищут дом</h1>

        <div className={styles.layout}>
          <aside className={styles.filters}>
            <input
              placeholder="Найти"
              className={styles.search}
              onChange={e => setSearch(e.target.value)}
            />

            <div>
              <p>Вид</p>
              <div className={styles.buttons}>
                <button
                  className={type === "cat" ? styles.activeBtn : ""}
                  onClick={() => setType("cat")}
                >
                  Кошки
                </button>
                <button
                  className={type === "dog" ? styles.activeBtn : ""}
                  onClick={() => setType("dog")}
                >
                  Собаки
                </button>
                <button
                  className={type === "all" ? styles.activeBtn : ""}
                  onClick={() => setType("all")}
                >
                  Все
                </button>
              </div>
            </div>

            <div>
              <p>Пол</p>
              <div className={styles.column}>
                <label className={styles.checkboxLabel}>
                  <input onChange={() => toggle("male", gender, setGender)} type="checkbox" />
                  <span className={styles.customCheckbox}></span>
                  Мальчик
                </label>
                <label className={styles.checkboxLabel}>
                  <input onChange={() => toggle("female", gender, setGender)} type="checkbox" />
                  <span className={styles.customCheckbox}></span>
                  Девочка
                </label>
              </div>
            </div>

            <div>
              <p>Возраст</p>
              <div className={styles.column}>
                {catalogs?.age_groups?.map(g => (
                  <label key={g.id} className={styles.checkboxLabel}>
                    <input onChange={() => toggle(g.id, age, setAge)} type="checkbox" />
                    <span className={styles.customCheckbox}></span>
                    {g.label}
                  </label>
                ))}
              </div>
            </div>

            <p
              onClick={(e) => {
                e.stopPropagation();
                setOpenFeatures(!openFeatures);
              }}
              style={{ cursor: "pointer" }}
            >
              Особенности <span>{openFeatures ? "▴" : "▾"}</span>
            </p>
            {openFeatures && (
              <div className={styles.column}>
                {catalogs?.features?.map(f => (
                  <label key={f.id} className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      onChange={() => toggle(f.label, features, setFeatures)}
                    />
                    <span className={styles.customCheckbox}></span>
                    {f.label}
                  </label>
                ))}
              </div>
            )}

            <p
              onClick={(e) => {
                e.stopPropagation();
                setOpenStatus(!openStatus);
              }}
              style={{ cursor: "pointer" }}
            >
              Статус <span>{openStatus ? "▴" : "▾"}</span>
            </p>
            {openStatus && (
              <div className={styles.column}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    onChange={() => toggle("home", status, setStatus)}
                  />
                  <span className={styles.customCheckbox}></span>
                  Ищет дом
                </label>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    onChange={() => toggle("treatment", status, setStatus)}
                  />
                  <span className={styles.customCheckbox}></span>
                  На лечении
                </label>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    onChange={() => toggle("temporary", status, setStatus)}
                  />
                  <span className={styles.customCheckbox}></span>
                  Передержка
                </label>
              </div>
            )}

            <div className={styles.dropdownFilter} ref={orgRef}>
              <div
                className={styles.dropdownHeader}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenOrg(!openOrg);
                }}
              >
                {org || "Выберите организацию"}
                <span>{openOrg ? "▴" : "▾"}</span>
              </div>
              {openOrg && (
                <div className={styles.dropdownList}>
                  <div
                    className={styles.dropdownItem}
                    onClick={() => {
                      setOrg("");
                      setOpenOrg(false);
                    }}
                  >
                    Все организации
                  </div>
                  {catalogs?.organizations?.map(o => (
                    <div
                      key={o.id}
                      className={styles.dropdownItem}
                      onClick={() => {
                        setOrg(o.name);
                        setOpenOrg(false);
                      }}
                    >
                      {o.name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button className={styles.showBtn}>
              Показать {filtered.length} животных
            </button>
            <button className={styles.reset} onClick={resetFilters}>
              Сбросить фильтры
            </button>
          </aside>

          <div className={styles.grid}>
            {[...filtered].sort(sortByUrgent).map(animal => {
              const species = normalizeSpecies(animal.species);
              const mappedStatus = mapStatus(animal.status);
              const imageUrl = getImageUrl(animal.primary_photo_url);

              return (
                <div key={animal.id} className={styles.card}>
                  <div className={styles.image}>
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={animal.name}
                        onError={e => handleImageError(e, animal)}
                      />
                    ) : (
                      <img
                        src={species === "cat" ? "/cat-placeholder.jpg" : "/dog-placeholder.jpg"}
                        alt={animal.name}
                      />
                    )}
                    {animal.is_urgent && <span className={styles.badge}>срочно</span>}
                    <span className={styles.status}>
                      {mappedStatus === "home"
                        ? "Ищет дом"
                        : mappedStatus === "treatment"
                        ? "На лечении"
                        : "В приюте"}
                    </span>
                  </div>

                  <div className={styles.info}>
                    <h3>{animal.name}</h3>
                    <div className={styles.tags}>
                      <span>{species === "cat" ? "Кошка" : "Собака"}</span>
                      <span>{animal.breed || "Метис"}</span>
                      <span>{formatAge(animal.age_months)}</span>
                    </div>
                    <p className={styles.org}>
                      {animal.organization_name || "Без организации"}
                    </p>
                    <div style={{ display: "flex", justifyContent: "left" }}>
                      <Link href={`/catalog/animals/${animal.id}`} className={styles.action}>
                        {mappedStatus === "home" ? "Забрать домой" : "Помочь"}
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
