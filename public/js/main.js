(function () {
  'use strict';

  let DATA = null;
  const CART_KEY = 'spx_cart';
  let cart = loadCart();

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  function priceNumber(p) { const d = String(p == null ? '' : p).replace(/[^\d]/g, ''); return d ? parseInt(d, 10) : 0; }
  function formatPrice(price, currency) {
    if (price === '' || price == null) return '';
    const num = String(price).replace(/\s/g, '');
    if (/^\d+$/.test(num)) return Number(num).toLocaleString('ru-RU') + ' ' + (currency || '₽');
    return esc(price) + (currency ? ' ' + esc(currency) : '');
  }
  function formatSum(sum, currency) { return Number(sum || 0).toLocaleString('ru-RU') + ' ' + (currency || '₽'); }

  function toEmbed(url) {
    if (!url) return null;
    const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
    if (yt) return { type: 'iframe', src: 'https://www.youtube.com/embed/' + yt[1] };
    const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vm) return { type: 'iframe', src: 'https://player.vimeo.com/video/' + vm[1] };
    if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url)) return { type: 'video', src: url };
    if (/\.pdf(\?.*)?$/i.test(url)) return { type: 'pdf', src: url };
    return { type: 'iframe', src: url };
  }
  function normalizeLink(val, base) {
    if (/^https?:\/\//i.test(val)) return val;
    if (base.includes('wa.me')) return base + val.replace(/[^\d]/g, '');
    return base + val.replace(/^@/, '');
  }

  async function loadData() {
    try { DATA = await (await fetch('/api/data')).json(); applyTheme(); applyColors(); render(); }
    catch (e) { console.error('Не удалось загрузить данные', e); }
  }
  function applyTheme() {
    const theme = (DATA.site && DATA.site.theme) === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    if (window.SpaceBG) { theme === 'dark' ? window.SpaceBG.enable() : window.SpaceBG.disable(); }
  }
  function applyColors() {
    const c = (DATA.site && DATA.site.colors) || {};
    const root = document.documentElement.style;
    const isHex = (v) => typeof v === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v);
    if (isHex(c.grad1)) { root.setProperty('--primary', c.grad1); root.setProperty('--primary-2', c.grad1); }
    if (isHex(c.grad2)) root.setProperty('--cyan', c.grad2);
    if (isHex(c.sub1)) root.setProperty('--sub1', c.sub1);
    if (isHex(c.sub2)) root.setProperty('--sub2', c.sub2);
  }
  function render() {
    renderHeader();
    renderBanners();
    renderSectionTexts();
    renderAbout();
    renderCatalog();
    renderNavCatalog();
    renderInstructions();
    renderContacts();
    renderSocials();
    applyLayout();
    updateCartCount();
    initReveal();
  }

  function renderHeader() {
    const h = DATA.header || {};
    const title = (DATA.site && DATA.site.title) || 'SPACEXTEN';
    $('#brand-name').textContent = title;
    $('#hero-badge').textContent = h.badge || '';
    $('#hero-badge').style.display = h.badge ? '' : 'none';

    const logo = $('#hero-logo');
    const titleEl = $('#hero-title');
    if (h.logo) {
      logo.src = h.logo; logo.hidden = false; logo.alt = h.title || title;
      titleEl.style.display = 'none';
    } else {
      logo.hidden = true;
      titleEl.textContent = h.title || '';
      titleEl.style.display = h.title ? '' : 'none';
    }
    $('#hero-subtitle').textContent = h.subtitle || '';
    $('#hero-subtitle').style.display = h.subtitle ? '' : 'none';

    const bg = $('#hero-bg');
    if (h.image) { bg.style.backgroundImage = `url('${esc(h.image)}')`; bg.classList.add('has-image'); }
    else { bg.style.backgroundImage = ''; bg.classList.remove('has-image'); }
    document.title = title + ' — профессиональное оборудование';
  }

  let slider = { timer: null, idx: 0, variant: '' };
  function pickBannerSet() {
    const b = DATA.banners || { desktop: [], mobile: [] };
    const isMobile = window.matchMedia('(max-width: 680px)').matches;
    const primary = isMobile ? b.mobile : b.desktop;
    const fallback = isMobile ? b.desktop : b.mobile;
    const list = (primary && primary.length) ? primary : (fallback || []);
    return { list, variant: isMobile ? 'mobile' : 'desktop' };
  }
  function renderBanners() {
    const { list, variant } = pickBannerSet();
    const sliderEl = $('#banner-slider');
    const track = $('#slider-track');
    if (slider.timer) { clearInterval(slider.timer); slider.timer = null; }
    slider.idx = 0; slider.variant = variant;

    const ratio = (DATA.site && DATA.site.sliderRatio) || '1600/250';
    sliderEl.style.aspectRatio = ratio.replace(/\s/g, '').replace('/', ' / ');

    if (!list.length) { sliderEl.style.display = 'none'; return; }
    sliderEl.style.display = '';
    track.innerHTML = list.map((src) => `<div class="slide" style="background-image:url('${esc(src)}')"></div>`).join('');

    sliderEl.querySelectorAll('.slider-arrow, .slider-dots').forEach((el) => el.remove());

    function go(n) { slider.idx = (n + list.length) % list.length; track.style.transform = `translateX(-${slider.idx * 100}%)`; updateDots(); }
    function updateDots() {
      const dots = sliderEl.querySelectorAll('.slider-dots .sd');
      dots.forEach((d, i) => d.classList.toggle('active', i === slider.idx));
    }
    function restart() { if (slider.timer) clearInterval(slider.timer); if (list.length > 1) slider.timer = setInterval(() => go(slider.idx + 1), 5000); }

    if (list.length > 1) {
      const prev = document.createElement('button');
      prev.className = 'slider-arrow slider-arrow--prev'; prev.setAttribute('aria-label', 'Предыдущий слайд');
      prev.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      const next = document.createElement('button');
      next.className = 'slider-arrow slider-arrow--next'; next.setAttribute('aria-label', 'Следующий слайд');
      next.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      prev.addEventListener('click', (e) => { e.stopPropagation(); go(slider.idx - 1); restart(); });
      next.addEventListener('click', (e) => { e.stopPropagation(); go(slider.idx + 1); restart(); });
      sliderEl.appendChild(prev); sliderEl.appendChild(next);

      const dots = document.createElement('div');
      dots.className = 'slider-dots';
      dots.innerHTML = list.map((_, i) => `<button class="sd ${i === 0 ? 'active' : ''}" data-i="${i}" aria-label="Слайд ${i + 1}"></button>`).join('');
      dots.querySelectorAll('.sd').forEach((d) => d.addEventListener('click', (e) => { e.stopPropagation(); go(Number(d.dataset.i)); restart(); }));
      sliderEl.appendChild(dots);
    }
    restart();
    go(0);
  }

  function renderSectionTexts() {
    const st = DATA.sectionText || {};
    const set = (id, val) => { const el = $('#' + id); if (el != null && val != null) { el.textContent = val; el.style.display = val ? '' : 'none'; } };
    ['catalog', 'wholesale', 'instructions', 'contacts'].forEach((k) => {
      const t = st[k] || {};
      set(k + '-eyebrow', t.eyebrow);
      if (k === 'catalog') { set('catalog-title', t.title); set('catalog-lead', t.lead); }
      if (k === 'wholesale') { set('wholesale-title', t.title); set('wholesale-lead', t.lead); }
      if (k === 'instructions') { set('instructions-title', t.title); set('instructions-lead', t.lead); }
      if (k === 'contacts') { set('contacts-title', t.title); }
    });
  }

  let bannerTimers = {};
  function applyLayout() {
    const container = $('#main-blocks');
    const layout = (DATA.layout && DATA.layout.length) ? DATA.layout : [
      { type: 'section', key: 'about' }, { type: 'section', key: 'catalog' },
      { type: 'section', key: 'wholesale' }, { type: 'section', key: 'instructions' }, { type: 'section', key: 'contacts' }
    ];
    Object.values(bannerTimers).forEach(clearInterval); bannerTimers = {};
    const keepIds = new Set();

    layout.forEach((item) => {
      if (item.type === 'section') {
        const el = container.querySelector(`[data-block="${item.key}"]`);
        if (el) container.appendChild(el);
      } else if (item.type === 'banner') {
        keepIds.add(item.id);
        let el = document.getElementById('banner-' + item.id);
        if (!el) { el = document.createElement('div'); el.id = 'banner-' + item.id; el.className = 'banner-block'; }
        buildBannerBlock(el, item);
        container.appendChild(el);
      }
    });
    $$('.banner-block', container).forEach((el) => {
      const id = el.id.replace('banner-', '');
      if (!keepIds.has(id)) el.remove();
    });
  }
  function buildBannerBlock(el, item) {
    const imgs = item.images || [];
    if (!imgs.length) { el.innerHTML = ''; return; }
    el.classList.toggle('banner-block--slider', item.mode === 'slider');
    if (item.mode === 'slider' && imgs.length > 1) {
      el.innerHTML = `<div class="container"><div class="banner-block__slider">${imgs.map((s, i) => `<div class="banner-block__slide ${i === 0 ? 'active' : ''}" style="background-image:url('${esc(s)}')"></div>`).join('')}</div></div>`;
      const slides = $$('.banner-block__slide', el);
      let idx = 0;
      bannerTimers[item.id] = setInterval(() => {
        idx = (idx + 1) % slides.length;
        slides.forEach((s, i) => s.classList.toggle('active', i === idx));
      }, 5000);
    } else {
      el.innerHTML = `<div class="container"><img class="banner-block__img" src="${esc(imgs[0])}" alt="" loading="lazy" /></div>`;
    }
  }

  function renderAbout() {
    const a = DATA.about || {};
    $('#about-title').textContent = a.title || 'О компании';
    $('#about-text').textContent = a.text || '';
    $('#about-features').innerHTML = (a.features || []).map((f) => `
      <div class="feature reveal"><h3>${esc(f.title)}</h3><p>${esc(f.text)}</p></div>`).join('');
  }

  function renderNavCatalog() {
    const cats = (DATA.productCategories || []).filter((c) => c.published !== false);
    const menu = $('#nav-catalog-menu');
    const items = [`<a class="nav__menu-item" href="/catalog/">Весь каталог</a>`]
      .concat(cats.map((c) => `<a class="nav__menu-item" href="/catalog/${esc(c.slug)}/">${esc(c.name)}</a>`));
    menu.innerHTML = items.join('');
  }
  function openCatalogDropdown() { $('#nav-catalog-dd').classList.add('open'); $('#nav-catalog-btn').setAttribute('aria-expanded', 'true'); }
  function closeCatalogDropdown() { $('#nav-catalog-dd').classList.remove('open'); $('#nav-catalog-btn').setAttribute('aria-expanded', 'false'); }

  let activeCatId = '__all';
  let activeSubId = '__all';
  function productCardHtml(p) {
    const imgs = (p.images && p.images.length) ? p.images : [];
    const plaque = p.badge === 'best' ? '<span class="card__plaque card__plaque--best">Лучший выбор</span>'
      : p.badge === 'sale' ? '<span class="card__plaque card__plaque--sale">Распродажа</span>' : '';
    const img = imgs[0] || '';
    const href = '/product/' + esc(p.slug || '') + '/';
    return `
      <a class="card" href="${href}" data-id="${p.id}" aria-label="${esc(p.name)}">
        ${plaque}
        <div class="card__gallery"><div class="card__layer active${img ? '' : ' card__layer--empty'}" ${img ? `style="background-image:url('${esc(img)}')"` : ''}></div></div>
        <div class="card__info">
          <h3 class="card__name">${esc(p.name)}</h3>
          ${p.price ? `<div class="card__price">${formatPrice(p.price, p.currency)}</div>` : '<div class="card__price card__price--na">Цена по запросу</div>'}
        </div>
      </a>`;
  }
  function countInCat(catId, products, cats) {
    if (catId === '__all') return products.length;
    if (catId === '__none') return products.filter((p) => !p.categoryId || !cats.some((c) => c.id === p.categoryId)).length;
    return products.filter((p) => p.categoryId === catId).length;
  }
  function renderCatalog() {
    const products = (DATA.products || []).filter((p) => p.published !== false);
    const cats = (DATA.productCategories || []).filter((c) => c.published !== false);
    $('#catalog-empty').hidden = products.length > 0;

    const tilesEl = $('#cat-tiles');
    if (tilesEl) {
      tilesEl.innerHTML = cats.map((c) => {
        const count = products.filter((p) => p.categoryId === c.id).length;
        return `<a class="cat-tile" href="/catalog/${esc(c.slug || '')}/">
          <div class="cat-tile__img" style="${c.image ? `background-image:url('${esc(c.image)}')` : ''}">${c.image ? '' : '<span class="cat-tile__ph">SPACEXTEN</span>'}</div>
          <div class="cat-tile__body"><span class="cat-tile__name">${esc(c.name)}</span><span class="cat-tile__count">${count} тов.</span></div>
        </a>`;
      }).join('');
      tilesEl.style.display = cats.length ? '' : 'none';
    }

    const chips = [{ id: '__all', name: 'Все товары' }];
    cats.forEach((c) => chips.push({ id: c.id, name: c.name }));
    const hasUncat = products.some((p) => !p.categoryId || !cats.some((c) => c.id === p.categoryId));
    if (hasUncat && cats.length) chips.push({ id: '__none', name: 'Прочее' });
    if (!chips.some((c) => c.id === activeCatId)) { activeCatId = '__all'; activeSubId = '__all'; }

    const subtitleEl = $('#catalog-subtitle');
    if (subtitleEl) {
      const active = cats.find((c) => c.id === activeCatId);
      subtitleEl.textContent = activeCatId === '__all' ? 'Все товары' : (activeCatId === '__none' ? 'Прочее' : (active ? active.name : 'Товары'));
    }

    const chipsEl = $('#catalog-chips');
    if (chipsEl) {
      chipsEl.innerHTML = cats.length
        ? chips.map((c) => `<button class="chip ${c.id === activeCatId ? 'chip--active' : ''}" data-cat="${esc(c.id)}" role="tab">${esc(c.name)}<span class="chip__count">${countInCat(c.id, products, cats)}</span></button>`).join('')
        : '';
      $$('#catalog-chips .chip').forEach((ch) => ch.addEventListener('click', () => { activeCatId = ch.dataset.cat; activeSubId = '__all'; renderCatalog(); }));
    }

    const subEl = $('#catalog-subchips');
    const activeCat = cats.find((c) => c.id === activeCatId);
    const subs = (activeCat && activeCat.subcategories) || [];
    if (subEl) {
      if (subs.length) {
        if (!['__all'].concat(subs.map((s) => s.id)).includes(activeSubId)) activeSubId = '__all';
        const subChips = [{ id: '__all', name: 'Все' }].concat(subs.map((s) => ({ id: s.id, name: s.name })));
        subEl.innerHTML = subChips.map((s) => `<button class="subchip ${s.id === activeSubId ? 'subchip--active' : ''}" data-sub="${esc(s.id)}">${esc(s.name)}</button>`).join('');
        subEl.style.display = '';
        $$('#catalog-subchips .subchip').forEach((sc) => sc.addEventListener('click', () => { activeSubId = sc.dataset.sub; renderCatalog(); }));
      } else {
        subEl.innerHTML = '';
        subEl.style.display = 'none';
        activeSubId = '__all';
      }
    }

    renderCatalogGrid(products, cats);
  }
  function renderCatalogGrid(products, cats) {
    const grid = $('#catalog-grid');
    if (!grid) return;
    let list = products;
    if (activeCatId === '__none') list = products.filter((p) => !p.categoryId || !cats.some((c) => c.id === p.categoryId));
    else if (activeCatId !== '__all') {
      list = products.filter((p) => p.categoryId === activeCatId);
      if (activeSubId !== '__all') list = list.filter((p) => p.subcategoryId === activeSubId);
    }
    if (!list.length) {
      grid.innerHTML = products.length ? '<p class="empty-note">В этой категории пока нет товаров.</p>' : '';
      return;
    }
    grid.innerHTML = list.map(productCardHtml).join('');
    initReveal();
  }

  function findInstructionItem(itemId) {
    if (!itemId) return null;
    for (const c of (DATA.instructionCategories || [])) {
      const it = (c.items || []).find((x) => x.id === itemId);
      if (it) return it;
    }
    return null;
  }
  function openProduct(id) {
    const products = DATA.products || [];
    const p = products.find((x) => x.id === id);
    if (!p) return;
    const imgs = p.images && p.images.length ? p.images : [];
    const related = (p.relatedIds || []).map((rid) => products.find((x) => x.id === rid)).filter(Boolean);
    const own = p.instruction || {};
    const linked = findInstructionItem(p.linkedInstructionId) || {};
    const ins = {
      videoUrl: own.videoUrl || linked.videoUrl || '',
      text: (own.text && own.text.trim()) ? own.text : (linked.text || ''),
      pdf: own.pdf || linked.pdf || ''
    };
    const hasVideo = !!ins.videoUrl, hasText = !!(ins.text && ins.text.trim()), hasPdf = !!ins.pdf;
    const hasInstr = hasVideo || hasText || hasPdf;

    const plaque = p.badge === 'best' ? '<span class="pm__plaque pm__plaque--best">Лучший выбор</span>'
      : p.badge === 'sale' ? '<span class="pm__plaque pm__plaque--sale">Распродажа</span>' : '';
    const mainImg = imgs[0] || '';
    const thumbs = imgs.length > 1
      ? `<div class="pm__thumbs">${imgs.map((src, i) => `<button class="pm__thumb ${i === 0 ? 'active' : ''}" data-src="${esc(src)}" style="background-image:url('${esc(src)}')"></button>`).join('')}</div>`
      : '';

    const relatedHtml = related.length ? `
      <div class="pm__section-title">Запчасти для этого товара</div>
      <div class="pm__related">
        ${related.map((r) => `
          <a class="pm__rel-card" href="/product/${esc(r.slug || '')}/" data-rel="${r.id}">
            <div class="pm__rel-img" style="${r.images && r.images[0] ? `background-image:url('${esc(r.images[0])}')` : ''}"></div>
            <div><div class="pm__rel-name">${esc(r.name)}</div>${r.price ? `<div class="pm__rel-price">${formatPrice(r.price, r.currency)}</div>` : ''}</div>
          </a>`).join('')}
      </div>` : '';

    const instrTabs = [];
    if (hasVideo) instrTabs.push({ key: 'video', label: 'Видео' });
    if (hasText) instrTabs.push({ key: 'text', label: 'Текст' });
    if (hasPdf) instrTabs.push({ key: 'pdf', label: 'PDF' });
    const instrHtml = hasInstr ? `
      <div class="pm__instruction" id="pm-instruction">
        <div class="pm__section-title">Инструкция</div>
        ${instrTabs.length > 1 ? `<div class="viewer__tabs">${instrTabs.map((t, i) => `<button class="viewer__tab ${i === 0 ? 'active' : ''}" data-key="${t.key}">${t.label}</button>`).join('')}</div>` : ''}
        <div class="viewer__stage" id="pm-instr-stage"></div>
      </div>` : '';

    $('#product-modal-body').innerHTML = `
      <div class="pm">
        <div class="pm__media">
          <div class="pm__main ${mainImg ? 'pm__main--zoomable' : ''}" id="pm-main" data-src="${esc(mainImg)}" style="${mainImg ? `background-image:url('${esc(mainImg)}')` : ''}">${plaque}${mainImg ? '<span class="pm__zoom-hint" aria-hidden="true">⤢</span>' : ''}</div>
          ${thumbs}
        </div>
        <div class="pm__content">
          <h2 class="pm__title">${esc(p.name)}</h2>
          ${p.price ? `<div class="pm__price">${formatPrice(p.price, p.currency)}</div>` : '<div class="pm__price pm__price--na">Цена по запросу</div>'}
          <div class="pm__actions">
            <a class="btn btn--ghost" href="/product/${esc(p.slug || '')}/">Открыть страницу</a>
            ${hasInstr ? `<button class="btn btn--ghost" id="pm-instr-jump">Инструкция</button>` : ''}
          </div>
          ${p.description ? `<p class="pm__desc">${esc(p.description)}</p>` : ''}
          ${relatedHtml}
          ${instrHtml}
        </div>
      </div>
      <div class="pm__buybar">
        <div class="pm__buybar-price">${p.price ? formatPrice(p.price, p.currency) : 'Цена по запросу'}</div>
        <button class="btn btn--primary pm__buybar-btn" id="pm-buy">В корзину</button>
      </div>`;

    const mainEl = $('#pm-main');
    let curIdx = 0;
    $$('#product-modal-body .pm__thumb').forEach((t, ti) => t.addEventListener('click', () => {
      curIdx = ti;
      mainEl.style.backgroundImage = `url('${t.dataset.src}')`;
      mainEl.dataset.src = t.dataset.src;
      $$('#product-modal-body .pm__thumb').forEach((x) => x.classList.toggle('active', x === t));
    }));
    if (mainImg) mainEl.addEventListener('click', () => openLightbox(imgs, imgs.indexOf(mainEl.dataset.src) >= 0 ? imgs.indexOf(mainEl.dataset.src) : 0));

    $('#pm-buy').addEventListener('click', () => addToCart(p.id));

    if (hasInstr) {
      const stage = $('#pm-instr-stage');
      const showPane = (key) => {
        if (key === 'video') {
          const v = toEmbed(ins.videoUrl);
          if (v && v.type === 'video') stage.innerHTML = `<video class="viewer__video" controls src="${esc(v.src)}"></video>`;
          else if (v && v.type === 'pdf') stage.innerHTML = `<iframe class="viewer__frame" src="${esc(v.src)}"></iframe>`;
          else if (v) stage.innerHTML = `<iframe class="viewer__video" src="${esc(v.src)}" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
          else stage.innerHTML = `<p class="viewer__muted">Видео недоступно.</p>`;
        } else if (key === 'text') {
          stage.innerHTML = `<div class="viewer__text">${esc(ins.text).replace(/\n/g, '<br>')}</div>`;
        } else if (key === 'pdf') {
          stage.innerHTML = `<iframe class="viewer__frame" src="${esc(ins.pdf)}"></iframe>
            <div class="viewer__pad viewer__pad--row"><a class="btn btn--primary btn--sm" href="${esc(ins.pdf)}" download>Скачать PDF</a>
            <a class="btn btn--ghost btn--sm" href="${esc(ins.pdf)}" target="_blank" rel="noopener">Открыть в новой вкладке</a></div>`;
        }
      };
      $$('#product-modal-body .viewer__tab').forEach((b) => b.addEventListener('click', () => {
        $$('#product-modal-body .viewer__tab').forEach((x) => x.classList.toggle('active', x === b)); showPane(b.dataset.key);
      }));
      showPane(instrTabs[0].key);
      const jump = $('#pm-instr-jump');
      if (jump) jump.addEventListener('click', () => $('#pm-instruction').scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }

    openModal($('#product-modal'));
  }

  function openViewer(title, instruction) {
    const ins = instruction || {};
    const hasVideo = !!ins.videoUrl, hasText = !!(ins.text && ins.text.trim()), hasPdf = !!ins.pdf;
    const tabs = [];
    if (hasVideo) tabs.push({ key: 'video', label: 'Видео-инструкция' });
    if (hasText) tabs.push({ key: 'text', label: 'Текстовая инструкция' });
    if (hasPdf) tabs.push({ key: 'pdf', label: 'PDF-инструкция' });
    const tabsHtml = tabs.length > 1 ? `<div class="viewer__tabs">${tabs.map((t, i) => `<button class="viewer__tab ${i === 0 ? 'active' : ''}" data-key="${t.key}">${t.label}</button>`).join('')}</div>` : '';
    $('#viewer-modal-body').innerHTML = `<h3 class="viewer__title">${esc(title)} — инструкция</h3>${tabsHtml}<div class="viewer__stage" id="viewer-stage"></div>`;
    function showPane(key) {
      const stage = $('#viewer-stage');
      if (key === 'video') {
        const v = toEmbed(ins.videoUrl);
        if (v && v.type === 'video') stage.innerHTML = `<video class="viewer__video" controls src="${esc(v.src)}"></video>`;
        else if (v && v.type === 'pdf') stage.innerHTML = `<iframe class="viewer__frame" src="${esc(v.src)}"></iframe>`;
        else if (v) stage.innerHTML = `<iframe class="viewer__video" src="${esc(v.src)}" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
        else stage.innerHTML = `<p class="viewer__muted">Видео недоступно.</p>`;
      } else if (key === 'text') { stage.innerHTML = `<div class="viewer__text">${esc(ins.text).replace(/\n/g, '<br>')}</div>`; }
      else if (key === 'pdf') {
        stage.innerHTML = `<iframe class="viewer__frame" src="${esc(ins.pdf)}"></iframe>
          <div class="viewer__pad viewer__pad--row"><a class="btn btn--primary btn--sm" href="${esc(ins.pdf)}" download>Скачать PDF</a>
          <a class="btn btn--ghost btn--sm" href="${esc(ins.pdf)}" target="_blank" rel="noopener">Открыть в новой вкладке</a></div>`;
      }
    }
    $$('#viewer-modal-body .viewer__tab').forEach((b) => b.addEventListener('click', () => {
      $$('#viewer-modal-body .viewer__tab').forEach((x) => x.classList.toggle('active', x === b)); showPane(b.dataset.key);
    }));
    if (tabs.length) showPane(tabs[0].key);
    else $('#viewer-stage').innerHTML = `<p class="viewer__muted">Инструкция пока не добавлена.</p>`;
    openModal($('#viewer-modal'));
  }

  let activeInstrCat = null;
  function renderInstructions() {
    const cats = DATA.instructionCategories || [];
    $('#instructions-empty').hidden = cats.length > 0;
    const chipsEl = $('#instr-chips');
    if (!cats.length) { chipsEl.innerHTML = ''; $('#instr-list').innerHTML = ''; return; }
    if (!activeInstrCat || !cats.some((c) => c.id === activeInstrCat)) activeInstrCat = cats[0].id;
    chipsEl.innerHTML = cats.map((c) => `<button class="chip ${c.id === activeInstrCat ? 'chip--active' : ''}" data-cat="${c.id}" role="tab">${esc(c.name)}<span class="chip__count">${(c.items || []).length}</span></button>`).join('');
    $$('#instr-chips .chip').forEach((ch) => ch.addEventListener('click', () => { activeInstrCat = ch.dataset.cat; renderInstructions(); }));
    renderInstrList(cats);
  }
  function renderInstrList(cats) {
    const cat = cats.find((c) => c.id === activeInstrCat);
    const listEl = $('#instr-list');
    const items = (cat && cat.items) || [];
    if (!items.length) { listEl.innerHTML = '<p class="empty-note">В этой категории пока нет инструкций.</p>'; return; }
    listEl.innerHTML = items.map((it) => {
      const kinds = [];
      if (it.videoUrl) kinds.push('видео'); if (it.text && it.text.trim()) kinds.push('текст'); if (it.pdf) kinds.push('PDF');
      return `<button class="instr-row reveal" data-cat="${cat.id}" data-item="${it.id}">
        <span class="instr-row__body"><span class="instr-row__title">${esc(it.title)}</span><span class="instr-row__meta">${kinds.join(' · ')}</span></span>
        <span class="instr-row__chev">→</span></button>`;
    }).join('');
    $$('#instr-list .instr-row').forEach((row) => row.addEventListener('click', () => {
      const c = cats.find((x) => x.id === row.dataset.cat);
      const it = c && c.items.find((x) => x.id === row.dataset.item);
      if (it) openViewer(it.title, it);
    }));
    initReveal();
  }

  function initLeadForm() {
    const form = $('#lead-form');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const phone = $('#lead-phone').value.trim(), city = $('#lead-city').value.trim(), comment = $('#lead-comment').value.trim();
      const status = $('#lead-status'), btn = $('#lead-submit');
      if (phone.replace(/\D/g, '').length < 5) { status.textContent = 'Укажите корректный номер телефона.'; status.className = 'wholesale__status error'; return; }
      btn.disabled = true; status.textContent = 'Отправляем…'; status.className = 'wholesale__status';
      try {
        const res = await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, city, comment }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Не удалось отправить');
        form.reset(); status.textContent = 'Готово! Менеджер свяжется с вами в ближайшее время.'; status.className = 'wholesale__status success';
      } catch (err) { status.textContent = err.message; status.className = 'wholesale__status error'; }
      finally { btn.disabled = false; }
    });
  }

  function renderContacts() {
    const c = DATA.contacts || {};
    $('#contacts-note').textContent = c.note || '';
    $('#contacts-note').style.display = c.note ? '' : 'none';
    const items = [];
    if (c.address) items.push({ label: 'Адрес', value: esc(c.address) });
    if (c.phone) items.push({ label: 'Телефон', value: `<a href="tel:${esc(c.phone.replace(/[^+\d]/g, ''))}">${esc(c.phone)}</a>` });
    if (c.email) items.push({ label: 'E-mail', value: `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` });
    if (c.telegram) items.push({ label: 'Telegram', value: `<a href="${esc(normalizeLink(c.telegram, 'https://t.me/'))}" target="_blank" rel="noopener">${esc(c.telegram)}</a>` });
    if (c.whatsapp) items.push({ label: 'WhatsApp', value: `<a href="${esc(normalizeLink(c.whatsapp, 'https://wa.me/'))}" target="_blank" rel="noopener">${esc(c.whatsapp)}</a>` });
    if (c.hours) items.push({ label: 'Часы работы', value: esc(c.hours) });
    $('#contacts-grid').innerHTML = items.map((it) => `<div class="contact-card reveal"><div class="contact-card__label">${it.label}</div><div class="contact-card__value">${it.value}</div></div>`).join('');
  }

  function renderSocials() {
    const socials = (DATA.socials || []).filter((s) => s.icon);
    const fab = $('#social-fab'), listEl = $('#social-fab-list');
    if (!socials.length) { fab.hidden = true; return; }
    fab.hidden = false;
    listEl.innerHTML = socials.map((s) => `<a class="social-fab__item" href="${esc(s.url || '#')}" target="_blank" rel="noopener" title="${esc(s.label || '')}"><img src="${esc(s.icon)}" alt="${esc(s.label || 'соцсеть')}" /></a>`).join('');
  }

  function loadCart() { try { const raw = localStorage.getItem(CART_KEY); const a = raw ? JSON.parse(raw) : []; return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function saveCart() { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) {} }
  function cartCount() { return cart.reduce((s, it) => s + it.qty, 0); }
  function cartTotal() { return cart.reduce((s, it) => s + priceNumber(it.price) * it.qty, 0); }
  function updateCartCount() {
    const el = $('#cart-count'), n = cartCount();
    el.textContent = n; el.hidden = n === 0;
    $('#cart-btn').classList.toggle('has-items', n > 0);
  }
  function addToCart(id) {
    const p = (DATA.products || []).find((x) => x.id === id);
    if (!p) return;
    const ex = cart.find((it) => it.id === id);
    if (ex) ex.qty += 1;
    else cart.push({ id: p.id, name: p.name, price: p.price, currency: p.currency || '₽', image: (p.images && p.images[0]) || '', qty: 1 });
    saveCart(); updateCartCount(); flashCartBtn(); toast(`«${p.name}» добавлен в корзину`);
  }
  function setQty(id, qty) { const it = cart.find((x) => x.id === id); if (!it) return; it.qty = Math.max(1, Math.min(999, qty)); saveCart(); updateCartCount(); renderCart(); }
  function removeItem(id) { cart = cart.filter((x) => x.id !== id); saveCart(); updateCartCount(); renderCart(); }
  function flashCartBtn() { const b = $('#cart-btn'); b.classList.remove('pulse'); void b.offsetWidth; b.classList.add('pulse'); }

  let checkoutMode = false;
  function openCart() { checkoutMode = false; renderCart(); openModal($('#cart-modal')); trackEvent('cart'); }
  function renderCart() {
    const body = $('#cart-modal-body');
    if (!cart.length) {
      body.innerHTML = `<div class="cart"><h2 class="cart__title">Корзина</h2><p class="cart__empty">Корзина пуста. Добавьте товары из каталога.</p><button class="btn btn--ghost" data-close>Вернуться к покупкам</button></div>`;
      return;
    }
    const cur = cart[0].currency || '₽';
    const rows = cart.map((it) => `
      <div class="cart-row">
        <div class="cart-row__img" style="${it.image ? `background-image:url('${esc(it.image)}')` : ''}"></div>
        <div class="cart-row__main"><div class="cart-row__name">${esc(it.name)}</div><div class="cart-row__price">${it.price ? formatPrice(it.price, it.currency) : 'Цена по запросу'}</div></div>
        <div class="cart-row__qty"><button class="qty-btn" data-act="dec" data-id="${it.id}">−</button><span class="qty-val">${it.qty}</span><button class="qty-btn" data-act="inc" data-id="${it.id}">+</button></div>
        <button class="cart-row__del" data-id="${it.id}" aria-label="Удалить">×</button>
      </div>`).join('');
    if (!checkoutMode) {
      body.innerHTML = `<div class="cart"><h2 class="cart__title">Корзина</h2><div class="cart__list">${rows}</div>
        <div class="cart__summary"><span>Итого${cartTotal() ? '' : ' (уточняется)'}:</span><strong class="cart__total">${cartTotal() ? formatSum(cartTotal(), cur) : '—'}</strong></div>
        <div class="cart__actions"><button class="btn btn--ghost" data-close>Продолжить покупки</button><button class="btn btn--primary" id="cart-checkout">Оформить заказ</button></div></div>`;
      $('#cart-checkout').addEventListener('click', () => { checkoutMode = true; renderCart(); });
    } else {
      body.innerHTML = `<div class="cart"><h2 class="cart__title">Оформление заказа</h2>
        <div class="cart__mini">${cart.length} тов. на сумму <strong>${cartTotal() ? formatSum(cartTotal(), cur) : 'по запросу'}</strong></div>
        <form class="checkout" id="checkout-form">
          <label class="field-label">Имя*</label><input class="winput" id="co-name" placeholder="Как к вам обращаться" required />
          <label class="field-label">Телефон*</label><input class="winput" id="co-phone" type="tel" placeholder="+7 (900) 000-00-00" required />
          <label class="field-label">Способ получения</label>
          <div class="radio-row">
            <label class="radio"><input type="radio" name="delivery" value="pickup" checked /> <span>Самовывоз</span></label>
            <label class="radio"><input type="radio" name="delivery" value="delivery" /> <span>Доставка</span></label>
          </div>
          <div id="delivery-fields" hidden>
            <label class="field-label">Город</label><input class="winput" id="co-city" placeholder="Город" />
            <label class="field-label">Улица, дом, квартира</label><input class="winput" id="co-street" placeholder="Адрес доставки" />
          </div>
          <label class="field-label">Комментарий</label><textarea class="winput winput--area" id="co-comment" placeholder="Необязательно"></textarea>
          <p class="checkout__status" id="co-status"></p>
          <div class="cart__actions"><button type="button" class="btn btn--ghost" id="co-back">Назад</button><button type="submit" class="btn btn--primary" id="co-submit">Оформить заказ</button></div>
        </form></div>`;
      $$('#checkout-form input[name="delivery"]').forEach((r) => r.addEventListener('change', () => {
        $('#delivery-fields').hidden = $('#checkout-form input[name="delivery"]:checked').value !== 'delivery';
      }));
      $('#co-back').addEventListener('click', () => { checkoutMode = false; renderCart(); });
      $('#checkout-form').addEventListener('submit', submitOrder);
    }
    $$('#cart-modal-body .qty-btn').forEach((b) => b.addEventListener('click', () => {
      const it = cart.find((x) => x.id === b.dataset.id); if (!it) return;
      setQty(b.dataset.id, it.qty + (b.dataset.act === 'inc' ? 1 : -1));
    }));
    $$('#cart-modal-body .cart-row__del').forEach((b) => b.addEventListener('click', () => removeItem(b.dataset.id)));
  }
  async function submitOrder(e) {
    e.preventDefault();
    const name = $('#co-name').value.trim(), phone = $('#co-phone').value.trim();
    const method = $('#checkout-form input[name="delivery"]:checked').value, status = $('#co-status');
    if (!name) { status.textContent = 'Укажите имя.'; status.className = 'checkout__status error'; return; }
    if (phone.replace(/\D/g, '').length < 5) { status.textContent = 'Укажите корректный телефон.'; status.className = 'checkout__status error'; return; }
    const payload = {
      name, phone,
      delivery: { method, city: method === 'delivery' ? $('#co-city').value.trim() : '', street: method === 'delivery' ? $('#co-street').value.trim() : '' },
      comment: $('#co-comment').value.trim(),
      items: cart.map((it) => ({ id: it.id, name: it.name, price: it.price, currency: it.currency, qty: it.qty })),
      total: cartTotal()
    };
    if (method === 'delivery' && !payload.delivery.city) { status.textContent = 'Укажите город доставки.'; status.className = 'checkout__status error'; return; }
    const btn = $('#co-submit'); btn.disabled = true; status.textContent = 'Отправляем заказ…'; status.className = 'checkout__status';
    try {
      const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Не удалось оформить заказ');
      cart = []; saveCart(); updateCartCount();
      $('#cart-modal-body').innerHTML = `<div class="cart cart--done"><div class="cart__check">✓</div><h2 class="cart__title">Заказ оформлен!</h2>
        <p class="cart__done-text">Спасибо, ${esc(name)}! Менеджер скоро свяжется с вами для уточнения деталей${method === 'delivery' ? ' доставки' : ''}.</p>
        <button class="btn btn--primary" data-close>Отлично</button></div>`;
    } catch (err) { status.textContent = err.message; status.className = 'checkout__status error'; btn.disabled = false; }
  }

  let toastTimer;
  function toast(msg) {
    let t = $('#site-toast');
    if (!t) { t = document.createElement('div'); t.id = 'site-toast'; t.className = 'site-toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
  }

  function openModal(m) { m.classList.add('open'); m.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden'; }
  function closeModal(m) {
    m.classList.remove('open'); m.setAttribute('aria-hidden', 'true'); document.body.style.overflow = '';
    const body = m.querySelector('.modal__body'); if (body && m.id !== 'cart-modal') body.innerHTML = '';
  }
  $$('.modal').forEach((m) => m.addEventListener('click', (e) => { if (e.target.matches('[data-close]') || e.target.closest('[data-close]')) closeModal(m); }));
  document.addEventListener('keydown', (e) => {
    const lb = document.getElementById('zoom-box');
    if (lb && lb.classList.contains('open')) {
      if (e.key === 'ArrowLeft') return lbGo(-1);
      if (e.key === 'ArrowRight') return lbGo(1);
    }
    if (e.key === 'Escape') { closeZoom(); $$('.modal.open').forEach(closeModal); }
  });

  let lbImages = [], lbIdx = 0;
  function openLightbox(images, start) {
    lbImages = (images || []).filter(Boolean);
    if (!lbImages.length) return;
    lbIdx = Math.max(0, Math.min(start || 0, lbImages.length - 1));
    let box = document.getElementById('zoom-box');
    if (!box) {
      box = document.createElement('div');
      box.id = 'zoom-box';
      box.className = 'zoom-box';
      box.innerHTML =
        '<button class="zoom-box__close" aria-label="Закрыть">×</button>' +
        '<button class="zoom-box__nav zoom-box__nav--prev" aria-label="Предыдущее"><svg viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
        '<img class="zoom-box__img" alt="" />' +
        '<button class="zoom-box__nav zoom-box__nav--next" aria-label="Следующее"><svg viewBox="0 0 24 24" fill="none"><path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
        '<div class="zoom-box__count"></div>';
      document.body.appendChild(box);
      box.addEventListener('click', (e) => {
        if (e.target === box || e.target.closest('.zoom-box__close')) return closeZoom();
        if (e.target.closest('.zoom-box__nav--prev')) return lbGo(-1);
        if (e.target.closest('.zoom-box__nav--next')) return lbGo(1);
      });
      let sx = 0;
      box.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
      box.addEventListener('touchend', (e) => { const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) lbGo(dx < 0 ? 1 : -1); });
    }
    lbRender();
    box.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function lbRender() {
    const box = document.getElementById('zoom-box');
    if (!box) return;
    box.querySelector('.zoom-box__img').src = lbImages[lbIdx];
    const multi = lbImages.length > 1;
    box.querySelectorAll('.zoom-box__nav').forEach((n) => { n.style.display = multi ? '' : 'none'; });
    const count = box.querySelector('.zoom-box__count');
    count.textContent = multi ? (lbIdx + 1) + ' / ' + lbImages.length : '';
    count.style.display = multi ? '' : 'none';
  }
  function lbGo(d) { lbIdx = (lbIdx + d + lbImages.length) % lbImages.length; lbRender(); }
  function openZoom(src) { openLightbox([src], 0); }
  function closeZoom() {
    const box = document.getElementById('zoom-box');
    if (box) box.classList.remove('open');
    if (!document.querySelector('.modal.open')) document.body.style.overflow = '';
  }

  function trackEvent(type) {
    try {
      const body = { type };
      if (type === 'visit') {
        if (localStorage.getItem('spx_counted') !== '1') { body.unique = true; localStorage.setItem('spx_counted', '1'); }
      }
      fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true }).catch(() => {});
    } catch (e) {}
  }
  function trackVisit() {
    try {
      if (sessionStorage.getItem('spx_visit') === '1') return;
      sessionStorage.setItem('spx_visit', '1');
    } catch (e) {}
    trackEvent('visit');
  }

  const nav = $('#nav');
  window.addEventListener('scroll', () => { nav.classList.toggle('nav--scrolled', window.scrollY > 30); }, { passive: true });
  const burger = $('#burger'), navLinks = $('#nav-links');
  function closeMobileNav() { burger.classList.remove('open'); navLinks.classList.remove('open'); }
  burger.addEventListener('click', () => { burger.classList.toggle('open'); navLinks.classList.toggle('open'); });
  $$('#nav-links a').forEach((a) => a.addEventListener('click', closeMobileNav));
  $('#nav-catalog-btn').addEventListener('click', (e) => { e.stopPropagation(); const dd = $('#nav-catalog-dd'); dd.classList.contains('open') ? closeCatalogDropdown() : openCatalogDropdown(); });
  document.addEventListener('click', (e) => { if (!e.target.closest('#nav-catalog-dd')) closeCatalogDropdown(); });
  $('#cart-btn').addEventListener('click', openCart);

  function toggleFab() {
    const fab = $('#social-fab'); const open = fab.classList.toggle('open');
    $('#social-fab-toggle').setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  $('#social-fab-toggle').addEventListener('click', toggleFab);
  const fabLabel = document.querySelector('.social-fab__label');
  if (fabLabel) fabLabel.addEventListener('click', toggleFab);

  function siteSearch(term) {
    term = (term || '').trim().toLowerCase();
    const box = $('#site-search-results');
    if (!box) return;
    if (!term) { box.innerHTML = '<div class="search-overlay__hint">Начните вводить название товара</div>'; return; }
    const list = (DATA.products || []).filter((p) => p.published !== false).filter((p) => {
      return (p.name || '').toLowerCase().includes(term) || (p.brand || '').toLowerCase().includes(term);
    }).slice(0, 12);
    if (!list.length) { box.innerHTML = '<div class="search-overlay__hint">Ничего не найдено</div>'; return; }
    box.innerHTML = list.map((p) => `<a class="search-result" href="/product/${esc(p.slug || '')}/">
      <div class="search-result__img" style="${p.images && p.images[0] ? `background-image:url('${esc(p.images[0])}')` : ''}"></div>
      <div class="search-result__info"><div class="search-result__name">${esc(p.name)}</div>
      <div class="search-result__meta">${p.brand ? esc(p.brand) + ' · ' : ''}${p.price ? formatPrice(p.price, p.currency) : 'Цена по запросу'}</div></div></a>`).join('');
  }
  function openSearch() {
    const ov = $('#search-overlay'); if (!ov) return;
    ov.classList.add('open'); ov.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden';
    const inp = $('#site-search-input'); siteSearch(inp.value); setTimeout(() => inp.focus(), 50);
  }
  function closeSearch() {
    const ov = $('#search-overlay'); if (!ov) return;
    ov.classList.remove('open'); ov.setAttribute('aria-hidden', 'true');
    if (!document.querySelector('.modal.open')) document.body.style.overflow = '';
  }
  const searchBtn = $('#nav-search-btn');
  if (searchBtn) searchBtn.addEventListener('click', openSearch);
  const siteInput = $('#site-search-input');
  if (siteInput) siteInput.addEventListener('input', () => siteSearch(siteInput.value));
  $$('[data-search-close]').forEach((el) => el.addEventListener('click', closeSearch));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSearch(); });

  let bpTimer;
  window.addEventListener('resize', () => {
    clearTimeout(bpTimer);
    bpTimer = setTimeout(() => {
      if (!DATA) return;
      const wasMobile = slider.variant === 'mobile', isMobile = window.matchMedia('(max-width: 680px)').matches;
      if (wasMobile !== isMobile) renderBanners();
    }, 250);
  });

  let observer;
  function initReveal() {
    if (!observer) observer = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.style.opacity = 1; en.target.style.transform = 'none'; observer.unobserve(en.target); } });
    }, { threshold: 0.12 });
    $$('.reveal').forEach((el) => {
      if (el.dataset.revealed) return;
      el.dataset.revealed = '1'; el.style.opacity = 0; el.style.transform = 'translateY(22px)'; el.style.transition = 'opacity .6s ease, transform .6s ease';
      observer.observe(el);
    });
  }

  $('#year').textContent = new Date().getFullYear();
  initLeadForm();
  loadData();
  trackVisit();
})();
