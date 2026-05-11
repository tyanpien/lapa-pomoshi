"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getLoginHref } from "@/shared/lib/auth/loginHref";
import { useUser } from "@/shared/lib/hooks/useUser";
import styles from "./page.module.css";
import {
  organizationsApi,
  organizationLogoPath,
  type Organization,
  type OrganizationCatalogs,
  type NeedOption,
} from "@/shared/api/endpoints/organizations";
import { getImageUrl } from "@/shared/api/client";
import { statsFromOrganizationPublicPage } from "@/shared/lib/organizationPublicCabinet";

const needsMap: Record<string, string> = {
  urgent: "Срочно",
  volunteers: "Нужны волонтеры",
  foster: "Нужна передержка",
  financial: "Финансовая помощь",
  items: "Помощь вещами / кормом",
  auto: "Автопомощь",
};

type OrgPublicStats = { wards: number; adopted: number };

export default function OrganizationsPage() {
  const router = useRouter();
  const { isAuth } = useUser();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [catalogs, setCatalogs] = useState<OrganizationCatalogs | null>(null);
  const [loading, setLoading] = useState(true);
  const [publicStatsByOrgId, setPublicStatsByOrgId] = useState<Record<number, OrgPublicStats>>({});

  const [search, setSearch] = useState("");
  const [specialization, setSpecialization] = useState("all");
  const [needs, setNeeds] = useState<string[]>([]);
  const [city, setCity] = useState("");
  const [openCity, setOpenCity] = useState(false);
  const [openNeeds, setOpenNeeds] = useState(false);
  const [showCount, setShowCount] = useState(6);

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

  const matchesSpecializationFilter = (org: Organization, spec: string): boolean => {
    if (spec === "all") return true;
    const s = (org.specialization || "").toLowerCase();
    if (spec === "cat" || spec === "dog") {
      return s === spec || s === "both";
    }
    return s === spec;
  };

  const filteredOrganizations = useMemo(() => {
    return organizations.filter((org) => {
      const matchesSearch =
        search === "" || (org.name || "").toLowerCase().includes(search.toLowerCase());

      const matchesSpecialization = matchesSpecializationFilter(org, specialization);

      const matchesCity = city === "" || org.city === city;

      const matchesNeeds = needs.length === 0 || needs.some((n) => org.needs?.includes(n));

      return matchesSearch && matchesSpecialization && matchesCity && matchesNeeds;
    });
  }, [organizations, search, specialization, city, needs]);

  const sortedOrganizations = useMemo(() => {
    return [...filteredOrganizations].sort((a, b) => {
      const aUrgent = isUrgent(a);
      const bUrgent = isUrgent(b);
      if (aUrgent === bUrgent) return 0;
      return aUrgent ? -1 : 1;
    });
  }, [filteredOrganizations]);

  const displayedOrganizations = useMemo(
    () => sortedOrganizations.slice(0, showCount),
    [sortedOrganizations, showCount]
  );

  useEffect(() => {
    const ids = filteredOrganizations.map((o) => o.id);
    if (!ids.length) return;

    let cancelled = false;
    void Promise.all(
      ids.map((id) =>
        organizationsApi
          .getById(id)
          .then((page) => {
            const org = organizations.find((o) => o.id === id);
            const fallback = {
              wards_count: org?.wards_count ?? 0,
              adopted_yearly_count: org?.adopted_yearly_count ?? 0,
            };
            return { id, ...statsFromOrganizationPublicPage(page, fallback) };
          })
          .catch(() => {
            const org = organizations.find((o) => o.id === id);
            return {
              id,
              wards: org?.wards_count ?? 0,
              adopted: org?.adopted_yearly_count ?? 0,
            };
          })
      )
    ).then((rows) => {
      if (cancelled) return;
      setPublicStatsByOrgId((prev) => {
        const next = { ...prev };
        for (const r of rows) {
          next[r.id] = { wards: r.wards, adopted: r.adopted };
        }
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [organizations, filteredOrganizations]);

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
            {displayedOrganizations.map((org) => {
              const displayName = org.name?.trim() || "Без названия";
              const displayAddress =
                (org.address && org.address.trim()) || (org.city && org.city.trim()) || "Адрес не указан";
              const fromPublic = publicStatsByOrgId[org.id];
              const wardsCount = fromPublic?.wards ?? org.wards_count ?? 0;
              const adoptedYearlyCount = fromPublic?.adopted ?? org.adopted_yearly_count ?? 0;

              return (
              <div key={org.id} className={styles.orgCard}>
                <div className={styles.orgHeader}>
                  <div className={styles.orgLogo}>
                    <img
                      src={getImageUrl(organizationLogoPath(org)) || "/event.png"}
                      alt={displayName}
                    />
                  </div>
                  <div className={styles.orgInfo}>
                    <h3>{displayName}</h3>
                    <div className={styles.orgStats}>
                      <span>
                        <img src="/lapa.svg" alt="подопечные" className={styles.orgIcon} />
                        {wardsCount} подопечных
                      </span>
                      <span>
                        <img src="/home.svg" alt="пристроено" className={styles.orgIcon} />
                        {adoptedYearlyCount} пристроено за год
                      </span>
                    </div>
                    <div className={styles.orgAddress}>
                      <img src="/org.svg" alt="адрес" className={styles.orgIcon} />
                      {displayAddress}
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
                    <button
                      type="button"
                      className={styles.helpBtn}
                      onClick={() => {
                        const target = `/catalog/organizations/${org.id}`;
                        if (!isAuth) {
                          router.push(getLoginHref(target));
                          return;
                        }
                        router.push(target);
                      }}
                    >
                      Помочь
                    </button>
                    <Link href={`/catalog/organizations/${org.id}`} className={styles.detailsBtn}>
                      Подробнее
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
