// Доставка: адреса, маршрут, тарифы и ход заказа.
// Тариф и правила — по образцу службы «Такси Анжи» (тариф «Курьер»).
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
  // Тариф один — «Курьер»: доставка из заведения и из точки, выбранной в каталоге, до клиента.
  // Как у «Такси Анжи»: подача 100 ₽ + 28 ₽ за км по городу (33 ₽ между городами), 3 минуты ожидания
  // бесплатно, дальше 7 ₽/мин. Подача и километры умножаются на динамический коэффициент (surge) из
  // surge-engine.js: он зависит только от погоды и пробок (ясно и без пробок — ровно 1).
  // Платное ожидание прибавляется сверху, без коэффициента. Сколько минут теряется в пробках,
  // берём у Яндекс Карт (время с пробками минус без пробок), а без ключа Яндекса — у 2ГИС:
  // время маршрута сейчас минус время того же маршрута в 4 часа ночи, когда пробок нет.
  const TARIFFS = {
    courier: {
      id: 'courier',
      name: 'Курьер',
      icon: '🛵',
      about: 'Доставим заказ из заведения до двери',
      base: 100,            // подача — прибавляется к каждой поездке
      surge: 1,             // запасной коэффициент, если surge-engine.js не подключён или нет точки подачи
      perKm: 28,            // по городу
      perKmIntercity: 33,   // между городами: точки A и B в разных городах (Махачкала ↔ Каспийск)
      freeKmh: 30,          // скорость для оценки времени, когда маршрут 2ГИС недоступен
      jamPerMin: 7,         // больше не используется: пробки теперь входят в коэффициент surge
      doorFee: 50,          // «Курьер к двери» — поднимется и отдаст в руки
      freeWaitMin: 3,
      waitPerMin: 7
    }
  };
  TARIFFS.courier.min = TARIFFS.courier.base; // дешевле подачи поездка не бывает — для подписей «от 100 ₽»
  // Старые заказы (до 15.10.2026) могли ссылаться на тариф «buy» — считаем их по «Курьеру».
  TARIFFS.buy = TARIFFS.courier;

  // ---------- Динамический коэффициент (surge-engine.js) ----------
  // surge-engine.js нужно подключить на странице раньше этого файла. Без него коэффициент = t.surge (1).
  const SURGE = window.SurgeEngine ? window.SurgeEngine.create(CONFIG.surge) : null;
  if (!SURGE) console.warn('surge-engine.js не подключён — динамический коэффициент считаем равным 1');

  // Погода для коэффициента: Open-Meteo, без ключа, обновляем раз в 10 минут.
  // Пока погода не загрузилась, считаем «ясно».
  const WX = { key: 'clear', tempC: null, at: 0 };
  function loadWeather() {
    if (!SURGE || typeof fetch === 'undefined') return;
    const c = SURGE.config.center;
    fetch('https://api.open-meteo.com/v1/forecast?latitude=' + c.lat + '&longitude=' + c.lon +
      '&current=temperature_2m,precipitation,weather_code&timezone=Europe%2FMoscow')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
      .then((d) => {
        WX.key = window.SurgeEngine.weatherFromOpenMeteo(d.current);
        WX.tempC = d.current.temperature_2m;
        WX.at = Date.now();
      })
      .catch((e) => console.warn('Погода недоступна, коэффициент считаем как при ясной погоде:', e));
  }
  loadWeather();
  if (SURGE) setInterval(loadWeather, 10 * 60000);

  // Коэффициент для поездки. Нужна точка подачи opts.from — [lat, lon] или { lat, lon }.
  // Балл пробок 0–10: во сколько раз поездка сейчас дольше, чем без пробок.
  // lostMin — минуты, потерянные в пробках (null — неизвестно, тогда пробок не считаем).
  function surgeFor(t, km, minutes, lostMin, opts) {
    const from = opts && opts.from;
    if (!SURGE || !from) return { k: t.surge || 1, auto: false };
    const lat = Array.isArray(from) ? from[0] : from.lat;
    const lon = Array.isArray(from) ? from[1] : (from.lon != null ? from.lon : from.lng);
    if (typeof lat !== 'number' || typeof lon !== 'number') return { k: t.surge || 1, auto: false };
    const lost = Math.max(0, lostMin || 0);
    const freeMin = minutes - lost;
    const trafficScore = lostMin != null && freeMin > 0
      ? window.SurgeEngine.trafficScoreFromTimes(minutes * 60, freeMin * 60)
      : 0;
    const q = SURGE.quote({ from: { lat, lon }, distanceKm: km, durationMin: minutes, weather: WX.key, trafficScore });
    return {
      k: q.k, auto: true, trafficScore, weather: q.weatherName, weatherKey: q.weather, tempC: WX.tempC,
      factors: q.factors
    };
  }

  // Стоимость: (подача + километры по городской или междугородней ставке) × коэффициент,
  // округление до ближайших 10 ₽. Платное ожидание и опция «Курьер к двери» — сверху, без коэффициента.
  // opts: durationS, jamS, intercity, door — как раньше;
  //       from — точка подачи [lat, lon] (нужна для коэффициента);
  //       waitMin — сколько минут курьер ждал (первые freeWaitMin бесплатно);
  //       date — время заказа (по умолчанию сейчас); surge — задать коэффициент вручную.
  function price(tariffId, distanceM, opts) {
    const t = TARIFFS[tariffId];
    const km = Math.max(0, distanceM) / 1000;
    const minutes = Math.max(0, (opts && opts.durationS) || 0) / 60;
    const rate = opts && opts.intercity ? t.perKmIntercity : t.perKm;
    const kmPart = km * rate;
    const hasJam = opts && typeof opts.jamS === 'number';
    const lost = hasJam ? opts.jamS / 60 : null;
    const jamMin = Math.max(0, Math.floor(lost || 0));
    const waitMin = Math.max(0, (opts && opts.waitMin) || 0);
    const paidWaitMin = Math.max(0, Math.ceil(waitMin - t.freeWaitMin));
    const waitPart = paidWaitMin * t.waitPerMin;
    const surgeInfo = surgeFor(t, km, minutes, lost, opts);
    const surge = (opts && opts.surge) || surgeInfo.k || 1;
    const raw = (t.base + kmPart) * surge;
    const ride = Math.round(raw / 10) * 10;
    const ex = extras(t, opts);
    return {
      ride, ...ex, total: ride + waitPart + ex.door,
      base: t.base, kmPart: Math.round(kmPart), waitPart, waitMin, paidWaitMin,
      surge, surgeInfo, raw: Math.round(raw),
      jam: 0, jamMin, jamSource: hasJam ? (opts.jamSource || 'yandex') : 'none',
      km: Math.round(km * 10) / 10, minutes: Math.round(minutes), rate, intercity: !!(opts && opts.intercity)
    };
  }

  // Опция «Курьер к двери». В заказах до 15.10.2026 вместо неё были «Выйти, забрать» и «Выйти, отдать»
  // (exitPick, exitDrop) — их сумма тоже лежит в door, поэтому старые заказы считаются как раньше.
  function extras(t, opts) {
    return { door: opts && opts.door ? t.doorFee : 0 };
  }

  // Цена, когда маршрут посчитать нельзя: подача плюс опции.
  function minPrice(tariffId, opts) {
    const t = TARIFFS[tariffId];
    const ex = extras(t, opts);
    return { ride: t.min, ...ex, total: t.min + ex.door, estimate: true };
  }

  // Между городами — когда у точек указаны разные города (Махачкала ↔ Каспийск).
  function isIntercity(a, b) {
    return !!(a && b && a.city && b.city && a.city !== b.city);
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

  // opts.traffic — узнать, сколько минут теряется в пробках (для расчёта цены):
  // у Яндекса, а без его ключа — у 2ГИС (сейчас минус ночью).
  async function route(a, b, opts) {
    const traffic = !!(opts && opts.traffic);
    const key = a.join(',') + '>' + b.join(',') + (traffic ? '|t' : '');
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
    const jam = traffic ? await yandexJam(a, b) : null;
    if (jam) {
      res.jamS = jam.jamS;
      res.jamSource = 'yandex';
    } else if (traffic && res && res.source === '2gis') {
      const night = await nightDuration(a, b);
      if (night) {
        res.jamS = Math.max(0, res.duration - night);
        res.jamSource = '2gis';
        res.freeS = night;
      }
    }
    if (!res) {
      // Оценка без маршрутизатора: прямая × 1,35, скорость как без пробок — надбавки нет.
      const d = haversine(a, b) * 1.35;
      res = { distance: Math.round(d), duration: Math.round(d / (TARIFFS.courier.freeKmh * 1000 / 3600)), path: [a, b], source: 'estimate' };
    }
    routeCache[key] = res;
    return res;
  }

  // ---------- Пробки (2ГИС): время того же маршрута в 4:00 ночи ----------
  // 2ГИС не отдаёт время «без пробок», но по статистике знает, сколько едут в любой час.
  // Ночью пробок нет — это время и берём за точку отсчёта. Берём ближайшую следующую ночь.
  function nightDuration(a, b) {
    const now = new Date();
    const msk = new Date(now.getTime() + 3 * 3600000);
    let at = Date.UTC(msk.getUTCFullYear(), msk.getUTCMonth(), msk.getUTCDate(), 4, 0) - 3 * 3600000;
    if (at <= now.getTime()) at += 86400000;
    const ask = fetch(ROUTING + '?key=' + KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        points: [{ type: 'stop', lat: a[0], lon: a[1] }, { type: 'stop', lat: b[0], lon: b[1] }],
        transport: 'driving',
        route_mode: 'fastest',
        traffic_mode: 'statistics',
        utc: Math.floor(at / 1000),
        output: 'summary'
      })
    }).then((r) => r.json()).then((d) => {
      const best = d.result && d.result[0];
      return best && best.duration > 0 ? best.duration : null;
    });
    const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 6000));
    return Promise.race([ask, timeout]).catch((e) => { console.warn('Время без пробок (2ГИС) недоступно:', e); return null; });
  }

  // ---------- Пробки (Яндекс Карты) ----------
  // Маршрут Яндекса на машине: duration — время без пробок, durationInTraffic — с текущими пробками.
  const YKEY = CONFIG.yandexMapsKey;
  let ymapsReady = null;

  function loadYmaps() {
    if (!ymapsReady) {
      ymapsReady = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://api-maps.yandex.ru/2.1/?lang=ru_RU&apikey=' + encodeURIComponent(YKEY);
        s.onload = () => window.ymaps.ready(() => resolve(window.ymaps), reject);
        s.onerror = reject;
        document.head.appendChild(s);
      }).catch((e) => { ymapsReady = null; throw e; });
    }
    return ymapsReady;
  }

  function yandexJam(a, b) {
    if (!YKEY || typeof document === 'undefined') return Promise.resolve(null);
    const ask = loadYmaps().then((ymaps) => new Promise((resolve) => {
      const model = new ymaps.multiRouter.MultiRouteModel([a, b], { routingMode: 'auto' });
      model.events.add('requestsuccess', () => {
        const r = model.getRoutes()[0];
        if (!r) { resolve(null); return; }
        const plain = r.properties.get('duration');
        const traffic = r.properties.get('durationInTraffic');
        resolve(plain && traffic ? { jamS: Math.max(0, traffic.value - plain.value) } : null);
      });
      model.events.add('requestfail', () => resolve(null));
    }));
    // Если Яндекс не ответил за 6 секунд — считаем без него.
    const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 6000));
    return Promise.race([ask, timeout]).catch((e) => { console.warn('Пробки Яндекса недоступны:', e); return null; });
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
    // Ожидание на месте забора.
    const wait = order.type === 'food' ? 60 : 3 * 60;
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
    TARIFFS, STAGES, price, minPrice, isIntercity, suggest, reverse, route, pointAt, courierStart, timeline, progress, progressLive,
    haversine, savedAddresses: loadSaved, rememberAddress,
    forgetAddress(i) { const l = loadSaved(); l.splice(i, 1); saveSaved(l); },
    hasGeo: () => !!KEY,
    weather: () => ({ ...WX }),
    surgeEngine: SURGE
  };
})();
