import { SportCategoryConfig } from "./types";
import { tennisForehandConfig } from "./tennis-forehand";
import { tennisBackhandConfig } from "./tennis-backhand";
import { tennisServeConfig } from "./tennis-serve";
import { tennisVolleyConfig } from "./tennis-volley";
import { tennisGameConfig } from "./tennis-game";
import { golfDriveConfig } from "./golf-drive";
import { golfIronConfig } from "./golf-iron";
import { golfChipConfig } from "./golf-chip";
import { golfPuttConfig } from "./golf-putt";
import { golfFullSwingConfig } from "./golf-full-swing";

export type { SportCategoryConfig, MetricDefinition, ScoreDefinition } from "./types";

const configRegistry: Record<string, SportCategoryConfig> = {
  "tennis-forehand": tennisForehandConfig,
  "tennis-backhand": tennisBackhandConfig,
  "tennis-serve": tennisServeConfig,
  "tennis-volley": tennisVolleyConfig,
  "tennis-game": tennisGameConfig,
  "golf-drive": golfDriveConfig,
  "golf-iron": golfIronConfig,
  "golf-chip": golfChipConfig,
  "golf-putt": golfPuttConfig,
  "golf-full-swing": golfFullSwingConfig,
};

export function getSportConfig(configKey: string): SportCategoryConfig | undefined {
  return configRegistry[configKey];
}

export function getAllConfigs(): Record<string, SportCategoryConfig> {
  return { ...configRegistry };
}

const movementAliases: Record<string, string> = {
  "iron-shot": "iron",
  "full-swing": "full-swing",
};

export function getConfigKey(sportName: string, movementName: string): string {
  const sport = sportName.toLowerCase();
  const movement = movementName.toLowerCase().replace(/\s+/g, "-");
  const resolvedMovement = movementAliases[movement] ?? movement;
  const key = `${sport}-${resolvedMovement}`;
  if (configRegistry[key]) return key;
  const directKey = `${sport}-${movement}`;
  if (configRegistry[directKey]) return directKey;
  return key;
}
