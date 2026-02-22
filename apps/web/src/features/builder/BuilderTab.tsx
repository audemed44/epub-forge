import { chapterLabel } from "../../shared/utils/format";
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
  onCoverUpload: (file: File | null) => Promise<void>;
};

export function BuilderTab(props: BuilderTabProps) {
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Story URL</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-2 md:grid-cols-[1fr_auto]">
            <Input
              id="story-url"
              type="url"
              value={props.url}
              onChange={(event) => props.setUrl(event.target.value)}
              placeholder="https://www.royalroad.com/fiction/151470/re-knight-litrpg-regression"
            />
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
              <Input type="file" accept="image/*" onChange={(event) => void props.onCoverUpload(event.target.files?.[0] ?? null)} />
              {props.coverUploadName ? <p className="text-xs font-base">Uploaded: {props.coverUploadName}</p> : null}
            </div>
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <Button
                type="button"
                variant="neutral"
                onClick={() => {
                  props.setCoverImageUrl(props.detectedCoverImageUrl);
                  props.setCoverUploadName("");
                }}
              >
                Use detected cover
              </Button>
              <Button
                type="button"
                variant="neutral"
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
                  {props.chapters.map((chapter, index) => (
                    <SelectItem key={chapter.id} value={String(index)}>
                      {chapterLabel(chapter, index)}
                    </SelectItem>
                  ))}
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
                  {props.chapters.map((chapter, index) => (
                    <SelectItem key={chapter.id} value={String(index)}>
                      {chapterLabel(chapter, index)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm font-base md:col-span-2">
              {`Will queue ${props.selectedChaptersCount} chapters: "${props.chapters[props.selectedRange.start]?.title || ""}" to "${props.chapters[props.selectedRange.end]?.title || ""}".`}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
