"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import styles from "./OrganizationCatalogView.module.css";
import type { Animal } from "@/shared/api/endpoints/animals";
import {
  organizationsApi,
  type OrganizationListItem,
  type OrganizationPublicPage,
  type OrgPublicUrgentNeed,
  type OrgPublicEvent,
  type OrgPublicHomeStory,
  type OrgPublicArticle,
  type OrgPublicReport,
} from "@/shared/api/endpoints/organizations";
import { getImageUrl } from "@/shared/api/client";
import { getOrganizationAnimalsByName, getCurrentOrganizationAnimals, getOrganizationAnimalsEventName } from "@/shared/lib/organizationAnimals";
import {
  getOrganizationCabinetEventName,
  getOrganizationCabinetRecordByName,
  getOrganizationCabinetRecordForCurrentUser,
} from "@/shared/lib/organizationCabinet";
import {
  mapOrganizationPublicPageToProfileData,
  mergeOrganizationProfilePreferApi,
} from "@/shared/lib/organizationMeCabinet";
import { emptyOrganizationCabinetApiPayload } from "@/shared/lib/organizationPublicCabinet";
import { mergeApiAndLocalAnimals } from "@/shared/lib/organizationPublicWards";
import { splitOrganizationAboutMainTasksFromPlainText } from "@/shared/lib/organizationAboutText";
import type { OrganizationCabinetPayloadWithStatus } from "@/shared/lib/hooks/useOrganizationPublicCabinetPayload";
import { useUser } from "@/shared/lib/hooks/useUser";
import { getUrgentHelpTypeLabel } from "@/shared/lib/urgentHelpTypeLabels";
import { getArticleCategoryLabel } from "@/shared/lib/articleCategoryLabels";
import type {
  OrganizationRequest,
  OrganizationEvent,
  GreetingFromHome,
  OrganizationArticle,
  OrganizationReport,
} from "@/shared/lib/organizationCabinet";

function toHrefMaybe(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

const ABOUT_SWIPE_MIN_PX = 48;

function socialIconForMessenger(messenger: string) {
  const m = messenger.trim().toLowerCase();
  if (m === "vk" || m === "вк") return { src: "/vk.svg", alt: "VK" };
  if (m === "telegram" || m === "tg" || m === "телеграм" || m === "телег" || m === "t.me") {
    return { src: "/tg.svg", alt: "Telegram" };
  }
  if (m === "whatsapp" || m === "wa" || m === "ватсап") return { src: "/wp.svg", alt: "WhatsApp" };
  return null;
}

const tabs = [
  { key: "wards", label: "Подопечные" },
  { key: "about", label: "О нас" },
  { key: "help", label: "Чем помочь" },
  { key: "events", label: "Мероприятия" },
  { key: "home", label: "Привет из дома" },
  { key: "reports", label: "Отчеты" },
  { key: "articles", label: "Статьи" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

type WardRow = {
  id: number;
  name: string;
  primary_photo_url: string | null;
  species: string;
  breed: string;
  age_months: number;
  status: string;
  status_label: string | null;
  location_city: string | null;
  is_urgent: boolean;
};

function mapUrgentToRequest(u: OrgPublicUrgentNeed): OrganizationRequest {
  return {
    id: u.id,
    title: u.title,
    location: "",
    problemDescription: u.description,
    helpType: u.help_type,
    urgency: u.is_urgent ? "urgent" : "normal",
    linkedAnimalId: u.animal_id ?? undefined,
    needVolunteer: u.volunteer_needed,
    volunteerCompetencies: "",
    status: "published",
    createdAt: new Date().toISOString(),
  };
}

function mergeOrganizationHelpRequests(
  apiRows: OrgPublicUrgentNeed[],
  locals: OrganizationRequest[]
): OrganizationRequest[] {
  const fromApi = apiRows.map(mapUrgentToRequest);
  const byId = new Map<number, OrganizationRequest>();
  for (const r of fromApi) byId.set(r.id, r);
  for (const r of locals) {
    if (!byId.has(r.id)) byId.set(r.id, r);
  }
  const sorted = [...byId.values()].sort((a, b) => a.id - b.id);
  const seenAnimalIds = new Set<number>();
  const out: OrganizationRequest[] = [];
  for (const r of sorted) {
    if (typeof r.linkedAnimalId === "number" && Number.isFinite(r.linkedAnimalId)) {
      if (seenAnimalIds.has(r.linkedAnimalId)) continue;
      seenAnimalIds.add(r.linkedAnimalId);
    }
    out.push(r);
  }
  return out;
}

function mapOrgEvent(e: OrgPublicEvent): OrganizationEvent {
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    location: e.location_display || "",
    dateLabel: new Date(e.starts_at).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    archived: false,
    createdAt: e.starts_at,
  };
}

function mapHomeStory(s: OrgPublicHomeStory): GreetingFromHome {
  return {
    id: s.id,
    petName: s.animal_name,
    text: s.story,
    photoUrl: s.photo_url ? getImageUrl(s.photo_url) : undefined,
    linkedAnimalId: undefined,
    createdAt: s.adopted_at,
  };
}

function mapOrgArticle(a: OrgPublicArticle): OrganizationArticle {
  return {
    id: a.id,
    title: a.title,
    articleType: a.category,
    author: "",
    content: "",
    archived: false,
    createdAt: new Date().toISOString(),
  };
}

function mapOrgReport(r: OrgPublicReport): OrganizationReport {
  return {
    id: r.id,
    title: r.title,
    content: r.summary || "",
    isUrgent: false,
    archived: false,
    createdAt: r.published_at,
  };
}

export type OrganizationCatalogViewProps =
  | { variant: "public"; organizationId: number }
  | { variant: "cabinet"; cabinetPayload: OrganizationCabinetPayloadWithStatus; onEditPage: () => void };

const PUBLIC_VIEW_CABINET_STUB: OrganizationCabinetPayloadWithStatus = {
  ...emptyOrganizationCabinetApiPayload(),
  isFetching: false,
};

function cabinetPayloadOrEmpty(props: OrganizationCatalogViewProps): OrganizationCabinetPayloadWithStatus {
  if (props.variant === "cabinet") return props.cabinetPayload;
  return PUBLIC_VIEW_CABINET_STUB;
}

function toFiniteOrgId(id: unknown): number {
  if (typeof id === "number" && Number.isFinite(id)) return id;
  if (typeof id === "string" && /^\d+$/.test(id.trim())) {
    const n = Number(id.trim());
    return Number.isFinite(n) ? n : Number.NaN;
  }
  return Number.NaN;
}

export function OrganizationCatalogView(props: OrganizationCatalogViewProps) {
  const { role } = useUser();
  const cabinetPayload = cabinetPayloadOrEmpty(props);

  const cabinetOrgId = toFiniteOrgId(cabinetPayload.organizationId);

  const resolvedOrganizationId =
    props.variant === "public" ? props.organizationId : cabinetOrgId;

  const cabinetFetching = props.variant === "cabinet" && cabinetPayload.isFetching;
  const cabinetUnresolved =
    props.variant === "cabinet" && !cabinetPayload.isFetching && !Number.isFinite(cabinetOrgId);

  const [activeTab, setActiveTab] = useState<TabKey>("wards");
  const [aboutGallerySlideIndex, setAboutGallerySlideIndex] = useState(0);
  const aboutGallerySwipeStartX = useRef<number | null>(null);
  const [listItem, setListItem] = useState<OrganizationListItem | null>(null);
  const [publicPage, setPublicPage] = useState<OrganizationPublicPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [organizationNameFromRecord, setOrganizationNameFromRecord] = useState("");
  const [cabinetTick, setCabinetTick] = useState(0);
  const [localAnimals, setLocalAnimals] = useState<Animal[]>(() =>
    typeof window !== "undefined" ? getCurrentOrganizationAnimals() : []
  );

  useEffect(() => {
    const eventName = getOrganizationCabinetEventName();
    const bump = () => setCabinetTick((t) => t + 1);
    window.addEventListener(eventName, bump);
    return () => window.removeEventListener(eventName, bump);
  }, []);

  useEffect(() => {
    if (props.variant !== "cabinet") return;
    const animalsEventName = getOrganizationAnimalsEventName();
    const sync = () => setLocalAnimals(getCurrentOrganizationAnimals());
    sync();
    window.addEventListener(animalsEventName, sync);
    return () => window.removeEventListener(animalsEventName, sync);
  }, [props.variant]);

  useEffect(() => {
    if (cabinetFetching) {
      setLoading(true);
      return;
    }
    if (cabinetUnresolved) {
      setListItem(null);
      setPublicPage(null);
      setLoading(false);
      setNotFound(true);
      return;
    }

    if (!Number.isFinite(resolvedOrganizationId)) {
      setListItem(null);
      setPublicPage(null);
      setLoading(false);
      setNotFound(true);
      return;
    }

    let mounted = true;

    const loadOrganization = async () => {
      if (
        props.variant === "cabinet" &&
        cabinetPayload.publicPage &&
        cabinetOrgId === resolvedOrganizationId
      ) {
        if (mounted) {
          setListItem(cabinetPayload.listItem);
          setPublicPage(cabinetPayload.publicPage);
          const displayName =
            cabinetPayload.listItem?.name ?? cabinetPayload.publicPage.hero.name ?? "";
          setOrganizationNameFromRecord(displayName);
          setNotFound(!cabinetPayload.listItem && !cabinetPayload.publicPage);
          setLoading(false);
        }
        return;
      }

      try {
        const listData = await organizationsApi.getList();
        const fromList = (listData?.items ?? []).find((item) => item.id === resolvedOrganizationId) ?? null;

        let page: OrganizationPublicPage | null = null;
        try {
          page = await organizationsApi.getById(resolvedOrganizationId);
        } catch {
          page = null;
        }

        if (mounted) {
          setListItem(fromList);
          setPublicPage(page);
          const displayName = fromList?.name ?? page?.hero.name ?? "";
          setOrganizationNameFromRecord(displayName);
          setNotFound(!fromList && !page);
        }
      } catch (error) {
        console.error("Не удалось загрузить организацию:", error);
        if (mounted) {
          setListItem(null);
          setPublicPage(null);
          setNotFound(true);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadOrganization();
    return () => {
      mounted = false;
    };
  }, [
    resolvedOrganizationId,
    props.variant,
    cabinetFetching,
    cabinetUnresolved,
    cabinetPayload.publicPage,
    cabinetOrgId,
    cabinetPayload.listItem,
  ]);

  const cabinetRecord = useMemo(() => {
    void cabinetTick;
    if (props.variant === "cabinet") {
      return getOrganizationCabinetRecordForCurrentUser();
    }
    if (!organizationNameFromRecord) return null;
    return getOrganizationCabinetRecordByName(organizationNameFromRecord);
  }, [props.variant, organizationNameFromRecord, cabinetTick]);

  const mergedCabinetProfile = useMemo(() => {
    if (!publicPage) return null;
    const hint = organizationNameFromRecord.trim() || publicPage.hero.name || "";
    const fromApi = mapOrganizationPublicPageToProfileData(publicPage, listItem, hint);
    return mergeOrganizationProfilePreferApi(fromApi, cabinetRecord?.profile);
  }, [publicPage, listItem, organizationNameFromRecord, cabinetRecord?.profile, cabinetTick]);

  const profileForUi = mergedCabinetProfile ?? cabinetRecord?.profile;

  const wardRows = useMemo((): WardRow[] => {
    if (props.variant === "cabinet" && role === "organization") {
      const merged = mergeApiAndLocalAnimals(cabinetPayload.apiAnimals, localAnimals);
      if (merged.length > 0) {
        return merged.map((a) => ({
          id: a.id,
          name: a.name,
          primary_photo_url: a.primary_photo_url,
          species: a.species || "—",
          breed: a.breed?.trim() || "Метис",
          age_months: a.age_months,
          status: a.status,
          status_label: null,
          location_city: a.location_city,
          is_urgent: a.is_urgent,
        }));
      }
    }

    const apiWards = (publicPage?.wards ?? []).map((w) => ({
      id: w.id,
      name: w.name,
      primary_photo_url: w.photo_url ? getImageUrl(w.photo_url) : null,
      species: w.species,
      breed: "Метис",
      age_months: w.age_months,
      status: w.status,
      status_label: w.status_label,
      location_city: null as string | null,
      is_urgent: w.is_urgent,
    }));
    if (apiWards.length > 0) return apiWards;
    if (props.variant === "cabinet" && role === "organization") {
      return getCurrentOrganizationAnimals().map((a) => ({
        id: a.id,
        name: a.name,
        primary_photo_url: a.primary_photo_url,
        species: a.species || "—",
        breed: a.breed?.trim() || "Метис",
        age_months: a.age_months,
        status: a.status,
        status_label: null,
        location_city: a.location_city,
        is_urgent: a.is_urgent,
      }));
    }
    if (!organizationNameFromRecord) return [];
    return getOrganizationAnimalsByName(organizationNameFromRecord).map((a) => ({
      id: a.id,
      name: a.name,
      primary_photo_url: a.primary_photo_url,
      species: a.species || "—",
      breed: a.breed?.trim() || "Метис",
      age_months: a.age_months,
      status: a.status,
      status_label: null,
      location_city: a.location_city,
      is_urgent: a.is_urgent,
    }));
  }, [props.variant, role, cabinetPayload.apiAnimals, localAnimals, publicPage, organizationNameFromRecord, cabinetTick]);

  const orgName =
    profileForUi?.organizationName.trim() ||
    publicPage?.hero.name ||
    listItem?.name ||
    "Организация";
  const orgAddress =
    listItem?.address ||
    publicPage?.hero.address ||
    publicPage?.hero.geography_display ||
    listItem?.city ||
    publicPage?.hero.city ||
    "Адрес не указан";
  const orgDescription =
    profileForUi?.description ||
    profileForUi?.helpWays ||
    publicPage?.hero.description?.trim() ||
    publicPage?.about.about?.trim() ||
    "Описание пока не заполнено.";
  const logoPath = publicPage?.hero.logo_url ?? listItem?.logo_url ?? null;
  const localLogo = props.variant === "cabinet" ? profileForUi?.logoDataUrl?.trim() : "";
  const orgLogo = (localLogo || (logoPath ? getImageUrl(logoPath) : "")) || "/event.png";
  const coverPath = publicPage?.hero.cover_url ?? null;
  const coverUrlFromApi = coverPath ? getImageUrl(coverPath) : null;
  const localCover = props.variant === "cabinet" ? profileForUi?.coverDataUrl?.trim() : "";
  const coverUrl = localCover || coverUrlFromApi;

  const contactsDisplay = useMemo(() => {
    const p = profileForUi;
    if (!p) {
      if (publicPage?.hero.phone?.trim() || publicPage?.hero.email?.trim()) {
        const lines: string[] = [];
        if (publicPage.hero.phone?.trim()) lines.push(`Телефон ${publicPage.hero.phone.trim()}`);
        if (publicPage.hero.email?.trim()) lines.push(`Email ${publicPage.hero.email.trim()}`);
        return lines.join("\n");
      }
      return "Контакты не указаны.";
    }
    const lines: string[] = [];
    if (p.phone?.trim()) lines.push(`Телефон ${p.phone.trim()}`);
    if (p.email?.trim()) lines.push(`Email ${p.email.trim()}`);
    if (p.contacts?.trim()) lines.push(p.contacts.trim());
    return lines.length > 0 ? lines.join("\n") : "Контакты не указаны.";
  }, [profileForUi, publicPage, cabinetTick]);

  const extraSocialLinks = useMemo(() => {
    const rows = profileForUi?.extraSocialLinks ?? [];
    return rows
      .map((row) => ({
        id: row.id,
        messenger: (row.messenger || "").trim(),
        url: (row.url || "").trim(),
      }))
      .filter((row) => row.url.length > 0);
  }, [profileForUi, cabinetTick]);

  const organizationRequests = useMemo(() => {
    return mergeOrganizationHelpRequests(publicPage?.urgent_help ?? [], cabinetRecord?.requests ?? []);
  }, [cabinetRecord, publicPage]);

  const organizationEvents = useMemo(() => {
    const c = cabinetRecord?.events ?? [];
    if (c.length) return c;
    return (publicPage?.events ?? []).map(mapOrgEvent);
  }, [cabinetRecord, publicPage]);

  const organizationGreetings = useMemo(() => {
    const c = cabinetRecord?.greetingsFromHome ?? [];
    if (c.length) return c;
    return (publicPage?.home_stories ?? []).map(mapHomeStory);
  }, [cabinetRecord, publicPage]);

  const organizationReports = useMemo(() => {
    const c = cabinetRecord?.reports ?? [];
    if (c.length) return c;
    return (publicPage?.reports ?? []).map(mapOrgReport);
  }, [cabinetRecord, publicPage]);

  const organizationArticles = useMemo(() => {
    const c = (cabinetRecord?.articles ?? []).filter((article) => !article.archived);
    if (c.length) return c;
    return (publicPage?.articles ?? []).map(mapOrgArticle);
  }, [cabinetRecord, publicPage]);

  const adoptedYearlyCount =
    organizationGreetings.length ||
    publicPage?.hero.adopted_yearly_count ||
    listItem?.adopted_yearly_count ||
    0;

  const aboutGalleryUrls = useMemo(() => {
    const fromProfile = (profileForUi?.galleryDataUrls ?? []).filter((u) => u?.trim());
    if (fromProfile.length > 0) return fromProfile;
    const api = (publicPage?.about.gallery_urls ?? [])
      .map((u) => (u ? getImageUrl(u) : ""))
      .filter((u) => u.length > 0);
    return api;
  }, [profileForUi?.galleryDataUrls, publicPage?.about.gallery_urls]);

  const { aboutIntroParagraph, aboutMainTaskLines } = useMemo(() => {
    const cabinetHistory = profileForUi?.organizationHistory?.trim();
    let rawCombined = "";
    if (props.variant === "cabinet") {
      rawCombined =
        cabinetHistory ||
        publicPage?.about.about?.trim() ||
        profileForUi?.description?.trim() ||
        publicPage?.hero.description?.trim() ||
        "";
    } else {
      const apiAbout = publicPage?.about.about?.trim();
      const cabinetDesc = profileForUi?.description?.trim();
      const heroDesc = publicPage?.hero.description?.trim();
      rawCombined =
        cabinetHistory || apiAbout || cabinetDesc || heroDesc || orgDescription.trim() || "";
    }

    const profileLines = (profileForUi?.aboutMainTasks ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const parsed = splitOrganizationAboutMainTasksFromPlainText(rawCombined);
    const taskLines = profileLines.length > 0 ? profileLines : parsed.tasks;

    let introParagraph = rawCombined;
    if (taskLines.length > 0 && parsed.tasks.length > 0) {
      introParagraph = parsed.intro.trim();
    }

    return { aboutIntroParagraph: introParagraph, aboutMainTaskLines: taskLines };
  }, [
    props.variant,
    profileForUi?.organizationHistory,
    profileForUi?.description,
    profileForUi?.aboutMainTasks,
    publicPage?.about.about,
    publicPage?.hero.description,
    orgDescription,
  ]);

  const aboutGalleryCaption = useMemo(
    () => profileForUi?.aboutGalleryCaption?.trim() ?? "",
    [profileForUi?.aboutGalleryCaption]
  );

  useEffect(() => {
    setAboutGallerySlideIndex(0);
  }, [aboutGalleryUrls]);

  const aboutGallerySlideCount = aboutGalleryUrls.length;
  const goAboutGalleryPrev = () => {
    if (aboutGallerySlideCount < 2) return;
    setAboutGallerySlideIndex((i) =>
      i <= 0 ? aboutGallerySlideCount - 1 : i - 1
    );
  };
  const goAboutGalleryNext = () => {
    if (aboutGallerySlideCount < 2) return;
    setAboutGallerySlideIndex((i) =>
      i >= aboutGallerySlideCount - 1 ? 0 : i + 1
    );
  };

  const aboutInn =
    props.variant === "cabinet"
      ? profileForUi?.inn?.trim() || ""
      : profileForUi?.inn?.trim() || publicPage?.about.inn?.trim() || "";
  const aboutOgrn =
    props.variant === "cabinet"
      ? profileForUi?.ogrn?.trim() || ""
      : profileForUi?.ogrn?.trim() || publicPage?.about.ogrn?.trim() || "";
  const aboutBank =
    props.variant === "cabinet"
      ? profileForUi?.bankAccount?.trim() || ""
      : profileForUi?.bankAccount?.trim() || publicPage?.about.bank_account?.trim() || "";

  const formatAge = (months: number) => {
    if (!months) return "Возраст не указан";
    if (months < 12) return `${months} мес.`;
    const years = Math.floor(months / 12);
    return `${years} ${years === 1 ? "год" : years < 5 ? "года" : "лет"}`;
  };

  const getAnimalStatus = (status: string) => {
    if (status === "looking_for_home") return "Ищет дом";
    if (status === "on_treatment") return "На лечении";
    return "В приюте";
  };

  const wardStatusLabel = (animal: WardRow) => animal.status_label?.trim() || getAnimalStatus(animal.status);

  const getRequestStatusLabel = (status: string) => {
    if (status === "published") return "опубликована";
    if (status === "in_progress") return "в работе";
    if (status === "closed") return "закрыта";
    return "черновик";
  };

  const publicCatalogHref =
    props.variant === "cabinet" && Number.isFinite(resolvedOrganizationId)
      ? `/catalog/organizations/${resolvedOrganizationId}`
      : null;

  const renderTabContent = () => {
    if (activeTab === "about") {
      const hasGallery = aboutGalleryUrls.length > 0;
      const hasRequisites = Boolean(aboutInn || aboutOgrn || aboutBank);
      const aboutGalleryShowNav = aboutGallerySlideCount > 1;
      const aboutGalleryTrackShiftPct =
        aboutGallerySlideCount > 0
          ? `${(-aboutGallerySlideIndex * 100) / aboutGallerySlideCount}%`
          : "0%";

      return (
        <section className={styles.aboutSection} aria-label="О нас">
          <div className={styles.aboutInner}>
            {aboutIntroParagraph ? (
              <p className={styles.aboutIntro}>{aboutIntroParagraph}</p>
            ) : aboutMainTaskLines.length > 0 ? null : (
              <p className={styles.aboutIntroMuted}>
                Текст о команде миссии и ценностях появится здесь после заполнения раздела «О нас» в
                редактировании страницы или с бэкенда.
              </p>
            )}

            {aboutMainTaskLines.length > 0 ? (
              <>
                <h2 className={styles.aboutTasksHeading}>Наши основные задачи:</h2>
                <ul className={styles.aboutTasksList}>
                  {aboutMainTaskLines.map((line, i) => (
                    <li key={`${i}-${line.slice(0, 48)}`}>{line}</li>
                  ))}
                </ul>
              </>
            ) : null}

            {hasGallery ? (
              <div
                className={styles.aboutGalleryCarousel}
                role="region"
                aria-roledescription="carousel"
                aria-label="Фотографии организации"
              >
                <div className={styles.aboutGalleryCarouselInner}>
                  {aboutGalleryShowNav ? (
                    <button
                      type="button"
                      className={`${styles.aboutGalleryNavBtn} ${styles.aboutGalleryNavPrev}`}
                      aria-label="Предыдущее фото"
                      onClick={goAboutGalleryPrev}
                    >
                      ‹
                    </button>
                  ) : null}
                  <div
                    className={styles.aboutGalleryViewport}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (!aboutGalleryShowNav) return;
                      if (e.key === "ArrowLeft") {
                        e.preventDefault();
                        goAboutGalleryPrev();
                      }
                      if (e.key === "ArrowRight") {
                        e.preventDefault();
                        goAboutGalleryNext();
                      }
                    }}
                    onTouchStart={(e) => {
                      aboutGallerySwipeStartX.current = e.touches[0]?.clientX ?? null;
                    }}
                    onTouchEnd={(e) => {
                      const start = aboutGallerySwipeStartX.current;
                      aboutGallerySwipeStartX.current = null;
                      if (start == null || !aboutGalleryShowNav) return;
                      const end = e.changedTouches[0]?.clientX ?? start;
                      const dx = end - start;
                      if (dx > ABOUT_SWIPE_MIN_PX) goAboutGalleryPrev();
                      else if (dx < -ABOUT_SWIPE_MIN_PX) goAboutGalleryNext();
                    }}
                  >
                    <div
                      className={styles.aboutGalleryTrack}
                      style={{
                        width: `${aboutGallerySlideCount * 100}%`,
                        transform: `translateX(${aboutGalleryTrackShiftPct})`,
                      }}
                    >
                      {aboutGalleryUrls.map((src, i) => (
                        <div
                          key={`${i}-${src.slice(0, 48)}`}
                          className={styles.aboutGallerySlide}
                          style={{ width: `${100 / aboutGallerySlideCount}%` }}
                          aria-hidden={i !== aboutGallerySlideIndex}
                        >
                          <div className={styles.aboutGallerySlideFrame}>
                            <img src={src} alt="" className={styles.aboutGallerySlideImg} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {aboutGalleryShowNav ? (
                    <button
                      type="button"
                      className={`${styles.aboutGalleryNavBtn} ${styles.aboutGalleryNavNext}`}
                      aria-label="Следующее фото"
                      onClick={goAboutGalleryNext}
                    >
                      ›
                    </button>
                  ) : null}
                </div>
                {aboutGalleryShowNav ? (
                  <div className={styles.aboutGalleryDots} role="tablist" aria-label="Выбор фото">
                    {aboutGalleryUrls.map((src, i) => (
                      <button
                        key={`dot-${i}-${src.slice(0, 32)}`}
                        type="button"
                        role="tab"
                        aria-selected={i === aboutGallerySlideIndex}
                        aria-label={`Фото ${i + 1} из ${aboutGallerySlideCount}`}
                        className={
                          i === aboutGallerySlideIndex
                            ? `${styles.aboutGalleryDot} ${styles.aboutGalleryDotActive}`
                            : styles.aboutGalleryDot
                        }
                        onClick={() => setAboutGallerySlideIndex(i)}
                      />
                    ))}
                  </div>
                ) : null}
                {aboutGalleryCaption ? (
                  <p className={styles.aboutGalleryCaption}>{aboutGalleryCaption}</p>
                ) : null}
              </div>
            ) : null}

            {hasRequisites ? (
              <div className={styles.aboutRequisites}>
                <h2 className={styles.aboutRequisitesTitle}>Реквизиты</h2>
                {aboutInn ? (
                  <p className={styles.aboutRequisitesLine}>
                    <strong>ИНН:</strong> {aboutInn}
                  </p>
                ) : null}
                {aboutOgrn ? (
                  <p className={styles.aboutRequisitesLine}>
                    <strong>ОГРН:</strong> {aboutOgrn}
                  </p>
                ) : null}
                {aboutBank ? (
                  <p className={styles.aboutRequisitesLine}>
                    <strong>Расчётный счёт:</strong> {aboutBank}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      );
    }

    if (activeTab === "help") {
      return (
        <section className={styles.helpList} aria-label="Чем помочь">
          {organizationRequests.length === 0 ? (
            <article className={styles.helpEmptyCard}>
              <p>Заявок на помощь пока нет.</p>
            </article>
          ) : (
            organizationRequests.map((request) => {
              const linkedAnimal = request.linkedAnimalId
                ? wardRows.find((animal) => animal.id === request.linkedAnimalId)
                : null;
              const imageSrc = request.mediaUrl?.trim() || linkedAnimal?.primary_photo_url || "/cat-placeholder.jpg";

              return (
                <article key={request.id} className={styles.helpRequestCard}>
                  <div className={styles.helpCover}>
                    <img src={imageSrc} alt={request.title} />
                    {request.urgency === "urgent" ? <span className={styles.helpUrgentBadge}>срочно</span> : null}
                  </div>

                  <div className={styles.helpRequestBody}>
                    <h3 className={styles.helpRequestName}>{request.title}</h3>
                    <div className={styles.helpTags}>
                      <span>{getUrgentHelpTypeLabel(request.helpType)}</span>
                      {request.needVolunteer ? <span>Нужен волонтер</span> : null}
                      <span>{request.location || "Локация не указана"}</span>
                    </div>
                    <p className={styles.helpOrganizationLine}>{request.problemDescription}</p>
                    <p className={styles.helpMetaLine}>Статус: {getRequestStatusLabel(request.status)}</p>
                  </div>
                </article>
              );
            })
          )}
        </section>
      );
    }

    if (activeTab === "events") {
      return (
        <section className={styles.contentGrid} aria-label="Мероприятия">
          {organizationEvents.length === 0 ? (
            <article className={styles.infoCard}>
              <p>Мероприятий пока нет.</p>
            </article>
          ) : (
            organizationEvents.map((event) => (
              <article className={styles.infoCard} key={event.id}>
                <img src="/event.png" alt={event.title} className={styles.eventImage} />
                <h3>{event.title}</h3>
                <p>{event.dateLabel}</p>
                <p>{event.location}</p>
              </article>
            ))
          )}
        </section>
      );
    }

    if (activeTab === "home") {
      return (
        <section className={styles.homeList} aria-label="Привет из дома">
          {organizationGreetings.length === 0 ? (
            <article className={styles.homeEmptyCard}>
              <p>Публикаций пока нет.</p>
            </article>
          ) : (
            organizationGreetings.map((story) => (
              <article className={styles.homeRequestCard} key={story.id}>
                <div className={styles.homeCover}>
                  <img src={story.photoUrl || "/cat-placeholder.jpg"} alt={story.petName} />
                </div>
                <div className={styles.homeRequestBody}>
                  <h3 className={styles.homeRequestName}>{story.petName}</h3>
                  <div className={styles.homeTags}>
                    <span>Привет из дома</span>
                    {story.linkedAnimalId ? (
                      <span>
                        Животное: {wardRows.find((animal) => animal.id === story.linkedAnimalId)?.name || "не указано"}
                      </span>
                    ) : null}
                  </div>
                  <p className={styles.homeOrganizationLine}>{story.text}</p>
                  <p className={styles.homeMetaLine}>
                    {new Date(story.createdAt).toLocaleDateString("ru-RU", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </article>
            ))
          )}
        </section>
      );
    }

    if (activeTab === "articles") {
      return (
        <section className={styles.homeList} aria-label="Статьи организации">
          {organizationArticles.length === 0 ? (
            <article className={styles.homeEmptyCard}>
              <p>Статей пока нет.</p>
            </article>
          ) : (
            organizationArticles.map((article) => {
              const coverSrc = article.coverUrl?.trim()
                ? getImageUrl(article.coverUrl)
                : "/cat-placeholder.jpg";

              return (
                <article className={styles.homeRequestCard} key={article.id}>
                  <div className={styles.homeCover}>
                    <img src={coverSrc} alt="" />
                  </div>
                  <div className={styles.homeRequestBody}>
                    <h3 className={styles.homeRequestName}>{article.title}</h3>
                    <div className={styles.homeTags}>
                      <span>{getArticleCategoryLabel(article.articleType)}</span>
                      <span>{article.author}</span>
                    </div>
                    <p className={`${styles.homeOrganizationLine} ${styles.articleExcerpt}`}>{article.content}</p>
                    <p className={styles.homeMetaLine}>
                      {new Date(article.createdAt).toLocaleDateString("ru-RU", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </article>
              );
            })
          )}
        </section>
      );
    }

    if (activeTab === "reports") {
      return (
        <section className={styles.contentBlock} aria-label="Отчеты">
          <h2 className={styles.blockTitle}>Документы и отчеты</h2>
          <ul className={styles.reportList}>
            {organizationReports.length === 0 ? (
              <li>Отчеты пока не добавлены.</li>
            ) : (
              organizationReports.map((item) => (
                <li key={item.id}>
                  <span className={styles.reportLink}>{item.title}</span>
                </li>
              ))
            )}
          </ul>
        </section>
      );
    }

    return (
      <section className={styles.cardsSection} aria-label="Подопечные организации">
        <div className={styles.cardsGrid}>
          {wardRows.length === 0 ? (
            <article className={styles.infoCard}>
              <p>Подопечные пока не добавлены.</p>
            </article>
          ) : (
            wardRows.map((animal) => (
              <article className={styles.card} key={animal.id}>
                <div className={styles.imageWrap}>
                  <img src={animal.primary_photo_url || "/cat-placeholder.jpg"} alt={animal.name} className={styles.image} />
                  {animal.is_urgent ? <span className={styles.urgentTopBadge}>срочно</span> : null}
                  <span className={styles.badge}>{wardStatusLabel(animal)}</span>
                </div>

                <div className={styles.cardBody}>
                  <h2 className={styles.cardTitle}>{animal.name}</h2>
                  <p className={styles.meta}>
                    <span>{animal.species}</span>
                    <span>{animal.breed}</span>
                    <span>{formatAge(animal.age_months)}</span>
                  </p>
                  <p className={styles.location}>
                    <img src="/org.svg" alt="" className={styles.locationIcon} />
                    {animal.location_city || orgName}
                  </p>
                  <Link href={`/catalog/animals/${animal.id}`} className={styles.primaryButton}>
                    Подробнее
                  </Link>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    );
  };

  if (cabinetFetching || cabinetUnresolved) {
    if (cabinetUnresolved) {
      return (
        <main className={styles.page}>
          <section className={styles.loadingWrap}>
            <p className={styles.loadingText}>
              Не удалось найти ваш аккаунт, обратитесь в поддержку.
            </p>
          </section>
        </main>
      );
    }

    return (
      <main className={styles.page}>
        <section className={styles.loadingWrap}>
          <p className={styles.loadingText}>Загрузка...</p>
        </section>
      </main>
    );
  }

  if (loading) {
    return (
      <main className={styles.page}>
        <section className={styles.loadingWrap}>
          <p className={styles.loadingText}>Загрузка карточки организации...</p>
        </section>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className={styles.page}>
        <section className={styles.loadingWrap}>
          <p className={styles.loadingText}>Организация не найдена.</p>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div
          className={styles.heroBanner}
          style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined}
          role={coverUrl ? "img" : undefined}
          aria-label={coverUrl ? "Обложка организации" : undefined}
        />
        <img src={orgLogo} alt={orgName} className={styles.heroAvatarImage} />
      </header>

      <section className={styles.organizationSection} aria-labelledby="organization-title">
        <div className={styles.organizationHeader}>
          <h1 id="organization-title" className={styles.organizationTitle}>
            {orgName}
          </h1>
          <p className={styles.organizationSubtitle}>
            {profileForUi?.specialization || publicPage?.hero.tagline || "Организация помощи животным"}
          </p>
        </div>

        <div className={styles.organizationGrid}>
          <article className={styles.organizationDescription}>
            <p>{orgDescription}</p>
            <address className={styles.contacts}>
              <p className={styles.addressRow}>
                <img src="/org.svg" alt="" aria-hidden="true" className={styles.inlineIcon} />
                {profileForUi?.territory || orgAddress}
              </p>
              <div className={styles.contact} style={{ whiteSpace: "pre-line" }}>
                <p className={styles.contactTitle}>Контакты</p>
                {contactsDisplay}
              </div>
              <div className={styles.socialLinks} aria-label="Социальные сети">
                {profileForUi?.vkUrl ? (
                  <a href={profileForUi.vkUrl} target="_blank" rel="noreferrer" className={styles.socialLink}>
                    <img src="/vk.svg"  className={styles.socialIcon} />
                  </a>
                ) : null}
                {profileForUi?.telegramUrl ? (
                  <a
                    href={profileForUi.telegramUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.socialLink}
                  >
                    <img src="/tg.svg" alt="Telegram" className={styles.socialIcon} />
                  </a>
                ) : null}
                {profileForUi?.whatsappUrl ? (
                  <a
                    href={profileForUi.whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.socialLink}
                  >
                    <img src="/wp.svg" alt="WhatsApp" className={styles.socialIcon} />
                  </a>
                ) : null}
                {extraSocialLinks.map((row) => (
                  <a
                    key={row.id}
                    href={toHrefMaybe(row.url)}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.socialLink}
                    title={row.url}
                  >
                    {socialIconForMessenger(row.messenger) ? (
                      <img
                        src={socialIconForMessenger(row.messenger)!.src}
                        alt={socialIconForMessenger(row.messenger)!.alt}
                        className={styles.socialIcon}
                      />
                    ) : (
                      (row.messenger || "Ссылка").slice(0, 6)
                    )}
                  </a>
                ))}
              </div>
            </address>
          </article>

          <div className={styles.statsColumn}>
            <aside className={styles.statsCard} aria-label="Статистика фонда">
              <p>
                <img src="/lapa-org.svg" alt="" aria-hidden="true" className={styles.statIcon} />
                {wardRows.length || publicPage?.hero.wards_count || listItem?.wards_count || 0} подопечных
              </p>
              <p>
                <img src="/home-org.svg" alt="" aria-hidden="true" className={styles.statIcon} />
                {adoptedYearlyCount} пристроено за год
              </p>
            </aside>

            <nav className={styles.infoLinks} aria-label="Полезные ссылки">
              <Link href="#" className={styles.infoLink}>
                <img src="/info.svg" alt="" aria-hidden="true" className={styles.infoIcon} />
                {profileForUi?.admissionRules ||
                  publicPage?.hero.admission_rules ||
                  "Правила приема животных"}
              </Link>
              <Link href="#" className={styles.infoLink}>
                <img src="/info.svg" alt="" aria-hidden="true" className={styles.infoIcon} />
                {profileForUi?.adoptionRules ||
                  profileForUi?.adoptionScenario ||
                  publicPage?.hero.adoption_howto ||
                  "Как забрать животное домой"}
              </Link>
            </nav>
          </div>
        </div>
      </section>

      {props.variant === "cabinet" ? (
        <div className={styles.editPageBar}>
          <button type="button" className={styles.editPageButton} onClick={props.onEditPage}>
            Редактировать страницу
          </button>
        </div>
      ) : null}

      <nav className={styles.tabs} aria-label="Разделы организации">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {renderTabContent()}
    </main>
  );
}
