/*
 * surge-engine.js — учебная модель повышающего коэффициента такси для Махачкалы.
 * Без зависимостей. Работает в браузере (window.SurgeEngine) и в Node.js (require).
 *
 * Главное:
 *   const engine = SurgeEngine.create();          // или create({ tariff: {...}, mosques: [...] })
 *   const q = engine.quote({
 *     from: { lat, lon },                         // точка подачи — по ней выбирается зона
 *     distanceKm: 8.2, durationMin: 17,           // из вашего сервиса маршрутов
 *     durationIsFreeFlow: true,                   // true для OSRM (время без пробок)
 *     date: new Date(),                           // момент заказа
 *     weather: "clear",                           // clear | rain | storm | heat | fog | ice
 *     trafficScore: 5                             // 0–10
 *   });
 *   q.k, q.price.surged, q.prayer, q.factors ...
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SurgeEngine = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var DEFAULTS = {
    center: { lat: 42.9694, lon: 47.4939 },      // Центральная джума-мечеть, ул. Дахадаева, 136
    cellKm: 0.9,                                  // радиус шестиугольной зоны, км
    extentKm: { x: 9, y: 8 },                     // полуразмеры сетки от центра, км
    model: { alpha: 0.8, r0: 1, kmax: 3, w: 0.3, step: 0.1 },
    demand: { base: 2, peak: 11, sigmaKm: 2.5 },  // заказов за 10 минут в обычный день
    supply: { base: 5, peak: 5, sigmaKm: 2.5 },   // свободных водителей в обычный день
    mosques: [
      { name: "Центральная джума-мечеть", lat: 42.9694, lon: 47.4939, main: true }
    ],
    mosqueEffect: {
      main: [{ km: 0.8, d: 2.6, s: 0.35 }, { km: 1.8, d: 2.0, s: 0.5 }, { km: 3.0, d: 1.4, s: 0.75 }],
      regular: [{ km: 0.6, d: 2.0, s: 0.5 }, { km: 1.4, d: 1.6, s: 0.65 }]
    },
    periods: {
      normal: { name: "Обычное время", d: 1, s: 1 },
      evening: { name: "Вечерний час пик", d: 1.4, s: 1 },
      night: { name: "Ночь", d: 0.45, s: 0.35 },
      friday: { name: "Пятничный намаз", d: 1.2, s: 0.9 }
    },
    weather: {
      clear: { name: "Ясно или облачно", d: 1, s: 1 },
      rain: { name: "Дождь", d: 1.35, s: 0.9 },
      storm: { name: "Ливень или гроза", d: 1.7, s: 0.8 },
      heat: { name: "Жара выше +35°", d: 1.15, s: 0.95 },
      fog: { name: "Туман", d: 1.2, s: 0.85 },
      ice: { name: "Снег или гололёд", d: 1.8, s: 0.7 }
    },
    tariff: { pickup: 79, perKm: 12, perMin: 6, minFare: 149, surgePickup: false },
    tzOffsetHours: 3,           // Москва / Махачкала, без перехода на летнее время
    zuhrOffsetMin: 4.26,        // сдвиг к астрономическому полудню; сверено с vremyanamaza.ru (ВИЛ 2007)
    prayerWindowMin: 60,        // пробки за час до и час после зухра
    prayerFadeMin: 30           // плавное затухание на краях окна
  };

  var KM_LAT = 110.57, KM_LON_EQ = 111.32, SQ3 = Math.sqrt(3);
  var DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

  function merge(base, extra) {
    var out = {};
    Object.keys(base).forEach(function (k) { out[k] = base[k]; });
    if (!extra) return out;
    Object.keys(extra).forEach(function (k) {
      var b = base[k], e = extra[k];
      out[k] = (b && e && typeof b === "object" && typeof e === "object" && !Array.isArray(b) && !Array.isArray(e)) ? merge(b, e) : e;
    });
    return out;
  }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

  // ---------- Время зухра (солнечный полдень, NOAA) ----------
  function solarNoonMinutesUTC(y, m, d, lon) {
    var jd = Date.UTC(y, m - 1, d, 12) / 86400000 + 2440587.5, T = (jd - 2451545) / 36525;
    var r = function (x) { return x * Math.PI / 180; };
    var L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360;
    var M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
    var e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
    var eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
    var eps = eps0 + 0.00256 * Math.cos(r(125.04 - 1934.136 * T));
    var yv = Math.pow(Math.tan(r(eps / 2)), 2);
    var eq = 4 * 180 / Math.PI * (yv * Math.sin(2 * r(L0)) - 2 * e * Math.sin(r(M)) +
      4 * e * yv * Math.sin(r(M)) * Math.cos(2 * r(L0)) - 0.5 * yv * yv * Math.sin(4 * r(L0)) -
      1.25 * e * e * Math.sin(2 * r(M)));
    return 720 - 4 * lon - eq;
  }

  function create(userConfig) {
    var C = merge(DEFAULTS, userConfig);
    var lat0 = C.center.lat, lon0 = C.center.lon, kmLon = KM_LON_EQ * Math.cos(lat0 * Math.PI / 180), R = C.cellKm;

    function toXY(lat, lon) { return { x: (lon - lon0) * kmLon, y: (lat - lat0) * KM_LAT }; }
    function toLL(x, y) { return { lat: lat0 + y / KM_LAT, lon: lon0 + x / kmLon }; }
    function distKm(a, b) { var p = toXY(a.lat, a.lon), q = toXY(b.lat, b.lon); return Math.hypot(p.x - q.x, p.y - q.y); }

    // ---------- Сетка шестиугольников (осевые координаты) ----------
    function hexCenter(q, r) { return { x: R * SQ3 * (q + r / 2), y: R * 1.5 * r }; }
    function hexRound(qf, rf) {
      var x = qf, z = rf, y = -x - z, rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
      var dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z);
      if (dx > dy && dx > dz) rx = -ry - rz; else if (dy <= dz) rz = -rx - ry;
      return { q: rx, r: rz };
    }
    var zones = [], byKey = {};
    var span = Math.ceil(Math.max(C.extentKm.x, C.extentKm.y) / R) + 2;
    for (var q = -span; q <= span; q++) for (var r = -span; r <= span; r++) {
      var c = hexCenter(q, r);
      if (Math.abs(c.x) > C.extentKm.x || Math.abs(c.y) > C.extentKm.y) continue;
      var ll = toLL(c.x, c.y), dc = Math.hypot(c.x, c.y);
      var gd = Math.exp(-dc * dc / (2 * C.demand.sigmaKm * C.demand.sigmaKm));
      var gs = Math.exp(-dc * dc / (2 * C.supply.sigmaKm * C.supply.sigmaKm));
      var z = { id: q + ":" + r, q: q, r: r, lat: ll.lat, lon: ll.lon, x: c.x, y: c.y,
        demand: C.demand.base + C.demand.peak * gd, supply: C.supply.base + C.supply.peak * gs };
      zones.push(z); byKey[z.id] = z;
    }
    zones.forEach(function (z) {
      z.neighbors = DIRS.map(function (d) { return byKey[(z.q + d[0]) + ":" + (z.r + d[1])]; }).filter(Boolean);
      z.polygon = [];
      for (var i = 0; i < 6; i++) {
        var a = Math.PI / 180 * (60 * i - 30);
        var p = toLL(z.x + R * Math.cos(a), z.y + R * Math.sin(a));
        z.polygon.push([p.lat, p.lon]);
      }
    });

    function zoneAt(lat, lon) {
      var p = toXY(lat, lon), h = hexRound((SQ3 / 3 * p.x - p.y / 3) / R, (2 / 3 * p.y) / R);
      return byKey[h.q + ":" + h.r] || null;
    }

    // ---------- Время: местные часы, период, окно намаза ----------
    function local(date) {
      var t = new Date(date.getTime() + C.tzOffsetHours * 3600000);
      return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), dow: t.getUTCDay(),
        min: t.getUTCHours() * 60 + t.getUTCMinutes() };
    }
    function zuhrMinutes(date) {
      var L = local(date);
      return Math.round(solarNoonMinutesUTC(L.y, L.m, L.d, lon0) + C.tzOffsetHours * 60 + C.zuhrOffsetMin);
    }
    function prayerInfo(date) {
      var L = local(date), z = zuhrMinutes(date), isFri = L.dow === 5;
      var dist = Math.abs(L.min - z), W = C.prayerWindowMin, F = C.prayerFadeMin;
      var I = !isFri ? 0 : dist <= W ? 1 : dist >= W + F ? 0 : 1 - (dist - W) / F;
      return { isFriday: isFri, zuhr: hm(z), from: hm(z - W), to: hm(z + W), intensity: I };
    }
    function periodKey(date) {
      var L = local(date), h = L.min / 60;
      if (h < 6) return "night";
      if (L.dow >= 1 && L.dow <= 5 && h >= 17 && h < 20) return "evening";
      return "normal";
    }

    function mosqueFactor(z, I) {
      var best = { d: 1, s: 1 };
      if (I <= 0) return best;
      C.mosques.forEach(function (m) {
        var d = distKm(z, m), bands = m.main ? C.mosqueEffect.main : C.mosqueEffect.regular;
        for (var i = 0; i < bands.length; i++) {
          if (d <= bands[i].km) { if (bands[i].d / bands[i].s > best.d / best.s) best = bands[i]; break; }
        }
      });
      return { d: 1 + I * (best.d - 1), s: 1 + I * (best.s - 1) };
    }

    // ---------- Расчёт коэффициентов по всем зонам ----------
    var cache = { key: null, res: null };
    function compute(state) {
      state = state || {};
      var date = state.date || new Date(), wKey = C.weather[state.weather] ? state.weather : "clear";
      var T = clamp(+state.trafficScore || 0, 0, 10), pk = state.period || periodKey(date), pr = prayerInfo(date);
      var key = [Math.floor(date.getTime() / 60000), wKey, T, pk, !!state.trafficIsLive].join("|");
      if (cache.key === key) return cache.res;

      var M = C.model, base = C.periods[pk] || C.periods.normal, wx = C.weather[wKey];
      var fri = pr.intensity > 0, I = pr.intensity, fb = C.periods.friday;
      var tD = 1 + 0.02 * T, tS = 1 / (1 + 0.06 * T);
      zones.forEach(function (z) {
        var f = { d: base.d, s: base.s };
        if (fri) {
          var mf = mosqueFactor(z, I);
          var cityD = 1 + I * (fb.d - 1), cityS = 1 + I * (fb.s - 1);
          var useMosque = mf.d / mf.s > cityD / cityS;
          f.d *= useMosque ? mf.d : cityD;
          // Если пробки живые, замедление у мечетей уже в скорости — не учитываем дважды
          f.s *= state.trafficIsLive ? 1 : (useMosque ? mf.s : cityS);
        }
        z._d = z.demand * f.d * wx.d * tD;
        z._s = z.supply * f.s * wx.s * tS;
        z._ratio = z._d / Math.max(z._s, 0.5);
        z._kRaw = clamp(Math.pow(z._ratio / M.r0, M.alpha), 1, M.kmax);
      });
      var out = {};
      zones.forEach(function (z) {
        var nm = z.neighbors.length ? z.neighbors.reduce(function (a, n) { return a + n._kRaw; }, 0) / z.neighbors.length : z._kRaw;
        var ks = clamp((1 - M.w) * z._kRaw + M.w * nm, 1, M.kmax);
        out[z.id] = { k: Math.max(1, +(Math.round(ks / M.step) * M.step).toFixed(2)), kRaw: z._kRaw, kSmoothed: ks,
          demand: z._d, supply: z._s, ratio: z._ratio };
      });
      cache = { key: key, res: { zones: out, period: pk, prayer: pr, weather: wKey, trafficScore: T } };
      return cache.res;
    }

    function price(k, distanceKm, minutes) {
      var t = C.tariff, ride = distanceKm * t.perKm + minutes * t.perMin;
      var base = Math.max(t.minFare, t.pickup + ride);
      var surged = Math.max(t.minFare, t.surgePickup ? (t.pickup + ride) * k : t.pickup + ride * k);
      return { base: Math.round(base), surged: Math.round(surged), delta: Math.round(surged - base) };
    }

    function quote(o) {
      if (!o || !o.from) throw new Error("quote: нужна точка подачи from {lat, lon}");
      var res = compute(o), z = zoneAt(o.from.lat, o.from.lon), info = z ? res.zones[z.id] : null;
      var k = info ? info.k : 1, T = res.trafficScore;
      var minutes = o.durationIsFreeFlow === false ? o.durationMin : o.durationMin * (1 + T / 7.5);
      var p = price(k, o.distanceKm || 0, minutes || 0);
      p.minutes = Math.round(minutes || 0); p.distanceKm = Math.round((o.distanceKm || 0) * 10) / 10;
      return {
        k: k, outsideArea: !z, zoneId: z ? z.id : null,
        period: res.prayer.intensity > 0 ? "friday" : res.period,
        periodName: res.prayer.intensity > 0 ? C.periods.friday.name : (C.periods[res.period] || {}).name,
        prayer: res.prayer, weather: res.weather, weatherName: C.weather[res.weather].name,
        trafficScore: T, factors: info, price: p
      };
    }

    function zonesWithK(state) {
      var res = compute(state);
      return zones.map(function (z) { return { id: z.id, lat: z.lat, lon: z.lon, polygon: z.polygon, k: res.zones[z.id].k }; });
    }

    return { config: C, quote: quote, compute: compute, zones: zonesWithK, zoneAt: zoneAt,
      zuhr: function (date) { return hm(zuhrMinutes(date || new Date())); }, prayerInfo: prayerInfo };
  }

  function hm(m) { m = ((Math.round(m) % 1440) + 1440) % 1440; return Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0"); }

  // Погода из Open-Meteo (коды WMO) → условие модели
  function weatherFromOpenMeteo(cur) {
    var c = cur.weather_code, pr = cur.precipitation || 0, t = cur.temperature_2m;
    if ((c >= 71 && c <= 77) || c === 85 || c === 86 || c === 56 || c === 57 || c === 66 || c === 67 || (t <= 1 && pr > 0)) return "ice";
    if (c === 65 || c === 82 || c >= 95 || pr >= 4) return "storm";
    if ((c >= 51 && c <= 63) || c === 80 || c === 81 || pr > 0.2) return "rain";
    if (c === 45 || c === 48) return "fog";
    if (t >= 35) return "heat";
    return "clear";
  }

  // Балл пробок по двум временам одного маршрута: с пробками и без
  function trafficScoreFromTimes(withTrafficSec, freeFlowSec) {
    if (!withTrafficSec || !freeFlowSec) return 0;
    return clamp(Math.round((withTrafficSec / freeFlowSec - 1) * 7.5), 0, 10);
  }

  return { create: create, defaults: DEFAULTS, weatherFromOpenMeteo: weatherFromOpenMeteo, trafficScoreFromTimes: trafficScoreFromTimes };
});
