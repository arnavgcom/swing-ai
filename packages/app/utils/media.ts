import { getApiUrl } from "@/services/query-client";

export function resolveClientMediaUrl(value: string | null | undefined): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  try {
    return new URL(raw.startsWith("/") ? raw : `/${raw}`, getApiUrl()).href;
  } catch {
    return null;
  }
}
