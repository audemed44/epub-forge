import { useEffect, useMemo, useState } from "react";
import { deleteJson, getJson, postJson } from "../../../shared/api/client";
import { isBuildJobStatus, isQueueListResponse } from "../../../shared/api/guards";
import { sanitizeFilenameFromHeader } from "../../../shared/utils/format";
import type { QueueJob } from "../../../shared/types/api";

type UseQueueOptions = {
  setStatus: (value: string) => void;
};

export type QueueScope = "active" | "archive";

export function useQueue({ setStatus }: UseQueueOptions) {
  const [scope, setScope] = useState<QueueScope>("active");
  const [queueJobs, setQueueJobs] = useState<QueueJob[]>([]);
  const [selectedQueueJobId, setSelectedQueueJobId] = useState<string | null>(null);
  const [selectedQueueJobLogs, setSelectedQueueJobLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  const selectedQueueJob = useMemo(
    () => queueJobs.find((job) => job.id === selectedQueueJobId) || null,
    [queueJobs, selectedQueueJobId]
  );

  useEffect(() => {
    setSelectedQueueJobId(null);
    setSelectedQueueJobLogs([]);
  }, [scope]);

  async function loadQueueJobs() {
    const result = await getJson<unknown>(`/api/build-jobs?scope=${scope}`);
    if (!result.ok || !isQueueListResponse(result.data)) {
      return;
    }
    setQueueJobs(result.data.jobs);
    const selectedStillExists = selectedQueueJobId && result.data.jobs.some((job) => job.id === selectedQueueJobId);
    if (!selectedStillExists) {
      setSelectedQueueJobId(result.data.jobs[0]?.id || null);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      if (cancelled) {
        return;
      }
      await loadQueueJobs();
      if (selectedQueueJobId) {
        const result = await getJson<unknown>(`/api/build-jobs/${selectedQueueJobId}`);
        if (result.ok && isBuildJobStatus(result.data)) {
          setSelectedQueueJobLogs(result.data.logs);
        }
      }
    }

    void tick();
    const timer = setInterval(() => {
      void tick();
    }, 1500);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [scope, selectedQueueJobId]);

  async function onDownloadJob(jobId: string) {
    try {
      const response = await fetch(`/api/build-jobs/${jobId}/file`);
      if (!response.ok) {
        const err = (await response.json()) as { error?: string };
        throw new Error(err.error || "Download failed");
      }
      const blob = await response.blob();
      const filename = sanitizeFilenameFromHeader(response.headers.get("content-disposition"));
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = filename;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Download failed");
    }
  }

  async function onMoveToBookdrop(jobId: string) {
    try {
      const result = await postJson<{ ok?: boolean; error?: string }>(`/api/build-jobs/${jobId}/move-to-bookdrop`, {});
      if (!result.ok || !result.data.ok) {
        throw new Error(result.data.error || "Move to bookdrop failed");
      }

      setStatus("Moved EPUB to bookdrop.");
      await loadQueueJobs();
      if (selectedQueueJobId === jobId) {
        const detailResult = await getJson<unknown>(`/api/build-jobs/${jobId}`);
        if (detailResult.ok && isBuildJobStatus(detailResult.data)) {
          setSelectedQueueJobLogs(detailResult.data.logs);
        }
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Move to bookdrop failed");
    }
  }

  async function onClearAllQueue() {
    const shouldClear = window.confirm("Clear all queue entries and remove generated EPUB files from output storage? (Bookdrop files are not touched.)");
    if (!shouldClear) {
      return;
    }

    try {
      const result = await deleteJson<{ ok?: boolean; error?: string }>("/api/build-jobs");
      if (!result.ok || !result.data.ok) {
        throw new Error(result.data.error || "Failed to clear queue");
      }

      setQueueJobs([]);
      setSelectedQueueJobId(null);
      setSelectedQueueJobLogs([]);
      setStatus("Cleared queue and output EPUBs.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to clear queue");
    }
  }

  return {
    scope,
    setScope,
    queueJobs,
    selectedQueueJobId,
    setSelectedQueueJobId,
    selectedQueueJob,
    selectedQueueJobLogs,
    showLogs,
    setShowLogs,
    loadQueueJobs,
    onDownloadJob,
    onMoveToBookdrop,
    onClearAllQueue,
  };
}
