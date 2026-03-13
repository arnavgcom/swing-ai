const { Client } = require("pg");

const DEFAULT_LIMIT = 5;
const LEGACY_KEYS = [
  "follow",
  "followThrough",
  "follow_through",
  "followThroughQuality",
  "follow_through_quality",
  "followThroughScore",
  "follow_through_score",
  "followthrough",
  "stability",
  "stabilityScore",
  "stability_score",
];

function usageAndExit() {
  console.error(
    "Usage: node scripts/verify_score_payloads.js [--analysis-id <id>] [--filename <name>] [--limit <n>]",
  );
  process.exit(2);
}

function parseArgs(argv) {
  const out = {
    analysisId: null,
    filename: process.env.VIDEO_FILENAME || null,
    limit: Number(process.env.ROW_LIMIT || DEFAULT_LIMIT),
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--analysis-id") {
      out.analysisId = argv[i + 1] || null;
      i += 1;
      continue;
    }
    if (arg === "--filename") {
      out.filename = argv[i + 1] || null;
      i += 1;
      continue;
    }
    if (arg === "--limit") {
      out.limit = Number(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === "-h" || arg === "--help") {
      usageAndExit();
    }
  }

  if (!Number.isFinite(out.limit) || out.limit <= 0) out.limit = DEFAULT_LIMIT;
  return out;
}

function objectOrEmpty(value) {
  return value && typeof value === "object" ? value : {};
}

function presentLegacyKeys(obj) {
  const payload = objectOrEmpty(obj);
  return LEGACY_KEYS.filter((key) => Object.prototype.hasOwnProperty.call(payload, key));
}

function asNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmt(v) {
  const n = asNum(v);
  return n == null ? "-" : n.toFixed(1);
}

function printRow(row) {
  const metricValues = objectOrEmpty(row.metric_values);
  const scoreOutputs = objectOrEmpty(row.score_outputs);

  const legacyInMetricValues = presentLegacyKeys(metricValues);
  const tacticalNode = scoreOutputs?.tactical && typeof scoreOutputs.tactical === "object"
    ? scoreOutputs.tactical
    : {};
  const tacticalComponents = tacticalNode.components && typeof tacticalNode.components === "object"
    ? tacticalNode.components
    : objectOrEmpty(scoreOutputs.tacticalComponents);
  const tactical = asNum(tacticalNode.overall ?? scoreOutputs.tactical);
  const technical = asNum(scoreOutputs?.technical?.overall ?? scoreOutputs.technical);
  const movement = asNum(scoreOutputs?.movement?.overall ?? scoreOutputs.movement);
  const overall = asNum(scoreOutputs.overall);

  console.log("------------------------------------------------------------");
  console.log(`analysisId: ${row.id}`);
  console.log(`video: ${row.video_filename}`);
  console.log(`createdAt: ${row.created_at}`);
  console.log(`detectedMovement: ${row.detected_movement || "-"}`);
  console.log(`configKey: ${row.config_key || "-"}`);
  console.log(`modelVersion: ${row.model_version || "-"}`);

  console.log("\nscore_outputs (/10):");
  console.log(`  technical: ${fmt(technical)}`);
  console.log(`  tactical:  ${fmt(tactical)}`);
  console.log(`  movement:  ${fmt(movement)}`);
  console.log(`  overall:   ${fmt(overall)}`);
  console.log(`  tactical components: ${Object.keys(objectOrEmpty(tacticalComponents)).join(", ") || "-"}`);
  console.log(`  ai_diagnostics present: ${row.ai_diagnostics ? "yes" : "no"}`);

  console.log("\nscore_inputs: ");
  console.log(`  present: ${row.score_inputs ? "yes" : "no"}`);
  console.log(
    `  technical keys: ${Object.keys(objectOrEmpty(row.score_inputs && row.score_inputs.technical)).length}`,
  );
  console.log(
    `  movement keys: ${Object.keys(objectOrEmpty(row.score_inputs && row.score_inputs.movement)).length}`,
  );
  console.log(
    `  tactical keys: ${Object.keys(objectOrEmpty(row.score_inputs && row.score_inputs.tactical)).length}`,
  );

  console.log("\nlegacy key check:");
  console.log(
    `  metric_values has follow/stability keys: ${legacyInMetricValues.length ? "YES" : "no"}`,
  );
  if (legacyInMetricValues.length) {
    console.log(`    keys: ${legacyInMetricValues.join(", ")}`);
  }
  const legacyInTacticalOutputs = presentLegacyKeys(tacticalComponents);
  console.log(
    `  score_outputs tactical components have follow/stability keys: ${legacyInTacticalOutputs.length ? "YES" : "no"}`,
  );
  if (legacyInTacticalOutputs.length) {
    console.log(`    keys: ${legacyInTacticalOutputs.join(", ")}`);
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("NO_DATABASE_URL");
    process.exit(2);
  }

  if (!args.analysisId && !args.filename) {
    usageAndExit();
  }

  const client = new Client({ connectionString });

  const byAnalysisQuery = `
    select
      a.id,
      a.video_filename,
      a.detected_movement,
      a.created_at,
      m.config_key,
      m.model_version,
      m.metric_values,
      m.score_inputs,
      m.score_outputs,
      m.ai_diagnostics
    from analyses a
    left join metrics m on m.analysis_id = a.id
    where a.id = $1
    limit 1
  `;

  const byFilenameQuery = `
    with target as (
      select a.id, a.video_filename, a.detected_movement, a.created_at
      from analyses a
      where a.video_filename = $1
      order by a.created_at desc
      limit $2
    )
    select
      t.id,
      t.video_filename,
      t.detected_movement,
      t.created_at,
      m.config_key,
      m.model_version,
      m.metric_values,
      m.score_inputs,
      m.score_outputs,
      m.ai_diagnostics
    from target t
    left join metrics m on m.analysis_id = t.id
    order by t.created_at desc
  `;

  await client.connect();

  try {
    const result = args.analysisId
      ? await client.query(byAnalysisQuery, [args.analysisId])
      : await client.query(byFilenameQuery, [args.filename, args.limit]);

    console.log("============================================================");
    console.log(
      args.analysisId
        ? `Verify score payloads for analysisId=${args.analysisId}`
        : `Verify score payloads for filename=${args.filename} (limit=${args.limit})`,
    );

    if (!result.rows.length) {
      console.log("No matching rows found.");
      return;
    }

    result.rows.forEach(printRow);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("ERR", error.message);
  process.exit(1);
});
