(() => {
  'use strict';
  const { request, safeUrl, validId, message } = SK;
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const isDemo = !params.has('id');
  const landing = document.getElementById('landing-page');
  const widgetPage = document.getElementById('widget-page');
  landing.hidden = !isDemo; widgetPage.hidden = isDemo;
  if (!isDemo) document.querySelector('.skip-link').href = '#widget-page';
  const container = document.getElementById(isDemo ? 'demoContainer' : 'widgetContainer');
  container.append(document.getElementById('feedbackTemplate').content.cloneNode(true));
  const card = container.querySelector('.widget-card'); SK.hydrateIcons(card);
  const $ = selector => card.querySelector(selector);
  let config = null; let rating = 0; let redirectTimer; let sending = false;
  const labels = ['', '1 из 5 · Очень плохо', '2 из 5 · Не понравилось', '3 из 5 · Есть замечания', '4 из 5 · Хорошо', '5 из 5 · Отлично'];
  const views = ['feedbackFields', 'chooseMapBlock', 'redirectBlock', 'successBlock', 'noMapsBlock'];
  function show(view, focus = false) { views.forEach(name => { $('#' + name).hidden = name !== view; }); if (focus) $('#' + view).querySelector('h2')?.focus({ preventScroll: true }); }
  function reset() {
    if (sending) return;
    clearTimeout(redirectTimer); rating = 0; $('#negativeForm').hidden = true; $('#negativeForm').reset(); $('#ratingText').textContent = '';
    card.querySelectorAll('.star-btn').forEach(button => { button.classList.remove('active'); button.setAttribute('aria-pressed', 'false'); });
    card.querySelectorAll('.tag-choice').forEach(button => button.setAttribute('aria-pressed', 'false'));
    message($('#sendError'), ''); show('feedbackFields');
  }
  function configure(shop) {
    config = shop; $('#widgetLoading').hidden = true; $('#loadError').hidden = true;
    $('#shopName').textContent = isDemo ? 'Как прошёл ваш визит?' : (shop.name || 'Оцените обслуживание');
    $('#widgetEyebrow').textContent = isDemo ? 'Демо-заведение / Обратная связь' : 'Ваше мнение важно';
    if (!isDemo) { const title = document.createElement('h1'); title.id = 'shopName'; title.textContent = $('#shopName').textContent; $('#shopName').replaceWith(title); document.title = 'Отзыв: ' + (shop.name || 'Сервис Контроль'); }
    reset();
  }
  async function loadShop() {
    $('#widgetLoading').hidden = false; $('#loadError').hidden = true;
    try {
      if (!validId(id?.trim())) throw new Error('В ссылке указан некорректный номер стойки. Проверьте QR-код или обратитесь к сотруднику заведения.');
      const data = await request('https://api.github.com/gists/' + SK.gistId, { headers: { Accept: 'application/vnd.github+json' } });
      const file = data.files?.['shops.json'];
      if (!file || file.truncated) throw new Error('Не удалось прочитать настройки заведения. Обратитесь к сотруднику.');
      const shops = JSON.parse(file.content || '{}');
      if (!shops || Array.isArray(shops) || !Object.hasOwn(shops, id) || !shops[id] || typeof shops[id] !== 'object') throw new Error('Эта стойка ещё не подключена. Пожалуйста, сообщите сотруднику заведения.');
      configure(shops[id]);
    } catch (error) { $('#widgetLoading').hidden = true; $('#loadError').hidden = false; $('#loadErrorText').textContent = error.message; }
  }
  card.querySelectorAll('.star-btn').forEach(button => button.addEventListener('click', () => {
    if (!config || sending) return;
    clearTimeout(redirectTimer); rating = Number(button.dataset.rating); $('#ratingText').textContent = labels[rating];
    card.querySelectorAll('.star-btn').forEach(star => { star.classList.toggle('active', Number(star.dataset.rating) <= rating); star.setAttribute('aria-pressed', String(Number(star.dataset.rating) === rating)); });
    if (rating < 4) { $('#negativeForm').hidden = false; return; }
    const yandex = safeUrl(config.yandex_url || config.maps_url); const gis = safeUrl(config.gis_url);
    if (isDemo || (yandex && gis)) { $('#btnYandex').href = yandex; $('#btn2Gis').href = gis; $('#demoMapsNote').hidden = !isDemo; show('chooseMapBlock', true); }
    else if (yandex || gis) { const target = yandex || gis; $('#redirectLink').href = target; show('redirectBlock', true); redirectTimer = setTimeout(() => location.assign(target), 1600); }
    else show('noMapsBlock', true);
  }));
  card.querySelectorAll('[data-back]').forEach(button => button.addEventListener('click', () => { reset(); $('.star-btn').focus({ preventScroll: true }); }));
  card.querySelectorAll('.tag-choice').forEach(button => button.addEventListener('click', () => button.setAttribute('aria-pressed', String(button.getAttribute('aria-pressed') !== 'true'))));
  card.querySelectorAll('.maps-link').forEach(link => link.addEventListener('click', event => { if (isDemo) { event.preventDefault(); $('#demoMapsNote').textContent = 'В рабочей форме здесь откроется страница вашего заведения на картах.'; } }));
  $('#negativeForm').addEventListener('submit', async event => {
    event.preventDefault(); if (sending || rating < 1 || rating > 3 || !config) return;
    message($('#sendError'), ''); const button = $('#btnSend');
    if (isDemo) { $('#successText').textContent = 'Так выглядит подтверждение отправки. Это демо — ваши данные никуда не отправлены.'; $('#successReset').hidden = false; show('successBlock', true); return; }
    sending = true; button.disabled = true; button.textContent = 'Отправляем…'; card.querySelectorAll('.star-btn,.tag-choice').forEach(el => { el.disabled = true; });
    try {
      const data = await request('/api/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shopId: id, rating, tags: [...card.querySelectorAll('.tag-choice[aria-pressed=true]')].map(el => el.textContent), comment: $('#comment').value.trim(), phone: $('#phone').value.trim() }) });
      // The existing API can return HTTP 200 even when every delivery fails.
      if (!data.success || !Array.isArray(data.results) || !data.results.some(result => result.success === true)) throw new Error('Не удалось доставить обращение. Текст сохранён в форме — попробуйте ещё раз или обратитесь к сотруднику.');
      $('#successText').textContent = 'Обращение доставлено в настроенный канал руководства. Спасибо, что помогаете улучшить сервис.'; show('successBlock', true);
    } catch (error) { message($('#sendError'), error.message); }
    finally { sending = false; button.disabled = false; button.textContent = 'Отправить руководству'; card.querySelectorAll('.star-btn,.tag-choice').forEach(el => { el.disabled = false; }); }
  });
  $('#retryLoad').addEventListener('click', loadShop); $('#successReset').addEventListener('click', reset); document.getElementById('resetDemo').addEventListener('click', reset);
  const dialog = document.getElementById('contactModal');
  document.querySelectorAll('[data-contact]').forEach(button => button.addEventListener('click', () => dialog.showModal()));
  document.getElementById('closeContact').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { const bounds = dialog.getBoundingClientRect(); if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close(); });
  if (isDemo) configure({ name: 'Демо-заведение', yandex_url: 'https://ya.ru', gis_url: 'https://2gis.ru' }); else loadShop();
})();
