(function () {
  'use strict';

  const TOKEN_KEY = 'spx_token';
  let token = localStorage.getItem(TOKEN_KEY) || '';
  let DATA = null;
  let LEADS = [];
  let ORDERS = [];
  let currentTab = 'header';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function toast(msg, type = 'success') {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast show ' + type;
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.className = 'toast ' + type; }, 2800);
  }

  async function api(method, url, body, isForm) {
    const opts = { method, headers: { Authorization: 'Bearer ' + token } };
    if (body) {
      if (isForm) opts.body = body;
      else { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    }
    const res = await fetch(url, opts);
    if (res.status === 401) { logout(); throw new Error('Сессия истекла, войдите снова'); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Ошибка запроса');
    return data;
  }

  async function loadData() {
    DATA = await (await fetch('/api/data')).json();
  }

  async function loadLeads() {
    try { LEADS = await api('GET', '/api/leads'); }
    catch (e) { LEADS = []; }
    updateLeadsBadge();
  }

  function updateLeadsBadge() {
    const badge = $('#leads-badge');
    if (!badge) return;
    badge.textContent = LEADS.length;
    badge.hidden = LEADS.length === 0;
  }

  async function loadOrders() {
    try { ORDERS = await api('GET', '/api/orders'); }
    catch (e) { ORDERS = []; }
    updateOrdersBadge();
  }

  function updateOrdersBadge() {
    const badge = $('#orders-badge');
    if (!badge) return;
    badge.textContent = ORDERS.length;
    badge.hidden = ORDERS.length === 0;
  }

  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const login = $('#login').value.trim();
    const password = $('#password').value;
    const errEl = $('#login-error');
    const btn = $('#login-submit');
    errEl.textContent = '';
    btn.disabled = true;
    try {
      const res = await fetch('/api/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Ошибка входа');
      token = data.token;
      localStorage.setItem(TOKEN_KEY, token);
      $('#password').value = '';
      enterApp();
    } catch (err) {
      errEl.textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });

  function logout() {
    if (token) fetch('/api/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + token } }).catch(() => {});
    token = '';
    localStorage.removeItem(TOKEN_KEY);
    document.body.classList.remove('is-authed');
  }
  $('#logout-btn').addEventListener('click', logout);

  const menuBtn = $('#admin-menu-btn');
  if (menuBtn) menuBtn.addEventListener('click', () => $('#admin-sidebar').classList.toggle('open'));

  async function enterApp() {
    document.body.classList.add('is-authed');
    await loadData();
    await loadLeads();
    await loadOrders();
    renderTab(currentTab);
  }

  $$('.admin__tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      $$('.admin__tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      currentTab = tab.dataset.tab;
      renderTab(currentTab);
      const sb = $('#admin-sidebar');
      if (sb) sb.classList.remove('open');
    });
  });

  function renderTab(tab) {
    if (tab === 'header') renderHeaderTab();
    else if (tab === 'about') renderAboutTab();
    else if (tab === 'catalog') renderCatalogTab();
    else if (tab === 'instructions') renderInstructionsTab();
    else if (tab === 'blocks') renderBlocksTab();
    else if (tab === 'socials') renderSocialsTab();
    else if (tab === 'leads') renderLeadsTab();
    else if (tab === 'orders') renderOrdersTab();
    else if (tab === 'analytics') renderAnalyticsTab();
    else if (tab === 'security') renderSecurityTab();
    else if (tab === 'backups') renderBackupsTab();
    else if (tab === 'contacts') renderContactsTab();
    else if (tab === 'settings') renderSettingsTab();
  }

  async function reloadAndRender() {
    await loadData();
    renderTab(currentTab);
  }

  const SLIDER_PRESETS = [
    { v: '1600/250', l: 'Узкий — 1600 × 250' },
    { v: '1600/400', l: 'Средний — 1600 × 400' },
    { v: '1600/550', l: 'Крупный — 1600 × 550' },
    { v: '1600/700', l: 'Очень крупный — 1600 × 700' },
    { v: '1920/1080', l: 'Широкоформатный — 1920 × 1080' }
  ];
  function sliderOptions(current) {
    const cur = current || '1600/250';
    let opts = SLIDER_PRESETS.slice();
    if (!opts.some((o) => o.v === cur)) opts.unshift({ v: cur, l: 'Текущий — ' + cur.replace('/', ' × ') });
    return opts.map((o) => `<option value="${o.v}" ${o.v === cur ? 'selected' : ''}>${o.l}</option>`).join('');
  }

  function renderHeaderTab() {
    const h = DATA.header || {};
    const s = DATA.site || {};
    const b = DATA.banners || { desktop: [], mobile: [] };
    $('#panel').innerHTML = `
      <div class="panel-head"><div><h2>Шапка и баннеры</h2><p>Название, подзаголовок и слайдер баннеров на первом экране.</p></div></div>

      <div class="card-block">
        <h3>Тексты первого экрана</h3>
        <p class="hint-text">Оставьте поле пустым, чтобы убрать надпись с сайта. Если загружен логотип, крупный текст-название скрывается.</p>
        <label class="field-label">Бейдж (маленькая надпись над названием)</label>
        <input class="input" id="h-badge" value="${esc(h.badge)}" placeholder="Профессиональное оборудование" />
        <label class="field-label">Название (крупный заголовок)</label>
        <input class="input" id="h-title" value="${esc(h.title)}" placeholder="SPACEXTEN" />
        <label class="field-label">Подзаголовок</label>
        <textarea class="textarea" id="h-subtitle">${esc(h.subtitle)}</textarea>
        <button class="btn btn--primary" id="save-header">Сохранить тексты</button>
      </div>

      <div class="card-block">
        <h3>Логотип в шапке (вместо текста SPACEXTEN)</h3>
        <div class="size-hint">⌕ Рекомендуемый размер: <strong>600 × 200 px</strong> (или больше, PNG с прозрачным фоном / SVG). Логотип заменит крупную надпись.</div>
        <div class="header-preview header-preview--logo" id="logo-preview">${h.logo ? `<img src="${esc(h.logo)}" alt="логотип" style="max-height:90px;max-width:100%;object-fit:contain" />` : 'Логотип не загружен'}</div>
        <div class="btn-row">
          <label class="btn btn--primary btn--sm" style="cursor:pointer"><input type="file" id="header-logo" accept="image/*" hidden />Загрузить логотип</label>
          ${h.logo ? '<button class="btn btn--danger btn--sm" id="header-logo-del">Убрать логотип</button>' : ''}
        </div>
      </div>

      <div class="card-block">
        <h3>Фоновый баннер шапки</h3>
        <div class="size-hint">⌕ Рекомендуемый размер: <strong>1920 × 1080 px</strong> (горизонтальный фон за названием), JPG/PNG/WEBP</div>
        <div class="header-preview" id="hp" style="${h.image ? `background-image:linear-gradient(135deg,rgba(6,9,17,.25),rgba(6,9,17,.5)),url('${h.image}')` : ''}">${h.image ? '' : 'Фон не загружен'}</div>
        <div class="btn-row">
          <label class="btn btn--primary btn--sm" style="cursor:pointer">
            <input type="file" id="header-image" accept="image/*" hidden />Загрузить фон
          </label>
          ${h.image ? '<button class="btn btn--danger btn--sm" id="header-image-del">Убрать фон</button>' : ''}
        </div>
      </div>

      <div class="card-block">
        <h3>Размер слайдера</h3>
        <p class="hint-text">Выберите пропорции карусели баннеров (ширина × высота).</p>
        <select class="select" id="slider-ratio">
          ${sliderOptions(s.sliderRatio)}
        </select>
        <button class="btn btn--primary btn--sm" id="save-ratio">Сохранить размер</button>
      </div>

      <div class="card-block">
        <h3>Баннеры слайдера — десктоп</h3>
        <div class="size-hint">⌕ Рекомендуемый размер под текущий слайдер: <strong id="hint-desktop">1600 × 250 px</strong>, JPG/PNG/WEBP, до 50 МБ</div>
        <div class="banner-grid" id="banners-desktop"></div>
        <label class="uploader"><input type="file" id="banner-desktop-input" accept="image/*" />Нажмите, чтобы <strong>добавить десктоп-баннер</strong></label>
      </div>

      <div class="card-block">
        <h3>Баннеры слайдера — мобильные</h3>
        <div class="size-hint">⌕ Рекомендуемый размер: <strong>1080 × 400 px</strong> (или квадрат 1080 × 1080), JPG/PNG/WEBP</div>
        <div class="banner-grid" id="banners-mobile"></div>
        <label class="uploader"><input type="file" id="banner-mobile-input" accept="image/*" />Нажмите, чтобы <strong>добавить мобильный баннер</strong></label>
        <p class="hint-text">Если мобильные баннеры не загружены, на телефонах показываются десктоп-баннеры.</p>
      </div>`;

    renderBannerGrid('desktop', b.desktop || []);
    renderBannerGrid('mobile', b.mobile || []);

    $('#banner-desktop-input').addEventListener('change', (e) => uploadBanner('desktop', e));
    $('#banner-mobile-input').addEventListener('change', (e) => uploadBanner('mobile', e));

    $('#header-image').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      const fd = new FormData();
      fd.append('image', file);
      try {
        const res = await api('POST', '/api/header/image', fd, true);
        DATA.header = res;
        toast('Фон шапки обновлён');
        renderHeaderTab();
      } catch (err) { toast(err.message, 'error'); }
    });
    const hdel = $('#header-image-del');
    if (hdel) hdel.addEventListener('click', async () => {
      if (!confirm('Убрать фоновый баннер шапки?')) return;
      try {
        const res = await api('DELETE', '/api/header/image');
        DATA.header = res;
        toast('Фон убран');
        renderHeaderTab();
      } catch (err) { toast(err.message, 'error'); }
    });

    $('#header-logo').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      const fd = new FormData();
      fd.append('image', file);
      try {
        const res = await api('POST', '/api/header/logo', fd, true);
        DATA.header = res;
        toast('Логотип загружен');
        renderHeaderTab();
      } catch (err) { toast(err.message, 'error'); }
    });
    const ldel = $('#header-logo-del');
    if (ldel) ldel.addEventListener('click', async () => {
      if (!confirm('Убрать логотип? В шапке снова будет текст-название.')) return;
      try {
        const res = await api('DELETE', '/api/header/logo');
        DATA.header = res;
        toast('Логотип убран');
        renderHeaderTab();
      } catch (err) { toast(err.message, 'error'); }
    });

    $('#save-ratio').addEventListener('click', async () => {
      try {
        const res = await api('PUT', '/api/site', { sliderRatio: $('#slider-ratio').value });
        DATA.site = res;
        toast('Размер слайдера сохранён');
      } catch (err) { toast(err.message, 'error'); }
    });
    const hintMap = { '1600/250': '1600 × 250 px', '1600/400': '1600 × 400 px', '1600/550': '1600 × 550 px', '1600/700': '1600 × 700 px', '1920/1080': '1920 × 1080 px' };
    $('#slider-ratio').addEventListener('change', () => {
      const el = $('#hint-desktop'); if (el) el.textContent = hintMap[$('#slider-ratio').value] || $('#slider-ratio').value.replace('/', ' × ') + ' px';
    });

    $('#save-header').addEventListener('click', async () => {
      try {
        await api('PUT', '/api/header', {
          badge: $('#h-badge').value, title: $('#h-title').value, subtitle: $('#h-subtitle').value
        });
        toast('Тексты шапки сохранены');
        await loadData();
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  function renderBannerGrid(variant, list) {
    const grid = $('#banners-' + variant);
    if (!grid) return;
    grid.innerHTML = list.length
      ? list.map((src) => `
        <div class="banner-thumb" style="background-image:url('${esc(src)}')">
          <button class="banner-thumb__remove" data-variant="${variant}" data-url="${esc(src)}" title="Удалить">×</button>
        </div>`).join('')
      : '<p class="hint-text" style="grid-column:1/-1">Баннеров пока нет.</p>';
    $$('.banner-thumb__remove', grid).forEach((btn) => btn.addEventListener('click', async () => {
      if (!confirm('Удалить баннер?')) return;
      try {
        const res = await api('DELETE', '/api/banners/' + btn.dataset.variant, { url: btn.dataset.url });
        DATA.banners = res;
        renderBannerGrid(variant, res[variant] || []);
        toast('Баннер удалён');
      } catch (err) { toast(err.message, 'error'); }
    }));
  }

  async function uploadBanner(variant, e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const fd = new FormData();
    fd.append('image', file);
    try {
      const res = await api('POST', '/api/banners/' + variant, fd, true);
      DATA.banners = res;
      renderBannerGrid(variant, res[variant] || []);
      toast('Баннер добавлен');
    } catch (err) { toast(err.message, 'error'); }
  }

  function renderAboutTab() {
    const a = DATA.about || {};
    const features = a.features || [];
    $('#panel').innerHTML = `
      <div class="panel-head"><div><h2>О компании</h2><p>Описание и блоки преимуществ.</p></div></div>
      <div class="card-block">
        <h3>Основной текст</h3>
        <label class="field-label">Заголовок блока</label>
        <input class="input" id="a-title" value="${esc(a.title)}" />
        <label class="field-label">Текст</label>
        <textarea class="textarea" id="a-text" style="min-height:140px">${esc(a.text)}</textarea>
      </div>
      <div class="card-block">
        <h3>Преимущества</h3>
        <p class="hint-text">До 6 блоков. Отображаются карточками под текстом.</p>
        <div id="features-list"></div>
        <button class="btn btn--outline btn--sm" id="add-feature">+ Добавить преимущество</button>
      </div>
      <button class="btn btn--primary" id="save-about">Сохранить изменения</button>`;

    function renderFeatures(list) {
      $('#features-list').innerHTML = list.map((f, i) => `
        <div class="card-block" style="padding:16px;margin-bottom:12px;background:rgba(6,9,17,.4)">
          <div class="field-row">
            <div><label class="field-label">Заголовок</label><input class="input feat-title" data-i="${i}" value="${esc(f.title)}" style="margin-bottom:0"/></div>
            <div><label class="field-label">Текст</label><input class="input feat-text" data-i="${i}" value="${esc(f.text)}" style="margin-bottom:0"/></div>
          </div>
          <button class="btn btn--danger btn--sm remove-feat" data-i="${i}" style="margin-top:12px">Удалить</button>
        </div>`).join('') || '<p class="empty-list">Преимуществ пока нет.</p>';
      $$('.remove-feat').forEach((b) => b.addEventListener('click', () => {
        working.splice(Number(b.dataset.i), 1); renderFeatures(working);
      }));
    }
    let working = features.map((f) => ({ ...f }));
    renderFeatures(working);

    $('#add-feature').addEventListener('click', () => {
      if (working.length >= 6) return toast('Максимум 6 преимуществ', 'error');
      $$('.feat-title').forEach((t, i) => { if (working[i]) working[i].title = t.value; });
      $$('.feat-text').forEach((t, i) => { if (working[i]) working[i].text = t.value; });
      working.push({ title: 'Новое преимущество', text: 'Описание' });
      renderFeatures(working);
    });

    $('#save-about').addEventListener('click', async () => {
      const titles = $$('.feat-title'); const texts = $$('.feat-text');
      const out = titles.map((t, i) => ({ title: t.value, text: texts[i].value }));
      try {
        await api('PUT', '/api/about', { title: $('#a-title').value, text: $('#a-text').value, features: out });
        toast('Блок «О компании» сохранён');
        await loadData();
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  function catName(id) {
    const c = (DATA.productCategories || []).find((x) => x.id === id);
    return c ? c.name : '';
  }

  function renderCatalogTab() {
    const products = DATA.products || [];
    const cats = DATA.productCategories || [];
    $('#panel').innerHTML = `
      <div class="panel-head">
        <div><h2>Каталог</h2><p>Сначала создайте категории, затем добавляйте в них товары.</p></div>
        <button class="btn btn--primary" id="add-product">+ Добавить товар</button>
      </div>

      <div class="card-block">
        <h3>Категории товаров</h3>
        <p class="hint-text">На сайте посетитель выбирает категорию и видит товары именно из неё.</p>
        <div class="cat-manage" id="cat-manage"></div>
        <div class="field-row" style="grid-template-columns:1fr auto;align-items:end;margin-top:6px">
          <div><label class="field-label">Новая категория</label><input class="input" id="new-prod-cat" placeholder="Например: Мойки высокого давления" style="margin-bottom:0"/></div>
          <button class="btn btn--primary" id="add-prod-cat">Добавить</button>
        </div>
      </div>

      <div class="card-block">
        <h3>Товары</h3>
        ${products.length ? '<div class="admin-products" id="prod-list"></div>' : '<p class="empty-list">Товаров пока нет. Нажмите «Добавить товар».</p>'}
      </div>`;

    const cm = $('#cat-manage');
    cm.innerHTML = cats.length ? '' : '<p class="hint-text">Категорий пока нет — добавьте первую ниже.</p>';
    cats.forEach((cat) => {
      const count = products.filter((p) => p.categoryId === cat.id).length;
      const subs = cat.subcategories || [];
      const row = document.createElement('div');
      row.className = 'cat-block';
      row.innerHTML = `
        <div class="cat-row">
          <input class="input cat-name" value="${esc(cat.name)}" data-id="${cat.id}" />
          <span class="cat-row__count">${count} тов.</span>
          <button class="btn btn--outline btn--sm save-cat" data-id="${cat.id}">Сохранить</button>
          <button class="btn btn--danger btn--sm del-cat" data-id="${cat.id}">Удалить</button>
        </div>
        <div class="subcat-wrap">
          <div class="subcat-label">Подкатегории:</div>
          <div class="subcat-list">
            ${subs.length ? subs.map((s) => `
              <span class="subcat-tag">
                <input class="subcat-name" value="${esc(s.name)}" data-cat="${cat.id}" data-sub="${s.id}" />
                <button class="subcat-save" data-cat="${cat.id}" data-sub="${s.id}" title="Сохранить">✓</button>
                <button class="subcat-del" data-cat="${cat.id}" data-sub="${s.id}" title="Удалить">×</button>
              </span>`).join('') : '<span class="hint-text" style="margin:0">пока нет</span>'}
          </div>
          <div class="subcat-add">
            <input class="input new-subcat" data-cat="${cat.id}" placeholder="Новая подкатегория (напр. по марке)" />
            <button class="btn btn--outline btn--sm add-subcat" data-cat="${cat.id}">+ Подкатегория</button>
          </div>
        </div>`;
      cm.appendChild(row);
    });
    $$('#cat-manage .save-cat').forEach((b) => b.addEventListener('click', async () => {
      const input = $(`#cat-manage .cat-name[data-id="${b.dataset.id}"]`);
      const name = input.value.trim();
      if (!name) return toast('Введите название', 'error');
      try { await api('PUT', '/api/product-categories/' + b.dataset.id, { name }); toast('Категория сохранена'); await reloadAndRender(); }
      catch (err) { toast(err.message, 'error'); }
    }));
    $$('#cat-manage .del-cat').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Удалить категорию со всеми подкатегориями? Товары станут «без категории».')) return;
      try { await api('DELETE', '/api/product-categories/' + b.dataset.id); toast('Категория удалена'); await reloadAndRender(); }
      catch (err) { toast(err.message, 'error'); }
    }));
    $$('#cat-manage .add-subcat').forEach((b) => b.addEventListener('click', async () => {
      const inp = $(`#cat-manage .new-subcat[data-cat="${b.dataset.cat}"]`);
      const name = inp.value.trim();
      if (!name) return toast('Введите название подкатегории', 'error');
      try { await api('POST', `/api/product-categories/${b.dataset.cat}/subcategories`, { name }); toast('Подкатегория добавлена'); await reloadAndRender(); }
      catch (err) { toast(err.message, 'error'); }
    }));
    $$('#cat-manage .subcat-save').forEach((b) => b.addEventListener('click', async () => {
      const inp = $(`#cat-manage .subcat-name[data-cat="${b.dataset.cat}"][data-sub="${b.dataset.sub}"]`);
      const name = inp.value.trim();
      if (!name) return toast('Введите название', 'error');
      try { await api('PUT', `/api/product-categories/${b.dataset.cat}/subcategories/${b.dataset.sub}`, { name }); toast('Подкатегория сохранена'); await reloadAndRender(); }
      catch (err) { toast(err.message, 'error'); }
    }));
    $$('#cat-manage .subcat-del').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Удалить подкатегорию?')) return;
      try { await api('DELETE', `/api/product-categories/${b.dataset.cat}/subcategories/${b.dataset.sub}`); toast('Подкатегория удалена'); await reloadAndRender(); }
      catch (err) { toast(err.message, 'error'); }
    }));
    $('#add-prod-cat').addEventListener('click', async () => {
      const name = $('#new-prod-cat').value.trim();
      if (!name) return toast('Введите название категории', 'error');
      try { await api('POST', '/api/product-categories', { name }); toast('Категория добавлена'); await reloadAndRender(); }
      catch (err) { toast(err.message, 'error'); }
    });

    if (products.length) {
      $('#prod-list').innerHTML = products.map((p) => {
        const relCount = (p.relatedIds || []).length;
        const hasInstr = p.instruction && (p.instruction.videoUrl || p.instruction.pdf || p.instruction.text);
        const plaque = p.badge === 'best' ? '<span class="mini-plaque mini-plaque--best">Лучший выбор</span>'
          : p.badge === 'sale' ? '<span class="mini-plaque mini-plaque--sale">Распродажа</span>' : '';
        const cn = catName(p.categoryId);
        return `
        <div class="admin-product">
          <div class="admin-product__img" style="${p.images && p.images[0] ? `background-image:url('${p.images[0]}')` : ''}"></div>
          <div>
            <div class="admin-product__name">${esc(p.name)} ${plaque}</div>
            ${p.price ? `<div class="admin-product__price">${esc(p.price)} ${esc(p.currency || '₽')}</div>` : ''}
            <div class="admin-product__meta">${cn ? '🗂 ' + esc(cn) + ' · ' : '<span style="color:var(--danger)">без категории</span> · '}${(p.images || []).length} фото · ${relCount} запч. · ${hasInstr ? 'инструкция есть' : 'без инструкции'}</div>
          </div>
          <div class="admin-product__actions">
            <button class="btn btn--outline btn--sm edit-prod" data-id="${p.id}">Изменить</button>
            <button class="btn btn--danger btn--sm del-prod" data-id="${p.id}">Удалить</button>
          </div>
        </div>`;
      }).join('');

      $$('.edit-prod').forEach((b) => b.addEventListener('click', () => openProductForm(b.dataset.id)));
      $$('.del-prod').forEach((b) => b.addEventListener('click', async () => {
        if (!confirm('Удалить товар? Действие необратимо.')) return;
        try { await api('DELETE', '/api/products/' + b.dataset.id); toast('Товар удалён'); await reloadAndRender(); }
        catch (err) { toast(err.message, 'error'); }
      }));
    }

    $('#add-product').addEventListener('click', () => {
      if (!(DATA.productCategories || []).length) {
        if (!confirm('Категорий ещё нет. Товар можно создать, но без категории он попадёт в раздел «Прочее». Продолжить?')) return;
      }
      openProductForm(null);
    });
  }

  let formState = null;

  function instructionOptions(selectedId) {
    const cats = DATA.instructionCategories || [];
    let opts = '<option value="">— без привязки —</option>';
    cats.forEach((c) => {
      const items = c.items || [];
      if (!items.length) return;
      opts += `<optgroup label="${esc(c.name)}">` + items.map((it) => `<option value="${it.id}" ${it.id === selectedId ? 'selected' : ''}>${esc(it.title)}</option>`).join('') + '</optgroup>';
    });
    return opts;
  }

  function openProductForm(id) {
    const products = DATA.products || [];
    const cats = DATA.productCategories || [];
    const product = id ? products.find((p) => p.id === id) : null;
    formState = {
      id,
      keptImages: product ? [...(product.images || [])] : [],
      newImages: [],
      pdfFile: null,
      currentPdf: product && product.instruction ? product.instruction.pdf : '',
      removePdf: false,
      related: new Set(product ? (product.relatedIds || []) : [])
    };

    const others = products.filter((p) => p.id !== id);
    const badge = product ? product.badge : '';
    const orderUrl = product ? (product.orderUrl || '') : '';
    const instrText = product && product.instruction ? (product.instruction.text || '') : '';

    const modal = document.createElement('div');
    modal.className = 'form-modal open';
    modal.id = 'product-form-modal';
    modal.innerHTML = `
      <div class="form-modal__backdrop" data-fclose></div>
      <div class="form-modal__dialog">
        <h2>${id ? 'Редактирование товара' : 'Новый товар'}</h2>

        <label class="field-label">Название</label>
        <input class="input" id="f-name" value="${product ? esc(product.name) : ''}" placeholder="Например: Мойка высокого давления X200" />

        <div class="field-row">
          <div>
            <label class="field-label">Категория</label>
            <select class="select" id="f-category">
              <option value="">— без категории —</option>
              ${cats.map((c) => `<option value="${c.id}" ${product && product.categoryId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="field-label">Подкатегория</label>
            <select class="select" id="f-subcategory"></select>
          </div>
        </div>

        <div class="field-row">
          <div>
            <label class="field-label">Плашка</label>
            <select class="select" id="f-badge">
              <option value="" ${badge === '' ? 'selected' : ''}>Без плашки</option>
              <option value="best" ${badge === 'best' ? 'selected' : ''}>★ Лучший выбор</option>
              <option value="sale" ${badge === 'sale' ? 'selected' : ''}>% Распродажа</option>
            </select>
          </div>
          <div><label class="field-label">Валюта</label><input class="input" id="f-currency" value="${product ? esc(product.currency || '₽') : '₽'}" /></div>
        </div>

        <div class="field-row">
          <div><label class="field-label">Цена</label><input class="input" id="f-price" value="${product ? esc(product.price) : ''}" placeholder="15000" /></div>
          <div></div>
        </div>

        <label class="field-label">Описание</label>
        <textarea class="textarea" id="f-desc" placeholder="Характеристики, комплектация...">${product ? esc(product.description) : ''}</textarea>

        <label class="field-label">Фотографии (до 5)</label>
        <div class="size-hint">⌕ Рекомендуемый размер фото: <strong>1000 × 1000 px</strong> (квадрат), одинаковый формат для всех фото, JPG/PNG/WEBP</div>
        <div class="thumbs" id="f-thumbs"></div>
        <label class="uploader"><input type="file" id="f-images" accept="image/*" multiple />Нажмите, чтобы <strong>добавить фото</strong></label>

        <label class="field-label">Ссылка «Заказать товар» (мессенджер)</label>
        <input class="input" id="f-order" value="${esc(orderUrl)}" placeholder="https://t.me/ваш_аккаунт или https://wa.me/79990000000" />
        <p class="hint-text">Если оставить пустым — используется общая ссылка из «Настроек». Кнопка откроет её в новой вкладке.</p>

        <div class="card-block" style="padding:18px;background:rgba(6,9,17,.4)">
          <h3 style="font-size:1.02rem">Инструкция к товару</h3>
          <label class="field-label">Привязать готовую инструкцию (из раздела «Инструкции»)</label>
          <select class="select" id="f-linked-instruction">${instructionOptions(product ? product.linkedInstructionId : '')}</select>
          <p class="hint-text">Необязательно. Выбранная инструкция покажется в карточке товара. Ниже можно задать и собственную инструкцию.</p>
          <label class="field-label">Видео-инструкция — ссылка</label>
          <input class="input" id="f-video" value="${product && product.instruction ? esc(product.instruction.videoUrl) : ''}" placeholder="YouTube / Vimeo / прямая ссылка на mp4" />
          <label class="field-label">Текстовая инструкция</label>
          <textarea class="textarea" id="f-instr-text" placeholder="Пошаговая инструкция текстом (необязательно)">${esc(instrText)}</textarea>
          <label class="field-label">PDF-инструкция (для скачивания)</label>
          <div id="f-pdf-state"></div>
          <label class="uploader"><input type="file" id="f-pdf" accept="application/pdf" />Загрузить <strong>PDF-инструкцию</strong></label>
        </div>

        <label class="field-label">Дополнительные товары / запчасти</label>
        <p class="hint-text">Отметьте товары, которые предложить покупателю вместе с этим.</p>
        <div class="rel-grid" id="f-related">
          ${others.length ? others.map((o) => `
            <label class="rel-option ${formState.related.has(o.id) ? 'checked' : ''}">
              <input type="checkbox" value="${o.id}" ${formState.related.has(o.id) ? 'checked' : ''}/>
              <span>${esc(o.name)}</span>
            </label>`).join('') : '<p class="hint-text" style="grid-column:1/-1">Сначала добавьте другие товары, чтобы привязать их.</p>'}
        </div>

        <div class="btn-row" style="margin-top:18px">
          <button class="btn btn--primary" id="f-save">${id ? 'Сохранить' : 'Создать товар'}</button>
          <button class="btn btn--outline" data-fclose>Отмена</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    modal.addEventListener('click', (e) => {
      if (e.target.matches('[data-fclose]')) closeProductForm();
    });

    renderThumbs();
    renderPdfState();

    $('#f-images').addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      const total = formState.keptImages.length + formState.newImages.length;
      const allowed = 5 - total;
      if (allowed <= 0) { toast('Максимум 5 фото', 'error'); e.target.value = ''; return; }
      formState.newImages.push(...files.slice(0, allowed));
      e.target.value = '';
      renderThumbs();
    });

    $('#f-pdf').addEventListener('change', (e) => {
      formState.pdfFile = e.target.files[0] || null;
      formState.removePdf = false;
      renderPdfState();
    });

    $$('#f-related input').forEach((cb) => cb.addEventListener('change', () => {
      cb.closest('.rel-option').classList.toggle('checked', cb.checked);
      if (cb.checked) formState.related.add(cb.value); else formState.related.delete(cb.value);
    }));

    $('#f-save').addEventListener('click', saveProduct);

    const fillSubcategories = (selectedSub) => {
      const catId = $('#f-category').value;
      const cat = (DATA.productCategories || []).find((c) => c.id === catId);
      const subs = (cat && cat.subcategories) || [];
      const sel = $('#f-subcategory');
      if (!subs.length) {
        sel.innerHTML = '<option value="">— нет подкатегорий —</option>';
        sel.disabled = true;
      } else {
        sel.disabled = false;
        sel.innerHTML = '<option value="">— без подкатегории —</option>' +
          subs.map((s) => `<option value="${s.id}" ${s.id === selectedSub ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
      }
    };
    fillSubcategories(product ? product.subcategoryId : '');
    $('#f-category').addEventListener('change', () => fillSubcategories(''));
  }

  function renderThumbs() {
    const wrap = $('#f-thumbs');
    if (!wrap) return;
    let html = '';
    formState.keptImages.forEach((src, i) => {
      html += `<div class="thumb" style="background-image:url('${src}')"><button class="thumb__remove" data-type="kept" data-i="${i}">×</button></div>`;
    });
    formState.newImages.forEach((file, i) => {
      const url = URL.createObjectURL(file);
      html += `<div class="thumb" style="background-image:url('${url}')"><button class="thumb__remove" data-type="new" data-i="${i}">×</button></div>`;
    });
    wrap.innerHTML = html || '<p class="hint-text">Фото пока не добавлены.</p>';
    $$('#f-thumbs .thumb__remove').forEach((b) => b.addEventListener('click', () => {
      const i = Number(b.dataset.i);
      if (b.dataset.type === 'kept') formState.keptImages.splice(i, 1);
      else formState.newImages.splice(i, 1);
      renderThumbs();
    }));
  }

  function renderPdfState() {
    const el = $('#f-pdf-state');
    if (!el) return;
    if (formState.pdfFile) {
      el.innerHTML = `<div class="instr-item"><span class="instr-item__title">Новый файл: ${esc(formState.pdfFile.name)}</span>
        <button class="btn btn--danger btn--sm" id="pdf-clear" style="margin-left:auto">Убрать</button></div>`;
      $('#pdf-clear').addEventListener('click', () => { formState.pdfFile = null; $('#f-pdf').value = ''; renderPdfState(); });
    } else if (formState.currentPdf && !formState.removePdf) {
      el.innerHTML = `<div class="instr-item"><span class="instr-item__title">Текущий PDF загружен</span>
        <a class="btn btn--outline btn--sm" href="${esc(formState.currentPdf)}" target="_blank" style="margin-left:auto">Открыть</a>
        <button class="btn btn--danger btn--sm" id="pdf-remove">Удалить</button></div>`;
      $('#pdf-remove').addEventListener('click', () => { formState.removePdf = true; renderPdfState(); });
    } else {
      el.innerHTML = `<p class="hint-text">PDF не прикреплён.</p>`;
    }
  }

  async function saveProduct() {
    const name = $('#f-name').value.trim();
    if (!name) return toast('Введите название товара', 'error');

    const fd = new FormData();
    fd.append('name', name);
    fd.append('price', $('#f-price').value.trim());
    fd.append('currency', $('#f-currency').value.trim() || '₽');
    fd.append('categoryId', $('#f-category').value);
    fd.append('subcategoryId', $('#f-subcategory') && !$('#f-subcategory').disabled ? $('#f-subcategory').value : '');
    fd.append('badge', $('#f-badge').value);
    fd.append('description', $('#f-desc').value);
    fd.append('orderUrl', $('#f-order').value.trim());
    fd.append('videoUrl', $('#f-video').value.trim());
    fd.append('instructionText', $('#f-instr-text').value);
    fd.append('relatedIds', JSON.stringify(Array.from(formState.related)));
    fd.append('linkedInstructionId', $('#f-linked-instruction') ? $('#f-linked-instruction').value : '');
    formState.newImages.forEach((f) => fd.append('images', f));
    if (formState.pdfFile) fd.append('pdf', formState.pdfFile);

    const saveBtn = $('#f-save');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Сохраняем…'; }
    try {
      if (formState.id) {
        fd.append('existingImages', JSON.stringify(formState.keptImages));
        if (formState.removePdf) fd.append('removePdf', 'true');
        await api('PUT', '/api/products/' + formState.id, fd, true);
        toast('Товар обновлён');
      } else {
        await api('POST', '/api/products', fd, true);
        toast('Товар создан');
      }
      closeProductForm();
      await reloadAndRender();
    } catch (err) {
      toast(err.message, 'error');
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = formState.id ? 'Сохранить' : 'Создать товар'; }
    }
  }

  function closeProductForm() {
    const m = $('#product-form-modal');
    if (m) m.remove();
    document.body.style.overflow = '';
    formState = null;
  }

  function renderInstructionsTab() {
    const cats = DATA.instructionCategories || [];
    $('#panel').innerHTML = `
      <div class="panel-head">
        <div><h2>Инструкции</h2><p>Категории и инструкции внутри них (видео, текст и/или PDF).</p></div>
      </div>
      <div class="card-block">
        <h3>Новая категория</h3>
        <div class="field-row" style="grid-template-columns:1fr auto;align-items:end">
          <div><label class="field-label">Название категории</label><input class="input" id="new-cat" placeholder="Например: Мойки высокого давления" style="margin-bottom:0"/></div>
          <button class="btn btn--primary" id="add-cat">Добавить</button>
        </div>
      </div>
      <div id="cats-list">${cats.length ? '' : '<p class="empty-list">Категорий пока нет.</p>'}</div>`;

    const list = $('#cats-list');
    cats.forEach((cat) => list.appendChild(buildCategoryBlock(cat)));

    $('#add-cat').addEventListener('click', async () => {
      const name = $('#new-cat').value.trim();
      if (!name) return toast('Введите название', 'error');
      try { await api('POST', '/api/instruction-categories', { name }); toast('Категория добавлена'); await reloadAndRender(); }
      catch (err) { toast(err.message, 'error'); }
    });
  }

  function buildCategoryBlock(cat) {
    const el = document.createElement('div');
    el.className = 'instr-cat';
    el.innerHTML = `
      <div class="instr-cat__head">
        <input class="input" value="${esc(cat.name)}" data-cat="${cat.id}" />
        <button class="btn btn--outline btn--sm save-cat" data-id="${cat.id}">Сохранить имя</button>
        <button class="btn btn--danger btn--sm del-cat" data-id="${cat.id}">Удалить</button>
      </div>
      <div class="instr-items">
        ${(cat.items || []).length ? (cat.items || []).map((it) => {
          const kinds = [];
          if (it.videoUrl) kinds.push('🎬 видео');
          if (it.text && it.text.trim()) kinds.push('📝 текст');
          if (it.pdf) kinds.push('📄 PDF');
          return `
          <div class="instr-item">
            <span class="instr-item__title">${esc(it.title)}</span>
            <span class="instr-item__meta">${kinds.join(' · ')}</span>
            <button class="btn btn--danger btn--sm del-item" data-cat="${cat.id}" data-item="${it.id}" style="margin-left:auto">Удалить</button>
          </div>`;
        }).join('') : '<p class="hint-text">В категории пока нет инструкций.</p>'}
      </div>
      <div class="instr-add">
        <label class="field-label">Добавить инструкцию</label>
        <input class="input it-title" placeholder="Название (напр. Запуск и первое использование)" />
        <input class="input it-video" placeholder="Ссылка на видео (необязательно)" />
        <textarea class="textarea it-text" placeholder="Текстовая инструкция (необязательно)" style="min-height:80px"></textarea>
        <label class="uploader"><input type="file" class="it-pdf" accept="application/pdf" />Прикрепить <strong>PDF</strong> (необязательно)</label>
        <button class="btn btn--primary btn--sm add-item" data-id="${cat.id}">Добавить в категорию</button>
      </div>`;

    el.querySelector('.save-cat').addEventListener('click', async () => {
      const name = el.querySelector(`[data-cat="${cat.id}"]`).value.trim();
      if (!name) return toast('Введите название', 'error');
      try { await api('PUT', '/api/instruction-categories/' + cat.id, { name }); toast('Название сохранено'); await loadData(); }
      catch (err) { toast(err.message, 'error'); }
    });
    el.querySelector('.del-cat').addEventListener('click', async () => {
      if (!confirm('Удалить категорию со всеми инструкциями?')) return;
      try { await api('DELETE', '/api/instruction-categories/' + cat.id); toast('Категория удалена'); await reloadAndRender(); }
      catch (err) { toast(err.message, 'error'); }
    });
    el.querySelectorAll('.del-item').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Удалить инструкцию?')) return;
      try { await api('DELETE', `/api/instruction-categories/${b.dataset.cat}/items/${b.dataset.item}`); toast('Инструкция удалена'); await reloadAndRender(); }
      catch (err) { toast(err.message, 'error'); }
    }));
    el.querySelector('.add-item').addEventListener('click', async () => {
      const title = el.querySelector('.it-title').value.trim();
      const video = el.querySelector('.it-video').value.trim();
      const text = el.querySelector('.it-text').value.trim();
      const pdf = el.querySelector('.it-pdf').files[0];
      if (!title) return toast('Введите название инструкции', 'error');
      if (!video && !pdf && !text) return toast('Добавьте видео, текст или PDF', 'error');
      const fd = new FormData();
      fd.append('title', title);
      fd.append('videoUrl', video);
      fd.append('text', text);
      if (pdf) fd.append('pdf', pdf);
      try { await api('POST', `/api/instruction-categories/${cat.id}/items`, fd, true); toast('Инструкция добавлена'); await reloadAndRender(); }
      catch (err) { toast(err.message, 'error'); }
    });
    return el;
  }

  async function renderLeadsTab() {
    $('#panel').innerHTML = `
      <div class="panel-head">
        <div><h2>Заявки на оптовый прайс</h2><p>Обращения с сайта: телефон, город, комментарий и дата.</p></div>
        <button class="btn btn--outline btn--sm" id="refresh-leads">Обновить</button>
      </div>
      <div id="leads-wrap"><p class="hint-text">Загрузка…</p></div>`;

    $('#refresh-leads').addEventListener('click', async () => { await loadLeads(); paintLeads(); });
    await loadLeads();
    paintLeads();
  }

  function paintLeads() {
    const wrap = $('#leads-wrap');
    if (!wrap) return;
    if (!LEADS.length) { wrap.innerHTML = '<p class="empty-list">Заявок пока нет.</p>'; return; }
    wrap.innerHTML = `<div class="leads-list">${LEADS.map((l) => {
      const d = new Date(l.createdAt);
      const date = d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      const tel = String(l.phone).replace(/[^+\d]/g, '');
      return `
      <div class="lead">
        <div class="lead__main">
          <div class="lead__phone"><a href="tel:${esc(tel)}">${esc(l.phone)}</a></div>
          ${l.city ? `<div class="lead__city">📍 ${esc(l.city)}</div>` : ''}
          ${l.comment ? `<div class="lead__comment">${esc(l.comment)}</div>` : ''}
          <div class="lead__date">🕑 ${esc(date)}</div>
        </div>
        <button class="btn btn--danger btn--sm lead__del" data-id="${l.id}">Удалить</button>
      </div>`;
    }).join('')}</div>`;

    $$('.lead__del').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Удалить заявку?')) return;
      try {
        await api('DELETE', '/api/leads/' + b.dataset.id);
        LEADS = LEADS.filter((l) => l.id !== b.dataset.id);
        updateLeadsBadge();
        paintLeads();
        toast('Заявка удалена');
      } catch (err) { toast(err.message, 'error'); }
    }));
  }

  async function renderOrdersTab() {
    $('#panel').innerHTML = `
      <div class="panel-head">
        <div><h2>Заказы из корзины</h2><p>Оформленные заказы: состав, сумма, контакты и способ получения.</p></div>
        <button class="btn btn--outline btn--sm" id="refresh-orders">Обновить</button>
      </div>
      <div id="orders-wrap"><p class="hint-text">Загрузка…</p></div>`;
    $('#refresh-orders').addEventListener('click', async () => { await loadOrders(); paintOrders(); });
    await loadOrders();
    paintOrders();
  }

  function paintOrders() {
    const wrap = $('#orders-wrap');
    if (!wrap) return;
    if (!ORDERS.length) { wrap.innerHTML = '<p class="empty-list">Заказов пока нет.</p>'; return; }
    wrap.innerHTML = `<div class="leads-list">${ORDERS.map((o) => {
      const d = new Date(o.createdAt);
      const date = d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      const tel = String(o.phone).replace(/[^+\d]/g, '');
      const delivery = o.delivery && o.delivery.method === 'delivery'
        ? `🚚 Доставка: ${esc(o.delivery.city)}${o.delivery.street ? ', ' + esc(o.delivery.street) : ''}`
        : '🏬 Самовывоз';
      const items = (o.items || []).map((it) => `<div class="order-item"><span>${esc(it.name)} × ${it.qty}</span><span>${it.price ? esc(it.price) + ' ' + esc(it.currency || '₽') : '—'}</span></div>`).join('');
      const total = o.total ? Number(o.total).toLocaleString('ru-RU') + ' ₽' : 'по запросу';
      return `
      <div class="lead order-card">
        <div class="lead__main">
          <div class="order-card__top">
            <span class="lead__phone"><a href="tel:${esc(tel)}">${esc(o.phone)}</a></span>
            <span class="order-card__name">${esc(o.name)}</span>
          </div>
          <div class="lead__city">${delivery}</div>
          <div class="order-items">${items}</div>
          ${o.comment ? `<div class="lead__comment">💬 ${esc(o.comment)}</div>` : ''}
          <div class="order-card__foot">
            <span class="order-total">Итого: <strong>${total}</strong></span>
            <span class="lead__date">🕑 ${esc(date)}</span>
          </div>
        </div>
        <button class="btn btn--danger btn--sm lead__del" data-id="${o.id}">Удалить</button>
      </div>`;
    }).join('')}</div>`;

    $$('#orders-wrap .lead__del').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Удалить заказ?')) return;
      try {
        await api('DELETE', '/api/orders/' + b.dataset.id);
        ORDERS = ORDERS.filter((o) => o.id !== b.dataset.id);
        updateOrdersBadge();
        paintOrders();
        toast('Заказ удалён');
      } catch (err) { toast(err.message, 'error'); }
    }));
  }

  function renderContactsTab() {
    const c = DATA.contacts || {};
    const f = (id, label, val, ph = '') => `
      <label class="field-label">${label}</label>
      <input class="input" id="${id}" value="${esc(val)}" placeholder="${ph}" />`;
    $('#panel').innerHTML = `
      <div class="panel-head"><div><h2>Контакты</h2><p>Данные отображаются в блоке «Контакты».</p></div></div>
      <div class="card-block">
        <h3>Контактные данные</h3>
        ${f('c-address', 'Адрес', c.address)}
        ${f('c-phone', 'Телефон', c.phone, '+7 (900) 000-00-00')}
        ${f('c-email', 'E-mail', c.email)}
        ${f('c-telegram', 'Telegram (логин или ссылка)', c.telegram, '@spacexten')}
        ${f('c-whatsapp', 'WhatsApp (номер или ссылка)', c.whatsapp, '79000000000')}
        ${f('c-hours', 'Часы работы', c.hours, 'Пн–Пт: 9:00–19:00')}
        <label class="field-label">Подпись над контактами</label>
        <textarea class="textarea" id="c-note">${esc(c.note)}</textarea>
        <button class="btn btn--primary" id="save-contacts">Сохранить контакты</button>
      </div>`;

    $('#save-contacts').addEventListener('click', async () => {
      const body = {
        address: $('#c-address').value, phone: $('#c-phone').value, email: $('#c-email').value,
        telegram: $('#c-telegram').value, whatsapp: $('#c-whatsapp').value, hours: $('#c-hours').value,
        note: $('#c-note').value
      };
      try { await api('PUT', '/api/contacts', body); toast('Контакты сохранены'); await loadData(); }
      catch (err) { toast(err.message, 'error'); }
    });
  }

  const SECTION_NAMES = { about: 'О компании', catalog: 'Каталог', wholesale: 'Оптовый прайс', instructions: 'Инструкции', contacts: 'Контакты' };

  function renderBlocksTab() {
    const st = DATA.sectionText || {};
    const stField = (k, label, extra) => {
      const t = st[k] || {};
      return `
      <div class="card-block">
        <h3>${label}</h3>
        <label class="field-label">Надпись сверху (eyebrow)</label>
        <input class="input" id="st-${k}-eyebrow" value="${esc(t.eyebrow)}" />
        <label class="field-label">Заголовок</label>
        <input class="input" id="st-${k}-title" value="${esc(t.title)}" />
        ${extra !== false ? `<label class="field-label">Описание под заголовком</label><textarea class="textarea" id="st-${k}-lead">${esc(t.lead)}</textarea>` : ''}
      </div>`;
    };

    $('#panel').innerHTML = `
      <div class="panel-head"><div><h2>Блоки и тексты</h2><p>Порядок блоков, вставка баннеров между ними и тексты заголовков.</p></div></div>

      <div class="card-block">
        <h3>Порядок блоков</h3>
        <p class="hint-text">Меняйте блоки местами кнопками ↑ ↓. Между блоками можно вставить баннер (статичный или слайдер) — добавьте его ниже и переместите на нужное место.</p>
        <div class="layout-list" id="layout-list"></div>
      </div>

      <div class="card-block">
        <h3>Добавить баннер-вставку</h3>
        <div class="size-hint">⌕ Рекомендуемый размер: <strong>1600 × 400 px</strong> (широкий горизонтальный). Для режима «слайдер» загрузите несколько картинок.</div>
        <label class="field-label">Тип баннера</label>
        <select class="select" id="new-banner-mode">
          <option value="static">Статичный (одна картинка)</option>
          <option value="slider">Слайдер (несколько картинок, авто-смена)</option>
        </select>
        <label class="uploader"><input type="file" id="new-banner-files" accept="image/*" multiple />Выбрать изображение(я) и <strong>добавить баннер</strong></label>
      </div>

      <div class="panel-head" style="margin-top:26px"><div><h2>Тексты блоков</h2><p>Заголовки и описания разделов на сайте.</p></div></div>
      ${stField('catalog', 'Каталог')}
      ${stField('wholesale', 'Оптовый прайс')}
      ${stField('instructions', 'Инструкции')}
      ${stField('contacts', 'Контакты', false)}
      <button class="btn btn--primary" id="save-section-text">Сохранить тексты блоков</button>
      <p class="hint-text" style="margin-top:10px">Текст блока «О компании» редактируется на вкладке «О компании», контакты — на вкладке «Контакты».</p>`;

    renderLayoutList();

    $('#new-banner-files').addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      e.target.value = '';
      if (!files.length) return;
      const fd = new FormData();
      fd.append('mode', $('#new-banner-mode').value);
      files.slice(0, 8).forEach((f) => fd.append('images', f));
      try {
        const res = await api('POST', '/api/layout/banner', fd, true);
        DATA.layout = res;
        toast('Баннер добавлен — переместите его на нужное место');
        renderLayoutList();
      } catch (err) { toast(err.message, 'error'); }
    });

    $('#save-section-text').addEventListener('click', async () => {
      const body = {};
      ['catalog', 'wholesale', 'instructions'].forEach((k) => {
        body[k] = { eyebrow: $('#st-' + k + '-eyebrow').value, title: $('#st-' + k + '-title').value, lead: $('#st-' + k + '-lead').value };
      });
      body.contacts = { eyebrow: $('#st-contacts-eyebrow').value, title: $('#st-contacts-title').value };
      try { const res = await api('PUT', '/api/section-text', body); DATA.sectionText = res; toast('Тексты блоков сохранены'); }
      catch (err) { toast(err.message, 'error'); }
    });
  }

  function renderLayoutList() {
    const list = $('#layout-list');
    const layout = DATA.layout || [];
    list.innerHTML = layout.map((it, i) => {
      const isBanner = it.type === 'banner';
      const title = isBanner
        ? `Баннер (${it.mode === 'slider' ? 'слайдер' : 'статичный'}, ${(it.images || []).length} изобр.)`
        : (SECTION_NAMES[it.key] || it.key);
      const preview = isBanner && it.images && it.images[0]
        ? `<div class="layout-item__thumb" style="background-image:url('${esc(it.images[0])}')"></div>`
        : `<div class="layout-item__ic">${isBanner ? '🖼' : '▦'}</div>`;
      return `
      <div class="layout-item ${isBanner ? 'layout-item--banner' : ''}">
        ${preview}
        <span class="layout-item__name">${esc(title)}</span>
        <div class="layout-item__ctrl">
          <button class="btn btn--outline btn--sm lay-up" data-i="${i}" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button class="btn btn--outline btn--sm lay-down" data-i="${i}" ${i === layout.length - 1 ? 'disabled' : ''}>↓</button>
          ${isBanner ? `<button class="btn btn--danger btn--sm lay-del" data-id="${it.id}">Удалить</button>` : ''}
        </div>
      </div>`;
    }).join('');

    const order = () => (DATA.layout || []).map((it) => it.type === 'banner' ? { type: 'banner', id: it.id } : { type: 'section', key: it.key });
    async function move(i, dir) {
      const arr = order();
      const j = i + dir;
      if (j < 0 || j >= arr.length) return;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      try { const res = await api('PUT', '/api/layout', { order: arr }); DATA.layout = res; renderLayoutList(); }
      catch (err) { toast(err.message, 'error'); }
    }
    $$('#layout-list .lay-up').forEach((b) => b.addEventListener('click', () => move(Number(b.dataset.i), -1)));
    $$('#layout-list .lay-down').forEach((b) => b.addEventListener('click', () => move(Number(b.dataset.i), 1)));
    $$('#layout-list .lay-del').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Удалить баннер-вставку?')) return;
      try { const res = await api('DELETE', '/api/layout/banner/' + b.dataset.id); DATA.layout = res; toast('Баннер удалён'); renderLayoutList(); }
      catch (err) { toast(err.message, 'error'); }
    }));
  }

  function renderSocialsTab() {
    const socials = DATA.socials || [];
    $('#panel').innerHTML = `
      <div class="panel-head"><div><h2>Соцсети</h2><p>Иконки соцсетей появятся справа снизу на сайте: клик по кнопке раскрывает список.</p></div></div>

      <div class="card-block">
        <h3>Добавить соцсеть</h3>
        <div class="size-hint">⌕ Рекомендуемый размер иконки: <strong>128 × 128 px</strong> (квадрат, PNG с прозрачным фоном или SVG). Будет показана в круге.</div>
        <label class="field-label">Иконка</label>
        <label class="uploader"><input type="file" id="social-icon" accept="image/*" />Выбрать <strong>иконку</strong></label>
        <label class="field-label">Ссылка (URL)</label>
        <input class="input" id="social-url" placeholder="https://t.me/ваш_канал или https://wa.me/79990000000" />
        <label class="field-label">Название (для подсказки, необязательно)</label>
        <input class="input" id="social-label" placeholder="Telegram" />
        <button class="btn btn--primary" id="add-social">Добавить соцсеть</button>
      </div>

      <div class="card-block">
        <h3>Добавленные соцсети</h3>
        <div class="socials-list" id="socials-list"></div>
      </div>`;

    paintSocials();

    $('#add-social').addEventListener('click', async () => {
      const file = $('#social-icon').files[0];
      const url = $('#social-url').value.trim();
      const label = $('#social-label').value.trim();
      if (!file) return toast('Загрузите иконку', 'error');
      if (!url) return toast('Укажите ссылку', 'error');
      const fd = new FormData();
      fd.append('icon', file); fd.append('url', url); fd.append('label', label);
      try { const res = await api('POST', '/api/socials', fd, true); DATA.socials = res; toast('Соцсеть добавлена'); renderSocialsTab(); }
      catch (err) { toast(err.message, 'error'); }
    });
  }

  function paintSocials() {
    const wrap = $('#socials-list');
    const socials = DATA.socials || [];
    if (!socials.length) { wrap.innerHTML = '<p class="empty-list">Соцсети пока не добавлены.</p>'; return; }
    wrap.innerHTML = socials.map((s) => `
      <div class="social-row">
        <div class="social-row__icon" style="background-image:url('${esc(s.icon)}')"></div>
        <input class="input social-row__url" data-id="${s.id}" value="${esc(s.url)}" placeholder="Ссылка" />
        <button class="btn btn--outline btn--sm social-save" data-id="${s.id}">Сохранить</button>
        <button class="btn btn--danger btn--sm social-del" data-id="${s.id}">Удалить</button>
      </div>`).join('');
    $$('#socials-list .social-save').forEach((b) => b.addEventListener('click', async () => {
      const url = $(`#socials-list .social-row__url[data-id="${b.dataset.id}"]`).value.trim();
      try { const res = await api('PUT', '/api/socials/' + b.dataset.id, { url }); DATA.socials = res; toast('Сохранено'); }
      catch (err) { toast(err.message, 'error'); }
    }));
    $$('#socials-list .social-del').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Удалить соцсеть?')) return;
      try { const res = await api('DELETE', '/api/socials/' + b.dataset.id); DATA.socials = res; toast('Удалено'); paintSocials(); }
      catch (err) { toast(err.message, 'error'); }
    }));
  }

  function renderAnalyticsTab() {
    $('#panel').innerHTML = `
      <div class="panel-head"><div><h2>Аналитика</h2><p>Посещаемость сайта и переходы в корзину.</p></div>
      <button class="btn btn--outline btn--sm" id="refresh-analytics">Обновить</button></div>
      <div class="stat-grid" id="stat-grid"><p class="hint-text">Загрузка…</p></div>`;
    const paint = (a) => {
      $('#stat-grid').innerHTML = `
        <div class="stat-card"><div class="stat-card__num">${(a.visits || 0).toLocaleString('ru-RU')}</div><div class="stat-card__label">Всего посещений</div></div>
        <div class="stat-card"><div class="stat-card__num">${(a.unique || 0).toLocaleString('ru-RU')}</div><div class="stat-card__label">Уникальных посетителей</div></div>
        <div class="stat-card stat-card--accent"><div class="stat-card__num">${(a.cartOpens || 0).toLocaleString('ru-RU')}</div><div class="stat-card__label">Переходов в корзину</div></div>`;
    };
    const load = async () => { try { paint(await api('GET', '/api/analytics')); } catch (e) { $('#stat-grid').innerHTML = '<p class="hint-text">Не удалось загрузить.</p>'; } };
    $('#refresh-analytics').addEventListener('click', load);
    load();
  }

  function renderSecurityTab() {
    $('#panel').innerHTML = `
      <div class="panel-head"><div><h2>Входы и безопасность</h2><p>Журнал попыток входа в панель управления с IP-адресами.</p></div>
      <button class="btn btn--outline btn--sm" id="refresh-log">Обновить</button></div>
      <div class="card-block" id="sec-state"></div>
      <div class="log-list" id="log-list"><p class="hint-text">Загрузка…</p></div>`;
    const load = async () => {
      let res;
      try { res = await api('GET', '/api/login-log'); } catch (e) { $('#log-list').innerHTML = '<p class="hint-text">Не удалось загрузить.</p>'; return; }
      const sec = res.security || {};
      const locked = sec.lockUntil && Date.now() < sec.lockUntil;
      $('#sec-state').innerHTML = `
        <h3>Состояние входа</h3>
        <p class="hint-text">Неудачных попыток подряд: <strong>${sec.failedAttempts || 0}</strong> из 3.
        ${locked ? `<br><span style="color:var(--danger)">Вход заблокирован до ${new Date(sec.lockUntil).toLocaleString('ru-RU')}</span>` : '<br>Блокировки нет.'}</p>`;
      const log = res.log || [];
      if (!log.length) { $('#log-list').innerHTML = '<p class="empty-list">Записей пока нет.</p>'; return; }
      $('#log-list').innerHTML = `<div class="log-table">
        <div class="log-row log-row--head"><span>Время</span><span>Логин</span><span>IP</span><span>Результат</span></div>
        ${log.map((e) => `<div class="log-row ${e.success ? 'log-row--ok' : 'log-row--fail'}">
          <span>${new Date(e.time).toLocaleString('ru-RU')}</span>
          <span>${esc(e.login || '—')}</span>
          <span>${esc(e.ip || '—')}</span>
          <span>${e.success ? '✓ успешно' : '✕ ' + reasonText(e.reason)}</span></div>`).join('')}</div>`;
    };
    $('#refresh-log').addEventListener('click', load);
    load();
  }
  function reasonText(r) {
    if (r === 'locked') return 'блокировка';
    if (r === 'bad_credentials') return 'неверные данные';
    return 'отказ';
  }

  function renderBackupsTab() {
    $('#panel').innerHTML = `
      <div class="panel-head"><div><h2>Резервные копии</h2><p>Копии всего сайта. Автоматически создаются раз в сутки, хранятся последние 30.</p></div>
      <button class="btn btn--primary btn--sm" id="make-backup">Создать копию сейчас</button></div>
      <div class="card-block"><p class="hint-text" id="backup-last"></p></div>
      <div class="backup-list" id="backup-list"><p class="hint-text">Загрузка…</p></div>`;
    const paint = (data) => {
      const list = data.backups || [];
      $('#backup-last').textContent = data.last ? 'Последняя копия: ' + new Date(data.last).toLocaleString('ru-RU') : 'Копий пока нет.';
      if (!list.length) { $('#backup-list').innerHTML = '<p class="empty-list">Копий пока нет.</p>'; return; }
      $('#backup-list').innerHTML = list.map((b) => `
        <div class="backup-row">
          <div class="backup-row__info"><div class="backup-row__name">${esc(b.name)}</div>
          <div class="backup-row__meta">${new Date(b.time).toLocaleString('ru-RU')} · ${(b.size / 1024).toFixed(1)} КБ</div></div>
          <div class="backup-row__ctrl">
            <a class="btn btn--outline btn--sm" href="/api/backups/${encodeURIComponent(b.name)}?token=${encodeURIComponent(token)}">Скачать</a>
            <button class="btn btn--outline btn--sm bk-restore" data-name="${esc(b.name)}">Восстановить</button>
            <button class="btn btn--danger btn--sm bk-del" data-name="${esc(b.name)}">Удалить</button>
          </div>
        </div>`).join('');
      $$('#backup-list .bk-restore').forEach((btn) => btn.addEventListener('click', async () => {
        if (!confirm('Восстановить сайт из этой копии? Текущие данные будут заменены.')) return;
        try { await api('POST', '/api/backups/' + encodeURIComponent(btn.dataset.name) + '/restore'); toast('Сайт восстановлен из копии'); await loadData(); await loadLeads(); await loadOrders(); }
        catch (e) { toast(e.message, 'error'); }
      }));
      $$('#backup-list .bk-del').forEach((btn) => btn.addEventListener('click', async () => {
        if (!confirm('Удалить эту копию?')) return;
        try { paint(await api('DELETE', '/api/backups/' + encodeURIComponent(btn.dataset.name))); toast('Копия удалена'); }
        catch (e) { toast(e.message, 'error'); }
      }));
    };
    const load = async () => { try { paint(await api('GET', '/api/backups')); } catch (e) { $('#backup-list').innerHTML = '<p class="hint-text">Не удалось загрузить.</p>'; } };
    $('#make-backup').addEventListener('click', async () => {
      try { paint(await api('POST', '/api/backups')); toast('Копия создана'); }
      catch (e) { toast(e.message, 'error'); }
    });
    load();
  }

  function renderSettingsTab() {
    const s = DATA.site || {};
    const theme = s.theme === 'light' ? 'light' : 'dark';
    const col = s.colors || { grad1: '#2563eb', grad2: '#0ea5c4', sub1: '#f59e0b', sub2: '#f97316' };
    loadLeads(); loadOrders();

    $('#panel').innerHTML = `
      <div class="panel-head"><div><h2>Настройки</h2><p>Тема, цвета градиентов, ссылка заказа и резервные копии.</p></div></div>

      <div class="card-block">
        <h3>Тема сайта</h3>
        <p class="hint-text">Светлая — основная. Переключение применяется ко всему сайту сразу.</p>
        <div class="theme-switch">
          <button class="theme-opt ${theme === 'light' ? 'active' : ''}" data-theme="light">
            <div class="theme-opt__title">☀️ Светлая</div>
            <div class="theme-opt__desc">Светлый фон, мягкие тона, без звёзд.</div>
            <div class="theme-swatch theme-swatch--light"></div>
          </button>
          <button class="theme-opt ${theme === 'dark' ? 'active' : ''}" data-theme="dark">
            <div class="theme-opt__title">🌙 Тёмная (космос)</div>
            <div class="theme-opt__desc">Тёмный фон, анимированные звёзды.</div>
            <div class="theme-swatch theme-swatch--dark"></div>
          </button>
        </div>
      </div>

      <div class="card-block">
        <h3>Цвета градиентов</h3>
        <p class="hint-text">Основной градиент — кнопки, шапка, категории. Оранжевый — подкатегории. Меняйте под свой бренд.</p>
        <div class="color-preview" id="grad-main-preview"></div>
        <div class="color-row">
          <label class="color-field"><span>Основной — цвет 1</span><input type="color" id="col-grad1" value="${esc(col.grad1)}" /></label>
          <label class="color-field"><span>Основной — цвет 2</span><input type="color" id="col-grad2" value="${esc(col.grad2)}" /></label>
        </div>
        <div class="color-preview color-preview--sub" id="grad-sub-preview"></div>
        <div class="color-row">
          <label class="color-field"><span>Подкатегории — цвет 1</span><input type="color" id="col-sub1" value="${esc(col.sub1)}" /></label>
          <label class="color-field"><span>Подкатегории — цвет 2</span><input type="color" id="col-sub2" value="${esc(col.sub2)}" /></label>
        </div>
        <div class="btn-row">
          <button class="btn btn--primary btn--sm" id="save-colors">Сохранить цвета</button>
          <button class="btn btn--outline btn--sm" id="reset-colors">Сбросить к синему/оранжевому</button>
        </div>
      </div>

      <div class="card-block">
        <h3>Общая ссылка «Заказать товар»</h3>
        <p class="hint-text">Используется, если у товара не задана собственная ссылка.</p>
        <label class="field-label">Ссылка (мессенджер)</label>
        <input class="input" id="s-order" value="${esc(s.orderUrl || '')}" placeholder="https://t.me/ваш_аккаунт или https://wa.me/79990000000" />
        <button class="btn btn--primary btn--sm" id="save-order">Сохранить ссылку</button>
      </div>

      <div class="card-block">
        <h3>Резервная копия данных</h3>
        <p class="hint-text">Экспорт сохраняет ВСЕ данные (каталог, категории, подкатегории, инструкции, заказы, заявки, настройки, цвета) в один JSON-файл. Импорт полностью восстанавливает их.</p>
        <div class="btn-row">
          <button class="btn btn--primary btn--sm" id="do-export">⤓ Скачать резервную копию</button>
          <label class="btn btn--outline btn--sm" style="cursor:pointer">
            <input type="file" id="import-file" accept="application/json,.json" hidden />⤒ Импортировать из файла
          </label>
        </div>
        <p class="hint-text" style="margin-top:12px">Загруженные фото и PDF лежат в папке <code>uploads/</code> — при переносе на другой сервер копируйте её вместе с резервной копией.</p>
      </div>`;

    function updatePreviews() {
      const g1 = $('#col-grad1').value, g2 = $('#col-grad2').value, u1 = $('#col-sub1').value, u2 = $('#col-sub2').value;
      $('#grad-main-preview').style.background = `linear-gradient(135deg, ${g1}, ${g2})`;
      $('#grad-sub-preview').style.background = `linear-gradient(135deg, ${u1}, ${u2})`;
    }
    ['col-grad1', 'col-grad2', 'col-sub1', 'col-sub2'].forEach((id) => $('#' + id).addEventListener('input', updatePreviews));
    updatePreviews();

    $$('.theme-opt').forEach((b) => b.addEventListener('click', async () => {
      const newTheme = b.dataset.theme;
      $$('.theme-opt').forEach((x) => x.classList.toggle('active', x === b));
      try { const res = await api('PUT', '/api/site', { theme: newTheme }); DATA.site = res; toast('Тема обновлена: ' + (newTheme === 'light' ? 'светлая' : 'тёмная')); }
      catch (err) { toast(err.message, 'error'); }
    }));

    $('#save-colors').addEventListener('click', async () => {
      const colors = { grad1: $('#col-grad1').value, grad2: $('#col-grad2').value, sub1: $('#col-sub1').value, sub2: $('#col-sub2').value };
      try { const res = await api('PUT', '/api/site', { colors }); DATA.site = res; toast('Цвета сохранены'); }
      catch (err) { toast(err.message, 'error'); }
    });
    $('#reset-colors').addEventListener('click', async () => {
      const colors = { grad1: '#2563eb', grad2: '#0ea5c4', sub1: '#f59e0b', sub2: '#f97316' };
      try { const res = await api('PUT', '/api/site', { colors }); DATA.site = res; toast('Цвета сброшены'); renderSettingsTab(); }
      catch (err) { toast(err.message, 'error'); }
    });

    $('#save-order').addEventListener('click', async () => {
      try { const res = await api('PUT', '/api/site', { orderUrl: $('#s-order').value.trim() }); DATA.site = res; toast('Ссылка сохранена'); }
      catch (err) { toast(err.message, 'error'); }
    });

    $('#do-export').addEventListener('click', () => {
      try {
        const full = Object.assign({}, DATA, { leads: LEADS || [], orders: ORDERS || [] });
        const json = JSON.stringify(full, null, 2);
        const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const stamp = new Date().toISOString().slice(0, 10);
        a.href = url; a.download = `spacexten-backup-${stamp}.json`;
        document.body.appendChild(a); a.click();
        setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 200);
        toast('Резервная копия скачана');
      } catch (err) { toast('Ошибка экспорта: ' + err.message, 'error'); }
    });

    $('#import-file').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      if (!confirm('Импорт полностью заменит текущие данные сайта. Продолжить?')) return;
      try {
        const text = await file.text();
        let parsed;
        try { parsed = JSON.parse(text); } catch (er) { throw new Error('Файл не является корректным JSON'); }
        await api('POST', '/api/import', { data: parsed });
        toast('Данные импортированы');
        await loadData(); await loadLeads(); await loadOrders();
        renderTab('settings');
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  async function boot() {
    if (token) {
      try { await api('GET', '/api/me'); enterApp(); return; }
      catch (e) { token = ''; localStorage.removeItem(TOKEN_KEY); }
    }
    document.body.classList.remove('is-authed');
    $('#login').focus();
  }
  boot();
})();
