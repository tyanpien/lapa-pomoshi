const CITY_ALIASES: Record<string, string> = {
  спб: "санкт-петербург",
  питер: "санкт-петербург",
  петербург: "санкт-петербург",
  екб: "екатеринбург",
  мск: "москва",
};

export function normalizeCityToken(city: string | null | undefined): string {
  if (!city) return "";
  let s = String(city).trim().toLowerCase().replace(/ё/g, "е");
  for (const prefix of ["г.", "г ", "город "]) {
    if (s.startsWith(prefix)) {
      s = s.slice(prefix.length).trim();
      break;
    }
  }
  s = s.split(/\s+/).join(" ");
  return CITY_ALIASES[s] ?? s;
}

export function citiesMatchForVolunteer(
  volunteerCity: string | null | undefined,
  taskCity: string | null | undefined,
): boolean {
  const volunteer = normalizeCityToken(volunteerCity);
  if (!volunteer) return true;
  const task = normalizeCityToken(taskCity);
  if (!task) return true;
  if (volunteer === task) return true;
  if (volunteer.includes(task) || task.includes(volunteer)) return true;

  const volunteerParts = volunteer.split(",").map((p) => p.trim()).filter(Boolean);
  const taskParts = task.split(",").map((p) => p.trim()).filter(Boolean);
  const leftParts = volunteerParts.length ? volunteerParts : [volunteer];
  const rightParts = taskParts.length ? taskParts : [task];

  for (const left of leftParts) {
    for (const right of rightParts) {
      if (left === right || left.includes(right) || right.includes(left)) return true;
    }
  }
  return false;
}

export function resolveVolunteerCityForMatching(
  locationCity: string | null | undefined,
  storedLocationText?: string | null,
): string | null {
  const fromApi = (locationCity ?? "").trim();
  if (fromApi) return fromApi;
  const stored = (storedLocationText ?? "").trim();
  if (!stored) return null;
  const first = stored.split(",")[0]?.trim();
  return first || stored;
}
