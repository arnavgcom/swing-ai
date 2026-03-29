import { analysisShotAnnotations, analyses, metrics, modelTrainingDatasets, modelTrainingDatasetRows } from "@swing-ai/shared/schema";
import { sql } from "drizzle-orm";
import { buildInsertAuditFields } from "./audit-metadata";
import { db } from "./db";

const TENNIS_MOVEMENT_MODEL_FAMILY = "movement-classifier";

type TrainingShotDiagnostic = {
  shotIndex?: number;
  label?: string;
  rawLabel?: string;
  confidence?: number;
  frames?: number;
  fps?: number;
  validPoseFrames?: number;
  classificationDebug?: Record<string, unknown>;
  reasons?: string[];
  keyFeatures?: Record<string, unknown>;
};

export type TennisTrainingSample = {
  label: string;
  groupKey: string;
  featureValues: Record<string, unknown>;
};

type TennisTrainingDatasetRowInput = {
  analysisId: string;
  userId: string | null;
  videoFilename: string;
  shotIndex: number;
  groupKey: string;
  label: string;
  heuristicLabel: string | null;
  heuristicConfidence: number | null;
  heuristicReasons: string[];
  featureValues: Record<string, unknown>;
};

export type TennisTrainingDatasetSnapshot = {
  datasetId: string;
  outputPath: string;
  rows: number;
  analyses: number;
  samples: TennisTrainingSample[];
};

function normalizeLabel(value: unknown): string {
  const normalized = String(value || "").trim().toLowerCase().replace(/[_\s]+/g, "-");
  if (["forehand", "backhand", "serve", "volley", "unknown"].includes(normalized)) return normalized;
  return "";
}

function numberOrNull(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function boolNumber(value: unknown): number {
  return value ? 1 : 0;
}

function toLabelArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function toShotDiagnosticsArray(diagnostics: Record<string, unknown>): TrainingShotDiagnostic[] {
  if (Array.isArray(diagnostics?.shotLabelDiagnostics)) {
    return diagnostics.shotLabelDiagnostics as TrainingShotDiagnostic[];
  }

  if (Array.isArray(diagnostics?.shotSegments)) {
    return (diagnostics.shotSegments as Array<Record<string, unknown>>).map((segment) => ({
      shotIndex: numberOrNull(segment?.index) ?? undefined,
      label: String(segment?.label || ""),
      rawLabel: String(segment?.rawLabel || segment?.label || ""),
      confidence: numberOrNull(segment?.confidence) ?? undefined,
      frames: numberOrNull(segment?.frames) ?? undefined,
      fps: numberOrNull(diagnostics?.fps) ?? undefined,
      validPoseFrames: numberOrNull(segment?.validPoseFrames) ?? undefined,
      classificationDebug:
        segment?.classificationDebug && typeof segment.classificationDebug === "object"
          ? segment.classificationDebug as Record<string, unknown>
          : {},
      reasons: Array.isArray(segment?.classificationDebug?.reasons)
        ? segment.classificationDebug.reasons as string[]
        : [],
    }));
  }

  return [];
}

function buildFeatureValues(
  diag: TrainingShotDiagnostic,
  row: { analysisId: string; userId: string | null; videoFilename: string; shotIndex: number },
): TennisTrainingDatasetRowInput | null {
  const dbg = diag?.classificationDebug && typeof diag.classificationDebug === "object"
    ? diag.classificationDebug as Record<string, unknown>
    : {};
  const key = diag?.keyFeatures && typeof diag.keyFeatures === "object"
    ? diag.keyFeatures as Record<string, unknown>
    : {};
  const reasons = Array.isArray(diag?.reasons)
    ? diag.reasons
    : Array.isArray(dbg?.reasons)
      ? dbg.reasons as string[]
      : [];
  const rightSpeed = numberOrNull(dbg.rightWristSpeed ?? key.max_rw_speed);
  const leftSpeed = numberOrNull(dbg.leftWristSpeed ?? key.max_lw_speed);
  const maxWristSpeed = numberOrNull(dbg.maxWristSpeed ?? key.max_wrist_speed);
  const swingArcRatio = numberOrNull(dbg.swingArcRatio ?? key.swing_arc_ratio);
  const contactHeightRatio = numberOrNull(dbg.contactHeightRatio ?? key.contact_height_ratio);
  const shoulderRotationDeltaDeg = numberOrNull(dbg.shoulderRotationDeltaDeg ?? key.shoulder_rotation_delta_deg);
  const isServe = Boolean(dbg.isServe ?? key.is_serve);
  const isOverhead = Boolean(dbg.isOverhead ?? key.is_overhead);
  const segmentFrames = numberOrNull(diag?.frames);
  const fps = numberOrNull(diag?.fps);
  const validPoseFrames = numberOrNull(diag?.validPoseFrames);
  const wristSpeedBalanceRatio =
    rightSpeed != null && leftSpeed != null ? Math.max(rightSpeed, leftSpeed) / Math.max(Math.min(rightSpeed, leftSpeed), 1e-6) : null;
  const wristSpeedGap = rightSpeed != null && leftSpeed != null ? Math.abs(rightSpeed - leftSpeed) : null;
  const segmentDurationSec = segmentFrames != null && fps != null && fps > 0 ? segmentFrames / fps : null;
  const validPoseFrameRatio = validPoseFrames != null && segmentFrames != null && segmentFrames > 0 ? validPoseFrames / segmentFrames : null;

  const label = normalizeLabel(diag?.label);
  const heuristicLabel = normalizeLabel(diag?.rawLabel || diag?.label);

  return {
    analysisId: row.analysisId,
    userId: row.userId,
    videoFilename: row.videoFilename,
    shotIndex: row.shotIndex,
    groupKey: row.userId || row.analysisId || row.videoFilename,
    label,
    heuristicLabel: heuristicLabel || null,
    heuristicConfidence: numberOrNull(diag?.confidence),
    heuristicReasons: reasons,
    featureValues: {
      dominant_side: String(dbg.dominantSide ?? key.dominant_side ?? "").trim(),
      dominant_side_confidence: numberOrNull(dbg.dominantSideConfidence ?? key.dominant_side_confidence),
      is_cross_body: boolNumber(Boolean(dbg.isCrossBody ?? key.is_cross_body)),
      is_serve: boolNumber(Boolean(dbg.isServe ?? key.is_serve)),
      is_compact_forward: boolNumber(Boolean(dbg.isCompactForward ?? key.is_compact_forward)),
      is_overhead: boolNumber(Boolean(dbg.isOverhead ?? key.is_overhead)),
      is_downward_motion: boolNumber(Boolean(dbg.isDownwardMotion ?? key.is_downward_motion)),
      max_wrist_speed: maxWristSpeed,
      max_rw_speed: rightSpeed,
      max_lw_speed: leftSpeed,
      swing_arc_ratio: swingArcRatio,
      contact_height_ratio: contactHeightRatio,
      dominant_wrist_median_offset: numberOrNull(dbg.dominantWristMedianOffset ?? key.dominant_wrist_median_offset),
      dominant_wrist_opposite_ratio: numberOrNull(dbg.dominantWristOppositeRatio ?? key.dominant_wrist_opposite_ratio),
      dominant_wrist_same_ratio: numberOrNull(dbg.dominantWristSameRatio ?? key.dominant_wrist_same_ratio),
      dominant_wrist_mean_speed: numberOrNull(dbg.dominantWristMeanSpeed ?? key.dominant_wrist_mean_speed),
      dominant_wrist_speed_std: numberOrNull(dbg.dominantWristSpeedStd ?? key.dominant_wrist_speed_std),
      dominant_wrist_speed_p90: numberOrNull(dbg.dominantWristSpeedP90 ?? key.dominant_wrist_speed_p90),
      dominant_wrist_accel_p90: numberOrNull(dbg.dominantWristAccelP90 ?? key.dominant_wrist_accel_p90),
      peak_speed_frame_ratio: numberOrNull(dbg.peakSpeedFrameRatio ?? key.peak_speed_frame_ratio),
      dominant_wrist_horizontal_range_ratio: numberOrNull(dbg.dominantWristHorizontalRangeRatio ?? key.dominant_wrist_horizontal_range_ratio),
      dominant_wrist_vertical_range_ratio: numberOrNull(dbg.dominantWristVerticalRangeRatio ?? key.dominant_wrist_vertical_range_ratio),
      wrist_height_range: numberOrNull(dbg.wristHeightRange ?? key.wrist_height_range),
      peak_wrist_height_frame_ratio: numberOrNull(dbg.peakWristHeightFrameRatio ?? key.peak_wrist_height_frame_ratio),
      contact_height_std: numberOrNull(dbg.contactHeightStd ?? key.contact_height_std),
      shoulder_rotation_delta_deg: shoulderRotationDeltaDeg,
      shoulder_rotation_range_deg: numberOrNull(dbg.shoulderRotationRangeDeg ?? key.shoulder_rotation_range_deg),
      shoulder_rotation_std_deg: numberOrNull(dbg.shoulderRotationStdDeg ?? key.shoulder_rotation_std_deg),
      dominant_wrist_offset_std: numberOrNull(dbg.dominantWristOffsetStd ?? key.dominant_wrist_offset_std),
      segment_frames: segmentFrames,
      segment_duration_sec: segmentDurationSec,
      valid_pose_frame_ratio: validPoseFrameRatio,
      wrist_speed_balance_ratio: wristSpeedBalanceRatio,
      wrist_speed_gap: wristSpeedGap,
      arc_speed_product: maxWristSpeed != null && swingArcRatio != null ? maxWristSpeed * swingArcRatio : null,
      contact_arc_product: contactHeightRatio != null && swingArcRatio != null ? contactHeightRatio * swingArcRatio : null,
      serve_height_product: contactHeightRatio != null ? (isServe ? 1 : 0) * contactHeightRatio : null,
      overhead_contact_product: contactHeightRatio != null ? (isOverhead ? 1 : 0) * contactHeightRatio : null,
      shoulder_rotation_abs_deg: shoulderRotationDeltaDeg != null ? Math.abs(shoulderRotationDeltaDeg) : null,
      valid_pose_frames: validPoseFrames,
    },
  };
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

export async function exportTennisTrainingDatasetSnapshot(params?: {
  actorUserId?: string | null;
  datasetName?: string;
  notes?: string;
}): Promise<TennisTrainingDatasetSnapshot> {
  const countsResult = await db.execute(sql`
    with latest_annotations as (
      select distinct on (ann.analysis_id)
        ann.analysis_id,
        ann.user_id,
        ann.ordered_shot_labels,
        ann.include_in_training,
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
      and la.include_in_training = true
      and lower(coalesce(m.config_key, '')) like 'tennis-%'
    order by a.created_at desc
  `);

  const rows = Array.isArray((countsResult as any).rows) ? (countsResult as any).rows : [];
  const datasetRows: TennisTrainingDatasetRowInput[] = [];
  const trainingSamples: TennisTrainingSample[] = [];
  const analysisIds = new Set<string>();

  for (const row of rows) {
    const diagnostics = row.ai_diagnostics && typeof row.ai_diagnostics === "object"
      ? row.ai_diagnostics as Record<string, unknown>
      : {};
    const shotDiags = toShotDiagnosticsArray(diagnostics);
    const manualLabels = toLabelArray(row.ordered_shot_labels).map(normalizeLabel);
    if (!shotDiags.length || !manualLabels.length) continue;

    for (let index = 0; index < Math.min(shotDiags.length, manualLabels.length); index += 1) {
      const manualLabel = manualLabels[index];
      if (!manualLabel) continue;
      const built = buildFeatureValues(shotDiags[index], {
        analysisId: String(row.analysis_id),
        userId: row.user_id ? String(row.user_id) : null,
        videoFilename: String(row.video_filename || ""),
        shotIndex: index + 1,
      });
      if (!built) continue;

      datasetRows.push({
        ...built,
        label: manualLabel,
      });
      trainingSamples.push({
        label: manualLabel,
        groupKey: built.groupKey,
        featureValues: built.featureValues,
      });
      analysisIds.add(String(row.analysis_id));
    }
  }

  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const datasetName = String(params?.datasetName || `tennis-training-${timestamp}`).trim();
  const actorUserId = params?.actorUserId || null;

  const [dataset] = await db
    .insert(modelTrainingDatasets)
    .values({
      modelFamily: TENNIS_MOVEMENT_MODEL_FAMILY,
      sportName: "tennis",
      datasetName,
      source: "manual-annotation",
      analysisCount: analysisIds.size,
      rowCount: datasetRows.length,
      notes: params?.notes || null,
      ...buildInsertAuditFields(actorUserId),
    })
    .returning({ id: modelTrainingDatasets.id });

  if (datasetRows.length > 0) {
    for (const chunk of chunkArray(datasetRows, 500)) {
      await db.insert(modelTrainingDatasetRows).values(
        chunk.map((row) => ({
          datasetId: dataset.id,
          analysisId: row.analysisId,
          userId: row.userId,
          videoFilename: row.videoFilename,
          shotIndex: row.shotIndex,
          groupKey: row.groupKey,
          label: row.label,
          heuristicLabel: row.heuristicLabel,
          heuristicConfidence: row.heuristicConfidence,
          heuristicReasons: row.heuristicReasons,
          featureValues: row.featureValues,
          ...buildInsertAuditFields(actorUserId),
        })),
      );
    }
  }

  return {
    datasetId: dataset.id,
    outputPath: `database://model-training-datasets/${dataset.id}`,
    rows: datasetRows.length,
    analyses: analysisIds.size,
    samples: trainingSamples,
  };
}