const ORGANIZATION_CABINET_STORAGE_KEY = "organization.cabinet.v1";
const ORGANIZATION_CABINET_EVENT = "organization-cabinet-updated";

export type OrganizationRequestStatus = "draft" | "published" | "in_progress" | "closed";
export type OrganizationRequestUrgency = "normal" | "urgent";

export type OrganizationProfileData = {
  organizationName: string;
  description: string;
  specialization: string;
  territory: string;
  contacts: string;
  vkUrl: string;
  telegramUrl: string;
  whatsappUrl: string;
  admissionRules: string;
  currentNeeds: string;
  helpWays: string;
  adoptionScenario: string;
  adoptionQuestionnaire: string;
  adoptionRules: string;
  futureOwnerRequirements: string;
};

export type GreetingFromHome = {
  id: number;
  petName: string;
  text: string;
  photoUrl?: string;
  linkedAnimalId?: number;
  createdAt: string;
};

export type OrganizationRequest = {
  id: number;
  title: string;
  location: string;
  problemDescription: string;
  mediaUrl?: string;
  helpType: string;
  urgency: OrganizationRequestUrgency;
  linkedAnimalId?: number;
  needVolunteer: boolean;
  volunteerCompetencies: string;
  status: OrganizationRequestStatus;
  createdAt: string;
};

export type OrganizationReport = {
  id: number;
  title: string;
  content: string;
  isUrgent: boolean;
  archived: boolean;
  createdAt: string;
};

export type OrganizationArticle = {
  id: number;
  title: string;
  articleType: string;
  author: string;
  content: string;
  coverUrl?: string;
  archived: boolean;
  createdAt: string;
};

export type OrganizationEvent = {
  id: number;
  title: string;
  description: string;
  location: string;
  dateLabel: string;
  archived: boolean;
  createdAt: string;
};

type OrganizationCabinetRecord = {
  ownerName: string;
  profile: OrganizationProfileData;
  greetingsFromHome: GreetingFromHome[];
  requests: OrganizationRequest[];
  reports: OrganizationReport[];
  articles: OrganizationArticle[];
  events: OrganizationEvent[];
};

export type OrganizationCabinetPublicRecord = OrganizationCabinetRecord;

const getCurrentOrganizationName = (): string => {
  if (typeof window === "undefined") return "Организация";
  return localStorage.getItem("userName")?.trim() || "Организация";
};

const createDefaultProfile = (organizationName: string): OrganizationProfileData => ({
  organizationName,
  description: "",
  specialization: "",
  territory: "",
  contacts: "",
  vkUrl: "",
  telegramUrl: "",
  whatsappUrl: "",
  admissionRules: "",
  currentNeeds: "",
  helpWays: "",
  adoptionScenario: "",
  adoptionQuestionnaire: "",
  adoptionRules: "",
  futureOwnerRequirements: "",
});

const readStorage = (): OrganizationCabinetRecord[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ORGANIZATION_CABINET_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OrganizationCabinetRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeStorage = (records: OrganizationCabinetRecord[]) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(ORGANIZATION_CABINET_STORAGE_KEY, JSON.stringify(records));
  window.dispatchEvent(new Event(ORGANIZATION_CABINET_EVENT));
};

const getOrCreateRecord = (): OrganizationCabinetRecord => {
  const ownerName = getCurrentOrganizationName();
  const records = readStorage();
  const existing = records.find((record) => record.ownerName === ownerName);
  if (existing) return existing;

  const created: OrganizationCabinetRecord = {
    ownerName,
    profile: createDefaultProfile(ownerName),
    greetingsFromHome: [],
    requests: [],
    reports: [],
    articles: [],
    events: [],
  };
  records.push(created);
  writeStorage(records);
  return created;
};

const updateRecord = (updater: (current: OrganizationCabinetRecord) => OrganizationCabinetRecord) => {
  const ownerName = getCurrentOrganizationName();
  const records = readStorage();
  const index = records.findIndex((record) => record.ownerName === ownerName);
  const base =
    index >= 0
      ? records[index]
      : {
          ownerName,
          profile: createDefaultProfile(ownerName),
          greetingsFromHome: [],
          requests: [],
          reports: [],
          articles: [],
          events: [],
        };
  const updated = updater(base);
  if (index >= 0) {
    records[index] = updated;
  } else {
    records.push(updated);
  }
  writeStorage(records);
};

const nextId = () => Date.now() + Math.floor(Math.random() * 1000);
const now = () => new Date().toISOString();

export const getOrganizationCabinetEventName = () => ORGANIZATION_CABINET_EVENT;
export const getAllOrganizationCabinetRecords = (): OrganizationCabinetPublicRecord[] => readStorage();

export const getOrganizationCabinetRecordByName = (
  organizationName: string
): OrganizationCabinetPublicRecord | null => {
  const normalizedName = organizationName.trim().toLowerCase();
  if (!normalizedName) return null;

  const records = readStorage();
  const byOwnerName = records.find((record) => record.ownerName.trim().toLowerCase() === normalizedName);
  if (byOwnerName) return byOwnerName;

  const byProfileName = records.find(
    (record) => record.profile.organizationName.trim().toLowerCase() === normalizedName
  );
  return byProfileName ?? null;
};

export const getOrganizationProfile = (): OrganizationProfileData => {
  const record = getOrCreateRecord();
  return {
    ...createDefaultProfile(record.ownerName),
    ...record.profile,
  };
};

export const saveOrganizationProfile = (profile: OrganizationProfileData) => {
  updateRecord((current) => ({
    ...current,
    profile: {
      ...createDefaultProfile(current.ownerName),
      ...current.profile,
      ...profile,
      organizationName: profile.organizationName.trim() || current.ownerName,
    },
  }));
};

export const getOrganizationGreetings = (): GreetingFromHome[] => getOrCreateRecord().greetingsFromHome;
export const addOrganizationGreeting = (payload: Omit<GreetingFromHome, "id" | "createdAt">) => {
  updateRecord((current) => ({
    ...current,
    greetingsFromHome: [
      { ...payload, id: nextId(), createdAt: now() },
      ...current.greetingsFromHome,
    ],
  }));
};
export const updateOrganizationGreeting = (
  id: number,
  payload: Omit<GreetingFromHome, "id" | "createdAt">
) => {
  updateRecord((current) => ({
    ...current,
    greetingsFromHome: current.greetingsFromHome.map((greeting) =>
      greeting.id === id ? { ...greeting, ...payload } : greeting
    ),
  }));
};
export const deleteOrganizationGreeting = (id: number) => {
  updateRecord((current) => ({
    ...current,
    greetingsFromHome: current.greetingsFromHome.filter((greeting) => greeting.id !== id),
  }));
};

export const getOrganizationRequests = (): OrganizationRequest[] => getOrCreateRecord().requests;
export const getAllOrganizationRequests = (): OrganizationRequest[] => {
  return readStorage()
    .flatMap((record) => record.requests)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};
export const addOrganizationRequest = (payload: Omit<OrganizationRequest, "id" | "createdAt">) => {
  updateRecord((current) => ({
    ...current,
    requests: [{ ...payload, id: nextId(), createdAt: now() }, ...current.requests],
  }));
};
export const updateOrganizationRequestStatus = (id: number, status: OrganizationRequestStatus) => {
  updateRecord((current) => ({
    ...current,
    requests: current.requests.map((request) =>
      request.id === id ? { ...request, status } : request
    ),
  }));
};

export const getOrganizationReports = (): OrganizationReport[] => getOrCreateRecord().reports;
export const addOrganizationReport = (payload: Omit<OrganizationReport, "id" | "createdAt" | "archived">) => {
  updateRecord((current) => ({
    ...current,
    reports: [{ ...payload, id: nextId(), archived: false, createdAt: now() }, ...current.reports],
  }));
};
export const toggleOrganizationReportArchive = (id: number) => {
  updateRecord((current) => ({
    ...current,
    reports: current.reports.map((report) =>
      report.id === id ? { ...report, archived: !report.archived } : report
    ),
  }));
};

export const getOrganizationArticles = (): OrganizationArticle[] => getOrCreateRecord().articles;
export const addOrganizationArticle = (
  payload: Omit<OrganizationArticle, "id" | "createdAt" | "archived">
) => {
  updateRecord((current) => ({
    ...current,
    articles: [{ ...payload, id: nextId(), archived: false, createdAt: now() }, ...current.articles],
  }));
};
export const toggleOrganizationArticleArchive = (id: number) => {
  updateRecord((current) => ({
    ...current,
    articles: current.articles.map((article) =>
      article.id === id ? { ...article, archived: !article.archived } : article
    ),
  }));
};

export const getOrganizationEvents = (): OrganizationEvent[] => getOrCreateRecord().events;
export const addOrganizationEvent = (payload: Omit<OrganizationEvent, "id" | "createdAt" | "archived">) => {
  updateRecord((current) => ({
    ...current,
    events: [{ ...payload, id: nextId(), archived: false, createdAt: now() }, ...current.events],
  }));
};
export const toggleOrganizationEventArchive = (id: number) => {
  updateRecord((current) => ({
    ...current,
    events: current.events.map((event) =>
      event.id === id ? { ...event, archived: !event.archived } : event
    ),
  }));
};
