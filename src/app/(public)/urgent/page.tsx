"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import styles from "./page.module.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getLoginHref } from "@/shared/lib/auth/loginHref";
import { useUser } from "@/shared/lib/hooks/useUser";

import { urgentApi, UrgentCatalogs, UrgentItem } from "@/shared/api/endpoints/urgent";
import { getImageUrl } from "@/shared/api/client";
import { normalizeUrgentFeedItems } from "@/shared/lib/urgentFeedNormalize";
import { takeFirstSentences } from "@/shared/lib/teaserSentences";
import { formatRub } from "@/shared/lib/formatRub";

interface UrgentCard {
  id: number;
  animalId: number;
  title: string;
  org: string;
  description: string;
  tags: string[];
  helpType: string;
  status: string;
  amount: string;
  action: string;
  image: string;
  animalSpecies: "cat" | "dog";
  city: string;
}

export default function UrgentPage() {
  const router = useRouter();
  const { isAuth } = useUser();
  const [cards, setCards] = useState<UrgentItem[]>([]);
  const [catalogs, setCatalogs] = useState<UrgentCatalogs | null>(null);

  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [openCity, setOpenCity] = useState(false);
  const [animalType, setAnimalType] = useState<"all" | "cat" | "dog">("all");
  const [helpTypes, setHelpTypes] = useState<string[]>([]);
  const [showCount, setShowCount] = useState(10);

  const cityRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    urgentApi.getList().then((data) => {
      const urgentOnly = data.items.filter((i: UrgentItem) => i.is_urgent);
      setCards(normalizeUrgentFeedItems(urgentOnly));
      setShowCount(10);
    });

    urgentApi.getCatalogs().then(setCatalogs);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (cityRef.current && !cityRef.current.contains(e.target as Node)) {
        setOpenCity(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const mappedCards = useMemo<UrgentCard[]>(() => {
    return cards.map((item) => {
      const isProgress = item.target_amount;

      return {
        id: item.id,
        animalId: item.animal_id ?? item.id,

        title: item.animal_name || item.title,
        org: item.organization_name,
        description: item.description,

        tags: item.badges || [],
        helpType: item.help_type,

        status: isProgress ? formatRub(item.target_amount) : item.deadline_label || "",

        amount: isProgress ? "progress" : "deadline",

        action: item.volunteer_needed ? "Помочь" : "Связаться",

        image: item.primary_photo_url
          ? getImageUrl(item.primary_photo_url)
          : "/cat-placeholder.jpg",

        animalSpecies: item.animal_species === "dog" || item.animal_species === "cat" ? item.animal_species : "cat",
        city: item.city ?? "",
      };
    });
  }, [cards]);

  const filteredCards = useMemo(() => {
    let filtered = mappedCards;

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (card) =>
          card.title.toLowerCase().includes(q) || card.org.toLowerCase().includes(q)
      );
    }

    if (city) {
      filtered = filtered.filter((card) => card.city === city);
    }

    if (animalType !== "all") {
      filtered = filtered.filter((card) => card.animalSpecies === animalType);
    }

    if (helpTypes.length > 0) {
      filtered = filtered.filter((card) => helpTypes.includes(card.helpType));
    }

    return filtered;
  }, [mappedCards, search, city, animalType, helpTypes]);

  const toggleHelpType = (value: string) => {
    setShowCount(10);
    setHelpTypes((prev) =>
      prev.includes(value) ? prev.filter((i) => i !== value) : [...prev, value]
    );
  };

  const resetFilters = () => {
    setSearch("");
    setCity("");
    setAnimalType("all");
    setHelpTypes([]);
    setShowCount(10);
  };

  const displayedCards = filteredCards.slice(0, showCount);
  const cities = catalogs?.cities || [];

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.pageHeader}>
          <h1 className={styles.title}>Срочно нужна помощь</h1>
        </header>

        <div className={styles.layout}>
          <aside className={styles.filters}>
            <input
              className={styles.search}
              placeholder="Найти"
              value={search}
              onChange={(e) => {
                setShowCount(10);
                setSearch(e.target.value);
              }}
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
                      setShowCount(10);
                      setCity("");
                      setOpenCity(false);
                    }}
                  >
                    Все города
                  </div>

                  {cities.map((c: string) => (
                    <div
                      key={c}
                      className={styles.dropdownItem}
                      onClick={() => {
                        setShowCount(10);
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

            <section className={styles.filterBlock}>
              <h2 className={styles.filterTitle}>Кому помочь</h2>

              <div className={styles.buttons}>
                <button
                  className={`${styles.pill} ${
                    animalType === "cat" ? styles.activeBtn : ""
                  }`}
                  onClick={() => {
                    setShowCount(10);
                    setAnimalType("cat");
                  }}
                >
                  Кошки
                </button>

                <button
                  className={`${styles.pill} ${
                    animalType === "dog" ? styles.activeBtn : ""
                  }`}
                  onClick={() => {
                    setShowCount(10);
                    setAnimalType("dog");
                  }}
                >
                  Собаки
                </button>

                <button
                  className={`${styles.pill} ${
                    animalType === "all" ? styles.activeBtn : ""
                  }`}
                  onClick={() => {
                    setShowCount(10);
                    setAnimalType("all");
                  }}
                >
                  Все
                </button>
              </div>
            </section>

            <section className={styles.filterBlock}>
              <h2 className={styles.filterTitle}>Как помочь</h2>

              <div className={styles.column}>
                {catalogs?.help_types?.map((t) => (
                  <label key={t.id} className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={helpTypes.includes(t.id)}
                      onChange={() => toggleHelpType(t.id)}
                    />
                    <span className={styles.customCheckbox}></span>
                    {t.label}
                  </label>
                ))}
              </div>
            </section>

            <button
              className={styles.primaryBtn}
              onClick={() => setShowCount((prev) => prev + 10)}
            >
              Показать {filteredCards.length} объявлений
            </button>

            <button className={styles.resetBtn} onClick={resetFilters}>
              Сбросить фильтры
            </button>
          </aside>

          <section className={styles.cardsSection}>
            {displayedCards.map((card) => (
              <article key={card.id} className={styles.card}>
                <div className={styles.cardImageWrap}>
                  <img
                    className={styles.cardImage}
                    src={card.image}
                    alt={card.title}
                  />

                  <div className={styles.tags}>
                    {card.tags.map((tag) => (
                      <span key={tag} className={styles.tag}>
                        {tag}
                      </span>
                    ))}
                  </div>

                  <span
                    className={`${styles.statusBadge} ${
                      card.amount === "progress"
                        ? styles.progressBadge
                        : styles.deadlineBadge
                    }`}
                  >
                    {card.status}
                  </span>
                </div>

                <div className={styles.cardBody}>
                  <p className={styles.org}>{card.org}</p>
                  <h2 className={styles.cardTitle}>{card.title}</h2>
                  <p className={styles.description}>{takeFirstSentences(card.description, 2)}</p>

                  <div className={styles.cardActions}>
                    <button
                      type="button"
                      className={styles.cardBtn}
                      onClick={() => {
                        const target = `/urgent/${card.id}`;
                        if (!isAuth) {
                          router.push(getLoginHref(target));
                          return;
                        }
                        router.push(target);
                      }}
                    >
                      {card.action}
                    </button>

                    <Link
                      href={`/urgent/${card.id}`}
                      className={styles.detailsLink}
                    >
                      Подробнее
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </section>
        </div>
      </div>
    </main>
  );
}
