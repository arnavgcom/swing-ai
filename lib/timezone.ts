type UserTimeZoneInput = {
  timeZone?: string | null;
  timezone?: string | null;
  tz?: string | null;
  country?: string | null;
  phone?: string | null;
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

function phoneToTimeZone(phoneRaw: string | null | undefined): string | null {
  const phone = String(phoneRaw || "").trim();
  if (!phone) return null;

  const normalized = phone.replace(/[^+\d]/g, "");
  if (normalized.startsWith("+65")) return "Asia/Singapore";
  if (normalized.startsWith("+91")) return "Asia/Kolkata";
  if (normalized.startsWith("+971")) return "Asia/Dubai";
  if (normalized.startsWith("+44")) return "Europe/London";
  if (normalized.startsWith("+61")) return "Australia/Sydney";
  if (normalized.startsWith("+1")) return "America/Toronto";

  return null;
}

export function parseApiDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const normalized = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(raw)
    ? raw
    : `${raw}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
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

  const phoneMapped = phoneToTimeZone(user?.phone);
  if (phoneMapped && isValidTimeZone(phoneMapped)) {
    return phoneMapped;
  }

  const fallbackTimeZone = String(fallback || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  if (isValidTimeZone(fallbackTimeZone)) {
    return fallbackTimeZone;
  }

  return "UTC";
}

export function formatDateTimeInTimeZone(
  value: string | Date | null | undefined,
  timeZone?: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!value) return "Unknown date";
  const date = parseApiDate(value);
  if (!date) return "Unknown date";

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
    ...options,
  });
}

export function formatDateInTimeZone(
  value: string | Date | null | undefined,
  timeZone?: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!value) return "Unknown date";
  const date = parseApiDate(value);
  if (!date) return "Unknown date";

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone,
    ...options,
  });
}

export function formatMonthDayInTimeZone(
  value: string | Date | null | undefined,
  timeZone?: string,
): string {
  if (!value) return "-";
  const date = parseApiDate(value);
  if (!date) return "-";

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone,
  });
}
