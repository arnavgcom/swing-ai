type UserTimeZoneInput = {
  timeZone?: string | null;
  timezone?: string | null;
  tz?: string | null;
  country?: string | null;
} | null | undefined;

const COUNTRY_TO_TIMEZONE: Record<string, string> = {
  singapore: "Asia/Singapore",
  sg: "Asia/Singapore",
  india: "Asia/Kolkata",
  in: "Asia/Kolkata",
  "united states": "America/Los_Angeles",
  usa: "America/Los_Angeles",
  us: "America/Los_Angeles",
  "united kingdom": "Europe/London",
  uk: "Europe/London",
  gb: "Europe/London",
  australia: "Australia/Sydney",
  au: "Australia/Sydney",
  canada: "America/Toronto",
  ca: "America/Toronto",
  uae: "Asia/Dubai",
  ae: "Asia/Dubai",
};

function normalizeCountry(value: string | null | undefined): string {
  return String(value || "").trim().toLowerCase();
}

function countryToTimeZone(countryRaw: string | null | undefined): string | null {
  const country = normalizeCountry(countryRaw);
  if (!country) return null;

  const direct = COUNTRY_TO_TIMEZONE[country];
  if (direct && isValidTimeZone(direct)) return direct;

  // Handle variants like "Singapore (SG)", "SG", "Republic of Singapore"
  // and other strings where country text may include punctuation or extra words.
  const normalizedAlphaNum = country.replace(/[^a-z0-9]+/g, " ").trim();
  const compact = normalizedAlphaNum.replace(/\s+/g, "");

  if (compact.includes("singapore") || compact === "sg") {
    return "Asia/Singapore";
  }
  if (compact.includes("india") || compact === "in") {
    return "Asia/Kolkata";
  }
  if (compact.includes("uae") || compact.includes("unitedarabemirates") || compact === "ae") {
    return "Asia/Dubai";
  }
  if (compact.includes("unitedkingdom") || compact === "uk" || compact === "gb") {
    return "Europe/London";
  }
  if (compact.includes("australia") || compact === "au") {
    return "Australia/Sydney";
  }
  if (compact.includes("canada") || compact === "ca") {
    return "America/Toronto";
  }
  if (
    compact.includes("usa")
    || compact.includes("unitedstates")
    || compact.includes("unitedstatesofamerica")
    || compact === "us"
  ) {
    return "America/Los_Angeles";
  }

  return null;
}

function isValidTimeZone(value: string | null | undefined): value is string {
  const candidate = String(value || "").trim();
  if (!candidate) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function resolveUserTimeZone(user: UserTimeZoneInput, fallback?: string): string {
  const explicitTimeZone = user?.timeZone || user?.timezone || user?.tz;
  if (isValidTimeZone(explicitTimeZone)) {
    return explicitTimeZone;
  }

  const mapped = countryToTimeZone(user?.country);
  if (mapped && isValidTimeZone(mapped)) {
    return mapped;
  }

  const fallbackTimeZone = String(fallback || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  if (isValidTimeZone(fallbackTimeZone)) {
    return fallbackTimeZone;
  }

  return "UTC";
}
