"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { syncStoredUserAvatar, useUser } from "@/shared/lib/hooks/useUser";
import { volunteersApi, type CatalogOption } from "@/shared/api/endpoints/volunteers";
import { eventsApi } from "@/shared/api/endpoints/events";
import { meProfileApi } from "@/shared/api/endpoints/meProfile";
import { getImageUrl } from "@/shared/api/client";
import {
  meVolunteerResponsesApi,
  type VolunteerResponseCardDto,
  type VolunteerResponseDetailDto,
} from "@/shared/api/endpoints/meVolunteerResponses";
import { meApplicationsApi, type AdoptionApplicationListItem } from "@/shared/api/endpoints/meApplications";
import { meVolunteerCommunicationsApi } from "@/shared/api/endpoints/meVolunteerCommunications";
import type { ChatThread } from "@/shared/lib/messages";
import { dedupeCommsThreadsByOrganization } from "@/shared/lib/dedupeCommsThreads";
import { fetchCommsDialogsAllPages } from "@/shared/lib/fetchCommsDialogsAllPages";
import { mapVolDialogListRow } from "@/shared/lib/volunteerOrgDialogs";
import { applyCityGeocodeToVolunteerPatch } from "@/shared/lib/geocodeCity";
import {
  resolveVolunteerMapCenter,
  volunteerProfileNeedsCitySync,
  volunteerProfileNeedsCoordsSync,
} from "@/shared/lib/volunteerLocation";
import {
  storedDetailsToVolunteerPatch,
  syncCompetencyLabelsWithCatalog,
  volunteerApiToStoredDetails,
} from "@/shared/lib/volunteerMeProfileMap";
import {
  notifyVolunteerProfileUpdated,
  emptyVolunteerDetails,
  readVolunteerDetailsFromStorage,
  syncVolunteerCatalogUserId,
  volunteerProfileStorageIdentity,
  writeVolunteerDetailsToStorage,
  VOLUNTEER_ANIMAL_KIND_OPTIONS,
  type StoredVolunteerDetails,
  type VolunteerAnimalKindTag,
  type VolunteerHelpFrequency,
} from "@/shared/lib/volunteerProfileStorage";
import styles from "./page.module.css";
import profileFormsStyles from "../../profile/page.module.css";
import responseStyles from "../responses/page.module.css";
import { type ResponseCard } from "../responses/page";
import { volunteerResponseStatusClassMap as statusClassMap } from "@/shared/lib/volunteerResponseStatusClassMap";
import { mapVolunteerResponseStatus } from "@/shared/lib/volunteerResponseStatus";
import { ResponseCardDescription } from "../responses/responseCardDescription";
import {
  WEEKDAY_EDIT_LABELS,
  WEEKDAY_KEYS,
  formatAvailabilitySummary,
  type WeekdayKey,
} from "@/shared/lib/volunteerAvailabilityGrid";

const HELP_FREQUENCY_OPTIONS: VolunteerHelpFrequency[] = ["Разовая помощь", "Регулярная помощь"];

const defaultCompetencyOptions = [
  "Выгул / Уход",
  "Фото / Видеосъемка",
  "Передержка",
  "Тексты / Соцсети",
  "Помощь руками",
  "Автопомощь",
  "Медицинская помощь",
  "Другое",
];

const defaultExperienceOptions = ["Новичок", "Опытный", "Ветеринарное образование"];

const defaultHelpFormatOptions = [
  "Финансовая помощь",
  "Передержка",
  "Помощь руками",
  "Автопомощь",
  "Лекарства и кровь",
  "Другое",
];

const DEFAULT_AVATAR_SRC = "/event.png";

function resolveMeAvatarUrl(prof: {
  user_profile: { avatar_url: string | null } | null;
  volunteer_profile: { avatar_url: string | null } | null;
}): string | null {
  const vp = prof.volunteer_profile;
  if (vp?.avatar_url) return getImageUrl(vp.avatar_url);
  if (prof.user_profile?.avatar_url) return getImageUrl(prof.user_profile.avatar_url);
  return null;
}

export default function VolunteerProfilePage() {
  const router = useRouter();
  const { userName, userEmail, role, isLoading: userHookLoading } = useUser();
  const profileIdentity = useMemo(() => volunteerProfileStorageIdentity(userEmail, userName), [userEmail, userName]);
  const [authUserId, setAuthUserId] = useState<number | null>(null);
  const [volunteerProfileMissing, setVolunteerProfileMissing] = useState(false);
  const [previewResponses, setPreviewResponses] = useState<ResponseCard[]>([]);
  const [expandedPreviewResponseIds, setExpandedPreviewResponseIds] = useState<Set<number>>(() => new Set());
  const [loadingPreviewDetailId, setLoadingPreviewDetailId] = useState<number | null>(null);
  const [adoptionApplications, setAdoptionApplications] = useState<AdoptionApplicationListItem[]>([]);
  const [adoptionLoading, setAdoptionLoading] = useState(false);
  const [adoptionLoadError, setAdoptionLoadError] = useState("");
  const [adoptionOpenedMenuId, setAdoptionOpenedMenuId] = useState<number | null>(null);
  const [adoptionDeleteBusyId, setAdoptionDeleteBusyId] = useState<number | null>(null);
  const [messageThreads, setMessageThreads] = useState<ChatThread[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [avatarUploadError, setAvatarUploadError] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const editModalAvatarInputRef = useRef<HTMLInputElement | null>(null);
  const [competencyOptions, setCompetencyOptions] = useState<string[]>(defaultCompetencyOptions);
  const [experienceOptions, setExperienceOptions] = useState<string[]>(defaultExperienceOptions);
  const [helpFormatOptions, setHelpFormatOptions] = useState<string[]>(defaultHelpFormatOptions);
  const [competencyCatalogRows, setCompetencyCatalogRows] = useState<CatalogOption[]>([]);
  const [experienceCatalogRows, setExperienceCatalogRows] = useState<CatalogOption[]>([]);
  const [details, setDetails] = useState<StoredVolunteerDetails>(emptyVolunteerDetails);
  const [liveListIsAvailable, setLiveListIsAvailable] = useState<boolean | null>(null);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileLoadError, setProfileLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [availabilitySaveError, setAvailabilitySaveError] = useState<string | null>(null);
  const editSnapshotRef = useRef<StoredVolunteerDetails | null>(null);

  useEffect(() => {
    if (role !== "volunteer") {
      setPreviewResponses([]);
      return;
    }
    void meVolunteerResponsesApi
      .getList({ tab: "all", limit: 3, offset: 0 })
      .then((res) => {
        const rows = res.items ?? [];
        const mapped = rows.map(mapVolunteerCardToPreview).filter(Boolean) as ResponseCard[];
        setPreviewResponses(mapped);
      })
      .catch(() => setPreviewResponses([]));
  }, [role]);

  useEffect(() => {
    if (role !== "volunteer") {
      setMessageThreads([]);
      setMessagesLoading(false);
      return;
    }
    let cancelled = false;
    setMessagesLoading(true);
    void fetchCommsDialogsAllPages((p) => meVolunteerCommunicationsApi.listDialogs(p))
      .then((rows) => {
        if (cancelled) return;
        const mapped = (rows as Record<string, unknown>[]).map((row) => mapVolDialogListRow(row));
        setMessageThreads(dedupeCommsThreadsByOrganization(mapped).slice(0, 3));
      })
      .catch(() => {
        if (!cancelled) setMessageThreads([]);
      })
      .finally(() => {
        if (!cancelled) setMessagesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [role]);

  const reloadAdoptionApplications = useCallback(() => {
    setAdoptionLoading(true);
    setAdoptionLoadError("");
    void meApplicationsApi
      .list({ limit: 6 })
      .then((res) => setAdoptionApplications(res.items ?? []))
      .catch(() => {
        setAdoptionLoadError("Не удалось загрузить анкеты.");
        setAdoptionApplications([]);
      })
      .finally(() => setAdoptionLoading(false));
  }, []);

  useEffect(() => {
    if (role !== "volunteer") {
      setAdoptionApplications([]);
      setAdoptionLoadError("");
      setAdoptionLoading(false);
      setAdoptionOpenedMenuId(null);
      return;
    }
    reloadAdoptionApplications();
  }, [role, reloadAdoptionApplications]);

  useEffect(() => {
    if (adoptionOpenedMenuId === null) {
      return;
    }
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const clickedInsideMenu = target?.closest('[data-volunteer-adoption-menu="true"]');
      if (!clickedInsideMenu) {
        setAdoptionOpenedMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [adoptionOpenedMenuId]);

  useEffect(() => {
    if (role !== "volunteer" || !profileIdentity.trim()) {
      setProfileLoading(false);
      setAuthUserId(null);
      setVolunteerProfileMissing(false);
      return;
    }

    let cancelled = false;

    const readStringOptions = (value: unknown): string[] => {
      if (!Array.isArray(value)) {
        return [];
      }
      return value
        .map((item) => {
          if (typeof item === "string") return item;
          if (item && typeof item === "object" && "label" in item) {
            const label = (item as { label?: unknown }).label;
            return typeof label === "string" ? label : "";
          }
          return "";
        })
        .map((item) => item.trim())
        .filter(Boolean);
    };

    const dedupeStrings = (items: string[]) => Array.from(new Set(items));

    (async () => {
      setProfileLoading(true);
      setProfileLoadError(null);
      setVolunteerProfileMissing(false);
      try {
        const [cats, eventsCatalogs, prof] = await Promise.all([
          volunteersApi.getCatalogs(),
          eventsApi.getCatalogs(),
          meProfileApi.get(),
        ]);
        if (cancelled) return;

        setAuthUserId(prof.user.id);

        setCompetencyCatalogRows(cats.competencies ?? []);
        setExperienceCatalogRows(cats.experience_levels ?? []);

        const backendCompetencies = readStringOptions(cats.competencies);
        const backendExperience = readStringOptions(cats.experience_levels);
        const backendHelpFormats = readStringOptions(eventsCatalogs?.help_types);

        setCompetencyOptions(
          dedupeStrings(backendCompetencies.length > 0 ? backendCompetencies : defaultCompetencyOptions)
        );
        setExperienceOptions(
          dedupeStrings(backendExperience.length > 0 ? backendExperience : defaultExperienceOptions)
        );
        setHelpFormatOptions(
          dedupeStrings(backendHelpFormats.length > 0 ? backendHelpFormats : defaultHelpFormatOptions)
        );

        const vp = prof.volunteer_profile;
        if (vp) {
          const mapped = volunteerApiToStoredDetails(vp, cats.experience_levels ?? []);
          const catalog = cats.competencies ?? [];
          const synced: StoredVolunteerDetails = {
            ...mapped,
            competencies: syncCompetencyLabelsWithCatalog(mapped.competencies, catalog),
          };
          setDetails(synced);
          writeVolunteerDetailsToStorage(profileIdentity, synced);
          setVolunteerProfileMissing(false);
          setAvatarUrl(resolveMeAvatarUrl(prof));
        } else {
          setDetails({ ...emptyVolunteerDetails });
          setVolunteerProfileMissing(true);
          setAvatarUrl(resolveMeAvatarUrl(prof));
        }

        void syncVolunteerCatalogUserId(profileIdentity, { userId: prof.user.id }).then(({ listIsAvailable }) => {
          if (!cancelled && listIsAvailable !== null) setLiveListIsAvailable(listIsAvailable);
        });

        {
          const storedLocation = readVolunteerDetailsFromStorage(profileIdentity).location;
          const locationText =
            vp?.location_city?.trim() || storedLocation.trim();
          if (vp && locationText) {
            void resolveVolunteerMapCenter(vp, storedLocation).then(({ center, locationQuery, usedStoredText }) => {
              if (cancelled || !center) return;
              const cityToSave =
                usedStoredText && storedLocation.trim() ? storedLocation.trim() : locationQuery;
              const needsCoords = volunteerProfileNeedsCoordsSync(vp, center);
              const needsCity = cityToSave ? volunteerProfileNeedsCitySync(vp, cityToSave) : false;
              if (!needsCoords && !needsCity) return;
              void meProfileApi
                .patch({
                  volunteer: {
                    latitude: center[0],
                    longitude: center[1],
                    ...(needsCity && cityToSave ? { location_city: cityToSave } : {}),
                  },
                })
                .then(() => notifyVolunteerProfileUpdated())
                .catch(() => {});
            });
          }
        }
      } catch (e) {
        if (!cancelled) {
          setProfileLoadError(e instanceof Error ? e.message : "Не удалось загрузить профиль");
          setAuthUserId(null);
          setVolunteerProfileMissing(false);
          setDetails({ ...emptyVolunteerDetails });
        }
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [role, profileIdentity]);

  const catalogAvailabilityShown =
    details.catalogIsAvailable !== null ? details.catalogIsAvailable : (liveListIsAvailable ?? true);

  const persistCatalogAvailability = useCallback(
    async (value: boolean) => {
      setAvailabilitySaveError(null);
      setDetails((prev) => {
        const next: StoredVolunteerDetails = { ...prev, catalogIsAvailable: value };
        writeVolunteerDetailsToStorage(profileIdentity, next);
        return next;
      });
      try {
        await meProfileApi.patch({ volunteer: { is_available: value } });
        await syncVolunteerCatalogUserId(profileIdentity, { userId: authUserId ?? undefined });
        notifyVolunteerProfileUpdated();
      } catch (e) {
        setAvailabilitySaveError(e instanceof Error ? e.message : "Не удалось сохранить статус");
      }
    },
    [profileIdentity, authUserId]
  );

  const profileResponses = previewResponses;

  const handleExpandPreviewResponse = useCallback((item: ResponseCard) => {
    if (item.descriptionFull != null) {
      setExpandedPreviewResponseIds((prev) => new Set(prev).add(item.id));
      return;
    }
    setLoadingPreviewDetailId(item.id);
    void meVolunteerResponsesApi
      .getById(item.id)
      .then((fresh) => {
        const d = fresh as VolunteerResponseDetailDto;
        const snippet = d.description_snippet?.trim() || item.descriptionSnippet;
        const fullRaw = d.help_request_description?.trim();
        const descriptionFull = (fullRaw || snippet || "").trim() || null;
        setPreviewResponses((prev) =>
          prev.map((r) => (r.id === item.id ? { ...r, descriptionSnippet: snippet, descriptionFull } : r))
        );
        setExpandedPreviewResponseIds((prev) => new Set(prev).add(item.id));
      })
      .catch(() => {})
      .finally(() => setLoadingPreviewDetailId(null));
  }, []);

  const handleCollapsePreviewResponse = useCallback((id: number) => {
    setExpandedPreviewResponseIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const detailsEntries = useMemo(
    () => [
      {
        label: "Предпочтительный формат помощи",
        value: details.helpFrequency.trim(),
      },
      {
        label: "Компетенции",
        value: [
          ...details.competencies.filter((value) => value !== "Другое"),
          details.competencies.includes("Другое") && details.competenciesOther.trim()
            ? `Другое: ${details.competenciesOther.trim()}`
            : details.competencies.includes("Другое")
              ? "Другое"
              : "",
        ]
          .filter(Boolean)
          .join(", "),
      },
      {
        label: "С кем готов работать",
        value: VOLUNTEER_ANIMAL_KIND_OPTIONS.filter((tag) => details.animalKinds.includes(tag)).join(", "),
      },
      { label: "Опыт", value: details.experience },
      {
        label: "Доступность",
        value: (() => {
          const fromGrid = formatAvailabilitySummary({
            availabilityGrid: details.availabilityGrid,
            availabilityAroundClock: details.availabilityAroundClock,
            availabilityDayRanges: details.availabilityDayRanges,
          }).trim();
          if (fromGrid) return fromGrid;
          const legacyDays = [details.availabilityDays.join(", "), details.availabilityTimes.join(", ")]
            .filter(Boolean)
            .join(" | ");
          if (legacyDays) return legacyDays;
          return details.availabilityPlainText.trim();
        })(),
      },
      {
        label: "Выезд за город",
        value: details.travelOutOfTown ? "Готов выезжать за город" : "",
      },
      { label: "Ночные срочные выезды", value: details.nightOutings ? "Готов к срочным ночным выездам" : "" },
      { label: "Локация", value: details.location },
      { label: "Радиус выезда", value: details.travelRadius },
      {
        label: "Чем могу помочь",
        value: [
          ...details.helpFormats.filter((value) => value !== "Другое"),
          details.helpFormats.includes("Другое") && details.helpFormatsOther.trim()
            ? `Другое: ${details.helpFormatsOther.trim()}`
            : details.helpFormats.includes("Другое")
              ? "Другое"
              : "",
        ]
          .filter(Boolean)
          .join(", "),
      },
      { label: "О себе", value: details.aboutMe.trim() },
    ],
    [details]
  );

  const hasAnyDetails = detailsEntries.some((entry) => entry.value.trim().length > 0);

  const handleDetailsFieldChange =
    (field:
      | "experience"
      | "location"
      | "travelRadius"
      | "competenciesOther"
      | "helpFormatsOther"
      | "aboutMe") =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setDetails((prev) => ({
        ...prev,
        [field]: event.target.value,
      }));
    };

  const setDayTimeRange = (day: WeekdayKey, field: "from" | "to", value: string) => {
    setDetails((prev) => ({
      ...prev,
      availabilityAroundClock: false,
      availabilityDayRanges: {
        ...prev.availabilityDayRanges,
        [day]: {
          ...prev.availabilityDayRanges[day],
          [field]: value,
        },
      },
    }));
  };

  const toggleMultiValue = (field: "competencies" | "helpFormats", value: string) => {
    setDetails((prev) => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter((item) => item !== value)
        : [...prev[field], value],
    }));
  };

  const toggleAnimalKind = (kind: VolunteerAnimalKindTag) => {
    setDetails((prev) => ({
      ...prev,
      animalKinds: prev.animalKinds.includes(kind)
        ? prev.animalKinds.filter((item) => item !== kind)
        : [...prev.animalKinds, kind],
    }));
  };

  const handleAvatarFileSelect = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setAvatarUploadError(null);
    setAvatarUploading(true);
    try {
      const response = await meProfileApi.uploadAvatar(file);
      const nextUrl = response.avatar_url ? getImageUrl(response.avatar_url) : null;
      setAvatarUrl(nextUrl);
      syncStoredUserAvatar(nextUrl);
      notifyVolunteerProfileUpdated();
    } catch {
      setAvatarUploadError("Не удалось загрузить фото. Допустимы JPG, PNG или WebP.");
    } finally {
      setAvatarUploading(false);
    }
  }, []);

  const handleOpenEditModal = () => {
    editSnapshotRef.current = JSON.parse(JSON.stringify(details)) as StoredVolunteerDetails;
    setSaveError(null);
    setAvatarUploadError(null);
    setEditModalOpen(true);
  };

  const handleCancelEdit = useCallback(() => {
    if (editSnapshotRef.current) {
      setDetails(editSnapshotRef.current);
    }
    setEditModalOpen(false);
    setSaveError(null);
  }, []);

  useEffect(() => {
    if (!isEditModalOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleCancelEdit();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isEditModalOpen, handleCancelEdit]);

  const handleDetailsSave = async () => {
    if (competencyCatalogRows.length === 0 || experienceCatalogRows.length === 0) {
      setSaveError("Каталоги ещё загружаются, подождите секунду.");
      return;
    }
    setSaveError(null);
    setIsSaving(true);
    try {
      let volunteer = storedDetailsToVolunteerPatch(details, {
        competencyCatalog: competencyCatalogRows,
        experienceCatalog: experienceCatalogRows,
      });
      volunteer = await applyCityGeocodeToVolunteerPatch(volunteer, details.location);
      const res = await meProfileApi.patch({ volunteer });
      if (res.volunteer_profile) {
        const mapped = volunteerApiToStoredDetails(res.volunteer_profile, experienceCatalogRows);
        const synced: StoredVolunteerDetails = {
          ...mapped,
          competencies: syncCompetencyLabelsWithCatalog(mapped.competencies, competencyCatalogRows),
        };
        setDetails(synced);
        writeVolunteerDetailsToStorage(profileIdentity, synced);
        setVolunteerProfileMissing(false);
      } else {
        writeVolunteerDetailsToStorage(profileIdentity, details);
      }
      if (res.user?.id) {
        setAuthUserId(res.user.id);
      }
      await syncVolunteerCatalogUserId(profileIdentity, { userId: res.user?.id ?? authUserId ?? undefined });
      notifyVolunteerProfileUpdated();
      editSnapshotRef.current = null;
      setEditModalOpen(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Не удалось сохранить профиль");
    } finally {
      setIsSaving(false);
    }
  };

  if (!userHookLoading && role !== "volunteer") {
    return (
      <main className={styles.page}>
        <div className={styles.container}>
          <p>Профиль волонтёра доступен только для аккаунта с ролью «Волонтёр».</p>
          <Link href="/">На главную</Link>
        </div>
      </main>
    );
  }

  if (userHookLoading || (role === "volunteer" && profileLoading)) {
    return (
      <main className={styles.page}>
        <div className={styles.container}>
          <p>Загрузка профиля…</p>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        {profileLoadError ? (
          <p role="alert" style={{ marginBottom: "1rem", color: "#b3261e" }}>
            {profileLoadError}
          </p>
        ) : null}
        {!profileLoadError && volunteerProfileMissing ? (
          <p style={{ marginBottom: "1rem", color: "#555" }}>
            Сервер не вернул сохранённую анкету волонтёра.
          </p>
        ) : null}
        {availabilitySaveError ? (
          <p role="alert" style={{ marginBottom: "1rem", color: "#b3261e" }}>
            {availabilitySaveError}
          </p>
        ) : null}
        <section className={styles.userHeader}>
          <div className={styles.userHeaderIdentity}>
            <div className={styles.avatarWithStatusWrap}>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className={styles.avatarFileInput}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  void handleAvatarFileSelect(f);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                className={styles.avatarPlaceholder}
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarUploading}
                aria-label={avatarUrl ? "Изменить фото профиля" : "Добавить фото профиля"}
              >
                <img src={avatarUrl ?? DEFAULT_AVATAR_SRC} alt="" />
                <span className={styles.avatarOverlay} aria-hidden>
                  {avatarUploading ? (
                    <span className={styles.avatarOverlayText}>…</span>
                  ) : (
                    <img src="/camera.svg" alt="" className={styles.avatarCameraIcon} />
                  )}
                </span>
              </button>
              <span
                className={`${styles.statusDot} ${catalogAvailabilityShown ? styles.statusDotAvailable : styles.statusDotBusy}`}
                aria-label={catalogAvailabilityShown ? "На связи" : "Занят"}
              />
            </div>
            <div className={styles.userHeaderTexts}>
              {avatarUploadError ? (
                <p role="alert" style={{ color: "#b3261e", marginBottom: 8 }}>
                  {avatarUploadError}
                </p>
              ) : null}
              <h1>{userName || "Волонтер"}</h1>
              <div
                className={styles.catalogAvailSegment}
                role="group"
                aria-label="Статус для каталога волонтёров"
              >
                <button
                  type="button"
                  className={`${styles.catalogAvailChoice} ${catalogAvailabilityShown ? styles.catalogAvailSelected : styles.catalogAvailUnselected}`}
                  onClick={() => void persistCatalogAvailability(true)}
                  aria-pressed={catalogAvailabilityShown}
                >
                  Готов к задачам
                </button>
                <button
                  type="button"
                  className={`${styles.catalogAvailChoice} ${!catalogAvailabilityShown ? styles.catalogAvailSelected : styles.catalogAvailUnselected}`}
                  onClick={() => void persistCatalogAvailability(false)}
                  aria-pressed={!catalogAvailabilityShown}
                >
                  Временно не беру задачи
                </button>
              </div>
            </div>
          </div>
          <button type="button" className={styles.headerProfileAction} onClick={handleOpenEditModal}>
            {hasAnyDetails ? "Редактировать профиль" : "Дополнить профиль"}
          </button>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionTop}>
            <h2>Сообщения</h2>
            <Link href="/messages" className={styles.viewAll}>
              Смотреть все
            </Link>
          </div>

          {messagesLoading ? (
            <p className={styles.responsesPreviewEmpty}>Загрузка…</p>
          ) : messageThreads.length === 0 ? (
            <p className={styles.responsesPreviewEmpty}>Диалогов пока нет.</p>
          ) : (
            <div className={styles.messageList}>
              {messageThreads.map((thread) => (
                <div key={thread.id} className={styles.messageItem}>
                  <Link
                    href={`/messages?thread=${thread.id}`}
                    className={styles.messageItemLink}
                    aria-label={`Диалог с «${thread.title}»${thread.unread ? `, непрочитанных: ${thread.unread}` : ""}`}
                  >
                    <div className={styles.smallAvatar} aria-hidden="true">
                      {thread.avatarUrl ? (
                        <img src={thread.avatarUrl} alt="" className={styles.smallAvatarImg} />
                      ) : null}
                    </div>
                    {thread.unread && thread.unread > 0 ? (
                      <span className={styles.unread} aria-hidden="true">
                        {thread.unread > 99 ? "99+" : thread.unread}
                      </span>
                    ) : null}
                    <div className={styles.messageMeta}>
                      <p>{thread.title}</p>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionTop}>
            <h2>Мои отклики</h2>
            <Link href="/volunteer/responses" className={styles.viewAll}>
              Смотреть все
            </Link>
          </div>

          {profileResponses.length === 0 ? (
            <p className={styles.responsesPreviewEmpty}>Пока нет откликов.</p>
          ) : (
            <div className={styles.responsesPreviewGrid}>
              {profileResponses.map((item) => (
                <article
                  key={item.id}
                  role="link"
                  tabIndex={0}
                  aria-label={`Отклик «${item.title}». Открыть на странице откликов`}
                  className={`${responseStyles.card} ${styles.responsePreviewCard} ${styles.responsePreviewCardInteractive} ${
                    item.status === "Отменено" || item.status === "Отклонено" ? responseStyles.cardCancelled : ""
                  }`}
                  onClick={() => router.push(`/volunteer/responses?response=${item.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      router.push(`/volunteer/responses?response=${item.id}`);
                    }
                  }}
                >
                  <div className={responseStyles.cardTop}>
                    <div className={responseStyles.metaLeft}>
                      <Link
                        href={item.organizationHref}
                        className={responseStyles.organization}
                        onClick={(event) => event.stopPropagation()}
                      >
                        {item.organization}
                      </Link>
                    </div>
                    {item.urgent ? <span className={responseStyles.urgent}>срочно</span> : null}
                  </div>

                  <h2 className={responseStyles.title}>{item.title}</h2>
                  <ResponseCardDescription
                    item={item}
                    expanded={expandedPreviewResponseIds.has(item.id)}
                    loadingDetail={loadingPreviewDetailId === item.id}
                    onExpand={() => handleExpandPreviewResponse(item)}
                    onCollapse={() => handleCollapsePreviewResponse(item.id)}
                    stopPropagationOnToggle
                  />

                  <div className={responseStyles.timeRow}>
                    <img src="/clock.svg" alt="" aria-hidden="true" />
                    <span>{item.dateLabel}</span>
                  </div>

                  <div className={responseStyles.bottom}>
                    <div className={responseStyles.actions}>
                      {item.status !== "Отменено" && item.status !== "Отклонено" ? (
                        <Link
                          href="/messages"
                          className={`${responseStyles.chatBtn} ${styles.previewChatBtn}`}
                          onClick={(event) => event.stopPropagation()}
                        >
                          Чат
                        </Link>
                      ) : null}
                      {item.status === "На рассмотрении" ? (
                        <Link
                          href={`/volunteer/responses?response=${item.id}`}
                          className={`${responseStyles.secondaryBtn} ${styles.previewSecondaryBtn}`}
                          onClick={(event) => event.stopPropagation()}
                        >
                          Отменить отклик
                        </Link>
                      ) : null}
                      {item.status === "В работе" ? (
                        <Link
                          href={`/volunteer/responses?response=${item.id}`}
                          className={`${responseStyles.secondaryBtn} ${styles.previewSecondaryBtn}`}
                          onClick={(event) => event.stopPropagation()}
                        >
                          Отправить отчет
                        </Link>
                      ) : null}
                    </div>
                    <span
                      className={`${responseStyles.status} ${responseStyles[statusClassMap[item.status]]} ${styles.previewStatus}`}
                    >
                      {item.status}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionTop}>
            <h2>Мои анкеты</h2>
            <Link href="/profile/applications" className={styles.viewAll}>
              Смотреть все
            </Link>
          </div>

          {adoptionLoadError ? <p className={styles.responsesPreviewEmpty}>{adoptionLoadError}</p> : null}
          {adoptionLoading ? <p className={styles.responsesPreviewEmpty}>Загрузка…</p> : null}

          {!adoptionLoading && adoptionApplications.length === 0 && !adoptionLoadError ? (
            <p className={styles.responsesPreviewEmpty}>Пока нет заявок на пристройство.</p>
          ) : null}

          {!adoptionLoading && adoptionApplications.length > 0 ? (
            <div className={profileFormsStyles.formsList}>
              {adoptionApplications.slice(0, 3).map((form) => (
                <article className={profileFormsStyles.formCard} key={form.id}>
                  <img
                    src={meApplicationsApi.getImageUrl(form.primary_photo_url)}
                    alt={form.animal_name}
                    className={profileFormsStyles.formImage}
                  />
                  <div className={profileFormsStyles.formContent}>
                    <div className={profileFormsStyles.formBody}>
                      <div className={profileFormsStyles.formTitleRow}>
                        <h3>{form.animal_name}</h3>
                        <div className={profileFormsStyles.menuWrap} data-volunteer-adoption-menu="true">
                          <button
                            type="button"
                            className={profileFormsStyles.menuBtn}
                            aria-label="Действия с анкетой"
                            aria-expanded={adoptionOpenedMenuId === form.id}
                            onClick={() => setAdoptionOpenedMenuId((prev) => (prev === form.id ? null : form.id))}
                          >
                            ⋮
                          </button>
                          {adoptionOpenedMenuId === form.id ? (
                            <div className={profileFormsStyles.menuDropdown}>
                              <Link
                                href={`/catalog/animals/${form.animal_id}`}
                                className={profileFormsStyles.menuLink}
                                onClick={() => setAdoptionOpenedMenuId(null)}
                              >
                                Подробнее
                              </Link>
                              <button
                                type="button"
                                className={profileFormsStyles.menuDelete}
                                disabled={adoptionDeleteBusyId === form.id}
                                onClick={() => {
                                  setAdoptionDeleteBusyId(form.id);
                                  void meApplicationsApi
                                    .delete(form.id)
                                    .then(() => reloadAdoptionApplications())
                                    .finally(() => {
                                      setAdoptionDeleteBusyId(null);
                                      setAdoptionOpenedMenuId(null);
                                    });
                                }}
                              >
                                Удалить анкету
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className={profileFormsStyles.tags}>
                        <span>{form.species_label}</span>
                        <span>{form.breed ?? "—"}</span>
                        <span>{form.age_label}</span>
                      </div>
                      <div className={profileFormsStyles.formBottomRow}>
                        <div className={profileFormsStyles.orgAddress}>
                          <img src="/org.svg" alt="" aria-hidden="true" className={profileFormsStyles.orgIcon} />
                          <p className={profileFormsStyles.orgName}>{form.organization_name ?? "Организация не указана"}</p>
                        </div>
                        <span className={profileFormsStyles.status}>{form.status_label}</span>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </div>

      {isEditModalOpen ? (
        <div className={styles.modalOverlay} onClick={handleCancelEdit}>
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="volunteer-edit-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="volunteer-edit-modal-title" className={styles.modalTitle}>
              Редактирование профиля
            </h2>
            <div className={styles.modalFormInner}>
              <div className={styles.editAvatarBlock}>
                <div className={styles.editAvatarPreview}>
                  <img src={avatarUrl ?? DEFAULT_AVATAR_SRC} alt="" />
                </div>
                <div className={styles.editAvatarActions}>
                  <input
                    ref={editModalAvatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className={styles.avatarFileInput}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      void handleAvatarFileSelect(f);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    className={styles.editAvatarBtn}
                    disabled={avatarUploading}
                    onClick={() => editModalAvatarInputRef.current?.click()}
                  >
                    {avatarUploading
                      ? "Загрузка…"
                      : avatarUrl
                        ? "Изменить фото"
                        : "Добавить фото"}
                  </button>
                  <p className={styles.editAvatarHint}>JPG, PNG или WebP</p>
                  {avatarUploadError ? (
                    <p role="alert" className={styles.editAvatarError}>
                      {avatarUploadError}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className={styles.detailsFormColumns}>
                <div>
                  <fieldset className={styles.radioFieldset}>
                    <legend className={styles.fieldLabel}>Предпочтительный формат помощи</legend>
                    <div className={styles.radioList}>
                      {HELP_FREQUENCY_OPTIONS.map((option) => (
                        <label className={styles.optionLabel} key={option}>
                          <input
                            type="radio"
                            name="help-frequency"
                            checked={details.helpFrequency === option}
                            onChange={() => setDetails((p) => ({ ...p, helpFrequency: option }))}
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>О себе</span>
                    <textarea
                      value={details.aboutMe}
                      onChange={handleDetailsFieldChange("aboutMe")}
                      placeholder="Опыт, интересы, с чем готов помогать животным"
                      rows={5}
                      className={styles.aboutTextarea}
                    />
                  </label>

                  <fieldset className={styles.radioFieldset}>
                    <legend className={styles.fieldLabel}>С кем готов работать</legend>
                    <div className={styles.radioList}>
                      {VOLUNTEER_ANIMAL_KIND_OPTIONS.map((kind) => (
                        <label className={styles.optionLabel} key={kind}>
                          <input
                            type="checkbox"
                            checked={details.animalKinds.includes(kind)}
                            onChange={() => toggleAnimalKind(kind)}
                          />
                          <span>{kind}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Компетенции</span>
                    <div className={styles.optionGridSingle}>
                      {competencyOptions.map((option) => (
                        <label className={styles.optionLabel} key={option}>
                          <input
                            type="checkbox"
                            checked={details.competencies.includes(option)}
                            onChange={() => toggleMultiValue("competencies", option)}
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                    {details.competencies.includes("Другое") && (
                      <input
                        value={details.competenciesOther}
                        onChange={handleDetailsFieldChange("competenciesOther")}
                        placeholder="Укажите свой вариант"
                      />
                    )}
                  </label>
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Чем могу помочь</span>
                    <div className={styles.optionGrid}>
                      {helpFormatOptions.map((option) => (
                        <label className={styles.optionLabel} key={option}>
                          <input
                            type="checkbox"
                            checked={details.helpFormats.includes(option)}
                            onChange={() => toggleMultiValue("helpFormats", option)}
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                    {details.helpFormats.includes("Другое") && (
                      <input
                        value={details.helpFormatsOther}
                        onChange={handleDetailsFieldChange("helpFormatsOther")}
                        placeholder="Укажите свой вариант"
                      />
                    )}
                  </label>

                </div>

                <div>
                  <div className={styles.field}>
                    <span className={styles.fieldLabel}>Доступность</span>
                    <div className={styles.availabilityDayListWrap}>
                      <ul className={styles.availabilityDayList}>
                        {WEEKDAY_KEYS.map((day) => {
                          const range = details.availabilityDayRanges[day];
                          const disabled = details.availabilityAroundClock;
                          return (
                            <li key={day} className={styles.availabilityDayRow}>
                              <span className={styles.availabilityDayName}>{WEEKDAY_EDIT_LABELS[day]}</span>
                              <div className={styles.availabilityTimePair}>
                                <input
                                  type="time"
                                  className={styles.availabilityTimeInput}
                                  value={range.from}
                                  disabled={disabled}
                                  onChange={(event) => setDayTimeRange(day, "from", event.target.value)}
                                  aria-label={`${WEEKDAY_EDIT_LABELS[day]}, с`}
                                />
                                <span className={styles.availabilityTimeDash} aria-hidden>
                                  –
                                </span>
                                <input
                                  type="time"
                                  className={styles.availabilityTimeInput}
                                  value={range.to}
                                  disabled={disabled}
                                  onChange={(event) => setDayTimeRange(day, "to", event.target.value)}
                                  aria-label={`${WEEKDAY_EDIT_LABELS[day]}, до`}
                                />
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                    <label className={`${styles.optionLabel} ${styles.availabilityAroundClockRow}`}>
                      <input
                        type="checkbox"
                        checked={details.availabilityAroundClock}
                        onChange={() =>
                          setDetails((prev) => ({
                            ...prev,
                            availabilityAroundClock: !prev.availabilityAroundClock,
                          }))
                        }
                      />
                      <span>Круглосуточно</span>
                    </label>
                    <label className={`${styles.optionLabel} ${styles.travelOutOfTownRow}`}>
                      <input
                        type="checkbox"
                        checked={details.travelOutOfTown}
                        onChange={() =>
                          setDetails((prev) => ({
                            ...prev,
                            travelOutOfTown: !prev.travelOutOfTown,
                          }))
                        }
                      />
                      <span>Готов выезжать за город</span>
                    </label>
                  </div>

                  <label className={`${styles.optionLabel} ${styles.nightOutingRow}`}>
                    <input
                      type="checkbox"
                      checked={details.nightOutings}
                      onChange={() =>
                        setDetails((p) => ({
                          ...p,
                          nightOutings: !p.nightOutings,
                        }))
                      }
                    />
                    <span>Готов к срочным ночным выездам</span>
                  </label>

                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Опыт</span>
                    <select
                      value={details.experience}
                      onChange={(event) =>
                        setDetails((prev) => ({
                          ...prev,
                          experience: event.target.value,
                        }))
                      }
                      className={styles.selectField}
                    >
                      <option value="">Выберите уровень</option>
                      {experienceOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Локация</span>
                    <input
                      value={details.location}
                      onChange={handleDetailsFieldChange("location")}
                      placeholder="Город / район"
                    />
                  </label>

                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Радиус выезда</span>
                    <input
                      value={details.travelRadius}
                      onChange={handleDetailsFieldChange("travelRadius")}
                      placeholder="До 10 км / по всему городу"
                    />
                  </label>


                </div>
              </div>

              {saveError ? (
                <p role="alert" style={{ marginBottom: "0.75rem", color: "#b3261e", fontSize: "0.9rem" }}>
                  {saveError}
                </p>
              ) : null}
              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.modalPrimaryButton}
                  disabled={isSaving}
                  onClick={() => void handleDetailsSave()}
                >
                  {isSaving ? "Сохранение…" : "Сохранить"}
                </button>
                <button
                  type="button"
                  className={styles.modalSecondaryButton}
                  disabled={isSaving}
                  onClick={handleCancelEdit}
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function formatDateRuShort(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("ru-RU", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function mapVolunteerCardToPreview(item: VolunteerResponseCardDto): ResponseCard | null {
  if (!item || typeof item !== "object") return null;
  const id = Number(item.id);
  if (!Number.isFinite(id)) return null;

  type RStatus = ResponseCard["status"];
  const mapSt = (raw: string, lb?: string | null): RStatus =>
    mapVolunteerResponseStatus(raw, lb) as RStatus;

  const organizationName = item.organization_name?.trim() || "Организация";
  const orgId = typeof item.organization_id === "number" ? item.organization_id : null;
  const organizationHref = orgId ? `/catalog/organizations/${orgId}` : "/catalog/organizations";

  return {
    id,
    helpType: item.help_type_label?.trim() || item.help_type || "Отклик",
    organization: organizationName,
    organizationHref,
    title: item.title?.trim() || "Отклик",
    descriptionSnippet: item.description_snippet?.trim() || "",
    descriptionFull: null,
    dateLabel: item.created_at ? formatDateRuShort(item.created_at) : "",
    createdAt: item.created_at ?? null,
    status: mapSt(String(item.status ?? ""), item.status_label),
    urgent: Boolean(item.is_urgent),
  };
}
