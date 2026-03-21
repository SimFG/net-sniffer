const DEFAULT_SETTINGS = {
  pathKeyword: "",
  recordMode: "first",
  truncateJson: true
};

let currentSettings = { ...DEFAULT_SETTINGS };
let commonKeywords = [];

async function loadSettings() {
  const data = await chrome.storage.local.get(["netSnifferSettings", "netSnifferSearchHistory"]);
  if (data.netSnifferSettings) {
    currentSettings = { ...DEFAULT_SETTINGS, ...data.netSnifferSettings };
  } else {
    currentSettings = { ...DEFAULT_SETTINGS };
  }

  if (Array.isArray(data.netSnifferSearchHistory)) {
    commonKeywords = data.netSnifferSearchHistory;
  } else if (data.netSnifferSearchHistory && typeof data.netSnifferSearchHistory === "object" && Array.isArray(data.netSnifferSearchHistory.commonKeywords)) {
    // 兼容可能的扩展结构：{ commonKeywords: [] }
    commonKeywords = data.netSnifferSearchHistory.commonKeywords;
  } else {
    commonKeywords = [];
  }

  const recordFirstToggle = document.getElementById("recordFirstToggle");
  const truncateJsonToggle = document.getElementById("truncateJsonToggle");

  recordFirstToggle.checked = (currentSettings.recordMode || "first") === "first";
  // truncateJson 默认 true，当未配置或为 true 时视为开启
  truncateJsonToggle.checked = currentSettings.truncateJson !== false;

  renderCommonKeywords();
}

function renderCommonKeywords() {
  const container = document.getElementById("commonKeywordsList");
  if (!container) return;

  container.innerHTML = "";
  const list = Array.isArray(commonKeywords) ? commonKeywords : [];

  if (!list.length) {
    const empty = document.createElement("span");
    empty.className = "history-empty";
    empty.textContent = "暂无常用关键词";
    container.appendChild(empty);
    return;
  }

  list.forEach((keyword) => {
    const tag = document.createElement("span");
    tag.className = "history-tag";

    const textSpan = document.createElement("span");
    textSpan.textContent = keyword;

    const delBtn = document.createElement("button");
    delBtn.className = "history-tag-delete";
    delBtn.textContent = "×";
    delBtn.title = "删除该关键词";
    delBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await deleteCommonKeyword(keyword);
    });

    tag.appendChild(textSpan);
    tag.appendChild(delBtn);
    container.appendChild(tag);
  });
}

async function saveSettings() {
  const recordFirstToggle = document.getElementById("recordFirstToggle");
  const truncateJsonToggle = document.getElementById("truncateJsonToggle");
  const saveBtn = document.getElementById("saveBtn");
  const saveStatus = document.getElementById("saveStatus");

  // 先读最新存储，避免覆盖 pathKeyword 等其他字段
  const latest = await chrome.storage.local.get("netSnifferSettings");
  const latestSettings = latest.netSnifferSettings || { ...DEFAULT_SETTINGS };

  const nextSettings = {
    ...latestSettings,
    recordMode: recordFirstToggle.checked ? "first" : "all",
    truncateJson: !!truncateJsonToggle.checked
  };

  await chrome.storage.local.set({ netSnifferSettings: nextSettings });
  currentSettings = nextSettings;

  // 视觉反馈
  saveBtn.classList.add("saved");
  saveStatus.classList.add("visible");

  setTimeout(() => {
    saveBtn.classList.remove("saved");
    saveStatus.classList.remove("visible");
  }, 1500);
}

async function saveCommonKeywords() {
  await chrome.storage.local.set({ netSnifferSearchHistory: commonKeywords });
}

async function addCommonKeyword() {
  const input = document.getElementById("newCommonKeywordInput");
  if (!input) return;

  const value = (input.value || "").trim();
  if (!value) return;

  if (!Array.isArray(commonKeywords)) {
    commonKeywords = [];
  }

  // 避免重复
  if (!commonKeywords.includes(value)) {
    commonKeywords.unshift(value);
    await saveCommonKeywords();
    renderCommonKeywords();
  }

  input.value = "";
}

async function deleteCommonKeyword(keyword) {
  if (!Array.isArray(commonKeywords) || !commonKeywords.length) return;

  commonKeywords = commonKeywords.filter((k) => k !== keyword);
  await saveCommonKeywords();
  renderCommonKeywords();
}

  document.addEventListener("DOMContentLoaded", () => {
    loadSettings();

      document.getElementById("saveBtn").addEventListener("click", () => {
        saveSettings().catch((err) => {
          console.error("[NetSniffer] save settings error", err);
        });
      });

      const addBtn = document.getElementById("addCommonKeywordBtn");
      const newKeywordInput = document.getElementById("newCommonKeywordInput");

      if (addBtn) {
        addBtn.addEventListener("click", () => {
          addCommonKeyword().catch((err) => {
            console.error("[NetSniffer] add common keyword error", err);
          });
        });
      }

      if (newKeywordInput) {
        newKeywordInput.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            addCommonKeyword().catch((err) => {
              console.error("[NetSniffer] add common keyword error", err);
            });
          }
        });
      }
  });
