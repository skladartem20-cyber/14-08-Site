'use strict';

const TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
  й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '',
  э: 'e', ю: 'yu', я: 'ya'
};

function slugify(str) {
  const src = String(str || '').toLowerCase().trim();
  let out = '';
  for (const ch of src) out += TRANSLIT[ch] !== undefined ? TRANSLIT[ch] : ch;
  return out
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 80) || 'item';
}

function ensureUniqueSlug(base, taken) {
  let slug = base;
  let i = 2;
  while (taken.has(slug)) slug = base + '-' + i++;
  return slug;
}

function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
function escXml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
function jsonLd(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}
function baseUrl(req) {
  const env = (process.env.SITE_URL || '').trim().replace(/\/+$/, '');
  if (env) return env;
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
  return proto + '://' + req.get('host');
}
function abs(base, url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return base + (url.startsWith('/') ? '' : '/') + url;
}

function priceNumber(p) {
  const d = String(p == null ? '' : p).replace(/[^\d]/g, '');
  return d ? parseInt(d, 10) : 0;
}
function formatPrice(price, currency) {
  const n = priceNumber(price);
  if (!n) return '';
  return n.toLocaleString('ru-RU') + ' ' + (currency || '₽');
}
function isPublished(x) { return x && x.published !== false; }

function catUrl(base, c) { return base + '/catalog/' + c.slug + '/'; }
function prodUrl(base, p) { return base + '/product/' + p.slug + '/'; }

function availabilityText(a) {
  if (a === 'preorder') return 'Под заказ';
  if (a === 'out') return 'Нет в наличии';
  return 'В наличии';
}
function availabilitySchema(a) {
  if (a === 'preorder') return 'https://schema.org/PreOrder';
  if (a === 'out') return 'https://schema.org/OutOfStock';
  return 'https://schema.org/InStock';
}

function seoTitleFor(entity, fallback) {
  return (entity.seoTitle && entity.seoTitle.trim()) ? entity.seoTitle.trim() : fallback;
}
function seoDescFor(entity, fallback) {
  return (entity.seoDescription && entity.seoDescription.trim()) ? entity.seoDescription.trim() : fallback;
}

function navHtml(data, base) {
  const site = data.site || {};
  const title = esc(site.title || 'SPACEXTEN');
  const cats = (data.productCategories || []).filter(isPublished);
  const menu = cats.map((c) => `<a class="nav__menu-item" href="${esc(catUrl(base, c))}">${esc(c.name)}</a>`).join('');
  return `
  <header class="nav" id="nav">
    <div class="nav__inner container">
      <a href="/" class="nav__brand"><span class="nav__name">${title}</span></a>
      <nav class="nav__links" id="nav-links">
        <div class="nav__dropdown" id="nav-catalog-dd">
          <a class="nav__pill nav__dropbtn" href="/catalog/">Каталог <span class="nav__caret">▾</span></a>
          <div class="nav__menu">${menu || '<span class="nav__menu-item">Скоро</span>'}</div>
        </div>
        <a class="nav__pill" href="/#about">О компании</a>
        <a class="nav__pill" href="/#wholesale">Оптовый прайс</a>
        <a class="nav__pill" href="/#instructions">Инструкции</a>
        <a class="nav__pill" href="/#contacts">Контакты</a>
      </nav>
      <div class="nav__right">
        <button class="nav__icon-btn" id="nav-search-btn" aria-label="Поиск по сайту"><svg viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/><path d="M21 21l-4.3-4.3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
        <button class="cart-btn" id="cart-btn" aria-label="Корзина">Корзина<span class="cart-btn__count" id="cart-count" hidden>0</span></button>
        <button class="nav__burger" id="burger" aria-label="Меню"><span></span><span></span><span></span></button>
      </div>
    </div>
  </header>`;
}

function footerHtml(data) {
  return `
  <footer class="footer"><div class="container footer__inner"><span>© ${new Date().getFullYear()} ${esc((data.site && data.site.title) || 'SPACEXTEN')}</span></div></footer>
  <div class="social-fab" id="social-fab" hidden><div class="social-fab__list" id="social-fab-list"></div>
  <button class="social-fab__toggle" id="social-fab-toggle" aria-label="Связаться с нами" aria-expanded="false"><span class="social-fab__icon">✕</span><span class="social-fab__icon social-fab__icon--open"><svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></span></button></div>
  <div class="search-overlay" id="search-overlay" aria-hidden="true"><div class="search-overlay__backdrop" data-search-close></div>
  <div class="search-overlay__panel" role="dialog" aria-modal="true"><div class="search-overlay__bar">
  <svg class="search-overlay__icon" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/><path d="M21 21l-4.3-4.3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
  <input type="search" id="site-search-input" class="search-overlay__input" placeholder="Поиск товара по названию или бренду..." autocomplete="off" />
  <button class="search-overlay__close" data-search-close aria-label="Закрыть">×</button></div>
  <div class="search-overlay__results" id="site-search-results"></div></div></div>
  <div class="modal" id="cart-modal" aria-hidden="true"><div class="modal__backdrop" data-close></div>
  <div class="modal__dialog modal__dialog--cart" role="dialog" aria-modal="true"><button class="modal__close" data-close aria-label="Закрыть">×</button><div class="modal__body" id="cart-modal-body"></div></div></div>`;
}

function shell(opts) {
  const { data, title, description, canonical, jsonLdBlocks = [], bodyContent, ogImage, ogType = 'website', base } = opts;
  const site = data.site || {};
  const siteData = {
    title: site.title || 'SPACEXTEN',
    colors: site.colors || {},
    currency: '₽',
    socials: (data.socials || []).filter((s) => s.icon).map((s) => ({ icon: s.icon, url: s.url, label: s.label }))
  };
  const ldTags = jsonLdBlocks.map((b) => `<script type="application/ld+json">${jsonLd(b)}</script>`).join('\n');
  const og = ogImage ? `<meta property="og:image" content="${esc(ogImage)}" />` : '';
  return `<!DOCTYPE html>
<html lang="ru" data-theme="light">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<link rel="canonical" href="${esc(canonical)}" />
<meta property="og:type" content="${esc(ogType)}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${esc(canonical)}" />
<meta property="og:site_name" content="${esc(site.title || 'SPACEXTEN')}" />
${og}
<meta name="twitter:card" content="summary_large_image" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="icon" href="/favicon.ico" sizes="any" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="/css/styles.css" />
${ldTags}
</head>
<body>
${navHtml(data, base)}
<main class="ssr-main">
${bodyContent}
</main>
${footerHtml(data)}
<script>window.__SITE__=${jsonLd(siteData)};</script>
<script src="/js/page.js" defer></script>
</body>
</html>`;
}

function breadcrumbTrail(items) {
  return `<nav class="breadcrumb" aria-label="Хлебные крошки">${items.map((it, i) =>
    it.url ? `<a href="${esc(it.url)}">${esc(it.name)}</a>${i < items.length - 1 ? '<span class="breadcrumb__sep">/</span>' : ''}`
      : `<span>${esc(it.name)}</span>`).join('')}</nav>`;
}
function breadcrumbLd(items, base) {
  return {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem', position: i + 1, name: it.name,
      item: it.url ? (it.url.startsWith('http') ? it.url : base + it.url) : undefined
    }))
  };
}

function productCard(p, base) {
  const img = (p.images && p.images[0]) || '';
  const price = formatPrice(p.price, p.currency);
  const url = prodUrl(base, p);
  const plaque = p.badge === 'best' ? '<span class="card__plaque card__plaque--best">Лучший выбор</span>'
    : p.badge === 'sale' ? '<span class="card__plaque card__plaque--sale">Распродажа</span>' : '';
  return `<a class="card" href="${esc(url)}" data-id="${esc(p.id)}" aria-label="${esc(p.name)}">
    ${plaque}
    <div class="card__gallery">
      <div class="card__layer active${img ? '' : ' card__layer--empty'}" ${img ? `style="background-image:url('${esc(img)}')"` : ''}></div>
    </div>
    <div class="card__info">
      <h3 class="card__name">${esc(p.name)}</h3>
      ${price ? `<div class="card__price">${esc(price)}</div>` : '<div class="card__price card__price--na">Цена по запросу</div>'}
    </div>
  </a>`;
}

function renderCatalogIndex(data, base) {
  const url = base + '/catalog/';
  const cats = (data.productCategories || []).filter(isPublished);
  const title = 'Каталог оборудования — ' + esc((data.site && data.site.title) || 'SPACEXTEN');
  const description = 'Каталог: ' + (cats.length ? cats.map((c) => c.name).join(', ') : 'оборудование и запчасти') + '. Выберите категорию, чтобы посмотреть товары.';
  const crumbs = [{ name: 'Главная', url: '/' }, { name: 'Каталог' }];
  const catCards = cats.map((c) => {
    const img = c.image || '';
    const count = (data.products || []).filter((p) => p.categoryId === c.id && isPublished(p)).length;
    return `<a class="cat-card" href="${esc(catUrl(base, c))}">
      <div class="cat-card__img"${img ? ` style="background-image:url('${esc(img)}')"` : ''}></div>
      <div class="cat-card__body"><h2 class="cat-card__title">${esc(c.name)}</h2>
      <span class="cat-card__count">${count} товаров</span></div></a>`;
  }).join('');
  const body = `<div class="container ssr-page">
    ${breadcrumbTrail(crumbs)}
    <h1 class="ssr-h1">Каталог</h1>
    <p class="ssr-lead">Выберите категорию оборудования.</p>
    <div class="cat-grid">${catCards || '<p class="empty-note">Категории скоро появятся.</p>'}</div>
  </div>`;
  return shell({
    data, base, title, description, canonical: url, ogType: 'website',
    jsonLdBlocks: [breadcrumbLd(crumbs, base)],
    bodyContent: body
  });
}

function renderCategoryPage(data, cat, base) {
  const url = catUrl(base, cat);
  const products = (data.products || []).filter((p) => p.categoryId === cat.id && isPublished(p));
  const title = seoTitleFor(cat, cat.name + ' — купить в ' + ((data.site && data.site.title) || 'SPACEXTEN'));
  const fallbackDesc = (cat.description && cat.description.trim())
    ? cat.description.trim().slice(0, 300)
    : `${cat.name}: ${products.length ? products.length + ' товаров' : 'каталог'} с доставкой. Характеристики, цены и наличие.`;
  const description = seoDescFor(cat, fallbackDesc);
  const crumbs = [{ name: 'Главная', url: '/' }, { name: 'Каталог', url: '/catalog/' }, { name: cat.name }];
  const brands = [...new Set(products.map((p) => (p.brand || '').trim()).filter(Boolean))];
  const subs = (cat.subcategories || []);
  const filters = (brands.length || subs.length) ? `<div class="cat-filters" id="cat-filters">
    ${brands.length ? `<div class="cat-filters__group"><span class="cat-filters__label">Бренд:</span>
      <button class="subchip subchip--active" data-brand="__all">Все</button>
      ${brands.map((b) => `<button class="subchip" data-brand="${esc(b)}">${esc(b)}</button>`).join('')}</div>` : ''}
  </div>` : '';
  const grid = products.length
    ? `<div class="catalog-grid" id="cat-products">${products.map((p) => productCard(p, base)).join('')}</div>`
    : '<p class="empty-note">Товары в этой категории скоро появятся.</p>';
  const seoText = (cat.description && cat.description.trim())
    ? `<div class="ssr-seo-text">${esc(cat.description.trim()).replace(/\n/g, '<br>')}</div>` : '';
  const body = `<div class="container ssr-page">
    ${breadcrumbTrail(crumbs)}
    <h1 class="ssr-h1">${esc(cat.name)}</h1>
    ${cat.description ? `<p class="ssr-lead">${esc(cat.description.trim().slice(0, 180))}</p>` : ''}
    ${filters}
    ${grid}
    ${seoText}
  </div>`;
  const ld = [breadcrumbLd(crumbs, base), {
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: cat.name, description, url,
    hasPart: products.slice(0, 30).map((p) => ({ '@type': 'Product', name: p.name, url: prodUrl(base, p) }))
  }];
  return shell({
    data, base, title, description, canonical: url, ogType: 'website',
    ogImage: cat.image ? abs(base, cat.image) : '',
    jsonLdBlocks: ld, bodyContent: body
  });
}

function renderProductPage(data, product, base) {
  const url = prodUrl(base, product);
  const cat = (data.productCategories || []).find((c) => c.id === product.categoryId);
  const site = (data.site && data.site.title) || 'SPACEXTEN';
  const price = formatPrice(product.price, product.currency);
  const priceNum = priceNumber(product.price);
  const title = seoTitleFor(product, product.name + (cat ? ' — ' + cat.name : '') + ' | ' + site);
  const baseDesc = (product.description && product.description.trim())
    ? product.description.trim().replace(/\s+/g, ' ').slice(0, 300)
    : `${product.name}${product.brand ? ', бренд ' + product.brand : ''}${price ? ', цена ' + price : ''}. Характеристики, наличие, доставка.`;
  const description = seoDescFor(product, baseDesc);
  const imgs = (product.images || []);
  const crumbs = [{ name: 'Главная', url: '/' }, { name: 'Каталог', url: '/catalog/' }];
  if (cat) crumbs.push({ name: cat.name, url: '/catalog/' + cat.slug + '/' });
  crumbs.push({ name: product.name });

  const specs = Array.isArray(product.specs) ? product.specs.filter((s) => s && s.name) : [];
  const advantages = Array.isArray(product.advantages) ? product.advantages.filter(Boolean) : [];
  const related = (product.relatedIds || [])
    .map((id) => (data.products || []).find((x) => x.id === id && isPublished(x)))
    .filter(Boolean);

  const thumbs = imgs.length > 1 ? `<div class="pm__thumbs">${imgs.map((s, i) =>
    `<button class="pm__thumb ${i === 0 ? 'active' : ''}" data-src="${esc(s)}" style="background-image:url('${esc(s)}')"></button>`).join('')}</div>` : '';
  const specHtml = specs.length ? `<div class="pd__block"><h2 class="pd__h2">Характеристики</h2>
    <table class="spec-table"><tbody>${specs.map((s) =>
      `<tr><td>${esc(s.name)}</td><td>${esc(s.value)}</td></tr>`).join('')}</tbody></table></div>` : '';
  const advHtml = advantages.length ? `<div class="pd__block"><h2 class="pd__h2">Преимущества</h2>
    <ul class="adv-list">${advantages.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></div>` : '';
  const descHtml = (product.description && product.description.trim())
    ? `<div class="pd__block"><h2 class="pd__h2">Описание</h2><div class="pd__desc">${esc(product.description.trim()).replace(/\n/g, '<br>')}</div></div>` : '';
  const relatedHtml = related.length ? `<div class="pd__block"><h2 class="pd__h2">Запчасти для этого товара</h2>
    <div class="catalog-grid">${related.map((r) => productCard(r, base)).join('')}</div></div>` : '';

  const meta = [];
  if (product.brand) meta.push(`<div class="pd__meta-row"><span>Бренд</span><b>${esc(product.brand)}</b></div>`);
  if (product.sku) meta.push(`<div class="pd__meta-row"><span>Артикул</span><b>${esc(product.sku)}</b></div>`);
  meta.push(`<div class="pd__meta-row"><span>Наличие</span><b class="pd__avail pd__avail--${esc(product.availability || 'in_stock')}">${esc(availabilityText(product.availability))}</b></div>`);

  const body = `<div class="container ssr-page">
    ${breadcrumbTrail(crumbs)}
    <div class="pd">
      <div class="pd__media">
        <div class="pm__main ${imgs[0] ? 'pm__main--zoomable' : ''}" id="pm-main" data-src="${esc(imgs[0] || '')}" ${imgs[0] ? `style="background-image:url('${esc(imgs[0])}')"` : ''}>${imgs[0] ? '<span class="pm__zoom-hint">⤢</span>' : ''}</div>
        ${thumbs}
      </div>
      <div class="pd__info">
        <h1 class="ssr-h1 pd__title">${esc(product.name)}</h1>
        ${price ? `<div class="pd__price">${esc(price)}</div>` : '<div class="pd__price pd__price--na">Цена по запросу</div>'}
        <div class="pd__meta">${meta.join('')}</div>
        <button class="btn btn--primary pd__buy" id="pd-buy" data-id="${esc(product.id)}" data-name="${esc(product.name)}" data-price="${esc(product.price)}" data-currency="${esc(product.currency)}" data-image="${esc(imgs[0] || '')}">Добавить в корзину</button>
        ${cat ? `<a class="pd__cat-link" href="${esc('/catalog/' + cat.slug + '/')}">← Все товары категории «${esc(cat.name)}»</a>` : ''}
      </div>
    </div>
    ${descHtml}
    ${specHtml}
    ${advHtml}
    ${relatedHtml}
  </div>
  <div class="pd-sticky">
    <div class="pd-sticky__price">${price ? esc(price) : 'Цена по запросу'}</div>
    <button class="btn btn--primary pd-sticky__btn card__buy" data-id="${esc(product.id)}" data-name="${esc(product.name)}" data-price="${esc(product.price)}" data-currency="${esc(product.currency)}" data-image="${esc(imgs[0] || '')}">В корзину</button>
  </div>`;

  const productLd = {
    '@context': 'https://schema.org', '@type': 'Product',
    name: product.name, url,
    description: (product.description && product.description.trim()) ? product.description.trim().slice(0, 500) : description
  };
  if (imgs.length) productLd.image = imgs.map((i) => abs(base, i));
  if (product.brand) productLd.brand = { '@type': 'Brand', name: product.brand };
  if (product.sku) productLd.sku = product.sku;
  if (cat) productLd.category = cat.name;
  if (priceNum > 0) {
    productLd.offers = {
      '@type': 'Offer', url, priceCurrency: 'RUB', price: priceNum,
      availability: availabilitySchema(product.availability),
      itemCondition: 'https://schema.org/NewCondition'
    };
  }
  const ld = [breadcrumbLd(crumbs, base), productLd];
  return shell({
    data, base, title, description, canonical: url, ogType: 'product',
    ogImage: imgs[0] ? abs(base, imgs[0]) : '',
    jsonLdBlocks: ld, bodyContent: body
  });
}

function render404(data, base, what) {
  const body = `<div class="container ssr-page ssr-404">
    <h1 class="ssr-h1">Страница не найдена</h1>
    <p class="ssr-lead">${esc(what || 'Такой страницы не существует или она была удалена.')}</p>
    <div class="ssr-404__actions"><a class="btn btn--primary" href="/">На главную</a>
    <a class="btn btn--ghost" href="/catalog/">В каталог</a></div>
  </div>`;
  return shell({
    data, base, title: 'Страница не найдена — ' + ((data.site && data.site.title) || 'SPACEXTEN'),
    description: 'Страница не найдена.', canonical: base + '/', bodyContent: body
  });
}

function renderSitemap(data, base) {
  const urls = [
    { loc: base + '/', priority: '1.0', freq: 'daily' },
    { loc: base + '/catalog/', priority: '0.9', freq: 'daily' }
  ];
  (data.productCategories || []).filter(isPublished).forEach((c) => {
    urls.push({ loc: catUrl(base, c), priority: '0.8', freq: 'weekly' });
  });
  (data.products || []).filter(isPublished).forEach((p) => {
    urls.push({ loc: prodUrl(base, p), priority: '0.7', freq: 'weekly', lastmod: p.updatedAt || p.createdAt });
  });
  const body = urls.map((u) => `  <url><loc>${escXml(u.loc)}</loc>` +
    (u.lastmod ? `<lastmod>${new Date(u.lastmod).toISOString().slice(0, 10)}</lastmod>` : '') +
    `<changefreq>${u.freq}</changefreq><priority>${u.priority}</priority></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>`;
}

function renderRobots(base) {
  return `User-agent: *
Allow: /
Disallow: /aaddmm
Disallow: /api/
Disallow: /uploads/

Sitemap: ${base}/sitemap.xml
`;
}

function renderHomeHead(data, base) {
  const site = data.site || {};
  const about = data.about || {};
  const title = site.title || 'SPACEXTEN';
  const desc = (site.metaDescription && site.metaDescription.trim())
    || (about.text ? about.text.trim().replace(/\s+/g, ' ').slice(0, 200)
      : 'Профессиональное оборудование, запчасти и сервис. Каталог с доставкой.');
  const url = base + '/';
  const ogImg = (site.header && '') || (data.header && (data.header.image || data.header.logo)) || '';
  const org = {
    '@context': 'https://schema.org', '@type': 'Organization',
    name: title, url,
    logo: data.header && data.header.logo ? abs(base, data.header.logo) : undefined
  };
  const contacts = data.contacts || {};
  if (contacts.phone) org.contactPoint = { '@type': 'ContactPoint', telephone: contacts.phone, contactType: 'sales' };
  const website = { '@context': 'https://schema.org', '@type': 'WebSite', name: title, url };
  const webpage = { '@context': 'https://schema.org', '@type': 'WebPage', name: title, url, description: desc };
  return [
    `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(desc)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:site_name" content="${esc(title)}" />`,
    ogImg ? `<meta property="og:image" content="${esc(abs(base, ogImg))}" />` : '',
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<script type="application/ld+json">${jsonLd(org)}</script>`,
    `<script type="application/ld+json">${jsonLd(website)}</script>`,
    `<script type="application/ld+json">${jsonLd(webpage)}</script>`
  ].filter(Boolean).join('\n');
}

module.exports = {
  slugify, ensureUniqueSlug, baseUrl,
  renderCatalogIndex, renderCategoryPage, renderProductPage, render404,
  renderSitemap, renderRobots, renderHomeHead
};
