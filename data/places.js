// Заведения перенесены из проекта Halal Tracker (config.js).
// categories: restaurant | fastfood | coffee | grocery; ownDelivery — у заведения есть доставка, по ней работает фильтр «Доставки»
// (отметка «Доставки» из каталога Halal Tracker и заведения, добавленные вручную);
// verified — заведение подтверждено владельцем каталога; logo — путь к логотипу; cover — фото для карточки; socials — [{label, url}].
window.DOSTAVKA_DATA = {
  "cityCenters": {
    "Махачкала": [
      42.973,
      47.50389
    ],
    "Каспийск": [
      42.89127,
      47.6368
    ]
  },
  "places": [
    {
      "id": "kafedra-makh",
      "name": "Кафедра кофе",
      "city": "Махачкала",
      "categories": [
        "coffee"
      ],
      "ownDelivery": false
    },
    {
      "id": "pech-izumrudnaya",
      "name": "Печь · Изумрудная",
      "city": "Махачкала",
      "categories": [
        "restaurant"
      ],
      "ownDelivery": true,
      "address": "Изумрудная улица, 2/1",
      "coords": [
        42.950841,
        47.53829
      ],
      "mapUrl": "https://2gis.ru/makhachkala/firm/70000001055393315"
    },
    {
      "id": "pech-gagarina",
      "name": "Печь · Гагарина",
      "city": "Махачкала",
      "categories": [
        "restaurant"
      ],
      "ownDelivery": false,
      "address": "улица Гагарина, 50А",
      "coords": [
        42.957498,
        47.499642
      ],
      "mapUrl": "https://2gis.ru/makhachkala/search/%D0%9F%D0%B5%D1%87%D1%8C%20%D1%83%D0%BB%D0%B8%D1%86%D0%B0%20%D0%93%D0%B0%D0%B3%D0%B0%D1%80%D0%B8%D0%BD%D0%B0%2050%D0%90"
    },
    {
      "id": "samburger-makh-korkmasova",
      "name": "Самбургер",
      "city": "Махачкала",
      "categories": [
        "fastfood"
      ],
      "ownDelivery": true,
      "address": "улица Коркмасова, 99",
      "coords": [
        42.975484,
        47.509862
      ],
      "mapUrl": "https://2gis.ru/makhachkala/firm/70000001034583022"
    },
    {
      "id": "samburger-makh-yaragsky",
      "name": "Самбургер",
      "city": "Махачкала",
      "categories": [
        "fastfood"
      ],
      "ownDelivery": true,
      "address": "улица Магомеда Ярагского, 51",
      "coords": [
        42.973388,
        47.510559
      ],
      "mapUrl": "https://2gis.ru/makhachkala/firm/70000001103316855"
    },
    {
      "id": "khalif-makh",
      "name": "Халиф",
      "city": "Махачкала",
      "categories": [
        "restaurant"
      ],
      "ownDelivery": false
    },
    {
      "id": "yammy-makh",
      "name": "Ямми · доставка",
      "city": "Махачкала",
      "categories": [
        "restaurant"
      ],
      "ownDelivery": true
    },
    {
      "id": "people-makh-abubakarova",
      "name": "People Coffee",
      "city": "Махачкала",
      "categories": [
        "coffee"
      ],
      "ownDelivery": true,
      "address": "улица Абубакарова, 81",
      "coords": [
        42.973375,
        47.495785
      ],
      "mapUrl": "https://2gis.ru/makhachkala/firm/70000001095223223"
    },
    {
      "id": "people-makh-ermoshkina",
      "name": "People Coffee",
      "city": "Махачкала",
      "categories": [
        "coffee"
      ],
      "ownDelivery": true,
      "address": "улица Ермошкина, 89/1",
      "coords": [
        42.974798,
        47.512783
      ],
      "mapUrl": "https://2gis.ru/makhachkala/firm/70000001045944533"
    },
    {
      "id": "people-makh-tankaeva",
      "name": "People Coffee",
      "city": "Махачкала",
      "categories": [
        "coffee"
      ],
      "ownDelivery": true,
      "address": "улица Танкаева, 21",
      "coords": [
        42.9781,
        47.5009
      ],
      "mapUrl": "https://2gis.ru/makhachkala/search/People%20Coffee%20%D0%A2%D0%B0%D0%BD%D0%BA%D0%B0%D0%B5%D0%B2%D0%B0%2021"
    },
    {
      "id": "people-makh-shamilya",
      "name": "People Coffee · экспресс",
      "city": "Махачкала",
      "categories": [
        "coffee"
      ],
      "ownDelivery": false,
      "address": "проспект Имама Шамиля, 72/5 · парк 50-летия Октября",
      "coords": [
        42.9646,
        47.5023
      ],
      "mapUrl": "https://2gis.ru/makhachkala/search/People%20Coffee%20%D0%98%D0%BC%D0%B0%D0%BC%D0%B0%20%D0%A8%D0%B0%D0%BC%D0%B8%D0%BB%D1%8F%2072%2F5"
    },
    {
      "id": "people-makh-gamidova",
      "name": "People Coffee · экспресс",
      "city": "Махачкала",
      "categories": [
        "coffee"
      ],
      "ownDelivery": true,
      "address": "проспект Гамидова, 48/2",
      "coords": [
        42.965,
        47.4915
      ],
      "mapUrl": "https://2gis.ru/makhachkala/search/People%20Coffee%20%D0%93%D0%B0%D0%BC%D0%B8%D0%B4%D0%BE%D0%B2%D0%B0%2048%2F2"
    },
    {
      "id": "aeropress-makh",
      "name": "Аэропресс (Давай мясо)",
      "city": "Махачкала",
      "categories": [
        "coffee"
      ],
      "ownDelivery": true,
      "address": "проспект Имама Шамиля, 55А",
      "coords": [
        42.960493,
        47.506572
      ],
      "mapUrl": "https://2gis.ru/makhachkala/firm/70000001035607396"
    },
    {
      "id": "marsha-makh-lermontova",
      "name": "Marsha",
      "city": "Махачкала",
      "categories": [
        "coffee"
      ],
      "ownDelivery": true,
      "address": "улица Лермонтова, 10",
      "coords": [
        42.974673,
        47.496703
      ],
      "mapUrl": "https://2gis.ru/makhachkala/firm/70000001098126662"
    },
    {
      "id": "marsha-makh-kurbanova",
      "name": "Marsha",
      "city": "Махачкала",
      "categories": [
        "coffee"
      ],
      "ownDelivery": true,
      "address": "улица Гаруна Курбанова, 21",
      "coords": [
        42.978668,
        47.509889
      ],
      "mapUrl": "https://2gis.ru/makhachkala/firm/70000001059254979"
    },
    {
      "id": "marsha-makh-korkmasova",
      "name": "Marsha",
      "city": "Махачкала",
      "categories": [
        "coffee"
      ],
      "ownDelivery": true,
      "address": "улица Коркмасова, 4",
      "coords": [
        42.984754,
        47.492796
      ],
      "mapUrl": "https://2gis.ru/makhachkala/firm/70000001091811714"
    },
    {
      "id": "urbech-makh",
      "name": "Урбеч",
      "city": "Махачкала",
      "categories": [
        "restaurant"
      ],
      "ownDelivery": false
    },
    {
      "id": "pah-pah-makh-gorkogo",
      "name": "Пах-Пах",
      "city": "Махачкала",
      "categories": [
        "fastfood"
      ],
      "ownDelivery": false,
      "address": "улица Максима Горького, 11",
      "coords": [
        42.981177,
        47.509984
      ],
      "mapUrl": "https://2gis.ru/makhachkala/firm/70000001094490773"
    },
    {
      "id": "pah-pah-makh-batyraia",
      "name": "Пах-Пах",
      "city": "Махачкала",
      "categories": [
        "fastfood"
      ],
      "ownDelivery": true,
      "address": "улица Батырая, 119",
      "coords": [
        42.9732,
        47.510611
      ],
      "mapUrl": "https://2gis.ru/makhachkala/firm/70000001053025273"
    },
    {
      "id": "samburger-kas",
      "name": "Самбургер",
      "city": "Каспийск",
      "categories": [
        "fastfood"
      ],
      "ownDelivery": true,
      "address": "улица Ленина, 18",
      "coords": [
        42.886996,
        47.642311
      ],
      "mapUrl": "https://2gis.ru/kaspiysk/firm/70000001045073695"
    },
    {
      "id": "fermer-bakhtiyar",
      "name": "Фермер · Амет-Хана Султана",
      "city": "Махачкала",
      "categories": [
        "grocery"
      ],
      "ownDelivery": false,
      "verified": true,
      "address": "проспект Амет-Хана Султана, 4в",
      "coords": [
        42.949441,
        47.50398
      ],
      "workingHours": "ежедневно 09:00–21:00",
      "phones": [
        "+7 967 931-39-60",
        "+7 963 612-00-05"
      ],
      "mapUrl": "https://2gis.ru/makhachkala/firm/70000001092072219",
      "description": "Магазин мясной продукции: говядина, баранина, птица."
    },
    {
      "id": "fermer-akushinskogo",
      "name": "Фермер · Акушинского",
      "city": "Махачкала",
      "categories": [
        "grocery"
      ],
      "ownDelivery": false,
      "verified": true,
      "address": "проспект Али-Гаджи Акушинского, 94/4",
      "coords": [
        42.972878,
        47.421396
      ],
      "phones": [
        "+7 967 931-39-60"
      ],
      "mapUrl": "https://2gis.ru/makhachkala/search/%D0%A4%D0%B5%D1%80%D0%BC%D0%B5%D1%80%20%D0%90%D0%BB%D0%B8-%D0%93%D0%B0%D0%B4%D0%B6%D0%B8%20%D0%90%D0%BA%D1%83%D1%88%D0%B8%D0%BD%D1%81%D0%BA%D0%BE%D0%B3%D0%BE%2094%2F4",
      "description": "Магазин мясной продукции: говядина, баранина, птица."
    },
    {
      "id": "fermer-kas-nazarova",
      "name": "Фермер · Назарова",
      "city": "Каспийск",
      "categories": [
        "grocery"
      ],
      "ownDelivery": false,
      "verified": true,
      "address": "улица Назарова, 9",
      "coords": [
        42.885379,
        47.635833
      ],
      "workingHours": "ежедневно 09:00–19:00",
      "phones": [
        "+7 967 931-39-60"
      ],
      "mapUrl": "https://2gis.ru/kaspiysk/firm/70000001031859254",
      "description": "Магазин мясной продукции: говядина, баранина, птица."
    },
    {
      "id": "fermer-kas-kaspiyskaya",
      "name": "Фермер · Каспийская",
      "city": "Каспийск",
      "categories": [
        "grocery"
      ],
      "ownDelivery": false,
      "verified": true,
      "address": "Каспийская улица, 5",
      "coords": [
        42.906206,
        47.611357
      ],
      "workingHours": "ежедневно 09:00–20:00",
      "phones": [
        "+7 967 931-39-60"
      ],
      "mapUrl": "https://2gis.ru/kaspiysk/firm/70000001037061237",
      "description": "Магазин мясной продукции: говядина, баранина, птица."
    },
    {
      "id": "fermer-kas-magomedzhanova",
      "name": "Фермер · Магомеджанова",
      "city": "Каспийск",
      "categories": [
        "grocery"
      ],
      "ownDelivery": false,
      "verified": true,
      "address": "улица Магомедали Магомеджанова, 5 к1",
      "coords": [
        42.895137,
        47.621306
      ],
      "phones": [
        "+7 967 931-39-60"
      ],
      "mapUrl": "https://2gis.ru/kaspiysk/search/%D0%A4%D0%B5%D1%80%D0%BC%D0%B5%D1%80",
      "description": "Магазин мясной продукции: говядина, баранина, птица."
    },
    {
      "id": "meat-lavka",
      "name": "Meat Lavka",
      "city": "Махачкала",
      "categories": [
        "grocery"
      ],
      "ownDelivery": false,
      "verified": true,
      "address": "проспект Гамидова, 12а",
      "coords": [
        42.968648,
        47.517821
      ],
      "phones": [
        "+7 989 661-46-57"
      ],
      "description": "Магазин мясной продукции: говядина, баранина, птица."
    },
    {
      "id": "abdullag-kury",
      "name": "АбдуЛлагь · доставка кур",
      "city": "Махачкала",
      "categories": [
        "grocery"
      ],
      "ownDelivery": false,
      "phones": [
        "+7 928 540-81-74"
      ],
      "description": "Мясная продукция: говядина, баранина, птица."
    },
    {
      "id": "casablanca",
      "name": "Касабланка",
      "city": "Махачкала",
      "categories": [
        "grocery"
      ],
      "ownDelivery": false,
      "description": "Мясная продукция: говядина, баранина, птица."
    },
    {
      "id": "haba-makh",
      "name": "Haba",
      "city": "Махачкала",
      "categories": [
        "fastfood"
      ],
      "ownDelivery": true,
      "logo": "assets/logos/haba.png",
      "phones": [
        "+7 988 942-99-99"
      ],
      "socials": [
        {
          "label": "WhatsApp",
          "url": "https://wa.me/79889429999"
        },
        {
          "label": "Telegram",
          "url": "https://t.me/+79889429999"
        }
      ],
      "description": "Cold brew, сэндвичи, боулы, чаи и лимонады",
      "cover": "assets/dishes/haba/bowl-beef.jpg"
    }
  ]
};
