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

// 执行注入
injectScript();
