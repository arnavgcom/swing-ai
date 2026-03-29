const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

function readConfig(configPath) {
  const abs = path.resolve(process.cwd(), configPath || "scripts/quick_analysis.config.json");
  if (!fs.existsSync(abs)) {
    throw new Error(`Config file not found: ${abs}`);
  }
  const parsed = JSON.parse(fs.readFileSync(abs, "utf8"));
  if (!Array.isArray(parsed.filenames) || parsed.filenames.length === 0) {
    throw new Error("Config must include a non-empty 'filenames' array");
  }
  return parsed;
}

function asNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmt10(value100) {
  const n = asNumber(value100);
  if (n == null) return "-";
  return (n / 10).toFixed(1);
}

function pick(obj, key) {
  if (!obj || typeof obj !== "object") return null;
  const v = obj[key];
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function renderScoreInputs(scoreInputs, tacticalKeys) {
  if (!scoreInputs || typeof scoreInputs !== "object") {
    return "  scoreInputs: <missing>";
  }

  const lines = [];
  lines.push(`  scoreInputs.metadata.configKey: ${scoreInputs?.metadata?.configKey || "-"}`);

  for (const key of tacticalKeys) {
    const node = scoreInputs?.tactical?.[key];
    if (!node) {
      lines.push(`  tactical.${key}: <missing>`);
      continue;
    }
    const params = Array.isArray(node.parameters) ? node.parameters.join(", ") : "";
    const valuesObj = node.values && typeof node.values === "object" ? node.values : {};
    const values = Object.entries(valuesObj)
      .map(([k, v]) => `${k}=${v == null ? "null" : v}`)
      .join(", ");
    lines.push(`  tactical.${key}.parameters: ${params || "-"}`);
    lines.push(`  tactical.${key}.values: ${values || "-"}`);
  }

  return lines.join("\n");
}

async function run() {
  const configPath = process.argv[2] || "scripts/quick_analysis.config.json";
  const cfg = readConfig(configPath);

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set in environment");
  }

  const tacticalKeys = Array.isArray(cfg?.fields?.tactical)
    ? cfg.fields.tactical
    : ["power", "control", "timing", "technique"];

  const highlightKeys = new Set(
    Array.isArray(cfg?.fields?.highlight) ? cfg.fields.highlight : ["power", "technique"],
  );

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    for (const filename of cfg.filenames) {
      const includeSource = cfg.includeSourceFilename !== false;
      const where = includeSource
        ? "(a.video_filename = $1 OR a.source_filename = $1)"
        : "a.video_filename = $1";
      const limit = cfg.latestOnly === false ? 10 : 1;

      const query = `
        SELECT
          a.id,
          a.video_filename,
          a.source_filename,
          a.detected_movement,
          a.created_at,
          m.config_key,
          m.model_version,
          m.overall_score,
          m.metric_values,
          m.score_inputs,
          m.score_outputs
        FROM analyses a
        LEFT JOIN metrics m ON m.analysis_id = a.id
        WHERE ${where}
        ORDER BY a.created_at DESC
        LIMIT ${limit}
      `;

      const result = await client.query(query, [filename]);

      console.log("\n============================================================");
      console.log(`File: ${filename}`);
      if (!result.rows.length) {
        console.log("No analyses found.");
        continue;
      }

      for (const row of result.rows) {
        const tacticalNode = row.score_outputs && typeof row.score_outputs === "object"
          ? (row.score_outputs.tactical || row.score_outputs.tacticalComponents || {})
          : {};
        const sub = tacticalNode && typeof tacticalNode === "object"
          ? (tacticalNode.components && typeof tacticalNode.components === "object" ? tacticalNode.components : tacticalNode)
          : {};
        console.log("------------------------------------------------------------");
        console.log(`analysisId: ${row.id}`);
        console.log(`createdAt: ${row.created_at}`);
        console.log(`detectedMovement: ${row.detected_movement || "-"}`);
        console.log(`configKey: ${row.config_key || "-"}`);
        console.log(`modelVersion: ${row.model_version || "-"}`);
        console.log(`overallScore (/10): ${row.overall_score == null ? "-" : Number(row.overall_score).toFixed(1)}`);

        console.log("tacticalSubScores:");
        for (const key of tacticalKeys) {
          const v100 = pick(sub, key);
          const marker = highlightKeys.has(key) ? "*" : " ";
          console.log(` ${marker} ${key}: ${v100 == null ? "-" : v100.toFixed(0)} (/100), ${fmt10(v100)} (/10)`);
        }

        if (cfg.showScoreInputs) {
          console.log(renderScoreInputs(row.score_inputs, tacticalKeys));
        }
      }
    }

    console.log("\nDone.");
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error(`ERROR: ${err.message}`);
  process.exit(1);
});
