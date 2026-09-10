(() => {
  'use strict';

  const { storage, request, safeUrl, validId, shopUrl, message } = SK;
  const $ = id => document.getElementById(id);
  const venueTemplates = window.SK_FEEDBACK_TEMPLATES || {
    universal: { label: 'Универсальный', replies: [] }
  };
  const venueTemplateKeys = new Set(Object.keys(venueTemplates));
  const fieldIds = ['shopId', 'shopName', 'venueType', 'yandexUrl', 'gisUrl', 'targetTg', 'targetVk', 'targetEmail'];
  const value = id => $(id).value.trim();
  const venueSelect = $('venueType');
  let activeToken = '';
  let authBusy = false;
  let saving = false;

  Object.entries(venueTemplates).forEach(([key, template]) => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = template.label;
    venueSelect.append(option);
  });
  venueSelect.value = venueTemplateKeys.has('universal') ? 'universal' : Object.keys(venueTemplates)[0];

  function login() {
    securityLoading.hidden = true;
    authScreen.hidden = false;
    adminWorkspace.hidden = true;
  }

  function admin() {
    securityLoading.hidden = true;
    authScreen.hidden = true;
    adminWorkspace.hidden = false;
    gistId.value = storage.get('cfg_gist_id') || SK.gistId;
    const legacy = storage.get('cfg_gh_token');
    if (legacy) {
      storage.set('cfg_gh_token', legacy, true);
      storage.remove('cfg_gh_token');
    }
    ghToken.value = storage.get('cfg_gh_token', true) || '';
    accessDetails.open = !ghToken.value;
    const id = new URLSearchParams(location.search).get('id');
    if (validId(id)) shopId.value = id;
    preview();
  }

  function clearAuth() {
    activeToken = '';
    storage.remove('sk_admin_token');
    storage.remove('sk_admin_token', true);
  }

  async function init() {
    activeToken = storage.get('sk_admin_token') || storage.get('sk_admin_token', true) || '';
    if (!activeToken) return login();
    try {
      const result = await request('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: activeToken })
      });
      if (!result.success) throw new Error('Нет доступа');
      admin();
    } catch {
      clearAuth();
      login();
    }
  }

  authForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (authBusy) return;
    authBusy = true;
    btnAuth.disabled = true;
    btnAuth.textContent = 'Проверяем…';
    message(authError, '');
    try {
      const result = await request('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassInput.value })
      });
      if (!result.success || !result.token) throw new Error('Не удалось подтвердить вход.');
      clearAuth();
      activeToken = result.token;
      storage.set('sk_admin_token', result.token, !rememberMe.checked);
      admin();
    } catch (error) {
      message(authError, error.message);
      adminPassInput.focus();
    } finally {
      authBusy = false;
      btnAuth.disabled = false;
      btnAuth.textContent = 'Войти в панель';
    }
  });

  togglePassword.addEventListener('click', () => {
    const show = adminPassInput.type === 'password';
    adminPassInput.type = show ? 'text' : 'password';
    togglePassword.setAttribute('aria-pressed', show);
    togglePassword.setAttribute('aria-label', show ? 'Скрыть пароль' : 'Показать пароль');
  });

  logout.addEventListener('click', () => {
    if (saving) return;
    clearAuth();
    storage.remove('cfg_gh_token');
    storage.remove('cfg_gh_token', true);
    ghToken.value = '';
    shopForm.reset();
    saveResult.hidden = true;
    message(statusBox, '');
    login();
    adminPassInput.focus();
  });

  function preview() {
    previewName.textContent = value('shopName') || 'Название заведения';
    previewId.textContent = value('shopId') ? 'СТОЙКА № ' + value('shopId') : 'НОМЕР НЕ УКАЗАН';
    readyPoint.classList.toggle('done', Boolean(validId(value('shopId')) && value('shopName')));
    readyMaps.classList.toggle('done', Boolean(safeUrl(value('yandexUrl')) || safeUrl(value('gisUrl'))));
    readyChannels.classList.toggle('done', Boolean(value('targetTg') || value('targetVk') || value('targetEmail')));
  }

  fieldIds.forEach(id => $(id).addEventListener('input', () => {
    preview();
    saveResult.hidden = true;
    message(statusBox, '');
  }));

  function credentials() {
    const gist = value('gistId');
    const token = value('ghToken');
    if (!/^[0-9a-f]{20,40}$/i.test(gist) || !token) {
      accessDetails.open = true;
      throw new Error('Укажите корректный Gist ID и GitHub Personal Token.');
    }
    if (!activeToken) throw new Error('Сессия завершена. Войдите заново.');
    return {
      gist,
      token,
      url: ['https:', '', 'api.github.com', 'gists', gist].join('/'),
      headers: {
        Authorization: ['Bearer', token].join(' '),
        Accept: 'application/vnd.github+json'
      }
    };
  }

  async function getShops(credentialsData) {
    const data = await request(credentialsData.url, { headers: credentialsData.headers });
    const file = data.files?.['shops.json'];
    if (file?.truncated) throw new Error('shops.json слишком большой для редактирования здесь.');
    const shops = JSON.parse(file?.content || '{}');
    if (!shops || Array.isArray(shops) || typeof shops !== 'object') {
      throw new Error('shops.json должен содержать объект.');
    }
    return shops;
  }

  loadExisting.addEventListener('click', async () => {
    if (saving) return;
    loadExisting.disabled = true;
    message(statusBox, '');
    try {
      if (!validId(value('shopId'))) throw new Error('Сначала укажите номер стойки.');
      const credentialsData = credentials();
      const shops = await getShops(credentialsData);
      const shop = Object.hasOwn(shops, value('shopId')) ? shops[value('shopId')] : null;
      if (!shop || typeof shop !== 'object') throw new Error('Стойка ещё не зарегистрирована.');
      const hasEnteredData = fieldIds.some(id => !['shopId', 'venueType'].includes(id) && value(id));
      if (hasEnteredData && !confirm('Заменить введённые данные настройками этой стойки?')) return;
      const fields = {
        shopName: shop.name,
        venueType: venueTemplateKeys.has(shop.feedback_template) ? shop.feedback_template : 'universal',
        yandexUrl: shop.yandex_url || shop.maps_url,
        gisUrl: shop.gis_url,
        targetTg: shop.targets?.telegram || shop.targets?.tg || shop.telegram,
        targetVk: shop.targets?.vk || shop.vk,
        targetEmail: shop.targets?.email || shop.email
      };
      Object.entries(fields).forEach(([id, text]) => { $(id).value = text || ''; });
      preview();
      message(statusBox, 'Настройки загружены.', 'info');
    } catch (error) {
      message(statusBox, error.message);
    } finally {
      loadExisting.disabled = false;
    }
  });

  shopForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving) return;
    message(statusBox, '');
    saveResult.hidden = true;
    try {
      const credentialsData = credentials();
      const id = value('shopId');
      const name = value('shopName');
      const template = value('venueType');
      const yandex = value('yandexUrl');
      const gis = value('gisUrl');
      if (!validId(id) || !name) throw new Error('Введите название и корректный номер стойки.');
      if (!venueTemplateKeys.has(template)) throw new Error('Выберите тип заведения.');
      if (!yandex && !gis) throw new Error('Добавьте хотя бы одну ссылку на карты.');
      if ((yandex && !safeUrl(yandex)) || (gis && !safeUrl(gis))) {
        throw new Error('Ссылки должны начинаться с https:// или http://.');
      }
      if (!value('targetTg') && !value('targetVk') && !value('targetEmail')) {
        throw new Error('Укажите хотя бы один канал.');
      }
      saving = true;
      btnSave.disabled = loadExisting.disabled = logout.disabled = true;
      btnSave.textContent = 'Сохраняем…';
      const fields = {
        name,
        feedback_template: template,
        yandex_url: yandex || null,
        gis_url: gis || null,
        maps_url: yandex || gis || null
      };
      const targets = {
        telegram: value('targetTg') || null,
        vk: value('targetVk') || null,
        email: value('targetEmail') || null
      };
      const shops = await getShops(credentialsData);
      const exists = Object.hasOwn(shops, id);
      if (exists && !confirm('Стойка №' + id + ' существует. Обновить её?')) return;
      const old = exists && shops[id] && typeof shops[id] === 'object' ? shops[id] : {};
      Object.defineProperty(shops, id, {
        value: { ...old, ...fields, targets: { ...old.targets, ...targets } },
        enumerable: true,
        configurable: true,
        writable: true
      });
      await request(credentialsData.url, {
        method: 'PATCH',
        headers: { ...credentialsData.headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: { 'shops.json': { content: JSON.stringify(shops, null, 2) } } })
      });
      storage.set('cfg_gist_id', credentialsData.gist);
      storage.set('cfg_gh_token', credentialsData.token, true);
      storage.remove('cfg_gh_token');
      const link = shopUrl(id);
      savedLink.href = savedLink.textContent = link;
      resultTitle.textContent = 'Стойка №' + id + ' сохранена';
      openStudio.href = 'qr.html?id=' + encodeURIComponent(id);
      saveResult.hidden = false;
      saveResult.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (error) {
      message(statusBox, error.message);
    } finally {
      saving = false;
      btnSave.disabled = loadExisting.disabled = logout.disabled = false;
      btnSave.textContent = 'Сохранить стойку';
    }
  });

  copySaved.addEventListener('click', () => SK.copy(savedLink.href, copySaved));
  newShop.addEventListener('click', () => {
    fieldIds.forEach(id => { $(id).value = ''; });
    venueSelect.value = venueTemplateKeys.has('universal') ? 'universal' : Object.keys(venueTemplates)[0];
    saveResult.hidden = true;
    message(statusBox, '');
    preview();
    shopId.focus();
  });

  init();
})();
