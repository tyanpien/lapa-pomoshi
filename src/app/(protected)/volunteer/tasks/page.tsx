"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@/shared/lib/hooks/useUser";
import Script from "next/script";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";
import { fetchVolunteerTaskFeedAllPages, type VolunteerTaskFeedItem } from "@/shared/api/endpoints/meVolunteerTaskFeed";
import { type UrgentItem } from "@/shared/api/endpoints/urgent";
import { getUrgentHelpTypeLabel } from "@/shared/lib/urgentHelpTypeLabels";
import { meVolunteerResponsesApi } from "@/shared/api/endpoints/meVolunteerResponses";
import { meProfileApi, type MeVolunteerProfileOut } from "@/shared/api/endpoints/meProfile";
import { collectTaskCompetencySlugs } from "@/shared/lib/volunteerTaskFeed";
import { resolveVolunteerTaskTypeSlug } from "@/shared/lib/volunteerCompetencyCatalog";
import {
  indexResponsesByHelpRequestId,
  mapVolunteerResponseStatus,
  type VolunteerHelpRequestResponseRef,
} from "@/shared/lib/volunteerResponseStatus";
import {
  locateVolunteerTasksOnMap,
  resolveVolunteerMapCenter,
  volunteerProfileNeedsCitySync,
  volunteerProfileNeedsCoordsSync,
  type MapCoords,
} from "@/shared/lib/volunteerLocation";
import {
  citiesMatchForVolunteer,
  resolveVolunteerCityForMatching,
} from "@/shared/lib/volunteerCityMatch";
import {
  notifyVolunteerProfileUpdated,
  readVolunteerDetailsFromStorage,
  readVolunteerProfileVersion,
  volunteerProfileStorageIdentity,
  VOLUNTEER_PROFILE_UPDATED_EVENT,
} from "@/shared/lib/volunteerProfileStorage";
import { TaskKnowledgeTips } from "@/features/volunteer-task-tips/TaskKnowledgeTips";

type TaskFilter = "all" | "shelter" | "photo" | "walkcare" | "new" | "nearby" | "transport";

const filters: { id: TaskFilter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "shelter", label: "Помощь в приюте" },
  { id: "photo", label: "Фото / Видео" },
  { id: "walkcare", label: "Выгул / Уход" },
  { id: "new", label: "Новые" },
  { id: "nearby", label: "Рядом" },
  { id: "transport", label: "Перевозка" },
];

type TaskLane = "transport" | "photo" | "walkcare" | "shelter" | "other";

const pinColorByLane: Record<TaskLane, string> = {
  transport: "#8B5A3C",
  photo: "#7F6D9A",
  walkcare: "#4E7A9A",
  shelter: "#6F8A6E",
  other: "#757575",
};

function deriveTaskLane(task: UrgentItem): TaskLane {
  const blob = `${task.title ?? ""} ${task.description ?? ""}`.toLowerCase();
  const primarySlug = resolveVolunteerTaskTypeSlug(
    task.help_type,
    (task as { volunteer_competencies?: string[] }).volunteer_competencies,
  );
  const slugs = new Set(collectTaskCompetencySlugs(task));

  if (
    primarySlug === "auto" ||
    slugs.has("auto") ||
    /перевоз|транспорт|машин|авто|довезти|подвезти|перевезти|ветклиник|вет\.?\s*клиник/i.test(blob)
  ) {
    return "transport";
  }

  if (primarySlug === "photo_video" || slugs.has("photo_video")) return "photo";
  if (primarySlug === "walk" || slugs.has("walk")) return "walkcare";
  if (
    primarySlug === "manual" ||
    primarySlug === "foster" ||
    slugs.has("manual") ||
    slugs.has("foster")
  ) {
    return "shelter";
  }

  const ht = (task.help_type ?? "").trim().toLowerCase();
  if (ht === "manual") {
    const photoHit = /фото|видео|съём|съемк|сним|камер|видеосъём|видеосъемк|контент|соцсет|instagram|tiktok/i.test(blob);
    if (photoHit) return "photo";
    const walkHit = /выгул|прогул|гулять|выгулять|погулять|выгулить|выводить\s+гулять/i.test(blob);
    if (walkHit) return "walkcare";
    const shelterHit =
      /приют|уборк|смен[аыу]|вольер|санитар|подопечн|животн|кормлен|накорми|передерж|содержани|территори|хвост/i.test(blob);
    if (shelterHit) return "shelter";
  }
  if (ht === "foster") return "shelter";

  return "other";
}

type LocatedTask = VolunteerTaskFeedItem & { lat: number; lon: number; address?: string | null };

type YMapBounds = [[number, number], [number, number]];

type YGeoObject = {
  geometry: { getCoordinates: () => [number, number] };
  balloon: { open: () => void };
  events: { add: (name: string, handler: () => void) => void };
};

type YGeoObjectCollection = {
  removeAll: () => void;
  add: (obj: YGeoObject) => void;
};

type YMapInstance = {
  geoObjects: YGeoObjectCollection;
  setCenter: (center: [number, number], zoom: number, options?: { duration?: number }) => void;
  setBounds: (
    bounds: YMapBounds,
    options?: { checkZoomRange?: boolean; zoomMargin?: number; duration?: number },
  ) => void;
  getBounds: () => YMapBounds | null;
  panTo: (coords: [number, number], options?: { duration?: number }) => void;
  events: { add: (name: string, handler: () => void) => void };
};

type YMapsApi = {
  ready: (cb: () => void) => void;
  util: {
    bounds: {
      fromPoints: (points: [number, number][]) => YMapBounds;
    };
  };
  Map: new (
    node: HTMLElement,
    config: { center: [number, number]; zoom: number; controls?: string[] },
    options?: { suppressMapOpenBlock?: boolean }
  ) => YMapInstance;
  Placemark: new (
    coords: [number, number],
    props?: { hintContent?: string; balloonContent?: string },
    options?: { preset?: string; iconColor?: string }
  ) => YGeoObject;
};

declare global {
  interface Window {
    ymaps?: YMapsApi;
  }
}

const yandexApiKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY?.trim() ?? "";

function distanceKm(from: MapCoords, lat: number, lon: number): number {
  const dLat = (lat - from[0]) * 111.32;
  const dLon = (lon - from[1]) * 111.32 * Math.cos((from[0] * Math.PI) / 180);
  return Math.hypot(dLat, dLon);
}

function fitMapToPoints(map: YMapInstance, ymaps: YMapsApi, points: [number, number][]) {
  if (points.length === 0) return;
  if (points.length === 1) {
    map.setCenter(points[0], 12, { duration: 200 });
    return;
  }
  map.setBounds(ymaps.util.bounds.fromPoints(points), {
    checkZoomRange: true,
    zoomMargin: 48,
    duration: 200,
  });
}

export default function VolunteerTasksPage() {
  const router = useRouter();
  const { userEmail, userName } = useUser();
  const profileIdentity = useMemo(
    () => volunteerProfileStorageIdentity(userEmail, userName),
    [userEmail, userName],
  );
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<YMapInstance | null>(null);
  const placemarkRef = useRef<Record<number, YGeoObject>>({});
  const cardsRef = useRef<Record<number, HTMLElement | null>>({});

  const [scriptReady, setScriptReady] = useState(false);
  const [userCenter, setUserCenter] = useState<[number, number] | null>(null);
  const [volunteerCity, setVolunteerCity] = useState<string | null>(null);
  const [mapLocationHint, setMapLocationHint] = useState<string | null>(null);
  const [bounds, setBounds] = useState<YMapBounds | null>(null);
  const [activeFilter, setActiveFilter] = useState<TaskFilter>("all");
  const [search, setSearch] = useState("");
  const [hoveredTaskId, setHoveredTaskId] = useState<number | null>(null);
  const [activePinId, setActivePinId] = useState<number | null>(null);
  const [responseByHelpRequestId, setResponseByHelpRequestId] = useState<
    Record<number, VolunteerHelpRequestResponseRef>
  >({});
  const [expandedTaskIds, setExpandedTaskIds] = useState<number[]>([]);
  const [tasks, setTasks] = useState<VolunteerTaskFeedItem[]>([]);
  const [locatedTasks, setLocatedTasks] = useState<LocatedTask[]>([]);
  const [tasksGeocoding, setTasksGeocoding] = useState(false);
  const [tasksError, setTasksError] = useState("");
  const [tasksLoading, setTasksLoading] = useState(true);
  const [applyBusyId, setApplyBusyId] = useState<number | null>(null);
  const [profileReloadTick, setProfileReloadTick] = useState(0);
  const lastProfileVersionRef = useRef(readVolunteerProfileVersion());
  const volunteerProfileRef = useRef<MeVolunteerProfileOut | null>(null);

  const syncVolunteerLocationOnServer = useCallback(
    async (vp: MeVolunteerProfileOut, center: [number, number], locationQuery: string, usedStoredText: boolean) => {
      const storedLocation = readVolunteerDetailsFromStorage(profileIdentity).location.trim();
      const cityToSave = usedStoredText && storedLocation ? storedLocation : locationQuery;
      const needsCoords = volunteerProfileNeedsCoordsSync(vp, center);
      const needsCity = cityToSave ? volunteerProfileNeedsCitySync(vp, cityToSave) : false;
      if (!needsCoords && !needsCity) return;

      try {
        await meProfileApi.patch({
          volunteer: {
            latitude: center[0],
            longitude: center[1],
            ...(needsCity && cityToSave ? { location_city: cityToSave } : {}),
          },
        });
        notifyVolunteerProfileUpdated();
      } catch {
      }
    },
    [profileIdentity],
  );

  const resolveAndApplyMapCenter = useCallback(
    async (vp: MeVolunteerProfileOut | null) => {
      const storedLocation = readVolunteerDetailsFromStorage(profileIdentity).location;
      const { center, locationQuery, usedStoredText } = await resolveVolunteerMapCenter(vp, storedLocation);

      if (!center) {
        setMapLocationHint(
          locationQuery
            ? `Не удалось найти «${locationQuery}» на карте. Уточните город в профиле волонтёра.`
            : "Укажите город в профиле волонтёра (поле «Локация»), чтобы карта показывала ваш район.",
        );
        return;
      }

      setMapLocationHint(null);
      setUserCenter(center);
      if (vp) {
        await syncVolunteerLocationOnServer(vp, center, locationQuery, usedStoredText);
      }
    },
    [profileIdentity, syncVolunteerLocationOnServer],
  );

  useEffect(() => {
    const bump = () => {
      lastProfileVersionRef.current = readVolunteerProfileVersion();
      setProfileReloadTick((n) => n + 1);
    };
    window.addEventListener(VOLUNTEER_PROFILE_UPDATED_EVENT, bump);
    return () => window.removeEventListener(VOLUNTEER_PROFILE_UPDATED_EVENT, bump);
  }, []);

  useEffect(() => {
    const syncProfileVersion = () => {
      const version = readVolunteerProfileVersion();
      if (version > lastProfileVersionRef.current) {
        lastProfileVersionRef.current = version;
        setProfileReloadTick((n) => n + 1);
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") syncProfileVersion();
    };
    window.addEventListener("focus", syncProfileVersion);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", syncProfileVersion);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setTasksLoading(true);
    });
    Promise.all([
      meProfileApi.get().catch(() => null),
      meVolunteerResponsesApi.getList({ tab: "all", limit: 100, offset: 0 }).catch(() => ({ total: 0, items: [] })),
      fetchVolunteerTaskFeedAllPages().catch(() => ({
        total: 0,
        items: [] as VolunteerTaskFeedItem[],
        is_available: true,
        completed_tasks_count: 0,
        message: null,
      })),
    ])
      .then(async ([profile, responses, feed]) => {
        if (cancelled) return;
        const vp = profile?.volunteer_profile ?? null;
        volunteerProfileRef.current = vp;
        setVolunteerCity(
          resolveVolunteerCityForMatching(
            vp?.location_city,
            readVolunteerDetailsFromStorage(profileIdentity).location,
          ),
        );

        if (cancelled) return;
        const rows = (feed.items ?? []).filter((r, i, self) => self.findIndex((x) => x.id === r.id) === i);

        setTasks(rows);
        setResponseByHelpRequestId(indexResponsesByHelpRequestId(responses.items ?? []));
        if (!feed.is_available && feed.message) {
          setTasksError(feed.message);
        } else {
          setTasksError("");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTasks([]);
          setTasksError("Не удалось загрузить задачи.");
        }
      })
      .finally(() => {
        if (!cancelled) setTasksLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profileReloadTick]);

  useEffect(() => {
    if (!scriptReady) return;
    let cancelled = false;
    void resolveAndApplyMapCenter(volunteerProfileRef.current).then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [scriptReady, profileReloadTick, resolveAndApplyMapCenter]);

  useEffect(() => {
    const refreshResponses = () => {
      void meVolunteerResponsesApi
        .getList({ tab: "all", limit: 100, offset: 0 })
        .then((responses) => {
          setResponseByHelpRequestId(indexResponsesByHelpRequestId(responses.items ?? []));
        })
        .catch(() => {});
    };
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") refreshResponses();
    };
    const intervalId = window.setInterval(refreshIfVisible, 20_000);
    window.addEventListener("visibilitychange", refreshIfVisible);
    window.addEventListener("focus", refreshIfVisible);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("visibilitychange", refreshIfVisible);
      window.removeEventListener("focus", refreshIfVisible);
    };
  }, [profileReloadTick]);

  useEffect(() => {
    if (!tasks.length) {
      setLocatedTasks([]);
      return;
    }
    let cancelled = false;
    setTasksGeocoding(true);
    void locateVolunteerTasksOnMap(tasks, userCenter).then((rows) => {
      if (!cancelled) {
        setLocatedTasks(rows);
        setTasksGeocoding(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [tasks, userCenter]);

  const tasksInMyCity = useMemo(() => {
    if (!volunteerCity) return locatedTasks;
    return locatedTasks.filter((task) => citiesMatchForVolunteer(volunteerCity, task.city));
  }, [locatedTasks, volunteerCity]);

  const showNoTasksInCity =
    !tasksLoading &&
    !tasksGeocoding &&
    Boolean(volunteerCity) &&
    tasksInMyCity.length === 0 &&
    activeFilter === "all" &&
    !search.trim();

  const byFilter = useMemo<LocatedTask[]>(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const withSearch = tasksInMyCity.filter((task) => {
      if (!normalizedSearch) return true;
      const org = task.organization_name ?? "";
      return (
        task.title.toLowerCase().includes(normalizedSearch) ||
        org.toLowerCase().includes(normalizedSearch) ||
        task.description.toLowerCase().includes(normalizedSearch)
      );
    });

    if (activeFilter === "all") return withSearch;
    if (activeFilter === "new") {
      return withSearch.filter((task) => !responseByHelpRequestId[task.id]);
    }
    if (activeFilter === "nearby") {
      if (!userCenter) return withSearch;
      const radiusKm = volunteerProfileRef.current?.travel_radius_km ?? 25;
      return withSearch.filter((task) => distanceKm(userCenter, task.lat, task.lon) <= radiusKm);
    }
    if (activeFilter === "transport") {
      return withSearch.filter((task) => deriveTaskLane(task) === "transport");
    }
    if (activeFilter === "photo") {
      return withSearch.filter((task) => deriveTaskLane(task) === "photo");
    }
    if (activeFilter === "walkcare") {
      return withSearch.filter((task) => deriveTaskLane(task) === "walkcare");
    }
    if (activeFilter === "shelter") {
      return withSearch.filter((task) => deriveTaskLane(task) === "shelter");
    }
    return withSearch;
  }, [activeFilter, tasksInMyCity, search, responseByHelpRequestId, userCenter]);

  useEffect(() => {
    const ymaps = window.ymaps;
    if (!scriptReady || !userCenter || !ymaps || !mapNodeRef.current || mapRef.current) {
      return;
    }

    ymaps.ready(() => {
      if (!mapNodeRef.current || mapRef.current || !userCenter) {
        return;
      }

      mapRef.current = new ymaps.Map(
        mapNodeRef.current,
        {
          center: userCenter,
          zoom: 11,
          controls: ["zoomControl", "geolocationControl"],
        },
        {
          suppressMapOpenBlock: true,
        }
      );

      setBounds(mapRef.current.getBounds());

      mapRef.current.events.add("boundschange", () => {
        setBounds(mapRef.current?.getBounds() ?? null);
      });
    });
  }, [scriptReady, userCenter]);

  useEffect(() => {
    const map = mapRef.current;
    const ymaps = window.ymaps;
    if (!map || !ymaps) {
      return;
    }

    map.geoObjects.removeAll();
    placemarkRef.current = {};

    byFilter.forEach((task) => {
      const color = pinColorByLane[deriveTaskLane(task)];
      const placemark = new ymaps.Placemark(
        [task.lat, task.lon],
        {
          hintContent: task.title,
          balloonContent: `<strong>${task.title}</strong><br/>${task.organization_name}`,
        },
        {
          preset: highlightedPreset(task.id, hoveredTaskId, activePinId),
          iconColor: color,
        }
      );

      placemark.events.add("click", () => {
        setActivePinId(task.id);
        const card = cardsRef.current[task.id];
        card?.scrollIntoView({ behavior: "smooth", block: "start" });
      });

      placemarkRef.current[task.id] = placemark;
      map.geoObjects.add(placemark);
    });

    if (userCenter) {
      const userPlacemark = new ymaps.Placemark(
        userCenter,
        { hintContent: "Вы здесь" },
        { preset: "islands#darkBlueCircleDotIcon" },
      );
      map.geoObjects.add(userPlacemark);
    }
  }, [activePinId, byFilter, hoveredTaskId, userCenter]);

  const mapFitKey = useMemo(
    () =>
      `${userCenter?.[0] ?? ""},${userCenter?.[1] ?? ""}|${byFilter.map((t) => `${t.id}:${t.lat}:${t.lon}`).join(";")}`,
    [userCenter, byFilter],
  );

  useEffect(() => {
    const map = mapRef.current;
    const ymaps = window.ymaps;
    if (!map || !ymaps) return;

    const fitPoints: [number, number][] = [];
    if (userCenter) fitPoints.push(userCenter);
    byFilter.forEach((task) => fitPoints.push([task.lat, task.lon]));
    fitMapToPoints(map, ymaps, fitPoints);
  }, [mapFitKey, userCenter, byFilter]);

  const visibleTasks = useMemo(() => {
    if (!bounds) {
      return byFilter;
    }

    const [[south, west], [north, east]] = bounds;
    return byFilter.filter((task) => task.lat >= south && task.lat <= north && task.lon >= west && task.lon <= east);
  }, [bounds, byFilter]);

  const handleApply = useCallback(
    (task: LocatedTask) => {
      const existing = responseByHelpRequestId[task.id];
      if (existing) {
        router.push(`/volunteer/responses?response=${existing.responseId}`);
        return;
      }
      setApplyBusyId(task.id);
      void meVolunteerResponsesApi
        .create({ help_request_id: task.id, message: null })
        .then((created) => {
          setResponseByHelpRequestId((prev) => ({
            ...prev,
            [task.id]: {
              responseId: created.id,
              status: String(created.status ?? "pending"),
              statusUi: mapVolunteerResponseStatus(
                String(created.status ?? ""),
                created.status_label,
              ),
            },
          }));
          router.push(`/volunteer/responses?response=${created.id}`);
        })
        .catch(() => {
          setTasksError("Не удалось отправить отклик. Проверьте авторизацию и права волонтёра.");
        })
        .finally(() => setApplyBusyId(null));
    },
    [responseByHelpRequestId, router]
  );

  const taskActionLabel = useCallback(
    (taskId: number): string => {
      const ref = responseByHelpRequestId[taskId];
      if (!ref) return "Откликнуться";
      if (ref.statusUi === "В работе") return "В работе";
      if (ref.statusUi === "На рассмотрении") return "На рассмотрении";
      if (ref.statusUi === "Завершено") return "Завершено";
      if (ref.status === "completed") return "Завершено";
      if (ref.statusUi === "Отклонено") return "Отклонено";
      if (ref.statusUi === "Отменено") return "Отменено";
      return "Мой отклик";
    },
    [responseByHelpRequestId],
  );

  const toggleDescription = (taskId: number) => {
    setExpandedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const dateLabel = (task: UrgentItem) =>
    task.deadline_label?.trim() ||
    (task.deadline_at ? new Date(task.deadline_at).toLocaleString("ru-RU") : "Срок не указан");

  return (
    <main className={styles.page}>
      <Script
        src={`https://api-maps.yandex.ru/2.1/?lang=ru_RU${yandexApiKey ? `&apikey=${yandexApiKey}` : ""}`}
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />
      <div className={styles.container}>
        <div className={styles.filters}>
          <input
            className={styles.search}
            placeholder="Найти"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {filters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className={`${styles.filterBtn} ${activeFilter === filter.id ? styles.filterBtnActive : ""}`}
              onClick={() => setActiveFilter(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {tasksError ? <p>{tasksError}</p> : null}
        {tasksLoading ? <p>Загрузка задач…</p> : null}
        {!tasksLoading && tasksGeocoding ? <p className={styles.mapNotice}>Определяем адреса на карте…</p> : null}

        <section className={styles.layout}>
          <aside className={styles.cardsColumn}>
            {showNoTasksInCity ? (
              <p className={styles.emptyState}>В Вашем городе задач не найдено</p>
            ) : null}
            {byFilter.map((task) => (
              <article
                key={task.id}
                ref={(element) => {
                  cardsRef.current[task.id] = element;
                }}
                className={`${styles.card} ${
                  hoveredTaskId === task.id || activePinId === task.id ? styles.cardHighlighted : ""
                }`}
                onMouseEnter={() => setHoveredTaskId(task.id)}
                onMouseLeave={() => setHoveredTaskId(null)}
              >
                <div className={styles.cardTop}>
                  <span className={styles.org}>{task.organization_name}</span>
                  {task.is_urgent ? <span className={styles.urgent}>срочно</span> : null}
                </div>
                <h2>{task.title}</h2>
                <p style={{ margin: "0 0 6px", opacity: 0.75, fontSize: 13 }}>{getUrgentHelpTypeLabel(task.help_type)}</p>
                <p
                  className={`${styles.description} ${
                    task.description.length > 160 && !expandedTaskIds.includes(task.id) ? styles.descriptionCollapsed : ""
                  }`}
                >
                  {task.description}
                </p>
                {task.description.length > 160 ? (
                  <button type="button" className={styles.moreBtn} onClick={() => toggleDescription(task.id)}>
                    {expandedTaskIds.includes(task.id) ? "Меньше" : "Подробнее"}
                  </button>
                ) : null}
                <TaskKnowledgeTips task={task} />
                <div className={styles.cardBottom}>
                  <div className={styles.time}>
                    <img src="/clock.svg" alt="" aria-hidden="true" />
                    <span>{dateLabel(task)}</span>
                  </div>
                  <span className={styles.distance}>{task.city ?? "Город не указан"}</span>
                </div>
                <button
                  type="button"
                  className={`${styles.actionBtn} ${
                    responseByHelpRequestId[task.id] ? styles.actionBtnMuted : ""
                  } ${
                    responseByHelpRequestId[task.id]?.statusUi === "В работе"
                      ? styles.actionBtnInProgress
                      : ""
                  }`}
                  disabled={applyBusyId === task.id}
                  onClick={() => handleApply(task)}
                >
                  {applyBusyId === task.id ? "Отправка…" : taskActionLabel(task.id)}
                </button>
              </article>
            ))}
          </aside>

          <div className={styles.mapPanel}>
            {!yandexApiKey ? (
              <p className={styles.mapNotice}>
                Добавьте ключ <code>NEXT_PUBLIC_YANDEX_MAPS_API_KEY</code> в <code>.env.local</code> и перезапустите
                сайт.
              </p>
            ) : null}
            {!userCenter && scriptReady ? (
              <p className={styles.mapNotice}>Определяем ваш город на карте…</p>
            ) : null}
            {mapLocationHint ? <p className={styles.mapNotice}>{mapLocationHint}</p> : null}
            <div ref={mapNodeRef} className={styles.mapRoot} />
          </div>
        </section>
      </div>
    </main>
  );
}

function highlightedPreset(taskId: number, hoveredTaskId: number | null, activePinId: number | null) {
  if (taskId === hoveredTaskId || taskId === activePinId) {
    return "islands#redDotIcon";
  }
  return "islands#blueDotIcon";
}
