"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";
import {
  getAllOrganizationRequests,
  getOrganizationCabinetEventName,
  type OrganizationRequest,
} from "@/shared/lib/organizationCabinet";
import {
  getOrganizationAnimalById,
  getOrganizationAnimalsEventName,
} from "@/shared/lib/organizationAnimals";

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
}

const cards: HelpCard[] = [
  {
    id: 1,
    name: "Муся",
    image: "/cat.png",
    isUrgent: true,
    species: "кошка",
    age: "2 года",
    statusTag: "На лечении",
    organization: "Название организации",
    needText: "На операцию на лапу",
    needIcon: "/operation.svg",
    needType: "treatment",
    amount: "15 000 ₽",
  },
  {
    id: 2,
    name: "Муся",
    image: "/cat.png",
    isUrgent: true,
    species: "кошка",
    age: "2 года",
    statusTag: "Готова к пристрою",
    organization: "Название организации",
    needText: "На корм Gastrointestinal",
    needIcon: "/food.svg",
    needType: "food",
    amount: "5 000 ₽",
  },
  {
    id: 3,
    name: "Муся",
    image: "/cat.png",
    isUrgent: false,
    species: "кошка",
    age: "2 года",
    statusTag: "Готова к пристрою",
    organization: "Название организации",
    needText: "Ищет дом и любящую семью",
    needIcon: "/home_.svg",
    needType: "adopt",
    amount: null,
  },
  {
    id: 4,
    name: "Муся",
    image: "/cat.png",
    isUrgent: false,
    species: "кошка",
    age: "2 года",
    statusTag: "На лечении",
    organization: "Название организации",
    needText: "Новые поводки и ошейники",
    needIcon: "/povodok.svg",
    needType: "other",
    amount: "3 000 ₽",
  },
];

const FILTER_LABELS: Record<HelpFilter, string> = {
  all: "Все",
  adopt: "Приютить",
  food: "Накормить",
  treatment: "Вылечить",
  other: "Другое",
};

const matchesAdoptStatusTag = (statusTag: string) => {
  const t = statusTag.trim().toLowerCase();
  return t === "готов к пристрою" || t === "готова к пристрою";
};

const visibleInAdoptFilter = (card: HelpCard) =>
  card.needType === "adopt" || matchesAdoptStatusTag(card.statusTag);

const getNeedTypeByHelp = (helpType: string): NeedType => {
  const normalized = helpType.trim().toLowerCase();
  if (normalized === "приютить") return "adopt";
  if (normalized === "накормить") return "food";
  if (normalized === "вылечить") return "treatment";
  return "other";
};

const formatAge = (months?: number) => {
  if (!months || months <= 0) return "Возраст не указан";
  if (months < 12) {
    return `${months} ${months === 1 ? "месяц" : months < 5 ? "месяца" : "месяцев"}`;
  }
  const years = Math.floor(months / 12);
  const remainder = months % 12;
  if (!remainder) return `${years} ${years === 1 ? "год" : years < 5 ? "года" : "лет"}`;
  return `${years} ${years === 1 ? "год" : years < 5 ? "года" : "лет"} ${remainder} ${
    remainder === 1 ? "месяц" : remainder < 5 ? "месяца" : "месяцев"
  }`;
};

const statusTagFromAnimalStatus = (status?: string) => {
  if (status === "on_treatment") return "На лечении";
  if (status === "in_shelter") return "В приюте";
  if (status === "looking_for_home") return "Готов к пристрою";
  return "Готов к пристрою";
};

const mapRequestToCard = (request: OrganizationRequest): HelpCard => {
  const linkedAnimal = request.linkedAnimalId ? getOrganizationAnimalById(request.linkedAnimalId) : null;
  const needType = getNeedTypeByHelp(request.helpType);
  const fallbackImage = linkedAnimal?.primary_photo_url || "/cat.png";

  return {
    id: request.id,
    name: linkedAnimal?.name || request.title || "Подопечный",
    image: request.mediaUrl?.trim() || fallbackImage,
    isUrgent: request.urgency === "urgent",
    species: (linkedAnimal?.species || "животное").toLowerCase(),
    age: formatAge(linkedAnimal?.age_months),
    statusTag: statusTagFromAnimalStatus(linkedAnimal?.status),
    organization: linkedAnimal?.organization_name || "Название организации",
    needText: request.problemDescription,
    needIcon:
      needType === "adopt" ? "/home_.svg" : needType === "food" ? "/food.svg" : needType === "treatment" ? "/operation.svg" : "/povodok.svg",
    needType,
    amount: needType === "adopt" ? null : "5 000 ₽",
  };
};

export default function HelpPage() {
  const [activeFilter, setActiveFilter] = useState<HelpFilter>("all");
  const [organizationCards, setOrganizationCards] = useState<HelpCard[]>([]);

  useEffect(() => {
    const sync = () => {
      const requests = getAllOrganizationRequests().filter((item) => item.status !== "closed");
      setOrganizationCards(requests.map(mapRequestToCard));
    };

    sync();
    const cabinetEvent = getOrganizationCabinetEventName();
    const animalsEvent = getOrganizationAnimalsEventName();
    window.addEventListener(cabinetEvent, sync);
    window.addEventListener(animalsEvent, sync);
    return () => {
      window.removeEventListener(cabinetEvent, sync);
      window.removeEventListener(animalsEvent, sync);
    };
  }, []);

  const FALLBACK_AMOUNT_FOOD = "5 000 ₽";
  const FALLBACK_AMOUNT_TREATMENT = "15 000 ₽";
  const FALLBACK_AMOUNT_OTHER = "3 000 ₽";

  const renderData = useMemo(() => {
    const sourceCards = [...organizationCards, ...cards];
    const filteredCards = sourceCards.filter((card) => {
      if (activeFilter === "all") return true;
      if (activeFilter === "adopt") return visibleInAdoptFilter(card);
      return card.needType === activeFilter;
    });
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
          card.needType === "food" ? card.amount ?? FALLBACK_AMOUNT_FOOD : FALLBACK_AMOUNT_FOOD;
        return {
          ...card,
          actionLabel: "Помочь",
          amount: sum,
        };
      }

      if (activeFilter === "treatment") {
        const sum =
          card.needType === "treatment"
            ? card.amount ?? FALLBACK_AMOUNT_TREATMENT
            : FALLBACK_AMOUNT_TREATMENT;
        return {
          ...card,
          actionLabel: "Помочь",
          amount: sum,
        };
      }

      if (activeFilter === "other") {
        const sum =
          card.needType === "other" ? card.amount ?? FALLBACK_AMOUNT_OTHER : FALLBACK_AMOUNT_OTHER;
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
  }, [activeFilter, organizationCards]);

  return (
    <main className={styles.page}>
      <section className={styles.container}>
        <div className={styles.headerRow}>
          <h1 className={styles.title}>Помочь</h1>
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

        <div className={styles.grid}>
          {renderData.map((card) => (
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

                <button type="button" className={styles.actionButton}>
                  {card.actionLabel}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
