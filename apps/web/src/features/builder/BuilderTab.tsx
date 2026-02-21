import { chapterLabel } from "../../shared/utils/format";
import type { ChapterRef } from "../../shared/types/api";

type BuilderTabProps = {
  status: string;
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
    <>
      <section className="panel">
        <label htmlFor="story-url">Story URL</label>
        <div className="url-row">
          <input
            id="story-url"
            type="url"
            value={props.url}
            onChange={(event) => props.setUrl(event.target.value)}
            placeholder="https://www.royalroad.com/fiction/151470/re-knight-litrpg-regression"
          />
          <button onClick={() => void props.onPreview()} disabled={props.isPreviewLoading}>
            {props.isPreviewLoading ? "Loading..." : "Preview"}
          </button>
        </div>
        <p className="status">{props.status}</p>
      </section>

      <section className={`panel ${props.hasPreview ? "" : "hidden"}`}>
        <div className="panel-head">
          <h2>Metadata</h2>
          <span className="badge">{props.parserId ?? "unknown parser"}</span>
        </div>
        <div className="fields-grid">
          <label>
            Title
            <input value={props.title} onChange={(event) => props.setTitle(event.target.value)} />
          </label>
          <label>
            Final EPUB file name
            <input value={props.fileName} onChange={(event) => props.setFileName(event.target.value)} placeholder="Book name" />
          </label>
          <label>
            Author
            <input value={props.author} onChange={(event) => props.setAuthor(event.target.value)} />
          </label>
          <label>
            Language
            <input value={props.language} onChange={(event) => props.setLanguage(event.target.value)} />
          </label>
          <label className="full-width">
            Description
            <textarea value={props.description} rows={4} onChange={(event) => props.setDescription(event.target.value)} />
          </label>
          <label className="full-width">
            Cover image URL (optional)
            <input
              type="url"
              value={props.coverImageUrl}
              onChange={(event) => {
                props.setCoverImageUrl(event.target.value);
                props.setCoverUploadName("");
              }}
              placeholder="https://example.com/cover.jpg"
            />
          </label>
          <label className="full-width">
            Upload cover image (optional)
            <input type="file" accept="image/*" onChange={(event) => void props.onCoverUpload(event.target.files?.[0] ?? null)} />
          </label>
          {props.coverUploadName ? <p className="cover-upload-name">Uploaded: {props.coverUploadName}</p> : null}
          <div className="cover-actions full-width">
            <button
              type="button"
              onClick={() => {
                props.setCoverImageUrl(props.detectedCoverImageUrl);
                props.setCoverUploadName("");
              }}
            >
              Use detected cover
            </button>
            <button
              type="button"
              onClick={() => {
                props.setCoverImageUrl("");
                props.setCoverUploadName("");
              }}
            >
              Remove cover
            </button>
          </div>
          {props.coverImageUrl ? (
            <div className="cover-preview full-width">
              <p>Cover Preview</p>
              <img src={props.coverImageUrl} alt="Cover preview" />
            </div>
          ) : null}
        </div>
      </section>

      <section className={`panel ${props.hasPreview ? "" : "hidden"}`}>
        <div className="panel-head">
          <h2>Chapter Range</h2>
          <button onClick={() => void props.onEnqueueBuild()} disabled={props.isEnqueueing || !props.hasPreview}>
            {props.isEnqueueing ? "Queueing..." : "Add Build To Queue"}
          </button>
        </div>
        <div className="fields-grid">
          <label>
            Start chapter
            <select value={props.startIndex} onChange={(event) => props.setStartIndex(Number(event.target.value))}>
              {props.chapters.map((chapter, index) => (
                <option key={chapter.id} value={index}>
                  {chapterLabel(chapter, index)}
                </option>
              ))}
            </select>
          </label>
          <label>
            End chapter
            <select value={props.endIndex} onChange={(event) => props.setEndIndex(Number(event.target.value))}>
              {props.chapters.map((chapter, index) => (
                <option key={chapter.id} value={index}>
                  {chapterLabel(chapter, index)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="hint">
          {props.hasPreview
            ? `Will queue ${props.selectedChaptersCount} chapters: "${props.chapters[props.selectedRange.start]?.title || ""}" to "${props.chapters[props.selectedRange.end]?.title || ""}".`
            : ""}
        </p>
      </section>
    </>
  );
}
