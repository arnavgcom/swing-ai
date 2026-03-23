const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const DEFAULT_OUTPUT = path.join(PROJECT_ROOT, "model_evaluation_datasets", "tennis_movement_shots.csv");

const CSV_COLUMNS = [
  "analysis_id",
  "user_id",
  "video_filename",
  "shot_index",
  "group_key",
  "label",
  "heuristic_label",
  "heuristic_confidence",
  "heuristic_reasons",
  "dominant_side",
  "dominant_side_confidence",
  "is_cross_body",
  "is_serve",
  "is_compact_forward",
  "is_overhead",
  "is_downward_motion",
  "max_wrist_speed",
  "max_rw_speed",
  "max_lw_speed",
  "swing_arc_ratio",
  "contact_height_ratio",
  "dominant_wrist_median_offset",
  "dominant_wrist_opposite_ratio",
  "dominant_wrist_same_ratio",
  "shoulder_rotation_delta_deg",
  "valid_pose_frames",
];

function normalizeLabel(value) {
  const normalized = String(value || "").trim().toLowerCase().replace(/[_\s]+/g, "-");
  if (["forehand", "backhand", "serve", "volley", "unknown"].includes(normalized)) return normalized;
  return "";
}

function escapeCsv(value) {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function boolNumber(value) {
  return value ? 1 : 0;
}

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : "";
}

function featureFromDiag(diag, manualLabel, row) {
  const dbg = diag?.classificationDebug || {};
  const key = diag?.keyFeatures || {};
  const reasons = Array.isArray(diag?.reasons)
    ? diag.reasons
    : Array.isArray(dbg?.reasons)
      ? dbg.reasons
      : [];
  return {
    analysis_id: row.analysis_id,
    user_id: row.user_id,
    video_filename: row.video_filename,
    shot_index: row.shot_index,
    group_key: row.user_id || row.analysis_id || row.video_filename,
    label: manualLabel,
    heuristic_label: normalizeLabel(diag?.rawLabel || diag?.label),
    heuristic_confidence: num(diag?.confidence),
    heuristic_reasons: reasons.join("|"),
    dominant_side: dbg.dominantSide || key.dominant_side || "",
    dominant_side_confidence: num(dbg.dominantSideConfidence ?? key.dominant_side_confidence),
    is_cross_body: boolNumber(Boolean(dbg.isCrossBody ?? key.is_cross_body)),
    is_serve: boolNumber(Boolean(dbg.isServe ?? key.is_serve)),
    is_compact_forward: boolNumber(Boolean(dbg.isCompactForward ?? key.is_compact_forward)),
    is_overhead: boolNumber(Boolean(dbg.isOverhead ?? key.is_overhead)),
    is_downward_motion: boolNumber(Boolean(dbg.isDownwardMotion ?? key.is_downward_motion)),
    max_wrist_speed: num(dbg.maxWristSpeed ?? key.max_wrist_speed),
    max_rw_speed: num(dbg.rightWristSpeed ?? key.max_rw_speed),
    max_lw_speed: num(dbg.leftWristSpeed ?? key.max_lw_speed),
    swing_arc_ratio: num(dbg.swingArcRatio ?? key.swing_arc_ratio),
    contact_height_ratio: num(dbg.contactHeightRatio ?? key.contact_height_ratio),
    dominant_wrist_median_offset: num(dbg.dominantWristMedianOffset ?? key.dominant_wrist_median_offset),
    dominant_wrist_opposite_ratio: num(dbg.dominantWristOppositeRatio ?? key.dominant_wrist_opposite_ratio),
    dominant_wrist_same_ratio: num(dbg.dominantWristSameRatio ?? key.dominant_wrist_same_ratio),
    shoulder_rotation_delta_deg: num(dbg.shoulderRotationDeltaDeg ?? key.shoulder_rotation_delta_deg),
    valid_pose_frames: num(diag?.validPoseFrames),
  };
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("NO_DATABASE_URL");
    process.exit(2);
  }

  const outputPath = process.env.OUTPUT_CSV || DEFAULT_OUTPUT;
  const client = new Client({ connectionString });
  await client.connect();

  const query = `
    with latest_annotations as (
      select distinct on (ann.analysis_id)
        ann.analysis_id,
        ann.user_id,
        ann.ordered_shot_labels,
        ann.updated_at
      from analysis_shot_annotations ann
      order by ann.analysis_id, ann.updated_at desc
    )
    select
      a.id as analysis_id,
      a.user_id,
      a.video_filename,
      m.ai_diagnostics,
      la.ordered_shot_labels
    from analyses a
    inner join metrics m on m.analysis_id = a.id
    inner join latest_annotations la on la.analysis_id = a.id
    where a.status = 'completed'
      and m.ai_diagnostics is not null
      and lower(coalesce(m.config_key, '')) like 'tennis-%'
    order by a.created_at desc
  `;

  const result = await client.query(query);
  await client.end();

  const rows = [];
  for (const row of result.rows) {
    const diagnostics = row.ai_diagnostics || {};
    const shotDiags = Array.isArray(diagnostics.shotLabelDiagnostics)
      ? diagnostics.shotLabelDiagnostics
      : [];
    const manualLabels = Array.isArray(row.ordered_shot_labels)
      ? row.ordered_shot_labels.map(normalizeLabel)
      : [];
    if (!shotDiags.length || !manualLabels.length) continue;

    for (let index = 0; index < Math.min(shotDiags.length, manualLabels.length); index += 1) {
      const manualLabel = manualLabels[index];
      if (!manualLabel) continue;
      rows.push(featureFromDiag(shotDiags[index], manualLabel, {
        analysis_id: row.analysis_id,
        user_id: row.user_id,
        video_filename: row.video_filename,
        shot_index: index + 1,
      }));
    }
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const csv = [
    CSV_COLUMNS.join(","),
    ...rows.map((row) => CSV_COLUMNS.map((key) => escapeCsv(row[key])).join(",")),
  ].join("\n");
  fs.writeFileSync(outputPath, csv, "utf8");

  console.log(JSON.stringify({
    outputPath,
    rows: rows.length,
    analyses: result.rows.length,
  }, null, 2));
}

main().catch((error) => {
  console.error("ERR", error.message);
  process.exit(1);
});