// Обмен данными между сайтом клиента и приложением водителя.
//
// Пока сервера нет, всё хранится в localStorage этого браузера, а другие вкладки узнают
// об изменениях через событие storage. Поэтому тестировать нужно в одном браузере:
// в одной вкладке — сайт, в другой — приложение водителя (/driver/).
// Когда появится сервер, заменить нужно только этот файл: остальной код работает через DostavkaBus.
//
// Ключи и кто в них пишет:
//   dostavka.orders   — заказы; пишет сайт клиента (оформление, отмена, оценка)
//   dostavka.dispatch — ход заказов у водителя { [orderId]: { status, driver, …времена } }; пишет приложение водителя
//   dostavka.driver   — водитель: профиль, на линии ли, где сейчас; пишет приложение водителя
(function () {
  'use strict';

  const KEYS = { orders: 'dostavka.orders', dispatch: 'dostavka.dispatch', driver: 'dostavka.driver' };
  const ONLINE_TTL = 45000; // водитель считается на линии, если отмечался не позже 45 с назад

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* без сохранения */ }
    local.forEach((cb) => cb(key));
  }

  const local = [];

  // Статусы у водителя по порядку.
  const STATUS_ORDER = ['accepted', 'arrived', 'picked', 'delivered'];

  window.DostavkaBus = {
    KEYS,
    STATUS_ORDER,
    orders: () => read(KEYS.orders, []),
    order: (id) => read(KEYS.orders, []).find((o) => o.id === id) || null,
    dispatch: () => read(KEYS.dispatch, {}),
    dispatchOf: (id) => read(KEYS.dispatch, {})[id] || null,
    setDispatch(id, patch) {
      const all = read(KEYS.dispatch, {});
      all[id] = { ...(all[id] || {}), ...patch, updatedAt: Date.now() };
      write(KEYS.dispatch, all);
      return all[id];
    },
    driver: () => read(KEYS.driver, null),
    setDriver(patch) {
      const d = { ...(read(KEYS.driver, null) || {}), ...patch, updatedAt: Date.now() };
      write(KEYS.driver, d);
      return d;
    },
    driverOnline() {
      const d = read(KEYS.driver, null);
      return !!(d && d.online && d.profile && Date.now() - (d.updatedAt || 0) < ONLINE_TTL);
    },
    // cb(key) вызывается при изменениях из других вкладок и из этой же вкладки.
    subscribe(cb) {
      local.push(cb);
      window.addEventListener('storage', (e) => {
        if (!e.key || Object.values(KEYS).includes(e.key)) cb(e.key);
      });
    }
  };
})();
