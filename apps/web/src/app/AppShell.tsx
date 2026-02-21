import { useState } from "react";
import { BuilderTab } from "../features/builder/BuilderTab";
import { useBuilder } from "../features/builder/hooks/useBuilder";
import { QueueTab } from "../features/queue/QueueTab";
import { useQueue } from "../features/queue/hooks/useQueue";

type ViewTab = "builder" | "queue";

export function AppShell() {
  const [activeTab, setActiveTab] = useState<ViewTab>("builder");
  const [status, setStatus] = useState("Paste a URL and preview chapters.");

  const queue = useQueue({ setStatus });
  const builder = useBuilder({
    setStatus,
    onJobQueued: (jobId) => {
      queue.setSelectedQueueJobId(jobId);
      setActiveTab("queue");
      void queue.loadQueueJobs();
    },
  });

  const activeQueueCount = queue.queueJobs.filter((job) => job.status === "queued" || job.status === "running").length;

  return (
    <main className="shell">
      <aside className="side-nav">
        <button type="button" className={activeTab === "builder" ? "nav-item active" : "nav-item"} onClick={() => setActiveTab("builder")}>
          Builder
        </button>
        <button type="button" className={activeTab === "queue" ? "nav-item active" : "nav-item"} onClick={() => setActiveTab("queue")}>
          Queue ({activeQueueCount})
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

        {activeTab === "builder" && (
          <BuilderTab
            status={status}
            url={builder.url}
            setUrl={builder.setUrl}
            isPreviewLoading={builder.isPreviewLoading}
            isEnqueueing={builder.isEnqueueing}
            parserId={builder.parserId}
            chapters={builder.chapters}
            startIndex={builder.startIndex}
            setStartIndex={builder.setStartIndex}
            endIndex={builder.endIndex}
            setEndIndex={builder.setEndIndex}
            title={builder.title}
            setTitle={builder.setTitle}
            author={builder.author}
            setAuthor={builder.setAuthor}
            language={builder.language}
            setLanguage={builder.setLanguage}
            description={builder.description}
            setDescription={builder.setDescription}
            fileName={builder.fileName}
            setFileName={builder.setFileName}
            coverImageUrl={builder.coverImageUrl}
            setCoverImageUrl={builder.setCoverImageUrl}
            detectedCoverImageUrl={builder.detectedCoverImageUrl}
            setCoverUploadName={builder.setCoverUploadName}
            coverUploadName={builder.coverUploadName}
            hasPreview={builder.hasPreview}
            selectedRange={builder.selectedRange}
            selectedChaptersCount={builder.selectedChapters.length}
            onPreview={builder.onPreview}
            onEnqueueBuild={builder.onEnqueueBuild}
            onCoverUpload={builder.onCoverUpload}
          />
        )}

        {activeTab === "queue" && (
          <QueueTab
            queueJobs={queue.queueJobs}
            selectedQueueJobId={queue.selectedQueueJobId}
            setSelectedQueueJobId={queue.setSelectedQueueJobId}
            selectedQueueJob={queue.selectedQueueJob}
            selectedQueueJobLogs={queue.selectedQueueJobLogs}
            showLogs={queue.showLogs}
            setShowLogs={queue.setShowLogs}
            loadQueueJobs={queue.loadQueueJobs}
            onClearAllQueue={queue.onClearAllQueue}
            onDownloadJob={queue.onDownloadJob}
            onMoveToBookdrop={queue.onMoveToBookdrop}
          />
        )}
      </div>
    </main>
  );
}
