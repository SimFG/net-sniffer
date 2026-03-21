(function () {
  if (window.__netSnifferInjected) return;
  window.__netSnifferInjected = true;

  function notify(payload) {
    window.dispatchEvent(new CustomEvent('__netSnifferRequest', { detail: payload }));
  }

  // Hook Fetch
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const input = args[0];
    const init = args[1] || {};
    const method = (init.method || "GET").toUpperCase();
    const url = typeof input === "string" ? input : (input && input.url) || "";
    const absoluteUrl = new URL(url, window.location.href).href;
    const requestBody = init.body || "";

    let response;
    try {
      response = await originalFetch.apply(this, args);
    } catch (err) {
      notify({ url: absoluteUrl, method, status: 0, body: String(err), requestBody });
      throw err;
    }

    try {
      const clone = response.clone();
      clone.text().then((bodyText) => {
        notify({ url: absoluteUrl, method, status: response.status, body: bodyText, requestBody });
      }).catch(() => {});
    } catch (e) {}

    return response;
  };

  // Hook XHR
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this.__netSnifferInfo = {
      method: (method || "GET").toUpperCase(),
      url: url || ""
    };
    return originalXHROpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function (body) {
    const xhr = this;
    if (this.__netSnifferInfo) {
      this.__netSnifferInfo.requestBody = body || "";
    }
    
    function handler() {
      try {
        const info = xhr.__netSnifferInfo || {};
        const url = info.url || xhr.responseURL || "";
        const absoluteUrl = new URL(url, window.location.href).href;
        const method = (info.method || "GET").toUpperCase();
        const requestBody = info.requestBody || "";
        let bodyText = "";
        if (xhr.responseType === "" || xhr.responseType === "text") {
          bodyText = xhr.responseText || "";
        }
        notify({ url: absoluteUrl, method, status: xhr.status, body: bodyText, requestBody });
      } catch (e) {}
    }
    xhr.addEventListener("load", handler);
    xhr.addEventListener("error", handler);
    return originalXHRSend.apply(this, arguments);
  };
})();
