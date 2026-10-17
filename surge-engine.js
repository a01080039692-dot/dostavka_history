/*
 * surge-engine.js — динамический коэффициент доставки для Махачкалы и Каспийска.
 * Без зависимостей. Работает в браузере (window.SurgeEngine) и в Node.js (require).
 *
 * Коэффициент зависит только от погоды и пробок:
 *   k = погода × пробки, округление до 0,1, не больше kmax.
 *   Обычная погода (ясно или облачно) и нет пробок → k = 1.
 * Спрос, число свободных водителей, время суток и намаз пока не учитываются.
 *
 *   const engine = SurgeEngine.create();
 *   const q = engine.quote({
 *     from: { lat, lon },                         // точка подачи (для совместимости, на k не влияет)
 *     distanceKm: 8.2, durationMin: 17,
 *     weather: "clear",                           // clear | rain | storm | heat | fog | ice
 *     trafficScore: 5                             // 0–10
 *   });
 *   q.k, q.factors.weather, q.factors.traffic ...
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SurgeEngine = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var DEFAULTS = {
    center: { lat: 42.9694, lon: 47.4939 },      // Центральная джума-мечеть — точка для погоды и сетки зон
    cellKm: 0.9,                                  // радиус шестиугольной зоны на странице проверки, км
    extentKm: { x: 9, y: 8 },
    model: { kmax: 2, step: 0.1 },
    // Пробки: балл 0–10. До freeScore включительно надбавки нет (обычные светофоры),
    // дальше +perScore к коэффициенту за каждый балл: 10 баллов → 1 + 8 × 0,05 = 1,4.
    traffic: { freeScore: 2, perScore: 0.05 },
    // Погода: множитель коэффициента. «Ясно или облачно» — 1, без повышения.
    weather: {
      clear: { name: "Ясно или облачно", k: 1 },
      heat: { name: "Жара выше +35°", k: 1.1 },
      fog: { name: "Туман", k: 1.1 },
      rain: { name: "Дождь", k: 1.2 },
      storm: { name: "Ливень или гроза", k: 1.4 },
      ice: { name: "Снег или гололёд", k: 1.5 }
    }
  };

  var KM_LAT = 110.57, KM_LON_EQ = 111.32, SQ3 = Math.sqrt(3);

  function merge(base, extra) {
    if (!extra) return base;
    var out = {};
    Object.keys(base).forEach(function (k) { out[k] = base[k]; });
    Object.keys(extra).forEach(function (k) {
      var b = base[k], e = extra[k];
      out[k] = b && e && typeof b === "object" && typeof e === "object" && !Array.isArray(b) ? merge(b, e) : e;
    });
    return out;
  }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

  function create(userConfig) {
    var C = merge(DEFAULTS, userConfig);
    var lat0 = C.center.lat, lon0 = C.center.lon, kmLon = KM_LON_EQ * Math.cos(lat0 * Math.PI / 180), R = C.cellKm;

    function toXY(lat, lon) { return { x: (lon - lon0) * kmLon, y: (lat - lat0) * KM_LAT }; }
    function toLL(x, y) { return { lat: lat0 + y / KM_LAT, lon: lon0 + x / kmLon }; }

    // ---------- Сетка шестиугольников — только для карты на странице проверки ----------
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
      var ll = toLL(c.x, c.y), z = { id: q + ":" + r, q: q, r: r, lat: ll.lat, lon: ll.lon, x: c.x, y: c.y, polygon: [] };
      for (var i = 0; i < 6; i++) {
        var a = Math.PI / 180 * (60 * i - 30), p = toLL(c.x + R * Math.cos(a), c.y + R * Math.sin(a));
        z.polygon.push([p.lat, p.lon]);
      }
      zones.push(z); byKey[z.id] = z;
    }
    function zoneAt(lat, lon) {
      var p = toXY(lat, lon), h = hexRound((SQ3 / 3 * p.x - p.y / 3) / R, (2 / 3 * p.y) / R);
      return byKey[h.q + ":" + h.r] || null;
    }

    // ---------- Коэффициент: погода × пробки ----------
    function compute(state) {
      state = state || {};
      var wKey = C.weather[state.weather] ? state.weather : "clear";
      var T = clamp(Math.round(+state.trafficScore || 0), 0, 10);
      var kWeather = C.weather[wKey].k;
      var kTraffic = 1 + C.traffic.perScore * Math.max(0, T - C.traffic.freeScore);
      var raw = kWeather * kTraffic, M = C.model;
      var k = clamp(+(Math.round(raw / M.step) * M.step).toFixed(2), 1, M.kmax);
      return { k: k, raw: raw, weather: wKey, trafficScore: T, factors: { weather: kWeather, traffic: +kTraffic.toFixed(2) } };
    }

    function quote(o) {
      o = o || {};
      var res = compute(o);
      return {
        k: res.k, outsideArea: false,
        weather: res.weather, weatherName: C.weather[res.weather].name,
        trafficScore: res.trafficScore, factors: res.factors
      };
    }

    // Одинаковый коэффициент во всех зонах: от района он не зависит.
    function zonesWithK(state) {
      var k = compute(state).k;
      return zones.map(function (z) { return { id: z.id, lat: z.lat, lon: z.lon, polygon: z.polygon, k: k }; });
    }

    return { config: C, quote: quote, compute: compute, zones: zonesWithK, zoneAt: zoneAt };
  }

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

  // Балл пробок по двум временам одного маршрута: сейчас и ночью без пробок.
  // В 1,5 раза дольше → 4 балла, вдвое дольше → 8 баллов (7,5 округляется до 8).
  function trafficScoreFromTimes(withTrafficSec, freeFlowSec) {
    if (!withTrafficSec || !freeFlowSec) return 0;
    return clamp(Math.round((withTrafficSec / freeFlowSec - 1) * 7.5), 0, 10);
  }

  return { create: create, defaults: DEFAULTS, weatherFromOpenMeteo: weatherFromOpenMeteo, trafficScoreFromTimes: trafficScoreFromTimes };
});
