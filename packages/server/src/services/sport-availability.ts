import { and, asc, eq } from "drizzle-orm";

import { db } from "../config/db";
import { sports } from "@swing-ai/shared/schema";

export const PRIMARY_ENABLED_SPORT_NAME = "Tennis";

export type SportRow = typeof sports.$inferSelect;

export function normalizeSportName(value?: string | null): string {
  return String(value || "").trim().toLowerCase();
}

export function isPrimaryEnabledSportName(value?: string | null): boolean {
  return normalizeSportName(value) === normalizeSportName(PRIMARY_ENABLED_SPORT_NAME);
}

export function isSportEnabledRecord(sport?: Pick<SportRow, "enabled" | "isActive"> | null): boolean {
  if (!sport) return false;
  if (typeof sport.enabled === "boolean") return sport.enabled;
  return Boolean(sport.isActive);
}

export async function listSports(options?: { includeDisabled?: boolean }): Promise<SportRow[]> {
  const includeDisabled = Boolean(options?.includeDisabled);
  const query = db
    .select()
    .from(sports)
    .orderBy(asc(sports.sortOrder), asc(sports.name));

  if (includeDisabled) {
    return query;
  }

  return db
    .select()
    .from(sports)
    .where(eq(sports.enabled, true))
    .orderBy(asc(sports.sortOrder), asc(sports.name));
}

export async function getSportById(sportId: string): Promise<SportRow | null> {
  const [sport] = await db.select().from(sports).where(eq(sports.id, sportId)).limit(1);
  return sport ?? null;
}

export async function getEnabledSportById(sportId: string): Promise<SportRow | null> {
  const [sport] = await db
    .select()
    .from(sports)
    .where(and(eq(sports.id, sportId), eq(sports.enabled, true)))
    .limit(1);
  return sport ?? null;
}

export async function getEnabledPrimarySport(): Promise<SportRow | null> {
  const [sport] = await db
    .select()
    .from(sports)
    .where(and(eq(sports.enabled, true), eq(sports.name, PRIMARY_ENABLED_SPORT_NAME)))
    .limit(1);
  return sport ?? null;
}

export async function getEnabledSportNames(): Promise<Set<string>> {
  const activeSports = await db
    .select({ name: sports.name })
    .from(sports)
    .where(eq(sports.enabled, true));
  return new Set(activeSports.map((sport) => normalizeSportName(sport.name)));
}

export function mapSportForApi(sport: SportRow): SportRow & { enabled: boolean } {
  return {
    ...sport,
    enabled: isSportEnabledRecord(sport),
  };
}
