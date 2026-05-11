"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";
import { volunteersApi, volunteerAvailabilityText, type VolunteerDetail } from "@/shared/api/endpoints/volunteers";
import type { KnowledgeItem } from "@/shared/api/endpoints/knowledge";
import { knowledgeApi } from "@/shared/api/endpoints/knowledge";
import { getImageUrl } from "@/shared/api/client";
import { useUser } from "@/shared/lib/hooks/useUser";
import {
  hasVolunteerLogisticsSection,
  parseVolunteerAvailability,
  travelRadiusFootnoteKm,
} from "@/shared/lib/volunteerAvailability";
import { VOLUNTEER_ANIMAL_KIND_OPTIONS, type VolunteerAnimalKindTag } from "@/shared/lib/volunteerProfileStorage";

const COMPETENCY_HIGHLIGHT_HINTS = /^(регулярн|разов)/i;

const VOLUNTEER_AVAILABILITY_UI_MARK = "\n---VOL-UI---\n";

function catalogAvailabilityHeadText(raw: string | null | undefined): string {
  const t = (raw ?? "").trim();
  if (!t) return "";
  if (t.includes(VOLUNTEER_AVAILABILITY_UI_MARK)) {
    return (t.split(VOLUNTEER_AVAILABILITY_UI_MARK)[0] ?? "").trim();
  }
  return t;
}

type CompetencyChip = { key: string; label: string; variant: "frequency" | "petKind" | "skill" | "animal" };

function resolvePetKindLabel(text: string): VolunteerAnimalKindTag | null {
  const t = text.trim();
  return VOLUNTEER_ANIMAL_KIND_OPTIONS.find((opt) => opt.toLowerCase() === t.toLowerCase()) ?? null;
}

function buildCompetencyChips(volunteer: VolunteerDetail | null): CompetencyChip[] {
  if (!volunteer) return [];
  const chips: CompetencyChip[] = [];
  const seen = new Set<string>();

  const mark = (label: string) => {
    seen.add(label.trim().toLowerCase());
  };
  const has = (label: string) => seen.has(label.trim().toLowerCase());

  if (volunteer.help_format_label?.trim()) {
    const lab = volunteer.help_format_label.trim();
    chips.push({ key: "hf", label: lab, variant: "frequency" });
    mark(lab);
  }

  const pushPetKind = (canonical: VolunteerAnimalKindTag, keySource: string) => {
    if (has(canonical)) return;
    mark(canonical);
    chips.push({ key: `pet-${keySource}-${canonical}`, label: canonical, variant: "petKind" });
  };

  for (const raw of volunteer.animal_category_labels ?? []) {
    const pet = resolvePetKindLabel(raw ?? "");
    if (pet) pushPetKind(pet, "api");
  }

  for (const label of volunteer.competency_tags ?? []) {
    const t = label?.trim();
    if (!t) continue;
    if (has(t)) continue;
    mark(t);
    chips.push({ key: `api-${t}`, label: t, variant: "skill" });
  }

  for (const animal of volunteer.animal_category_labels ?? []) {
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
  const badge = v.hero_experience_badges?.find((s) => s?.trim());
  if (badge) return badge.trim();
  const readiness = v.readiness_label?.trim();
  if (readiness) return readiness;
  const legacy = (v as { experience_level_label?: string }).experience_level_label?.trim();
  if (legacy) return legacy;

  const n = v.completed_tasks_count ?? 0;
  if (n <= 5) return "Новичок";
  if (n <= 20) return "Опытный";
  return "Опытный";
}

type KnowledgeArticle = KnowledgeItem & { author_user_id?: number };

export default function VolunteerPage() {
  const params = useParams();
  const id = Number(params.id);
  const { role } = useUser();

  const [volunteer, setVolunteer] = useState<VolunteerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [articles, setArticles] = useState<KnowledgeItem[]>([]);
  const [offerOpen, setOfferOpen] = useState(false);
  const [listAvailabilityLine, setListAvailabilityLine] = useState<string | null>(null);

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
    if (!volunteer?.user_id) {
      setListAvailabilityLine(null);
      return;
    }
    let cancelled = false;
    volunteersApi
      .getList()
      .then((res) => {
        if (cancelled) return;
        const item = (res.items ?? []).find((v) => v.user_id === volunteer.user_id);
        const raw = item?.availability?.trim() ?? "";
        setListAvailabilityLine(raw ? catalogAvailabilityHeadText(raw) : null);
      })
      .catch(() => {
        if (!cancelled) setListAvailabilityLine(null);
      });
    return () => {
      cancelled = true;
    };
  }, [volunteer?.user_id]);

  useEffect(() => {
    if (!volunteer?.user_id) return;

    const fromProfile = (volunteer.articles ?? []).map(
      (a): KnowledgeArticle => ({
        id: a.id,
        title: a.title,
        summary: a.summary ?? "",
        category: a.category,
        category_label: a.category_label,
        read_minutes: a.read_minutes,
        is_context_tip: false,
        created_at: new Date().toISOString(),
      })
    );

    knowledgeApi
      .getList()
      .then((response) => {
        const raw: KnowledgeArticle[] = (response.items ?? []) as KnowledgeArticle[];
        const authored = raw.filter(
          (item) => typeof item.author_user_id === "number" && item.author_user_id === volunteer.user_id
        );
        const seen = new Set<number>();
        const merged: KnowledgeArticle[] = [];
        for (const item of [...fromProfile, ...authored]) {
          if (seen.has(item.id)) continue;
          seen.add(item.id);
          merged.push(item);
        }
        setArticles(merged.slice(0, 8));
      })
      .catch(() => setArticles(fromProfile.slice(0, 8)));
  }, [volunteer]);

  const mergedAvailabilityRaw = useMemo(() => {
    if (!volunteer) return "";
    const fromWeekly = volunteerAvailabilityText(volunteer).trim();
    if (fromWeekly) return fromWeekly;
    return (listAvailabilityLine ?? "").trim();
  }, [volunteer, listAvailabilityLine]);

  const availabilityParsed = useMemo(() => parseVolunteerAvailability(mergedAvailabilityRaw || undefined), [mergedAvailabilityRaw]);

  const availabilityDisplayRows = availabilityParsed.rows;

  const travelFootnote = useMemo(() => travelRadiusFootnoteKm(volunteer?.travel_radius_km), [volunteer?.travel_radius_km]);

  const competencyChips = useMemo(() => buildCompetencyChips(volunteer), [volunteer]);

  const mergedAbout = useMemo(() => (volunteer?.about_me ?? "").trim(), [volunteer]);

  const mergedCity = useMemo(
    () =>
      (volunteer?.location_display?.trim() ||
        volunteer?.location_city?.trim() ||
        volunteer?.location_district?.trim() ||
        "").trim(),
    [volunteer],
  );

  const showAbout = mergedAbout.length > 0;

  const showCompetencies = competencyChips.length > 0;

  const showLogistics = useMemo(() => {
    if (!volunteer) return false;
    const fromSchedule = hasVolunteerLogisticsSection(mergedAvailabilityRaw, volunteer.travel_radius_km);
    const fromApiNight = Boolean(volunteer.logistics?.accepts_night_urgency);
    return Boolean(fromSchedule || fromApiNight);
  }, [volunteer, mergedAvailabilityRaw]);

  const hasNightOutgoing =
    Boolean(volunteer?.logistics?.accepts_night_urgency) ||
    Boolean(
      volunteer &&
        mergedAvailabilityRaw.trim() &&
        (/ночн(ых|ые|ой)\s+выезд/i.test(mergedAvailabilityRaw) ||
          /ночные\s+выезды/i.test(mergedAvailabilityRaw)),
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
  const isAvailable = volunteer.readiness_status === "available";
  const experienceLabel = experienceBadgeFromVolunteer(volunteer);

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <nav className={styles.breadcrumbs} aria-label="Хлебные крошки">
          <Link href="/catalog/volunteers">Волонтёры</Link>
          <span>/</span>
          <span>{volunteer.full_name ?? ""}</span>
        </nav>

        <header className={styles.profileHeader}>
          <div className={styles.headerMain}>
            <div className={styles.avatarWrap}>
              <div className={styles.avatar}>
                {avatarSrc ? (
                  <img src={avatarSrc || "/placeholder.jpg"} alt={volunteer.full_name ?? ""} />
                ) : (
                  <span className={styles.avatarInitials} aria-hidden="true">
                    {initialsFromFullName(volunteer.full_name ?? "")}
                  </span>
                )}
              </div>
              <span
                className={`${styles.statusDot} ${isAvailable ? styles.statusDotAvailable : styles.statusDotBusy}`}
                aria-label={isAvailable ? "На связи" : "Занят"}
              />
            </div>

            <div className={styles.profileInfo}>
              <h1 className={styles.title}>{volunteer.full_name ?? "Волонтёр"}</h1>
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
                        recipientName: volunteer.full_name ?? "",
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

              {availabilityDisplayRows.length === 0 && availabilityParsed.tagChips.length > 0 && (
                <p className={styles.availabilityFreeform} aria-label="Доступность, текстом">
                  {availabilityParsed.tagChips.join(" · ")}
                </p>
              )}

              {hasNightOutgoing && (
                <p className={styles.availabilityNight}>Готов к срочным ночным выездам</p>
              )}

              {travelFootnote ? (
                <p className={styles.availabilityFooter}>
                  <img src="/car.svg" alt="" aria-hidden className={styles.availabilityCarIcon} />
                  <span>{travelFootnote}</span>
                </p>
              ) : null}
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
              Выбор активных заявок организации и приглашение волонтёра будет подключено к разделу заявок
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
