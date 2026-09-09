(function () {
  'use strict';
  var SITE = window.__SITE__ || {};
  var CART_KEY = 'spx_cart';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  function isHex(v) { return typeof v === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v); }
  function priceNumber(p) { var d = String(p == null ? '' : p).replace(/[^\d]/g, ''); return d ? parseInt(d, 10) : 0; }
  function formatSum(s, c) { return Number(s || 0).toLocaleString('ru-RU') + ' ' + (c || '₽'); }
  function formatPrice(p, c) { var n = priceNumber(p); return n ? n.toLocaleString('ru-RU') + ' ' + (c || '₽') : ''; }

  function applyColors() {
    var c = SITE.colors || {}, root = document.documentElement.style;
    if (isHex(c.grad1)) { root.setProperty('--primary', c.grad1); root.setProperty('--primary-2', c.grad1); }
    if (isHex(c.grad2)) root.setProperty('--cyan', c.grad2);
    if (isHex(c.sub1)) root.setProperty('--sub1', c.sub1);
    if (isHex(c.sub2)) root.setProperty('--sub2', c.sub2);
  }

  function renderSocials() {
    var fab = $('#social-fab'); if (!fab) return;
    var list = (SITE.socials || []).filter(function (s) { return s.icon; });
    if (!list.length) { fab.hidden = true; return; }
    fab.hidden = false;
    $('#social-fab-list').innerHTML = list.map(function (s) {
      return '<a class="social-fab__item" href="' + esc(s.url || '#') + '" target="_blank" rel="noopener" title="' + esc(s.label || '') + '"><img src="' + esc(s.icon) + '" alt="' + esc(s.label || 'соцсеть') + '" /></a>';
    }).join('');
    $('#social-fab-toggle').addEventListener('click', function () {
      var open = fab.classList.toggle('open');
      $('#social-fab-toggle').setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    var lbl = document.querySelector('.social-fab__label');
    if (lbl) lbl.addEventListener('click', function () {
      var open = fab.classList.toggle('open');
      $('#social-fab-toggle').setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  function initNav() {
    var burger = $('#burger'), links = $('#nav-links');
    if (burger && links) burger.addEventListener('click', function () { burger.classList.toggle('open'); links.classList.toggle('open'); });
    var dd = $('#nav-catalog-dd');
    if (dd) {
      var caret = dd.querySelector('.nav__caret');
      if (caret && window.matchMedia('(max-width: 680px)').matches) {
        dd.querySelector('.nav__dropbtn').addEventListener('click', function (e) { e.preventDefault(); dd.classList.toggle('open'); });
      }
    }
    var nav = $('#nav');
    if (nav) window.addEventListener('scroll', function () { nav.classList.toggle('nav--scrolled', window.scrollY > 30); }, { passive: true });
  }

  var cart = loadCart();
  function loadCart() { try { var r = localStorage.getItem(CART_KEY); var a = r ? JSON.parse(r) : []; return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function saveCart() { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) {} }
  function cartCount() { return cart.reduce(function (s, i) { return s + i.qty; }, 0); }
  function cartTotal() { return cart.reduce(function (s, i) { return s + priceNumber(i.price) * i.qty; }, 0); }
  function updateCount() { var el = $('#cart-count'), b = $('#cart-btn'); if (!el) return; var n = cartCount(); el.textContent = n; el.hidden = n === 0; if (b) b.classList.toggle('has-items', n > 0); }

  function addToCart(d) {
    var ex = cart.filter(function (i) { return i.id === d.id; })[0];
    if (ex) ex.qty += 1;
    else cart.push({ id: d.id, name: d.name, price: d.price, currency: d.currency || '₽', image: d.image || '', qty: 1 });
    saveCart(); updateCount(); toast('«' + d.name + '» в корзине');
  }

  var checkoutMode = false;
  function openCart() { checkoutMode = false; renderCart(); openModal($('#cart-modal')); }
  function renderCart() {
    var body = $('#cart-modal-body'); if (!body) return;
    if (!cart.length) { body.innerHTML = '<div class="cart"><h2 class="cart__title">Корзина</h2><p class="cart__empty">Корзина пуста.</p><button class="btn btn--ghost" data-close>Продолжить покупки</button></div>'; return; }
    var cur = cart[0].currency || '₽';
    var rows = cart.map(function (it) {
      return '<div class="cart-row"><div class="cart-row__img" style="' + (it.image ? "background-image:url('" + esc(it.image) + "')" : '') + '"></div>' +
        '<div class="cart-row__main"><div class="cart-row__name">' + esc(it.name) + '</div><div class="cart-row__price">' + (it.price ? esc(formatPrice(it.price, it.currency)) : 'Цена по запросу') + '</div></div>' +
        '<div class="cart-row__qty"><button class="qty-btn" data-act="dec" data-id="' + esc(it.id) + '">−</button><span class="qty-val">' + it.qty + '</span><button class="qty-btn" data-act="inc" data-id="' + esc(it.id) + '">+</button></div>' +
        '<button class="cart-row__del" data-id="' + esc(it.id) + '">×</button></div>';
    }).join('');
    if (!checkoutMode) {
      body.innerHTML = '<div class="cart"><h2 class="cart__title">Корзина</h2><div class="cart__list">' + rows + '</div>' +
        '<div class="cart__summary"><span>Итого' + (cartTotal() ? '' : ' (уточняется)') + ':</span><strong class="cart__total">' + (cartTotal() ? esc(formatSum(cartTotal(), cur)) : '—') + '</strong></div>' +
        '<div class="cart__actions"><button class="btn btn--ghost" data-close>Продолжить</button><button class="btn btn--primary" id="cart-checkout">Оформить заказ</button></div></div>';
      $('#cart-checkout').addEventListener('click', function () { checkoutMode = true; renderCart(); });
    } else {
      body.innerHTML = '<div class="cart"><h2 class="cart__title">Оформление заказа</h2>' +
        '<div class="cart__mini">' + cart.length + ' тов. на сумму <strong>' + (cartTotal() ? esc(formatSum(cartTotal(), cur)) : 'по запросу') + '</strong></div>' +
        '<form class="checkout" id="checkout-form"><label class="field-label">Имя*</label><input class="winput" id="co-name" required />' +
        '<label class="field-label">Телефон*</label><input class="winput" id="co-phone" type="tel" required />' +
        '<label class="field-label">Способ получения</label><div class="radio-row">' +
        '<label class="radio"><input type="radio" name="delivery" value="pickup" checked /> <span>Самовывоз</span></label>' +
        '<label class="radio"><input type="radio" name="delivery" value="delivery" /> <span>Доставка</span></label></div>' +
        '<div id="delivery-fields" hidden><label class="field-label">Город</label><input class="winput" id="co-city" />' +
        '<label class="field-label">Адрес</label><input class="winput" id="co-street" /></div>' +
        '<label class="field-label">Комментарий</label><textarea class="winput winput--area" id="co-comment"></textarea>' +
        '<p class="checkout__status" id="co-status"></p><div class="cart__actions"><button type="button" class="btn btn--ghost" id="co-back">Назад</button>' +
        '<button type="submit" class="btn btn--primary" id="co-submit">Оформить</button></div></form></div>';
      $$('#checkout-form input[name="delivery"]').forEach(function (r) {
        r.addEventListener('change', function () { $('#delivery-fields').hidden = $('#checkout-form input[name="delivery"]:checked').value !== 'delivery'; });
      });
      $('#co-back').addEventListener('click', function () { checkoutMode = false; renderCart(); });
      $('#checkout-form').addEventListener('submit', submitOrder);
    }
    $$('#cart-modal-body .qty-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        var it = cart.filter(function (x) { return x.id === b.dataset.id; })[0]; if (!it) return;
        it.qty = Math.max(1, it.qty + (b.dataset.act === 'inc' ? 1 : -1)); saveCart(); updateCount(); renderCart();
      });
    });
    $$('#cart-modal-body .cart-row__del').forEach(function (b) {
      b.addEventListener('click', function () { cart = cart.filter(function (x) { return x.id !== b.dataset.id; }); saveCart(); updateCount(); renderCart(); });
    });
  }
  function submitOrder(e) {
    e.preventDefault();
    var name = $('#co-name').value.trim(), phone = $('#co-phone').value.trim(), status = $('#co-status');
    var method = $('#checkout-form input[name="delivery"]:checked').value;
    if (!name) { status.textContent = 'Укажите имя.'; status.className = 'checkout__status error'; return; }
    if (phone.replace(/\D/g, '').length < 5) { status.textContent = 'Укажите телефон.'; status.className = 'checkout__status error'; return; }
    var payload = {
      name: name, phone: phone,
      delivery: { method: method, city: method === 'delivery' ? $('#co-city').value.trim() : '', street: method === 'delivery' ? $('#co-street').value.trim() : '' },
      comment: $('#co-comment').value.trim(),
      items: cart.map(function (i) { return { id: i.id, name: i.name, price: i.price, currency: i.currency, qty: i.qty }; }),
      total: cartTotal()
    };
    if (method === 'delivery' && !payload.delivery.city) { status.textContent = 'Укажите город.'; status.className = 'checkout__status error'; return; }
    var btn = $('#co-submit'); btn.disabled = true; status.textContent = 'Отправляем…';
    fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.d.error || 'Ошибка');
        cart = []; saveCart(); updateCount();
        $('#cart-modal-body').innerHTML = '<div class="cart cart--done"><div class="cart__check">✓</div><h2 class="cart__title">Заказ оформлен!</h2><p class="cart__done-text">Спасибо, ' + esc(name) + '! Менеджер скоро свяжется с вами.</p><button class="btn btn--primary" data-close>Отлично</button></div>';
      })
      .catch(function (err) { status.textContent = err.message; status.className = 'checkout__status error'; btn.disabled = false; });
  }

  function openModal(m) { if (!m) return; m.classList.add('open'); m.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden'; }
  function closeModal(m) { if (!m) return; m.classList.remove('open'); m.setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; }

  function initProductGallery() {
    var main = $('#pm-main'); if (!main) return;
    var imgs = $$('.pm__thumb').map(function (t) { return t.dataset.src; });
    if (!imgs.length && main.dataset.src) imgs = [main.dataset.src];
    $$('.pm__thumb').forEach(function (t) {
      t.addEventListener('click', function () {
        main.style.backgroundImage = "url('" + t.dataset.src + "')";
        main.dataset.src = t.dataset.src;
        $$('.pm__thumb').forEach(function (x) { x.classList.toggle('active', x === t); });
      });
    });
    if (main.dataset.src) main.addEventListener('click', function () {
      var i = imgs.indexOf(main.dataset.src); openLightbox(imgs, i < 0 ? 0 : i);
    });
  }
  var lbImages = [], lbIdx = 0;
  function openLightbox(images, start) {
    lbImages = (images || []).filter(Boolean);
    if (!lbImages.length) return;
    lbIdx = Math.max(0, Math.min(start || 0, lbImages.length - 1));
    var box = $('#zoom-box');
    if (!box) {
      box = document.createElement('div'); box.id = 'zoom-box'; box.className = 'zoom-box';
      box.innerHTML = '<button class="zoom-box__close" aria-label="Закрыть">×</button>' +
        '<button class="zoom-box__nav zoom-box__nav--prev" aria-label="Предыдущее"><svg viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
        '<img class="zoom-box__img" alt="" />' +
        '<button class="zoom-box__nav zoom-box__nav--next" aria-label="Следующее"><svg viewBox="0 0 24 24" fill="none"><path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
        '<div class="zoom-box__count"></div>';
      document.body.appendChild(box);
      box.addEventListener('click', function (e) {
        if (e.target === box || e.target.closest('.zoom-box__close')) return closeLightbox();
        if (e.target.closest('.zoom-box__nav--prev')) return lbGo(-1);
        if (e.target.closest('.zoom-box__nav--next')) return lbGo(1);
      });
      var sx = 0;
      box.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
      box.addEventListener('touchend', function (e) { var dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) lbGo(dx < 0 ? 1 : -1); });
    }
    lbRender(); box.classList.add('open'); document.body.style.overflow = 'hidden';
  }
  function lbRender() {
    var box = $('#zoom-box'); if (!box) return;
    box.querySelector('.zoom-box__img').src = lbImages[lbIdx];
    var multi = lbImages.length > 1;
    box.querySelectorAll('.zoom-box__nav').forEach(function (n) { n.style.display = multi ? '' : 'none'; });
    var c = box.querySelector('.zoom-box__count');
    c.textContent = multi ? (lbIdx + 1) + ' / ' + lbImages.length : ''; c.style.display = multi ? '' : 'none';
  }
  function lbGo(d) { lbIdx = (lbIdx + d + lbImages.length) % lbImages.length; lbRender(); }
  function closeLightbox() { var box = $('#zoom-box'); if (box) box.classList.remove('open'); if (!$('.modal.open')) document.body.style.overflow = ''; }

  var toastTimer;
  function toast(msg) {
    var t = $('#site-toast');
    if (!t) { t = document.createElement('div'); t.id = 'site-toast'; t.className = 'site-toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  function trackCart() {
    try { fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'cart' }), keepalive: true }).catch(function () {}); } catch (e) {}
  }

  applyColors();
  renderSocials();
  if (document.querySelector('.pd')) { var _fab = document.getElementById('social-fab'); if (_fab) { _fab.hidden = true; _fab.style.display = 'none'; } }
  initNav();
  initProductGallery();
  updateCount();
  initSiteSearch();

  var searchProducts = null;
  function initSiteSearch() {
    var btn = $('#nav-search-btn'), ov = $('#search-overlay'), inp = $('#site-search-input');
    if (!btn || !ov) return;
    btn.addEventListener('click', openSearch);
    if (inp) inp.addEventListener('input', function () { renderSearch(inp.value); });
    $$('[data-search-close]').forEach(function (el) { el.addEventListener('click', closeSearch); });
    function openSearch() {
      ov.classList.add('open'); ov.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden';
      setTimeout(function () { inp && inp.focus(); }, 50);
      if (searchProducts === null) {
        fetch('/api/data').then(function (r) { return r.json(); }).then(function (d) {
          searchProducts = (d.products || []).filter(function (p) { return p.published !== false; });
          renderSearch(inp ? inp.value : '');
        }).catch(function () { searchProducts = []; });
      } else { renderSearch(inp ? inp.value : ''); }
    }
    function closeSearch() { ov.classList.remove('open'); ov.setAttribute('aria-hidden', 'true'); if (!$('.modal.open')) document.body.style.overflow = ''; }
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSearch(); });
  }
  function renderSearch(term) {
    var box = $('#site-search-results'); if (!box) return;
    term = (term || '').trim().toLowerCase();
    if (searchProducts === null) { box.innerHTML = '<div class="search-overlay__hint">Загрузка…</div>'; return; }
    if (!term) { box.innerHTML = '<div class="search-overlay__hint">Начните вводить название товара</div>'; return; }
    var list = searchProducts.filter(function (p) {
      return (p.name || '').toLowerCase().indexOf(term) >= 0 || (p.brand || '').toLowerCase().indexOf(term) >= 0;
    }).slice(0, 12);
    if (!list.length) { box.innerHTML = '<div class="search-overlay__hint">Ничего не найдено</div>'; return; }
    box.innerHTML = list.map(function (p) {
      var img = p.images && p.images[0] ? "background-image:url('" + esc(p.images[0]) + "')" : '';
      var price = p.price ? formatPrice(p.price, p.currency) : 'Цена по запросу';
      return '<a class="search-result" href="/product/' + esc(p.slug || '') + '/">' +
        '<div class="search-result__img" style="' + img + '"></div>' +
        '<div class="search-result__info"><div class="search-result__name">' + esc(p.name) + '</div>' +
        '<div class="search-result__meta">' + (p.brand ? esc(p.brand) + ' · ' : '') + price + '</div></div></a>';
    }).join('');
  }

  document.addEventListener('click', function (e) {
    var buy = e.target.closest('.card__buy, #pd-buy');
    if (buy) {
      e.preventDefault();
      addToCart({ id: buy.dataset.id, name: buy.dataset.name, price: buy.dataset.price, currency: buy.dataset.currency, image: buy.dataset.image });
      return;
    }
    if (e.target.closest('#cart-btn')) { openCart(); trackCart(); return; }
    var closeEl = e.target.closest('[data-close]');
    if (closeEl) { var m = closeEl.closest('.modal'); if (m) closeModal(m); }
    if (e.target.classList && e.target.classList.contains('modal__backdrop')) closeModal(e.target.closest('.modal'));
  });
  document.addEventListener('keydown', function (e) {
    var z = $('#zoom-box');
    if (z && z.classList.contains('open')) {
      if (e.key === 'ArrowLeft') return lbGo(-1);
      if (e.key === 'ArrowRight') return lbGo(1);
    }
    if (e.key === 'Escape') {
      if (z) z.classList.remove('open');
      $$('.modal.open').forEach(closeModal);
      if (!$('.modal.open')) document.body.style.overflow = '';
    }
  });

  var filters = $('#cat-filters');
  if (filters) {
    filters.addEventListener('click', function (e) {
      var b = e.target.closest('[data-sub]'); if (!b) return;
      $$('#cat-filters [data-sub]').forEach(function (x) { x.classList.toggle('subchip--active', x === b); });
      var sub = b.dataset.sub;
      $$('#cat-products .card').forEach(function (card) {
        card.style.display = (sub === '__all' || card.dataset.sub === sub) ? '' : 'none';
      });
    });
  }
})();
