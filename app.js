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

  const DELIVERY = { fee: 150, freeFrom: 2000, minOrder: 500 };

  const STATUSES = [
    { key: 'new', label: 'Принят', icon: '📝' },
    { key: 'cooking', label: 'Готовится', icon: '👨‍🍳' },
    { key: 'onway', label: 'В пути', icon: '🛵' },
    { key: 'delivered', label: 'Доставлен', icon: '✅' }
  ];

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
    activePlaceId: null
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
    const fee = subtotal === 0 || subtotal >= DELIVERY.freeFrom ? 0 : DELIVERY.fee;
    return { subtotal, fee, total: subtotal + fee, canOrder: subtotal >= DELIVERY.minOrder };
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
    if (location.hash.startsWith('#/checkout')) {
      if (!cartCount()) { renderCheckout(); return; }
      $('#checkoutSummary').innerHTML = summaryHtml();
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

  function freeProgressHtml(t) {
    if (!t.subtotal) return '';
    if (t.fee === 0) return '<div class="free-progress">🎉 Доставка бесплатная</div>';
    const pct = Math.min(100, Math.round((t.subtotal / DELIVERY.freeFrom) * 100));
    return `<div class="free-progress">Ещё ${rub(DELIVERY.freeFrom - t.subtotal)} до бесплатной доставки
      <div class="track"><i style="width:${pct}%"></i></div></div>`;
  }

  function totalsHtml(t) {
    return `<div class="totals">
      <div><span>Товары</span><span>${rub(t.subtotal)}</span></div>
      <div><span>Доставка</span><span>${t.fee ? rub(t.fee) : 'бесплатно'}</span></div>
      <div class="total"><span>Итого</span><span>${rub(t.total)}</span></div>
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
    const c = customer();
    $('#addressLabel').textContent = c.address ? addressLine(c) : 'Укажите адрес доставки';
  }

  function renderCitySwitch(container) {
    container.innerHTML = cityNames().map((c) =>
      `<button type="button" data-city="${esc(c)}" aria-pressed="${c === state.city}">${esc(c)}</button>`).join('');
  }

  function openAddressModal() {
    renderCitySwitch($('#cityGrid'));
    const c = customer();
    const f = $('#addressForm');
    f.address.value = c.address || '';
    f.flat.value = c.flat || '';
    f.entrance.value = c.entrance || '';
    f.floor.value = c.floor || '';
    const modal = $('#addressModal');
    if (!modal.open) modal.showModal();
  }

  function setCity(city) {
    if (city === state.city) return;
    state.city = city;
    store.set('city', city);
    renderAddressButton();
    if ($('#addressModal').open) renderCitySwitch($('#cityGrid'));
    if (!location.hash || location.hash === '#/' || location.hash === '#') renderHome();
    else if (!location.hash.startsWith('#/checkout')) location.hash = '#/';
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
    const parts = [CATEGORIES[p.categories[0]], 'Доставка ' + rub(DELIVERY.fee)];
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
      openAddressModal();
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
            <h1>Халяль-еда и продукты<br>с доставкой</h1>
            <p>Рестораны, фастфуд, кофейни и мясные магазины ${esc(state.city === 'Каспийск' ? 'Каспийска' : 'Махачкалы')} — только из проверенного каталога.</p>
          </div>
          <span class="promo-emoji" aria-hidden="true">🥙</span>
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
        <div class="dish-photo">${it.photo ? `<img src="${esc(it.photo)}" alt="${esc(it.name)}" loading="lazy">` : '<span aria-hidden="true">🍽</span>'}</div>
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
                <span class="hero-chip">🛵 Доставка ${rub(DELIVERY.fee)}, от ${rub(DELIVERY.freeFrom)} — бесплатно</span>
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
  function setupScrollSpy() {
    if (spy) spy.disconnect();
    const links = $$('#menuNav a');
    if (!links.length || !('IntersectionObserver' in window)) return;
    spy = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        links.forEach((a) => {
          const on = a.dataset.jump === en.target.id;
          a.classList.toggle('is-active', on);
          if (on && window.matchMedia('(max-width: 1024px)').matches) a.scrollIntoView({ inline: 'center', block: 'nearest' });
        });
      });
    }, { rootMargin: '-30% 0px -60% 0px' });
    $$('.menu-section').forEach((s) => spy.observe(s));
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
        <div class="info-row"><span>🛵</span><span>Доставка ${rub(DELIVERY.fee)}, бесплатно от ${rub(DELIVERY.freeFrom)}. Минимальный заказ — ${rub(DELIVERY.minOrder)}.</span></div>
        ${links ? `<div class="info-links">${links}</div>` : ''}
      </div>`;
    $('#infoModal').showModal();
  }

  // ---------- Оформление ----------
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
      ${freeProgressHtml(t)}
      ${totalsHtml(t)}
      ${t.canOrder ? '' : `<p class="hint warn" style="margin-bottom:10px">Минимальная сумма заказа — ${rub(DELIVERY.minOrder)}.</p>`}
      <button class="btn btn-primary btn-block" id="submitOrder" type="submit" form="checkoutForm" ${t.canOrder ? '' : 'disabled'}>
        <span>Оформить заказ</span><span class="btn-sum">${rub(t.total)}</span>
      </button>
      <p class="hint" style="margin-top:10px">Оплата при получении. После оформления заказ нужно отправить заведению в WhatsApp.</p>`;
  }

  function renderCheckout() {
    if (!cartLines().length) {
      $('#view').innerHTML = '<div class="wrap page"><h1 class="page-title">Оформление</h1><div class="cart-empty"><span class="cart-empty-icon">🛒</span>Корзина пуста. <a href="#/"><u>Выбрать заведение</u></a></div></div>';
      return;
    }
    const c = customer();
    const city = placeById(state.cart.placeId).city;
    $('#view').innerHTML = `
      <div class="wrap page">
        <a class="back" href="#/place/${esc(state.cart.placeId)}">← Вернуться в меню</a>
        <h1 class="page-title">Оформление заказа</h1>
        <div class="checkout">
          <form class="form" id="checkoutForm" novalidate>
            <section class="block">
              <h2>Адрес доставки · ${esc(city)}</h2>
              <div class="form">
                <div class="field"><label for="f-address">Улица и дом</label><input id="f-address" name="address" required autocomplete="street-address" placeholder="Например, проспект Гамидова, 12" value="${esc(c.address || '')}"></div>
                <div class="row3">
                  <div class="field"><label for="f-flat">Кв./офис</label><input id="f-flat" name="flat" value="${esc(c.flat || '')}"></div>
                  <div class="field"><label for="f-entrance">Подъезд</label><input id="f-entrance" name="entrance" value="${esc(c.entrance || '')}"></div>
                  <div class="field"><label for="f-floor">Этаж</label><input id="f-floor" name="floor" value="${esc(c.floor || '')}"></div>
                </div>
                <div class="field"><label for="f-courier">Комментарий курьеру</label><input id="f-courier" name="courier" placeholder="Например, домофон не работает — позвоните" value="${esc(c.courier || '')}"></div>
                <button class="locate" type="button" id="useLocation">📍 Отправить курьеру мою геопозицию</button>
                <span class="hint" id="geoHint"></span>
              </div>
            </section>
            <section class="block">
              <h2>Когда доставить</h2>
              <div class="choice-grid">
                <label class="choice"><input type="radio" name="when" value="asap" checked> Как можно скорее</label>
                <label class="choice"><input type="radio" name="when" value="time"> Ко времени
                  <input id="f-time" name="time" type="time" disabled style="margin-left:auto;border:0;background:var(--surface);border-radius:10px;padding:6px 8px"></label>
              </div>
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

    $$('input[name="when"]').forEach((r) => r.addEventListener('change', () => {
      const t = $('#f-time');
      t.disabled = $('input[name="when"]:checked').value !== 'time';
      if (!t.disabled) t.focus();
    }));
    $('#useLocation').addEventListener('click', () => {
      locateUser((pos) => {
        $('#geoHint').textContent = `Геопозиция добавлена: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
      });
    });
    $('#checkoutForm').addEventListener('submit', submitOrder);
  }

  function submitOrder(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    const v = (k) => String(f.get(k) || '').trim();
    const err = $('#formError');
    const phoneDigits = v('phone').replace(/\D/g, '');
    let problem = '';
    if (!v('address')) problem = 'Укажите адрес доставки.';
    else if (!v('name')) problem = 'Укажите имя.';
    else if (phoneDigits.length < 10) problem = 'Укажите телефон, чтобы курьер мог связаться с вами.';
    else if (v('when') === 'time' && !v('time')) problem = 'Укажите время доставки.';
    if (problem) {
      err.textContent = problem;
      err.hidden = false;
      err.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }

    const cust = { name: v('name'), phone: v('phone'), address: v('address'), flat: v('flat'), entrance: v('entrance'), floor: v('floor'), courier: v('courier') };
    store.set('customer', cust);
    renderAddressButton();

    const place = placeById(state.cart.placeId);
    const t = cartTotals();
    const order = {
      id: 'o' + Date.now().toString(36),
      number: String(Date.now()).slice(-5),
      placeId: place.id,
      placeName: place.name,
      city: place.city,
      items: cartLines().map((l) => ({ name: l.item.name, price: l.item.price, unit: l.item.unit, qty: l.qty })),
      subtotal: t.subtotal,
      fee: t.fee,
      total: t.total,
      customer: cust,
      geo: state.userPos,
      when: v('when') === 'time' ? v('time') : 'Как можно скорее',
      payment: v('payment'),
      comment: v('comment'),
      createdAt: Date.now(),
      cancelled: false
    };
    state.orders.unshift(order);
    store.set('orders', state.orders);
    state.cart = { placeId: null, items: {} };
    saveCart();
    location.hash = '#/orders/' + order.id;
    toast(place.phones ? 'Заказ оформлен! Отправьте его заведению в WhatsApp, чтобы его приняли в работу.' : 'Заказ оформлен!');
  }

  // ---------- Заказы ----------
  // Пока нет сервера, статус меняется по времени — для демонстрации.
  function orderStatus(o) {
    if (o.cancelled) return { idx: -1, key: 'cancelled', label: 'Отменён' };
    const min = (Date.now() - o.createdAt) / 60000;
    const idx = min < 2 ? 0 : min < 20 ? 1 : min < 50 ? 2 : 3;
    return { idx, ...STATUSES[idx] };
  }

  function orderText(o) {
    const lines = o.items.map((i) => `• ${i.name} × ${i.qty} = ${rub(i.price * i.qty)}`).join('\n');
    return [
      `Заказ №${o.number} (Халяль Доставка)`,
      lines,
      `Товары: ${rub(o.subtotal)}, доставка: ${o.fee ? rub(o.fee) : 'бесплатно'}`,
      `Итого: ${rub(o.total)}`,
      `Имя: ${o.customer.name}`,
      `Телефон: ${o.customer.phone}`,
      `Адрес: ${o.city}, ${addressLine(o.customer)}`,
      o.customer.courier ? `Курьеру: ${o.customer.courier}` : '',
      o.geo ? `Точка на карте 2ГИС: ${twoGisPointUrl(o.city, o.geo)}` : '',
      `Когда: ${o.when}`,
      `Оплата: ${PAYMENT[o.payment]}`,
      o.comment ? `Комментарий: ${o.comment}` : ''
    ].filter(Boolean).join('\n');
  }

  function orderCardHtml(o, focused) {
    const s = orderStatus(o);
    const place = placeById(o.placeId);
    const phone = place && place.phones ? waPhone(place.phones[0]) : '';
    const date = new Date(o.createdAt).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    return `
      <article class="order-card${focused ? ' is-focused' : ''}">
        <div class="order-top">
          <div>
            <h3>${esc(o.placeName)}</h3>
            <div class="order-sub">Заказ №${esc(o.number)} · ${esc(date)} · ${rub(o.total)}</div>
          </div>
          <span class="status" data-s="${s.key}">${esc(s.label)}</span>
        </div>
        ${s.idx >= 0 ? `
          <div class="tracker">${STATUSES.map((x, i) => `
            <div class="tracker-step${i <= s.idx ? ' on' : ''}"><span class="tracker-icon" aria-hidden="true">${x.icon}</span><i></i>${esc(x.label)}</div>`).join('')}
          </div>` : ''}
        <div class="order-items">${o.items.map((i) => `${esc(i.name)} × ${i.qty}`).join(', ')}</div>
        <div class="order-items muted">${esc(o.city)}, ${esc(addressLine(o.customer))} · ${esc(o.when)} · ${esc(PAYMENT[o.payment])}</div>
        <div class="order-actions">
          ${phone ? `<a class="btn btn-primary" href="https://wa.me/${phone}?text=${encodeURIComponent(orderText(o))}" target="_blank" rel="noopener">Отправить заведению в WhatsApp</a>
                     <a class="btn" href="tel:+${phone}">Позвонить</a>` : '<span class="hint">У заведения не указан телефон — уточните заказ по месту.</span>'}
          <button class="btn" type="button" data-copy="${esc(o.id)}">Скопировать</button>
          <button class="btn" type="button" data-repeat="${esc(o.id)}">Повторить</button>
          ${!o.cancelled && s.idx < 2 ? `<button class="btn" type="button" data-cancel="${esc(o.id)}">Отменить</button>` : ''}
        </div>
      </article>`;
  }

  function renderOrders(focusId) {
    $('#view').innerHTML = `
      <div class="wrap page">
        <h1 class="page-title">Мои заказы</h1>
        ${state.orders.length
          ? `<div class="orders">${state.orders.map((o) => orderCardHtml(o, o.id === focusId)).join('')}</div>
             <p class="hint" style="margin-top:16px;max-width:860px">Демо-режим: заказы хранятся в этом браузере, статусы меняются автоматически. После подключения сервера их будут обновлять заведение и курьер.</p>`
          : '<div class="cart-empty"><span class="cart-empty-icon">🧾</span>Заказов пока нет. <a href="#/"><u>Выбрать заведение</u></a></div>'}
      </div>`;
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
    const parts = hash.replace(/^#\/?/, '').split('/');
    if (parts[0] !== '') destroyMap();
    if (parts[0] === 'place' && parts[1]) {
      const p = placeById(decodeURIComponent(parts[1]));
      if (p && p.city !== state.city) { state.city = p.city; store.set('city', p.city); renderAddressButton(); }
      renderPlace(decodeURIComponent(parts[1]));
    } else if (parts[0] === 'checkout') {
      renderCheckout();
    } else if (parts[0] === 'orders') {
      renderOrders(parts[1]);
    } else {
      renderHome();
    }
    renderCartIndicators();
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
    if (d.jump) { e.preventDefault(); const el = document.getElementById(d.jump); if (el) el.scrollIntoView({ behavior: 'smooth' }); return; }
    if (d.placeRow && !e.target.closest('a')) { highlight(d.placeRow, true); return; }
    if (d.copy) {
      const o = state.orders.find((x) => x.id === d.copy);
      navigator.clipboard.writeText(orderText(o)).then(() => toast('Заказ скопирован'), () => toast('Не удалось скопировать'));
      return;
    }
    if (d.cancel) {
      if (!confirm('Отменить заказ? Если вы уже отправили его заведению, сообщите им об отмене.')) return;
      const o = state.orders.find((x) => x.id === d.cancel);
      o.cancelled = true;
      store.set('orders', state.orders);
      renderOrders();
      return;
    }
    if (d.repeat) { repeatOrder(d.repeat); return; }
    if (t.id === 'nearMe') {
      if (state.userPos) { state.userPos = null; t.setAttribute('aria-pressed', 'false'); renderResults(); return; }
      locateUser(() => { t.setAttribute('aria-pressed', 'true'); renderResults(); });
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

  $('#addressForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    const c = { ...customer(), address: f.address.value.trim(), flat: f.flat.value.trim(), entrance: f.entrance.value.trim(), floor: f.floor.value.trim() };
    store.set('customer', c);
    renderAddressButton();
    $('#addressModal').close();
    if (!state.city) { toast('Выберите город'); openAddressModal(); return; }
    toast(c.address ? 'Адрес сохранён' : 'Город выбран');
  });

  $('#cartButton').addEventListener('click', () => openCart(true));
  $('#cartBar').addEventListener('click', () => openCart(true));
  $('#cartClose').addEventListener('click', () => openCart(false));
  $('#cartOverlay').addEventListener('click', () => openCart(false));
  $('#addressButton').addEventListener('click', openAddressModal);
  window.addEventListener('hashchange', route);

  // Обновляем статусы заказов раз в 30 секунд, пока открыт экран заказов.
  setInterval(() => {
    if (location.hash.startsWith('#/orders')) renderOrders(location.hash.split('/')[2]);
  }, 30000);

  renderAddressButton();
  route();
})();
