function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleString();
}

function getRichnessScore(val) {
  if (val === null || typeof val !== 'object') return 1;
  if (Array.isArray(val)) {
    return 1 + val.reduce((acc, item) => Math.max(acc, getRichnessScore(item)), 0);
  }
  return 1 + Object.keys(val).length + Object.values(val).reduce((acc, item) => acc + getRichnessScore(item), 0);
}

let truncateJsonEnabled = true; // 默认开启自动截断
let allRecords = [];

function extractKeywordsFromValue(value) {
  if (!value) return [];
  return value
    .split(/[，,]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function processData(data) {
  if (data === null || typeof data !== 'object') return data;
  if (Array.isArray(data)) {
    if (data.length === 0) return [];
    let bestItem = data[0];
    let maxScore = -1;
    data.forEach(item => {
      const score = getRichnessScore(item);
      if (score > maxScore) {
        maxScore = score;
        bestItem = item;
      }
    });
    const processed = processData(bestItem);
    return data.length > 1 ? [processed, `// ... 已截断(共${data.length}条)，已选结构最全的一条`] : [processed];
  }
  const result = {};
  for (const key in data) {
    result[key] = processData(data[key]);
  }
  return result;
}

function truncateForAI(body) {
  if (!body) return "(空)";
  try {
    const data = JSON.parse(body);
    if (!truncateJsonEnabled) {
      // 不做裁剪，返回完整 JSON
      return JSON.stringify(data, null, 2);
    }
    const processed = processData(data);
    return JSON.stringify(processed, null, 2);
  } catch (e) {
    return body.length > 1000 ? body.slice(0, 1000) + "..." : body;
  }
}

function renderRecords(records) {
  const container = document.getElementById("recordsContainer");
  container.innerHTML = "";

  if (!records || records.length === 0) {
    container.innerHTML = "<p>暂无记录</p>";
    return;
  }

  records.forEach(record => {
    const div = document.createElement("div");
    div.className = "record";
    const statusClass = (record.status >= 400 || record.status === 0) ? "status-error" : "status-ok";
    const methodClass = (record.method === "GET" || record.method === "POST") ? `method-${record.method}` : "method-default";
    
    div.innerHTML = `
      <div class="record-header">
        <span class="badge method ${methodClass}">${record.method}</span>
        <span class="badge ${statusClass}">${record.status || "PENDING"}</span>
        <strong style="font-size: 14px; flex: 1; word-break: break-all;">${record.path}</strong>
        <span style="color: #9ca3af; font-size: 12px;">${formatTime(record.createdAt)}</span>
      </div>
      <div style="font-size: 12px; color: #4b5563; margin-bottom: 10px;">URL: ${record.url}</div>
      
      ${record.method !== 'GET' ? `
        <div class="section-title">Request Body</div>
        <pre>${truncateForAI(record.requestBody)}</pre>
      ` : ''}
      
      <div class="section-title">Response Body</div>
      <pre>${truncateForAI(record.body)}</pre>
      
      <div class="section-title">描述 (将导出至 Markdown)</div>
      <textarea class="desc-box" data-id="${record.id}" placeholder="添加描述，例如该接口的业务逻辑...">${record.description || ""}</textarea>
    `;
    
    const textarea = div.querySelector('textarea');
    textarea.addEventListener('change', async (e) => {
      const { netSnifferLogs: logs } = await chrome.storage.local.get("netSnifferLogs");
      const idx = logs.findIndex(r => r.id === e.target.dataset.id);
      if (idx !== -1) {
        logs[idx].description = e.target.value;
        await chrome.storage.local.set({ netSnifferLogs: logs });
      }
    });
    container.appendChild(div);
  });
}

async function loadRecords() {
  const { netSnifferLogs, netSnifferSettings } = await chrome.storage.local.get([
    "netSnifferLogs",
    "netSnifferSettings"
  ]);

  // 读取 truncateJson 开关，默认 true
  if (netSnifferSettings && Object.prototype.hasOwnProperty.call(netSnifferSettings, "truncateJson")) {
    truncateJsonEnabled = netSnifferSettings.truncateJson !== false;
  } else {
    truncateJsonEnabled = true;
  }

  allRecords = Array.isArray(netSnifferLogs) ? netSnifferLogs : [];
  renderRecords(allRecords);
}

function setupPathFilter() {
  const input = document.getElementById("pathFilterInput");
  if (!input) return;

  const applyFilter = () => {
    const currentValue = input.value;
    const rawKeywords = extractKeywordsFromValue(currentValue);
    const keywords = rawKeywords.map((k) => k.toLowerCase());

    if (!keywords.length) {
      renderRecords(allRecords);
    } else {
      const filtered = allRecords.filter((record) => {
        const path = (record && record.path) || "";
        const lowerPath = path.toLowerCase();
        return keywords.some((kw) => lowerPath.includes(kw));
      });
      renderRecords(filtered);
    }
  };

  // 初始化时根据已有输入值同步一次选中集合
  applyFilter();

  input.addEventListener("input", applyFilter);
}

document.getElementById("exportMd").addEventListener("click", async () => {
  const { netSnifferLogs: logs } = await chrome.storage.local.get("netSnifferLogs");
  let md = "# 网络请求调研报告 (AI Context)\n\n";
  md += "本文件包含捕获的 API 请求和返回结构，已针对 AI 场景进行截断优化。\n\n";

  logs.forEach((r, i) => {
    md += `## ${i + 1}. [${r.method}] ${r.path}\n`;
    md += `- **URL**: ${r.url}\n`;
    md += `- **状态码**: ${r.status}\n`;
    if (r.description) md += `- **业务描述**: ${r.description}\n`;
    
    if (r.method !== 'GET') {
      md += `\n### Request Body\n\`\`\`json\n${truncateForAI(r.requestBody)}\n\`\`\`\n`;
    }
    
    md += `\n### Response Body (仅保留结构)\n\`\`\`json\n${truncateForAI(r.body)}\n\`\`\`\n\n`;
    md += "---\n\n";
  });

  const blob = new Blob([md], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `api-sniff-report-${new Date().getTime()}.md`;
  a.click();
});

async function initDetailsPage() {
  await initTheme();
  setupPathFilter();
  await loadRecords();
}

initDetailsPage();
