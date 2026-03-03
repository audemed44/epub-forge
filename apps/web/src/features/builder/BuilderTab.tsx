import { useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUpload } from "@fortawesome/free-solid-svg-icons";
import { Search } from "lucide-react";
import { chapterLabel } from "../../shared/utils/format";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { ChapterRef } from "../../shared/types/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type BuilderTabProps = {
  url: string;
  setUrl: (value: string) => void;
  isPreviewLoading: boolean;
  isEnqueueing: boolean;
  availableParsers: string[];
  selectedParserId: string;
  setSelectedParserId: (value: string) => void;
  parserId: string | null;
  chapters: ChapterRef[];
  startIndex: number;
  setStartIndex: (value: number) => void;
  endIndex: number;
  setEndIndex: (value: number) => void;
  title: string;
  setTitle: (value: string) => void;
  author: string;
  setAuthor: (value: string) => void;
  language: string;
  setLanguage: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  fileName: string;
  setFileName: (value: string) => void;
  coverImageUrl: string;
  setCoverImageUrl: (value: string) => void;
  detectedCoverImageUrl: string;
  setCoverUploadName: (value: string) => void;
  coverUploadName: string;
  hasPreview: boolean;
  selectedRange: { start: number; end: number };
  selectedChaptersCount: number;
  onPreview: () => Promise<void>;
  onEnqueueBuild: () => Promise<void>;
  duplicateWarning: { normalizedFileName: string; inQueue: boolean; onDisk: boolean } | null;
  onCloseDuplicateWarning: () => void;
  onConfirmDuplicateEnqueue: () => Promise<void>;
  onCoverUpload: (file: File | null) => Promise<void>;
};

export function BuilderTab(props: BuilderTabProps) {
  const coverFileInputRef = useRef<HTMLInputElement | null>(null);
  const [startChapterSearch, setStartChapterSearch] = useState("");
  const [endChapterSearch, setEndChapterSearch] = useState("");

  const searchableChapters = useMemo(
    () =>
      props.chapters.map((chapter, index) => ({
        chapter,
        index,
        label: chapterLabel(chapter, index),
      })),
    [props.chapters],
  );

  const filteredStartChapters = useMemo(() => {
    const normalizedStartChapterSearch = startChapterSearch.trim().toLowerCase();
    if (!normalizedStartChapterSearch) {
      return searchableChapters;
    }
    return searchableChapters.filter((item) => item.label.toLowerCase().includes(normalizedStartChapterSearch));
  }, [searchableChapters, startChapterSearch]);

  const filteredEndChapters = useMemo(() => {
    const normalizedEndChapterSearch = endChapterSearch.trim().toLowerCase();
    if (!normalizedEndChapterSearch) {
      return searchableChapters;
    }
    return searchableChapters.filter((item) => item.label.toLowerCase().includes(normalizedEndChapterSearch));
  }, [searchableChapters, endChapterSearch]);

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Story URL</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-2 md:grid-cols-[1fr_220px_auto]">
            <Input
              id="story-url"
              type="url"
              value={props.url}
              onChange={(event) => props.setUrl(event.target.value)}
              placeholder=""
            />
            <Select value={props.selectedParserId} onValueChange={props.setSelectedParserId}>
              <SelectTrigger>
                <SelectValue placeholder="Auto parser" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto detect</SelectItem>
                {props.availableParsers.map((parserId) => (
                  <SelectItem key={parserId} value={parserId}>
                    {parserId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => void props.onPreview()} disabled={props.isPreviewLoading}>
              {props.isPreviewLoading ? "Loading..." : "Preview"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {props.hasPreview && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Metadata</CardTitle>
            <Badge>{props.parserId ?? "unknown parser"}</Badge>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Title</Label>
              <Input value={props.title} onChange={(event) => props.setTitle(event.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Final EPUB file name</Label>
              <Input value={props.fileName} onChange={(event) => props.setFileName(event.target.value)} placeholder="Book name" />
            </div>
            <div className="grid gap-2">
              <Label>Author</Label>
              <Input value={props.author} onChange={(event) => props.setAuthor(event.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Language</Label>
              <Input value={props.language} onChange={(event) => props.setLanguage(event.target.value)} />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label>Description</Label>
              <Textarea value={props.description} rows={4} onChange={(event) => props.setDescription(event.target.value)} />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label>Cover image URL (optional)</Label>
              <Input
                type="url"
                value={props.coverImageUrl}
                onChange={(event) => {
                  props.setCoverImageUrl(event.target.value);
                  props.setCoverUploadName("");
                }}
                placeholder="https://example.com/cover.jpg"
              />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label>Upload cover image (optional)</Label>
              <input
                ref={coverFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => void props.onCoverUpload(event.target.files?.[0] ?? null)}
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" onClick={() => coverFileInputRef.current?.click()} aria-label="Upload cover image">
                  <FontAwesomeIcon icon={faUpload} aria-hidden="true" />
                </Button>
                <span className="text-sm font-base text-foreground/80">{props.coverUploadName || "No file chosen"}</span>
              </div>
              {props.coverUploadName ? <p className="text-xs font-base">Uploaded: {props.coverUploadName}</p> : null}
            </div>
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <Button
                type="button"
                onClick={() => {
                  props.setCoverImageUrl(props.detectedCoverImageUrl);
                  props.setCoverUploadName("");
                }}
              >
                Use detected cover
              </Button>
              <Button
                type="button"
                onClick={() => {
                  props.setCoverImageUrl("");
                  props.setCoverUploadName("");
                }}
              >
                Remove cover
              </Button>
            </div>
            {props.coverImageUrl ? (
              <div className="grid gap-2 md:col-span-2">
                <Label>Cover Preview</Label>
                <img src={props.coverImageUrl} alt="Cover preview" className="w-full max-w-[220px] rounded-base border-2 border-border" />
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {props.hasPreview && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Chapter Range</CardTitle>
            <Button onClick={() => void props.onEnqueueBuild()} disabled={props.isEnqueueing || !props.hasPreview}>
              {props.isEnqueueing ? "Queueing..." : "Add Build To Queue"}
            </Button>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Start chapter</Label>
              <Select value={String(props.startIndex)} onValueChange={(value) => props.setStartIndex(Number(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select start chapter" />
                </SelectTrigger>
                <SelectContent>
                  <div className="sticky top-0 z-10 border-b-2 border-border bg-secondary-background p-2">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-foreground/70" />
                      <Input
                        type="text"
                        value={startChapterSearch}
                        onChange={(event) => setStartChapterSearch(event.target.value)}
                        onKeyDown={(event) => event.stopPropagation()}
                        placeholder="Search chapters..."
                        className="h-9 pl-8"
                      />
                    </div>
                  </div>
                  {filteredStartChapters.map((item) => (
                    <SelectItem key={item.chapter.id} value={String(item.index)}>
                      {item.label}
                    </SelectItem>
                  ))}
                  {filteredStartChapters.length === 0 ? <p className="px-2 py-1.5 text-sm text-foreground/70">No chapters match your search.</p> : null}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>End chapter</Label>
              <Select value={String(props.endIndex)} onValueChange={(value) => props.setEndIndex(Number(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select end chapter" />
                </SelectTrigger>
                <SelectContent>
                  <div className="sticky top-0 z-10 border-b-2 border-border bg-secondary-background p-2">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-foreground/70" />
                      <Input
                        type="text"
                        value={endChapterSearch}
                        onChange={(event) => setEndChapterSearch(event.target.value)}
                        onKeyDown={(event) => event.stopPropagation()}
                        placeholder="Search chapters..."
                        className="h-9 pl-8"
                      />
                    </div>
                  </div>
                  {filteredEndChapters.map((item) => (
                    <SelectItem key={item.chapter.id} value={String(item.index)}>
                      {item.label}
                    </SelectItem>
                  ))}
                  {filteredEndChapters.length === 0 ? <p className="px-2 py-1.5 text-sm text-foreground/70">No chapters match your search.</p> : null}
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm font-base md:col-span-2">
              {`Will queue ${props.selectedChaptersCount} chapters: "${props.chapters[props.selectedRange.start]?.title || ""}" to "${props.chapters[props.selectedRange.end]?.title || ""}".`}
            </p>
          </CardContent>
        </Card>
      )}

      <AlertDialog
        open={props.duplicateWarning !== null}
        onOpenChange={(open) => {
          if (!open) {
            props.onCloseDuplicateWarning();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicate file name detected</AlertDialogTitle>
            <AlertDialogDescription>
              {`"${props.duplicateWarning?.normalizedFileName || "book.epub"}" already exists`}
              {props.duplicateWarning?.inQueue ? " in queue" : ""}
              {props.duplicateWarning?.inQueue && props.duplicateWarning?.onDisk ? " and " : ""}
              {props.duplicateWarning?.onDisk ? " in your EPUB output folder" : ""}. Continue anyway?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={props.onCloseDuplicateWarning}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void props.onConfirmDuplicateEnqueue();
              }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
