import { PROJECT_ROOT } from "../server/env";
import fs from "node:fs/promises";
import path from "node:path";
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

type UploadPlan = {
  localPath: string;
  key: string;
  overwrite: boolean;
  label: string;
};

function getRequiredEnv(name: string): string {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getArtifactPrefix(): string {
  return String(process.env.R2_PLAYER_MODEL_FOLDER || process.env.R2_MODEL_FOLDER || "model")
    .trim()
    .replace(/^\/+|\/+$/g, "") || "model";
}

function buildClient(): S3Client {
  return new S3Client({
    region: String(process.env.R2_REGION || "auto").trim() || "auto",
    endpoint: getRequiredEnv("R2_ENDPOINT"),
    forcePathStyle: true,
    credentials: {
      accessKeyId: getRequiredEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: getRequiredEnv("R2_SECRET_ACCESS_KEY"),
    },
  });
}

async function r2ObjectExists(client: S3Client, bucket: string, key: string): Promise<boolean> {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (error) {
    const candidate = error as {
      name?: string;
      Code?: string;
      $metadata?: { httpStatusCode?: number };
    };
    const statusCode = Number(candidate?.$metadata?.httpStatusCode || 0);
    const code = String(candidate?.Code || candidate?.name || "").toLowerCase();
    if (statusCode === 404 || code === "notfound" || code === "nosuchkey") {
      return false;
    }
    throw error;
  }
}

async function listVersionPlans(prefix: string): Promise<UploadPlan[]> {
  const versionsDir = path.resolve(PROJECT_ROOT, "models", "versions");
  const entries = await fs.readdir(versionsDir, { withFileTypes: true }).catch(() => []);

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".joblib"))
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" }))
    .map((entry) => ({
      localPath: path.join(versionsDir, entry.name),
      key: `${prefix}/tennis/classification/versions/${entry.name}`,
      overwrite: false,
      label: `classifier archive ${entry.name}`,
    }));
}

async function buildUploadPlan(prefix: string): Promise<UploadPlan[]> {
  const versionPlans = await listVersionPlans(prefix);

  return [
    {
      localPath: path.resolve(PROJECT_ROOT, "models", "tennis_movement_classifier.joblib"),
      key: `${prefix}/tennis/classification/active/tennis_movement_classifier.joblib`,
      overwrite: true,
      label: "active classifier alias",
    },
    ...versionPlans,
    {
      localPath: path.resolve(PROJECT_ROOT, "models", "pose_landmarker_lite.task"),
      key: `${prefix}/pose/pose_landmarker_lite.task`,
      overwrite: false,
      label: "pose lite",
    },
    {
      localPath: path.resolve(PROJECT_ROOT, "models", "pose_landmarker_full.task"),
      key: `${prefix}/pose/pose_landmarker_full.task`,
      overwrite: false,
      label: "pose full",
    },
    {
      localPath: path.resolve(PROJECT_ROOT, "models", "pose_landmarker_heavy.task"),
      key: `${prefix}/pose/pose_landmarker_heavy.task`,
      overwrite: false,
      label: "pose heavy",
    },
  ];
}

async function main(): Promise<void> {
  const bucket = getRequiredEnv("R2_BUCKET");
  const prefix = getArtifactPrefix();
  const client = buildClient();
  const uploads = await buildUploadPlan(prefix);

  console.log(`Seeding model artifacts to r2 bucket=${bucket} prefix=${prefix}`);

  for (const upload of uploads) {
    const alreadyExists = await r2ObjectExists(client, bucket, upload.key);
    if (alreadyExists && !upload.overwrite) {
      console.log(`SKIP ${upload.label} key=${upload.key}`);
      continue;
    }

    const body = await fs.readFile(upload.localPath);
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: upload.key,
      Body: body,
      ContentType: "application/octet-stream",
    }));
    console.log(`${alreadyExists ? "UPDATED" : "UPLOADED"} ${upload.label} key=${upload.key}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});