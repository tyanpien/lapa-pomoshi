"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

type TaskFilter = "all" | "shelter" | "photo" | "walkcare" | "transport" | "nearby" | "new";

type VolunteerTask = {
  id: number;
  type: Exclude<TaskFilter, "all" | "nearby" | "new">;
  title: string;
  organization: string;
  description: string;
  dateLabel: string;
  distance: string;
  latOffset: number;
  lonOffset: number;
  urgent?: boolean;
  applied?: boolean;
};

const filters: { id: TaskFilter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "shelter", label: "Помощь в приюте" },
  { id: "photo", label: "Фото / Видео" },
  { id: "walkcare", label: "Выгул / Уход" },
  { id: "new", label: "Новые" },
  { id: "nearby", label: "Рядом" },
  { id: "transport", label: "Перевозка" },
];

const tasksMock: VolunteerTask[] = [
  {
    id: 1,
    type: "transport",
    title: "Перевозка",
    organization: "Фонд «Верный друг»",
    description:
      "Срочно нужна перевозка кота Василия в ветклинику на ул. Малышева. Требуется аккуратная транспортировка после операции. Самостоятельно доставить животное нет возможности, поэтому ищем волонтера с машиной. Муся спокойная, находится в переноске.",
    dateLabel: "Сегодня, 17:00",
    distance: "2.5 км",
    latOffset: 0.014,
    lonOffset: 0.008,
    urgent: true,
  },
  {
    id: 2,
    type: "transport",
    title: "Перевозка",
    organization: "Фонд «Верный друг»",
    description:
      "Кошке Мусе требуется поездка в ветеринарную клинику на операцию.\nСамостоятельно доставить животное нет возможности, поэтому ищем волонтера с машиной.\nМуся спокойная, находится в переноске.\nМаршрут:\nОткуда: Передержка, ул. Ленина, 10\nКуда: Ветклиника \"Айболит\", ул. Мира, 25\nЧто нужно сделать: забрать животное с передержки -> аккуратно перевезти в клинику -> передать сотрудникам\nДополнительно: переноска предоставляется.",
    dateLabel: "15 мая, 17:00",
    distance: "3 км",
    latOffset: -0.012,
    lonOffset: 0.017,
    applied: true,
  },
  {
    id: 3,
    type: "shelter",
    title: "Помощь в приюте",
    organization: "Приют «Хвостики»",
    description: "Нужно помочь с уборкой и кормлением подопечных в вечернюю смену.",
    dateLabel: "Завтра, 11:00",
    distance: "1.4 км",
    latOffset: -0.01,
    lonOffset: -0.018,
  },
  {
    id: 4,
    type: "photo",
    title: "Фото / Видео",
    organization: "Центр «Добрые лапы»",
    description: "Сделать 10-12 фото для карточек животных и короткое видео для соцсетей.",
    dateLabel: "6 мая, 14:00",
    distance: "4.1 км",
    latOffset: 0.016,
    lonOffset: -0.01,
  },
  {
    id: 5,
    type: "walkcare",
    title: "Выгул / Уход",
    organization: "Приют «Лапа»",
    description: "Нужна помощь с выгулом двух собак и уходом за вольером в утреннюю смену.",
    dateLabel: "Сегодня, 09:30",
    distance: "1.2 км",
    latOffset: 0.004,
    lonOffset: -0.006,
  },
];

const pinColorByType: Record<VolunteerTask["type"], string> = {
  shelter: "#6F8A6E",
  photo: "#7F6D9A",
  walkcare: "#4E7A9A",
  transport: "#8B5A3C",
};

type LocatedTask = VolunteerTask & { lat: number; lon: number };
type StoredResponse = {
  id: number;
  sourceTaskId: number;
  helpType: string;
  organization: string;
  organizationHref: string;
  title: string;
  description: string;
  dateLabel: string;
  status: "На рассмотрении";
  urgent?: boolean;
};

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
const responsesStorageKey = "volunteer.responses.v1";

const helpTypeLabelByTaskType: Record<VolunteerTask["type"], string> = {
  shelter: "Помощь в приюте",
  photo: "Фото / Видео",
  walkcare: "Выгул / Уход",
  transport: "Перевозка",
};

export default function VolunteerTasksPage() {
  const router = useRouter();
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<YMapInstance | null>(null);
  const placemarkRef = useRef<Record<number, YGeoObject>>({});
  const cardsRef = useRef<Record<number, HTMLElement | null>>({});
  const nextResponseIdRef = useRef(10_000);

  const [scriptReady, setScriptReady] = useState(false);
  const [userCenter] = useState<[number, number]>(yekaterinburgCenter);
  const [bounds, setBounds] = useState<YMapBounds | null>(null);
  const [activeFilter, setActiveFilter] = useState<TaskFilter>("all");
  const [search, setSearch] = useState("");
  const [hoveredTaskId, setHoveredTaskId] = useState<number | null>(null);
  const [activePinId, setActivePinId] = useState<number | null>(null);
  const [appliedTaskIds, setAppliedTaskIds] = useState<number[]>([]);
  const [expandedTaskIds, setExpandedTaskIds] = useState<number[]>([]);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = localStorage.getItem(responsesStorageKey);
        if (!raw) {
          return;
        }
        const stored = JSON.parse(raw) as StoredResponse[];
        const ids = stored.map((item) => item.sourceTaskId);
        setAppliedTaskIds(ids);
      } catch {
        setAppliedTaskIds([]);
      }
    });
  }, []);

  const locatedTasks = useMemo<LocatedTask[]>(() => {
    return tasksMock.map((task) => ({
      ...task,
      lat: userCenter[0] + task.latOffset,
      lon: userCenter[1] + task.lonOffset,
    }));
  }, [userCenter]);

  const byFilter = useMemo<LocatedTask[]>(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const withSearch = locatedTasks.filter((task) => {
      if (!normalizedSearch) {
        return true;
      }
      return (
        task.title.toLowerCase().includes(normalizedSearch) ||
        task.organization.toLowerCase().includes(normalizedSearch) ||
        task.description.toLowerCase().includes(normalizedSearch)
      );
    });

    if (activeFilter === "all") {
      return withSearch;
    }
    if (activeFilter === "new") {
      return withSearch.filter((task) => !task.applied && !appliedTaskIds.includes(task.id));
    }
    if (activeFilter === "nearby") {
      return withSearch.filter((task) => parseFloat(task.distance.replace(",", ".")) <= 3);
    }
    return withSearch.filter((task) => task.type === activeFilter);
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
      const placemark = new ymaps.Placemark(
        [task.lat, task.lon],
        {
          hintContent: task.title,
          balloonContent: `<strong>${task.title}</strong><br/>${task.organization}`,
        },
        {
          preset: highlightedPreset(task.id, hoveredTaskId, activePinId),
          iconColor: pinColorByType[task.type],
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
    return byFilter.filter(
      (task) => task.lat >= south && task.lat <= north && task.lon >= west && task.lon <= east
    );
  }, [bounds, byFilter]);

  const handleApply = (task: LocatedTask) => {
    if (appliedTaskIds.includes(task.id)) {
      router.push("/volunteer/responses");
      return;
    }

    const response: StoredResponse = {
      id: ++nextResponseIdRef.current,
      sourceTaskId: task.id,
      helpType: helpTypeLabelByTaskType[task.type],
      organization: task.organization,
      organizationHref: "/catalog/organizations/1",
      title: task.title,
      description: task.description,
      dateLabel: task.dateLabel,
      status: "На рассмотрении",
      urgent: task.urgent,
    };

    try {
      const raw = localStorage.getItem(responsesStorageKey);
      const stored = raw ? (JSON.parse(raw) as StoredResponse[]) : [];
      const next = [response, ...stored];
      localStorage.setItem(responsesStorageKey, JSON.stringify(next));
      setAppliedTaskIds((prev) => [...prev, task.id]);
    } catch {
    }

    router.push("/volunteer/responses");
  };

  const toggleDescription = (taskId: number) => {
    setExpandedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

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
                  <span className={styles.org}>{task.organization}</span>
                  {task.urgent ? <span className={styles.urgent}>срочно</span> : null}
                </div>
                <h2>{task.title}</h2>
                <p
                  className={`${styles.description} ${
                    task.description.length > 100 && !expandedTaskIds.includes(task.id) ? styles.descriptionCollapsed : ""
                  }`}
                >
                  {task.description}
                </p>
                {task.description.length > 100 ? (
                  <button
                    type="button"
                    className={styles.moreBtn}
                    onClick={() => toggleDescription(task.id)}
                  >
                    {expandedTaskIds.includes(task.id) ? "Меньше" : "Подробнее"}
                  </button>
                ) : null}
                <div className={styles.cardBottom}>
                  <div className={styles.time}>
                    <img src="/clock.svg" alt="" aria-hidden="true" />
                    <span>{task.dateLabel}</span>
                  </div>
                  <span className={styles.distance}>{task.distance}</span>
                </div>
                <button
                  type="button"
                  className={`${styles.actionBtn} ${
                    task.applied || appliedTaskIds.includes(task.id) ? styles.actionBtnMuted : ""
                  }`}
                  onClick={() => handleApply(task)}
                >
                  {task.applied || appliedTaskIds.includes(task.id) ? "Вы откликнулись" : "Откликнуться"}
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
