import { useState } from "react";
import { BuilderTab } from "../features/builder/BuilderTab";
import { useBuilder } from "../features/builder/hooks/useBuilder";
import { QueueTab } from "../features/queue/QueueTab";
import { useQueue } from "../features/queue/hooks/useQueue";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Toaster } from "@/components/ui/sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ViewTab = "builder" | "queue";

export function AppShell() {
  const [activeTab, setActiveTab] = useState<ViewTab>("builder");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const queue = useQueue({});
  const builder = useBuilder({
    onJobQueued: (jobId) => {
      queue.setSelectedQueueJobId(jobId);
      void queue.loadQueueJobs();
    },
  });

  const activeQueueCount = queue.queueJobs.filter((job) => job.status === "queued" || job.status === "running").length;

  return (
    <main className="min-h-screen px-4 py-4 text-foreground md:px-8 md:py-6">
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ViewTab)}>
        <div className="mx-auto w-full max-w-7xl space-y-4">
          <section className="relative mx-auto max-w-5xl space-y-3 px-2 py-4 text-center">
            <Button
              type="button"
              variant="neutral"
              size="icon"
              className="absolute right-2 top-2 md:hidden"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu />
            </Button>
            <p className="text-base font-bold uppercase tracking-[0.12em] text-foreground/80">Self-Hosted WebToEPUB</p>
            <h1 className="text-4xl font-heading leading-tight md:text-6xl">EPUB Forge</h1>
            <p className="text-xl font-base leading-snug text-foreground md:text-2xl">
              Queue builds, monitor progress, and download EPUBs when they are ready.
            </p>
          </section>

          {isSidebarOpen ? (
            <div className="fixed inset-0 z-50 md:hidden">
              <button
                type="button"
                className="absolute inset-0 bg-overlay"
                aria-label="Close navigation menu"
                onClick={() => setIsSidebarOpen(false)}
              />
              <aside className="absolute left-0 top-0 h-full w-72 p-4">
                <Card className="h-full bg-background text-foreground">
                  <CardContent className="flex h-full flex-col gap-3 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-base font-heading">Navigation</p>
                      <Button
                        type="button"
                        variant="neutral"
                        size="icon"
                        aria-label="Close navigation menu"
                        onClick={() => setIsSidebarOpen(false)}
                      >
                        <X />
                      </Button>
                    </div>
                    <TabsList className="h-auto w-full flex-col items-stretch gap-2 bg-transparent p-0">
                      <TabsTrigger
                        value="builder"
                        className="w-full justify-start border-border bg-main text-lg text-main-foreground data-[state=active]:bg-secondary-background data-[state=active]:text-foreground data-[state=active]:shadow-[var(--shadow)]"
                        onClick={() => setIsSidebarOpen(false)}
                      >
                        Builder
                      </TabsTrigger>
                      <TabsTrigger
                        value="queue"
                        className="w-full justify-start border-border bg-main text-lg text-main-foreground data-[state=active]:bg-secondary-background data-[state=active]:text-foreground data-[state=active]:shadow-[var(--shadow)]"
                        onClick={() => setIsSidebarOpen(false)}
                      >
                        Queue ({activeQueueCount})
                      </TabsTrigger>
                    </TabsList>
                  </CardContent>
                </Card>
              </aside>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-[260px_minmax(0,1fr)] md:items-start">
            <aside className="hidden md:sticky md:top-4 md:block">
              <Card className="bg-background text-foreground">
                <CardContent className="p-3">
                  <TabsList className="h-auto w-full flex-col items-stretch gap-2 bg-transparent p-0">
                    <TabsTrigger
                      value="builder"
                      className="w-full justify-start border-border bg-main text-lg text-main-foreground data-[state=active]:bg-secondary-background data-[state=active]:text-foreground data-[state=active]:shadow-[var(--shadow)]"
                    >
                      Builder
                    </TabsTrigger>
                    <TabsTrigger
                      value="queue"
                      className="w-full justify-start border-border bg-main text-lg text-main-foreground data-[state=active]:bg-secondary-background data-[state=active]:text-foreground data-[state=active]:shadow-[var(--shadow)]"
                    >
                      Queue ({activeQueueCount})
                    </TabsTrigger>
                  </TabsList>
                </CardContent>
              </Card>
            </aside>

            {activeTab === "builder" && (
              <section className="min-w-0">
                <BuilderTab
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
              </section>
            )}

            {activeTab === "queue" && (
              <section className="min-w-0">
                <QueueTab
                  scope={queue.scope}
                  setScope={queue.setScope}
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
              </section>
            )}
          </div>
        </div>
      </Tabs>

      <Toaster />
    </main>
  );
}
