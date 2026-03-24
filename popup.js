let keywordHistory = [];
let selectedKeywordSet = new Set();

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        const err = chrome.runtime.lastError;
        if (err) reject(err);
        else resolve(response || {});
      });
    } catch (e) {
      reject(e);
    }
  });
}

function extractKeywordsFromValue(value) {
  if (!value) return [];
  return value
    .split(/[，,]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function saveKeywordHistory(history) {
  keywordHistory = Array.isArray(history) ? history : [];
  chrome.storage.local.set({ netSnifferSearchHistory: keywordHistory });
}

function updateKeywordHistoryFromValue(value) {
  const keywords = extractKeywordsFromValue(value);
  if (!keywords.length) return;

  let history = Array.isArray(keywordHistory) ? [...keywordHistory] : [];

  for (let i = keywords.length - 1; i >= 0; i -= 1) {
    const kw = keywords[i];
    const existingIndex = history.indexOf(kw);
    if (existingIndex !== -1) {
      history.splice(existingIndex, 1);
    }
    history.unshift(kw);
  }

  if (history.length > 20) {
    history = history.slice(0, 20);
  }

  saveKeywordHistory(history);
}

function syncKeywordInputFromSelection() {
  const input = document.getElementById("pathKeyword");
  if (!input) return;

  const values = Array.from(selectedKeywordSet);
  input.value = values.join(", ");
  // 触发 change 事件，让原有逻辑同步到 background
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function renderKeywordHistoryDropdown() {
  const dropdown = document.getElementById("keywordHistoryDropdown");
  if (!dropdown) return;

  dropdown.innerHTML = "";
  const latest = Array.isArray(keywordHistory) ? keywordHistory.slice(0, 10) : [];

  latest.forEach((keyword) => {
    const item = document.createElement("div");
    item.className = "kw-history-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = selectedKeywordSet.has(keyword);

    const label = document.createElement("span");
    label.textContent = keyword;

    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selectedKeywordSet.add(keyword);
      } else {
        selectedKeywordSet.delete(keyword);
      }
      syncKeywordInputFromSelection();
    });

    item.addEventListener("click", (e) => {
      if (e.target === checkbox) return;
      checkbox.checked = !checkbox.checked;
      if (checkbox.checked) {
        selectedKeywordSet.add(keyword);
      } else {
        selectedKeywordSet.delete(keyword);
      }
      syncKeywordInputFromSelection();
    });

    item.appendChild(checkbox);
    item.appendChild(label);
    dropdown.appendChild(item);
  });
}

function showKeywordHistoryDropdown() {
  const dropdown = document.getElementById("keywordHistoryDropdown");
  if (!dropdown || !keywordHistory.length) return;
  renderKeywordHistoryDropdown();
  dropdown.style.display = "block";
}

function hideKeywordHistoryDropdown() {
  const dropdown = document.getElementById("keywordHistoryDropdown");
  if (!dropdown) return;
  dropdown.style.display = "none";
}

function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

function createRequestItem(record) {
  const li = document.createElement("li");
  li.className = "request-item-simple";

  const statusClass = (record.status >= 400 || record.status === 0) ? "error" : "ok";
  const methodClass = (record.method === "GET" || record.method === "POST") ? `method-${record.method}` : "method-default";
  
  li.innerHTML = `
    <div class="row">
      <span class="badge method ${methodClass}">${record.method}</span>
      <span class="path-compact" title="${record.path}">${record.path}</span>
      <span class="badge status-${statusClass}">${record.status || 0}</span>
      <span class="time-compact">${formatTime(record.createdAt)}</span>
    </div>
  `;
  return li;
}

async function refresh() {
  const list = document.getElementById("requestList");
  const emptyHint = document.getElementById("emptyHint");
  list.innerHTML = "";

  try {
    const res = await sendMessage({ type: "get-logs" });
    const logs = res.logs || [];
    const settings = res.settings || {};

    const keywordInput = document.getElementById("pathKeyword");
    if (keywordInput) {
      keywordInput.value = settings.pathKeyword || "";
      selectedKeywordSet = new Set(extractKeywordsFromValue(keywordInput.value));
      if (keywordHistory.length) {
        renderKeywordHistoryDropdown();
      }
    }

    if (!logs.length) {
      emptyHint.style.display = "block";
      return;
    }

    emptyHint.style.display = "none";
    logs.forEach((record) => {
      list.appendChild(createRequestItem(record));
    });
  } catch (e) {
    emptyHint.style.display = "block";
    emptyHint.textContent = "加载失败";
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  // 初始化主题
  await initTheme();

  chrome.storage.local.get("netSnifferSearchHistory", (data) => {
    if (Array.isArray(data.netSnifferSearchHistory)) {
      keywordHistory = data.netSnifferSearchHistory;
    } else {
      keywordHistory = [];
    }
  });

  const keywordInput = document.getElementById("pathKeyword");
  const dropdown = document.getElementById("keywordHistoryDropdown");

  if (dropdown) {
    dropdown.addEventListener("mousedown", (e) => {
      // 防止点击下拉时输入框失焦
      e.preventDefault();
    });
  }

  if (keywordInput) {
    keywordInput.addEventListener("focus", () => {
      if (keywordHistory.length) {
        showKeywordHistoryDropdown();
      }
    });

    keywordInput.addEventListener("blur", () => {
      setTimeout(() => {
        hideKeywordHistoryDropdown();
      }, 150);
    });

    keywordInput.addEventListener("change", async (e) => {
      await sendMessage({ type: "update-settings", settings: { pathKeyword: e.target.value.trim() } });
    });

    keywordInput.addEventListener("input", async () => {
      const currentValue = keywordInput.value;
      const trimmedValue = currentValue.trim();

      // 实时同步设置到 background，使抓包立刻按最新关键词过滤
      await sendMessage({ type: "update-settings", settings: { pathKeyword: trimmedValue } });

      // 同步当前输入解析到选中集合，确保手动输入多关键词也能被 Set 追踪
      selectedKeywordSet = new Set(extractKeywordsFromValue(currentValue));
      const dropdownEl = document.getElementById("keywordHistoryDropdown");
      if (dropdownEl && dropdownEl.style.display !== "none" && keywordHistory.length) {
        renderKeywordHistoryDropdown();
      }
    });
  }

  document.getElementById("refreshBtn").addEventListener("click", refresh);
  
  document.getElementById("clearBtn").addEventListener("click", async () => {
    await sendMessage({ type: "clear-logs" });
    refresh();
  });

  document.getElementById("viewDetailsBtn").addEventListener("click", () => {
    chrome.tabs.create({ url: 'details.html' });
  });

  const settingsBtn = document.getElementById("settingsBtn");
  if (settingsBtn) {
    settingsBtn.addEventListener("click", () => {
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        // 兼容旧版本
        chrome.tabs.create({ url: chrome.runtime.getURL("options.html") });
      }
    });
  }

  refresh();
});
