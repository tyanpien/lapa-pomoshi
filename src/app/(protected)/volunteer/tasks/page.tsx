"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";
import { urgentApi, type UrgentItem } from "@/shared/api/endpoints/urgent";
import { normalizeUrgentFeedItems } from "@/shared/lib/urgentFeedNormalize";
import { getUrgentHelpTypeLabel } from "@/shared/lib/urgentHelpTypeLabels";
import { meVolunteerResponsesApi } from "@/shared/api/endpoints/meVolunteerResponses";

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
  const ht = (task.help_type ?? "").trim().toLowerCase();

  if (ht === "auto" || /перевоз|транспорт|машин|авто|довезти|подвезти|перевезти|ветклиник|вет\.?\s*клиник/i.test(blob)) {
    return "transport";
  }

  if (ht === "manual") {
    const photoHit = /фото|видео|съём|съемк|сним|камер|видеосъём|видеосъемк|контент|соцсет|instagram|tiktok/i.test(blob);
    if (photoHit) return "photo";

    const walkHit = /выгул|прогул|гулять|выгулять|погулять|выгулить|выводить\s+гулять/i.test(blob);
    if (walkHit) return "walkcare";

    const shelterHit =
      /приют|уборк|смен[аыу]|вольер|санитар|подопечн|животн|кормлен|накорми|передерж|содержани|территори|хвост/i.test(blob);
    if (shelterHit) return "shelter";
  }

  if (ht === "foster") {
    return "shelter";
  }

  return "other";
}

type LocatedTask = UrgentItem & { lat: number; lon: number };

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
  getBounds: () => YMapBounds | null;
  panTo: (coords: [number, number], options?: { duration?: number }) => void;
  events: { add: (name: string, handler: () => void) => void };
};

type YMapsApi = {
  ready: (cb: () => void) => void;
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

const yekaterinburgCenter: [number, number] = [56.838926, 60.605703];
const yandexApiKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY;

function pseudoOffsetForId(id: number): [number, number] {
  const nx = (((id * 7919) % 1001) / 1001 - 0.5) * 0.12;
  const ny = (((id * 4177) % 1001) / 1001 - 0.5) * 0.12;
  return [nx, ny];
}

function locateTasks(items: UrgentItem[], center: [number, number]): LocatedTask[] {
  return items.map((item) => {
    const [dx, dy] = pseudoOffsetForId(item.id);
    return {
      ...item,
      lat: center[0] + dx,
      lon: center[1] + dy,
    };
  });
}

export default function VolunteerTasksPage() {
  const router = useRouter();
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<YMapInstance | null>(null);
  const placemarkRef = useRef<Record<number, YGeoObject>>({});
  const cardsRef = useRef<Record<number, HTMLElement | null>>({});

  const [scriptReady, setScriptReady] = useState(false);
  const [userCenter] = useState<[number, number]>(yekaterinburgCenter);
  const [bounds, setBounds] = useState<YMapBounds | null>(null);
  const [activeFilter, setActiveFilter] = useState<TaskFilter>("all");
  const [search, setSearch] = useState("");
  const [hoveredTaskId, setHoveredTaskId] = useState<number | null>(null);
  const [activePinId, setActivePinId] = useState<number | null>(null);
  const [appliedTaskIds, setAppliedTaskIds] = useState<number[]>([]);
  const [expandedTaskIds, setExpandedTaskIds] = useState<number[]>([]);
  const [tasks, setTasks] = useState<UrgentItem[]>([]);
  const [tasksError, setTasksError] = useState("");
  const [tasksLoading, setTasksLoading] = useState(true);
  const [applyBusyId, setApplyBusyId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTasksLoading(true);
    Promise.all([
      urgentApi.getList({ limit: 100 }),
      meVolunteerResponsesApi.getList({ tab: "all", limit: 100, offset: 0 }).catch(() => ({ total: 0, items: [] })),
    ])
      .then(([urgent, responses]) => {
        if (cancelled) return;
        const rows = normalizeUrgentFeedItems(urgent.items ?? []);
        const filtered = rows.filter((r) => r.volunteer_needed && String(r.status).toLowerCase() !== "closed");
        setTasks(filtered);
        const helpIds = new Set<number>();
        for (const it of responses.items ?? []) {
          const hid = (it as { help_request_id?: number }).help_request_id;
          if (typeof hid === "number" && Number.isFinite(hid)) helpIds.add(hid);
        }
        setAppliedTaskIds(Array.from(helpIds));
        setTasksError("");
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
  }, []);

  const locatedTasks = useMemo<LocatedTask[]>(() => locateTasks(tasks, userCenter), [tasks, userCenter]);

  const byFilter = useMemo<LocatedTask[]>(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const withSearch = locatedTasks.filter((task) => {
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
      return withSearch.filter((task) => !appliedTaskIds.includes(task.id));
    }
    if (activeFilter === "nearby") {
      return withSearch.filter((task) => {
        const [dx, dy] = pseudoOffsetForId(task.id);
        return Math.hypot(dx, dy) <= 0.06;
      });
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
  }, [activeFilter, locatedTasks, search, appliedTaskIds]);

  useEffect(() => {
    const ymaps = window.ymaps;
    if (!scriptReady || !ymaps || !mapNodeRef.current || mapRef.current) {
      return;
    }

    ymaps.ready(() => {
      if (!mapNodeRef.current || mapRef.current) {
        return;
      }

      mapRef.current = new ymaps.Map(
        mapNodeRef.current,
        {
          center: userCenter,
          zoom: 12,
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
    if (!mapRef.current || !window.ymaps) {
      return;
    }

    mapRef.current.setCenter(userCenter, 12, { duration: 300 });
  }, [userCenter]);

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

    const userPlacemark = new ymaps.Placemark(
      userCenter,
      { hintContent: "Вы здесь" },
      { preset: "islands#darkBlueCircleDotIcon" }
    );
    map.geoObjects.add(userPlacemark);
  }, [activePinId, byFilter, hoveredTaskId, userCenter]);

  const visibleTasks = useMemo(() => {
    if (!bounds) {
      return byFilter;
    }

    const [[south, west], [north, east]] = bounds;
    return byFilter.filter((task) => task.lat >= south && task.lat <= north && task.lon >= west && task.lon <= east);
  }, [bounds, byFilter]);

  const handleApply = useCallback(
    (task: LocatedTask) => {
      if (appliedTaskIds.includes(task.id)) {
        router.push("/volunteer/responses");
        return;
      }
      setApplyBusyId(task.id);
      void meVolunteerResponsesApi
        .create({ help_request_id: task.id, message: null })
        .then(() => {
          setAppliedTaskIds((prev) => (prev.includes(task.id) ? prev : [...prev, task.id]));
          router.push(`/volunteer/responses?response=${task.id}`);
        })
        .catch(() => {
          setTasksError("Не удалось отправить отклик. Проверьте авторизацию и права волонтёра.");
        })
        .finally(() => setApplyBusyId(null));
    },
    [appliedTaskIds, router]
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

        <section className={styles.layout}>
          <aside className={styles.cardsColumn}>
            {visibleTasks.map((task) => (
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
                    appliedTaskIds.includes(task.id) ? styles.actionBtnMuted : ""
                  }`}
                  disabled={applyBusyId === task.id}
                  onClick={() => handleApply(task)}
                >
                  {applyBusyId === task.id
                    ? "Отправка…"
                    : appliedTaskIds.includes(task.id)
                      ? "Вы откликнулись"
                      : "Откликнуться"}
                </button>
              </article>
            ))}
          </aside>

          <div className={styles.mapPanel}>
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
