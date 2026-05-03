"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";
import { organizationsApi, Organization, OrganizationCatalogs, NeedOption } from "@/shared/api/endpoints/organizations";
import { getOrganizationCabinetEventName, getOrganizationCabinetRecordByName } from "@/shared/lib/organizationCabinet";
import { getOrganizationAnimalsByName } from "@/shared/lib/organizationAnimals";
import { getImageUrl } from "@/shared/api/client";

const needsMap: Record<string, string> = {
  urgent: "Срочно",
  volunteers: "Нужны волонтеры",
  foster: "Нужна передержка",
  financial: "Финансовая помощь",
  items: "Помощь вещами / кормом",
  auto: "Автопомощь",
};

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [catalogs, setCatalogs] = useState<OrganizationCatalogs | null>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [specialization, setSpecialization] = useState("all");
  const [needs, setNeeds] = useState<string[]>([]);
  const [city, setCity] = useState("");
  const [openCity, setOpenCity] = useState(false);
  const [openNeeds, setOpenNeeds] = useState(false);
  const [showCount, setShowCount] = useState(6);
  const [cabinetVersion, setCabinetVersion] = useState(0);

  const cityRef = useRef<HTMLDivElement>(null);
  const needsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      organizationsApi.getList(),
      organizationsApi.getCatalogs()
    ])
      .then(([orgsData, catalogsData]) => {
        setOrganizations(orgsData.items || []);
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
      if (needsRef.current && !needsRef.current.contains(event.target as Node)) {
        setOpenNeeds(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const eventName = getOrganizationCabinetEventName();
    const syncFromCabinet = () => setCabinetVersion((prev) => prev + 1);
    window.addEventListener(eventName, syncFromCabinet);
    return () => window.removeEventListener(eventName, syncFromCabinet);
  }, []);

  const toggleNeed = (value: string) => {
    setNeeds(
      needs.includes(value)
        ? needs.filter((i) => i !== value)
        : [...needs, value]
    );
  };

  const resetFilters = () => {
    setSearch("");
    setSpecialization("all");
    setNeeds([]);
    setCity("");
    setShowCount(6);
  };

  const getNeedLabel = (needId: string): string => {
    return needsMap[needId] || needId;
  };

  const isUrgent = (org: Organization): boolean => {
    return org.needs?.includes("urgent") || false;
  };

  const filteredOrganizations = organizations.filter((org) => {
    const matchesSearch = search === "" ||
      (org.name || "").toLowerCase().includes(search.toLowerCase());

    const matchesSpecialization =
      specialization === "all" || org.specialization === specialization;

    const matchesCity = city === "" || org.city === city;

    const matchesNeeds =
      needs.length === 0 ||
      needs.some((n) => org.needs?.includes(n));

    return matchesSearch && matchesSpecialization && matchesCity && matchesNeeds;
  });

  const sortedOrganizations = [...filteredOrganizations].sort((a, b) => {
    const aUrgent = isUrgent(a);
    const bUrgent = isUrgent(b);
    if (aUrgent === bUrgent) return 0;
    return aUrgent ? -1 : 1;
  });

  const displayedOrganizations = sortedOrganizations.slice(0, showCount);

  const organizationsWithCabinetData = useMemo(() => {
    void cabinetVersion;
    return displayedOrganizations.map((org) => {
      const cabinetRecord = getOrganizationCabinetRecordByName(org.name || "");
      const organizationAnimals = getOrganizationAnimalsByName(org.name || "");
      const wardsCount = organizationAnimals.length || org.wards_count || 0;
      const adoptedYearlyCount = cabinetRecord?.greetingsFromHome.length || org.adopted_yearly_count || 0;

      return {
        ...org,
        displayName: cabinetRecord?.profile.organizationName?.trim() || org.name || "Без названия",
        displayAddress: cabinetRecord?.profile.territory?.trim() || org.address || "Адрес не указан",
        displayWardsCount: wardsCount,
        displayAdoptedYearlyCount: adoptedYearlyCount,
      };
    });
  }, [cabinetVersion, displayedOrganizations]);

  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.container}>
          <h1>Фонды и приюты</h1>
          <div className={styles.loading}>Загрузка...</div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <h1>Фонды и приюты</h1>

        <div className={styles.layout}>
          <aside className={styles.filters}>
            <input
              placeholder="Найти"
              className={styles.search}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div>
              <p>Специализация</p>
              <div className={styles.buttons}>
                <button
                  className={specialization === "cat" ? styles.activeBtn : ""}
                  onClick={() => setSpecialization("cat")}
                >
                  Кошки
                </button>
                <button
                  className={specialization === "dog" ? styles.activeBtn : ""}
                  onClick={() => setSpecialization("dog")}
                >
                  Собаки
                </button>
                <button
                  className={specialization === "all" ? styles.activeBtn : ""}
                  onClick={() => setSpecialization("all")}
                >
                  Все
                </button>
              </div>
            </div>


            <p onClick={() => setOpenNeeds(!openNeeds)}>
              Текущие потребности <span>{openNeeds ? "▴" : "▾"}</span>
            </p>
            {openNeeds && (
              <div className={styles.column}>
                {catalogs?.needs_options?.map((need: NeedOption) => (
                  <label key={need.id} className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={needs.includes(need.id)}
                      onChange={() => toggleNeed(need.id)}
                    />
                    <span className={styles.customCheckbox}></span>
                    {need.label}
                  </label>
                ))}
              </div>
            )}

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

            <button
              className={styles.showBtn}
              onClick={() => setShowCount(showCount + 6)}
            >
              Показать {filteredOrganizations.length} организаций
            </button>

            <button className={styles.reset} onClick={resetFilters}>
              Сбросить фильтры
            </button>
          </aside>

          <div className={styles.grid}>
            {organizationsWithCabinetData.map((org) => (
              <div key={org.id} className={styles.orgCard}>
                <div className={styles.orgHeader}>
                  <div className={styles.orgLogo}>
                    <img
                      src={getImageUrl(org.logo) || "/event.png"}
                      alt={org.displayName}
                    />
                  </div>
                  <div className={styles.orgInfo}>
                    <h3>{org.displayName}</h3>
                    <div className={styles.orgStats}>
                      <span>
                        <img src="/lapa.svg" alt="подопечные" className={styles.orgIcon} />
                        {org.displayWardsCount} подопечных
                      </span>
                      <span>
                        <img src="/home.svg" alt="пристроено" className={styles.orgIcon} />
                        {org.displayAdoptedYearlyCount} пристроено за год
                      </span>
                    </div>
                    <div className={styles.orgAddress}>
                      <img src="/org.svg" alt="адрес" className={styles.orgIcon} />
                      {org.displayAddress}
                    </div>
                  </div>
                </div>

                <div className={styles.orgBottomRow}>
                  <div className={styles.orgNeeds}>
                    <div className={styles.needsTags}>
                      {org.needs?.length ? (
                        org.needs.map((needId, idx) => (
                          <span
                            key={idx}
                            className={needId === "urgent" ? styles.needTagUrgent : styles.needTag}
                          >
                            {getNeedLabel(needId)}
                          </span>
                        ))
                      ) : (
                        <span className={styles.needTag}>Потребности не указаны</span>
                      )}
                    </div>
                  </div>
                  <div className={styles.orgButtons}>
                    <button className={styles.helpBtn}>Помочь</button>
                    <Link href={`/catalog/organizations/${org.id}`} className={styles.detailsBtn}>
                      Подробнее
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
