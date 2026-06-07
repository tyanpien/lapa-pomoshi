"use client";

import { useEffect, useState } from "react";
import { eventsApi } from "@/shared/api/endpoints/events";
import { volunteersApi, type CatalogOption } from "@/shared/api/endpoints/volunteers";

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

function readStringOptions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
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
}

const dedupeStrings = (items: string[]) => Array.from(new Set(items));

export function useVolunteerProfileCatalogs() {
  const [competencyOptions, setCompetencyOptions] = useState<string[]>(defaultCompetencyOptions);
  const [experienceOptions, setExperienceOptions] = useState<string[]>(defaultExperienceOptions);
  const [helpFormatOptions, setHelpFormatOptions] = useState<string[]>(defaultHelpFormatOptions);
  const [competencyCatalogRows, setCompetencyCatalogRows] = useState<CatalogOption[]>([]);
  const [experienceCatalogRows, setExperienceCatalogRows] = useState<CatalogOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const [cats, eventsCatalogs] = await Promise.all([
          volunteersApi.getCatalogs(),
          eventsApi.getCatalogs(),
        ]);
        if (cancelled) return;

        setCompetencyCatalogRows(cats.competencies ?? []);
        setExperienceCatalogRows(cats.experience_levels ?? []);

        const backendCompetencies = readStringOptions(cats.competencies);
        const backendExperience = readStringOptions(cats.experience_levels);
        const backendHelpFormats = readStringOptions(eventsCatalogs?.help_types);

        setCompetencyOptions(
          dedupeStrings(backendCompetencies.length > 0 ? backendCompetencies : defaultCompetencyOptions),
        );
        setExperienceOptions(
          dedupeStrings(backendExperience.length > 0 ? backendExperience : defaultExperienceOptions),
        );
        setHelpFormatOptions(
          dedupeStrings(backendHelpFormats.length > 0 ? backendHelpFormats : defaultHelpFormatOptions),
        );
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Не удалось загрузить справочники");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const catalogsReady = competencyCatalogRows.length > 0 && experienceCatalogRows.length > 0;

  return {
    competencyOptions,
    experienceOptions,
    helpFormatOptions,
    competencyCatalogRows,
    experienceCatalogRows,
    loading,
    error,
    catalogsReady,
  };
}
