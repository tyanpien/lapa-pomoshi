"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";
import { volunteersApi, VolunteerDetail } from "@/shared/api/endpoints/volunteers";
import type { KnowledgeItem } from "@/shared/api/endpoints/knowledge";
import { knowledgeApi } from "@/shared/api/endpoints/knowledge";
import { getImageUrl } from "@/shared/api/client";
import { useUser } from "@/shared/lib/hooks/useUser";
import {
  hasVolunteerLogisticsSection,
  parseVolunteerAvailability,
  travelRadiusFootnoteKm,
} from "@/shared/lib/volunteerAvailability";
import {
  availabilityGridToLegacyMultiline,
  buildAvailabilityCardRows,
  hasAvailabilityGridSelection,
} from "@/shared/lib/volunteerAvailabilityGrid";
import {
  VOLUNTEER_ANIMAL_KIND_OPTIONS,
  VOLUNTEER_PROFILE_UPDATED_EVENT,
  readLinkedVolunteerCatalogUserId,
  readVolunteerDetailsFromStorage,
  resolveVolunteerCatalogIsAvailable,
  type StoredVolunteerDetails,
  type VolunteerAnimalKindTag,
} from "@/shared/lib/volunteerProfileStorage";

const COMPETENCY_HIGHLIGHT_HINTS = /^(регулярн|разов)/i;

type CompetencyChip = { key: string; label: string; variant: "frequency" | "petKind" | "skill" | "animal" };

function resolvePetKindLabel(text: string): VolunteerAnimalKindTag | null {
  const t = text.trim();
  return VOLUNTEER_ANIMAL_KIND_OPTIONS.find((opt) => opt.toLowerCase() === t.toLowerCase()) ?? null;
}

function buildCompetencyChips(volunteer: VolunteerDetail | null, overlay: StoredVolunteerDetails | null): CompetencyChip[] {
  if (!volunteer) return [];
  const chips: CompetencyChip[] = [];
  const seen = new Set<string>();

  const mark = (label: string) => {
    seen.add(label.trim().toLowerCase());
  };
  const has = (label: string) => seen.has(label.trim().toLowerCase());

  if (overlay?.helpFrequency?.trim()) {
    const lab = overlay.helpFrequency.trim();
    chips.push({ key: "hf", label: lab, variant: "frequency" });
    mark(lab);
  }

  const pushPetKind = (canonical: VolunteerAnimalKindTag, keySource: string) => {
    if (has(canonical)) return;
    mark(canonical);
    chips.push({ key: `pet-${keySource}-${canonical}`, label: canonical, variant: "petKind" });
  };

  for (const kind of VOLUNTEER_ANIMAL_KIND_OPTIONS) {
    if (overlay?.animalKinds.includes(kind)) {
      pushPetKind(kind, "lc");
    }
  }

  for (const raw of volunteer.animal_type_labels ?? []) {
    const pet = resolvePetKindLabel(raw ?? "");
    if (pet) pushPetKind(pet, "api");
  }

  for (const label of volunteer.competency_labels ?? []) {
    const t = label?.trim();
    if (!t) continue;
    if (has(t)) continue;
    mark(t);
    chips.push({ key: `api-${t}`, label: t, variant: "skill" });
  }

  if (overlay) {
    const localPieces: string[] = [];
    for (const c of overlay.competencies) {
      if (c === "Другое" && overlay.competenciesOther.trim()) {
        localPieces.push(`Другое: ${overlay.competenciesOther.trim()}`);
      } else if (c !== "Другое") {
        localPieces.push(c);
      }
    }
    for (const piece of localPieces) {
      if (has(piece)) continue;
      mark(piece);
      chips.push({ key: `loc-${piece}`, label: piece, variant: "skill" });
    }
  }

  for (const animal of volunteer.animal_type_labels ?? []) {
    const a = animal?.trim();
    if (!a) continue;
    if (resolvePetKindLabel(a)) continue;
    if (has(a)) continue;
    mark(a);
    chips.push({ key: `an-${a}`, label: a, variant: "animal" });
  }

  return chips;
}

function initialsFromFullName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) return "В";
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "В";
}

function experienceBadgeFromVolunteer(v: VolunteerDetail): string {
  const label = v.experience_level_label?.trim();
  if (label) return label;

  const n = v.completed_tasks_count ?? 0;
  if (n <= 5) return "Новичок";
  if (n <= 20) return "Опытный";
  return "Опытный";
}

type KnowledgeArticle = KnowledgeItem & { author_user_id?: number };

export default function VolunteerPage() {
  const params = useParams();
  const id = Number(params.id);
  const { role, userName } = useUser();

  const [volunteer, setVolunteer] = useState<VolunteerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [articles, setArticles] = useState<KnowledgeItem[]>([]);
  const [offerOpen, setOfferOpen] = useState(false);
  const [localOverlay, setLocalOverlay] = useState<StoredVolunteerDetails | null>(null);

  useEffect(() => {
    volunteersApi
      .getById(id)
      .then((data) => {
        setVolunteer(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    if (!volunteer?.user_id) return;

    knowledgeApi
      .getList()
      .then((response) => {
        const raw: KnowledgeArticle[] = (response.items ?? []) as KnowledgeArticle[];
        const authored = raw.filter((item) => typeof item.author_user_id === "number" && item.author_user_id === volunteer.user_id);
        setArticles(authored.slice(0, 4));
      })
      .catch(() => setArticles([]));
  }, [volunteer?.user_id]);

  useEffect(() => {
    const refreshOverlay = () => {
      const linkedId = readLinkedVolunteerCatalogUserId();
      if (linkedId == null || linkedId !== id) {
        setLocalOverlay(null);
        return;
      }
      setLocalOverlay(readVolunteerDetailsFromStorage(userName));
    };

    refreshOverlay();

    window.addEventListener(VOLUNTEER_PROFILE_UPDATED_EVENT, refreshOverlay);
    window.addEventListener("storage", refreshOverlay);
    return () => {
      window.removeEventListener(VOLUNTEER_PROFILE_UPDATED_EVENT, refreshOverlay);
      window.removeEventListener("storage", refreshOverlay);
    };
  }, [id, userName]);

  const mergedAvailabilityRaw = useMemo(() => {
    if (!volunteer) return "";
    const parts: string[] = [];
    const apiAvail = volunteer.availability?.trim();
    if (apiAvail) parts.push(apiAvail);

    if (
      localOverlay &&
      hasAvailabilityGridSelection({
        availabilityGrid: localOverlay.availabilityGrid,
        availabilityAroundClock: localOverlay.availabilityAroundClock,
      })
    ) {
      const gridText = availabilityGridToLegacyMultiline({
        availabilityGrid: localOverlay.availabilityGrid,
        availabilityAroundClock: localOverlay.availabilityAroundClock,
      });
      if (gridText.trim()) parts.push(gridText.trim());
    }

    if (localOverlay && (localOverlay.availabilityDays.length > 0 || localOverlay.availabilityTimes.length > 0)) {
      const d = localOverlay.availabilityDays.join(", ");
      const t = localOverlay.availabilityTimes.join(", ");
      const line = [d, t].filter(Boolean).join(" | ");
      if (line.trim()) parts.push(line.trim());
    }

    return parts.join("\n");
  }, [volunteer, localOverlay]);

  const availabilityParsed = useMemo(() => parseVolunteerAvailability(mergedAvailabilityRaw || undefined), [mergedAvailabilityRaw]);

  const localGridRows = useMemo(() => {
    if (!localOverlay) return null;
    const slice = {
      availabilityGrid: localOverlay.availabilityGrid,
      availabilityAroundClock: localOverlay.availabilityAroundClock,
    };
    if (!hasAvailabilityGridSelection(slice)) return null;
    return buildAvailabilityCardRows(slice);
  }, [localOverlay]);

  const availabilityDisplayRows = localGridRows ?? availabilityParsed.rows;

  const travelFootnote = useMemo(() => travelRadiusFootnoteKm(volunteer?.travel_radius_km), [volunteer?.travel_radius_km]);

  const competencyChips = useMemo(() => buildCompetencyChips(volunteer, localOverlay), [volunteer, localOverlay]);

  const mergedAbout = useMemo(() => {
    const fromLc = localOverlay?.aboutMe?.trim();
    const fromApi = volunteer?.about_me?.trim();
    return (fromLc || fromApi || "").trim();
  }, [volunteer, localOverlay]);

  const mergedCity = useMemo(() => {
    const fromApi = volunteer?.location_city?.trim();
    const fromLc = localOverlay?.location?.trim();
    return (fromApi || fromLc || "").trim();
  }, [volunteer, localOverlay]);

  const showAbout = mergedAbout.length > 0;

  const showCompetencies = competencyChips.length > 0;

  const showLogistics = useMemo(() => {
    if (!volunteer) return false;

    const hasLocalSchedule =
      localOverlay &&
      hasAvailabilityGridSelection({
        availabilityGrid: localOverlay.availabilityGrid,
        availabilityAroundClock: localOverlay.availabilityAroundClock,
      });

    const fromSchedule = hasVolunteerLogisticsSection(
      mergedAvailabilityRaw || (volunteer.availability ?? ""),
      volunteer.travel_radius_km
    );

    const fromNight = Boolean(localOverlay?.nightOutings);
    const fromRadiusNote = Boolean(localOverlay?.travelRadius?.trim());
    const fromTravelOutTown = Boolean(localOverlay?.travelOutOfTown);

    return Boolean(fromSchedule || fromNight || fromRadiusNote || hasLocalSchedule || fromTravelOutTown);
  }, [volunteer, mergedAvailabilityRaw, localOverlay]);

  const hasNightOutgoing =
    Boolean(localOverlay?.nightOutings) ||
    Boolean(
      volunteer?.availability?.trim() &&
        (/ночн(ых|ые|ой)\s+выезд/i.test(volunteer.availability ?? "") || /ночные\s+выезды/i.test(volunteer.availability ?? ""))
    );

  const isOrganization = role === "organization";

  const formatReviewDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.notFound}>
          <h1>Загрузка...</h1>
        </div>
      </div>
    );
  }

  if (!volunteer) {
    return (
      <div className={styles.container}>
        <div className={styles.notFound}>
          <h1>Волонтёр не найден</h1>
          <Link href="/catalog/volunteers">Вернуться к списку</Link>
        </div>
      </div>
    );
  }

  const avatarSrc = volunteer.avatar_url ? getImageUrl(volunteer.avatar_url) : null;
  const isAvailable = resolveVolunteerCatalogIsAvailable(Boolean(volunteer.is_available), localOverlay);
  const experienceLabel = experienceBadgeFromVolunteer(volunteer);

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <nav className={styles.breadcrumbs} aria-label="Хлебные крошки">
          <Link href="/catalog/volunteers">Волонтёры</Link>
          <span>/</span>
          <span>{volunteer.full_name}</span>
        </nav>

        <header className={styles.profileHeader}>
          <div className={styles.headerMain}>
            <div className={styles.avatarWrap}>
              <div className={styles.avatar}>
                {avatarSrc ? (
                  <img src={avatarSrc || "/placeholder.jpg"} alt={volunteer.full_name} />
                ) : (
                  <span className={styles.avatarInitials} aria-hidden="true">
                    {initialsFromFullName(volunteer.full_name)}
                  </span>
                )}
              </div>
              <span
                className={`${styles.statusDot} ${isAvailable ? styles.statusDotAvailable : styles.statusDotBusy}`}
                aria-label={isAvailable ? "На связи" : "Занят"}
              />
            </div>

            <div className={styles.profileInfo}>
              <h1 className={styles.title}>{volunteer.full_name}</h1>
              <p className={styles.location}>
                <img src="/city.svg" alt="" aria-hidden="true" className={styles.locationIcon} />
                {mergedCity || "Город не указан"}
              </p>
              <div className={styles.tagsRow}>
                <span className={styles.stateTag}>
                  {isAvailable ? "Готов к задачам" : "Временно не беру задачи"}
                </span>
                <span className={styles.experienceTag}>{experienceLabel}</span>
              </div>
              {isOrganization && (
                <div className={styles.actionsRow}>
                  <Link
                    href={{
                      pathname: "/messages",
                      query: {
                        recipientId: volunteer.user_id,
                        recipientName: volunteer.full_name,
                      },
                    }}
                    className={styles.writeBtn}
                  >
                    Написать
                  </Link>
                  <button type="button" className={styles.offerBtn} onClick={() => setOfferOpen(true)}>
                    Предложить задачу
                  </button>
                </div>
              )}
            </div>
          </div>

          <aside className={styles.tasksBlock} aria-label="Статистика выполненных задач">
            <p className={styles.tasksNumber}>{volunteer.completed_tasks_count}</p>
            <p className={styles.tasksLabel}>выполненных задач</p>
          </aside>
        </header>

        <div className={styles.contentGrid}>
          <div className={styles.mainColumn}>
            {showAbout && (
              <section className={styles.infoSection} aria-labelledby="about-title">
                <h2 id="about-title" className={styles.sectionTitle}>
                  О себе
                </h2>
                <p className={styles.aboutText}>{mergedAbout}</p>
              </section>
            )}

            {showCompetencies && (
              <section className={styles.infoSection} aria-labelledby="skills-title">
                <h2 id="skills-title" className={styles.sectionTitle}>
                  Компетенции
                </h2>
                <div className={styles.skillsList}>
                  {competencyChips.map((chip) => {
                    let className = styles.skillTag;
                    if (chip.variant === "petKind") {
                      className = styles.skillTagPetKind;
                    } else if (chip.variant === "animal") {
                      className = styles.skillTagAnimal;
                    } else if (
                      chip.variant === "frequency" ||
                      (chip.variant === "skill" && COMPETENCY_HIGHLIGHT_HINTS.test(chip.label))
                    ) {
                      className = styles.skillTagAccent;
                    }
                    return (
                      <span key={chip.key} className={className}>
                        {chip.label}
                      </span>
                    );
                  })}
                </div>
              </section>
            )}
          </div>

          {showLogistics && (
            <aside className={styles.availabilityCard} aria-labelledby="availability-title">
              <h2 id="availability-title" className={styles.availabilityTitle}>
                Доступность
              </h2>

              {availabilityDisplayRows.length > 0 && (
                <ul className={styles.availabilityTable} aria-label="Расписание">
                  {availabilityDisplayRows.map((row, idx) => (
                    <li key={`${row.left}-${idx}`} className={styles.availabilityRow}>
                      <span className={styles.availabilityDay}>{row.left}</span>
                      <span className={styles.availabilityTime}>{row.right}</span>
                    </li>
                  ))}
                </ul>
              )}


              {hasNightOutgoing && (
                <p className={styles.availabilityNight}>Готов к срочным ночным выездам</p>
              )}

              {travelFootnote &&
                !(localOverlay?.travelOutOfTown && travelFootnote === "Готов выезжать за город") && (
                <p className={styles.availabilityFooter}>
                  <img src="/car.svg" alt="" aria-hidden className={styles.availabilityCarIcon} />
                  <span>{travelFootnote}</span>
                </p>
              )}

              {localOverlay?.travelRadius?.trim() && (
                <p className={styles.availabilityFooter}>
                  <img src="/car.svg" alt="" aria-hidden className={styles.availabilityCarIcon} />
                  <span>{localOverlay.travelRadius.trim()}</span>
                </p>
              )}
            </aside>
          )}
        </div>

        {articles.length > 0 && (
          <section className={styles.articlesSection} aria-labelledby="articles-title">
            <h2 id="articles-title" className={styles.articlesTitle}>
              Статьи волонтёра
            </h2>
            <div className={styles.articleGrid}>
              {articles.map((article) => (
                <Link key={article.id} href={`/knowledge/${article.id}`} className={styles.articleCard}>
                  <div className={styles.articleImage}>
                    <img src="/knowledge.png" alt="" />
                  </div>
                  <div className={styles.articleBody}>
                    <h3 className={styles.articleHeading}>{article.title}</h3>
                    <p className={styles.articleSummary}>{article.summary}</p>
                    <div className={styles.articleMeta}>
                      <span>
                        <img src="/clock.svg" alt="" className={styles.articleMetaIcon} />
                        {article.read_minutes} мин
                      </span>
                      <span className={styles.articleCategory}>{article.category_label}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {volunteer.reviews && volunteer.reviews.length > 0 && (
          <section className={styles.reviewsSection} aria-labelledby="reviews-title">
            <h2 id="reviews-title" className={styles.reviewsTitle}>
              Отзывы
            </h2>
            {volunteer.reviews.map((review, idx) => (
              <article className={styles.reviewCard} key={`${review.author_name}-${idx}`}>
                <div className={styles.reviewHeader}>
                  <div className={styles.reviewAuthorBlock}>
                    <div className={styles.reviewAvatar}>
                      {review.author_avatar_url ? (
                        <img src={getImageUrl(review.author_avatar_url)} alt="" />
                      ) : null}
                    </div>
                    <div className={styles.reviewAuthorInfo}>
                      <span className={styles.reviewAuthor}>{review.author_name}</span>
                      <span className={styles.reviewDate}>{formatReviewDate(review.review_date)}</span>
                    </div>
                  </div>
                </div>
                <p className={styles.reviewText}>{review.text}</p>
              </article>
            ))}
          </section>
        )}
      </div>

      {offerOpen && (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="offer-modal-title"
          tabIndex={-1}
          onClick={() => setOfferOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOfferOpen(false);
          }}
        >
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h2 id="offer-modal-title" className={styles.modalTitle}>
              Предложить задачу
            </h2>
            <p className={styles.modalText}>
              Выбор активных заявок организации и приглашение волонтёра будет подключено к разделу заявок. Пока
              откройте список заявок в личном кабинете.
            </p>
            <div className={styles.modalActions}>
              <Link href="/organization/requests" className={styles.modalPrimary}>
                Перейти к заявкам
              </Link>
              <button type="button" className={styles.modalSecondary} onClick={() => setOfferOpen(false)}>
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
