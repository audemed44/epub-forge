const state = {
  parserId: null,
  chapters: [],
};

const el = {
  url: document.getElementById("urlInput"),
  status: document.getElementById("status"),
  previewBtn: document.getElementById("previewBtn"),
  buildBtn: document.getElementById("buildBtn"),
  metaPanel: document.getElementById("metaPanel"),
  chaptersPanel: document.getElementById("chaptersPanel"),
  title: document.getElementById("titleInput"),
  author: document.getElementById("authorInput"),
  language: document.getElementById("languageInput"),
  description: document.getElementById("descriptionInput"),
  startChapterSelect: document.getElementById("startChapterSelect"),
  endChapterSelect: document.getElementById("endChapterSelect"),
  rangeSummary: document.getElementById("rangeSummary"),
};

function setStatus(message) {
  el.status.textContent = message;
}

function chapterLabel(chapter, index) {
  const number = String(index + 1).padStart(4, "0");
  return `${number} - ${chapter.title}`;
}

function renderChapterRange(chapters) {
  el.startChapterSelect.innerHTML = "";
  el.endChapterSelect.innerHTML = "";

  chapters.forEach((chapter, index) => {
    const startOption = document.createElement("option");
    startOption.value = String(index);
    startOption.textContent = chapterLabel(chapter, index);
    el.startChapterSelect.appendChild(startOption);

    const endOption = document.createElement("option");
    endOption.value = String(index);
    endOption.textContent = chapterLabel(chapter, index);
    el.endChapterSelect.appendChild(endOption);
  });

  if (chapters.length) {
    el.startChapterSelect.value = "0";
    el.endChapterSelect.value = String(chapters.length - 1);
  }
  updateRangeSummary();
}

function getSelectedRange() {
  if (!state.chapters.length) {
    return { start: 0, end: -1 };
  }
  const start = Number(el.startChapterSelect.value || 0);
  const end = Number(el.endChapterSelect.value || 0);
  return {
    start: Math.max(0, Math.min(start, state.chapters.length - 1)),
    end: Math.max(0, Math.min(end, state.chapters.length - 1)),
  };
}

function syncRange(orderSource) {
  const { start, end } = getSelectedRange();
  if (start <= end) {
    return;
  }

  if (orderSource === "start") {
    el.endChapterSelect.value = String(start);
  } else {
    el.startChapterSelect.value = String(end);
  }
}

function updateRangeSummary() {
  if (!state.chapters.length) {
    el.rangeSummary.textContent = "";
    return;
  }

  const { start, end } = getSelectedRange();
  const count = end - start + 1;
  const startTitle = state.chapters[start]?.title || "";
  const endTitle = state.chapters[end]?.title || "";
  el.rangeSummary.textContent = `Selected ${count} chapters (from \"${startTitle}\" to \"${endTitle}\")`;
}

function selectedChapterUrls() {
  const { start, end } = getSelectedRange();
  return state.chapters.slice(start, end + 1).map((chapter) => chapter.sourceUrl);
}

async function preview() {
  const url = el.url.value.trim();
  if (!url) {
    setStatus("Enter a URL first");
    return;
  }

  setStatus("Loading preview...");
  el.previewBtn.disabled = true;
  try {
    const res = await fetch("/api/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Preview failed");
    }

    state.parserId = data.parserId;
    state.chapters = data.chapters;
    el.title.value = data.metadata.title || "";
    el.author.value = data.metadata.author || "";
    el.language.value = data.metadata.language || "en";
    el.description.value = data.metadata.description || "";
    renderChapterRange(data.chapters);

    el.metaPanel.classList.remove("hidden");
    el.chaptersPanel.classList.remove("hidden");
    setStatus(`Loaded ${data.chapters.length} chapters using parser '${data.parserId}'`);
  } catch (error) {
    setStatus(error.message);
  } finally {
    el.previewBtn.disabled = false;
  }
}

async function build() {
  const chapterUrls = selectedChapterUrls();
  if (!chapterUrls.length) {
    setStatus("Select a valid chapter range");
    return;
  }

  const payload = {
    url: el.url.value.trim(),
    parserId: state.parserId,
    chapterUrls,
    metadata: {
      sourceUrl: el.url.value.trim(),
      title: el.title.value.trim(),
      author: el.author.value.trim(),
      language: el.language.value.trim() || "en",
      description: el.description.value.trim() || null,
    },
  };

  setStatus("Building EPUB...");
  el.buildBtn.disabled = true;
  try {
    const response = await fetch("/api/build", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Build failed");
    }

    const blob = await response.blob();
    const disposition = response.headers.get("content-disposition") || "";
    const filename = disposition.match(/filename="([^"]+)"/)?.[1] || "book.epub";

    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);

    setStatus(`Download ready: ${filename} (${chapterUrls.length} chapters)`);
  } catch (error) {
    setStatus(error.message);
  } finally {
    el.buildBtn.disabled = false;
  }
}

el.previewBtn.addEventListener("click", preview);
el.buildBtn.addEventListener("click", build);
el.startChapterSelect.addEventListener("change", () => {
  syncRange("start");
  updateRangeSummary();
});
el.endChapterSelect.addEventListener("change", () => {
  syncRange("end");
  updateRangeSummary();
});
