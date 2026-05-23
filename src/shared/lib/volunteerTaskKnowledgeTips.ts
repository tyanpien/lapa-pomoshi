import type { KnowledgeItem } from "@/shared/api/endpoints/knowledge";
import type { UrgentItem } from "@/shared/api/endpoints/urgent";
import { resolveVolunteerTaskTypeSlug } from "@/shared/lib/volunteerCompetencyCatalog";
import { collectTaskCompetencySlugs } from "@/shared/lib/volunteerTaskFeed";

export type KnowledgeTipCategory =
  | "care"
  | "first_aid"
  | "treatment"
  | "adaptation"
  | "socialization";

export type TaskForKnowledgeTips = {
  help_type?: string | null;
  title?: string | null;
  description?: string | null;
  volunteer_competencies?: string[] | null;
};

const CARE_SLUGS = new Set(["walk", "foster", "manual"]);
const TREATMENT_SLUGS = new Set(["medical"]);

const CARE_TEXT =
  /уход|выгул|прогул|кормлен|накорм|гигиен|мыть|чистк|передерж|содержан|приют|подопечн|груминг|купан/i;
const TREATMENT_TEXT =
  /лечен|лечить|вылеч|ветеринар|медицин|лекарств|укол|операц|диагноз|бинт|рана|травм|инфекц/i;

export function resolveKnowledgeCategoriesForTask(task: TaskForKnowledgeTips): KnowledgeTipCategory[] {
  const categories = new Set<KnowledgeTipCategory>();
  const blob = `${task.title ?? ""} ${task.description ?? ""}`;
  const blobLower = blob.toLowerCase();

  const primarySlug = resolveVolunteerTaskTypeSlug(task.help_type, task.volunteer_competencies);
  const slugs = collectTaskCompetencySlugs(task as UrgentItem);

  const hasCareSlug = CARE_SLUGS.has(primarySlug) || [...slugs].some((s) => CARE_SLUGS.has(s));
  const hasTreatmentSlug = TREATMENT_SLUGS.has(primarySlug) || [...slugs].some((s) => TREATMENT_SLUGS.has(s));

  if (hasTreatmentSlug || TREATMENT_TEXT.test(blobLower)) {
    categories.add("treatment");
    categories.add("first_aid");
  }

  if (hasCareSlug || CARE_TEXT.test(blobLower)) {
    categories.add("care");
  }

  if (/адаптац|новый дом|переезд|стресс/i.test(blobLower)) {
    categories.add("adaptation");
  }

  if (/социализац|приручен|контакт с человек|страх|агресс/i.test(blobLower)) {
    categories.add("socialization");
  }

  return [...categories];
}

export function taskQualifiesForKnowledgeTips(task: TaskForKnowledgeTips): boolean {
  return resolveKnowledgeCategoriesForTask(task).length > 0;
}

const CATEGORY_PRIORITY: KnowledgeTipCategory[] = [
  "treatment",
  "first_aid",
  "care",
  "adaptation",
  "socialization",
];

export function pickRelevantKnowledgeTips(
  tips: KnowledgeItem[],
  task: TaskForKnowledgeTips,
  limit = 2,
): KnowledgeItem[] {
  const wanted = resolveKnowledgeCategoriesForTask(task);
  if (!wanted.length || !tips.length) return [];

  const wantedSet = new Set(wanted);
  const ranked = tips
    .filter((tip) => tip.is_context_tip && wantedSet.has(tip.category as KnowledgeTipCategory))
    .sort((a, b) => {
      const pa = CATEGORY_PRIORITY.indexOf(a.category as KnowledgeTipCategory);
      const pb = CATEGORY_PRIORITY.indexOf(b.category as KnowledgeTipCategory);
      const scoreA = pa === -1 ? 99 : pa;
      const scoreB = pb === -1 ? 99 : pb;
      if (scoreA !== scoreB) return scoreA - scoreB;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const seen = new Set<number>();
  const result: KnowledgeItem[] = [];
  for (const tip of ranked) {
    if (seen.has(tip.id)) continue;
    seen.add(tip.id);
    result.push(tip);
    if (result.length >= limit) break;
  }
  return result;
}
