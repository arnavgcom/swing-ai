import { appSettings } from "@swing-ai/shared/schema";
import { isPoseLandmarkerModel, type PoseLandmarkerModel } from "@swing-ai/shared/pose-landmarker";
import { eq } from "drizzle-orm";
import { buildInsertAuditFields, buildUpdateAuditFields } from "../lib/audit";
import { db } from "../config/db";
import { ensureLocalPoseModelArtifact } from "./model-artifacts";

const POSE_LANDMARKER_MODEL_KEY = "poseLandmarkerModel";
const DEFAULT_POSE_LANDMARKER_MODEL: PoseLandmarkerModel = "lite";
const POSE_LANDMARKER_ENV_KEY = "POSE_LANDMARKER_MODEL";

export async function getPoseLandmarkerModel(actorUserId?: string | null): Promise<PoseLandmarkerModel> {
  const [setting] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, POSE_LANDMARKER_MODEL_KEY))
    .limit(1);

  const rawModel = setting?.value && typeof setting.value === "object"
    ? (setting.value as Record<string, unknown>).model
    : null;

  if (isPoseLandmarkerModel(rawModel)) {
    return rawModel;
  }

  await db
    .insert(appSettings)
    .values({
      key: POSE_LANDMARKER_MODEL_KEY,
      value: { model: DEFAULT_POSE_LANDMARKER_MODEL },
      ...buildInsertAuditFields(actorUserId || null),
    })
    .onConflictDoNothing();

  return DEFAULT_POSE_LANDMARKER_MODEL;
}

export async function setPoseLandmarkerModel(model: PoseLandmarkerModel, actorUserId?: string | null): Promise<void> {
  await db
    .insert(appSettings)
    .values({
      key: POSE_LANDMARKER_MODEL_KEY,
      value: { model },
      ...buildInsertAuditFields(actorUserId || null),
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        value: { model },
        ...buildUpdateAuditFields(actorUserId || null),
      },
    });
}

export async function getPoseLandmarkerPythonEnv(actorUserId?: string | null): Promise<NodeJS.ProcessEnv> {
  const model = await getPoseLandmarkerModel(actorUserId);
  await ensureLocalPoseModelArtifact(model);
  return {
    [POSE_LANDMARKER_ENV_KEY]: model,
  };
}
