import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getJson, postJson } from "../../../shared/api/client";
import { isPreviewResponse } from "../../../shared/api/guards";
import type { ChapterRef, Metadata } from "../../../shared/types/api";

type UseBuilderOptions = {
  onJobQueued: (jobId: string) => void;
};

export function useBuilder({ onJobQueued }: UseBuilderOptions) {
  const [url, setUrl] = useState("");
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isEnqueueing, setIsEnqueueing] = useState(false);
  const [availableParsers, setAvailableParsers] = useState<string[]>([]);
  const [selectedParserId, setSelectedParserId] = useState<string>("auto");

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
  const [duplicateWarning, setDuplicateWarning] = useState<{
    normalizedFileName: string;
    inQueue: boolean;
    onDisk: boolean;
  } | null>(null);
  const [pendingPayload, setPendingPayload] = useState<{
    url: string;
    parserId: string;
    chapterUrls: string[];
    chapterTitles: string[];
    metadata: Metadata;
  } | null>(null);

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

  useEffect(() => {
    async function loadParsers() {
      const result = await getJson<{ parsers?: unknown }>("/api/health");
      if (!result.ok) {
        return;
      }

      const parsers = result.data.parsers;
      if (!Array.isArray(parsers)) {
        return;
      }
      const parserIds = parsers.filter((value): value is string => typeof value === "string");
      setAvailableParsers(parserIds);
    }

    void loadParsers();
  }, []);

  async function onPreview() {
    const inputUrl = url.trim();
    if (!inputUrl) {
      toast.warning("Enter a URL first.");
      return;
    }

    setIsPreviewLoading(true);

    try {
      const parserIdForRequest = selectedParserId === "auto" ? null : selectedParserId;
      const result = await postJson<unknown>("/api/preview", { url: inputUrl, parserId: parserIdForRequest });
      if (!result.ok || !isPreviewResponse(result.data)) {
        const message =
          typeof result.data === "object" &&
          result.data !== null &&
          "error" in result.data &&
          typeof (result.data as { error?: unknown }).error === "string"
            ? (result.data as { error: string }).error
            : "Preview failed";
        throw new Error(message);
      }

      const data = result.data;
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
      toast.success(`Loaded ${data.chapters.length} chapters with parser '${data.parserId}'.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Preview failed");
    } finally {
      setIsPreviewLoading(false);
    }
  }

  async function enqueueBuild(
    payload: {
      url: string;
      parserId: string;
      chapterUrls: string[];
      chapterTitles: string[];
      metadata: Metadata;
    },
    force: boolean
  ) {
    const result = await postJson<{
      jobId?: string;
      error?: string;
      duplicate?: { normalizedFileName: string; inQueue: boolean; onDisk: boolean };
    }>("/api/build-jobs", { ...payload, force });

    if (!result.ok) {
      if (result.status === 409 && result.data.duplicate) {
        setPendingPayload(payload);
        setDuplicateWarning(result.data.duplicate);
        return;
      }
      throw new Error(result.data.error || "Failed to enqueue build job");
    }

    if (!result.data.jobId) {
      throw new Error("Failed to enqueue build job");
    }

    setDuplicateWarning(null);
    setPendingPayload(null);
    onJobQueued(result.data.jobId);
    toast.success(`Build job queued (${result.data.jobId.slice(0, 8)}).`);
  }

  async function precheckDuplicate(payload: { metadata: Metadata }) {
    const result = await postJson<{
      duplicate?: { normalizedFileName: string; inQueue: boolean; onDisk: boolean };
      error?: string;
    }>("/api/build-jobs/check-duplicate", { metadata: payload.metadata });

    if (!result.ok || !result.data.duplicate) {
      throw new Error(result.data.error || "Failed to check duplicate file name");
    }
    return result.data.duplicate;
  }

  async function onEnqueueBuild() {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      toast.warning("Enter a URL first.");
      return;
    }
    if (!parserId) {
      toast.warning("Run preview before building.");
      return;
    }
    if (selectedChapters.length === 0) {
      toast.warning("Pick a valid chapter range.");
      return;
    }

    const payload: {
      url: string;
      parserId: string;
      chapterUrls: string[];
      chapterTitles: string[];
      metadata: Metadata;
    } = {
      url: trimmedUrl,
      parserId,
      chapterUrls: selectedChapters.map((chapter) => chapter.sourceUrl),
      chapterTitles: selectedChapters.map((chapter) => chapter.title),
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
      const duplicate = await precheckDuplicate(payload);
      if (duplicate.inQueue || duplicate.onDisk) {
        setPendingPayload(payload);
        setDuplicateWarning(duplicate);
        return;
      }

      await enqueueBuild(payload, false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to enqueue build");
    } finally {
      setIsEnqueueing(false);
    }
  }

  async function onConfirmDuplicateEnqueue() {
    if (!pendingPayload) {
      setDuplicateWarning(null);
      return;
    }

    setIsEnqueueing(true);
    try {
      await enqueueBuild(pendingPayload, true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to enqueue build");
    } finally {
      setIsEnqueueing(false);
    }
  }

  function onCloseDuplicateWarning() {
    setDuplicateWarning(null);
    setPendingPayload(null);
  }

  async function onCoverUpload(file: File | null) {
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.warning("Cover upload must be an image file.");
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
    toast.success(`Using uploaded cover file: ${file.name}`);
  }

  return {
    url,
    setUrl,
    isPreviewLoading,
    isEnqueueing,
    availableParsers,
    selectedParserId,
    setSelectedParserId,
    parserId,
    chapters,
    startIndex,
    setStartIndex,
    endIndex,
    setEndIndex,
    title,
    setTitle,
    author,
    setAuthor,
    language,
    setLanguage,
    description,
    setDescription,
    fileName,
    setFileName,
    coverImageUrl,
    setCoverImageUrl,
    detectedCoverImageUrl,
    setDetectedCoverImageUrl,
    coverUploadName,
    setCoverUploadName,
    duplicateWarning,
    onConfirmDuplicateEnqueue,
    onCloseDuplicateWarning,
    hasPreview,
    selectedRange,
    selectedChapters,
    onPreview,
    onEnqueueBuild,
    onCoverUpload,
  };
}
