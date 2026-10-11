(function () {
  'use strict';

  const DATA = window.DOSTAVKA_DATA;
  const MENUS = window.DOSTAVKA_MENUS;

  const CATEGORIES = {
    all: 'Все',
    restaurant: 'Рестораны',
    fastfood: 'Фастфуд',
    coffee: 'Кофейни',
    grocery: 'Мясные магазины',
    // Не категория заведения, а фильтр по отметке ownDelivery — как кнопка «Доставки» в Halal Tracker.
    delivery: 'Доставки'
  };

  const CATEGORY_ICONS = {
    all: '🍽️',
    restaurant: '🍲',
    fastfood: '🍔',
    coffee: '☕',
    grocery: '🥩',
    delivery: '🛵'
  };

  // Минимальная сумма заказа в заведении. Стоимость доставки считается по тарифу «Курьер» (delivery.js).
  const DELIVERY = { minOrder: 500 };
  const DL = window.DostavkaDelivery;
  const COURIER = DL.TARIFFS.courier;


  // Города, где работает доставка. Заведения остальных городов остаются в data/places.js,
  // но на сайте не показываются — чтобы подключить город, добавьте его сюда.
  const ACTIVE_CITIES = ['Махачкала', 'Каспийск'];
  DATA.places = DATA.places.filter((p) => ACTIVE_CITIES.includes(p.city));

  // Центр для городов без координат в каталоге.
  const FALLBACK_CENTERS = { 'Хасавюрт': [43.2509, 46.5877] };

  const PAYMENT = {
    cash: 'Наличными курьеру',
    card: 'Картой курьеру',
    transfer: 'Переводом при получении'
  };

  // ---------- Хранилище ----------
  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem('dostavka.' + key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem('dostavka.' + key, JSON.stringify(value));
      } catch (e) { /* приватный режим — работаем без сохранения */ }
    }
  };

  const state = {
    city: store.get('city', null),
    category: 'all',
    query: '',
    view: 'grid',
    menuQuery: '',
    userPos: null,
    cart: store.get('cart', { placeId: null, items: {} }),
    orders: store.get('orders', []),
    activePlaceId: null,
    // Адрес доставки: { label, full, city, coords, flat, entrance, floor, intercom, courier }
    address: store.get('address', null),
    door: store.get('door', true),
    quote: null
  };

  // Сохранённые город и корзина могли остаться от города, который отключили.
  if (!ACTIVE_CITIES.includes(state.city)) state.city = ACTIVE_CITIES.length === 1 ? ACTIVE_CITIES[0] : null;
  if (state.cart.placeId && !DATA.places.some((p) => p.id === state.cart.placeId)) {
    state.cart = { placeId: null, items: {} };
    store.set('cart', state.cart);
  }

  let map = null;

  // ---------- Утилиты ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  const rub = (n) => n.toLocaleString('ru-RU') + ' ₽';

  function plural(n, one, few, many) {
    const m10 = n % 10;
    const m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }

  const placesCount = (n) => n + ' ' + plural(n, 'заведение', 'заведения', 'заведений');

  function placeById(id) {
    return DATA.places.find((p) => p.id === id) || null;
  }

  function cityNames() {
    return ACTIVE_CITIES;
  }

  function cityCenter(city) {
    return DATA.cityCenters[city] || FALLBACK_CENTERS[city] || [43.0, 47.0];
  }

  // Ссылки на 2ГИС работают без ключа API.
  const TWOGIS_CITY_SLUGS = {
    'Махачкала': 'makhachkala',
    'Каспийск': 'kaspiysk',
    'Дербент': 'derbent',
    'Нальчик': 'nalchik',
    'Сочи': 'sochi',
    'Хасавюрт': 'khasavyurt'
  };

  function twoGisBase(city) {
    return 'https://2gis.ru/' + (TWOGIS_CITY_SLUGS[city] || '');
  }

  // Точка «куда» в построителе маршрута 2ГИС; формат взят из ссылок на карточках 2ГИС: |lon,lat;firmId
  function twoGisPointUrl(city, coords, firmId) {
    const point = '|' + coords[1] + ',' + coords[0] + (firmId ? ';' + firmId : '');
    return twoGisBase(city) + '/directions/points/' + encodeURIComponent(point);
  }

  function twoGisFirmId(p) {
    const m = /2gis\.ru\/[^?#]*\/firm\/(\d+)/.exec(p.mapUrl || '');
    return m ? m[1] : null;
  }

  function twoGisPlaceUrl(p) {
    if (p.mapUrl && p.mapUrl.includes('2gis.ru')) return p.mapUrl;
    if (p.coords) return twoGisBase(p.city) + '?m=' + encodeURIComponent(p.coords[1] + ',' + p.coords[0] + '/17');
    if (p.address) return twoGisBase(p.city) + '/search/' + encodeURIComponent(p.name + ' ' + p.address);
    return null;
  }

  function twoGisRouteUrl(p) {
    return p.coords ? twoGisPointUrl(p.city, p.coords, twoGisFirmId(p)) : null;
  }

  function initials(name) {
    return name.replace(/[«»"()]/g, '').trim().slice(0, 1).toUpperCase();
  }

  function distanceKm(a, b) {
    const R = 6371;
    const toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(b[0] - a[0]);
    const dLon = toRad(b[1] - a[1]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function menuFor(place) {
    return MENUS.byPlace[place.id] || MENUS.byCategory[place.categories[0]] || MENUS.byCategory.restaurant;
  }

  function findItem(place, itemId) {
    for (const section of menuFor(place)) {
      const item = section.items.find((i) => i.id === itemId);
      if (item) return item;
    }
    return null;
  }

  // Обложка карточки — поле cover заведения или первое фото из его настоящего меню.
  function coverPhoto(place) {
    if (place.cover) return place.cover;
    if (!MENUS.byPlace[place.id]) return null;
    for (const s of MENUS.byPlace[place.id]) {
      const it = s.items.find((x) => x.photo);
      if (it) return it.photo;
    }
    return null;
  }

  function waPhone(phone) {
    let digits = String(phone || '').replace(/\D/g, '');
    if (digits.length === 11 && digits[0] === '8') digits = '7' + digits.slice(1);
    return digits;
  }

  function toast(text) {
    const el = $('#toast');
    el.textContent = text;
    el.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => { el.hidden = true; }, 2800);
  }

  function customer() {
    return store.get('customer', {});
  }

  function addressLine(c) {
    return [c.address, c.flat && 'кв. ' + c.flat, c.entrance && 'подъезд ' + c.entrance, c.floor && 'этаж ' + c.floor]
      .filter(Boolean).join(', ');
  }

  // ---------- Корзина ----------
  function saveCart() {
    store.set('cart', state.cart);
    renderCartIndicators();
    if (!$('#cartDrawer').hidden) renderCartDrawer();
  }

  function cartLines() {
    const place = placeById(state.cart.placeId);
    if (!place) return [];
    return Object.entries(state.cart.items)
      .map(([id, qty]) => ({ item: findItem(place, id), qty }))
      .filter((l) => l.item && l.qty > 0);
  }

  function cartTotals() {
    const subtotal = cartLines().reduce((s, l) => s + l.item.price * l.qty, 0);
    const q = currentQuote();
    // Пока адрес не указан, показываем минимальную стоимость тарифа «Курьер».
    const fee = subtotal === 0 ? 0 : q ? q.price.total : COURIER.min;
    return { subtotal, fee, feeKnown: !!q, quote: q, total: subtotal + fee, canOrder: subtotal >= DELIVERY.minOrder };
  }

  // ---------- Расчёт доставки ----------
  function quoteKey() {
    const p = placeById(state.cart.placeId);
    const a = state.address;
    if (!p || !p.coords || !a || !a.coords) return null;
    return p.id + '|' + a.coords.join(',') + '|' + (state.door ? 1 : 0);
  }

  function currentQuote() {
    const k = quoteKey();
    return k && state.quote && state.quote.key === k ? state.quote : null;
  }

  let quotePending = null;
  function ensureQuote() {
    const k = quoteKey();
    if (!k || currentQuote() || quotePending === k) return;
    quotePending = k;
    const p = placeById(state.cart.placeId);
    const a = state.address;
    DL.route(p.coords, a.coords).then((r) => {
      if (quotePending === k) quotePending = null;
      if (quoteKey() !== k) return;
      const outOfCity = !!(a.city && a.city !== p.city);
      state.quote = { key: k, route: r, price: DL.price('courier', r.distance, { outOfCity, door: state.door }) };
      renderCartIndicators();
      refreshAfterCartChange(null, null);
    });
  }

  function cartCount() {
    return Object.values(state.cart.items).reduce((s, q) => s + q, 0);
  }

  function itemQty(placeId, itemId) {
    return state.cart.placeId === placeId ? state.cart.items[itemId] || 0 : 0;
  }

  function changeQty(placeId, itemId, delta) {
    if (state.cart.placeId && state.cart.placeId !== placeId && cartCount() > 0) {
      const current = placeById(state.cart.placeId);
      const ok = confirm(`В корзине уже есть заказ из «${current ? current.name : 'другого заведения'}». Очистить корзину и начать новый?`);
      if (!ok) return;
      state.cart = { placeId: null, items: {} };
    }
    state.cart.placeId = placeId;
    const next = (state.cart.items[itemId] || 0) + delta;
    if (next <= 0) delete state.cart.items[itemId];
    else state.cart.items[itemId] = next;
    if (cartCount() === 0) state.cart.placeId = null;
    saveCart();
    refreshAfterCartChange(placeId, itemId);
    ensureQuote();
  }

  function clearCart() {
    if (!cartCount() || !confirm('Очистить корзину?')) return;
    const placeId = state.cart.placeId;
    state.cart = { placeId: null, items: {} };
    saveCart();
    refreshAfterCartChange(placeId, null);
  }

  // Точечно обновляем элементы, которые зависят от корзины, чтобы не терять прокрутку и фокус.
  function refreshAfterCartChange(placeId, itemId) {
    $$('[data-qty-for]').forEach((el) => {
      if (itemId && el.dataset.qtyFor !== itemId) return;
      el.innerHTML = qtyControl(el.dataset.place, el.dataset.qtyFor, el.dataset.variant);
    });
    const panel = $('#cartPanel');
    if (panel) panel.innerHTML = cartHtml('panel');
    if (!$('#cartDrawer').hidden) renderCartDrawer();
    if (location.hash.startsWith('#/checkout')) {
      if (!cartCount()) { renderCheckout(); return; }
      $('#checkoutSummary').innerHTML = summaryHtml();
      const dq = $('#deliveryQuote');
      if (dq) dq.innerHTML = deliveryQuoteHtml();
    }
  }

  function qtyControl(placeId, itemId, variant) {
    const qty = itemQty(placeId, itemId);
    const sm = variant === 'sm' ? ' qty-sm' : '';
    if (!qty) {
      if (variant === 'sm') return '';
      if (variant === 'modal') {
        return `<button class="btn btn-primary btn-block" type="button" data-add="${esc(itemId)}" data-place="${esc(placeId)}"><span aria-hidden="true">+</span> Добавить</button>`;
      }
      return `<button class="add-btn" type="button" data-add="${esc(itemId)}" data-place="${esc(placeId)}" aria-label="Добавить"><span aria-hidden="true">+</span> Добавить</button>`;
    }
    return `<div class="qty${sm}">
      <button type="button" data-dec="${esc(itemId)}" data-place="${esc(placeId)}" aria-label="Убрать">−</button>
      <span>${qty}</span>
      <button type="button" data-add="${esc(itemId)}" data-place="${esc(placeId)}" aria-label="Добавить">+</button>
    </div>`;
  }

  function qtySlot(placeId, itemId, variant) {
    return `<div data-qty-for="${esc(itemId)}" data-place="${esc(placeId)}" data-variant="${variant || ''}">${qtyControl(placeId, itemId, variant)}</div>`;
  }

  function thumbHtml(item) {
    return item.photo ? `<img src="${esc(item.photo)}" alt="" loading="lazy">` : '🍽';
  }

  const fmtKm = (m) => (m / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 1 }) + ' км';
  const fmtMin = (s) => Math.max(1, Math.round(s / 60)) + ' мин';

  function freeProgressHtml(t) {
    if (!t.subtotal) return '';
    if (t.quote) {
      return `<div class="free-progress">🛵 Курьер · ${fmtKm(t.quote.route.distance)} · в пути ~${fmtMin(t.quote.route.duration)}${state.door ? ' · до двери' : ''}</div>`;
    }
    const p = placeById(state.cart.placeId);
    if (state.address && p && !p.coords) {
      return `<div class="free-progress">У заведения нет точки на карте — показана минимальная стоимость доставки, точную назовёт курьер.</div>`;
    }
    return `<button class="free-progress addr-prompt" type="button" data-pick-address>📍 Укажите адрес — рассчитаем доставку: от ${rub(COURIER.min)}, ${COURIER.perKmCity} ₽/км</button>`;
  }

  function totalsHtml(t) {
    return `<div class="totals">
      <div><span>Товары</span><span>${rub(t.subtotal)}</span></div>
      <div><span>Доставка</span><span>${t.feeKnown ? rub(t.fee) : 'от ' + rub(t.fee)}</span></div>
      <div class="total"><span>Итого</span><span>${t.feeKnown ? '' : 'от '}${rub(t.total)}</span></div>
    </div>`;
  }

  // context: panel — колонка на странице заведения, drawer — выезжающая корзина.
  function cartHtml(context) {
    const lines = cartLines();
    const place = placeById(state.cart.placeId);
    if (!lines.length) {
      return `<div class="cart-head"><h2>Корзина</h2></div>
        <div class="cart-empty"><span class="cart-empty-icon" aria-hidden="true">🛒</span>
        В корзине пока пусто.<br>Добавьте блюда из меню.</div>`;
    }
    const t = cartTotals();
    return `
      <div class="cart-head"><h2>Корзина</h2><button class="link-btn" type="button" data-clear-cart>Очистить</button></div>
      <div class="cart-place">из <a href="#/place/${esc(place.id)}">${esc(place.name)}</a></div>
      <div class="cart-lines">
        ${lines.map((l) => `
          <div class="cart-line">
            <div class="cart-thumb">${thumbHtml(l.item)}</div>
            <div>
              <div class="cart-line-name">${esc(l.item.name)}</div>
              <div class="cart-line-sub">${esc(l.item.unit)}</div>
            </div>
            <div class="cart-line-right">
              <span class="cart-line-sum">${rub(l.item.price * l.qty)}</span>
              ${qtyControl(place.id, l.item.id, 'sm')}
            </div>
          </div>`).join('')}
      </div>
      ${freeProgressHtml(t)}
      ${totalsHtml(t)}
      ${t.canOrder
        ? `<a class="btn btn-primary btn-block" href="#/checkout"><span>Далее</span><span class="btn-sum">${rub(t.total)}</span></a>`
        : `<p class="hint warn" style="margin-bottom:10px">Минимальная сумма заказа — ${rub(DELIVERY.minOrder)}. Добавьте ещё на ${rub(DELIVERY.minOrder - t.subtotal)}.</p>
           <button class="btn btn-primary btn-block" type="button" disabled>Далее</button>`}
      `;
  }

  function renderCartIndicators() {
    const t = cartTotals();
    const n = cartCount();
    const btn = $('#cartButton');
    btn.classList.toggle('is-empty', !n);
    $('#cartSum').textContent = n ? rub(t.total) : 'Корзина';
    btn.setAttribute('aria-label', n ? `Корзина: ${n} ${plural(n, 'товар', 'товара', 'товаров')} на ${rub(t.total)}` : 'Корзина');
    const onCheckout = location.hash.startsWith('#/checkout');
    $('#cartBar').hidden = !n || onCheckout;
    $('#cartBarCount').textContent = n;
    $('#cartBarSum').textContent = rub(t.total);
  }

  function renderCartDrawer() {
    $('#cartBody').innerHTML = cartHtml('drawer');
  }

  function openCart(open) {
    $('#cartDrawer').hidden = !open;
    $('#cartOverlay').hidden = !open;
    if (open) renderCartDrawer();
  }

  // ---------- Город и адрес ----------
  function renderAddressButton() {
    $('#cityLabel').textContent = state.city || 'Выберите город';
    $('#addressLabel').textContent = state.address ? addressText(state.address) : 'Укажите адрес доставки';
  }

  function addressText(a) {
    return [a.label, a.flat && 'кв. ' + a.flat, a.entrance && 'подъезд ' + a.entrance, a.floor && 'этаж ' + a.floor]
      .filter(Boolean).join(', ');
  }

  function renderCitySwitch(container) {
    container.innerHTML = cityNames().map((c) =>
      `<button type="button" data-city="${esc(c)}" aria-pressed="${c === state.city}">${esc(c)}</button>`).join('');
  }

  function setCity(city) {
    if (city === state.city) return;
    state.city = city;
    store.set('city', city);
    renderAddressButton();
    if ($('#addressModal').open) {
      renderCitySwitch($('#cityGrid'));
      picker.recenter();
      if (!location.hash || location.hash === '#/' || location.hash === '#') renderHome();
      return;
    }
    if (!location.hash || location.hash === '#/' || location.hash === '#') renderHome();
    else if (!location.hash.startsWith('#/checkout') && !location.hash.startsWith('#/send')) location.hash = '#/';
  }

  function setAddress(addr) {
    state.address = addr;
    store.set('address', addr);
    if (addr && addr.city && ACTIVE_CITIES.includes(addr.city) && addr.city !== state.city) {
      state.city = addr.city;
      store.set('city', addr.city);
    }
    renderAddressButton();
    renderCartIndicators();
    refreshAfterCartChange(null, null);
    ensureQuote();
  }

  function openAddressModal() {
    picker.open({
      title: 'Куда доставить?',
      value: state.address,
      details: true,
      onDone: (addr) => { setAddress(addr); toast('Адрес доставки сохранён'); }
    });
  }

  // ---------- Главная ----------
  function filteredPlaces() {
    const q = state.query.trim().toLowerCase();
    let list = DATA.places.filter((p) => {
      if (p.city !== state.city) return false;
      if (state.category === 'delivery' && !p.ownDelivery) return false;
      if (state.category !== 'all' && state.category !== 'delivery' && !p.categories.includes(state.category)) return false;
      if (!q) return true;
      const dishes = (MENUS.byPlace[p.id] || []).flatMap((s) => s.items.map((i) => i.name)).join(' ');
      return (p.name + ' ' + (p.address || '') + ' ' + (p.description || '') + ' ' + dishes).toLowerCase().includes(q);
    });
    if (state.userPos) {
      list = list
        .map((p) => ({ p, d: p.coords ? distanceKm(state.userPos, p.coords) : Infinity }))
        .sort((a, b) => a.d - b.d)
        .map((x) => x.p);
    }
    return list;
  }

  function coverHtml(p) {
    const photo = coverPhoto(p);
    return photo
      ? `<img class="cover-photo" src="${esc(photo)}" alt="" loading="lazy">`
      : `<div class="cover-art" data-cat="${esc(p.categories[0])}" aria-hidden="true">${CATEGORY_ICONS[p.categories[0]] || '🍽️'}</div>`;
  }

  function logoHtml(p) {
    return p.logo ? `<img src="${esc(p.logo)}" alt="" loading="lazy">` : esc(initials(p.name));
  }

  function placeMeta(p) {
    const parts = [CATEGORIES[p.categories[0]], 'Доставка от ' + rub(COURIER.min)];
    if (state.userPos && p.coords) parts.push(distanceKm(state.userPos, p.coords).toFixed(1) + ' км');
    else parts.push(p.address || 'Адрес уточняется');
    return esc(parts.join(' · '));
  }

  function cardHtml(p) {
    const badges = [
      p.verified ? '<span class="tag tag-ok">✓ Проверено</span>' : '',
      p.ownDelivery ? '<span class="tag">🛵 Своя доставка</span>' : ''
    ].join('');
    return `
      <a class="card" href="#/place/${esc(p.id)}">
        <div class="card-cover">
          ${coverHtml(p)}
          ${badges ? `<div class="cover-badges">${badges}</div>` : ''}
          <div class="cover-logo">${logoHtml(p)}</div>
        </div>
        <div class="card-body">
          <h3>${esc(p.name)}</h3>
          <div class="card-meta">${placeMeta(p)}</div>
        </div>
      </a>`;
  }

  function rowCardHtml(p) {
    return `
      <div class="row-card${p.id === state.activePlaceId ? ' is-active' : ''}" data-place-row="${esc(p.id)}" tabindex="0">
        <div class="thumb">${coverHtml(p)}</div>
        <div>
          <h3>${esc(p.name)}</h3>
          <div class="card-meta">${placeMeta(p)}</div>
          <a class="go" href="#/place/${esc(p.id)}">Открыть меню →</a>
        </div>
      </div>`;
  }

  function renderHome() {
    destroyMap();
    if (!state.city) {
      $('#view').innerHTML = '<div class="wrap home"><p class="empty">Выберите город доставки.</p></div>';
      if (!$('#addressModal').open) openAddressModal();
      return;
    }
    $('#view').innerHTML = `
      <div class="wrap home">
        <label class="header-search mobile-search">
          <span aria-hidden="true">🔍</span>
          <input id="searchMobile" type="search" placeholder="Найти заведение или блюдо" aria-label="Поиск" value="${esc(state.query)}" autocomplete="off">
        </label>
        <section class="promo">
          <div>
            <h1>Еда и продукты<br>с доставкой</h1>
            <p>Рестораны, фастфуд, кофейни и мясные магазины ${esc(state.city === 'Каспийск' ? 'Каспийска' : 'Махачкалы')} — только из проверенного каталога.</p>
          </div>
          <span class="promo-emoji" aria-hidden="true">🥙</span>
        </section>
        <section class="services" aria-label="Услуги курьера">
          <a class="service" href="#/send/courier"><span class="service-icon" aria-hidden="true">🛵</span><span><b>Курьер</b><small>Отправить посылку или документы — от ${rub(DL.TARIFFS.courier.min)}</small></span></a>
          <a class="service" href="#/send/buy"><span class="service-icon" aria-hidden="true">🛍️</span><span><b>Купим и привезём</b><small>Курьер купит что нужно — от ${rub(DL.TARIFFS.buy.min)}</small></span></a>
        </section>
        <nav class="cats" id="chips" aria-label="Категории">
          ${Object.entries(CATEGORIES).map(([k, v]) => `
            <button class="cat" type="button" data-cat="${k}" aria-pressed="${state.category === k}">
              <span class="cat-icon" aria-hidden="true">${CATEGORY_ICONS[k]}</span>${esc(v)}
            </button>`).join('')}
        </nav>
        <div class="bar">
          <h2 id="listTitle"></h2>
          <div class="bar-controls">
          <div class="segmented tabs" role="group" aria-label="Город">
            ${cityNames().map((c) => `<button type="button" data-city="${esc(c)}" aria-pressed="${c === state.city}">${esc(c)}</button>`).join('')}
          </div>
          <button class="pill" type="button" id="nearMe" aria-pressed="${!!state.userPos}">📍 Рядом со мной</button>
          <div class="segmented" role="group" aria-label="Вид">
            <button type="button" data-view="grid" aria-pressed="${state.view === 'grid'}">Списком</button>
            <button type="button" data-view="map" aria-pressed="${state.view === 'map'}">На карте</button>
          </div>
          </div>
        </div>
        <div id="results"></div>
      </div>`;
    renderResults();
  }

  function renderResults() {
    const places = filteredPlaces();
    const title = state.category === 'all' ? 'Все заведения' : CATEGORIES[state.category];
    $('#listTitle').innerHTML = `${esc(title)}<small>${placesCount(places.length)}</small>`;
    const box = $('#results');
    if (state.view === 'map') {
      if (!$('#map')) {
        box.innerHTML = `<div class="map-layout"><div class="map-list" id="list"></div><div class="map-box"><div class="map" id="map"></div></div></div>`;
        initMap();
      }
      $('#list').innerHTML = places.length
        ? places.map(rowCardHtml).join('')
        : '<p class="empty">Ничего не нашлось</p>';
      renderMarkers(places);
    } else {
      destroyMap();
      box.innerHTML = places.length
        ? `<div class="grid">${places.map(cardHtml).join('')}</div>`
        : '<p class="empty">Ничего не нашлось. Попробуйте другую категорию или запрос.</p>';
    }
  }

  // ---------- Карта ----------
  let mapToken = 0;

  function initMap() {
    destroyMap();
    const token = ++mapToken;
    const el = $('#map');
    window.DostavkaMap.create(el, {
      center: cityCenter(state.city),
      pinHtml: (p, active) => `<div class="pin${active ? ' is-active' : ''}"><span>${esc(initials(p.name))}</span></div>`,
      popupHtml: popupHtml,
      onSelect: (id) => highlight(id, false),
      onTilesFailed: () => toast('Картографический сервер недоступен. Заведения можно выбрать в списке.')
    }).then((adapter) => {
      // Пока карта загружалась, пользователь мог уйти со страницы или сменить город.
      if (token !== mapToken || !document.body.contains(el)) { adapter.destroy(); return; }
      map = adapter;
      renderMarkers(filteredPlaces());
    }).catch(() => {
      if (token === mapToken) el.innerHTML = '<p class="empty">Карта не загрузилась. Воспользуйтесь списком.</p>';
    });
  }

  function destroyMap() {
    mapToken += 1;
    if (map) { map.destroy(); map = null; }
  }

  function popupHtml(p) {
    const route = twoGisRouteUrl(p);
    return `<b>${esc(p.name)}</b><br>${esc(p.address || '')}<br>
      <a class="popup-btn" href="#/place/${esc(p.id)}">Открыть меню</a>
      ${route ? `<a class="popup-link" href="${esc(route)}" target="_blank" rel="noopener">Маршрут в 2ГИС</a>` : ''}`;
  }

  function renderMarkers(places) {
    if (map) map.setPlaces(places, state.activePlaceId, state.userPos);
  }

  function highlight(id, fromList) {
    state.activePlaceId = id;
    if (map) map.setActive(id);
    $$('[data-place-row]').forEach((el) => el.classList.toggle('is-active', el.dataset.placeRow === id));
    if (fromList && map) {
      map.focus(id);
      if (window.matchMedia('(max-width: 1024px)').matches) $('.map-box').scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (!fromList) {
      const row = document.querySelector(`[data-place-row="${CSS.escape(id)}"]`);
      if (row) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  function locateUser(onDone) {
    if (!navigator.geolocation) { toast('Геолокация недоступна в этом браузере'); return; }
    toast('Определяем местоположение…');
    navigator.geolocation.getCurrentPosition(
      (pos) => { state.userPos = [pos.coords.latitude, pos.coords.longitude]; onDone(pos); },
      () => toast('Не удалось определить местоположение'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  // ---------- Заведение ----------
  function dishCardHtml(p, it) {
    return `
      <article class="dish" data-dish="${esc(it.id)}" data-place="${esc(p.id)}">
        <div class="dish-photo">${it.photo ? `<img src="${esc(it.photo)}" alt="${esc(it.name)}" loading="lazy" decoding="async">` : '<span aria-hidden="true">🍽</span>'}</div>
        <div class="dish-info">
          <span class="dish-price">${rub(it.price)}</span>
          <span class="dish-name">${esc(it.name)}</span>
          <span class="dish-unit">${esc(it.unit)}</span>
        </div>
        <div class="dish-action">${qtySlot(p.id, it.id)}</div>
      </article>`;
  }

  function menuSectionsHtml(p) {
    const q = state.menuQuery.trim().toLowerCase();
    const sections = menuFor(p)
      .map((s, i) => ({ ...s, i, items: q ? s.items.filter((it) => (it.name + ' ' + (it.desc || '')).toLowerCase().includes(q)) : s.items }))
      .filter((s) => s.items.length);
    if (!sections.length) return '<p class="empty">В меню ничего не нашлось</p>';
    return sections.map((s) => `
      <section class="menu-section" id="sec-${s.i}">
        <h2>${esc(s.section)}</h2>
        <div class="menu-grid">${s.items.map((it) => dishCardHtml(p, it)).join('')}</div>
      </section>`).join('');
  }

  function renderPlace(id) {
    const p = placeById(id);
    if (!p) { $('#view').innerHTML = '<div class="wrap page"><p class="empty">Заведение не найдено. <a href="#/"><u>К списку</u></a></p></div>'; return; }
    state.menuQuery = '';
    const menu = menuFor(p);
    const isDemo = !MENUS.byPlace[p.id];
    const source = (MENUS.sources || {})[p.id];
    const note = isDemo
      ? 'Меню демонстрационное: цены и позиции уточняются у заведения.'
      : source ? (source.text || `Меню и цены — с сервиса ${source.name} на ${source.date}. В заведении цены могут отличаться.`) : '';
    $('#view').innerHTML = `
      <div class="wrap place">
        <section class="place-hero">
          <div class="hero-bg">${coverHtml(p)}</div>
          <div class="hero-content">
            <div class="hero-logo">${logoHtml(p)}</div>
            <div class="hero-text">
              <h1>${esc(p.name)}</h1>
              ${p.description ? `<p>${esc(p.description)}</p>` : ''}
              <div class="hero-chips">
                <span class="hero-chip">🛵 Курьер от ${rub(COURIER.min)} · ${COURIER.perKmCity} ₽/км</span>
                <span class="hero-chip">Заказ от ${rub(DELIVERY.minOrder)}</span>
                ${p.workingHours ? `<span class="hero-chip">🕒 ${esc(p.workingHours)}</span>` : ''}
                ${p.verified ? '<span class="hero-chip">✓ Проверено</span>' : ''}
                <button class="hero-chip" type="button" data-info="${esc(p.id)}">ⓘ Информация</button>
              </div>
            </div>
          </div>
        </section>
        ${note ? `<p class="source-note">${esc(note)}</p>` : ''}
        <div class="place-layout">
          <nav class="menu-nav" id="menuNav" aria-label="Разделы меню">
            ${menu.map((s, i) => `<a href="#" data-jump="sec-${i}">${esc(s.section)}</a>`).join('')}
          </nav>
          <div>
            <label class="menu-search"><span aria-hidden="true">🔍</span>
              <input id="menuSearch" type="search" placeholder="Поиск в меню" aria-label="Поиск в меню" autocomplete="off">
            </label>
            <div id="menuSections">${menuSectionsHtml(p)}</div>
          </div>
          <aside class="cart-panel" id="cartPanel">${cartHtml('panel')}</aside>
        </div>
      </div>`;
    $('#view').dataset.place = p.id;
    setupScrollSpy();
  }

  let spy = null;
  let jumpLockUntil = 0;

  const isNarrow = () => window.matchMedia('(max-width: 1024px)').matches;

  function setActiveSection(id) {
    const nav = $('#menuNav');
    if (!nav) return;
    $$('a', nav).forEach((a) => {
      const on = a.dataset.jump === id;
      a.classList.toggle('is-active', on);
      // На телефоне лента разделов прокручивается вбок сама по себе — страницу не трогаем.
      if (on && isNarrow()) {
        const left = a.offsetLeft - (nav.clientWidth - a.offsetWidth) / 2;
        nav.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
      }
    });
  }

  function setupScrollSpy() {
    if (spy) spy.disconnect();
    if (!$('#menuNav') || !('IntersectionObserver' in window)) return;
    spy = new IntersectionObserver((entries) => {
      // Пока страница едет к выбранному разделу, промежуточные разделы не подсвечиваем.
      if (Date.now() < jumpLockUntil) return;
      const hit = entries.find((en) => en.isIntersecting);
      if (hit) setActiveSection(hit.target.id);
    }, { rootMargin: '-35% 0px -60% 0px' });
    $$('.menu-section').forEach((s) => spy.observe(s));
  }

  // Переход к разделу с учётом шапки и липкой ленты разделов.
  function jumpToSection(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const header = $('.header').offsetHeight;
    const nav = $('#menuNav');
    const navH = isNarrow() && nav ? nav.offsetHeight : 0;
    const top = el.getBoundingClientRect().top + window.scrollY - header - navH - 12;
    setActiveSection(id);
    jumpLockUntil = Date.now() + 900;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }

  function openDish(placeId, itemId) {
    const p = placeById(placeId);
    const it = p && findItem(p, itemId);
    if (!it) return;
    $('#dishBody').innerHTML = `
      <div class="dish-modal">
        <div class="dish-modal-photo">${it.photo ? `<img src="${esc(it.photo)}" alt="${esc(it.name)}">` : '<span aria-hidden="true">🍽</span>'}</div>
        <div class="dish-modal-info">
          <h2>${esc(it.name)}</h2>
          <span class="dish-unit">${esc(it.unit)}</span>
          ${it.desc ? `<p class="desc">${esc(it.desc)}</p>` : ''}
          <div class="dish-modal-foot">
            <span class="dish-modal-price">${rub(it.price)}</span>
            ${qtySlot(p.id, it.id, 'modal')}
          </div>
        </div>
      </div>`;
    $('#dishModal').showModal();
    $('#dishModal').focus();
  }

  function openInfo(placeId) {
    const p = placeById(placeId);
    if (!p) return;
    const phones = (p.phones || []).map((ph) => `<a href="tel:+${esc(waPhone(ph))}">${esc(ph)}</a>`).join(', ');
    const links = [
      ...(p.socials || []).map((x) => `<a class="btn" href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.label)}</a>`),
      twoGisPlaceUrl(p) ? `<a class="btn" href="${esc(twoGisPlaceUrl(p))}" target="_blank" rel="noopener">Открыть в 2ГИС</a>` : '',
      twoGisRouteUrl(p) ? `<a class="btn" href="${esc(twoGisRouteUrl(p))}" target="_blank" rel="noopener">Маршрут в 2ГИС</a>` : ''
    ].join('');
    $('#infoBody').innerHTML = `
      <h2>${esc(p.name)}</h2>
      <div class="info-list">
        <div class="info-row"><span>🏷</span><span>${p.categories.map((c) => esc(CATEGORIES[c])).join(', ')}</span></div>
        <div class="info-row"><span>📍</span><span>${esc(p.city)}, ${esc(p.address || 'адрес уточняется')}</span></div>
        ${p.workingHours ? `<div class="info-row"><span>🕒</span><span>${esc(p.workingHours)}</span></div>` : ''}
        ${phones ? `<div class="info-row"><span>☎</span><span>${phones}</span></div>` : ''}
        <div class="info-row"><span>🛵</span><span>Доставка по тарифу «Курьер»: от ${rub(COURIER.min)}, ${COURIER.perKmCity} ₽/км по городу, ${COURIER.perKmOut} ₽/км за городом. Курьер поднимется к двери — ${rub(COURIER.doorFee)}. Минимальный заказ — ${rub(DELIVERY.minOrder)}.</span></div>
        ${links ? `<div class="info-links">${links}</div>` : ''}
      </div>`;
    $('#infoModal').showModal();
  }

  // ---------- Выбор адреса на карте ----------
  // Как в такси-приложениях: двигаете карту под пином или ищете адрес строкой.
  const picker = (function () {
    let cfg = null;
    let pmap = null;
    let picked = null;
    let token = 0;
    // После программного перелёта карты к адресу её события «сдвинули» приходят несколько раз —
    // в это окно не перезаписываем выбранный адрес адресом под пином.
    let suppressUntil = 0;
    let suggestTimer = null;
    let reverseTimer = null;

    const modal = () => $('#addressModal');

    function renderPicked() {
      const box = $('#pickerPicked');
      if (!picked) { box.innerHTML = '<span class="muted">Передвиньте карту или найдите адрес</span>'; return; }
      box.innerHTML = `<b>${esc(picked.label)}</b><span class="muted">${esc(picked.city || '')}</span>`;
    }

    function renderSaved() {
      const list = DL.savedAddresses();
      $('#pickerSaved').innerHTML = list.length
        ? `<div class="saved-title">Мои адреса</div>${list.map((a, i) => `
            <button class="saved-item" type="button" data-saved="${i}">
              <span class="saved-icon" aria-hidden="true">${a.tag === 'home' ? '🏠' : a.tag === 'work' ? '💼' : '📍'}</span>
              <span><b>${esc(a.tag === 'home' ? 'Дом' : a.tag === 'work' ? 'Работа' : a.label)}</b>
              <small>${esc(a.tag ? a.label : a.city || '')}</small></span>
            </button>`).join('')}`
        : '';
    }

    function choose(addr, move) {
      picked = { ...addr };
      renderPicked();
      $('#pickerSuggest').innerHTML = '';
      if (move && pmap && addr.coords) { suppressUntil = Date.now() + 1500; pmap.setView(addr.coords, 17); }
    }

    function onMove(center) {
      if (Date.now() < suppressUntil) return;
      clearTimeout(reverseTimer);
      $('#pickerPicked').innerHTML = '<span class="muted">Определяем адрес…</span>';
      reverseTimer = setTimeout(() => {
        DL.reverse(center).then((a) => {
          picked = a || { label: 'Точка на карте', full: '', city: state.city, coords: center };
          renderPicked();
        }).catch(() => { picked = { label: 'Точка на карте', city: state.city, coords: center }; renderPicked(); });
      }, 350);
    }

    function onSearch(q) {
      clearTimeout(suggestTimer);
      if (!q.trim()) { $('#pickerSuggest').innerHTML = ''; return; }
      suggestTimer = setTimeout(() => {
        const near = pmap ? pmap.getCenter() : cityCenter(state.city);
        DL.suggest(q, near).then((items) => {
          $('#pickerSuggest').innerHTML = items.length
            ? items.map((a, i) => `<button class="suggest-item" type="button" data-suggest="${i}"><b>${esc(a.label)}</b><small>${esc(a.full)}</small></button>`).join('')
            : '<div class="hint" style="padding:8px 4px">Ничего не нашлось</div>';
          $('#pickerSuggest').items = items;
        }).catch(() => { $('#pickerSuggest').innerHTML = '<div class="hint">Поиск адреса недоступен</div>'; });
      }, 300);
    }

    function open(options) {
      cfg = options;
      picked = options.value && options.value.coords ? { ...options.value } : null;
      $('#pickerTitle').textContent = options.title || 'Адрес';
      renderCitySwitch($('#cityGrid'));
      $('#cityGrid').hidden = !!options.hideCity;
      $('#pickerSearch').value = '';
      $('#pickerSuggest').innerHTML = '';
      const d = options.value || {};
      const f = $('#addressForm');
      $('#pickerDetails').hidden = !options.details;
      ['flat', 'entrance', 'floor', 'intercom', 'courier'].forEach((k) => { f[k].value = d[k] || ''; });
      $$('[data-tag]', f).forEach((b) => b.setAttribute('aria-pressed', String((d.tag || '') === b.dataset.tag)));
      renderSaved();
      renderPicked();
      if (!modal().open) modal().showModal();
      const t = ++token;
      const center = picked ? picked.coords : cityCenter(state.city);
      if (pmap) { pmap.destroy(); pmap = null; }
      if (!DL.hasGeo()) {
        $('#pickerMap').innerHTML = '<p class="empty">Карта недоступна — введите адрес строкой.</p>';
        return;
      }
      window.DostavkaMap.create($('#pickerMap'), {
        center, pinHtml: () => '', popupHtml: () => '', onSelect: () => {}
      }).then((m) => {
        if (t !== token || !modal().open) { m.destroy(); return; }
        pmap = m;
        pmap.setView(center, picked ? 17 : 14);
        pmap.onMoveEnd(onMove);
        if (!picked) onMove(center);
      });
    }

    function close() {
      token += 1;
      if (pmap) { pmap.destroy(); pmap = null; }
      if (modal().open) modal().close();
    }

    function done() {
      const f = $('#addressForm');
      let addr = picked;
      const typed = $('#pickerSearch').value.trim();
      if (!addr && typed) addr = { label: typed, full: typed, city: state.city, coords: null };
      if (!addr) { toast('Выберите адрес на карте или в поиске'); return; }
      const tagBtn = $('[data-tag][aria-pressed="true"]', f);
      const tag = tagBtn ? tagBtn.dataset.tag : '';
      if (cfg.details) ['flat', 'entrance', 'floor', 'intercom', 'courier'].forEach((k) => { addr[k] = f[k].value.trim(); });
      addr.tag = tag;
      if (addr.coords) DL.rememberAddress(addr, tag);
      const cb = cfg.onDone;
      close();
      cb(addr);
    }

    function recenter() { if (pmap) pmap.setView(cityCenter(state.city), 14); }

    function locate() {
      locateUser((pos) => { if (pmap) pmap.setView([pos.coords.latitude, pos.coords.longitude], 17); });
    }

    $('#pickerSearch').addEventListener('input', (e) => onSearch(e.target.value));
    $('#pickerSuggest').addEventListener('click', (e) => {
      const b = e.target.closest('[data-suggest]');
      if (b) choose($('#pickerSuggest').items[+b.dataset.suggest], true);
    });
    $('#pickerSaved').addEventListener('click', (e) => {
      const b = e.target.closest('[data-saved]');
      if (b) {
        const a = DL.savedAddresses()[+b.dataset.saved];
        choose(a, true);
        if (cfg.details) {
          const f = $('#addressForm');
          ['flat', 'entrance', 'floor', 'intercom', 'courier'].forEach((k) => { f[k].value = a[k] || ''; });
        }
      }
    });
    $('#addressForm').addEventListener('submit', (e) => { e.preventDefault(); done(); });
    $('#addressForm').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tag]');
      if (b) $$('[data-tag]', e.currentTarget).forEach((x) => x.setAttribute('aria-pressed', String(x === b && x.getAttribute('aria-pressed') !== 'true')));
    });
    $('#pickerLocate').addEventListener('click', locate);
    modal().addEventListener('close', () => { token += 1; if (pmap) { pmap.destroy(); pmap = null; } });

    return { open, close, recenter };
  })();

  // ---------- Оформление ----------
  function whenOptionsHtml(prefix) {
    return `
      <div class="choice-grid">
        <label class="choice"><input type="radio" name="when" value="asap" checked> Как можно скорее</label>
        <label class="choice"><input type="radio" name="when" value="time"> Предварительный заказ
          <input id="${prefix}-time" name="time" type="time" disabled class="time-input"></label>
      </div>`;
  }

  function bindWhen(prefix) {
    $$('input[name="when"]').forEach((r) => r.addEventListener('change', () => {
      const t = $('#' + prefix + '-time');
      t.disabled = $('input[name="when"]:checked').value !== 'time';
      if (!t.disabled) t.focus();
    }));
  }

  function scheduledFrom(form) {
    const f = new FormData(form);
    if (f.get('when') !== 'time' || !f.get('time')) return null;
    const [h, m] = String(f.get('time')).split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    if (d.getTime() < Date.now() + 10 * 60000) d.setDate(d.getDate() + 1);
    return d.getTime();
  }

  function tariffCardHtml(tariff, q, extra) {
    const p = q && q.price;
    return `
      <div class="tariff is-selected">
        <span class="tariff-icon" aria-hidden="true">${tariff.icon}</span>
        <div class="tariff-main">
          <b>${esc(tariff.name)}</b>
          <small>${esc(tariff.about)}</small>
          ${q ? `<small>${fmtKm(q.route.distance)} · в пути ~${fmtMin(q.route.duration)}${q.route.source === 'estimate' ? ' · примерно, по прямой' : ''}</small>` : ''}
        </div>
        <b class="tariff-price">${p ? rub(p.total) : 'от ' + rub(tariff.min)}</b>
      </div>
      ${p ? `<div class="breakdown">
        <div><span>Поездка: ${fmtKm(q.route.distance)} × ${p.rate} ₽/км${p.outOfCity ? ' (за город)' : ''}${p.ride === tariff.min ? ', но не меньше минимальной' : ''}</span><span>${rub(p.ride)}</span></div>
        ${p.door ? `<div><span>Выход курьера к двери</span><span>${rub(p.door)}</span></div>` : ''}
      </div>` : ''}
      <label class="check"><input type="checkbox" id="doorOpt" ${state.door ? 'checked' : ''}> Курьер поднимется к двери <span class="muted">+${rub(tariff.doorFee)}</span></label>
      <p class="hint">${tariff.freeWaitMin} мин ожидания бесплатно, дальше ${tariff.waitPerMin} ₽/мин. ${extra || ''}</p>`;
  }

  function deliveryQuoteHtml() {
    const place = placeById(state.cart.placeId);
    const q = currentQuote();
    const note = !place.coords ? 'У заведения нет точки на карте — точную стоимость назовёт курьер.' : !state.address || !state.address.coords ? 'Укажите адрес — посчитаем по маршруту.' : q ? '' : 'Считаем маршрут…';
    return tariffCardHtml(COURIER, q, note);
  }

  function addressCardHtml(a, emptyText, attr) {
    return `<button class="addr-card" type="button" ${attr}>
      <span class="addr-card-icon" aria-hidden="true">📍</span>
      <span class="addr-card-text">${a
        ? `<b>${esc(a.label)}</b><small>${esc([a.city, a.flat && 'кв. ' + a.flat, a.entrance && 'подъезд ' + a.entrance, a.floor && 'этаж ' + a.floor, a.intercom && 'домофон ' + a.intercom].filter(Boolean).join(', '))}</small>`
        : `<b>${esc(emptyText)}</b><small>Улица, дом или точка на карте</small>`}</span>
      <span class="addr-card-go" aria-hidden="true">›</span>
    </button>`;
  }

  function summaryHtml() {
    const place = placeById(state.cart.placeId);
    const t = cartTotals();
    return `
      <div class="cart-head"><h2>Ваш заказ</h2></div>
      <div class="cart-place">из <a href="#/place/${esc(place.id)}">${esc(place.name)}</a></div>
      <div class="cart-lines">
        ${cartLines().map((l) => `
          <div class="cart-line">
            <div class="cart-thumb">${thumbHtml(l.item)}</div>
            <div><div class="cart-line-name">${esc(l.item.name)}</div><div class="cart-line-sub">${esc(l.item.unit)}</div></div>
            <div class="cart-line-right"><span class="cart-line-sum">${rub(l.item.price * l.qty)}</span>${qtyControl(place.id, l.item.id, 'sm')}</div>
          </div>`).join('')}
      </div>
      ${totalsHtml(t)}
      ${t.canOrder ? '' : `<p class="hint warn" style="margin-bottom:10px">Минимальная сумма заказа — ${rub(DELIVERY.minOrder)}.</p>`}
      <button class="btn btn-primary btn-block" id="submitOrder" type="submit" form="checkoutForm" ${t.canOrder ? '' : 'disabled'}>
        <span>Заказать</span><span class="btn-sum">${t.feeKnown ? '' : 'от '}${rub(t.total)}</span>
      </button>
      <p class="hint" style="margin-top:10px">Оплата при получении. Курьера назначим сразу после заказа.</p>`;
  }

  function renderCheckout() {
    if (!cartLines().length) {
      $('#view').innerHTML = '<div class="wrap page"><h1 class="page-title">Оформление</h1><div class="cart-empty"><span class="cart-empty-icon">🛒</span>Корзина пуста. <a href="#/"><u>Выбрать заведение</u></a></div></div>';
      return;
    }
    const c = customer();
    const place = placeById(state.cart.placeId);
    $('#view').innerHTML = `
      <div class="wrap page">
        <a class="back" href="#/place/${esc(place.id)}">← Вернуться в меню</a>
        <h1 class="page-title">Оформление заказа</h1>
        <div class="checkout">
          <form class="form" id="checkoutForm" novalidate>
            <section class="block">
              <h2>Маршрут</h2>
              <div class="route-points">
                <div class="route-point"><span class="dot dot-a">A</span><div><b>${esc(place.name)}</b><small>${esc(place.address || 'адрес уточняется')}</small></div></div>
                <div class="route-point"><span class="dot dot-b">B</span><div style="flex:1">${addressCardHtml(state.address, 'Куда доставить?', 'data-pick-address')}</div></div>
              </div>
            </section>
            <section class="block">
              <h2>Тариф</h2>
              <div id="deliveryQuote">${deliveryQuoteHtml()}</div>
            </section>
            <section class="block">
              <h2>Когда доставить</h2>
              ${whenOptionsHtml('f')}
            </section>
            <section class="block">
              <h2>Получатель</h2>
              <div class="row2">
                <div class="field"><label for="f-name">Имя</label><input id="f-name" name="name" required autocomplete="name" value="${esc(c.name || '')}"></div>
                <div class="field"><label for="f-phone">Телефон</label><input id="f-phone" name="phone" type="tel" required autocomplete="tel" placeholder="+7 900 000-00-00" value="${esc(c.phone || '')}"></div>
              </div>
            </section>
            <section class="block">
              <h2>Оплата при получении</h2>
              <div class="choice-grid">
                ${Object.entries(PAYMENT).map(([k, v], i) => `<label class="choice"><input type="radio" name="payment" value="${k}" ${i === 0 ? 'checked' : ''}> ${v}</label>`).join('')}
              </div>
            </section>
            <section class="block">
              <h2>Комментарий к заказу</h2>
              <div class="field"><textarea id="f-comment" name="comment" aria-label="Комментарий к заказу" placeholder="Пожелания заведению, например: без лука"></textarea></div>
            </section>
            <p class="hint warn" id="formError" hidden></p>
          </form>
          <aside class="cart-panel summary" id="checkoutSummary">${summaryHtml()}</aside>
        </div>
      </div>`;
    bindWhen('f');
    $('#checkoutForm').addEventListener('submit', submitOrder);
    ensureQuote();
  }

  function formError(text) {
    const err = $('#formError');
    err.textContent = text;
    err.hidden = false;
    err.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  async function buildRoutes(from, to, seed) {
    const route = from.coords && to.coords ? await DL.route(from.coords, to.coords) : null;
    const startPt = from.coords ? DL.courierStart(from.coords, seed) : null;
    const approach = startPt ? await DL.route(startPt, from.coords) : null;
    return { route, approach };
  }

  async function submitOrder(e) {
    e.preventDefault();
    const form = e.target;
    const f = new FormData(form);
    const v = (k) => String(f.get(k) || '').trim();
    const phoneDigits = v('phone').replace(/\D/g, '');
    if (!state.address) return formError('Укажите адрес доставки.');
    if (!v('name')) return formError('Укажите имя.');
    if (phoneDigits.length < 10) return formError('Укажите телефон, чтобы курьер мог связаться с вами.');
    if (v('when') === 'time' && !v('time')) return formError('Укажите время доставки.');

    const btn = $('#submitOrder');
    btn.disabled = true;
    btn.firstElementChild.textContent = 'Оформляем…';
    store.set('customer', { name: v('name'), phone: v('phone') });

    const place = placeById(state.cart.placeId);
    const from = { label: place.name, sub: place.address || '', city: place.city, coords: place.coords || null };
    const to = { ...state.address };
    const createdAt = Date.now();
    const { route, approach } = await buildRoutes(from, to, createdAt);
    const priceD = route
      ? DL.price('courier', route.distance, { outOfCity: !!(to.city && to.city !== place.city), door: state.door })
      : { ride: COURIER.min, door: state.door ? COURIER.doorFee : 0, total: COURIER.min + (state.door ? COURIER.doorFee : 0), estimate: true };
    const subtotal = cartTotals().subtotal;
    const order = {
      id: 'o' + createdAt.toString(36),
      number: String(createdAt).slice(-5),
      type: 'food',
      tariff: 'courier',
      placeId: place.id,
      placeName: place.name,
      city: place.city,
      items: cartLines().map((l) => ({ name: l.item.name, price: l.item.price, unit: l.item.unit, qty: l.qty })),
      subtotal,
      fee: priceD.total,
      total: subtotal + priceD.total,
      delivery: { price: priceD, door: state.door },
      from, to, route, approach,
      customer: { name: v('name'), phone: v('phone') },
      scheduledAt: scheduledFrom(form),
      payment: v('payment'),
      comment: v('comment'),
      createdAt,
      cancelled: false
    };
    state.orders.unshift(order);
    store.set('orders', state.orders);
    state.cart = { placeId: null, items: {} };
    saveCart();
    location.hash = '#/orders/' + order.id;
  }

  // ---------- Курьер и «Купим и привезём» ----------
  const sendDraft = { from: null, to: null };

  function renderSend(kind) {
    const tariff = DL.TARIFFS[kind === 'buy' ? 'buy' : 'courier'];
    const c = customer();
    if (!sendDraft.to && state.address) sendDraft.to = { ...state.address };
    $('#view').innerHTML = `
      <div class="wrap page">
        <a class="back" href="#/">← На главную</a>
        <h1 class="page-title">${tariff.icon} ${esc(tariff.name)}</h1>
        <div class="segmented" style="margin:-8px 0 20px" role="group" aria-label="Услуга">
          <a class="seg-link" href="#/send/courier" aria-pressed="${kind !== 'buy'}">🛵 Отправить посылку</a>
          <a class="seg-link" href="#/send/buy" aria-pressed="${kind === 'buy'}">🛍️ Купим и привезём</a>
        </div>
        <div class="checkout">
          <form class="form" id="sendForm" novalidate>
            <section class="block">
              <h2>Маршрут</h2>
              <div class="route-points">
                <div class="route-point"><span class="dot dot-a">A</span><div style="flex:1">${addressCardHtml(sendDraft.from, kind === 'buy' ? 'Где купить?' : 'Откуда забрать?', 'data-pick-point="from"')}</div></div>
                <div class="route-point"><span class="dot dot-b">B</span><div style="flex:1">${addressCardHtml(sendDraft.to, 'Куда привезти?', 'data-pick-point="to"')}</div></div>
              </div>
            </section>
            <section class="block">
              <h2>${kind === 'buy' ? 'Что купить' : 'Что везём'}</h2>
              <div class="form">
                <div class="field"><textarea name="what" aria-label="Описание" placeholder="${kind === 'buy' ? 'Например: 2 кг говядины на кости, лаваш, зелень' : 'Например: документы в конверте, небольшая коробка'}"></textarea></div>
                ${kind === 'buy'
                  ? '<div class="field"><label for="s-budget">Примерная сумма покупки, ₽</label><input id="s-budget" name="budget" inputmode="numeric" placeholder="Например, 1500"></div><p class="hint">Покупку оплачиваете курьеру при получении вместе с доставкой.</p>'
                  : '<div class="field"><label for="s-rphone">Телефон получателя</label><input id="s-rphone" name="rphone" type="tel" placeholder="+7 900 000-00-00"></div>'}
              </div>
            </section>
            <section class="block">
              <h2>Тариф</h2>
              <div id="sendQuote">${tariffCardHtml(tariff, null, 'Укажите обе точки — посчитаем по маршруту.')}</div>
            </section>
            <section class="block">
              <h2>Когда</h2>
              ${whenOptionsHtml('s')}
            </section>
            <section class="block">
              <h2>Заказчик</h2>
              <div class="row2">
                <div class="field"><label for="s-name">Имя</label><input id="s-name" name="name" autocomplete="name" value="${esc(c.name || '')}"></div>
                <div class="field"><label for="s-phone">Телефон</label><input id="s-phone" name="phone" type="tel" autocomplete="tel" placeholder="+7 900 000-00-00" value="${esc(c.phone || '')}"></div>
              </div>
            </section>
            <section class="block">
              <h2>Оплата</h2>
              <div class="choice-grid">
                ${Object.entries(PAYMENT).map(([k, v], i) => `<label class="choice"><input type="radio" name="payment" value="${k}" ${i === 0 ? 'checked' : ''}> ${v}</label>`).join('')}
              </div>
            </section>
            <p class="hint warn" id="formError" hidden></p>
          </form>
          <aside class="cart-panel summary">
            <div class="cart-head"><h2>Итого</h2></div>
            <div id="sendTotal"></div>
            <button class="btn btn-primary btn-block" type="submit" form="sendForm" id="sendSubmit"><span>Заказать</span><span class="btn-sum" id="sendSum"></span></button>
            <p class="hint" style="margin-top:10px">${esc(tariff.about)}.</p>
          </aside>
        </div>
      </div>`;
    $('#view').dataset.kind = kind;
    bindWhen('s');
    $('#sendForm').addEventListener('submit', (e) => submitSend(e, kind));
    updateSendQuote(kind);
  }

  async function sendQuote(kind) {
    const { from, to } = sendDraft;
    if (!from || !to || !from.coords || !to.coords) return null;
    const r = await DL.route(from.coords, to.coords);
    const outOfCity = !!(from.city && to.city && from.city !== to.city);
    return { route: r, price: DL.price(kind === 'buy' ? 'buy' : 'courier', r.distance, { outOfCity, door: state.door }) };
  }

  async function updateSendQuote(kind) {
    const tariff = DL.TARIFFS[kind === 'buy' ? 'buy' : 'courier'];
    const q = await sendQuote(kind);
    if (!$('#sendQuote')) return;
    $('#sendQuote').innerHTML = tariffCardHtml(tariff, q, q ? '' : 'Укажите обе точки — посчитаем по маршруту.');
    $('#sendTotal').innerHTML = q
      ? `<div class="totals"><div><span>Доставка</span><span>${rub(q.price.total)}</span></div>${kind === 'buy' ? '<div><span>Покупка</span><span>по чеку</span></div>' : ''}</div>`
      : `<p class="hint">Стоимость — от ${rub(tariff.min)}, ${tariff.perKmCity} ₽/км по городу.</p>`;
    $('#sendSum').textContent = q ? rub(q.price.total) : '';
  }

  async function submitSend(e, kind) {
    e.preventDefault();
    const form = e.target;
    const f = new FormData(form);
    const v = (k) => String(f.get(k) || '').trim();
    if (!sendDraft.from) return formError(kind === 'buy' ? 'Укажите, где купить.' : 'Укажите, откуда забрать.');
    if (!sendDraft.to) return formError('Укажите, куда привезти.');
    if (!v('what')) return formError(kind === 'buy' ? 'Напишите, что купить.' : 'Напишите, что везём.');
    if (!v('name')) return formError('Укажите имя.');
    if (v('phone').replace(/\D/g, '').length < 10) return formError('Укажите телефон.');
    if (v('when') === 'time' && !v('time')) return formError('Укажите время.');
    const btn = $('#sendSubmit');
    btn.disabled = true;
    btn.firstElementChild.textContent = 'Оформляем…';
    store.set('customer', { name: v('name'), phone: v('phone') });
    const createdAt = Date.now();
    const from = { ...sendDraft.from };
    const to = { ...sendDraft.to };
    const { route, approach } = await buildRoutes(from, to, createdAt);
    const tariffId = kind === 'buy' ? 'buy' : 'courier';
    const t = DL.TARIFFS[tariffId];
    const priceD = route
      ? DL.price(tariffId, route.distance, { outOfCity: !!(from.city && to.city && from.city !== to.city), door: state.door })
      : { ride: t.min, door: state.door ? t.doorFee : 0, total: t.min + (state.door ? t.doorFee : 0), estimate: true };
    const order = {
      id: 'o' + createdAt.toString(36),
      number: String(createdAt).slice(-5),
      type: tariffId,
      tariff: tariffId,
      city: from.city || state.city,
      what: v('what'),
      budget: v('budget'),
      recipientPhone: v('rphone'),
      items: [],
      subtotal: 0,
      fee: priceD.total,
      total: priceD.total,
      delivery: { price: priceD, door: state.door },
      from, to, route, approach,
      customer: { name: v('name'), phone: v('phone') },
      scheduledAt: scheduledFrom(form),
      payment: v('payment'),
      comment: '',
      createdAt,
      cancelled: false
    };
    state.orders.unshift(order);
    store.set('orders', state.orders);
    sendDraft.from = null;
    location.hash = '#/orders/' + order.id;
  }

  // ---------- Заказы и отслеживание ----------
  // Старые заказы (до расчёта доставки по маршруту) приводим к новому виду.
  function normalizeOrder(o) {
    if (o.type) return o;
    const place = placeById(o.placeId);
    const c = o.customer || {};
    return {
      ...o,
      type: 'food',
      tariff: 'courier',
      from: { label: o.placeName, sub: place ? place.address : '', city: o.city, coords: place && place.coords ? place.coords : null },
      to: { label: c.address || 'Адрес не указан', city: o.city, coords: o.geo || null, flat: c.flat, entrance: c.entrance, floor: c.floor },
      route: null,
      approach: null,
      delivery: { price: { total: o.fee || 0 }, door: false }
    };
  }
  state.orders = state.orders.map(normalizeOrder);

  function orderTitle(o) {
    if (o.type === 'food') return o.placeName;
    if (o.type === 'buy') return 'Купим и привезём';
    return 'Курьер';
  }

  const fmtTime = (ms) => new Date(ms).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

  function etaText(pr, o) {
    if (pr.stage === 'delivered' || pr.stage === 'cancelled') return '';
    const left = Math.max(1, Math.round((pr.eta - Date.now()) / 60000));
    if (pr.stage === 'scheduled') return `Доставим к ${fmtTime(o.scheduledAt)}`;
    return `Приедет к ${fmtTime(pr.eta)} · через ${left} ${plural(left, 'минуту', 'минуты', 'минут')}`;
  }

  function orderText(o) {
    const lines = o.items.map((i) => `• ${i.name} × ${i.qty} = ${rub(i.price * i.qty)}`).join('\n');
    const to = o.to || {};
    const toLine = [to.label, to.flat && 'кв. ' + to.flat, to.entrance && 'подъезд ' + to.entrance, to.floor && 'этаж ' + to.floor, to.intercom && 'домофон ' + to.intercom].filter(Boolean).join(', ');
    return [
      `Заказ №${o.number} (Доставка History)`,
      lines,
      `Товары: ${rub(o.subtotal)}`,
      `Доставка (курьер${o.route ? ', ' + fmtKm(o.route.distance) : ''}): ${rub(o.fee)}`,
      `Итого: ${rub(o.total)}`,
      `Имя: ${o.customer.name}`,
      `Телефон: ${o.customer.phone}`,
      `Адрес: ${to.city || o.city}, ${toLine}`,
      to.courier ? `Курьеру: ${to.courier}` : '',
      to.coords ? `Точка на карте 2ГИС: ${twoGisPointUrl(to.city || o.city, to.coords)}` : '',
      `Когда: ${o.scheduledAt ? 'к ' + fmtTime(o.scheduledAt) : 'как можно скорее'}`,
      `Оплата: ${PAYMENT[o.payment]}`,
      o.comment ? `Комментарий: ${o.comment}` : ''
    ].filter(Boolean).join('\n');
  }

  const TRACK_STEPS = [
    { stage: 'search', label: 'Поиск курьера' },
    { stage: 'toPickup', label: 'Едет за заказом' },
    { stage: 'atPickup', label: 'Забирает заказ' },
    { stage: 'toClient', label: 'Везёт заказ' },
    { stage: 'delivered', label: 'Доставлен' }
  ];

  function orderCardHtml(o) {
    const pr = DL.progress(o);
    const date = new Date(o.createdAt).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    return `
      <a class="order-card" href="#/orders/${esc(o.id)}">
        <div class="order-top">
          <div>
            <h3>${esc(orderTitle(o))}</h3>
            <div class="order-sub">№${esc(o.number)} · ${esc(date)} · ${rub(o.total)}</div>
          </div>
          <span class="status" data-s="${pr.stage}">${pr.icon} ${esc(pr.label)}</span>
        </div>
        <div class="order-items muted">${esc((o.from && o.from.label) || '')} → ${esc((o.to && o.to.label) || '')}</div>
        ${etaText(pr, o) ? `<div class="order-items">${esc(etaText(pr, o))}</div>` : ''}
      </a>`;
  }

  function renderOrders() {
    $('#view').innerHTML = `
      <div class="wrap page">
        <h1 class="page-title">Мои заказы</h1>
        ${state.orders.length
          ? `<div class="orders">${state.orders.map(orderCardHtml).join('')}</div>`
          : '<div class="cart-empty"><span class="cart-empty-icon">🧾</span>Заказов пока нет. <a href="#/"><u>Выбрать заведение</u></a></div>'}
      </div>`;
  }

  let trackMap = null;
  let trackTimer = null;
  let trackStage = null;

  function stopTracking() {
    clearInterval(trackTimer);
    trackTimer = null;
    trackStage = null;
    if (trackMap) { trackMap.destroy(); trackMap = null; }
  }

  function pointPin(letter, cls) {
    return `<div class="route-pin ${cls}"><span>${letter}</span></div>`;
  }

  function trackPanelHtml(o, pr) {
    const stepIdx = TRACK_STEPS.findIndex((s) => s.stage === pr.stage);
    const place = o.type === 'food' ? placeById(o.placeId) : null;
    const phone = place && place.phones ? waPhone(place.phones[0]) : '';
    const p = (o.delivery && o.delivery.price) || { total: o.fee };
    const tariff = DL.TARIFFS[o.tariff || 'courier'];
    const canCancel = !o.cancelled && ['scheduled', 'search', 'toPickup', 'atPickup'].includes(pr.stage);
    const shareUrl = location.href;
    return `
      <a class="back" href="#/orders">← Мои заказы</a>
      <div class="track-head">
        <span class="track-icon" aria-hidden="true">${pr.icon}</span>
        <div>
          <h1>${esc(pr.label)}</h1>
          <p class="muted" id="trackEta">${esc(etaText(pr, o))}</p>
        </div>
      </div>
      ${pr.stage === 'search' ? '<div class="searching"><i></i><i></i><i></i></div>' : ''}
      ${stepIdx >= 0 ? `<ol class="steps-v">${TRACK_STEPS.map((s, i) => `<li class="${i < stepIdx ? 'done' : i === stepIdx ? 'now' : ''}">${esc(s.label)}</li>`).join('')}</ol>` : ''}
      ${['toPickup', 'atPickup', 'toClient'].includes(pr.stage) ? `
        <div class="courier-card">
          <span class="courier-ava" aria-hidden="true">🛵</span>
          <div><b>Курьер назначен</b><small>Демо-режим: пока нет приложения для курьеров, его движение показывает сайт</small></div>
        </div>` : ''}
      <div class="track-block">
        <div class="route-points">
          <div class="route-point"><span class="dot dot-a">A</span><div><b>${esc(o.from.label)}</b><small>${esc(o.from.sub || o.from.city || '')}</small></div></div>
          <div class="route-point"><span class="dot dot-b">B</span><div><b>${esc(o.to.label)}</b><small>${esc([o.to.flat && 'кв. ' + o.to.flat, o.to.entrance && 'подъезд ' + o.to.entrance, o.to.floor && 'этаж ' + o.to.floor].filter(Boolean).join(', ') || o.to.city || '')}</small></div></div>
        </div>
        ${o.what ? `<p class="order-items"><b>${o.type === 'buy' ? 'Купить' : 'Везём'}:</b> ${esc(o.what)}${o.budget ? ` · до ${esc(o.budget)} ₽` : ''}</p>` : ''}
        ${o.items.length ? `<p class="order-items">${o.items.map((i) => `${esc(i.name)} × ${i.qty}`).join(', ')}</p>` : ''}
      </div>
      <div class="totals">
        ${o.subtotal ? `<div><span>Товары</span><span>${rub(o.subtotal)}</span></div>` : ''}
        <div><span>${esc(tariff.name)}${o.route ? ' · ' + fmtKm(o.route.distance) : ''}</span><span>${rub(p.total - (p.door || 0))}</span></div>
        ${p.door ? `<div><span>Курьер к двери</span><span>${rub(p.door)}</span></div>` : ''}
        ${o.type === 'buy' ? '<div><span>Покупка</span><span>по чеку</span></div>' : ''}
        <div class="total"><span>Итого</span><span>${rub(o.total)}</span></div>
        <div class="muted" style="font-size:13px">${esc(PAYMENT[o.payment] || '')}</div>
      </div>
      <div class="order-actions">
        ${o.type === 'food' && phone && !o.cancelled ? `<a class="btn btn-primary" href="https://wa.me/${phone}?text=${encodeURIComponent(orderText(o))}" target="_blank" rel="noopener">Отправить заказ заведению</a>` : ''}
        <button class="btn" type="button" data-share="${esc(shareUrl)}">Поделиться</button>
        ${canCancel ? `<button class="btn" type="button" data-cancel="${esc(o.id)}">Отменить</button>` : ''}
        ${o.type === 'food' ? `<button class="btn" type="button" data-repeat="${esc(o.id)}">Повторить</button>` : ''}
      </div>
      ${pr.stage === 'delivered' ? ratingHtml(o) : ''}
      <p class="hint" style="margin-top:14px">№${esc(o.number)} · Работаем круглосуточно.</p>`;
  }

  function ratingHtml(o) {
    const r = o.rating;
    if (r && r.saved) {
      return `<div class="rating"><b>Ваша оценка</b><div class="stars">${[1, 2, 3, 4, 5].map((n) => `<span class="${n <= r.stars ? 'on' : ''}">★</span>`).join('')}</div>${r.comment ? `<p class="muted">${esc(r.comment)}</p>` : ''}</div>`;
    }
    const s = (r && r.stars) || 0;
    return `<div class="rating" id="ratingBox"><b>Как прошла доставка?</b>
      <div class="stars" role="group" aria-label="Оценка">${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="${n <= s ? 'on' : ''}" data-star="${n}" aria-label="${n} из 5">★</button>`).join('')}</div>
      <textarea id="rateComment" placeholder="Комментарий курьеру (необязательно)"></textarea>
      <button class="btn btn-primary" type="button" data-rate="${esc(o.id)}">Отправить оценку</button></div>`;
  }

  function updateTrackMap(o, pr) {
    if (!trackMap) return;
    if (pr.courier) trackMap.setMarker('courier', pr.courier, '<div class="courier-pin">🛵</div>', [18, 18]);
    else trackMap.removeMarker('courier');
  }

  function renderTracking(id) {
    const o = state.orders.find((x) => x.id === id);
    if (!o) { $('#view').innerHTML = '<div class="wrap page"><p class="empty">Заказ не найден. <a href="#/orders"><u>Мои заказы</u></a></p></div>'; return; }
    const hasMap = (o.from && o.from.coords) || (o.to && o.to.coords);
    $('#view').innerHTML = `
      <div class="track">
        ${hasMap ? '<div class="track-map"><div class="map" id="trackMap"></div></div>' : ''}
        <aside class="track-panel${hasMap ? '' : ' no-map'}" id="trackPanel"></aside>
      </div>`;
    const draw = () => {
      const pr = DL.progress(o);
      if (pr.stage !== trackStage) {
        trackStage = pr.stage;
        $('#trackPanel').innerHTML = trackPanelHtml(o, pr);
      } else {
        const eta = $('#trackEta');
        if (eta) eta.textContent = etaText(pr, o);
      }
      updateTrackMap(o, pr);
    };
    draw();
    trackTimer = setInterval(() => {
      if (!document.body.contains($('#trackPanel'))) { stopTracking(); return; }
      draw();
    }, 1000);
    if (!hasMap) return;
    const center = (o.to && o.to.coords) || o.from.coords;
    window.DostavkaMap.create($('#trackMap'), { center, pinHtml: () => '', popupHtml: () => '', onSelect: () => {} }).then((m) => {
      if (!document.body.contains($('#trackMap'))) { m.destroy(); return; }
      trackMap = m;
      const pts = [];
      if (o.from.coords) { m.setMarker('from', o.from.coords, pointPin('A', 'pin-a')); pts.push(o.from.coords); }
      if (o.to.coords) { m.setMarker('to', o.to.coords, pointPin('B', 'pin-b')); pts.push(o.to.coords); }
      if (o.route) m.setRoute(o.route.path);
      const pr0 = DL.progress(o);
      if (pr0.courier) pts.push(pr0.courier);
      m.fitTo(pts.length ? pts : [center]);
      updateTrackMap(o, pr0);
    });
  }

  function repeatOrder(id) {
    const o = state.orders.find((x) => x.id === id);
    const place = o && placeById(o.placeId);
    if (!place) return;
    const items = {};
    o.items.forEach((it) => {
      for (const s of menuFor(place)) {
        const found = s.items.find((x) => x.name === it.name);
        if (found) items[found.id] = it.qty;
      }
    });
    state.cart = { placeId: place.id, items };
    saveCart();
    location.hash = '#/place/' + place.id;
    setTimeout(() => openCart(true), 0);
  }

  // ---------- Роутер ----------
  function route() {
    const hash = location.hash || '#/';
    openCart(false);
    $$('dialog[open]').forEach((d) => d.close());
    if (spy) { spy.disconnect(); spy = null; }
    stopTracking();
    const parts = hash.replace(/^#\/?/, '').split('/');
    if (parts[0] !== '') destroyMap();
    delete $('#view').dataset.kind;
    if (parts[0] === 'place' && parts[1]) {
      const p = placeById(decodeURIComponent(parts[1]));
      if (p && p.city !== state.city) { state.city = p.city; store.set('city', p.city); renderAddressButton(); }
      renderPlace(decodeURIComponent(parts[1]));
    } else if (parts[0] === 'checkout') {
      renderCheckout();
    } else if (parts[0] === 'orders' && parts[1]) {
      renderTracking(parts[1]);
    } else if (parts[0] === 'orders') {
      renderOrders();
    } else if (parts[0] === 'send') {
      renderSend(parts[1] === 'buy' ? 'buy' : 'courier');
    } else {
      renderHome();
    }
    renderCartIndicators();
    ensureQuote();
    window.scrollTo(0, 0);
  }

  // ---------- События ----------
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button, a, [data-place-row], [data-dish]');
    if (!t) return;
    const d = t.dataset;
    if (d.add) { changeQty(d.place, d.add, 1); return; }
    if (d.dec) { changeQty(d.place, d.dec, -1); return; }
    if ('clearCart' in d) { clearCart(); return; }
    if ('closeModal' in d) { t.closest('dialog').close(); return; }
    if ('pickAddress' in d) { openAddressModal(); return; }
    if (d.pickPoint) {
      const kind = $('#view').dataset.kind;
      picker.open({
        title: d.pickPoint === 'from' ? (kind === 'buy' ? 'Где купить?' : 'Откуда забрать?') : 'Куда привезти?',
        value: sendDraft[d.pickPoint],
        details: true,
        onDone: (addr) => {
          sendDraft[d.pickPoint] = addr;
          if (d.pickPoint === 'to') setAddress(addr);
          renderSend(kind);
        }
      });
      return;
    }
    if (d.city) { setCity(d.city); return; }
    if (d.info) { openInfo(d.info); return; }
    if (d.dish) { openDish(d.place, d.dish); return; }
    if (d.cat) {
      state.category = d.cat;
      $$('#chips [data-cat]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.cat === d.cat));
      renderResults();
      return;
    }
    if (d.view) {
      state.view = d.view;
      $$('[data-view]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.view === d.view));
      renderResults();
      return;
    }
    if (d.jump) { e.preventDefault(); jumpToSection(d.jump); return; }
    if (d.placeRow && !e.target.closest('a')) { highlight(d.placeRow, true); return; }
    if (d.share) {
      const url = d.share;
      if (navigator.share) navigator.share({ title: 'Отслеживание заказа', url }).catch(() => {});
      else navigator.clipboard.writeText(url).then(() => toast('Ссылка скопирована'), () => toast(url));
      return;
    }
    if (d.cancel) {
      if (!confirm('Отменить заказ?')) return;
      const o = state.orders.find((x) => x.id === d.cancel);
      o.cancelled = true;
      store.set('orders', state.orders);
      trackStage = null;
      return;
    }
    if (d.star) {
      const n = +d.star;
      $$('#ratingBox [data-star]').forEach((b) => b.classList.toggle('on', +b.dataset.star <= n));
      $('#ratingBox').dataset.stars = n;
      return;
    }
    if (d.rate) {
      const stars = +($('#ratingBox').dataset.stars || 0);
      if (!stars) { toast('Поставьте оценку'); return; }
      const o = state.orders.find((x) => x.id === d.rate);
      o.rating = { stars, comment: $('#rateComment').value.trim(), saved: true };
      store.set('orders', state.orders);
      trackStage = null;
      toast('Спасибо за оценку!');
      return;
    }
    if (d.repeat) { repeatOrder(d.repeat); return; }
    if (t.id === 'nearMe') {
      if (state.userPos) { state.userPos = null; t.setAttribute('aria-pressed', 'false'); renderResults(); return; }
      locateUser(() => { t.setAttribute('aria-pressed', 'true'); renderResults(); });
    }
  });

  document.addEventListener('change', (e) => {
    if (e.target.id === 'doorOpt') {
      state.door = e.target.checked;
      store.set('door', state.door);
      if ($('#view').dataset.kind) { updateSendQuote($('#view').dataset.kind); return; }
      renderCartIndicators();
      refreshAfterCartChange(null, null);
      ensureQuote();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.dataset) {
      if (e.target.dataset.placeRow) location.hash = '#/place/' + e.target.dataset.placeRow;
    }
    if (e.key === 'Escape') openCart(false);
  });

  document.addEventListener('input', (e) => {
    if (e.target.id === 'search' || e.target.id === 'searchMobile') {
      state.query = e.target.value;
      const other = $(e.target.id === 'search' ? '#searchMobile' : '#search');
      if (other) other.value = state.query;
      if (location.hash && location.hash !== '#/' && location.hash !== '#') { location.hash = '#/'; return; }
      renderResults();
    }
    if (e.target.id === 'menuSearch') {
      state.menuQuery = e.target.value;
      const p = placeById($('#view').dataset.place);
      if (p) { $('#menuSections').innerHTML = menuSectionsHtml(p); setupScrollSpy(); }
    }
  });

  // Закрытие окон по клику на затемнение.
  $$('dialog').forEach((dlg) => dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); }));

  $('#cartButton').addEventListener('click', () => openCart(true));
  $('#cartBar').addEventListener('click', () => openCart(true));
  $('#cartClose').addEventListener('click', () => openCart(false));
  $('#cartOverlay').addEventListener('click', () => openCart(false));
  $('#addressButton').addEventListener('click', openAddressModal);
  window.addEventListener('hashchange', route);

  // Список заказов обновляем раз в 30 секунд, пока он открыт.
  setInterval(() => {
    if (location.hash === '#/orders') renderOrders();
  }, 30000);

  renderAddressButton();
  route();
})();
