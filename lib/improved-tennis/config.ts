// Keep this feature behind a dedicated toggle so it can be safely removed
// or enabled later without touching the default scoring pipeline.
export const ENABLE_IMPROVED_TENNIS_BADGE = true;

export function isImprovedTennisEnabled(): boolean {
  return ENABLE_IMPROVED_TENNIS_BADGE;
}
