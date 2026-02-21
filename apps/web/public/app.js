const state = {
  parserId: null,
  chapters: [],
};

const el = {
  url: document.getElementById("urlInput"),
  status: document.getElementById("status"),
  previewBtn: document.getElementById("previewBtn"),
  buildBtn: document.getElementById("buildBtn"),
  selectAllBtn: document.getElementById("selectAllBtn"),
  selectNoneBtn: document.getElementById("selectNoneBtn"),
  metaPanel: document.getElementById("metaPanel"),
  chaptersPanel: document.getElementById("chaptersPanel"),
  title: document.getElementById("titleInput"),
  author: document.getElementById("authorInput"),
  language: document.getElementById("languageInput"),
  description: document.getElementById("descriptionInput"),
  chaptersBody: document.getElementById("chaptersBody"),
};

function setStatus(message) {
  el.status.textContent = message;
}

function renderChapters(chapters) {
  el.chaptersBody.innerHTML = "";
  for (const chapter of chapters) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><input type="checkbox" data-url="${chapter.sourceUrl}" checked /></td>
      <td>${chapter.title}</td>
      <td><a href="${chapter.sourceUrl}" target="_blank" rel="noopener">${chapter.sourceUrl}</a></td>
    `;
    el.chaptersBody.appendChild(row);
  }
}

function selectedChapterUrls() {
  return [...el.chaptersBody.querySelectorAll("input[type='checkbox']")]
    .filter((cb) => cb.checked)
    .map((cb) => cb.dataset.url);
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
    renderChapters(data.chapters);

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
    setStatus("Select at least one chapter");
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

    setStatus(`Download ready: ${filename}`);
  } catch (error) {
    setStatus(error.message);
  } finally {
    el.buildBtn.disabled = false;
  }
}

function setAllSelected(value) {
  [...el.chaptersBody.querySelectorAll("input[type='checkbox']")].forEach((cb) => {
    cb.checked = value;
  });
}

el.previewBtn.addEventListener("click", preview);
el.buildBtn.addEventListener("click", build);
el.selectAllBtn.addEventListener("click", () => setAllSelected(true));
el.selectNoneBtn.addEventListener("click", () => setAllSelected(false));
