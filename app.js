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

  const DELIVERY = { fee: 150, freeFrom: 2000, minOrder: 500 };

  const STATUSES = [
    { key: 'new', label: 'Принят' },
    { key: 'cooking', label: 'Готовится' },
    { key: 'onway', label: 'В пути' },
    { key: 'delivered', label: 'Доставлен' }
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
    view: 'list',
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

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  const rub = (n) => n.toLocaleString('ru-RU') + ' ₽';

  function placesCount(n) {
    const m10 = n % 10;
    const m100 = n % 100;
    const word = m10 === 1 && m100 !== 11 ? 'заведение'
      : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? 'заведения'
      : 'заведений';
    return n + ' ' + word;
  }

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
    toast.t = setTimeout(() => { el.hidden = true; }, 2600);
  }

  // ---------- Корзина ----------
  function saveCart() {
    store.set('cart', state.cart);
    renderCartBadge();
    renderCartDrawer();
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
    if (location.hash.startsWith('#/place/')) renderPlace(placeId, true);
    if (location.hash.startsWith('#/checkout')) {
      if (!cartCount()) { renderCheckout(); return; }
      $('#checkoutSide').innerHTML = '<h2>Состав</h2>' + cartSummaryHtml(false);
      $('#submitOrder').textContent = 'Подтвердить заказ на ' + rub(cartTotals().total);
      $('#submitOrder').disabled = !cartTotals().canOrder;
    }
  }

  function qtyControl(placeId, itemId) {
    const qty = state.cart.placeId === placeId ? state.cart.items[itemId] || 0 : 0;
    if (!qty) {
      return `<button class="add-btn" data-add="${esc(itemId)}" data-place="${esc(placeId)}" type="button">+ В корзину</button>`;
    }
    return `<span class="qty">
      <button type="button" data-dec="${esc(itemId)}" data-place="${esc(placeId)}" aria-label="Убрать">−</button>
      <span>${qty}</span>
      <button type="button" data-add="${esc(itemId)}" data-place="${esc(placeId)}" aria-label="Добавить">+</button>
    </span>`;
  }

  function cartSummaryHtml(withButton) {
    const lines = cartLines();
    const place = placeById(state.cart.placeId);
    if (!lines.length) return '<p class="empty">Корзина пуста. Выберите заведение и добавьте блюда.</p>';
    const t = cartTotals();
    return `
      <div class="cart-place">Заказ из <a href="#/place/${esc(place.id)}"><b>${esc(place.name)}</b></a> · ${esc(place.city)}</div>
      ${lines.map((l) => `
        <div class="cart-line">
          <div>${esc(l.item.name)}<div class="unit">${rub(l.item.price)} / ${esc(l.item.unit)}</div></div>
          <div class="line-sum">${rub(l.item.price * l.qty)}</div>
          <div>${qtyControl(place.id, l.item.id)}</div>
        </div>`).join('')}
      <div class="totals">
        <div><span>Блюда</span><span>${rub(t.subtotal)}</span></div>
        <div><span>Доставка</span><span>${t.fee ? rub(t.fee) : 'бесплатно'}</span></div>
        <div class="total"><span>Итого</span><span>${rub(t.total)}</span></div>
      </div>
      ${t.canOrder
        ? (t.fee ? `<p class="hint">Добавьте ещё на ${rub(DELIVERY.freeFrom - t.subtotal)} — доставка будет бесплатной.</p>` : '')
        : `<p class="hint warn">Минимальный заказ — ${rub(DELIVERY.minOrder)}.</p>`}
      ${withButton ? `<a class="primary" href="#/checkout" ${t.canOrder ? '' : 'aria-disabled="true" onclick="return false" style="background:#aaa;cursor:not-allowed"'}>Оформить заказ</a>` : ''}
    `;
  }

  function renderCartBadge() {
    $('#cartCount').textContent = cartCount();
  }

  function renderCartDrawer() {
    $('#cartBody').innerHTML = cartSummaryHtml(true);
  }

  function openCart(open) {
    $('#cartDrawer').hidden = !open;
    $('#cartOverlay').hidden = !open;
    if (open) renderCartDrawer();
  }

  // ---------- Город ----------
  function renderCityLabel() {
    $('#cityLabel').textContent = (state.city || 'выберите').toUpperCase();
  }

  function openCityModal() {
    const counts = {};
    DATA.places.forEach((p) => { counts[p.city] = (counts[p.city] || 0) + 1; });
    $('#cityGrid').innerHTML = cityNames().map((c) => `
      <button type="button" data-city="${esc(c)}" aria-pressed="${c === state.city}">
        ${esc(c)}<small>${placesCount(counts[c] || 0)}</small>
      </button>`).join('');
    const modal = $('#cityModal');
    if (!modal.open) modal.showModal();
  }

  function setCity(city) {
    state.city = city;
    store.set('city', city);
    renderCityLabel();
    $('#cityModal').close();
    if (!location.hash || location.hash === '#/' || location.hash === '#') renderCatalog();
    else location.hash = '#/';
  }

  // ---------- Каталог ----------
  function filteredPlaces() {
    const q = state.query.trim().toLowerCase();
    let list = DATA.places.filter((p) =>
      p.city === state.city &&
      (state.category === 'all' || (state.category === 'delivery' ? p.ownDelivery : p.categories.includes(state.category))) &&
      (!q || (p.name + ' ' + (p.address || '') + ' ' + (p.description || '')).toLowerCase().includes(q))
    );
    if (state.userPos) {
      list = list
        .map((p) => ({ p, d: p.coords ? distanceKm(state.userPos, p.coords) : Infinity }))
        .sort((a, b) => a.d - b.d)
        .map((x) => x.p);
    }
    return list;
  }

  function avatarHtml(p, extraClass) {
    const cls = 'avatar' + (extraClass ? ' ' + extraClass : '') + (p.logo ? ' has-logo' : '');
    const inner = p.logo ? `<img src="${esc(p.logo)}" alt="" loading="lazy">` : esc(initials(p.name));
    return `<div class="${cls}" data-cat="${esc(p.categories[0])}">${inner}</div>`;
  }

  function placeRowHtml(p) {
    const dist = state.userPos && p.coords ? ` · ${distanceKm(state.userPos, p.coords).toFixed(1)} км` : '';
    return `
      <div class="place-row${p.id === state.activePlaceId ? ' is-active' : ''}" data-place-row="${esc(p.id)}" tabindex="0">
        ${avatarHtml(p)}
        <div>
          <h3>${esc(p.name)}</h3>
          <div class="meta">${p.categories.map((c) => `<span class="badge">${esc(CATEGORIES[c])}</span>`).join('')}${p.ownDelivery ? '<span class="badge">своя доставка</span>' : ''}${p.verified ? '<span class="badge badge-ok">✓ проверено</span>' : ''}</div>
          <div class="meta">${esc(p.address || 'Адрес уточняется')}${dist}</div>
        </div>
        <a class="go" href="#/place/${esc(p.id)}">Меню →</a>
      </div>`;
  }

  function renderCatalog() {
    if (!state.city) {
      $('#view').innerHTML = `<section class="hero"><span class="label">01 / ДОСТАВКА</span>
        <h1>Халяль-еда<br><em>с доставкой</em></h1><p>Сначала выберите город.</p></section>`;
      openCityModal();
      return;
    }
    $('#view').innerHTML = `
      <section class="hero">
        <span class="label">01 / ${esc(state.city.toUpperCase())}</span>
        <h1>Еда и продукты<br><em>с доставкой</em></h1>
        <p>Выберите заведение на карте или в списке, соберите заказ — курьер привезёт его домой. Только халяль-места из проверенного каталога.</p>
      </section>
      <div class="toolbar">
        <input class="search" id="search" type="search" placeholder="Поиск: название, блюдо, улица" value="${esc(state.query)}" aria-label="Поиск">
        <div class="chips" id="chips">
          ${Object.entries(CATEGORIES).map(([k, v]) => `<button class="chip" type="button" data-cat="${k}" aria-pressed="${state.category === k}">${v}</button>`).join('')}
          <button class="chip" type="button" id="nearMe" aria-pressed="${!!state.userPos}">📍 Рядом со мной</button>
        </div>
        <div class="view-switch" role="group" aria-label="Вид">
          <button type="button" data-view="list" aria-pressed="${state.view === 'list'}">Список</button>
          <button type="button" data-view="map" aria-pressed="${state.view === 'map'}">Карта</button>
        </div>
      </div>
      <div class="tabs" role="group" aria-label="Город">
        ${cityNames().map((c) => `<button type="button" data-city="${esc(c)}" aria-pressed="${c === state.city}">${esc(c)}</button>`).join('')}
      </div>
      <section class="catalog" id="catalog" data-view="${state.view}">
        <div class="list" id="list"></div>
        <div class="map-wrap"><div class="map" id="map"></div></div>
      </section>`;
    initMap();
    renderList();
  }

  function renderList() {
    const places = filteredPlaces();
    const noCoords = places.filter((p) => !p.coords).length;
    $('#list').innerHTML = `
      <div class="list-count">${placesCount(places.length)}${noCoords ? ` · ${noCoords} без точки на карте` : ''}</div>
      ${places.length ? places.map(placeRowHtml).join('') : '<p class="empty">Ничего не нашлось. Попробуйте другую категорию или запрос.</p>'}`;
    renderMarkers(places);
  }

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
    document.querySelectorAll('[data-place-row]').forEach((el) => {
      el.classList.toggle('is-active', el.dataset.placeRow === id);
    });
    if (fromList && map) {
      if (state.view !== 'map' && window.matchMedia('(max-width: 860px)').matches) return;
      map.focus(id);
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
  function renderPlace(id, keepScroll) {
    const p = placeById(id);
    if (!p) { $('#view').innerHTML = '<p class="empty">Заведение не найдено. <a href="#/">К списку</a></p>'; return; }
    const y = window.scrollY;
    const menu = menuFor(p);
    const isDemo = !MENUS.byPlace[p.id];
    const source = (MENUS.sources || {})[p.id];
    const phones = (p.phones || []).map((ph) => `<a href="tel:+${esc(waPhone(ph))}">${esc(ph)}</a>`).join(', ');
    $('#view').innerHTML = `
      <div class="place-page">
        <div>
          <a class="back" href="#/">← Все заведения</a>
          <div class="place-head">
            <span class="label">${p.categories.map((c) => esc(CATEGORIES[c])).join(' · ')} · ${esc(p.city)}</span>
            <div class="place-title">${p.logo ? avatarHtml(p, 'avatar-lg') : ''}<h1>${esc(p.name)}</h1></div>
            ${p.description ? `<p style="margin-top:10px">${esc(p.description)}</p>` : ''}
            <div class="place-info">
              <span>📍 ${esc(p.address || 'Адрес уточняется')}</span>
              ${p.workingHours ? `<span>🕒 ${esc(p.workingHours)}</span>` : ''}
              ${phones ? `<span>☎ ${phones}</span>` : ''}
              ${(p.socials || []).map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.label)}</a>`).join('')}
              ${twoGisPlaceUrl(p) ? `<a href="${esc(twoGisPlaceUrl(p))}" target="_blank" rel="noopener">Открыть в 2ГИС</a>` : ''}
              ${twoGisRouteUrl(p) ? `<a href="${esc(twoGisRouteUrl(p))}" target="_blank" rel="noopener">Маршрут в 2ГИС</a>` : ''}
              <span>🚚 ${rub(DELIVERY.fee)}, бесплатно от ${rub(DELIVERY.freeFrom)}</span>
            </div>
            ${isDemo ? '<p class="demo-note">Меню демонстрационное: цены и позиции уточняются у заведения.</p>' : ''}
            ${source ? `<p class="demo-note">${esc(source.text || `Меню и цены — с сервиса ${source.name} на ${source.date}. В заведении цены могут отличаться.`)}</p>` : ''}
          </div>
          <div class="menu-nav">${menu.map((s, i) => `<a class="chip" href="#" data-jump="sec-${i}">${esc(s.section)}</a>`).join('')}</div>
          ${menu.map((s, i) => `
            <section class="menu-section" id="sec-${i}">
              <h2>${esc(s.section)}</h2>
              <div class="menu-grid">
                ${s.items.map((it) => `
                  <article class="dish${it.photo ? ' has-photo' : ''}">
                    ${it.photo ? `<img class="dish-photo" src="${esc(it.photo)}" alt="${esc(it.name)}" loading="lazy">` : ''}
                    <h3>${esc(it.name)}</h3>
                    <p>${esc(it.desc || '')}</p>
                    <div class="dish-foot">
                      <span class="price">${rub(it.price)} <small>/ ${esc(it.unit)}</small></span>
                      ${qtyControl(p.id, it.id)}
                    </div>
                  </article>`).join('')}
              </div>
            </section>`).join('')}
        </div>
        <aside class="side">
          <div class="side-card">
            <h2>Ваш заказ</h2>
            ${cartSummaryHtml(true)}
          </div>
        </aside>
      </div>`;
    if (keepScroll) window.scrollTo(0, y);
  }

  // ---------- Оформление ----------
  function renderCheckout() {
    const lines = cartLines();
    if (!lines.length) {
      $('#view').innerHTML = '<div class="page"><h1>Оформление</h1><p class="empty">Корзина пуста. <a href="#/"><u>Выбрать заведение</u></a></p></div>';
      return;
    }
    const last = store.get('customer', {});
    $('#view').innerHTML = `
      <div class="page">
        <a class="back" href="#/place/${esc(state.cart.placeId)}">← Вернуться к меню</a>
        <h1>Оформление заказа</h1>
        <div class="checkout">
          <form class="form" id="checkoutForm" novalidate>
            <div class="row2">
              <div class="field"><label for="f-name">Имя</label><input id="f-name" name="name" required autocomplete="name" value="${esc(last.name || '')}"></div>
              <div class="field"><label for="f-phone">Телефон</label><input id="f-phone" name="phone" type="tel" required autocomplete="tel" placeholder="+7 900 000-00-00" value="${esc(last.phone || '')}"></div>
            </div>
            <div class="field">
              <label for="f-address">Адрес доставки (${esc(placeById(state.cart.placeId).city)})</label>
              <input id="f-address" name="address" required autocomplete="street-address" placeholder="Улица, дом" value="${esc(last.address || '')}">
              <button class="locate" type="button" id="useLocation">📍 Отправить мою геопозицию курьеру</button>
              <span class="hint" id="geoHint"></span>
            </div>
            <div class="row2">
              <div class="field"><label for="f-flat">Квартира / офис</label><input id="f-flat" name="flat" value="${esc(last.flat || '')}"></div>
              <div class="field"><label for="f-entrance">Подъезд, этаж</label><input id="f-entrance" name="entrance" value="${esc(last.entrance || '')}"></div>
            </div>
            <div class="row2">
              <div class="field">
                <label for="f-when">Когда доставить</label>
                <select id="f-when" name="when">
                  <option value="asap">Как можно скорее</option>
                  <option value="time">Ко времени</option>
                </select>
              </div>
              <div class="field"><label for="f-time">Время</label><input id="f-time" name="time" type="time" disabled></div>
            </div>
            <fieldset class="field">
              <legend>Оплата</legend>
              <div class="radios">
                ${Object.entries(PAYMENT).map(([k, v], i) => `<label class="radio"><input type="radio" name="payment" value="${k}" ${i === 0 ? 'checked' : ''}> ${v}</label>`).join('')}
              </div>
            </fieldset>
            <div class="field"><label for="f-comment">Комментарий</label><textarea id="f-comment" name="comment" placeholder="Например: позвонить за 10 минут, без лука"></textarea></div>
            <p class="hint warn" id="formError" hidden></p>
            <button class="primary" id="submitOrder" type="submit" ${cartTotals().canOrder ? '' : 'disabled'}>Подтвердить заказ на ${rub(cartTotals().total)}</button>
          </form>
          <aside class="side"><div class="side-card" id="checkoutSide"><h2>Состав</h2>${cartSummaryHtml(false)}</div></aside>
        </div>
      </div>`;

    $('#f-when').addEventListener('change', (e) => {
      $('#f-time').disabled = e.target.value !== 'time';
    });
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
    if (!v('name')) problem = 'Укажите имя.';
    else if (phoneDigits.length < 10) problem = 'Укажите телефон, чтобы курьер мог связаться с вами.';
    else if (!v('address')) problem = 'Укажите адрес доставки.';
    else if (v('when') === 'time' && !v('time')) problem = 'Укажите время доставки.';
    if (problem) { err.textContent = problem; err.hidden = false; return; }

    const customer = { name: v('name'), phone: v('phone'), address: v('address'), flat: v('flat'), entrance: v('entrance') };
    store.set('customer', customer);

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
      customer,
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
    const addr = [o.customer.address, o.customer.flat && 'кв. ' + o.customer.flat, o.customer.entrance].filter(Boolean).join(', ');
    return [
      `Заказ №${o.number} (Халяль Доставка)`,
      lines,
      `Блюда: ${rub(o.subtotal)}, доставка: ${o.fee ? rub(o.fee) : 'бесплатно'}`,
      `Итого: ${rub(o.total)}`,
      `Имя: ${o.customer.name}`,
      `Телефон: ${o.customer.phone}`,
      `Адрес: ${o.city}, ${addr}`,
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
      <article class="order-card" ${focused ? 'style="border-width:2px;border-color:var(--accent)"' : ''}>
        <div class="order-top">
          <div>
            <span class="label">№${esc(o.number)} · ${esc(date)}</span>
            <h3>${esc(o.placeName)}</h3>
          </div>
          <span class="status" data-s="${s.key}">${esc(s.label)}</span>
        </div>
        ${s.idx >= 0 ? `
          <div class="steps">${STATUSES.map((_, i) => `<i class="${i <= s.idx ? 'on' : ''}"></i>`).join('')}</div>
          <div class="steps-labels">${STATUSES.map((x) => `<span>${x.label}</span>`).join('')}</div>` : ''}
        <div class="order-items">${o.items.map((i) => `${esc(i.name)} × ${i.qty}`).join(', ')}</div>
        <div class="order-items">${esc(o.city)}, ${esc(o.customer.address)} · ${esc(o.when)} · ${esc(PAYMENT[o.payment])} · <b style="color:var(--ink)">${rub(o.total)}</b></div>
        <div class="order-actions">
          ${phone ? `<a href="https://wa.me/${phone}?text=${encodeURIComponent(orderText(o))}" target="_blank" rel="noopener">Отправить заведению в WhatsApp</a>
                     <a href="tel:+${phone}">Позвонить</a>` : '<span class="hint">У заведения не указан телефон — уточните заказ по месту.</span>'}
          <button type="button" data-copy="${esc(o.id)}">Скопировать заказ</button>
          ${!o.cancelled && s.idx < 2 ? `<button type="button" data-cancel="${esc(o.id)}">Отменить</button>` : ''}
          <button type="button" data-repeat="${esc(o.id)}">Повторить</button>
        </div>
      </article>`;
  }

  function renderOrders(focusId) {
    $('#view').innerHTML = `
      <div class="page">
        <span class="label">02 / ИСТОРИЯ</span>
        <h1>Мои заказы</h1>
        ${state.orders.length
          ? state.orders.map((o) => orderCardHtml(o, o.id === focusId)).join('') +
            '<p class="hint">Демо-режим: заказы хранятся в этом браузере, статусы меняются автоматически. После подключения сервера их будут обновлять заведение и курьер.</p>'
          : '<p class="empty">Заказов пока нет. <a href="#/"><u>Выбрать заведение</u></a></p>'}
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
    openCart(true);
  }

  // ---------- Роутер ----------
  function route() {
    const hash = location.hash || '#/';
    openCart(false);
    const parts = hash.replace(/^#\/?/, '').split('/');
    if (parts[0] !== '') destroyMap();
    if (parts[0] === 'place' && parts[1]) {
      const p = placeById(decodeURIComponent(parts[1]));
      if (p && p.city !== state.city) { state.city = p.city; store.set('city', p.city); renderCityLabel(); }
      renderPlace(decodeURIComponent(parts[1]));
    } else if (parts[0] === 'checkout') {
      renderCheckout();
    } else if (parts[0] === 'orders') {
      renderOrders(parts[1]);
    } else {
      renderCatalog();
    }
    window.scrollTo(0, 0);
  }

  // ---------- События ----------
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button, a, [data-place-row]');
    if (!t) return;
    const d = t.dataset;
    if (d.add) { changeQty(d.place, d.add, 1); return; }
    if (d.dec) { changeQty(d.place, d.dec, -1); return; }
    if (d.city) { setCity(d.city); return; }
    if (d.cat) {
      state.category = d.cat;
      document.querySelectorAll('#chips [data-cat]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.cat === d.cat));
      renderList();
      return;
    }
    if (d.view) {
      state.view = d.view;
      $('#catalog').dataset.view = d.view;
      document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.view === d.view));
      if (map) setTimeout(() => map.resize(), 0);
      return;
    }
    if (d.jump) { e.preventDefault(); document.getElementById(d.jump).scrollIntoView({ behavior: 'smooth' }); return; }
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
      if (state.userPos) { state.userPos = null; t.setAttribute('aria-pressed', 'false'); renderList(); return; }
      locateUser(() => { t.setAttribute('aria-pressed', 'true'); renderList(); });
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.dataset && e.target.dataset.placeRow) {
      location.hash = '#/place/' + e.target.dataset.placeRow;
    }
    if (e.key === 'Escape') openCart(false);
  });

  document.addEventListener('input', (e) => {
    if (e.target.id === 'search') { state.query = e.target.value; renderList(); }
  });

  $('#cartButton').addEventListener('click', () => openCart(true));
  $('#cartClose').addEventListener('click', () => openCart(false));
  $('#cartOverlay').addEventListener('click', () => openCart(false));
  $('#cityButton').addEventListener('click', openCityModal);
  window.addEventListener('hashchange', route);

  // Обновляем статусы заказов раз в 30 секунд, пока открыт экран заказов.
  setInterval(() => {
    if (location.hash.startsWith('#/orders')) renderOrders(location.hash.split('/')[2]);
  }, 30000);

  renderCityLabel();
  renderCartBadge();
  route();
})();
