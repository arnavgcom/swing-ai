import fs from "fs";
import path from "path";
import type { ScoreInputsPayload } from "@shared/schema";

type ScoreDetailDef = {
  name: string;
  parameters: string[];
};

const TECHNICAL_DEFS: ScoreDetailDef[] = [
  { name: "Balance", parameters: ["balanceScore", "reactionTime"] },
  { name: "Inertia", parameters: ["stanceAngle", "shoulderRotationSpeed"] },
  { name: "Opposite Force", parameters: ["kneeBendAngle", "balanceScore", "stanceAngle"] },
  { name: "Momentum", parameters: ["hipRotationSpeed", "shoulderRotationSpeed", "ballSpeed"] },
  { name: "Elastic Energy", parameters: ["racketLagAngle", "kneeBendAngle", "swingPathAngle"] },
  { name: "Contact", parameters: ["contactDistance", "contactHeight", "reactionTime"] },
];

const MOVEMENT_DEFS: ScoreDetailDef[] = [
  { name: "Ready", parameters: ["splitStepTime", "balanceScore"] },
  { name: "Read", parameters: ["reactionTime", "splitStepTime"] },
  { name: "React", parameters: ["reactionTime", "balanceScore"] },
  { name: "Respond", parameters: ["ballSpeed", "contactHeight", "swingPathAngle"] },
  { name: "Recover", parameters: ["recoveryTime", "balanceScore"] },
];

const TACTICAL_ALIAS_WEIGHTS: Record<string, Record<string, number>> = {
  power: {
    power: 1.0,
    speed: 0.9,
    athleticism: 0.8,
    touch: 0.5,
  },
  control: {
    control: 1.0,
    stability: 0.9,
    placement: 0.8,
    accuracy: 0.8,
    alignment: 0.7,
    finesse: 0.7,
    deception: 0.6,
    reflexes: 0.5,
    balance: 0.7,
    movement: 0.6,
    shotselection: 0.6,
  },
  timing: {
    timing: 1.0,
    rhythm: 0.8,
    reflexes: 0.5,
  },
  technique: {
    technique: 1.0,
    followthrough: 0.8,
    spin: 0.6,
    arc: 0.6,
    footwork: 0.6,
    wallplay: 0.6,
    shotselection: 0.4,
    movement: 0.4,
    placement: 0.4,
    accuracy: 0.4,
    control: 0.5,
    deception: 0.5,
    finesse: 0.5,
  },
};

function canonicalKey(value: string): string {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function metricValueMap(metricValues: Record<string, unknown>): Map<string, number> {
  const out = new Map<string, number>();
  for (const [k, v] of Object.entries(metricValues || {})) {
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    out.set(canonicalKey(k), n);
  }
  return out;
}

function pickValues(parameters: string[], metricValues: Record<string, unknown>): Record<string, number | null> {
  const canon = metricValueMap(metricValues);
  const values: Record<string, number | null> = {};
  for (const key of parameters) {
    const c = canonicalKey(key);
    values[key] = canon.has(c) ? (canon.get(c) as number) : null;
  }
  return values;
}

function extractComputeSubScoresBlock(src: string): string | null {
  const start = src.indexOf("def _compute_sub_scores");
  if (start === -1) return null;
  const after = src.slice(start);
  const endMatch = after.match(/\n\s*def\s+_compute_overall_score\s*\(/);
  if (!endMatch) return null;
  return after.slice(0, endMatch.index);
}

type AnalyzerDependencyMap = {
  rawKeyExpr: Map<string, string>;
  helperExpr: Map<string, string>;
  canonicalRawKeyToName: Map<string, string>;
};

const analyzerDepsCache = new Map<string, AnalyzerDependencyMap>();

function parseAnalyzerDependencies(configKey: string): AnalyzerDependencyMap | null {
  if (analyzerDepsCache.has(configKey)) return analyzerDepsCache.get(configKey) || null;

  const analyzerPath = path.resolve(process.cwd(), "python_analysis", "sports", `${configKey.replace(/-/g, "_")}.py`);
  if (!fs.existsSync(analyzerPath)) {
    analyzerDepsCache.set(configKey, null as unknown as AnalyzerDependencyMap);
    return null;
  }

  const src = fs.readFileSync(analyzerPath, "utf8");
  const fnBlock = extractComputeSubScoresBlock(src);
  if (!fnBlock) {
    analyzerDepsCache.set(configKey, null as unknown as AnalyzerDependencyMap);
    return null;
  }

  const lines = fnBlock.split("\n");
  const helperExpr = new Map<string, string>();
  const varExpr = new Map<string, string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const assign = line.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/);
    if (assign && !line.includes("int(np.clip(round(")) {
      helperExpr.set(assign[1], assign[2].trim().replace(/\s+/g, " "));
    }

    const startMatch = line.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*int\(np\.clip\(round\(/);
    if (!startMatch) continue;

    const varName = startMatch[1];
    const chunk: string[] = [];
    for (let j = i; j < lines.length; j++) {
      chunk.push(lines[j]);
      if (lines[j].includes("), 0, 100))")) {
        i = j;
        break;
      }
    }

    const exprMatch = chunk.join("\n").match(/int\(np\.clip\(round\(([\s\S]*?)\),\s*0,\s*100\)\)/);
    if (exprMatch) {
      varExpr.set(varName, exprMatch[1].trim().replace(/\s+/g, " "));
    }
  }

  const rawKeyExpr = new Map<string, string>();
  const returnMatch = fnBlock.match(/return\s*\{([\s\S]*?)\n\s*\}/);
  if (returnMatch) {
    for (const m of returnMatch[1].matchAll(/"([^"]+)"\s*:\s*([a-zA-Z_][a-zA-Z0-9_]*)/g)) {
      const rawKey = m[1];
      const ref = m[2];
      const expr = varExpr.get(ref);
      if (expr) rawKeyExpr.set(rawKey, expr);
    }
  }

  const canonicalRawKeyToName = new Map<string, string>();
  for (const key of rawKeyExpr.keys()) {
    canonicalRawKeyToName.set(canonicalKey(key), key);
  }

  const result: AnalyzerDependencyMap = { rawKeyExpr, helperExpr, canonicalRawKeyToName };
  analyzerDepsCache.set(configKey, result);
  return result;
}

function extractMetricDepsFromExpr(expr: string, helperExpr: Map<string, string>, seen = new Set<string>()): string[] {
  const deps = new Set<string>();

  for (const m of expr.matchAll(/m\["([^"]+)"\]/g)) {
    deps.add(m[1]);
  }

  const tokenRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
  const ignored = new Set(["self", "m", "np", "round", "int", "float", "max", "min", "abs", "clamp"]);
  for (const t of expr.matchAll(tokenRegex)) {
    const token = t[1];
    if (ignored.has(token) || seen.has(token)) continue;
    const nested = helperExpr.get(token);
    if (!nested) continue;
    seen.add(token);
    for (const dep of extractMetricDepsFromExpr(nested, helperExpr, seen)) {
      deps.add(dep);
    }
  }

  return [...deps].sort((a, b) => a.localeCompare(b));
}

function tacticalMetricDependencies(configKey: string): Record<string, string[]> {
  const parsed = parseAnalyzerDependencies(configKey);
  const out: Record<string, string[]> = {
    power: [],
    control: [],
    timing: [],
    technique: [],
  };
  if (!parsed) return out;

  for (const tacticalKey of Object.keys(out)) {
    const aliases = TACTICAL_ALIAS_WEIGHTS[tacticalKey] || {};
    const deps = new Set<string>();
    for (const alias of Object.keys(aliases)) {
      const rawKeyName = parsed.canonicalRawKeyToName.get(alias);
      if (!rawKeyName) continue;
      const expr = parsed.rawKeyExpr.get(rawKeyName) || "";
      for (const dep of extractMetricDepsFromExpr(expr, parsed.helperExpr, new Set())) {
        deps.add(dep);
      }
    }
    out[tacticalKey] = [...deps].sort((a, b) => a.localeCompare(b));
  }

  return out;
}

function toDetail(def: ScoreDetailDef, metricValues: Record<string, unknown>) {
  return {
    parameters: [...def.parameters],
    values: pickValues(def.parameters, metricValues),
  };
}

export function buildScoreInputsPayload(
  configKey: string,
  metricValues: Record<string, unknown>,
): ScoreInputsPayload {
  const tacticalDeps = tacticalMetricDependencies(configKey);

  return {
    technical: Object.fromEntries(TECHNICAL_DEFS.map((def) => [def.name, toDetail(def, metricValues)])),
    movement: Object.fromEntries(MOVEMENT_DEFS.map((def) => [def.name, toDetail(def, metricValues)])),
    tactical: {
      power: {
        parameters: tacticalDeps.power,
        values: pickValues(tacticalDeps.power, metricValues),
      },
      control: {
        parameters: tacticalDeps.control,
        values: pickValues(tacticalDeps.control, metricValues),
      },
      timing: {
        parameters: tacticalDeps.timing,
        values: pickValues(tacticalDeps.timing, metricValues),
      },
      technique: {
        parameters: tacticalDeps.technique,
        values: pickValues(tacticalDeps.technique, metricValues),
      },
    },
    metadata: {
      configKey,
      generatedAt: new Date().toISOString(),
    },
  };
}
