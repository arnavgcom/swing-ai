import { extractPipelineTiming } from "@swing-ai/shared/pipeline-timing";

export const ANALYSIS_PROCESSING_POLL_INTERVAL_MS = 2000;
export const ANALYSIS_ENRICHMENT_POLL_INTERVAL_MS = 2500;

export function isAnalysisStatusInFlight(status: string | null | undefined): boolean {
  return status === "pending" || status === "processing";
}

function getDiagnosticsStageStatus(pipelineSource: unknown): "pending" | "running" | "completed" | "failed" | null {
  const timing = extractPipelineTiming(pipelineSource);
  const diagnosticsStage = timing?.stages.find((stage) => stage.key === "diagnostics");
  return diagnosticsStage?.status || null;
}

export function getAnalysisRefreshIntervalMs(
  analysisStatus: string | null | undefined,
  pipelineSource?: unknown,
): number | false {
  if (isAnalysisStatusInFlight(analysisStatus)) {
    return ANALYSIS_PROCESSING_POLL_INTERVAL_MS;
  }

  if (analysisStatus !== "completed") {
    return false;
  }

  const diagnosticsStageStatus = getDiagnosticsStageStatus(pipelineSource);
  if (diagnosticsStageStatus === "pending" || diagnosticsStageStatus === "running") {
    return ANALYSIS_ENRICHMENT_POLL_INTERVAL_MS;
  }

  return false;
}

export function getCompletedAnalysisEnrichmentMessage(
  analysisStatus: string | null | undefined,
  pipelineSource?: unknown,
): string | null {
  if (analysisStatus !== "completed") {
    return null;
  }

  const diagnosticsStageStatus = getDiagnosticsStageStatus(pipelineSource);
  if (diagnosticsStageStatus === "pending" || diagnosticsStageStatus === "running") {
    return "Metrics, scores, and coaching are updating in the background.";
  }

  return null;
}