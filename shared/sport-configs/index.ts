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
import { pickleballDinkConfig } from "./pickleball-dink";
import { pickleballDriveConfig } from "./pickleball-drive";
import { pickleballServeConfig } from "./pickleball-serve";
import { pickleballVolleyConfig } from "./pickleball-volley";
import { pickleballThirdShotDropConfig } from "./pickleball-third-shot-drop";
import { paddleForehandConfig } from "./paddle-forehand";
import { paddleBackhandConfig } from "./paddle-backhand";
import { paddleServeConfig } from "./paddle-serve";
import { paddleSmashConfig } from "./paddle-smash";
import { paddleBandejaConfig } from "./paddle-bandeja";
import { badmintonClearConfig } from "./badminton-clear";
import { badmintonSmashConfig } from "./badminton-smash";
import { badmintonDropConfig } from "./badminton-drop";
import { badmintonNetShotConfig } from "./badminton-net-shot";
import { badmintonServeConfig } from "./badminton-serve";
import { tabletennisForehandConfig } from "./tabletennis-forehand";
import { tabletennisBackhandConfig } from "./tabletennis-backhand";
import { tabletennisServeConfig } from "./tabletennis-serve";
import { tabletennisLoopConfig } from "./tabletennis-loop";
import { tabletennisChopConfig } from "./tabletennis-chop";

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
  "pickleball-dink": pickleballDinkConfig,
  "pickleball-drive": pickleballDriveConfig,
  "pickleball-serve": pickleballServeConfig,
  "pickleball-volley": pickleballVolleyConfig,
  "pickleball-third-shot-drop": pickleballThirdShotDropConfig,
  "paddle-forehand": paddleForehandConfig,
  "paddle-backhand": paddleBackhandConfig,
  "paddle-serve": paddleServeConfig,
  "paddle-smash": paddleSmashConfig,
  "paddle-bandeja": paddleBandejaConfig,
  "badminton-clear": badmintonClearConfig,
  "badminton-smash": badmintonSmashConfig,
  "badminton-drop": badmintonDropConfig,
  "badminton-net-shot": badmintonNetShotConfig,
  "badminton-serve": badmintonServeConfig,
  "tabletennis-forehand": tabletennisForehandConfig,
  "tabletennis-backhand": tabletennisBackhandConfig,
  "tabletennis-serve": tabletennisServeConfig,
  "tabletennis-loop": tabletennisLoopConfig,
  "tabletennis-chop": tabletennisChopConfig,
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
  "third-shot-drop": "third-shot-drop",
  "net-shot": "net-shot",
};

export function getConfigKey(sportName: string, movementName: string): string {
  const sport = sportName.toLowerCase().replace(/\s+/g, "");
  const movement = movementName.toLowerCase().replace(/\s+/g, "-");
  const resolvedMovement = movementAliases[movement] ?? movement;
  const key = `${sport}-${resolvedMovement}`;
  if (configRegistry[key]) return key;
  const directKey = `${sport}-${movement}`;
  if (configRegistry[directKey]) return directKey;
  return key;
}
