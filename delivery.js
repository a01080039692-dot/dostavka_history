// Доставка: адреса, маршрут, тарифы и ход заказа.
// Тарифы и правила — по образцу службы «Такси Анжи» (тарифы «Курьер» и «Купим и привезём»).
//
// Пока нет приложения для курьеров, курьера изображает сайт: поиск, движение к точке забора
// и к клиенту считаются по времени от момента заказа (см. timeline). Когда появится сервер,
// эти данные будет присылать приложение курьера, а интерфейс останется прежним.
(function () {
  'use strict';

  const CONFIG = window.DOSTAVKA_CONFIG || {};
  const KEY = CONFIG.twoGisKey;
  const CATALOG = 'https://catalog.api.2gis.com/3.0';
  const ROUTING = 'https://routing.api.2gis.com/routing/7.0.0/global';

  // ---------- Тариф ----------
  // Пока тариф один — «Курьер»: доставка из заведения, посылки и «купим и привезём».
  const TARIFFS = {
    courier: {
      id: 'courier',
      name: 'Курьер',
      icon: '🛵',
      about: 'Доставим заказ или посылку, купим и привезём — от двери до двери',
      min: 100,
      perKmCity: 28,
      perKmOut: 33,
      freeWaitMin: 3,
      waitPerMin: 7,
      doorFee: 50 // выход курьера: отдать или забрать
    }
  };
  // Заказы, оформленные до объединения тарифов, ссылаются на «buy».
  TARIFFS.buy = TARIFFS.courier;

  // Стоимость: не меньше минимальной, за километры — городской или загородный тариф,
  // плюс выход курьера к двери. Округляем до 10 ₽, как принято у такси.
  function price(tariffId, distanceM, opts) {
    const t = TARIFFS[tariffId];
    const km = Math.max(0, distanceM) / 1000;
    const rate = opts && opts.outOfCity ? t.perKmOut : t.perKmCity;
    const byKm = Math.ceil((km * rate) / 10) * 10;
    const ride = Math.max(t.min, byKm);
    const door = opts && opts.door ? t.doorFee : 0;
    return { ride, door, total: ride + door, km: Math.round(km * 10) / 10, rate, outOfCity: !!(opts && opts.outOfCity) };
  }

  // ---------- Адреса (2ГИС Каталог) ----------
  async function getJson(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  function cityOf(fullName) {
    const s = String(fullName || '');
    if (s.startsWith('Каспийск')) return 'Каспийск';
    if (s.startsWith('Махачкала')) return 'Махачкала';
    return s.split(',')[0].trim() || null;
  }

  function toAddress(item) {
    if (!item || !item.point) return null;
    const full = item.full_name || item.address_name || item.name;
    return {
      label: item.address_name || item.name || full,
      full,
      city: cityOf(full),
      coords: [item.point.lat, item.point.lon]
    };
  }

  async function suggest(q, near) {
    if (!KEY || !q.trim()) return [];
    const u = new URL(CATALOG + '/suggests');
    u.searchParams.set('q', q);
    u.searchParams.set('type', 'building,street,branch,attraction,adm_div.place');
    u.searchParams.set('fields', 'items.point,items.full_name');
    if (near) u.searchParams.set('location', near[1] + ',' + near[0]);
    u.searchParams.set('key', KEY);
    const d = await getJson(u);
    return ((d.result && d.result.items) || []).map(toAddress).filter(Boolean).slice(0, 7);
  }

  async function reverse(coords) {
    if (!KEY) return null;
    const u = new URL(CATALOG + '/items/geocode');
    u.searchParams.set('lat', coords[0]);
    u.searchParams.set('lon', coords[1]);
    u.searchParams.set('fields', 'items.point,items.full_name');
    u.searchParams.set('key', KEY);
    const d = await getJson(u);
    const items = (d.result && d.result.items) || [];
    const best = items.find((i) => i.type === 'building') || items[0];
    const a = toAddress(best);
    if (a) a.coords = coords; // точка — та, куда поставили пин
    return a;
  }

  // ---------- Маршрут (2ГИС Маршрутизация) ----------
  const routeCache = {};

  function haversine(a, b) {
    const R = 6371000;
    const rad = (x) => (x * Math.PI) / 180;
    const dLat = rad(b[0] - a[0]);
    const dLon = rad(b[1] - a[1]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function parseLine(wkt) {
    const m = /LINESTRING\((.*)\)/.exec(wkt || '');
    if (!m) return [];
    return m[1].split(',').map((p) => {
      const [lon, lat] = p.trim().split(/\s+/).map(Number);
      return [lat, lon];
    });
  }

  async function route(a, b) {
    const key = a.join(',') + '>' + b.join(',');
    if (routeCache[key]) return routeCache[key];
    let res = null;
    if (KEY) {
      try {
        const r = await fetch(ROUTING + '?key=' + KEY, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            points: [{ type: 'stop', lat: a[0], lon: a[1] }, { type: 'stop', lat: b[0], lon: b[1] }],
            transport: 'driving',
            route_mode: 'fastest',
            output: 'detailed',
            locale: 'ru'
          })
        });
        const d = await r.json();
        const best = d.result && d.result[0];
        if (best) {
          const path = [];
          (best.maneuvers || []).forEach((mv) => {
            ((mv.outcoming_path && mv.outcoming_path.geometry) || []).forEach((g) => {
              parseLine(g.selection).forEach((pt) => {
                const last = path[path.length - 1];
                if (!last || last[0] !== pt[0] || last[1] !== pt[1]) path.push(pt);
              });
            });
          });
          res = { distance: best.total_distance, duration: best.total_duration, path: path.length > 1 ? path : [a, b], source: '2gis' };
        }
      } catch (e) {
        console.warn('Маршрут 2ГИС недоступен, считаем по прямой:', e);
      }
    }
    if (!res) {
      // Оценка без маршрутизатора: прямая × 1,35, средняя скорость 30 км/ч.
      const d = haversine(a, b) * 1.35;
      res = { distance: Math.round(d), duration: Math.round(d / (30000 / 3600)), path: [a, b], source: 'estimate' };
    }
    routeCache[key] = res;
    return res;
  }

  // Точка на маршруте через долю пути 0…1.
  function pointAt(path, frac) {
    if (!path || !path.length) return null;
    if (path.length === 1 || frac <= 0) return path[0];
    if (frac >= 1) return path[path.length - 1];
    const seg = [];
    let total = 0;
    for (let i = 1; i < path.length; i++) {
      const d = haversine(path[i - 1], path[i]);
      seg.push(d);
      total += d;
    }
    let left = total * frac;
    for (let i = 0; i < seg.length; i++) {
      if (left <= seg[i]) {
        const k = seg[i] ? left / seg[i] : 0;
        const p = path[i];
        const q = path[i + 1];
        return [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k];
      }
      left -= seg[i];
    }
    return path[path.length - 1];
  }

  // Откуда «выезжает» демо-курьер: точка примерно в 1,5 км от места забора.
  function courierStart(pickup, seed) {
    const ang = ((seed % 360) * Math.PI) / 180;
    const d = 0.013; // ≈ 1,4 км
    return [pickup[0] + d * Math.sin(ang), pickup[1] + d * Math.cos(ang) * 1.35];
  }

  // ---------- Ход заказа ----------
  const SEARCH_SEC = 40;          // поиск курьера
  const COOKING_SEC = 15 * 60;    // заведение готовит заказ

  const STAGES = {
    search: { label: 'Ищем курьера', icon: '🔎' },
    toPickup: { label: 'Курьер едет за заказом', icon: '🛵' },
    atPickup: { label: 'Курьер на месте', icon: '📦' },
    toClient: { label: 'Курьер везёт заказ', icon: '🛵' },
    delivered: { label: 'Доставлен', icon: '✅' },
    cancelled: { label: 'Отменён', icon: '✖' }
  };

  // Расписание заказа: секунды от момента оформления.
  function timeline(order) {
    const approach = (order.approach && order.approach.duration) || 300;
    const ride = (order.route && order.route.duration) || 900;
    const assigned = SEARCH_SEC;
    const arrive = assigned + approach;
    const ready = order.type === 'food' ? COOKING_SEC : 0;
    // Ожидание на месте забора: покупка дольше, чем просто забрать посылку.
    const wait = order.type === 'buy' || order.purchase ? 10 * 60 : order.type === 'courier' ? 3 * 60 : 60;
    const depart = Math.max(arrive, ready) + (order.type === 'food' ? 60 : wait);
    const deliveredAt = depart + ride;
    const start = order.scheduledAt ? Math.max(0, (order.scheduledAt - order.createdAt) / 1000 - deliveredAt) : 0;
    return { start, assigned: start + assigned, arrive: start + arrive, depart: start + depart, delivered: start + deliveredAt };
  }

  function progress(order, now) {
    if (order.cancelled) return { stage: 'cancelled', ...STAGES.cancelled };
    const t = ((now || Date.now()) - order.createdAt) / 1000;
    const tl = timeline(order);
    let stage;
    let courier = null;
    let eta = null;
    if (t < tl.start) stage = 'scheduled';
    else if (t < tl.assigned) stage = 'search';
    else if (t < tl.arrive) {
      stage = 'toPickup';
      courier = pointAt(order.approach && order.approach.path, (t - tl.assigned) / (tl.arrive - tl.assigned));
    } else if (t < tl.depart) {
      stage = 'atPickup';
      courier = order.from.coords;
    } else if (t < tl.delivered) {
      stage = 'toClient';
      courier = pointAt(order.route && order.route.path, (t - tl.depart) / (tl.delivered - tl.depart));
    } else stage = 'delivered';
    if (stage !== 'delivered') eta = order.createdAt + tl.delivered * 1000;
    const info = stage === 'scheduled' ? { label: 'Запланирован', icon: '🕒' } : STAGES[stage];
    return { stage, ...info, courier, eta, tl, elapsed: t };
  }

  // Ход заказа, который ведёт водитель в приложении (disp — запись из DostavkaBus.dispatch).
  // Время прибытия оцениваем по прямой до следующей точки: × 1,35 на изгибы дорог, 30 км/ч.
  const SPEED = 30000 / 3600;
  const etaSec = (a, b) => (a && b ? (haversine(a, b) * 1.35) / SPEED : 0);

  function progressLive(order, disp, driver, now) {
    if (order.cancelled) return { stage: 'cancelled', ...STAGES.cancelled, live: true };
    now = now || Date.now();
    const pos = driver && driver.pos;
    const ride = (order.route && order.route.duration) || etaSec(order.from.coords, order.to.coords);
    const st = disp && disp.status;
    let stage;
    let eta = null;
    if (!st) {
      stage = order.scheduledAt && order.scheduledAt - now > 60 * 60000 ? 'scheduled' : 'search';
    } else if (st === 'accepted') {
      stage = 'toPickup';
      const ready = order.type === 'food' ? Math.max(0, order.createdAt / 1000 + COOKING_SEC - now / 1000) : 0;
      eta = now + (Math.max(etaSec(pos, order.from.coords), ready) + 120 + ride) * 1000;
    } else if (st === 'arrived') {
      stage = 'atPickup';
      eta = now + (120 + ride) * 1000;
    } else if (st === 'picked') {
      stage = 'toClient';
      eta = now + Math.max(60, etaSec(pos, order.to.coords)) * 1000;
    } else stage = 'delivered';
    const info = stage === 'scheduled' ? { label: 'Запланирован', icon: '🕒' } : STAGES[stage];
    const courier = ['toPickup', 'atPickup', 'toClient'].includes(stage) ? pos || null : null;
    return { stage, ...info, courier, eta, live: true, driver: disp && disp.driver };
  }

  // ---------- Сохранённые адреса ----------
  function loadSaved() {
    try { return JSON.parse(localStorage.getItem('dostavka.addresses') || '[]'); } catch (e) { return []; }
  }

  function saveSaved(list) {
    try { localStorage.setItem('dostavka.addresses', JSON.stringify(list.slice(0, 12))); } catch (e) { /* без сохранения */ }
  }

  function rememberAddress(addr, tag) {
    if (!addr || !addr.coords) return;
    const list = loadSaved().filter((a) => !(a.label === addr.label && a.city === addr.city) && (!tag || a.tag !== tag));
    list.unshift({ ...addr, tag: tag || addr.tag || '' });
    saveSaved(list);
  }

  window.DostavkaDelivery = {
    TARIFFS, STAGES, price, suggest, reverse, route, pointAt, courierStart, timeline, progress, progressLive,
    haversine, savedAddresses: loadSaved, rememberAddress,
    forgetAddress(i) { const l = loadSaved(); l.splice(i, 1); saveSaved(l); },
    hasGeo: () => !!KEY
  };
})();
