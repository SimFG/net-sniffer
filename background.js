const DEFAULT_SETTINGS = {
  pathKeyword: "",
  recordMode: "first", // "all" | "first"
  truncateJson: true
};

let settings = { ...DEFAULT_SETTINGS };
let logs = [];
let seenKeys = new Set();

async function loadState() {
  try {
    const data = await chrome.storage.local.get([
      "netSnifferSettings",
      "netSnifferLogs",
      "netSnifferSeenKeys"
    ]);
    if (data.netSnifferSettings) settings = data.netSnifferSettings;
    if (Array.isArray(data.netSnifferLogs)) logs = data.netSnifferLogs;
    if (Array.isArray(data.netSnifferSeenKeys)) {
      seenKeys = new Set(data.netSnifferSeenKeys);
    }
  } catch (e) {
    console.error("[NetSniffer] loadState error", e);
  }
}

async function saveState() {
  try {
    await chrome.storage.local.set({
      netSnifferSettings: settings,
      netSnifferLogs: logs,
      netSnifferSeenKeys: Array.from(seenKeys)
    });
  } catch (e) {
    console.error("[NetSniffer] saveState error", e);
  }
}

function makeKey(payload) {
  const method = (payload.method || "GET").toUpperCase();
  const rawUrl = payload.url || "";
  try {
    const u = new URL(rawUrl);
    // 去重仅用 method + pathname，忽略 query params
    return `${method} ${u.origin}${u.pathname}`;
  } catch (_) {
    // 如果不是合法 URL（如相对路径），尝试去掉 ? 后面的部分
    const pathOnly = rawUrl.split("?")[0];
    return `${method} ${pathOnly}`;
  }
}

function extractPath(url) {
  try {
    const u = new URL(url);
    return u.pathname || "/";
  } catch (_) {
    return "/";
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (!message || !message.type) {
        sendResponse({ ok: false, error: "invalid-message" });
        return;
      }

      if (message.type === "network-request") {
        await loadState();
        // 如果未配置路径关键词，则不记录任何请求
        if (!settings || !settings.pathKeyword || !String(settings.pathKeyword).trim()) {
          sendResponse({ ok: true, ignored: true, reason: "no-path-keyword" });
          return;
        }
        const payload = message.payload || {};
        const url = payload.url || "";
        const method = (payload.method || "GET").toUpperCase();
        const status = payload.status || 0;
        const body = payload.body || "";
        const requestBody = payload.requestBody || "";
        const path = extractPath(url);

        // 仅获取 200 请求的响应
        if (status !== 200) {
          sendResponse({ ok: true, ignored: true, reason: "status-not-200" });
          return;
        }
        if (settings.pathKeyword) {
          const keywords = settings.pathKeyword.split(",").map(k => k.trim()).filter(Boolean);
          const matched = keywords.some(kw => path.includes(kw) || url.includes(kw));
          if (!matched) {
            sendResponse({ ok: true, ignored: true });
            return;
          }
        }

        const key = makeKey({ url, method });
        if (settings.recordMode === "first" && seenKeys.has(key)) {
          sendResponse({ ok: true, ignored: true });
          return;
        }

        const now = Date.now();
        const record = {
          id: `${now}-${Math.random().toString(16).slice(2)}`,
          url,
          method,
          status,
          path,
          body,
          requestBody,
          description: "",
          createdAt: now
        };

        logs.unshift(record);
        if (settings.recordMode === "first") {
          seenKeys.add(key);
        }

        await saveState();
        sendResponse({ ok: true, record });
      } else if (message.type === "get-logs") {
        await loadState();
        sendResponse({ ok: true, logs, settings });
      } else if (message.type === "update-settings") {
        await loadState();
        settings = {
          ...settings,
          ...(message.settings || {})
        };

        if (settings.recordMode !== "first") {
          seenKeys = new Set();
        }

        await saveState();
        sendResponse({ ok: true, settings });
      } else if (message.type === "update-description") {
        await loadState();
        const { id, description } = message;
        const idx = logs.findIndex((r) => r.id === id);
        if (idx !== -1) {
          logs[idx].description = description || "";
          await saveState();
          sendResponse({ ok: true });
        } else {
          sendResponse({ ok: false, error: "not-found" });
        }
      } else if (message.type === "clear-logs") {
        logs = [];
        seenKeys = new Set();
        await saveState();
        sendResponse({ ok: true });
      } else if (message.type === "replay-request") {
        const { id, url, method, requestBody } = message;

        // 参数校验
        if (!url || !method) {
          sendResponse({
            type: "replay-response",
            id,
            success: false,
            error: "invalid-parameters",
            duration: 0,
            timestamp: Date.now()
          });
          return;
        }

        // 构造 fetch 选项（初始版本不带 headers）
        const startTime = Date.now();
        const fetchOptions = {
          method: method,
        };

        // 仅 POST/PUT/PATCH 带 body
        if (["POST", "PUT", "PATCH"].includes(method) && requestBody) {
          fetchOptions.body = requestBody;
        }

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s 超时
          fetchOptions.signal = controller.signal;

          const response = await fetch(url, fetchOptions);
          clearTimeout(timeoutId);

          const duration = Date.now() - startTime;
          let bodyText = "";
          try {
            bodyText = await response.text();
          } catch (_) {
            bodyText = "[无法读取响应体]";
          }

          sendResponse({
            type: "replay-response",
            id,
            success: response.ok,
            status: response.status,
            statusText: response.statusText,
            body: bodyText,
            duration,
            timestamp: Date.now()
          });
        } catch (e) {
          const duration = Date.now() - startTime;
          let errorMsg = e.message || "unknown-error";

          if (e.name === "AbortError") {
            errorMsg = "request-timeout";
          } else if (e.message.includes("Failed to fetch") || e.message.includes("NetworkError")) {
            errorMsg = "cors-error";
          }

          sendResponse({
            type: "replay-response",
            id,
            success: false,
            error: errorMsg,
            duration,
            timestamp: Date.now()
          });
        }
      } else {
        sendResponse({ ok: false, error: "unknown-type" });
      }
    } catch (e) {
      console.error("[NetSniffer] onMessage error", e);
      sendResponse({ ok: false, error: e && e.message });
    }
  })();

  // 表示我们会异步调用 sendResponse
  return true;
});

// service worker 启动时预加载一次状态
loadState();

// 监听配置变更，确保多页面同步生效
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local") {
    if (changes.netSnifferSettings) {
      settings = changes.netSnifferSettings.newValue || { ...DEFAULT_SETTINGS };
      // 如果 recordMode 变为 all，清空已记录的 key 以允许重新抓取
      if (settings.recordMode !== "first") {
        seenKeys = new Set();
      }
    }
    if (changes.netSnifferLogs) {
      logs = changes.netSnifferLogs.newValue || [];
    }
  }
});
