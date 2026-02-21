import { useEffect, useMemo, useState } from "react";

type Metadata = {
  sourceUrl: string;
  title: string;
  author: string;
  language: string;
  description: string | null;
  coverImageUrl: string | null;
  fileName: string | null;
};

type ChapterRef = {
  id: string;
  sourceUrl: string;
  title: string;
};

type PreviewResponse = {
  parserId: string;
  metadata: {
    sourceUrl: string;
    title: string;
    author: string;
    language: string;
    description: string | null;
    coverImageUrl: string | null;
  };
  chapters: ChapterRef[];
};

type QueueJob = {
  id: string;
  status: "queued" | "running" | "done" | "error";
  progress: {
    stage: string;
    completed: number;
    total: number;
  };
  error: string | null;
  createdAt: number;
  finishedAt: number | null;
  hasResult: boolean;
  title: string | null;
  fileName: string | null;
  totalChapters: number;
  movedToBookdrop: boolean;
  bookdropPath: string | null;
};

type QueueListResponse = { jobs: QueueJob[] };

type BuildJobStatus = QueueJob & { logs: string[] };

type ViewTab = "builder" | "queue";

function isPreviewResponse(value: unknown): value is PreviewResponse {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.parserId === "string" && Array.isArray(record.chapters) && typeof record.metadata === "object";
}

function isQueueListResponse(value: unknown): value is QueueListResponse {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return Array.isArray(record.jobs);
}

function isBuildJobStatus(value: unknown): value is BuildJobStatus {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.status === "string" && Array.isArray(record.logs);
}

function sanitizeFilenameFromHeader(disposition: string | null): string {
  if (!disposition) {
    return "book.epub";
  }

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      // ignore decode failure
    }
  }

  const plainMatch = disposition.match(/filename="([^"]+)"/i);
  return plainMatch?.[1] ?? "book.epub";
}

function chapterLabel(chapter: ChapterRef, index: number): string {
  return `${String(index + 1).padStart(4, "0")} - ${chapter.title}`;
}

function basenameFromPath(input: string): string {
  return input.split(/[\\/]/).pop() || input;
}

function formatStatus(job: QueueJob): string {
  if (job.status === "running") {
    return `${job.progress.completed}/${job.progress.total || job.totalChapters}`;
  }
  if (job.status === "queued") {
    return "Queued";
  }
  if (job.status === "done") {
    return "Completed";
  }
  return "Failed";
}

export function App() {
  const [activeTab, setActiveTab] = useState<ViewTab>("builder");

  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("Paste a URL and preview chapters.");
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isEnqueueing, setIsEnqueueing] = useState(false);

  const [parserId, setParserId] = useState<string | null>(null);
  const [chapters, setChapters] = useState<ChapterRef[]>([]);
  const [startIndex, setStartIndex] = useState(0);
  const [endIndex, setEndIndex] = useState(0);

  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [language, setLanguage] = useState("en");
  const [description, setDescription] = useState("");
  const [fileName, setFileName] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [detectedCoverImageUrl, setDetectedCoverImageUrl] = useState("");
  const [coverUploadName, setCoverUploadName] = useState("");

  const [queueJobs, setQueueJobs] = useState<QueueJob[]>([]);
  const [selectedQueueJobId, setSelectedQueueJobId] = useState<string | null>(null);
  const [selectedQueueJobLogs, setSelectedQueueJobLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  const hasPreview = chapters.length > 0;

  const selectedRange = useMemo(() => {
    const start = Math.max(0, Math.min(startIndex, chapters.length - 1));
    const end = Math.max(0, Math.min(endIndex, chapters.length - 1));
    return { start: Math.min(start, end), end: Math.max(start, end) };
  }, [chapters.length, endIndex, startIndex]);

  const selectedChapters = useMemo(
    () => chapters.slice(selectedRange.start, selectedRange.end + 1),
    [chapters, selectedRange.end, selectedRange.start]
  );

  const selectedQueueJob = useMemo(
    () => queueJobs.find((job) => job.id === selectedQueueJobId) || null,
    [queueJobs, selectedQueueJobId]
  );

  async function loadQueueJobs() {
    const response = await fetch("/api/build-jobs");
    const data = (await response.json()) as unknown;
    if (!response.ok || !isQueueListResponse(data)) {
      return;
    }
    setQueueJobs(data.jobs);
    if (!selectedQueueJobId && data.jobs.length > 0) {
      setSelectedQueueJobId(data.jobs[0].id);
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
        const response = await fetch(`/api/build-jobs/${selectedQueueJobId}`);
        const data = (await response.json()) as unknown;
        if (response.ok && isBuildJobStatus(data)) {
          setSelectedQueueJobLogs(data.logs);
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
  }, [selectedQueueJobId]);

  async function onPreview() {
    const inputUrl = url.trim();
    if (!inputUrl) {
      setStatus("Enter a URL first.");
      return;
    }

    setIsPreviewLoading(true);
    setStatus("Fetching metadata and chapter list...");

    try {
      const response = await fetch("/api/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: inputUrl }),
      });

      const data = (await response.json()) as unknown;
      if (!response.ok || !isPreviewResponse(data)) {
        const message =
          typeof data === "object" && data !== null && "error" in data && typeof (data as { error?: unknown }).error === "string"
            ? (data as { error: string }).error
            : "Preview failed";
        throw new Error(message);
      }

      setParserId(data.parserId);
      setChapters(data.chapters);
      setStartIndex(0);
      setEndIndex(Math.max(data.chapters.length - 1, 0));

      setTitle(data.metadata.title || "");
      setAuthor(data.metadata.author || "");
      setLanguage(data.metadata.language || "en");
      setDescription(data.metadata.description || "");
      setCoverImageUrl(data.metadata.coverImageUrl || "");
      setDetectedCoverImageUrl(data.metadata.coverImageUrl || "");
      setCoverUploadName("");
      setFileName(data.metadata.title || "");

      setStatus(`Loaded ${data.chapters.length} chapters with parser '${data.parserId}'.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Preview failed");
    } finally {
      setIsPreviewLoading(false);
    }
  }

  async function onEnqueueBuild() {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setStatus("Enter a URL first.");
      return;
    }
    if (!parserId) {
      setStatus("Run preview before building.");
      return;
    }
    if (selectedChapters.length === 0) {
      setStatus("Pick a valid chapter range.");
      return;
    }

    const payload: {
      url: string;
      parserId: string;
      chapterUrls: string[];
      metadata: Metadata;
      forceDuplicate?: boolean;
    } = {
      url: trimmedUrl,
      parserId,
      chapterUrls: selectedChapters.map((chapter) => chapter.sourceUrl),
      metadata: {
        sourceUrl: trimmedUrl,
        title: title.trim(),
        author: author.trim(),
        language: language.trim() || "en",
        description: description.trim() || null,
        coverImageUrl: coverImageUrl.trim() || null,
        fileName: fileName.trim() || title.trim() || null,
      },
    };

    setIsEnqueueing(true);
    try {
      const requestedFileName = payload.metadata.fileName || "";
      if (requestedFileName) {
        const duplicateResponse = await fetch(`/api/build-jobs/name-exists?fileName=${encodeURIComponent(requestedFileName)}`);
        const duplicateData = (await duplicateResponse.json()) as { exists?: boolean };
        if (duplicateResponse.ok && duplicateData.exists) {
          const shouldProceed = window.confirm("A queued build with that file name already exists. Are you sure you want to continue?");
          if (!shouldProceed) {
            setStatus("Build cancelled due to duplicate file name.");
            return;
          }
          payload.forceDuplicate = true;
        }
      }

      const response = await fetch("/api/build-jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { jobId?: string; error?: string };
      if (!response.ok || !data.jobId) {
        throw new Error(data.error || "Failed to enqueue build job");
      }

      setSelectedQueueJobId(data.jobId);
      setStatus(`Build job queued (${data.jobId.slice(0, 8)}).`);
      await loadQueueJobs();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to enqueue build");
    } finally {
      setIsEnqueueing(false);
    }
  }

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
      const response = await fetch(`/api/build-jobs/${jobId}/move-to-bookdrop`, {
        method: "POST",
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Move to bookdrop failed");
      }

      setStatus("Moved EPUB to bookdrop.");
      await loadQueueJobs();
      if (selectedQueueJobId === jobId) {
        const detailResponse = await fetch(`/api/build-jobs/${jobId}`);
        const detailData = (await detailResponse.json()) as unknown;
        if (detailResponse.ok && isBuildJobStatus(detailData)) {
          setSelectedQueueJobLogs(detailData.logs);
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
      const response = await fetch("/api/build-jobs", { method: "DELETE" });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to clear queue");
      }

      setQueueJobs([]);
      setSelectedQueueJobId(null);
      setSelectedQueueJobLogs([]);
      setStatus("Cleared queue and output EPUBs.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to clear queue");
    }
  }

  async function onCoverUpload(file: File | null) {
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      setStatus("Cover upload must be an image file.");
      return;
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
          return;
        }
        reject(new Error("Could not read uploaded file."));
      };
      reader.onerror = () => reject(new Error("Could not read uploaded file."));
      reader.readAsDataURL(file);
    });

    setCoverImageUrl(dataUrl);
    setCoverUploadName(file.name);
    setStatus(`Using uploaded cover file: ${file.name}`);
  }

  return (
    <main className="shell">
      <aside className="side-nav">
        <button type="button" className={activeTab === "builder" ? "nav-item active" : "nav-item"} onClick={() => setActiveTab("builder")}>
          Builder
        </button>
        <button type="button" className={activeTab === "queue" ? "nav-item active" : "nav-item"} onClick={() => setActiveTab("queue")}>
          Queue ({queueJobs.filter((j) => j.status === "queued" || j.status === "running").length})
        </button>
      </aside>

      <div className="main-pane">
        <section className="hero">
          <div className="hero-top">
            <p className="eyebrow">Self-hosted WebToEpub</p>
          </div>
          <h1>Build EPUBs from your phone</h1>
          <p className="lead">Queue multiple builds, monitor progress, and download each finished EPUB when ready.</p>
        </section>

        <section className="panel">
          <label htmlFor="story-url">Story URL</label>
          <div className="url-row">
            <input
              id="story-url"
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://www.royalroad.com/fiction/151470/re-knight-litrpg-regression"
            />
            <button onClick={onPreview} disabled={isPreviewLoading}>
              {isPreviewLoading ? "Loading..." : "Preview"}
            </button>
          </div>
          <p className="status">{status}</p>
        </section>

        {activeTab === "builder" && (
          <>
            <section className={`panel ${hasPreview ? "" : "hidden"}`}>
              <div className="panel-head">
                <h2>Metadata</h2>
                <span className="badge">{parserId ?? "unknown parser"}</span>
              </div>
              <div className="fields-grid">
                <label>
                  Title
                  <input value={title} onChange={(event) => setTitle(event.target.value)} />
                </label>
                <label>
                  Final EPUB file name
                  <input value={fileName} onChange={(event) => setFileName(event.target.value)} placeholder="Book name" />
                </label>
                <label>
                  Author
                  <input value={author} onChange={(event) => setAuthor(event.target.value)} />
                </label>
                <label>
                  Language
                  <input value={language} onChange={(event) => setLanguage(event.target.value)} />
                </label>
                <label className="full-width">
                  Description
                  <textarea value={description} rows={4} onChange={(event) => setDescription(event.target.value)} />
                </label>
                <label className="full-width">
                  Cover image URL (optional)
                  <input
                    type="url"
                    value={coverImageUrl}
                    onChange={(event) => {
                      setCoverImageUrl(event.target.value);
                      setCoverUploadName("");
                    }}
                    placeholder="https://example.com/cover.jpg"
                  />
                </label>
                <label className="full-width">
                  Upload cover image (optional)
                  <input type="file" accept="image/*" onChange={(event) => void onCoverUpload(event.target.files?.[0] ?? null)} />
                </label>
                {coverUploadName ? <p className="cover-upload-name">Uploaded: {coverUploadName}</p> : null}
                <div className="cover-actions full-width">
                  <button
                    type="button"
                    onClick={() => {
                      setCoverImageUrl(detectedCoverImageUrl);
                      setCoverUploadName("");
                    }}
                  >
                    Use detected cover
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCoverImageUrl("");
                      setCoverUploadName("");
                    }}
                  >
                    Remove cover
                  </button>
                </div>
                {coverImageUrl ? (
                  <div className="cover-preview full-width">
                    <p>Cover Preview</p>
                    <img src={coverImageUrl} alt="Cover preview" />
                  </div>
                ) : null}
              </div>
            </section>

            <section className={`panel ${hasPreview ? "" : "hidden"}`}>
              <div className="panel-head">
                <h2>Chapter Range</h2>
                <button onClick={onEnqueueBuild} disabled={isEnqueueing || !hasPreview}>
                  {isEnqueueing ? "Queueing..." : "Add Build To Queue"}
                </button>
              </div>
              <div className="fields-grid">
                <label>
                  Start chapter
                  <select value={startIndex} onChange={(event) => setStartIndex(Number(event.target.value))}>
                    {chapters.map((chapter, index) => (
                      <option key={chapter.id} value={index}>
                        {chapterLabel(chapter, index)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  End chapter
                  <select value={endIndex} onChange={(event) => setEndIndex(Number(event.target.value))}>
                    {chapters.map((chapter, index) => (
                      <option key={chapter.id} value={index}>
                        {chapterLabel(chapter, index)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="hint">
                {hasPreview
                  ? `Will queue ${selectedChapters.length} chapters: “${chapters[selectedRange.start]?.title || ""}” to “${chapters[selectedRange.end]?.title || ""}”.`
                  : ""}
              </p>
            </section>
          </>
        )}

        {activeTab === "queue" && (
          <section className="panel queue-panel">
            <div className="panel-head">
              <h2>Build Queue</h2>
              <div className="queue-head-actions">
                <button type="button" onClick={() => void loadQueueJobs()}>Refresh</button>
                <button type="button" onClick={() => void onClearAllQueue()} disabled={queueJobs.length === 0}>
                  Clear All
                </button>
              </div>
            </div>

            {queueJobs.length === 0 ? (
              <p className="hint">No build jobs queued yet.</p>
            ) : (
              <div className="queue-grid">
                <div className="queue-list">
                  {queueJobs.map((job) => (
                    <button
                      type="button"
                      key={job.id}
                      className={selectedQueueJobId === job.id ? "queue-item active" : "queue-item"}
                      onClick={() => setSelectedQueueJobId(job.id)}
                    >
                      <strong>{job.fileName || job.title || "Untitled"}</strong>
                      <span>{formatStatus(job)}</span>
                    </button>
                  ))}
                </div>

                <div className="queue-detail">
                  {selectedQueueJob ? (
                    <>
                      <p><strong>Status:</strong> {selectedQueueJob.status}</p>
                      <p>
                        <strong>Progress:</strong> {selectedQueueJob.progress.completed}/{selectedQueueJob.progress.total || selectedQueueJob.totalChapters}
                      </p>
                      <progress
                        max={Math.max(selectedQueueJob.progress.total || selectedQueueJob.totalChapters || 1, 1)}
                        value={Math.min(
                          selectedQueueJob.progress.completed,
                          Math.max(selectedQueueJob.progress.total || selectedQueueJob.totalChapters || 1, 1)
                        )}
                      />

                      {selectedQueueJob.status === "done" && selectedQueueJob.hasResult && (
                        <div className="queue-actions">
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() => void onDownloadJob(selectedQueueJob.id)}
                            disabled={selectedQueueJob.movedToBookdrop}
                            title={selectedQueueJob.movedToBookdrop ? "Moved to bookdrop" : "Download EPUB"}
                            aria-label={selectedQueueJob.movedToBookdrop ? "Moved to bookdrop" : "Download EPUB"}
                          >
                            <span aria-hidden="true">{selectedQueueJob.movedToBookdrop ? "✓" : "↓"}</span>
                          </button>
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() => void onMoveToBookdrop(selectedQueueJob.id)}
                            disabled={selectedQueueJob.movedToBookdrop}
                            title="Move to bookdrop"
                            aria-label="Move to bookdrop"
                          >
                            <span aria-hidden="true">↪</span>
                          </button>
                        </div>
                      )}

                      {selectedQueueJob.movedToBookdrop ? (
                        <p className="hint">Moved to: {selectedQueueJob.bookdropPath ? basenameFromPath(selectedQueueJob.bookdropPath) : "bookdrop"}</p>
                      ) : null}

                      {selectedQueueJob.error ? <p className="queue-error">{selectedQueueJob.error}</p> : null}

                      <label className="logs-toggle">
                        <input type="checkbox" checked={showLogs} onChange={(event) => setShowLogs(event.target.checked)} /> Show logs
                      </label>

                      {showLogs && (
                        <pre className="build-logs">
                          {selectedQueueJobLogs.length ? selectedQueueJobLogs.join("\n") : "No logs yet..."}
                        </pre>
                      )}
                    </>
                  ) : (
                    <p className="hint">Select a queue item to see details.</p>
                  )}
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
