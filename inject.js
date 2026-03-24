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

    // 捕获 headers
    let headers = {};
    if (init.headers) {
      if (init.headers instanceof Headers) {
        try {
          headers = Object.fromEntries(init.headers.entries());
        } catch (_) {}
      } else if (Array.isArray(init.headers)) {
        init.headers.forEach(([k, v]) => { headers[k] = v; });
      } else if (typeof init.headers === 'object') {
        headers = { ...init.headers };
      }
    }

    let response;
    try {
      response = await originalFetch.apply(this, args);
    } catch (err) {
      notify({ url: absoluteUrl, method, status: 0, body: String(err), requestBody, headers });
      throw err;
    }

    try {
      const clone = response.clone();
      clone.text().then((bodyText) => {
        notify({ url: absoluteUrl, method, status: response.status, body: bodyText, requestBody, headers });
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

        // 捕获 XHR headers
        const headers = {};
        try {
          const headerString = xhr.getAllRequestHeaders();
          if (headerString) {
            headerString.split(/\r?\n/).forEach(line => {
              const idx = line.indexOf(': ');
              if (idx > 0) {
                const key = line.substring(0, idx);
                const value = line.substring(idx + 2);
                headers[key] = value;
              }
            });
          }
        } catch (_) {}

        let bodyText = "";
        if (xhr.responseType === "" || xhr.responseType === "text") {
          bodyText = xhr.responseText || "";
        }
        notify({ url: absoluteUrl, method, status: xhr.status, body: bodyText, requestBody, headers });
      } catch (e) {}
    }
    xhr.addEventListener("load", handler);
    xhr.addEventListener("error", handler);
    return originalXHRSend.apply(this, arguments);
  };
})();
