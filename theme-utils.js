const THEME_KEY = 'theme';

/**
 * 获取当前系统主题是否为暗色
 */
function getSystemPrefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * 根据存储的主题设置返回实际应使用的 theme 值
 * @returns {'dark' | 'light'}
 */
async function resolveEffectiveTheme() {
  try {
    const data = await chrome.storage.local.get(['netSnifferSettings']);
    const theme = data?.netSnifferSettings?.theme || 'system';
    if (theme === 'system') {
      return getSystemPrefersDark() ? 'dark' : 'light';
    }
    return theme; // 'light' or 'dark'
  } catch {
    return getSystemPrefersDark() ? 'dark' : 'light';
  }
}

/**
 * 设置 document 的 data-theme 属性
 * @param {'dark' | 'light'} theme
 */
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
}

/**
 * 初始化主题系统
 */
async function initTheme() {
  const effective = await resolveEffectiveTheme();
  applyTheme(effective);

  // 监听系统主题变化（仅在 theme=system 时生效）
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', async () => {
    try {
      const data = await chrome.storage.local.get(['netSnifferSettings']);
      if (data?.netSnifferSettings?.theme === 'system') {
        applyTheme(getSystemPrefersDark() ? 'dark' : 'light');
      }
    } catch {
      // 静默失败，不影响用户操作
    }
  });
}

/**
 * 设置主题并持久化
 * @param {'system' | 'light' | 'dark'} theme
 */
async function setTheme(theme) {
  // 先读取完整设置，避免覆盖其他字段
  const data = await chrome.storage.local.get(['netSnifferSettings']);
  const current = data.netSnifferSettings || {};
  await chrome.storage.local.set({
    netSnifferSettings: { ...current, theme }
  });

  // 立即应用
  if (theme === 'system') {
    applyTheme(getSystemPrefersDark() ? 'dark' : 'light');
  } else {
    applyTheme(theme);
  }
}
