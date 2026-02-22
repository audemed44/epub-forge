import { useMemo, useState } from "react";
import { basenameFromPath, formatAbsoluteDateTime, formatRelativeTime, formatStatus } from "../../shared/utils/format";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBookBookmark, faDownload } from "@fortawesome/free-solid-svg-icons";
import type { QueueJob } from "../../shared/types/api";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [jobSearch, setJobSearch] = useState("");

  const progressMax = Math.max(props.selectedQueueJob?.progress.total || props.selectedQueueJob?.totalChapters || 1, 1);
  const progressValue = Math.min(props.selectedQueueJob?.progress.completed || 0, progressMax);
  const normalizedJobSearch = jobSearch.trim().toLowerCase();
  const filteredQueueJobs = useMemo(() => {
    if (!normalizedJobSearch) {
      return props.queueJobs;
    }
    return props.queueJobs.filter((job) => {
      const name = (job.fileName || job.title || "Untitled").toLowerCase();
      const status = formatStatus(job).toLowerCase();
      return name.includes(normalizedJobSearch) || status.includes(normalizedJobSearch);
    });
  }, [props.queueJobs, normalizedJobSearch]);

  return (
    <Card className="bg-background">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-[2rem] md:text-[2.15rem]">Build Queue</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={props.scope} onValueChange={(value) => props.setScope(value as "active" | "archive")} className="w-auto">
            <TabsList className="h-9 rounded-base p-1">
              <TabsTrigger className="h-7 px-3 text-xs font-heading" value="active">
                Queue
              </TabsTrigger>
              <TabsTrigger className="h-7 px-3 text-xs font-heading" value="archive">
                Archive
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button type="button" variant="neutral" size="sm" className="text-xs" onClick={() => void props.loadQueueJobs()}>
            Refresh
          </Button>
          <Button
            type="button"
            variant="neutral"
            size="sm"
            className="text-xs"
            onClick={() => setShowClearConfirm(true)}
            disabled={props.queueJobs.length === 0 || archiveMode}
          >
            Clear All
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <div className="mb-5 grid gap-2">
          <Label htmlFor="queue-search" className="text-sm text-foreground/95">
            Search {archiveMode ? "archive" : "queue"}
          </Label>
          <Input
            id="queue-search"
            type="text"
            value={jobSearch}
            onChange={(event) => setJobSearch(event.target.value)}
            placeholder={`Filter ${archiveMode ? "archived" : "queued"} jobs by title or status`}
            className="md:max-w-full"
          />
        </div>

        {props.queueJobs.length === 0 ? (
          <p className="text-sm font-base">{archiveMode ? "No archived jobs yet." : "No build jobs queued yet."}</p>
        ) : filteredQueueJobs.length === 0 ? (
          <p className="text-sm font-base">No jobs match your search.</p>
        ) : (
          <div className="grid min-w-0 gap-3 md:grid-cols-[320px_minmax(0,1fr)]">
            <ScrollArea className="h-[320px] w-full max-w-full rounded-base border-2 border-border md:h-[560px]">
              <div className="grid gap-2 p-2">
                {filteredQueueJobs.map((job) => (
                  <Button
                    type="button"
                    key={job.id}
                    variant={props.selectedQueueJobId === job.id ? "default" : "neutral"}
                    className="h-auto w-full max-w-full justify-start py-2.5 text-left whitespace-normal"
                    onClick={() => props.setSelectedQueueJobId(job.id)}
                  >
                    <span className="flex w-full flex-col items-start gap-1">
                      <span className="w-full break-words">{job.fileName || job.title || "Untitled"}</span>
                      <span className="flex items-center gap-1 text-xs opacity-80">
                        <span>{formatStatus(job)}</span>
                        <span aria-hidden="true">·</span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help underline decoration-dotted underline-offset-2">
                                {formatRelativeTime(job.finishedAt ?? job.createdAt)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{formatAbsoluteDateTime(job.finishedAt ?? job.createdAt)}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </span>
                    </span>
                  </Button>
                ))}
              </div>
            </ScrollArea>

            <Card className="h-[320px] w-full max-w-full overflow-hidden py-0 md:h-[560px]">
              <CardContent className="flex h-full min-w-0 flex-col gap-4 p-4">
                {props.selectedQueueJob ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-heading uppercase tracking-wide">
                      <p className="text-foreground/70">
                        Status: <span className="text-foreground">{props.selectedQueueJob.status}</span>
                      </p>
                      <p className="text-foreground/70">
                        Progress:{" "}
                        <span className="text-foreground">
                          {props.selectedQueueJob.progress.completed}/{props.selectedQueueJob.progress.total || props.selectedQueueJob.totalChapters}
                        </span>
                      </p>
                    </div>
                    <Progress className="h-3" value={(progressValue / progressMax) * 100} />

                    {props.selectedQueueJob.movedToBookdrop ? (
                      <p className="text-sm font-base text-foreground/90">
                        Moved to: {props.selectedQueueJob.bookdropPath ? basenameFromPath(props.selectedQueueJob.bookdropPath) : "bookdrop"}
                      </p>
                    ) : null}

                    {props.selectedQueueJob.error ? <p className="text-sm font-base text-destructive">{props.selectedQueueJob.error}</p> : null}

                    <div className="flex items-center gap-2 pt-1">
                      <Checkbox id="show-logs" checked={props.showLogs} onCheckedChange={(checked) => props.setShowLogs(checked === true)} />
                      <Label htmlFor="show-logs">Show logs</Label>
                    </div>

                    {props.showLogs && (
                      <div className="queue-log-panel h-[170px] w-full max-w-full overflow-auto rounded-base border-2 border-border p-3 text-xs font-base md:h-[250px]">
                        <pre className="whitespace-pre font-mono">
                          {props.selectedQueueJobLogs.length ? props.selectedQueueJobLogs.join("\n") : "No logs yet..."}
                        </pre>
                      </div>
                    )}

                    {!archiveMode && props.selectedQueueJob.status === "done" && props.selectedQueueJob.hasResult && (
                      <TooltipProvider>
                        <div className="mt-auto flex items-center justify-end gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                size="icon"
                                onClick={() => void props.onDownloadJob(props.selectedQueueJob!.id)}
                                disabled={props.selectedQueueJob.movedToBookdrop}
                                aria-label={props.selectedQueueJob.movedToBookdrop ? "Moved to bookdrop" : "Download EPUB"}
                              >
                                <FontAwesomeIcon icon={faDownload} aria-hidden="true" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{props.selectedQueueJob.movedToBookdrop ? "Moved to bookdrop" : "Download EPUB"}</p>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                size="icon"
                                onClick={() => void props.onMoveToBookdrop(props.selectedQueueJob!.id)}
                                disabled={props.selectedQueueJob.movedToBookdrop}
                                aria-label="Move to bookdrop"
                              >
                                <FontAwesomeIcon icon={faBookBookmark} aria-hidden="true" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Move to bookdrop</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TooltipProvider>
                    )}
                  </>
                ) : (
                  <p className="text-sm font-base">Select a queue item to see details.</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>

      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Queue?</AlertDialogTitle>
            <AlertDialogDescription>
              This archives all active queue items and removes generated EPUB files from output storage. Bookdrop files are not touched.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void props.onClearAllQueue();
              }}
            >
              Clear Queue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
