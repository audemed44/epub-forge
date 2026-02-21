import { basenameFromPath, formatStatus } from "../../shared/utils/format";
import type { QueueJob } from "../../shared/types/api";

type QueueTabProps = {
  scope: "active" | "archive";
  setScope: (value: "active" | "archive") => void;
  queueJobs: QueueJob[];
  selectedQueueJobId: string | null;
  setSelectedQueueJobId: (value: string) => void;
  selectedQueueJob: QueueJob | null;
  selectedQueueJobLogs: string[];
  showLogs: boolean;
  setShowLogs: (value: boolean) => void;
  loadQueueJobs: () => Promise<void>;
  onClearAllQueue: () => Promise<void>;
  onDownloadJob: (jobId: string) => Promise<void>;
  onMoveToBookdrop: (jobId: string) => Promise<void>;
};

export function QueueTab(props: QueueTabProps) {
  const archiveMode = props.scope === "archive";

  return (
    <section className="panel queue-panel">
      <div className="panel-head">
        <h2>Build Queue</h2>
        <div className="queue-head-actions">
          <button type="button" className={archiveMode ? "tab-pill" : "tab-pill active"} onClick={() => props.setScope("active")}>
            Queue
          </button>
          <button type="button" className={archiveMode ? "tab-pill active" : "tab-pill"} onClick={() => props.setScope("archive")}>
            Archive
          </button>
          <button type="button" onClick={() => void props.loadQueueJobs()}>
            Refresh
          </button>
          <button type="button" onClick={() => void props.onClearAllQueue()} disabled={props.queueJobs.length === 0 || archiveMode}>
            Clear All
          </button>
        </div>
      </div>

      {props.queueJobs.length === 0 ? (
        <p className="hint">{archiveMode ? "No archived jobs yet." : "No build jobs queued yet."}</p>
      ) : (
        <div className="queue-grid">
          <div className="queue-list">
            {props.queueJobs.map((job) => (
              <button
                type="button"
                key={job.id}
                className={props.selectedQueueJobId === job.id ? "queue-item active" : "queue-item"}
                onClick={() => props.setSelectedQueueJobId(job.id)}
              >
                <strong>{job.fileName || job.title || "Untitled"}</strong>
                <span>{formatStatus(job)}</span>
              </button>
            ))}
          </div>

          <div className="queue-detail">
            {props.selectedQueueJob ? (
              <>
                <p>
                  <strong>Status:</strong> {props.selectedQueueJob.status}
                </p>
                <p>
                  <strong>Progress:</strong> {props.selectedQueueJob.progress.completed}/
                  {props.selectedQueueJob.progress.total || props.selectedQueueJob.totalChapters}
                </p>
                <progress
                  max={Math.max(props.selectedQueueJob.progress.total || props.selectedQueueJob.totalChapters || 1, 1)}
                  value={Math.min(
                    props.selectedQueueJob.progress.completed,
                    Math.max(props.selectedQueueJob.progress.total || props.selectedQueueJob.totalChapters || 1, 1)
                  )}
                />

                {!archiveMode && props.selectedQueueJob.status === "done" && props.selectedQueueJob.hasResult && (
                  <div className="queue-actions">
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => void props.onDownloadJob(props.selectedQueueJob!.id)}
                      disabled={props.selectedQueueJob.movedToBookdrop}
                      title={props.selectedQueueJob.movedToBookdrop ? "Moved to bookdrop" : "Download EPUB"}
                      aria-label={props.selectedQueueJob.movedToBookdrop ? "Moved to bookdrop" : "Download EPUB"}
                    >
                      <span aria-hidden="true">{props.selectedQueueJob.movedToBookdrop ? "Done" : "DL"}</span>
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => void props.onMoveToBookdrop(props.selectedQueueJob!.id)}
                      disabled={props.selectedQueueJob.movedToBookdrop}
                      title="Move to bookdrop"
                      aria-label="Move to bookdrop"
                    >
                      <span aria-hidden="true">Move</span>
                    </button>
                  </div>
                )}

                {props.selectedQueueJob.movedToBookdrop ? (
                  <p className="hint">
                    Moved to: {props.selectedQueueJob.bookdropPath ? basenameFromPath(props.selectedQueueJob.bookdropPath) : "bookdrop"}
                  </p>
                ) : null}

                {props.selectedQueueJob.error ? <p className="queue-error">{props.selectedQueueJob.error}</p> : null}

                <label className="logs-toggle">
                  <input type="checkbox" checked={props.showLogs} onChange={(event) => props.setShowLogs(event.target.checked)} /> Show logs
                </label>

                {props.showLogs && <pre className="build-logs">{props.selectedQueueJobLogs.length ? props.selectedQueueJobLogs.join("\n") : "No logs yet..."}</pre>}
              </>
            ) : (
              <p className="hint">Select a queue item to see details.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
