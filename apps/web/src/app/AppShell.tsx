import { useEffect, useState } from "react";
import { BuilderTab } from "../features/builder/BuilderTab";
import { ConfigTab } from "../features/config/ConfigTab";
import {
  customThemeStorageKey,
  defaultCustomTheme,
  defaultThemeId,
  hexToOklchTriplet,
  isThemeId,
  normalizeCustomTheme,
  themeStorageKey,
  type CustomThemeConfig,
  type ThemeId,
} from "../features/config/theme";
import { useBuilder } from "../features/builder/hooks/useBuilder";
import { QueueTab } from "../features/queue/QueueTab";
import { useQueue } from "../features/queue/hooks/useQueue";
import { Hammer, List, Menu, Settings2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Toaster } from "@/components/ui/sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ViewTab = "builder" | "queue" | "config";

const customThemeCssVarMap: Array<[keyof CustomThemeConfig, string]> = [
  ["shadowX", "--custom-theme-shadow-x"],
  ["shadowY", "--custom-theme-shadow-y"],
];

const customColorVarMap: Array<[keyof CustomThemeConfig, string]> = [
  ["colorBackgroundHex", "--custom-theme-color-background"],
  ["colorSurfaceHex", "--custom-theme-color-surface"],
  ["colorForegroundHex", "--custom-theme-color-foreground"],
  ["colorAccentHex", "--custom-theme-color-accent"],
  ["colorAccentForegroundHex", "--custom-theme-color-accent-foreground"],
  ["colorBorderHex", "--custom-theme-color-border"],
  ["colorRingHex", "--custom-theme-color-ring"],
  ["terminalBackgroundHex", "--custom-theme-terminal-background"],
  ["terminalForegroundHex", "--custom-theme-terminal-foreground"],
];

export function AppShell() {
  const [activeTab, setActiveTab] = useState<ViewTab>("builder");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeId>(() => {
    if (typeof window === "undefined") {
      return defaultThemeId;
    }
    const savedTheme = window.localStorage.getItem(themeStorageKey);
    return savedTheme && isThemeId(savedTheme) ? savedTheme : defaultThemeId;
  });
  const [customTheme, setCustomTheme] = useState<CustomThemeConfig>(() => {
    if (typeof window === "undefined") {
      return defaultCustomTheme;
    }
    const savedCustomTheme = window.localStorage.getItem(customThemeStorageKey);
    if (!savedCustomTheme) {
      return defaultCustomTheme;
    }
    try {
      const parsed = JSON.parse(savedCustomTheme) as unknown;
      return normalizeCustomTheme(parsed);
    } catch {
      return defaultCustomTheme;
    }
  });

  const queue = useQueue({});
  const builder = useBuilder({
    onJobQueued: (jobId) => {
      queue.setSelectedQueueJobId(jobId);
      void queue.loadQueueJobs();
    },
  });

  const activeQueueCount = queue.queueJobs.filter((job) => job.status === "queued" || job.status === "running").length;
  const navTriggerClass =
    "h-11 w-full justify-start gap-2 border-border bg-secondary-background text-[0.95rem] font-heading text-foreground data-[state=active]:bg-main data-[state=active]:text-main-foreground data-[state=active]:shadow-shadow";

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    window.localStorage.setItem(themeStorageKey, theme);

    if (theme === "custom") {
      const customBackground = `linear-gradient(180deg, ${customTheme.backgroundStartHex} 0%, ${customTheme.backgroundEndHex} 100%)`;
      root.style.setProperty("--custom-theme-body-background", customBackground);

      for (const [key, cssVar] of customColorVarMap) {
        root.style.setProperty(cssVar, hexToOklchTriplet(customTheme[key] as string));
      }

      for (const [key, cssVar] of customThemeCssVarMap) {
        root.style.setProperty(cssVar, customTheme[key] as string);
      }

      root.setAttribute("data-custom-borders", customTheme.hideBorders ? "off" : "on");
      window.localStorage.setItem(customThemeStorageKey, JSON.stringify(customTheme));
      return;
    }

    root.removeAttribute("data-custom-borders");
    root.style.removeProperty("--custom-theme-body-background");
    for (const [, cssVar] of customColorVarMap) {
      root.style.removeProperty(cssVar);
    }
    for (const [, cssVar] of customThemeCssVarMap) {
      root.style.removeProperty(cssVar);
    }
  }, [theme, customTheme]);

  function handleCustomThemeChange<K extends keyof CustomThemeConfig>(key: K, value: CustomThemeConfig[K]): void {
    setCustomTheme((current) => ({ ...current, [key]: value }));
  }

  return (
    <main className="min-h-screen px-3 py-5 text-foreground md:px-10 md:py-9">
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ViewTab)}>
        <div className="mx-auto w-full max-w-[1130px] space-y-6">
          <section className="relative mx-auto max-w-5xl space-y-4 px-2 py-4 text-center">
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
            <p className="text-[0.68rem] font-heading uppercase tracking-[0.18em] text-main">Self-Hosted WebToEPUB</p>
            <h1 className="text-5xl font-heading leading-tight tracking-tight text-foreground md:text-7xl">EPUB Forge</h1>
            <p className="text-lg font-base leading-snug text-foreground/60 md:text-[1.95rem]">
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
                      <TabsTrigger value="builder" className={navTriggerClass} onClick={() => setIsSidebarOpen(false)}>
                        <Hammer className="size-4" />
                        Builder
                      </TabsTrigger>
                      <TabsTrigger value="queue" className={navTriggerClass} onClick={() => setIsSidebarOpen(false)}>
                        <List className="size-4" />
                        Queue
                        <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full border-2 border-border bg-background px-1 text-[0.7rem] font-heading leading-none text-foreground">
                          {activeQueueCount}
                        </span>
                      </TabsTrigger>
                      <TabsTrigger value="config" className={navTriggerClass} onClick={() => setIsSidebarOpen(false)}>
                        <Settings2 className="size-4" />
                        Config
                      </TabsTrigger>
                    </TabsList>
                  </CardContent>
                </Card>
              </aside>
            </div>
          ) : null}

          <div className="grid gap-5 md:grid-cols-[180px_minmax(0,1fr)] md:items-start">
            <aside className="hidden md:sticky md:top-6 md:block">
              <Card className="bg-background text-foreground">
                <CardContent className="p-2">
                  <TabsList className="h-auto w-full flex-col items-stretch gap-2 bg-transparent p-0">
                    <TabsTrigger value="builder" className={navTriggerClass}>
                      <Hammer className="size-4" />
                      Builder
                    </TabsTrigger>
                    <TabsTrigger value="queue" className={navTriggerClass}>
                      <List className="size-4" />
                      Queue
                      <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full border-2 border-border bg-background px-1 text-[0.7rem] font-heading leading-none text-foreground">
                        {activeQueueCount}
                      </span>
                    </TabsTrigger>
                    <TabsTrigger value="config" className={navTriggerClass}>
                      <Settings2 className="size-4" />
                      Config
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
                  availableParsers={builder.availableParsers}
                  selectedParserId={builder.selectedParserId}
                  setSelectedParserId={builder.setSelectedParserId}
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
                  duplicateWarning={builder.duplicateWarning}
                  onCloseDuplicateWarning={builder.onCloseDuplicateWarning}
                  onConfirmDuplicateEnqueue={builder.onConfirmDuplicateEnqueue}
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

            {activeTab === "config" && (
              <section className="min-w-0">
                <ConfigTab
                  theme={theme}
                  setTheme={setTheme}
                  customTheme={customTheme}
                  onCustomThemeChange={handleCustomThemeChange}
                  onResetCustomTheme={() => setCustomTheme(defaultCustomTheme)}
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
