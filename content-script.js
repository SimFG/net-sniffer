// content-script.js
// 运行在 Isolated World，负责中转消息到 background.js

function injectScript() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('inject.js');
  script.onload = function() {
    this.remove();
  };
  (document.head || document.documentElement).appendChild(script);
}

// 监听来自 MAIN World (inject.js) 的事件
window.addEventListener('__netSnifferRequest', (event) => {
  const payload = event.detail;
  try {
    chrome.runtime.sendMessage({
      type: "network-request",
      payload
    });
  } catch (e) {
    // 可能是扩展上下文已失效
  }
});

// 监听来自 background.js 的 replay 请求
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "replay-in-tab") {
    const { id, url, method, requestBody, headers } = message;
    handleReplayInTab(id, url, method, requestBody, headers)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({
        type: "replay-response",
        id,
        success: false,
        error: err.message || "replay-failed",
        duration: 0,
        timestamp: Date.now()
      }));
    return true; // 表示异步响应
  }
});

async function handleReplayInTab(id, url, method, requestBody, headers) {
  const startTime = Date.now();

  const fetchOptions = {
    method: method || "GET",
  };

  // 添加 headers
  if (headers && typeof headers === 'object' && Object.keys(headers).length > 0) {
    try {
      fetchOptions.headers = new Headers(headers);
    } catch (_) {}
  }

  // 仅 POST/PUT/PATCH 带 body
  if (["POST", "PUT", "PATCH"].includes(method) && requestBody) {
    fetchOptions.body = requestBody;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
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

    return {
      type: "replay-response",
      id,
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      body: bodyText,
      duration,
      timestamp: Date.now()
    };
  } catch (e) {
    const duration = Date.now() - startTime;
    let errorMsg = e.message || "unknown-error";

    if (e.name === "AbortError") {
      errorMsg = "request-timeout";
    } else if (e.message.includes("Failed to fetch") || e.message.includes("NetworkError")) {
      errorMsg = "cors-error";
    }

    return {
      type: "replay-response",
      id,
      success: false,
      error: errorMsg,
      duration,
      timestamp: Date.now()
    };
  }
}

// 执行注入
injectScript();
