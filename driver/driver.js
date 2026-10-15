// Приложение водителя (курьера) Доставки History.
// Связь с сайтом клиента — через DostavkaBus (../bus.js): заказы читаем, ход заказа и координаты пишем.
// Тестировать в одном браузере: сайт клиента в одной вкладке, это приложение — в другой.
(function () {
  'use strict';

  const BUS = window.DostavkaBus;
  const DL = window.DostavkaDelivery;
  const T = DL.TARIFFS.courier;

  const DEFAULT_POS = [42.973, 47.50389]; // центр Махачкалы — если геопозиция недоступна
  const OFFER_MAX_AGE = 3 * 3600 * 1000;  // старые неразобранные заказы не предлагаем
  const SPEEDS = [1, 5, 20];

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
  // Опции, которые заказал клиент: «Курьер к двери» (в старых заказах — «Выйти, забрать/отдать»).
  function exitText(o) {
    const p = (o.delivery && o.delivery.price) || {};
    if (p.exitPick || p.exitDrop) return [p.exitPick && 'выйти, забрать', p.exitDrop && 'выйти, отдать'].filter(Boolean).join(', ');
    return p.door ? 'курьер к двери — подняться и отдать в руки' : '';
  }

  const rub = (n) => Math.round(n).toLocaleString('ru-RU') + ' ₽';
  const fmtKm = (m) => (m / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 1 }) + ' км';
  const fmtMin = (s) => Math.max(1, Math.round(s / 60)) + ' мин';
  const digits = (p) => { let d = String(p || '').replace(/\D/g, ''); if (d.length === 11 && d[0] === '8') d = '7' + d.slice(1); return d; };
  const TRANSPORT = { car: '🚗 Автомобиль', moto: '🛵 Мото/скутер', bike: '🚲 Велосипед', foot: '🚶 Пешком' };
  const TRANSPORT_ICON = { car: '🚗', moto: '🛵', bike: '🚲', foot: '🚶' };
  const PAYMENT = { cash: 'Наличными', card: 'Картой', transfer: 'Переводом' };
  const CITY_SLUG = { 'Махачкала': 'makhachkala', 'Каспийск': 'kaspiysk' };

  function toast(text) {
    const el = $('#toast');
    el.textContent = text;
    el.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => { el.hidden = true; }, 3000);
  }

  function readLocal(key, fallback) {
    try { const r = localStorage.getItem('dostavka.driverApp.' + key); return r ? JSON.parse(r) : fallback; } catch (e) { return fallback; }
  }
  function writeLocal(key, v) {
    try { localStorage.setItem('dostavka.driverApp.' + key, JSON.stringify(v)); } catch (e) { /* без сохранения */ }
  }

  // ---------- Состояние ----------
  const saved = BUS.driver() || {};
  const state = {
    profile: saved.profile || null,
    online: false,                         // на линию выходим заново при каждом открытии
    pos: saved.pos || DEFAULT_POS,
    gps: readLocal('gps', false),          // false — демо-движение по маршруту, true — геопозиция телефона
    speed: readLocal('speed', 5),
    declined: new Set(),
    activeId: null,
    move: null,                            // { path, t0, duration } — демо-движение
    lastStage: null
  };

  // Мой текущий заказ: принят мной и ещё не завершён.
  function myId() { return state.profile ? digits(state.profile.phone) : ''; }
  function findActive() {
    const disp = BUS.dispatch();
    const id = Object.keys(disp).find((k) => disp[k].driver && digits(disp[k].driver.phone) === myId() && disp[k].status && !disp[k].closed);
    return id || null;
  }

  function orderById(id) { return BUS.order(id); }

  function offers() {
    const disp = BUS.dispatch();
    const now = Date.now();
    return BUS.orders().filter((o) => o.dispatchMode === 'driver' && !o.cancelled && !(disp[o.id] && disp[o.id].status) &&
      !state.declined.has(o.id) && now - o.createdAt < OFFER_MAX_AGE &&
      (!o.scheduledAt || o.scheduledAt - now < 60 * 60000));
  }

  // ---------- Заработок ----------
  function myDone() {
    const disp = BUS.dispatch();
    const orders = BUS.orders();
    return Object.entries(disp)
      .filter(([, d]) => d.status === 'delivered' && d.driver && digits(d.driver.phone) === myId())
      .map(([id, d]) => ({ id, d, o: orders.find((x) => x.id === id) }))
      .filter((x) => x.o)
      .sort((a, b) => b.d.deliveredAt - a.d.deliveredAt);
  }

  function earning(x) { return (x.o.fee || 0) + (x.d.waitFee || 0); }

  function renderEarn() {
    const today = new Date().toDateString();
    const sum = myDone().filter((x) => new Date(x.d.deliveredAt).toDateString() === today).reduce((s, x) => s + earning(x), 0);
    $('#earnBtn').textContent = rub(sum);
  }

  function openHistory() {
    const list = myDone();
    const today = new Date().toDateString();
    const todayList = list.filter((x) => new Date(x.d.deliveredAt).toDateString() === today);
    $('#historyBody').innerHTML = `
      <div class="d-stats">
        <div><b>${rub(todayList.reduce((s, x) => s + earning(x), 0))}</b><small>сегодня</small></div>
        <div><b>${todayList.length}</b><small>заказов сегодня</small></div>
        <div><b>${rub(list.reduce((s, x) => s + earning(x), 0))}</b><small>всего</small></div>
      </div>
      ${list.length ? list.map((x) => `
        <div class="d-hist">
          <div><b>${esc(typeLabel(x.o))}</b><small>${esc(new Date(x.d.deliveredAt).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))} · ${esc(x.o.from.label)} → ${esc(x.o.to.label)}</small></div>
          <b>${rub(earning(x))}</b>
        </div>`).join('') : '<p class="empty">Выполненных заказов пока нет</p>'}
      <p class="hint">Заработок — стоимость доставки и платного ожидания. Деньги за товары передаются заведению.</p>`;
    $('#historyModal').showModal();
  }

  // ---------- Карта ----------
  let map = null;
  let mapReady = null;

  function meHtml() {
    const t = state.profile ? TRANSPORT_ICON[state.profile.transport] || '🛵' : '🛵';
    return `<div class="courier-pin d-me${state.online ? ' is-online' : ''}">${t}</div>`;
  }

  function initMap() {
    mapReady = window.DostavkaMap.create($('#dMap'), { center: state.pos, pinHtml: () => '', popupHtml: () => '', onSelect: () => {} })
      .then((m) => { map = m; map.setView(state.pos, 14); drawMap(true); return m; })
      .catch(() => { $('#dMap').innerHTML = '<p class="empty">Карта не загрузилась</p>'; });
  }

  function pin(letter, cls) { return `<div class="route-pin ${cls}"><span>${letter}</span></div>`; }

  // fit — вписать точки заказа в экран (при смене этапа).
  function drawMap(fit) {
    if (!map) return;
    map.setMarker('me', state.pos, meHtml(), [18, 18]);
    const o = state.activeId && orderById(state.activeId);
    const d = o && BUS.dispatchOf(o.id);
    if (!o || !d) {
      map.removeMarker('a'); map.removeMarker('b'); map.setRoute(null);
      const offs = offers();
      offs.slice(0, 15).forEach((x, i) => { if (x.from.coords) map.setMarker('offer' + i, x.from.coords, pin('A', 'pin-a'), [16, 32]); });
      for (let i = offs.length; i < 15; i++) map.removeMarker('offer' + i);
      if (fit) map.fitTo([state.pos, ...offs.filter((x) => x.from.coords).map((x) => x.from.coords)]);
      return;
    }
    for (let i = 0; i < 15; i++) map.removeMarker('offer' + i);
    if (o.from.coords) map.setMarker('a', o.from.coords, pin('A', 'pin-a'), [16, 32]); else map.removeMarker('a');
    if (o.to.coords) map.setMarker('b', o.to.coords, pin('B', 'pin-b'), [16, 32]); else map.removeMarker('b');
    const toPickup = d.status === 'accepted' || d.status === 'arrived';
    const path = toPickup ? (state.move && state.move.kind === 'pickup' ? state.move.path : null) : o.route && o.route.path;
    map.setRoute(path || (o.route && o.route.path) || null);
    if (fit) {
      const target = toPickup ? o.from.coords : o.to.coords;
      map.fitTo([state.pos, target].filter(Boolean));
    }
  }

  // ---------- Геопозиция и демо-движение ----------
  let watchId = null;

  function setGps(on) {
    state.gps = on;
    writeLocal('gps', on);
    if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
    if (on) {
      if (!navigator.geolocation) { toast('Геопозиция недоступна в этом браузере'); state.gps = false; return; }
      watchId = navigator.geolocation.watchPosition(
        (p) => { state.pos = [p.coords.latitude, p.coords.longitude]; publish(); drawMap(false); },
        () => { toast('Нет доступа к геопозиции — включено демо-движение'); setGps(false); renderSheet(); },
        { enableHighAccuracy: true, maximumAge: 5000 }
      );
    }
  }

  async function startMove(kind, from, to, path) {
    if (!from || !to) { state.move = null; return; }
    const r = path ? { path, duration: null } : await DL.route(from, to);
    const p = path || r.path;
    // Длительность берём из маршрута; для готового пути A → B — из заказа.
    const o = orderById(state.activeId);
    const duration = r.duration || (o && o.route && o.route.duration) || 600;
    state.move = { kind, path: p, duration, t0: Date.now(), done: 0 };
    drawMap(true);
  }

  function tickMove() {
    const m = state.move;
    if (!m || state.gps) return;
    const now = Date.now();
    m.done += ((now - (m.last || m.t0)) / 1000) * state.speed;
    m.last = now;
    const frac = Math.min(1, m.done / m.duration);
    state.pos = DL.pointAt(m.path, frac);
    if (frac >= 1) state.move = null;
  }

  // ---------- Публикация для сайта клиента ----------
  function publish() {
    if (!state.profile) return;
    BUS.setDriver({ profile: state.profile, online: state.online, pos: state.pos });
  }

  // ---------- Действия с заказом ----------
  function typeLabel(o) {
    if (o.type === 'food') return 'Заказ из ' + o.placeName;
    return 'Курьер: забрать и привезти';
  }

  async function accept(id) {
    const o = orderById(id);
    if (!o) return;
    const d = BUS.dispatchOf(id);
    if (o.cancelled || (d && d.status)) { toast('Заказ уже недоступен'); renderSheet(); return; }
    BUS.setDispatch(id, { status: 'accepted', acceptedAt: Date.now(), closed: false, driver: { ...state.profile } });
    state.activeId = id;
    toast('Заказ принят. Едем к точке A');
    renderSheet();
    await startMove('pickup', state.pos, o.from.coords);
  }

  function decline(id) {
    state.declined.add(id);
    renderSheet();
    drawMap(false);
  }

  function arrived() {
    BUS.setDispatch(state.activeId, { status: 'arrived', arrivedAt: Date.now() });
    state.move = null;
    const o = orderById(state.activeId);
    if (o && o.from.coords) state.pos = o.from.coords;
    renderSheet();
    if (map && o && o.from.coords) map.setView(o.from.coords, 16);
  }

  function waitInfo(o, d) {
    if (!d || !d.arrivedAt) return { min: 0, fee: 0, free: T.freeWaitMin };
    const end = d.pickedAt || Date.now();
    const min = (end - d.arrivedAt) / 60000;
    // У заведения ждём, пока готовят, — это не вина клиента, ожидание не берём.
    const paid = o.type === 'food' ? 0 : Math.max(0, Math.ceil(min - T.freeWaitMin));
    return { min, fee: paid * T.waitPerMin, free: T.freeWaitMin };
  }

  async function picked() {
    const o = orderById(state.activeId);
    const d = BUS.dispatchOf(state.activeId);
    const w = waitInfo(o, d);
    BUS.setDispatch(state.activeId, { status: 'picked', pickedAt: Date.now(), waitFee: w.fee });
    renderSheet();
    if (o.route && o.route.path) await startMove('client', o.from.coords, o.to.coords, o.route.path);
    else await startMove('client', state.pos, o.to.coords);
  }

  function delivered() {
    const o = orderById(state.activeId);
    const d = BUS.dispatchOf(state.activeId);
    BUS.setDispatch(state.activeId, { status: 'delivered', deliveredAt: Date.now(), collect: collectSum(o, d) });
    state.move = null;
    if (o.to.coords) state.pos = o.to.coords;
    renderSheet();
    renderEarn();
  }

  function closeOrder() {
    BUS.setDispatch(state.activeId, { closed: true });
    state.activeId = null;
    state.lastStage = null;
    renderSheet();
    drawMap(true);
  }

  function release() {
    if (!confirm('Отказаться от заказа? Он вернётся в поиск курьера.')) return;
    BUS.setDispatch(state.activeId, { status: null, driver: null, acceptedAt: null, arrivedAt: null, closed: true });
    state.declined.add(state.activeId);
    state.activeId = null;
    state.move = null;
    renderSheet();
    drawMap(true);
  }

  function collectSum(o, d) {
    return (o.total || 0) + ((d && d.waitFee) || 0);
  }

  function navUrl(city, coords) {
    const slug = CITY_SLUG[city] || 'makhachkala';
    return `https://2gis.ru/${slug}/directions/points/${encodeURIComponent('|' + coords[1] + ',' + coords[0])}`;
  }

  // ---------- Нижняя панель ----------
  function demoControlsHtml() {
    return `
      <div class="d-demo">
        <span class="muted">Положение:</span>
        <div class="segmented" role="group" aria-label="Положение">
          <button type="button" data-gps="0" aria-pressed="${!state.gps}">Демо-движение</button>
          <button type="button" data-gps="1" aria-pressed="${state.gps}">GPS</button>
        </div>
        ${state.gps ? '' : `<div class="segmented" role="group" aria-label="Скорость">${SPEEDS.map((s) => `<button type="button" data-speed="${s}" aria-pressed="${state.speed === s}">×${s}</button>`).join('')}</div>`}
      </div>`;
  }

  function offerCardHtml(o) {
    const toA = o.from.coords ? DL.haversine(state.pos, o.from.coords) * 1.35 : null;
    const kind = o.type === 'food' ? '🍽 Из заведения' : '📦 Курьер';
    return `
      <article class="d-offer">
        <div class="d-offer-top">
          <span class="tag">${kind}</span>
          <b class="d-offer-price">${rub(o.fee)}</b>
        </div>
        <div class="route-points">
          <div class="route-point"><span class="dot dot-a">A</span><div><b>${esc(o.from.label)}</b><small>${esc(o.from.sub || o.from.city || '')}${toA ? ' · до вас ' + fmtKm(toA) : ''}</small></div></div>
          <div class="route-point"><span class="dot dot-b">B</span><div><b>${esc(o.to.label)}</b><small>${esc(o.to.city || '')}</small></div></div>
        </div>
        <div class="d-offer-meta">${o.route ? `${fmtKm(o.route.distance)} · ~${fmtMin(o.route.duration)}` : 'расстояние уточняется'} · ${esc(PAYMENT[o.payment] || '')}${o.scheduledAt ? ` · к ${new Date(o.scheduledAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : ''}</div>
        <div class="d-offer-actions">
          <button class="btn" type="button" data-decline="${esc(o.id)}">Пропустить</button>
          <button class="btn btn-primary" type="button" data-accept="${esc(o.id)}">Принять</button>
        </div>
      </article>`;
  }

  function detailsHtml(o, d) {
    const to = o.to || {};
    const toLine = [to.flat && 'кв. ' + to.flat, to.entrance && 'подъезд ' + to.entrance, to.floor && 'этаж ' + to.floor, to.intercom && 'домофон ' + to.intercom].filter(Boolean).join(', ');
    const placePhone = o.placePhone;
    return `
      <div class="track-block d-details">
        ${o.items && o.items.length ? `<div><b>Состав</b><ul class="d-items">${o.items.map((i) => `<li>${esc(i.name)} × ${i.qty}<span>${rub(i.price * i.qty)}</span></li>`).join('')}</ul></div>` : ''}
        ${o.what ? `<p><b>Забрать:</b> ${esc(o.what)}</p>` : ''}
        ${toLine ? `<p><b>Адрес:</b> ${esc(to.label)}, ${esc(toLine)}</p>` : ''}
        ${to.courier ? `<p><b>Курьеру:</b> ${esc(to.courier)}</p>` : ''}
        ${o.comment ? `<p><b>Комментарий:</b> ${esc(o.comment)}</p>` : ''}
        ${exitText(o) ? `<p><b>Опции:</b> ${esc(exitText(o))}</p>` : ''}
        <p><b>Клиент:</b> ${esc(o.customer.name)}, ${esc(o.customer.phone)}${o.recipientPhone ? ` · получатель ${esc(o.recipientPhone)}` : ''}</p>
        <div class="order-actions">
          <a class="btn" href="tel:+${esc(digits(o.customer.phone))}">📞 Клиенту</a>
          ${o.recipientPhone ? `<a class="btn" href="tel:+${esc(digits(o.recipientPhone))}">📞 Получателю</a>` : ''}
          ${placePhone ? `<a class="btn" href="tel:+${esc(digits(placePhone))}">📞 Заведению</a>` : ''}
        </div>
      </div>`;
  }

  function activeHtml(o, d) {
    const st = d.status;
    const target = st === 'accepted' || st === 'arrived' ? o.from : o.to;
    const nav = target.coords ? `<a class="btn" href="${esc(navUrl(target.city || o.city, target.coords))}" target="_blank" rel="noopener">🧭 Навигатор 2ГИС</a>` : '';
    const w = waitInfo(o, d);
    const left = target.coords ? DL.haversine(state.pos, target.coords) * 1.35 : null;
    if (st === 'delivered') {
      return `
        <div class="d-stage"><span class="track-icon">✅</span><div><h2>Заказ доставлен</h2><p class="muted">${esc(typeLabel(o))}</p></div></div>
        <div class="d-collect">
          <span>Получите с клиента</span>
          <b>${rub(d.collect || collectSum(o, d))}</b>
          <small>${esc(PAYMENT[o.payment] || '')}</small>
        </div>
        <div class="totals">
          ${o.subtotal ? `<div><span>Товары</span><span>${rub(o.subtotal)}</span></div>` : ''}
          <div><span>Доставка</span><span>${rub(o.fee)}</span></div>
          ${d.waitFee ? `<div><span>Платное ожидание</span><span>${rub(d.waitFee)}</span></div>` : ''}
          <div class="total"><span>Ваш заработок</span><span>${rub((o.fee || 0) + (d.waitFee || 0))}</span></div>
        </div>
        <button class="btn btn-primary btn-block" type="button" data-act="close">Готово</button>`;
    }
    const titles = {
      accepted: o.type === 'food' ? 'Едем в заведение' : 'Едем к точке A',
      arrived: o.type === 'food' ? 'Вы в заведении' : 'Вы на точке A',
      picked: 'Везём клиенту'
    };
    const mainBtn = {
      accepted: '<button class="btn btn-primary btn-block" type="button" data-act="arrived">Я на месте</button>',
      arrived: `<button class="btn btn-primary btn-block" type="button" data-act="picked">Забрал заказ</button>`,
      picked: '<button class="btn btn-primary btn-block" type="button" data-act="delivered">Доставил</button>'
    }[st];
    return `
      <div class="d-stage">
        <span class="track-icon">${st === 'arrived' ? '📦' : TRANSPORT_ICON[state.profile.transport] || '🛵'}</span>
        <div><h2>${titles[st]}</h2><p class="muted">${esc(typeLabel(o))} · ${rub(o.fee)}</p></div>
      </div>
      <div class="d-target">
        <span class="dot ${st === 'picked' ? 'dot-b' : 'dot-a'}">${st === 'picked' ? 'B' : 'A'}</span>
        <div><b>${esc(target.label)}</b><small>${esc(target.sub || target.city || '')}${left !== null && st !== 'arrived' ? ` · ${fmtKm(left)}` : ''}</small></div>
      </div>
      ${st === 'arrived' ? `<div class="d-wait" id="dWait">${waitText(o, w)}</div>` : ''}
      ${mainBtn}
      <div class="order-actions">${nav}${st !== 'picked' ? '<button class="btn" type="button" data-act="release">Отказаться</button>' : ''}</div>
      ${detailsHtml(o, d)}
      <div class="d-collect small"><span>К получению</span><b>${rub(collectSum(o, { waitFee: w.fee }))}</b><small>${esc(PAYMENT[o.payment] || '')}</small></div>`;
  }

  function waitText(o, w) {
    const mm = Math.floor(w.min);
    const ss = Math.floor((w.min - mm) * 60);
    const t = `${mm}:${String(ss).padStart(2, '0')}`;
    if (o.type === 'food') return `⏱ Ожидание ${t} · у заведения ожидание бесплатное`;
    return w.fee ? `⏱ Ожидание ${t} · платное: ${rub(w.fee)}` : `⏱ Ожидание ${t} · бесплатно ${w.free} мин`;
  }

  function renderSheet() {
    const sheet = $('#sheet');
    $('#onlineBtn').textContent = state.online ? 'На линии' : 'Не на линии';
    $('#onlineBtn').setAttribute('aria-pressed', String(state.online));
    if (!state.profile) {
      sheet.innerHTML = '<div class="d-empty"><h2>Заполните профиль</h2><p class="muted">Имя, телефон и транспорт увидит клиент.</p><button class="btn btn-primary btn-block" type="button" data-act="profile">Заполнить</button></div>';
      return;
    }
    const o = state.activeId && orderById(state.activeId);
    const d = o && BUS.dispatchOf(o.id);
    if (o && d && d.status) {
      if (o.cancelled && d.status !== 'delivered') {
        sheet.innerHTML = `<div class="d-empty"><h2>Клиент отменил заказ</h2><p class="muted">${esc(typeLabel(o))}</p><button class="btn btn-primary btn-block" type="button" data-act="close">Понятно</button></div>`;
        return;
      }
      sheet.innerHTML = activeHtml(o, d) + demoControlsHtml();
      return;
    }
    if (!state.online) {
      sheet.innerHTML = `
        <div class="d-empty">
          <h2>Вы не на линии</h2>
          <p class="muted">Выйдите на линию, чтобы получать заказы.</p>
          <button class="btn btn-primary btn-block" type="button" data-act="online">Выйти на линию</button>
        </div>
        ${demoControlsHtml()}`;
      return;
    }
    const list = offers();
    sheet.innerHTML = `
      <div class="d-head"><h2>${list.length ? `Новые заказы · ${list.length}` : 'Ищем заказы'}</h2>${list.length ? '' : '<div class="searching"><i></i><i></i><i></i></div>'}</div>
      ${list.length ? list.map(offerCardHtml).join('') : '<p class="muted">Заказы появятся здесь, как только клиент оформит доставку. Для теста откройте сайт в соседней вкладке и закажите.</p>'}
      ${demoControlsHtml()}`;
  }

  // ---------- Профиль ----------
  function openProfile() {
    const p = state.profile || {};
    const f = $('#profileForm');
    f.name.value = p.name || '';
    f.phone.value = p.phone || '';
    f.car.value = p.car || '';
    f.plate.value = p.plate || '';
    $$('input[name="transport"]', f).forEach((r) => { r.checked = r.value === (p.transport || 'car'); });
    $('#profileError').hidden = true;
    $('#profileModal').showModal();
  }

  $('#profileForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const v = (k) => String(f.get(k) || '').trim();
    const err = $('#profileError');
    if (!v('name')) { err.textContent = 'Укажите имя.'; err.hidden = false; return; }
    if (digits(v('phone')).length < 10) { err.textContent = 'Укажите телефон — по нему с вами свяжется клиент.'; err.hidden = false; return; }
    state.profile = { name: v('name'), phone: v('phone'), transport: v('transport') || 'car', car: v('car'), plate: v('plate') };
    publish();
    $('#profileModal').close();
    toast('Профиль сохранён');
    renderSheet();
    drawMap(false);
  });

  // ---------- События ----------
  function setOnline(on) {
    if (on && !state.profile) { openProfile(); return; }
    state.online = on;
    publish();
    toast(on ? 'Вы на линии' : 'Вы ушли с линии');
    renderSheet();
    drawMap(true);
  }

  document.addEventListener('click', (e) => {
    const t = e.target.closest('button, a');
    if (!t) return;
    const d = t.dataset;
    if ('closeModal' in d) { t.closest('dialog').close(); return; }
    if (d.accept) { accept(d.accept); return; }
    if (d.decline) { decline(d.decline); return; }
    if (d.gps !== undefined) { setGps(d.gps === '1'); renderSheet(); return; }
    if (d.speed) { state.speed = +d.speed; writeLocal('speed', state.speed); renderSheet(); return; }
    const act = d.act;
    if (act === 'arrived') arrived();
    else if (act === 'picked') picked();
    else if (act === 'delivered') delivered();
    else if (act === 'close') closeOrder();
    else if (act === 'release') release();
    else if (act === 'online') setOnline(true);
    else if (act === 'profile') openProfile();
  });

  $('#onlineBtn').addEventListener('click', () => setOnline(!state.online));
  $('#profileBtn').addEventListener('click', openProfile);
  $('#earnBtn').addEventListener('click', openHistory);
  $$('dialog').forEach((dlg) => dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); }));

  // Новые заказы и отмены с сайта клиента.
  let knownOffers = new Set(offers().map((o) => o.id));
  BUS.subscribe((key) => {
    if (key === BUS.KEYS.driver) return; // это мы сами
    const now = offers();
    const fresh = now.filter((o) => !knownOffers.has(o.id));
    knownOffers = new Set(now.map((o) => o.id));
    if (fresh.length && state.online && !state.activeId) {
      toast('Новый заказ!');
      if (navigator.vibrate) navigator.vibrate(200);
    }
    renderSheet();
    drawMap(false);
  });

  // Раз в секунду: движение, ожидание, отметка «на линии».
  let beat = 0;
  setInterval(() => {
    tickMove();
    const o = state.activeId && orderById(state.activeId);
    const d = o && BUS.dispatchOf(o.id);
    const w = $('#dWait');
    if (w && o && d) w.textContent = waitText(o, waitInfo(o, d));
    drawMap(false);
    beat += 1;
    // Координаты публикуем чаще, пока везём заказ, — клиент видит движение.
    if (state.profile && (state.move || beat % 5 === 0)) publish();
  }, 1000);

  window.addEventListener('beforeunload', () => { if (state.profile) BUS.setDriver({ online: false }); });

  // ---------- Запуск ----------
  state.activeId = findActive();
  if (state.activeId) {
    const o = orderById(state.activeId);
    const d = BUS.dispatchOf(state.activeId);
    if (o && d && d.status === 'accepted') startMove('pickup', state.pos, o.from.coords);
    if (o && d && d.status === 'picked') startMove('client', state.pos, o.to.coords);
    state.online = true;
  }
  if (state.gps) setGps(true);
  initMap();
  renderSheet();
  renderEarn();
  publish();
  if (!state.profile) openProfile();
})();
