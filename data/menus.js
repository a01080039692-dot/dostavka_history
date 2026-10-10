// Демо-меню по категориям. Пока у заведений нет своих меню, каждому показывается
// шаблон его категории. Чтобы задать настоящее меню, добавьте его в DOSTAVKA_MENUS.byPlace[id].
window.DOSTAVKA_MENUS = {
  byCategory: {
    restaurant: [
      { section: 'Горячее', items: [
        { id: 'hinkal', name: 'Хинкал аварский', desc: 'Говядина, бульон, чесночный соус', price: 520, unit: 'порция' },
        { id: 'shashlyk-lamb', name: 'Шашлык из баранины', desc: 'Мякоть, лук, лаваш', price: 690, unit: '250 г' },
        { id: 'shashlyk-beef', name: 'Шашлык из говядины', desc: 'Вырезка, маринад на гранате', price: 640, unit: '250 г' },
        { id: 'kurze', name: 'Курзе с мясом', desc: '10 шт., сметана', price: 480, unit: 'порция' },
        { id: 'plov', name: 'Плов с бараниной', desc: 'Рис девзира, нут, морковь', price: 450, unit: '350 г' }
      ]},
      { section: 'Супы', items: [
        { id: 'shurpa', name: 'Шурпа', desc: 'Баранина, овощи, зелень', price: 390, unit: '400 мл' },
        { id: 'lentil', name: 'Чечевичный суп', desc: 'Красная чечевица, лимон', price: 290, unit: '350 мл' }
      ]},
      { section: 'Салаты и выпечка', items: [
        { id: 'salad-veg', name: 'Овощной салат', desc: 'Томаты, огурцы, зелень', price: 280, unit: '250 г' },
        { id: 'chudu', name: 'Чуду с мясом', desc: 'Тонкое тесто, фарш', price: 260, unit: 'шт.' },
        { id: 'lavash', name: 'Лаваш', desc: '', price: 50, unit: 'шт.' }
      ]},
      { section: 'Напитки', items: [
        { id: 'tea', name: 'Чай чабрецовый', desc: 'Чайник', price: 220, unit: '800 мл' },
        { id: 'compote', name: 'Компот домашний', desc: '', price: 150, unit: '500 мл' }
      ]}
    ],
    fastfood: [
      { section: 'Бургеры', items: [
        { id: 'burger-classic', name: 'Классический бургер', desc: 'Говяжья котлета, сыр, соус', price: 390, unit: 'шт.' },
        { id: 'burger-double', name: 'Двойной бургер', desc: 'Две котлеты, чеддер, халапеньо', price: 560, unit: 'шт.' },
        { id: 'burger-chicken', name: 'Чикенбургер', desc: 'Куриное филе в панировке', price: 340, unit: 'шт.' }
      ]},
      { section: 'Шаурма', items: [
        { id: 'shawarma-chicken', name: 'Шаурма с курицей', desc: 'Лаваш, овощи, чесночный соус', price: 290, unit: 'шт.' },
        { id: 'shawarma-beef', name: 'Шаурма с говядиной', desc: 'Лаваш, овощи, острый соус', price: 350, unit: 'шт.' }
      ]},
      { section: 'Закуски и напитки', items: [
        { id: 'fries', name: 'Картофель фри', desc: '', price: 160, unit: '150 г' },
        { id: 'nuggets', name: 'Наггетсы', desc: '9 шт., соус на выбор', price: 270, unit: 'порция' },
        { id: 'lemonade', name: 'Лимонад', desc: 'Тархун или манго', price: 180, unit: '400 мл' }
      ]}
    ],
    coffee: [
      { section: 'Кофе', items: [
        { id: 'cappuccino', name: 'Капучино', desc: '', price: 220, unit: '300 мл' },
        { id: 'latte', name: 'Латте', desc: '', price: 240, unit: '400 мл' },
        { id: 'americano', name: 'Американо', desc: '', price: 170, unit: '300 мл' },
        { id: 'raf', name: 'Раф ванильный', desc: '', price: 280, unit: '300 мл' }
      ]},
      { section: 'Десерты', items: [
        { id: 'cheesecake', name: 'Чизкейк', desc: '', price: 290, unit: 'кусок' },
        { id: 'croissant', name: 'Круассан', desc: 'С миндалём', price: 210, unit: 'шт.' },
        { id: 'urbech-cake', name: 'Пирожное с урбечем', desc: '', price: 250, unit: 'шт.' }
      ]}
    ],
    grocery: [
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
  byPlace: {}
};
