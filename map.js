// Карта каталога. Основной вариант — 2ГИС (MapGL JS API, нужен ключ в config.js).
// Без ключа или если 2ГИС не загрузился — Leaflet с подложкой OpenStreetMap.
//
// DostavkaMap.create(element, options) → Promise<адаптер> с методами:
//   setPlaces(places, activeId, userPos) — поставить метки и вписать их в экран
//   setActive(id)                        — подсветить метку
//   focus(id)                            — приблизить к заведению и открыть подсказку
//   resize()                             — пересчитать размер после показа контейнера
//   setMarker(id, coords, html, anchor)  — поставить или передвинуть свою метку (точки доставки, курьер)
//   removeMarker(id)
//   setRoute(path)                       — нарисовать маршрут [[lat, lon], ...]; null — убрать
//   fitTo(points)                        — вписать точки в экран
//   getCenter() → [lat, lon]; setView(coords, zoom); onMoveEnd(cb) — для выбора точки пином
//   destroy()
// options: { center: [lat, lon], pinHtml(place, active), popupHtml(place), onSelect(id) }
// Координаты везде [lat, lon], как в data/places.js; MapGL ждёт [lon, lat] — переворачиваем внутри.
(function () {
  'use strict';

  const CONFIG = window.DOSTAVKA_CONFIG || {};
  const MAPGL_URL = 'https://mapgl.2gis.com/api/js/v1';
  const FIT_PADDING = 40;
  const MAX_FIT_ZOOM = 15;

  let mapglPromise = null;

  function loadMapgl() {
    if (window.mapgl) return Promise.resolve(window.mapgl);
    if (!mapglPromise) {
      mapglPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = MAPGL_URL;
        script.onload = () => (window.mapgl ? resolve(window.mapgl) : reject(new Error('mapgl not defined')));
        script.onerror = () => reject(new Error('mapgl failed to load'));
        document.head.appendChild(script);
      }).catch((e) => {
        mapglPromise = null;
        throw e;
      });
    }
    return mapglPromise;
  }

  // ---------- 2ГИС (MapGL) ----------
  function createTwoGis(el, opts, mapgl) {
    const toLonLat = (c) => [c[1], c[0]];
    const map = new mapgl.Map(el, {
      center: toLonLat(opts.center),
      zoom: 13,
      key: CONFIG.twoGisKey,
      lang: 'ru'
    });
    let markers = {};
    let userMarker = null;
    let popup = null;
    let placesById = {};

    function closePopup() {
      if (popup) { popup.destroy(); popup = null; }
    }

    function openPopup(p) {
      closePopup();
      popup = new mapgl.HtmlMarker(map, {
        coordinates: toLonLat(p.coords),
        html: `<div class="gl-popup"><button class="gl-popup-close" type="button" aria-label="Закрыть">✕</button>${opts.popupHtml(p)}</div>`,
        anchor: [0, 0],
        zIndex: 1000
      });
      const content = popup.getContent();
      content.querySelector('.gl-popup-close').addEventListener('click', closePopup);
      // Клик по подсказке не должен долетать до карты и закрывать её.
      content.addEventListener('click', (e) => e.stopPropagation());
    }

    map.on('click', closePopup);
    const extra = {};
    let route = null;

    function fit(points) {
      if (points.length === 1) {
        map.setCenter(toLonLat(points[0]));
        map.setZoom(MAX_FIT_ZOOM);
      } else if (points.length > 1) {
        const lats = points.map((p) => p[0]);
        const lons = points.map((p) => p[1]);
        map.fitBounds(
          { southWest: [Math.min(...lons), Math.min(...lats)], northEast: [Math.max(...lons), Math.max(...lats)] },
          { padding: { top: FIT_PADDING, right: FIT_PADDING, bottom: FIT_PADDING, left: FIT_PADDING }, maxZoom: MAX_FIT_ZOOM }
        );
      }
    }

    return {
      provider: '2gis',
      setPlaces(places, activeId, userPos) {
        closePopup();
        Object.values(markers).forEach((m) => m.destroy());
        if (userMarker) { userMarker.destroy(); userMarker = null; }
        markers = {};
        placesById = {};
        const points = [];
        places.filter((p) => p.coords).forEach((p) => {
          const m = new mapgl.HtmlMarker(map, {
            coordinates: toLonLat(p.coords),
            html: opts.pinHtml(p, p.id === activeId),
            anchor: [15, 30]
          });
          m.getContent().addEventListener('click', (e) => {
            e.stopPropagation();
            openPopup(p);
            opts.onSelect(p.id);
          });
          markers[p.id] = m;
          placesById[p.id] = p;
          points.push(p.coords);
        });
        if (userPos) {
          userMarker = new mapgl.HtmlMarker(map, {
            coordinates: toLonLat(userPos),
            html: '<div class="user-dot" title="Вы здесь"></div>',
            anchor: [9, 9]
          });
          points.push(userPos);
        }
        fit(points);
      },
      setActive(id) {
        Object.entries(markers).forEach(([pid, m]) => {
          const pin = m.getContent().querySelector('.pin');
          if (pin) pin.classList.toggle('is-active', pid === id);
        });
      },
      focus(id) {
        const p = placesById[id];
        if (!p) return;
        map.setCenter(toLonLat(p.coords));
        if (map.getZoom() < MAX_FIT_ZOOM) map.setZoom(MAX_FIT_ZOOM);
        openPopup(p);
      },
      resize() { map.invalidateSize(); },
      setMarker(id, coords, html, anchor) {
        if (extra[id] && extra[id].html === html) { extra[id].m.setCoordinates(toLonLat(coords)); return; }
        if (extra[id]) extra[id].m.destroy();
        extra[id] = { html, m: new mapgl.HtmlMarker(map, { coordinates: toLonLat(coords), html, anchor: anchor || [15, 30], zIndex: id === 'courier' ? 900 : 500 }) };
      },
      removeMarker(id) { if (extra[id]) { extra[id].m.destroy(); delete extra[id]; } },
      setRoute(path) {
        if (route) { route.destroy(); route = null; }
        if (path && path.length > 1) {
          route = new mapgl.Polyline(map, { coordinates: path.map(toLonLat), width: 6, color: '#6B4A2E' });
        }
      },
      fitTo(points) { fit(points); },
      getCenter() { const c = map.getCenter(); return [c[1], c[0]]; },
      setView(coords, zoom) { map.setCenter(toLonLat(coords)); if (zoom) map.setZoom(zoom); },
      onMoveEnd(cb) { map.on('moveend', () => cb(this.getCenter())); },
      destroy() { closePopup(); Object.values(extra).forEach((x) => x.m.destroy()); if (route) route.destroy(); map.destroy(); }
    };
  }

  // ---------- Leaflet + OpenStreetMap (запасной вариант) ----------
  // tile.openstreetmap.org не используем: он отдаёт картинку «Access blocked» со статусом,
  // который Leaflet не считает ошибкой, поэтому переключение на запасной сервер не срабатывает.
  const TILE_SOURCES = [
    {
      url: 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',
      options: { maxZoom: 19, subdomains: 'abc', referrerPolicy: 'strict-origin-when-cross-origin', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> France' }
    },
    {
      url: 'https://tile.openstreetmap.de/{z}/{x}/{y}.png',
      options: { maxZoom: 19, referrerPolicy: 'strict-origin-when-cross-origin', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }
    },
    {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      options: { maxZoom: 19, attribution: 'Tiles &copy; Esri' }
    }
  ];

  function createLeaflet(el, opts) {
    const L = window.L;
    const map = L.map(el, { scrollWheelZoom: true }).setView(opts.center, 13);
    let markers = {};
    let userMarker = null;
    let placesById = {};
    const extra = {};
    let route = null;

    // Если сервер тайлов недоступен, переключаемся на следующий.
    (function addTiles(index) {
      const src = TILE_SOURCES[index];
      if (!src) { opts.onTilesFailed && opts.onTilesFailed(); return; }
      const layer = L.tileLayer(src.url, src.options).addTo(map);
      let loaded = 0;
      let failed = 0;
      layer.on('tileload', () => { loaded += 1; });
      layer.on('tileerror', () => {
        failed += 1;
        if (failed === 3 && loaded === 0) {
          map.removeLayer(layer);
          addTiles(index + 1);
        }
      });
    })(0);

    function icon(p, active) {
      return L.divIcon({
        className: '',
        html: opts.pinHtml(p, active),
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -28]
      });
    }

    return {
      provider: 'osm',
      setPlaces(places, activeId, userPos) {
        Object.values(markers).forEach((m) => m.remove());
        if (userMarker) { userMarker.remove(); userMarker = null; }
        markers = {};
        placesById = {};
        const points = [];
        places.filter((p) => p.coords).forEach((p) => {
          const m = L.marker(p.coords, { icon: icon(p, p.id === activeId) })
            .addTo(map)
            .bindPopup(opts.popupHtml(p));
          m.on('click', () => opts.onSelect(p.id));
          markers[p.id] = m;
          placesById[p.id] = p;
          points.push(p.coords);
        });
        if (userPos) {
          userMarker = L.circleMarker(userPos, { radius: 8, color: '#6B4A2E', fillOpacity: 0.8 }).addTo(map).bindTooltip('Вы здесь');
          points.push(userPos);
        }
        if (points.length > 1) map.fitBounds(points, { padding: [FIT_PADDING, FIT_PADDING], maxZoom: MAX_FIT_ZOOM });
        else if (points.length === 1) map.setView(points[0], MAX_FIT_ZOOM);
      },
      setActive(id) {
        Object.entries(markers).forEach(([pid, m]) => m.setIcon(icon(placesById[pid], pid === id)));
      },
      focus(id) {
        const m = markers[id];
        if (!m) return;
        map.setView(m.getLatLng(), Math.max(map.getZoom(), MAX_FIT_ZOOM));
        m.openPopup();
      },
      resize() { map.invalidateSize(); },
      setMarker(id, coords, html, anchor) {
        const a = anchor || [15, 30];
        if (extra[id] && extra[id].html === html) { extra[id].m.setLatLng(coords); return; }
        if (extra[id]) extra[id].m.remove();
        const ic = L.divIcon({ className: '', html, iconSize: [a[0] * 2, a[1] * 2], iconAnchor: a });
        extra[id] = { html, m: L.marker(coords, { icon: ic, zIndexOffset: id === 'courier' ? 900 : 500, interactive: false }).addTo(map) };
      },
      removeMarker(id) { if (extra[id]) { extra[id].m.remove(); delete extra[id]; } },
      setRoute(path) {
        if (route) { route.remove(); route = null; }
        if (path && path.length > 1) route = L.polyline(path, { color: '#6B4A2E', weight: 6, opacity: 0.9 }).addTo(map);
      },
      fitTo(points) {
        if (points.length > 1) map.fitBounds(points, { padding: [FIT_PADDING, FIT_PADDING], maxZoom: MAX_FIT_ZOOM });
        else if (points.length === 1) map.setView(points[0], MAX_FIT_ZOOM);
      },
      getCenter() { const c = map.getCenter(); return [c.lat, c.lng]; },
      setView(coords, zoom) { map.setView(coords, zoom || map.getZoom()); },
      onMoveEnd(cb) { map.on('moveend', () => cb(this.getCenter())); },
      destroy() { map.remove(); }
    };
  }

  function create(el, opts) {
    if (CONFIG.twoGisKey) {
      return loadMapgl()
        .then((mapgl) => createTwoGis(el, opts, mapgl))
        .catch((e) => {
          console.warn('2ГИС не загрузился, показываем OpenStreetMap:', e);
          return createFallback(el, opts);
        });
    }
    return createFallback(el, opts);
  }

  function createFallback(el, opts) {
    if (!window.L) return Promise.reject(new Error('Leaflet не загружен'));
    return Promise.resolve(createLeaflet(el, opts));
  }

  window.DostavkaMap = { create, provider: () => (CONFIG.twoGisKey ? '2gis' : 'osm') };
})();
