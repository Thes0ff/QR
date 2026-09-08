/* Shared UI utilities. No build step or runtime framework required. */
(() => {
  'use strict';
  const storage = {
    get(key, session = false) { try { return (session ? sessionStorage : localStorage).getItem(key); } catch { return null; } },
    set(key, value, session = false) { try { (session ? sessionStorage : localStorage).setItem(key, value); return true; } catch { return false; } },
    remove(key, session = false) { try { (session ? sessionStorage : localStorage).removeItem(key); } catch {} }
  };
  const iconPaths = {
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 14h7v7h-7z"/>',
    qr: '<path d="M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h2v2h-2zM21 14v4h-3v3h-4m7 0h.01"/>',
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/>',
    message: '<path d="M21 11a8 8 0 0 1-8 8H7l-4 3V5a2 2 0 0 1 2-2h8a8 8 0 0 1 8 8Z"/><path d="M7 8h9M7 12h6"/>',
    link: '<path d="m10 13 4-4m-6 1-2 2a4 4 0 0 0 6 6l2-2m-4-8 2-2a4 4 0 0 1 6 6l-2 2"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>',
    moon: '<path d="M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10Z"/>',
    printer: '<path d="M6 9V3h12v6M6 18H3V9h18v9h-3M6 14h12v7H6zM17 12h1"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    upload: '<path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/>',
    copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
    logout: '<path d="M10 4H3v16h7m-2-8h13m-5-5 5 5-5 5"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v2"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    nfc: '<path d="M7 7a7 7 0 0 1 10 0M4 4a11 11 0 0 1 16 0M10 10a3 3 0 0 1 4 0M12 14v7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    refresh: '<path d="M20 7v5h-5M4 17v-5h5M5 7a8 8 0 0 1 13-2l2 3M4 16l2 3a8 8 0 0 0 13-2"/>',
    star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
    telegram: '<path d="m3 10 18-7-4 18-6-6-4 3v-6l10-6-7 8z"/>',
    pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/>'
  };
  function icon(name) {
    return '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (iconPaths[name] || iconPaths.grid) + '</svg>';
  }
  function hydrateIcons(root = document) { root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); }); }
  const systemTheme = matchMedia('(prefers-color-scheme: dark)');
  function applyTheme(theme) {
    const dark = theme ? theme === 'dark' : systemTheme.matches;
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      button.innerHTML = icon(dark ? 'sun' : 'moon');
      button.setAttribute('aria-label', dark ? 'Включить светлую тему' : 'Включить тёмную тему');
      button.title = button.getAttribute('aria-label');
    });
  }
  applyTheme(storage.get('sk_theme'));
  systemTheme.addEventListener('change', () => { if (!storage.get('sk_theme')) applyTheme(); });
  async function request(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || (response.status === 401 ? 'Проверьте данные доступа.' : 'Сервис временно недоступен. Попробуйте ещё раз.'));
      return data;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('Время ожидания истекло. Проверьте подключение и повторите попытку.');
      if (error instanceof TypeError) throw new Error('Нет соединения с сервером. Проверьте интернет и попробуйте ещё раз.');
      throw error;
    } finally { clearTimeout(timer); }
  }
  function safeUrl(value) { try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } }
  function validId(value) { return Boolean(value && value.length <= 64 && !/[\u0000-\u001f]/.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value)); }
  function shopUrl(id) { return 'https://servis-kontrol.ru/?id=' + encodeURIComponent(id); }
  async function copy(text, button) {
    const old = button.textContent;
    try { await navigator.clipboard.writeText(text); button.textContent = 'Скопировано'; }
    catch { button.textContent = 'Выделите и скопируйте ссылку'; }
    setTimeout(() => { button.textContent = old; }, 2400);
  }
  function message(element, text, type = 'error') { element.textContent = text; element.className = 'notice ' + type; element.hidden = !text; }
  document.addEventListener('DOMContentLoaded', () => {
    hydrateIcons(); applyTheme(storage.get('sk_theme'));
    document.querySelectorAll('[data-theme-toggle]').forEach(button => button.addEventListener('click', () => {
      const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      storage.set('sk_theme', theme); applyTheme(theme);
    }));
  });
  window.SK = { storage, icon, hydrateIcons, request, safeUrl, validId, shopUrl, copy, message, gistId: '052f7c277f6e1fc78a305e81e2135f65' };
})();
