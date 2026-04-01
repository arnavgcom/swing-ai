import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function stripWrappingQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const normalized = line.startsWith("export ") ? line.slice(7).trim() : line;
    const equalsIndex = normalized.indexOf("=");
    if (equalsIndex <= 0) {
      continue;
    }

    const key = normalized.slice(0, equalsIndex).trim();
    const existingValue = process.env[key];
    if (!key || (existingValue != null && String(existingValue).trim() !== "")) {
      continue;
    }

    const rawValue = normalized.slice(equalsIndex + 1).trim();
    process.env[key] = stripWrappingQuotes(rawValue);
  }
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));

/** Walk up from the executing file until we find the server package.json. */
function findProjectRoot(): string {
  let dir = currentDir;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, "package.json"))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return path.resolve(currentDir, "../..");
}

export const PROJECT_ROOT = findProjectRoot();

export function resolveProjectPath(...segments: string[]): string {
  return path.resolve(PROJECT_ROOT, ...segments);
}

export function ensureEnvLoaded(): void {
  const candidateRoots = Array.from(new Set([process.cwd(), PROJECT_ROOT]));
  for (const root of candidateRoots) {
    loadEnvFile(path.resolve(root, ".env"));
    loadEnvFile(path.resolve(root, ".env.local"));
  }
}

ensureEnvLoaded();
