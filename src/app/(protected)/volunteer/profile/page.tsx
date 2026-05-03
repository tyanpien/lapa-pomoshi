"use client";

import Link from "next/link";
import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "@/shared/lib/hooks/useUser";
import { volunteersApi } from "@/shared/api/endpoints/volunteers";
import { eventsApi } from "@/shared/api/endpoints/events";
import {
  VOLUNTEER_PROFILE_UPDATED_EVENT,
  emptyVolunteerDetails,
  readVolunteerDetailsFromStorage,
  syncVolunteerCatalogUserId,
  writeVolunteerDetailsToStorage,
  VOLUNTEER_ANIMAL_KIND_OPTIONS,
  type StoredVolunteerDetails,
  type VolunteerAnimalKindTag,
  type VolunteerHelpFrequency,
} from "@/shared/lib/volunteerProfileStorage";
import styles from "./page.module.css";
import {
  AVAILABILITY_PERIOD_COLUMNS,
  WEEKDAY_EDIT_LABELS,
  WEEKDAY_KEYS,
  formatAvailabilitySummary,
  type DayPart,
  type WeekdayKey,
} from "@/shared/lib/volunteerAvailabilityGrid";

const messagesMock = [
  { id: 1, name: "Фонд «Верный друг»", unread: 3 },
  { id: 2, name: "Приют «Лапа помощи»", unread: 1 },
];

type ResponseStatus = "На рассмотрении" | "В работе" | "Завершено" | "Отменено" | "Отклонено";

const responsesMock = [
  { id: 1, title: "Перевозка в ветклинику", status: "На рассмотрении" as ResponseStatus },
  { id: 2, title: "Помощь на передержке", status: "В работе" as ResponseStatus },
];

const formsMock = [
  { id: 1, title: "Анкета волонтера #1", status: "На рассмотрении" },
  { id: 2, title: "Анкета волонтера #2", status: "Подтверждено" },
];

type StoredResponse = {
  id: number;
  title: string;
  status: string;
};

const HELP_FREQUENCY_OPTIONS: VolunteerHelpFrequency[] = ["Разовая помощь", "Регулярная помощь"];

const responsesStorageKey = "volunteer.responses.v1";

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

const statusClassMap: Record<ResponseStatus, string> = {
  "На рассмотрении": "statusPending",
  "В работе": "statusActive",
  Завершено: "statusDone",
  Отменено: "statusCancelled",
  Отклонено: "statusArchive",
};

const isResponseStatus = (status: string): status is ResponseStatus =>
  status === "На рассмотрении" ||
  status === "В работе" ||
  status === "Завершено" ||
  status === "Отменено" ||
  status === "Отклонено";

const normalizeResponseStatus = (status: string): ResponseStatus => {
  if (status === "Подтверждено") {
    return "В работе";
  }
  if (isResponseStatus(status)) {
    return status;
  }
  return "На рассмотрении";
};

export default function VolunteerProfilePage() {
  const { userName } = useUser();
  const [savedResponses, setSavedResponses] = useState<StoredResponse[]>([]);
  const [competencyOptions, setCompetencyOptions] = useState<string[]>(defaultCompetencyOptions);
  const [experienceOptions, setExperienceOptions] = useState<string[]>(defaultExperienceOptions);
  const [helpFormatOptions, setHelpFormatOptions] = useState<string[]>(defaultHelpFormatOptions);
  const [details, setDetails] = useState<StoredVolunteerDetails>(emptyVolunteerDetails);
  const [liveListIsAvailable, setLiveListIsAvailable] = useState<boolean | null>(null);
  const [isEditModalOpen, setEditModalOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(responsesStorageKey);
      if (!raw) {
        setSavedResponses([]);
        return;
      }
      const parsed = JSON.parse(raw) as StoredResponse[];
      setSavedResponses(parsed);
    } catch {
      setSavedResponses([]);
    }
  }, []);

  useEffect(() => {
    Promise.allSettled([volunteersApi.getCatalogs(), eventsApi.getCatalogs()]).then((results) => {
      const volunteersCatalogs =
        results[0].status === "fulfilled" ? (results[0].value as Record<string, unknown>) : null;
      const eventsCatalogs =
        results[1].status === "fulfilled" ? (results[1].value as Record<string, unknown>) : null;

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

      const backendCompetencies = readStringOptions(volunteersCatalogs?.competencies);
      const backendExperience = readStringOptions(volunteersCatalogs?.experience_levels);
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
    });
  }, []);

  useEffect(() => {
    setDetails(readVolunteerDetailsFromStorage(userName));
  }, [userName]);

  useEffect(() => {
    if (!userName?.trim()) return;
    void syncVolunteerCatalogUserId(userName).then(({ listIsAvailable }) => {
      if (listIsAvailable !== null) setLiveListIsAvailable(listIsAvailable);
    });
  }, [userName]);

  const catalogAvailabilityShown =
    details.catalogIsAvailable !== null ? details.catalogIsAvailable : (liveListIsAvailable ?? true);

  const persistCatalogAvailability = useCallback(
    async (value: boolean) => {
      setDetails((prev) => {
        const next: StoredVolunteerDetails = { ...prev, catalogIsAvailable: value };
        writeVolunteerDetailsToStorage(userName, next);
        return next;
      });
      await syncVolunteerCatalogUserId(userName || "");
      window.dispatchEvent(new Event(VOLUNTEER_PROFILE_UPDATED_EVENT));
    },
    [userName]
  );

  const profileResponses = useMemo(() => {
    const mappedSaved = savedResponses.map((item) => ({
      id: item.id,
      title: item.title,
      status: normalizeResponseStatus(item.status),
    }));

    const fallbackResponses = responsesMock.filter(
      (item) => !mappedSaved.some((saved) => saved.title === item.title)
    );

    return [...mappedSaved, ...fallbackResponses].slice(0, 3);
  }, [savedResponses]);

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
          }).trim();
          if (fromGrid) return fromGrid;
          return [details.availabilityDays.join(", "), details.availabilityTimes.join(", ")]
            .filter(Boolean)
            .join(" | ");
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

  const toggleGridCell = (day: WeekdayKey, part: DayPart) => {
    setDetails((prev) => ({
      ...prev,
      availabilityAroundClock: false,
      availabilityGrid: {
        ...prev.availabilityGrid,
        [day]: {
          ...prev.availabilityGrid[day],
          [part]: !prev.availabilityGrid[day][part],
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

  const handleOpenEditModal = () => {
    setDetails(readVolunteerDetailsFromStorage(userName));
    setEditModalOpen(true);
  };

  const handleCancelEdit = useCallback(() => {
    setDetails(readVolunteerDetailsFromStorage(userName));
    setEditModalOpen(false);
  }, [userName]);

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
    try {
      writeVolunteerDetailsToStorage(userName, details);
      await syncVolunteerCatalogUserId(userName || "");
      window.dispatchEvent(new Event(VOLUNTEER_PROFILE_UPDATED_EVENT));
      setEditModalOpen(false);
    } catch {
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <section className={styles.userHeader}>
          <div className={styles.userHeaderIdentity}>
            <div className={styles.avatarWithStatusWrap}>
              <div className={styles.avatarPlaceholder} />
              <span
                className={`${styles.statusDot} ${catalogAvailabilityShown ? styles.statusDotAvailable : styles.statusDotBusy}`}
                aria-label={catalogAvailabilityShown ? "На связи" : "Занят"}
              />
            </div>
            <div className={styles.userHeaderTexts}>
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
            <h2>Мои сообщения</h2>
            <Link href="/messages" className={styles.viewAll}>
              Смотреть все
            </Link>
          </div>

          <div className={styles.messageList}>
            {messagesMock.map((item) => (
              <article className={styles.messageItem} key={item.id}>
                <div className={styles.smallAvatar} />
                <div className={styles.messageMeta}>
                  <p>{item.name}</p>
                </div>
                <span className={styles.unread}>{item.unread}</span>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionTop}>
            <h2>Мои отклики</h2>
            <Link href="/volunteer/responses" className={styles.viewAll}>
              Смотреть все
            </Link>
          </div>

          <div className={styles.cardList}>
            {profileResponses.map((item) => (
              <article className={styles.card} key={item.id}>
                <div>
                  <h3>{item.title}</h3>
                  <p>Задача волонтера</p>
                </div>
                <span className={`${styles.status} ${styles[statusClassMap[item.status]]}`}>{item.status}</span>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionTop}>
            <h2>Мои анкеты</h2>
            <Link href="/forms" className={styles.viewAll}>
              Смотреть все
            </Link>
          </div>

          <div className={styles.cardList}>
            {formsMock.map((item) => (
              <article className={styles.card} key={item.id}>
                <div>
                  <h3>{item.title}</h3>
                  <p>Анкета волонтера</p>
                </div>
                <span className={styles.formStatus}>{item.status}</span>
              </article>
            ))}
          </div>
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
                    <div className={styles.availabilityGridWrap}>
                      <table className={styles.availabilityGridTable}>
                        <thead>
                          <tr>
                            <th className={styles.availabilityGridCorner} scope="col" />
                            {AVAILABILITY_PERIOD_COLUMNS.map((col) => (
                              <th key={col.key} scope="col" className={styles.availabilityGridHead}>
                                <span>{col.title}</span>
                                <span className={styles.availabilityGridHeadRange}>{col.range}</span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {WEEKDAY_KEYS.map((day) => (
                            <tr key={day}>
                              <th scope="row" className={styles.availabilityGridDay}>
                                {WEEKDAY_EDIT_LABELS[day]}
                              </th>
                              {AVAILABILITY_PERIOD_COLUMNS.map(({ key: part }) => {
                                const picked = Boolean(details.availabilityGrid[day][part]);
                                const checked = details.availabilityAroundClock || picked;
                                const disabled = details.availabilityAroundClock;
                                return (
                                  <td key={part} className={styles.availabilityGridCell}>
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      disabled={disabled}
                                      onChange={() => toggleGridCell(day, part)}
                                      aria-label={`${WEEKDAY_EDIT_LABELS[day]}, ${part === "morning" ? "утро" : part === "day" ? "день" : "вечер"}`}
                                    />
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
                      <span>круглосуточно</span>
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

              <div className={styles.modalActions}>
                <button type="button" className={styles.modalPrimaryButton} onClick={() => void handleDetailsSave()}>
                  Сохранить
                </button>
                <button type="button" className={styles.modalSecondaryButton} onClick={handleCancelEdit}>
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
