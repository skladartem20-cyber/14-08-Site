'use strict';

const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const storage = require('./storage.js');
const seo = require('./seo.js');
const telegram = require('./telegram.js');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);

const PORT = process.env.PORT || 80;
const ADMIN_LOGIN = process.env.ADMIN_LOGIN || 'SP2026';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || 'c03d8f2cd80de023dc0038ffdbf03206:b2b5694da1eeed2ee00a661b75a8ad1063e418866fed2f580eb9af0dc669bd754249fe76fa7a94ea00762d64e69e31fbc911639ab830c528e693e2a392b28ac0';
const EFFECTIVE_PASSWORD_HASH = (() => {
  const plain = (process.env.ADMIN_PASSWORD || '').trim();
  if (plain) {
    const salt = crypto.randomBytes(16).toString('hex');
    return salt + ':' + crypto.scryptSync(plain, salt, 64).toString('hex');
  }
  return ADMIN_PASSWORD_HASH;
})();
const ADMIN_PATH = process.env.ADMIN_PATH || '/aaddmm';
const MAX_LOGIN_ATTEMPTS = 3;
const LOCK_MS = 24 * 60 * 60 * 1000;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const BACKUP_KEEP = 30;
const LOGIN_LOG_KEEP = 200;

const SEED = {
  site: {
    title: 'SPACEXTEN',
    accent: '#3b82f6',
    theme: 'light',
    orderUrl: '',
    sliderRatio: '1600/250',
    colors: { grad1: '#2563eb', grad2: '#0ea5c4', sub1: '#f59e0b', sub2: '#f97316' }
  },
  header: {
    image: '',
    logo: '',
    badge: 'Профессиональное оборудование',
    title: 'SPACEXTEN',
    subtitle: 'Техника, запчасти и сервис для тех, кто ценит надёжность.'
  },
  banners: {
    desktop: [],
    mobile: []
  },
  about: {
    title: 'О компании',
    text: 'SPACEXTEN — поставщик профессионального оборудования и комплектующих. Мы подбираем технику под задачу, обеспечиваем оригинальными запчастями и сопровождаем подробными инструкциями по эксплуатации. Работаем с частными клиентами и бизнесом.',
    features: [
      { title: 'Оригинальные запчасти', text: 'Полная совместимость с вашей техникой.' },
      { title: 'Гарантия и сервис', text: 'Поддержка на всём сроке эксплуатации.' },
      { title: 'Видео и PDF инструкции', text: 'Понятные материалы к каждому товару.' }
    ]
  },
  productCategories: [],
  products: [],
  instructionCategories: [],
  leads: [],
  orders: [],
  socials: [],
  layout: [
    { type: 'section', key: 'about' },
    { type: 'section', key: 'catalog' },
    { type: 'section', key: 'wholesale' },
    { type: 'section', key: 'instructions' },
    { type: 'section', key: 'contacts' }
  ],
  sectionText: {
    catalog: { eyebrow: 'Продукция', title: 'Каталог', lead: 'Выберите категорию и добавляйте товары в корзину. Нажмите на карточку, чтобы увидеть фото, цену, запчасти и инструкцию.' },
    wholesale: { eyebrow: 'Оптом', title: 'Нужен оптовый прайс-лист?', lead: 'Оставьте номер телефона — менеджер свяжется с вами, ответит на вопросы и пришлёт актуальные оптовые цены.' },
    instructions: { eyebrow: 'Поддержка', title: 'Инструкции', lead: 'Выберите категорию, затем нужную инструкцию — откроется видео, текст или PDF.' },
    contacts: { eyebrow: 'Связь', title: 'Контакты', lead: '' }
  },
  contacts: {
    address: 'г. Москва, ул. Примерная, д. 1',
    phone: '+7 (900) 000-00-00',
    email: 'info@spacexten.ru',
    telegram: '',
    whatsapp: '',
    hours: 'Пн–Пт: 9:00–19:00',
    note: 'Свяжитесь с нами любым удобным способом — поможем подобрать оборудование.'
  },
  analytics: { visits: 0, unique: 0, cartOpens: 0 },
  security: { failedAttempts: 0, lockUntil: 0 },
  loginLog: [],
  backupMeta: { last: 0 },
  telegram: { notifyOrders: true, notifyLeads: true }
};

function normalize(d) {
  d = d && typeof d === 'object' ? d : {};
  d.site = Object.assign({ title: 'SPACEXTEN', accent: '#3b82f6', theme: 'light', orderUrl: '', sliderRatio: '1600/250' }, d.site || {});
  d.site.theme = d.site.theme === 'dark' ? 'dark' : 'light';
  if (typeof d.site.sliderRatio !== 'string' || !/^\d+\s*\/\s*\d+$/.test(d.site.sliderRatio)) d.site.sliderRatio = '1600/250';
  d.site.carouselSpeed = Math.min(160, Math.max(8, Number(d.site.carouselSpeed) || 40));
  const hex = (v, def) => (typeof v === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) ? v : def;
  d.site.colors = d.site.colors && typeof d.site.colors === 'object' ? d.site.colors : {};
  d.site.colors = {
    grad1: hex(d.site.colors.grad1, '#2563eb'),
    grad2: hex(d.site.colors.grad2, '#0ea5c4'),
    sub1: hex(d.site.colors.sub1, '#f59e0b'),
    sub2: hex(d.site.colors.sub2, '#f97316')
  };
  d.header = Object.assign({ image: '', logo: '', badge: '', title: 'SPACEXTEN', subtitle: '' }, d.header || {});
  d.banners = Object.assign({ desktop: [], mobile: [] }, d.banners || {});
  if (!Array.isArray(d.banners.desktop)) d.banners.desktop = [];
  if (!Array.isArray(d.banners.mobile)) d.banners.mobile = [];
  d.about = Object.assign({ title: 'О компании', text: '', features: [] }, d.about || {});
  if (!Array.isArray(d.about.features)) d.about.features = [];
  d.productCategories = Array.isArray(d.productCategories) ? d.productCategories : [];
  const catSlugs = new Set();
  d.productCategories.forEach((c) => {
    c.id = c.id || crypto.randomUUID();
    c.name = c.name || 'Без названия';
    c.subcategories = Array.isArray(c.subcategories) ? c.subcategories : [];
    c.subcategories.forEach((s) => { s.id = s.id || crypto.randomUUID(); s.name = s.name || 'Без названия'; });
    let base = (typeof c.slug === 'string' && c.slug.trim()) ? seo.slugify(c.slug) : seo.slugify(c.name);
    c.slug = seo.ensureUniqueSlug(base, catSlugs);
    catSlugs.add(c.slug);
    c.description = typeof c.description === 'string' ? c.description : '';
    c.image = typeof c.image === 'string' ? c.image : '';
    c.seoTitle = typeof c.seoTitle === 'string' ? c.seoTitle : '';
    c.seoDescription = typeof c.seoDescription === 'string' ? c.seoDescription : '';
    c.published = c.published !== false;
  });
  d.products = Array.isArray(d.products) ? d.products : [];
  const prodSlugs = new Set();
  d.products.forEach((p) => {
    p.id = p.id || crypto.randomUUID();
    p.name = p.name || 'Без названия';
    p.description = p.description || '';
    p.price = p.price == null ? '' : p.price;
    p.currency = p.currency || '₽';
    p.categoryId = p.categoryId || '';
    p.subcategoryId = p.subcategoryId || '';
    p.badge = ['best', 'sale'].includes(p.badge) ? p.badge : '';
    p.images = Array.isArray(p.images) ? p.images : [];
    p.relatedIds = Array.isArray(p.relatedIds) ? p.relatedIds : [];
    p.linkedInstructionId = p.linkedInstructionId || '';
    p.orderUrl = p.orderUrl || '';
    p.instruction = p.instruction || {};
    p.instruction.videoUrl = p.instruction.videoUrl || '';
    p.instruction.text = p.instruction.text || '';
    p.instruction.pdf = p.instruction.pdf || '';
    let pbase = (typeof p.slug === 'string' && p.slug.trim()) ? seo.slugify(p.slug) : seo.slugify(p.name);
    p.slug = seo.ensureUniqueSlug(pbase, prodSlugs);
    prodSlugs.add(p.slug);
    p.brand = typeof p.brand === 'string' ? p.brand : '';
    p.sku = typeof p.sku === 'string' ? p.sku : '';
    p.availability = ['in_stock', 'out', 'preorder'].includes(p.availability) ? p.availability : 'in_stock';
    p.specs = Array.isArray(p.specs) ? p.specs.filter((s) => s && typeof s === 'object').map((s) => ({ name: String(s.name || ''), value: String(s.value || '') })) : [];
    p.advantages = Array.isArray(p.advantages) ? p.advantages.map((a) => String(a || '')).filter(Boolean) : [];
    p.seoTitle = typeof p.seoTitle === 'string' ? p.seoTitle : '';
    p.seoDescription = typeof p.seoDescription === 'string' ? p.seoDescription : '';
    p.published = p.published !== false;
    p.createdAt = p.createdAt || Date.now();
    p.updatedAt = p.updatedAt || p.createdAt;
  });
  d.instructionCategories = Array.isArray(d.instructionCategories) ? d.instructionCategories : [];
  d.instructionCategories.forEach((c) => {
    c.id = c.id || crypto.randomUUID();
    c.name = c.name || 'Категория';
    c.items = Array.isArray(c.items) ? c.items : [];
    c.items.forEach((it) => {
      it.id = it.id || crypto.randomUUID();
      it.title = it.title || 'Без названия';
      it.videoUrl = it.videoUrl || '';
      it.text = it.text || '';
      it.pdf = it.pdf || '';
    });
  });
  d.leads = Array.isArray(d.leads) ? d.leads : [];
  d.orders = Array.isArray(d.orders) ? d.orders : [];
  d.orders.forEach((o) => {
    o.id = o.id || crypto.randomUUID();
    o.name = o.name || '';
    o.phone = o.phone || '';
    o.delivery = o.delivery && typeof o.delivery === 'object' ? o.delivery : { method: 'pickup', city: '', street: '' };
    o.delivery.method = o.delivery.method === 'delivery' ? 'delivery' : 'pickup';
    o.delivery.city = o.delivery.city || '';
    o.delivery.street = o.delivery.street || '';
    o.items = Array.isArray(o.items) ? o.items : [];
    o.total = o.total || 0;
    o.comment = o.comment || '';
    o.status = o.status || 'new';
    o.createdAt = o.createdAt || Date.now();
  });

  d.socials = Array.isArray(d.socials) ? d.socials : [];
  d.socials.forEach((s) => {
    s.id = s.id || crypto.randomUUID();
    s.icon = s.icon || '';
    s.url = s.url || '';
    s.label = s.label || '';
  });

  const stDef = {
    catalog: { eyebrow: 'Продукция', title: 'Каталог', lead: '' },
    wholesale: { eyebrow: 'Оптом', title: 'Нужен оптовый прайс-лист?', lead: '' },
    instructions: { eyebrow: 'Поддержка', title: 'Инструкции', lead: '' },
    contacts: { eyebrow: 'Связь', title: 'Контакты', lead: '' }
  };
  d.sectionText = d.sectionText && typeof d.sectionText === 'object' ? d.sectionText : {};
  Object.keys(stDef).forEach((k) => {
    d.sectionText[k] = Object.assign({}, stDef[k], d.sectionText[k] || {});
  });

  const SECTION_KEYS = ['about', 'catalog', 'wholesale', 'instructions', 'contacts'];
  let layout = Array.isArray(d.layout) ? d.layout : [];
  const seen = new Set();
  const clean = [];
  layout.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    if (item.type === 'section' && SECTION_KEYS.includes(item.key) && !seen.has(item.key)) {
      seen.add(item.key);
      clean.push({ type: 'section', key: item.key });
    } else if (item.type === 'banner') {
      clean.push({
        type: 'banner',
        id: item.id || crypto.randomUUID(),
        mode: item.mode === 'slider' ? 'slider' : 'static',
        images: Array.isArray(item.images) ? item.images.filter((x) => typeof x === 'string') : []
      });
    }
  });
  SECTION_KEYS.forEach((k) => { if (!seen.has(k)) clean.push({ type: 'section', key: k }); });
  d.layout = clean;

  d.contacts = Object.assign(
    { address: '', phone: '', email: '', telegram: '', whatsapp: '', hours: '', note: '' },
    d.contacts || {}
  );

  d.analytics = Object.assign({ visits: 0, unique: 0, cartOpens: 0 }, d.analytics || {});
  ['visits', 'unique', 'cartOpens'].forEach((k) => { d.analytics[k] = Number(d.analytics[k]) || 0; });
  d.security = Object.assign({ failedAttempts: 0, lockUntil: 0 }, d.security || {});
  d.security.failedAttempts = Number(d.security.failedAttempts) || 0;
  d.security.lockUntil = Number(d.security.lockUntil) || 0;
  d.loginLog = Array.isArray(d.loginLog) ? d.loginLog.slice(-LOGIN_LOG_KEEP) : [];
  d.backupMeta = Object.assign({ last: 0 }, d.backupMeta || {});
  d.backupMeta.last = Number(d.backupMeta.last) || 0;
  d.telegram = Object.assign({ notifyOrders: true, notifyLeads: true }, d.telegram || {});
  d.telegram.notifyOrders = d.telegram.notifyOrders !== false;
  d.telegram.notifyLeads = d.telegram.notifyLeads !== false;
  return d;
}

let DB = null;
let persistTimer = null;
let persistPending = false;
let persisting = false;

function readData() {
  return DB;
}

function schedulePersist() {
  persistPending = true;
  if (persistTimer) return;
  persistTimer = setTimeout(flushPersist, 400);
}

async function flushPersist() {
  persistTimer = null;
  if (persisting) { schedulePersist(); return; }
  if (!persistPending) return;
  persistPending = false;
  persisting = true;
  try {
    await storage.saveData(DB);
  } catch (e) {
    persistPending = true;
    console.error('Ошибка сохранения данных:', e.message);
  } finally {
    persisting = false;
    if (persistPending && !persistTimer) persistTimer = setTimeout(flushPersist, 800);
  }
}

function writeData(data) {
  DB = data || DB;
  schedulePersist();
  return DB;
}

function deleteUploaded(url) {
  if (!url || typeof url !== 'string' || !url.startsWith('/uploads/')) return;
  storage.deleteUploadUrl(url).catch(() => {});
}

const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'avif', 'bmp'];
function fileExt(name) {
  const m = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : '';
}
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 15 },
  fileFilter: (req, file, cb) => {
    const ext = fileExt(file.originalname);
    if (file.fieldname === 'pdf') return ext === 'pdf' ? cb(null, true) : cb(new Error('Допускается только PDF-файл'));
    return IMAGE_EXT.includes(ext) ? cb(null, true) : cb(new Error('Недопустимый тип файла'));
  }
});
async function storeFiles(files) {
  const out = [];
  for (const f of files || []) out.push(await storage.putUpload(f));
  return out;
}

const sessions = new Map();

function clientIp(req) {
  return (req.ip || (req.socket && req.socket.remoteAddress) || '').replace(/^::ffff:/, '') || 'unknown';
}
function timingSafeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}
function verifyPassword(password) {
  const [salt, hash] = String(EFFECTIVE_PASSWORD_HASH).split(':');
  if (!salt || !hash) return false;
  let derived;
  try { derived = crypto.scryptSync(String(password), salt, 64).toString('hex'); }
  catch (e) { return false; }
  return timingSafeEqual(derived, hash);
}
function issueToken() {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  return token;
}
function validToken(token) {
  if (!token || !sessions.has(token)) return false;
  if (Date.now() > sessions.get(token)) { sessions.delete(token); return false; }
  return true;
}
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (validToken(token)) return next();
  return res.status(401).json({ error: 'Требуется авторизация' });
}
function logAttempt(ip, login, success, reason) {
  DB.loginLog.push({ time: Date.now(), ip: String(ip).slice(0, 64), login: String(login || '').slice(0, 64), success: !!success, reason: reason || '' });
  if (DB.loginLog.length > LOGIN_LOG_KEEP) DB.loginLog = DB.loginLog.slice(-LOGIN_LOG_KEEP);
}

const rateBuckets = new Map();
function rateLimit(max, windowMs) {
  return (req, res, next) => {
    const key = clientIp(req) + ':' + req.path;
    const now = Date.now();
    let b = rateBuckets.get(key);
    if (!b || now > b.reset) { b = { count: 0, reset: now + windowMs }; rateBuckets.set(key, b); }
    b.count += 1;
    if (b.count > max) return res.status(429).json({ error: 'Слишком много запросов. Попробуйте позже.' });
    next();
  };
}
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of rateBuckets) if (now > b.reset) rateBuckets.delete(k);
  for (const [t, exp] of sessions) if (now > exp) sessions.delete(t);
}, 10 * 60 * 1000).unref();

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "img-src 'self' data: blob:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "script-src 'self'",
    "frame-src 'self' https://www.youtube.com https://player.vimeo.com",
    "media-src 'self' https: blob:",
    "connect-src 'self'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; '));
  next();
});

app.use(express.json({ limit: '30mb' }));

app.get('/uploads/:name', async (req, res) => {
  try {
    const file = await storage.readUpload(req.params.name);
    if (!file) return res.status(404).end();
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.end(file.buffer);
  } catch (e) {
    res.status(500).end();
  }
});

let INDEX_HTML = '';
try { INDEX_HTML = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8'); } catch (e) { INDEX_HTML = ''; }

app.get('/', (req, res) => {
  if (!INDEX_HTML) return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  const head = seo.renderHomeHead(readData(), seo.baseUrl(req));
  res.type('html').send(INDEX_HTML.replace('</head>', head + '\n</head>'));
});

app.use(express.static(path.join(__dirname, 'public'), { dotfiles: 'ignore' }));

app.get('/api/data', (req, res) => {
  const { leads, orders, analytics, security, loginLog, backupMeta, telegram: tg, ...pub } = readData();
  res.json(pub);
});

app.post('/api/orders', (req, res) => {
  const body = req.body || {};
  const name = String(body.name || '').trim();
  const phone = String(body.phone || '').trim();
  if (!name) return res.status(400).json({ error: 'Укажите имя' });
  if (!phone || phone.replace(/\D/g, '').length < 5) {
    return res.status(400).json({ error: 'Укажите корректный номер телефона' });
  }
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) return res.status(400).json({ error: 'Корзина пуста' });

  const data = readData();
  const cleanItems = items.slice(0, 200).map((it) => ({
    id: String(it.id || ''),
    name: String(it.name || '').slice(0, 200),
    price: String(it.price == null ? '' : it.price).slice(0, 40),
    currency: String(it.currency || '₽').slice(0, 8),
    qty: Math.max(1, Math.min(999, parseInt(it.qty, 10) || 1))
  }));
  const method = body.delivery && body.delivery.method === 'delivery' ? 'delivery' : 'pickup';
  const order = {
    id: crypto.randomUUID(),
    name: name.slice(0, 120),
    phone: phone.slice(0, 40),
    delivery: {
      method,
      city: method === 'delivery' ? String((body.delivery && body.delivery.city) || '').trim().slice(0, 120) : '',
      street: method === 'delivery' ? String((body.delivery && body.delivery.street) || '').trim().slice(0, 200) : ''
    },
    comment: String(body.comment || '').trim().slice(0, 1000),
    items: cleanItems,
    total: Number(body.total) || 0,
    status: 'new',
    createdAt: Date.now()
  };
  data.orders.unshift(order);
  writeData(data);
  if (data.telegram.notifyOrders) notifyOrder(order);
  res.json({ ok: true });
});

app.post('/api/leads', (req, res) => {
  const { phone, city, comment } = req.body || {};
  const cleanPhone = String(phone || '').trim();
  if (!cleanPhone || cleanPhone.replace(/\D/g, '').length < 5) {
    return res.status(400).json({ error: 'Укажите корректный номер телефона' });
  }
  const data = readData();
  const lead = {
    id: crypto.randomUUID(),
    phone: cleanPhone.slice(0, 40),
    city: String(city || '').trim().slice(0, 120),
    comment: String(comment || '').trim().slice(0, 1000),
    createdAt: Date.now()
  };
  data.leads.unshift(lead);
  writeData(data);
  if (data.telegram.notifyLeads) notifyLead(lead);
  res.json({ ok: true });
});

function tgEsc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function fmtMoney(n, cur) {
  const v = Number(n) || 0;
  return v ? v.toLocaleString('ru-RU') + ' ' + (cur || '₽') : '';
}
function notifyOrder(order) {
  const lines = [];
  lines.push('🛒 <b>Новый заказ</b>');
  lines.push('👤 Имя: <b>' + tgEsc(order.name) + '</b>');
  lines.push('📞 Телефон: <b>' + tgEsc(order.phone) + '</b>');
  if (order.delivery && order.delivery.method === 'delivery') {
    lines.push('🚚 Доставка: ' + tgEsc([order.delivery.city, order.delivery.street].filter(Boolean).join(', ')));
  } else {
    lines.push('🏬 Самовывоз');
  }
  if (order.comment) lines.push('💬 Комментарий: ' + tgEsc(order.comment));
  lines.push('');
  lines.push('<b>Состав заказа:</b>');
  (order.items || []).forEach((it) => {
    const sum = it.price ? ' — ' + tgEsc(it.price) + ' ' + tgEsc(it.currency || '₽') : '';
    lines.push('• ' + tgEsc(it.name) + ' × ' + it.qty + sum);
  });
  if (order.total) lines.push('\n💰 <b>Итого: ' + tgEsc(fmtMoney(order.total, (order.items[0] && order.items[0].currency) || '₽')) + '</b>');
  telegram.sendMessage(lines.join('\n')).catch(() => {});
}
function notifyLead(lead) {
  const lines = [];
  lines.push('📩 <b>Новая заявка (оптовый прайс)</b>');
  lines.push('📞 Телефон: <b>' + tgEsc(lead.phone) + '</b>');
  if (lead.city) lines.push('🏙 Город: ' + tgEsc(lead.city));
  if (lead.comment) lines.push('💬 Комментарий: ' + tgEsc(lead.comment));
  telegram.sendMessage(lines.join('\n')).catch(() => {});
}

app.post('/api/login', rateLimit(12, 60 * 1000), (req, res) => {
  const ip = clientIp(req);
  const now = Date.now();
  const sec = DB.security;
  const login = String((req.body && req.body.login) || '');
  const password = String((req.body && req.body.password) || '');

  if (sec.lockUntil && now < sec.lockUntil) {
    logAttempt(ip, login, false, 'locked');
    writeData(DB);
    return res.status(429).json({ error: 'Вход заблокирован из-за превышения числа попыток. Повторите позже.', lockUntil: sec.lockUntil });
  }

  const ok = timingSafeEqual(login, ADMIN_LOGIN) && verifyPassword(password);
  if (!ok) {
    sec.failedAttempts = (sec.failedAttempts || 0) + 1;
    let reason = 'bad_credentials';
    if (sec.failedAttempts >= MAX_LOGIN_ATTEMPTS) { sec.lockUntil = now + LOCK_MS; reason = 'locked'; }
    logAttempt(ip, login, false, reason);
    writeData(DB);
    if (sec.lockUntil > now) {
      return res.status(429).json({ error: 'Превышено число попыток. Вход заблокирован на 24 часа.', lockUntil: sec.lockUntil });
    }
    const left = Math.max(0, MAX_LOGIN_ATTEMPTS - sec.failedAttempts);
    return res.status(401).json({ error: `Неверный логин или пароль. Осталось попыток: ${left}.` });
  }

  sec.failedAttempts = 0;
  sec.lockUntil = 0;
  logAttempt(ip, login, true, 'ok');
  writeData(DB);
  res.json({ token: issueToken() });
});

app.post('/api/logout', requireAuth, (req, res) => {
  const token = (req.headers.authorization || '').slice(7);
  sessions.delete(token);
  res.json({ ok: true });
});

app.get('/api/me', requireAuth, (req, res) => res.json({ ok: true }));

app.post('/api/track', rateLimit(120, 60 * 1000), (req, res) => {
  const type = req.body && req.body.type;
  const a = DB.analytics;
  if (type === 'visit') { a.visits += 1; if (req.body.unique) a.unique += 1; }
  else if (type === 'cart') { a.cartOpens += 1; }
  else return res.status(400).json({ error: 'Неизвестное событие' });
  schedulePersist();
  res.json({ ok: true });
});

app.get('/api/analytics', requireAuth, (req, res) => res.json(DB.analytics));

app.get('/api/telegram/status', requireAuth, (req, res) => {
  res.json(Object.assign({}, telegram.status(), {
    notifyOrders: DB.telegram.notifyOrders,
    notifyLeads: DB.telegram.notifyLeads
  }));
});

app.put('/api/telegram', requireAuth, (req, res) => {
  const data = readData();
  if (req.body.notifyOrders !== undefined) data.telegram.notifyOrders = req.body.notifyOrders === true || req.body.notifyOrders === 'true';
  if (req.body.notifyLeads !== undefined) data.telegram.notifyLeads = req.body.notifyLeads === true || req.body.notifyLeads === 'true';
  writeData(data);
  res.json({ ok: true, notifyOrders: data.telegram.notifyOrders, notifyLeads: data.telegram.notifyLeads });
});

app.post('/api/telegram/test', requireAuth, async (req, res) => {
  if (!telegram.configured()) return res.status(400).json({ ok: false, error: 'Не заданы TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID в переменных окружения.' });
  const result = await telegram.sendMessage('✅ <b>SPACEXTEN</b>\nТестовое сообщение. Уведомления о заказах и заявках подключены.');
  if (result.ok) res.json({ ok: true });
  else res.status(502).json({ ok: false, error: result.error || 'Не удалось отправить' });
});
app.get('/api/login-log', requireAuth, (req, res) => {
  res.json({ log: DB.loginLog.slice().reverse(), security: DB.security });
});

app.put('/api/site', requireAuth, (req, res) => {
  const data = readData();
  const { theme, accent, orderUrl, title, sliderRatio, carouselSpeed } = req.body || {};
  if (theme === 'dark' || theme === 'light') data.site.theme = theme;
  if (typeof accent === 'string' && accent) data.site.accent = accent;
  if (typeof orderUrl === 'string') data.site.orderUrl = orderUrl.trim();
  if (typeof title === 'string' && title.trim()) data.site.title = title.trim();
  if (typeof sliderRatio === 'string' && /^\d+\s*\/\s*\d+$/.test(sliderRatio)) data.site.sliderRatio = sliderRatio;
  if (carouselSpeed !== undefined) data.site.carouselSpeed = Math.min(160, Math.max(8, Number(carouselSpeed) || 40));
  const colors = req.body && req.body.colors;
  if (colors && typeof colors === 'object') {
    const hex = (v, cur) => (typeof v === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) ? v : cur;
    data.site.colors = {
      grad1: hex(colors.grad1, data.site.colors.grad1),
      grad2: hex(colors.grad2, data.site.colors.grad2),
      sub1: hex(colors.sub1, data.site.colors.sub1),
      sub2: hex(colors.sub2, data.site.colors.sub2)
    };
  }
  writeData(data);
  res.json(data.site);
});

app.get('/api/leads', requireAuth, (req, res) => {
  res.json(readData().leads);
});

app.delete('/api/leads/:id', requireAuth, (req, res) => {
  const data = readData();
  const before = data.leads.length;
  data.leads = data.leads.filter((l) => l.id !== req.params.id);
  if (data.leads.length === before) return res.status(404).json({ error: 'Заявка не найдена' });
  writeData(data);
  res.json({ ok: true });
});

app.get('/api/orders', requireAuth, (req, res) => {
  res.json(readData().orders);
});

app.delete('/api/orders/:id', requireAuth, (req, res) => {
  const data = readData();
  const before = data.orders.length;
  data.orders = data.orders.filter((o) => o.id !== req.params.id);
  if (data.orders.length === before) return res.status(404).json({ error: 'Заказ не найден' });
  writeData(data);
  res.json({ ok: true });
});

app.get('/api/export', (req, res) => {
  const token = (req.query && req.query.token) || ((req.headers.authorization || '').startsWith('Bearer ') ? req.headers.authorization.slice(7) : '');
  if (!validToken(token)) return res.status(401).json({ error: 'Требуется авторизация' });
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="spacexten-backup.json"');
  res.send(JSON.stringify(readData(), null, 2));
});

app.post('/api/import', requireAuth, (req, res) => {
  try {
    let incoming = req.body && req.body.data !== undefined ? req.body.data : req.body;
    if (typeof incoming === 'string') incoming = JSON.parse(incoming);
    if (!incoming || typeof incoming !== 'object') {
      return res.status(400).json({ error: 'Некорректный файл данных' });
    }
    writeData(normalize(incoming));
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: 'Не удалось прочитать файл: ' + (e.message || 'ошибка') });
  }
});

app.put('/api/header', requireAuth, (req, res) => {
  const data = readData();
  const { badge, title, subtitle } = req.body || {};
  data.header.badge = badge ?? data.header.badge;
  data.header.title = title ?? data.header.title;
  data.header.subtitle = subtitle ?? data.header.subtitle;
  writeData(data);
  res.json(data.header);
});

app.post('/api/header/image', requireAuth, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не получен' });
  const data = readData();
  deleteUploaded(data.header.image);
  data.header.image = await storage.putUpload(req.file);
  writeData(data);
  res.json(data.header);
});

app.delete('/api/header/image', requireAuth, (req, res) => {
  const data = readData();
  deleteUploaded(data.header.image);
  data.header.image = '';
  writeData(data);
  res.json(data.header);
});

app.post('/api/header/logo', requireAuth, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не получен' });
  const data = readData();
  deleteUploaded(data.header.logo);
  data.header.logo = await storage.putUpload(req.file);
  writeData(data);
  res.json(data.header);
});

app.delete('/api/header/logo', requireAuth, (req, res) => {
  const data = readData();
  deleteUploaded(data.header.logo);
  data.header.logo = '';
  writeData(data);
  res.json(data.header);
});

app.post('/api/socials', requireAuth, upload.single('icon'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Загрузите иконку' });
  const url = String((req.body && req.body.url) || '').trim();
  const label = String((req.body && req.body.label) || '').trim();
  const data = readData();
  const social = { id: crypto.randomUUID(), icon: await storage.putUpload(req.file), url, label };
  data.socials.push(social);
  writeData(data);
  res.json(data.socials);
});

app.put('/api/socials/:id', requireAuth, (req, res) => {
  const data = readData();
  const s = data.socials.find((x) => x.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Не найдено' });
  if (typeof req.body.url === 'string') s.url = req.body.url.trim();
  if (typeof req.body.label === 'string') s.label = req.body.label.trim();
  writeData(data);
  res.json(data.socials);
});

app.delete('/api/socials/:id', requireAuth, (req, res) => {
  const data = readData();
  const s = data.socials.find((x) => x.id === req.params.id);
  if (s) deleteUploaded(s.icon);
  data.socials = data.socials.filter((x) => x.id !== req.params.id);
  writeData(data);
  res.json(data.socials);
});

app.put('/api/section-text', requireAuth, (req, res) => {
  const data = readData();
  const body = req.body || {};
  ['catalog', 'wholesale', 'instructions', 'contacts'].forEach((k) => {
    if (body[k] && typeof body[k] === 'object') {
      data.sectionText[k] = Object.assign({}, data.sectionText[k], {
        eyebrow: typeof body[k].eyebrow === 'string' ? body[k].eyebrow : data.sectionText[k].eyebrow,
        title: typeof body[k].title === 'string' ? body[k].title : data.sectionText[k].title,
        lead: typeof body[k].lead === 'string' ? body[k].lead : data.sectionText[k].lead
      });
    }
  });
  writeData(data);
  res.json(data.sectionText);
});

const SECTION_KEYS = ['about', 'catalog', 'wholesale', 'instructions', 'contacts'];

app.put('/api/layout', requireAuth, (req, res) => {
  const order = Array.isArray(req.body && req.body.order) ? req.body.order : [];
  const data = readData();
  const bannerById = {};
  data.layout.forEach((it) => { if (it.type === 'banner') bannerById[it.id] = it; });
  const seen = new Set();
  const next = [];
  order.forEach((it) => {
    if (!it || typeof it !== 'object') return;
    if (it.type === 'section' && SECTION_KEYS.includes(it.key) && !seen.has(it.key)) {
      seen.add(it.key); next.push({ type: 'section', key: it.key });
    } else if (it.type === 'banner' && bannerById[it.id]) {
      next.push(bannerById[it.id]);
      delete bannerById[it.id];
    }
  });
  SECTION_KEYS.forEach((k) => { if (!seen.has(k)) next.push({ type: 'section', key: k }); });
  Object.values(bannerById).forEach((b) => (b.images || []).forEach(deleteUploaded));
  data.layout = next;
  writeData(data);
  res.json(data.layout);
});

app.post('/api/layout/banner', requireAuth, upload.array('images', 8), async (req, res) => {
  const mode = (req.body && req.body.mode) === 'slider' ? 'slider' : 'static';
  const files = req.files || [];
  if (!files.length) return res.status(400).json({ error: 'Загрузите хотя бы одно изображение' });
  const data = readData();
  const block = { type: 'banner', id: crypto.randomUUID(), mode, images: await storeFiles(files) };
  data.layout.push(block);
  writeData(data);
  res.json(data.layout);
});

app.delete('/api/layout/banner/:id', requireAuth, (req, res) => {
  const data = readData();
  const b = data.layout.find((x) => x.type === 'banner' && x.id === req.params.id);
  if (b) (b.images || []).forEach(deleteUploaded);
  data.layout = data.layout.filter((x) => !(x.type === 'banner' && x.id === req.params.id));
  writeData(data);
  res.json(data.layout);
});

app.post('/api/banners/:variant', requireAuth, upload.single('image'), async (req, res) => {
  const variant = req.params.variant;
  if (!['desktop', 'mobile'].includes(variant)) return res.status(400).json({ error: 'Неверный тип баннера' });
  if (!req.file) return res.status(400).json({ error: 'Файл не получен' });
  const data = readData();
  if (data.banners[variant].length >= 8) return res.status(400).json({ error: 'Максимум 8 баннеров' });
  data.banners[variant].push(await storage.putUpload(req.file));
  writeData(data);
  res.json(data.banners);
});

app.delete('/api/banners/:variant', requireAuth, (req, res) => {
  const variant = req.params.variant;
  if (!['desktop', 'mobile'].includes(variant)) return res.status(400).json({ error: 'Неверный тип баннера' });
  const { url } = req.body || {};
  const data = readData();
  data.banners[variant] = data.banners[variant].filter((u) => u !== url);
  deleteUploaded(url);
  writeData(data);
  res.json(data.banners);
});

app.put('/api/about', requireAuth, (req, res) => {
  const data = readData();
  const { title, text, features } = req.body || {};
  data.about.title = title ?? data.about.title;
  data.about.text = text ?? data.about.text;
  if (Array.isArray(features)) data.about.features = features;
  writeData(data);
  res.json(data.about);
});

app.put('/api/contacts', requireAuth, (req, res) => {
  const data = readData();
  data.contacts = { ...data.contacts, ...(req.body || {}) };
  writeData(data);
  res.json(data.contacts);
});

function uniqueCatSlug(desired, name, excludeId) {
  const taken = new Set((DB.productCategories || []).filter((c) => c.id !== excludeId).map((c) => c.slug));
  return seo.ensureUniqueSlug(seo.slugify(desired && desired.trim() ? desired : name), taken);
}
function uniqueProdSlug(desired, name, excludeId) {
  const taken = new Set((DB.products || []).filter((p) => p.id !== excludeId).map((p) => p.slug));
  return seo.ensureUniqueSlug(seo.slugify(desired && desired.trim() ? desired : name), taken);
}
function applyCategoryFields(cat, body) {
  if (typeof body.description === 'string') cat.description = body.description;
  if (typeof body.seoTitle === 'string') cat.seoTitle = body.seoTitle.trim();
  if (typeof body.seoDescription === 'string') cat.seoDescription = body.seoDescription.trim();
  if (body.published !== undefined) cat.published = body.published === true || body.published === 'true';
}

app.post('/api/product-categories', requireAuth, (req, res) => {
  const data = readData();
  const name = (req.body.name || 'Новая категория').trim();
  const category = {
    id: crypto.randomUUID(), name, subcategories: [],
    slug: uniqueCatSlug(req.body.slug, name, null),
    description: '', image: '', seoTitle: '', seoDescription: '', published: req.body.published === false ? false : true
  };
  applyCategoryFields(category, req.body);
  data.productCategories.push(category);
  writeData(data);
  res.json(category);
});

app.put('/api/product-categories/:id', requireAuth, (req, res) => {
  const data = readData();
  const cat = data.productCategories.find((c) => c.id === req.params.id);
  if (!cat) return res.status(404).json({ error: 'Категория не найдена' });
  if (typeof req.body.name === 'string' && req.body.name.trim()) cat.name = req.body.name.trim();
  if (typeof req.body.slug === 'string' && req.body.slug.trim()) cat.slug = uniqueCatSlug(req.body.slug, cat.name, cat.id);
  applyCategoryFields(cat, req.body);
  writeData(data);
  res.json(cat);
});

app.post('/api/product-categories/:id/image', requireAuth, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не получен' });
  const data = readData();
  const cat = data.productCategories.find((c) => c.id === req.params.id);
  if (!cat) return res.status(404).json({ error: 'Категория не найдена' });
  deleteUploaded(cat.image);
  cat.image = await storage.putUpload(req.file);
  writeData(data);
  res.json(cat);
});

app.delete('/api/product-categories/:id/image', requireAuth, (req, res) => {
  const data = readData();
  const cat = data.productCategories.find((c) => c.id === req.params.id);
  if (!cat) return res.status(404).json({ error: 'Категория не найдена' });
  deleteUploaded(cat.image);
  cat.image = '';
  writeData(data);
  res.json(cat);
});

app.delete('/api/product-categories/:id', requireAuth, (req, res) => {
  const data = readData();
  const idx = data.productCategories.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Категория не найдена' });
  data.productCategories.splice(idx, 1);
  data.products.forEach((p) => { if (p.categoryId === req.params.id) { p.categoryId = ''; p.subcategoryId = ''; } });
  writeData(data);
  res.json({ ok: true });
});

app.post('/api/product-categories/:id/subcategories', requireAuth, (req, res) => {
  const data = readData();
  const cat = data.productCategories.find((c) => c.id === req.params.id);
  if (!cat) return res.status(404).json({ error: 'Категория не найдена' });
  const sub = { id: crypto.randomUUID(), name: (req.body.name || 'Новая подкатегория').trim() };
  cat.subcategories.push(sub);
  writeData(data);
  res.json(cat);
});

app.put('/api/product-categories/:id/subcategories/:subId', requireAuth, (req, res) => {
  const data = readData();
  const cat = data.productCategories.find((c) => c.id === req.params.id);
  if (!cat) return res.status(404).json({ error: 'Категория не найдена' });
  const sub = cat.subcategories.find((s) => s.id === req.params.subId);
  if (!sub) return res.status(404).json({ error: 'Подкатегория не найдена' });
  sub.name = (req.body.name ?? sub.name).trim();
  writeData(data);
  res.json(cat);
});

app.delete('/api/product-categories/:id/subcategories/:subId', requireAuth, (req, res) => {
  const data = readData();
  const cat = data.productCategories.find((c) => c.id === req.params.id);
  if (!cat) return res.status(404).json({ error: 'Категория не найдена' });
  cat.subcategories = cat.subcategories.filter((s) => s.id !== req.params.subId);
  data.products.forEach((p) => { if (p.subcategoryId === req.params.subId) p.subcategoryId = ''; });
  writeData(data);
  res.json(cat);
});

const productUpload = upload.fields([
  { name: 'images', maxCount: 12 },
  { name: 'pdf', maxCount: 1 }
]);

function parseRelated(raw) {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch (e) {
    return [];
  }
}

function cleanBadge(v) {
  return ['best', 'sale'].includes(v) ? v : '';
}

function parseSpecs(raw) {
  if (typeof raw !== 'string') return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((s) => s && typeof s === 'object' && (s.name || s.value))
      .map((s) => ({ name: String(s.name || '').slice(0, 120), value: String(s.value || '').slice(0, 300) }));
  } catch (e) { return []; }
}
function parseAdvantages(raw) {
  if (typeof raw !== 'string') return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map((a) => String(a || '').slice(0, 200)).filter(Boolean) : [];
  } catch (e) { return []; }
}
function cleanAvailability(v) {
  return ['in_stock', 'out', 'preorder'].includes(v) ? v : 'in_stock';
}

app.post('/api/products', requireAuth, productUpload, async (req, res) => {
  const data = readData();
  const files = req.files || {};
  const images = await storeFiles(files.images || []);
  const pdf = files.pdf && files.pdf[0] ? await storage.putUpload(files.pdf[0]) : '';
  const name = (req.body.name || 'Без названия').trim();

  const product = {
    id: crypto.randomUUID(),
    name,
    slug: uniqueProdSlug(req.body.slug, name, null),
    description: req.body.description || '',
    price: req.body.price || '',
    currency: req.body.currency || '₽',
    categoryId: req.body.categoryId || '',
    subcategoryId: req.body.subcategoryId || '',
    brand: (req.body.brand || '').trim(),
    sku: (req.body.sku || '').trim(),
    availability: cleanAvailability(req.body.availability),
    specs: parseSpecs(req.body.specs),
    advantages: parseAdvantages(req.body.advantages),
    seoTitle: (req.body.seoTitle || '').trim(),
    seoDescription: (req.body.seoDescription || '').trim(),
    published: req.body.published === false || req.body.published === 'false' ? false : true,
    badge: cleanBadge(req.body.badge),
    images: images.slice(0, 12),
    relatedIds: parseRelated(req.body.relatedIds),
    linkedInstructionId: (req.body.linkedInstructionId || '').trim(),
    orderUrl: (req.body.orderUrl || '').trim(),
    instruction: { videoUrl: req.body.videoUrl || '', text: req.body.instructionText || '', pdf: pdf },
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  data.products.unshift(product);
  writeData(data);
  res.json(product);
});

app.put('/api/products/:id', requireAuth, productUpload, async (req, res) => {
  const data = readData();
  const product = data.products.find((p) => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'Товар не найден' });

  const files = req.files || {};

  let keepImages = product.images;
  if (typeof req.body.existingImages === 'string') {
    try {
      const parsed = JSON.parse(req.body.existingImages);
      if (Array.isArray(parsed)) keepImages = parsed;
    } catch (e) {}
  }
  for (const img of product.images) {
    if (!keepImages.includes(img)) deleteUploaded(img);
  }
  const newImages = await storeFiles(files.images || []);
  product.images = [...keepImages, ...newImages].slice(0, 12);

  if (files.pdf && files.pdf[0]) {
    deleteUploaded(product.instruction.pdf);
    product.instruction.pdf = await storage.putUpload(files.pdf[0]);
  } else if (req.body.removePdf === 'true') {
    deleteUploaded(product.instruction.pdf);
    product.instruction.pdf = '';
  }

  product.name = (req.body.name ?? product.name).trim();
  if (typeof req.body.slug === 'string' && req.body.slug.trim()) product.slug = uniqueProdSlug(req.body.slug, product.name, product.id);
  product.description = req.body.description ?? product.description;
  product.price = req.body.price ?? product.price;
  product.currency = req.body.currency ?? product.currency;
  if (req.body.categoryId !== undefined) product.categoryId = req.body.categoryId || '';
  if (req.body.subcategoryId !== undefined) product.subcategoryId = req.body.subcategoryId || '';
  if (req.body.brand !== undefined) product.brand = (req.body.brand || '').trim();
  if (req.body.sku !== undefined) product.sku = (req.body.sku || '').trim();
  if (req.body.availability !== undefined) product.availability = cleanAvailability(req.body.availability);
  if (req.body.specs !== undefined) product.specs = parseSpecs(req.body.specs);
  if (req.body.advantages !== undefined) product.advantages = parseAdvantages(req.body.advantages);
  if (req.body.seoTitle !== undefined) product.seoTitle = (req.body.seoTitle || '').trim();
  if (req.body.seoDescription !== undefined) product.seoDescription = (req.body.seoDescription || '').trim();
  if (req.body.published !== undefined) product.published = !(req.body.published === false || req.body.published === 'false');
  if (req.body.badge !== undefined) product.badge = cleanBadge(req.body.badge);
  if (req.body.orderUrl !== undefined) product.orderUrl = (req.body.orderUrl || '').trim();
  if (req.body.linkedInstructionId !== undefined) product.linkedInstructionId = (req.body.linkedInstructionId || '').trim();
  product.instruction.videoUrl = req.body.videoUrl ?? product.instruction.videoUrl;
  if (req.body.instructionText !== undefined) product.instruction.text = req.body.instructionText;
  if (typeof req.body.relatedIds === 'string') product.relatedIds = parseRelated(req.body.relatedIds);
  product.updatedAt = Date.now();

  writeData(data);
  res.json(product);
});

app.delete('/api/products/:id', requireAuth, (req, res) => {
  const data = readData();
  const idx = data.products.findIndex((p) => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Товар не найден' });
  const [removed] = data.products.splice(idx, 1);
  (removed.images || []).forEach(deleteUploaded);
  if (removed.instruction) deleteUploaded(removed.instruction.pdf);
  data.products.forEach((p) => {
    p.relatedIds = (p.relatedIds || []).filter((id) => id !== removed.id);
  });
  writeData(data);
  res.json({ ok: true });
});

app.post('/api/instruction-categories', requireAuth, (req, res) => {
  const data = readData();
  const category = { id: crypto.randomUUID(), name: (req.body.name || 'Новая категория').trim(), items: [] };
  data.instructionCategories.push(category);
  writeData(data);
  res.json(category);
});

app.put('/api/instruction-categories/:id', requireAuth, (req, res) => {
  const data = readData();
  const cat = data.instructionCategories.find((c) => c.id === req.params.id);
  if (!cat) return res.status(404).json({ error: 'Категория не найдена' });
  cat.name = (req.body.name ?? cat.name).trim();
  writeData(data);
  res.json(cat);
});

app.delete('/api/instruction-categories/:id', requireAuth, (req, res) => {
  const data = readData();
  const idx = data.instructionCategories.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Категория не найдена' });
  const [removed] = data.instructionCategories.splice(idx, 1);
  (removed.items || []).forEach((it) => {
    deleteUploaded(it.pdf);
    data.products.forEach((p) => { if (p.linkedInstructionId === it.id) p.linkedInstructionId = ''; });
  });
  writeData(data);
  res.json({ ok: true });
});

app.post('/api/instruction-categories/:id/items', requireAuth, upload.single('pdf'), async (req, res) => {
  const data = readData();
  const cat = data.instructionCategories.find((c) => c.id === req.params.id);
  if (!cat) return res.status(404).json({ error: 'Категория не найдена' });
  const item = {
    id: crypto.randomUUID(),
    title: (req.body.title || 'Без названия').trim(),
    videoUrl: req.body.videoUrl || '',
    text: req.body.text || '',
    pdf: req.file ? await storage.putUpload(req.file) : ''
  };
  cat.items.push(item);
  writeData(data);
  res.json(item);
});

app.delete('/api/instruction-categories/:id/items/:itemId', requireAuth, (req, res) => {
  const data = readData();
  const cat = data.instructionCategories.find((c) => c.id === req.params.id);
  if (!cat) return res.status(404).json({ error: 'Категория не найдена' });
  const idx = cat.items.findIndex((i) => i.id === req.params.itemId);
  if (idx === -1) return res.status(404).json({ error: 'Инструкция не найдена' });
  const [removed] = cat.items.splice(idx, 1);
  deleteUploaded(removed.pdf);
  data.products.forEach((p) => { if (p.linkedInstructionId === removed.id) p.linkedInstructionId = ''; });
  writeData(data);
  res.json({ ok: true });
});

async function createBackup() {
  const name = await storage.saveBackup(readData());
  DB.backupMeta.last = Date.now();
  writeData(DB);
  const list = await storage.listBackups();
  const extra = list.slice(BACKUP_KEEP);
  for (const b of extra) await storage.deleteBackup(b.name).catch(() => {});
  return name;
}

app.get('/api/backups', requireAuth, async (req, res) => {
  try { res.json({ backups: await storage.listBackups(), last: DB.backupMeta.last }); }
  catch (e) { res.status(500).json({ error: 'Не удалось получить список копий' }); }
});

app.post('/api/backups', requireAuth, async (req, res) => {
  try { await createBackup(); res.json({ backups: await storage.listBackups(), last: DB.backupMeta.last }); }
  catch (e) { res.status(500).json({ error: 'Не удалось создать копию' }); }
});

app.get('/api/backups/:name', (req, res) => {
  const token = (req.query && req.query.token) || '';
  if (!validToken(token)) return res.status(401).json({ error: 'Требуется авторизация' });
  storage.getBackup(req.params.name).then((buf) => {
    if (!buf) return res.status(404).json({ error: 'Копия не найдена' });
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.name.replace(/[^A-Za-z0-9._-]/g, '')}"`);
    res.end(buf);
  }).catch(() => res.status(500).json({ error: 'Ошибка' }));
});

app.post('/api/backups/:name/restore', requireAuth, async (req, res) => {
  try {
    const buf = await storage.getBackup(req.params.name);
    if (!buf) return res.status(404).json({ error: 'Копия не найдена' });
    writeData(normalize(JSON.parse(buf.toString('utf8'))));
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: 'Не удалось восстановить копию' });
  }
});

app.delete('/api/backups/:name', requireAuth, async (req, res) => {
  try { await storage.deleteBackup(req.params.name); res.json({ backups: await storage.listBackups(), last: DB.backupMeta.last }); }
  catch (e) { res.status(500).json({ error: 'Не удалось удалить копию' }); }
});

app.get(ADMIN_PATH, (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(seo.renderRobots(seo.baseUrl(req)));
});

app.get('/sitemap.xml', (req, res) => {
  res.type('application/xml').send(seo.renderSitemap(readData(), seo.baseUrl(req)));
});

app.get(['/catalog', '/catalog/'], (req, res) => {
  res.type('html').send(seo.renderCatalogIndex(readData(), seo.baseUrl(req)));
});

app.get('/catalog/:slug', (req, res) => {
  const data = readData();
  const base = seo.baseUrl(req);
  const cat = (data.productCategories || []).find((c) => c.slug === req.params.slug && c.published !== false);
  if (!cat) return res.status(404).type('html').send(seo.render404(data, base, 'Категория не найдена или снята с публикации.'));
  res.type('html').send(seo.renderCategoryPage(data, cat, base));
});

app.get('/product/:slug', (req, res) => {
  const data = readData();
  const base = seo.baseUrl(req);
  const product = (data.products || []).find((p) => p.slug === req.params.slug && p.published !== false);
  if (!product) return res.status(404).type('html').send(seo.render404(data, base, 'Товар не найден или снят с публикации.'));
  res.type('html').send(seo.renderProductPage(data, product, base));
});

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Не найдено' });
  res.status(404).type('html').send(seo.render404(readData(), seo.baseUrl(req)));
});

app.use((err, req, res, next) => {
  if (err) return res.status(400).json({ error: err.message || 'Ошибка загрузки' });
  next();
});

function scheduleAutoBackup() {
  const check = () => {
    if (Date.now() - (DB.backupMeta.last || 0) >= BACKUP_INTERVAL_MS) {
      createBackup().catch((e) => console.error('Автобэкап:', e.message));
    }
  };
  setTimeout(check, 60 * 1000);
  setInterval(check, 60 * 60 * 1000).unref();
}

(async () => {
  try {
    let data = await storage.loadData();
    if (!data) data = JSON.parse(JSON.stringify(SEED));
    DB = normalize(data);
    await storage.saveData(DB);
    scheduleAutoBackup();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`SPACEXTEN запущен на порту ${PORT} (хранилище: ${storage.usingS3 ? 'S3' : 'локально'})`);
    });
  } catch (err) {
    console.error('Ошибка запуска:', err);
    process.exit(1);
  }
})();
