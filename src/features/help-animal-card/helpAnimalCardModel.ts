import type { HelpAnimalItem } from "@/shared/api/endpoints/help";
import { helpApi } from "@/shared/api/endpoints/help";
import { formatAgeMonthsRu } from "@/shared/lib/formatAgeMonthsRu";

export type HelpCardNeedType = "adopt" | "food" | "treatment" | "other";

export interface HelpAnimalCardModel {
  id: number;
  name: string;
  image: string;
  isUrgent: boolean;
  species: string;
  age: string;
  statusTag: string;
  organization: string;
  needText: string;
  needIcon: string;
  needType: HelpCardNeedType;
  amount: string | null;
  primaryHelpRequestId: number | null;
  adoptReady: boolean;
  hasFundraising: boolean;
}

export type HelpAnimalCardRendered = HelpAnimalCardModel & { actionLabel: string };

const needTypeFromBucket = (bucket: string): HelpCardNeedType => {
  const n = bucket.trim().toLowerCase();
  if (n === "adopt" || n.includes("пристро")) return "adopt";
  if (n === "feed" || n === "food" || n.includes("корм") || n.includes("накорм")) return "food";
  if (n === "heal" || n === "treatment" || n.includes("леч")) return "treatment";
  return "other";
};

export const needIconForType = (needType: HelpCardNeedType) =>
  needType === "adopt"
    ? "/home_.svg"
    : needType === "food"
      ? "/food.svg"
      : needType === "treatment"
        ? "/operation.svg"
        : "/povodok.svg";

export const formatHelpRub = (amount: number) =>
  amount > 0 ? `${new Intl.NumberFormat("ru-RU").format(amount)} ₽` : null;

const inferNeedType = (item: HelpAnimalItem): HelpCardNeedType => {
  if (item.monetary?.length) {
    return needTypeFromBucket(item.monetary[0].help_bucket);
  }
  if (item.adopt_ready) return "adopt";
  return "other";
};

const uniqueLinesPreservingOrder = (lines: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || seen.has(line)) continue;
    seen.add(line);
    out.push(line);
  }
  return out;
};

export const mapHelpAnimalItemToCard = (item: HelpAnimalItem): HelpAnimalCardModel => {
  const needType = inferNeedType(item);
  const lines = uniqueLinesPreservingOrder((item.monetary ?? []).map((m) => m.line).filter(Boolean));
  const needText =
    lines.length > 0
      ? lines.join(" · ")
      : item.adopt_ready
        ? "Ищет дом и любящую семью"
        : "Нужна помощь";

  const totalRub = (item.monetary ?? []).reduce((s, m) => s + (Number(m.amount_rub) || 0), 0);
  const amountStr = needType === "adopt" && !totalRub ? null : formatHelpRub(totalRub);
  const primaryHelpRequestId =
    item.monetary?.length && typeof item.monetary[0].request_id === "number"
      ? item.monetary[0].request_id
      : null;

  return {
    id: item.animal_id,
    name: item.name,
    image: helpApi.getImageUrl(item.primary_photo_url),
    isUrgent: item.is_urgent,
    species: item.species_tag?.trim() ? item.species_tag.trim().toLowerCase() : "животное",
    age:
      typeof item.age_months === "number"
        ? formatAgeMonthsRu(item.age_months)
        : item.age_tag?.trim() || "Возраст не указан",
    statusTag: item.status_chip?.trim() || "—",
    organization: item.organization_name?.trim() || "Организация",
    needText,
    needIcon: needIconForType(needType),
    needType,
    amount: amountStr,
    primaryHelpRequestId,
    adoptReady: Boolean(item.adopt_ready),
    hasFundraising: (item.monetary ?? []).length > 0,
  };
};

const prefersHelpAction = (card: Pick<HelpAnimalCardModel, "adoptReady" | "hasFundraising" | "statusTag">) => {
  if (card.hasFundraising) return true;
  if (!card.adoptReady) return true;
  return card.statusTag.toLowerCase().includes("лечен");
};

export const withHelpActionLabel = (card: HelpAnimalCardModel): HelpAnimalCardRendered => {
  const showHelp = prefersHelpAction(card);
  return {
    ...card,
    actionLabel: showHelp ? "Помочь" : "Забрать домой",
    amount: showHelp ? card.amount : null,
  };
};
