// Меню заведений: DOSTAVKA_MENUS.byPlace[id]. Меню есть только у заведений, перечисленных здесь
// и в menus-manual.js; у остальных на странице заведения показываются контакты, заказать нельзя.
window.DOSTAVKA_MENUS = {
  byPlace: {
    // Meat Lavka — демонстрационное меню мясного магазина: позиции и цены уточняются у заведения.
    'meat-lavka': [
      { section: 'Мясо', items: [
        { id: 'beef-tender', name: 'Говядина, вырезка', desc: 'Охлаждённая', price: 1350, unit: 'кг' },
        { id: 'beef-bone', name: 'Говядина на кости', desc: 'Для бульона', price: 690, unit: 'кг' },
        { id: 'lamb', name: 'Баранина, мякоть', desc: 'Охлаждённая', price: 1150, unit: 'кг' },
        { id: 'mince', name: 'Фарш говяжий', desc: 'Свежий, без добавок', price: 790, unit: 'кг' }
      ]},
      { section: 'Птица', items: [
        { id: 'chicken-whole', name: 'Курица целая', desc: 'Домашняя', price: 420, unit: 'кг' },
        { id: 'chicken-fillet', name: 'Филе куриное', desc: '', price: 520, unit: 'кг' }
      ]},
      { section: 'Полуфабрикаты', items: [
        { id: 'kebab-semi', name: 'Люля-кебаб', desc: 'Сырые, 6 шт.', price: 560, unit: 'упак.' },
        { id: 'sausage', name: 'Колбаски для гриля', desc: 'Говядина', price: 640, unit: 'кг' }
      ]}
    ]
  },
  sources: {
    'meat-lavka': { text: 'Меню демонстрационное: цены и позиции уточняются у заведения.' }
  }
};
