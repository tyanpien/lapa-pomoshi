"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import styles from "./page.module.css";
import { getLoginHref } from "@/shared/lib/auth/loginHref";
import { useUser } from "@/shared/lib/hooks/useUser";
import {
  helpApi,
  type HelpAnimalApiTab,
  type HelpAnimalItem,
} from "@/shared/api/endpoints/help";
import { HelpRequisitesModal } from "@/features/help-requisites/HelpRequisitesModal";

type HelpFilter = "all" | "adopt" | "food" | "treatment" | "other";
type NeedType = "adopt" | "food" | "treatment" | "other";

interface HelpCard {
  id: number;
  name: string;
  image: string;
  isUrgent: boolean;
  species: string;
  age: string;
  statusTag: string;
  organization: string;
  needText: string;
  needIcon: string;
  needType: NeedType;
  amount: string | null;
  primaryHelpRequestId: number | null;
}

type HelpCardRendered = HelpCard & { actionLabel: string };

const FILTER_LABELS: Record<HelpFilter, string> = {
  all: "Все",
  adopt: "Приютить",
  food: "Накормить",
  treatment: "Вылечить",
  other: "Другое",
};

const filterToApiTab = (filter: HelpFilter): HelpAnimalApiTab => {
  const map: Record<HelpFilter, HelpAnimalApiTab> = {
    all: "all",
    adopt: "adopt",
    food: "feed",
    treatment: "heal",
    other: "other",
  };
  return map[filter];
};

const needTypeFromBucket = (bucket: string): NeedType => {
  const n = bucket.trim().toLowerCase();
  if (n === "adopt" || n.includes("пристро")) return "adopt";
  if (n === "feed" || n === "food" || n.includes("корм") || n.includes("накорм")) return "food";
  if (n === "heal" || n === "treatment" || n.includes("леч")) return "treatment";
  return "other";
};

const needIconForType = (needType: NeedType) =>
  needType === "adopt"
    ? "/home_.svg"
    : needType === "food"
      ? "/food.svg"
      : needType === "treatment"
        ? "/operation.svg"
        : "/povodok.svg";

const formatRub = (amount: number) =>
  amount > 0 ? `${new Intl.NumberFormat("ru-RU").format(amount)} ₽` : null;

const inferNeedType = (item: HelpAnimalItem): NeedType => {
  if (item.monetary?.length) {
    return needTypeFromBucket(item.monetary[0].help_bucket);
  }
  if (item.adopt_ready) return "adopt";
  return "other";
};

const uniqueLinesPreservingOrder = (lines: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || seen.has(line)) continue;
    seen.add(line);
    out.push(line);
  }
  return out;
};

const mapItemToCard = (item: HelpAnimalItem): HelpCard => {
  const needType = inferNeedType(item);
  const lines = uniqueLinesPreservingOrder((item.monetary ?? []).map((m) => m.line).filter(Boolean));
  const needText =
    lines.length > 0
      ? lines.join(" · ")
      : item.adopt_ready
        ? "Ищет дом и любящую семью"
        : "Нужна помощь";

  const totalRub = (item.monetary ?? []).reduce((s, m) => s + (Number(m.amount_rub) || 0), 0);
  const amountStr = needType === "adopt" && !totalRub ? null : formatRub(totalRub);
  const primaryHelpRequestId =
    item.monetary?.length && typeof item.monetary[0].request_id === "number"
      ? item.monetary[0].request_id
      : null;

  return {
    id: item.animal_id,
    name: item.name,
    image: helpApi.getImageUrl(item.primary_photo_url),
    isUrgent: item.is_urgent,
    species: item.species_tag?.trim() ? item.species_tag.trim().toLowerCase() : "животное",
    age: item.age_tag?.trim() || "Возраст не указан",
    statusTag: item.status_chip?.trim() || "—",
    organization: item.organization_name?.trim() || "Организация",
    needText,
    needIcon: needIconForType(needType),
    needType,
    amount: amountStr,
    primaryHelpRequestId,
  };
};

export default function HelpPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuth } = useUser();

  const [activeFilter, setActiveFilter] = useState<HelpFilter>("all");
  const [apiCards, setApiCards] = useState<HelpCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [helpSearch, setHelpSearch] = useState("");
  const [helpModalCard, setHelpModalCard] = useState<HelpCardRendered | null>(null);

  const handleAdoptNavigate = (animalId: number) => {
    if (!isAuth) {
      router.push(getLoginHref(pathname || "/help"));
      return;
    }
    router.push(`/catalog/animals/${animalId}`);
  };

  const load = useCallback(async (filter: HelpFilter) => {
    setLoading(true);
    setError(null);
    try {
      const tab = filterToApiTab(filter);
      const res = await helpApi.getAnimalHelp(tab);
      setApiCards((res.items ?? []).map(mapItemToCard));
    } catch (e) {
      setApiCards([]);
      setError(e instanceof Error ? e.message : "Не удалось загрузить список");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(activeFilter);
  }, [activeFilter, load]);

  const filteredCards = useMemo(() => {
    const q = helpSearch.trim().toLowerCase();
    if (!q) return apiCards;
    return apiCards.filter((c) => {
      const blob = [c.name, c.organization, c.species, c.age, c.statusTag, c.needText]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [apiCards, helpSearch]);

  const FALLBACK_AMOUNT_FOOD = "5 000 ₽";
  const FALLBACK_AMOUNT_TREATMENT = "15 000 ₽";
  const FALLBACK_AMOUNT_OTHER = "3 000 ₽";

  const renderData = useMemo(() => {
    const mappedCards = filteredCards.map((card) => {
      if (activeFilter === "adopt") {
        return {
          ...card,
          actionLabel: "Забрать домой",
          amount: null as string | null,
        };
      }

      if (activeFilter === "food") {
        const sum =
          card.needType === "food" ? (card.amount ?? FALLBACK_AMOUNT_FOOD) : FALLBACK_AMOUNT_FOOD;
        return {
          ...card,
          actionLabel: "Помочь",
          amount: sum,
        };
      }

      if (activeFilter === "treatment") {
        const sum =
          card.needType === "treatment"
            ? (card.amount ?? FALLBACK_AMOUNT_TREATMENT)
            : FALLBACK_AMOUNT_TREATMENT;
        return {
          ...card,
          actionLabel: "Помочь",
          amount: sum,
        };
      }

      if (activeFilter === "other") {
        const sum =
          card.needType === "other"
            ? (card.amount ?? FALLBACK_AMOUNT_OTHER)
            : FALLBACK_AMOUNT_OTHER;
        return {
          ...card,
          actionLabel: "Помочь",
          amount: sum,
        };
      }

      const hasCollection = Boolean(card.amount?.trim());

      return {
        ...card,
        actionLabel: hasCollection ? "Помочь" : "Забрать домой",
        amount: hasCollection ? card.amount : null,
      };
    });

    if (activeFilter === "all") {
      return mappedCards.sort((a, b) => {
        const byUrgent = Number(b.isUrgent) - Number(a.isUrgent);
        if (byUrgent !== 0) return byUrgent;
        const aHasFund = a.amount ? 1 : 0;
        const bHasFund = b.amount ? 1 : 0;
        return bHasFund - aHasFund;
      });
    }

    return mappedCards.sort((a, b) => Number(b.isUrgent) - Number(a.isUrgent));
  }, [activeFilter, filteredCards]);

  return (
    <main className={styles.page}>
      <section className={styles.container}>
        <div className={styles.headerRow}>
          <h1 className={styles.title}>Помочь</h1>
          <div className={styles.searchRow}>
            <input
              type="search"
              className={styles.searchInput}
              placeholder="Найти"
              value={helpSearch}
              onChange={(e) => setHelpSearch(e.target.value)}
              aria-label="Поиск по животным"
            />
          </div>
          <div className={styles.filters}>
            {(["adopt", "food", "treatment", "other", "all"] as HelpFilter[]).map((filter) => (
              <button
                key={filter}
                type="button"
                className={`${styles.filterButton} ${activeFilter === filter ? styles.activeFilter : ""}`}
                onClick={() => setActiveFilter(filter)}
              >
                {FILTER_LABELS[filter]}
              </button>
            ))}
          </div>
        </div>

        {loading && <p className={styles.statusMessage}>Загрузка…</p>}
        {error && !loading && <p className={styles.statusMessage}>{error}</p>}

        {!loading && !error && renderData.length === 0 ? (
          <p className={styles.statusMessage}>Ничего не найдено. Измените запрос или фильтр.</p>
        ) : null}

        <div className={styles.grid}>
          {!loading &&
            renderData.map((card) => (
              <article key={card.id} className={styles.card}>
                <div className={styles.imageWrapper}>
                  <img src={card.image} alt={card.name} className={styles.image} />
                  {card.isUrgent && <span className={styles.urgentBadge}>срочно</span>}
                </div>

                <div className={styles.cardBody}>
                  <h2 className={styles.cardName}>{card.name}</h2>

                  <div className={styles.metaTags}>
                    <span className={styles.metaTag}>{card.species}</span>
                    <span className={styles.metaTag}>{card.age}</span>
                    <span className={`${styles.metaTag} ${styles.statusTag}`}>{card.statusTag}</span>
                  </div>

                  <p className={styles.lineWithIcon}>
                    <img src="/org.svg" alt="" aria-hidden="true" />
                    <span>{card.organization}</span>
                  </p>

                  <p className={styles.need}>
                    <img src={card.needIcon} alt="" aria-hidden="true" />
                    <span>{card.needText}</span>
                  </p>

                  {card.amount ? (
                    <p className={styles.amount}>{card.amount}</p>
                  ) : (
                    <div className={styles.amountPlaceholder} aria-hidden="true" />
                  )}

                  <button
                    type="button"
                    className={styles.actionButton}
                    onClick={() => {
                      if (card.actionLabel === "Помочь") {
                        if (!isAuth) {
                          router.push(getLoginHref(pathname || "/help"));
                          return;
                        }
                        setHelpModalCard(card);
                        return;
                      }
                      handleAdoptNavigate(card.id);
                    }}
                  >
                    {card.actionLabel}
                  </button>
                </div>
              </article>
            ))}
        </div>
      </section>

      {helpModalCard ? (
        <HelpRequisitesModal
          animalId={helpModalCard.id}
          animalName={helpModalCard.name}
          organizationName={helpModalCard.organization}
          needText={helpModalCard.needText}
          primaryHelpRequestId={helpModalCard.primaryHelpRequestId}
          onClose={() => setHelpModalCard(null)}
        />
      ) : null}
    </main>
  );
}
