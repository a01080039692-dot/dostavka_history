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
    ],
    "Дербент": [
      42.05667,
      48.29521
    ],
    "Сочи": [
      43.57794,
      39.76139
    ],
    "Нальчик": [
      43.48544,
      43.59664
    ],
    "Хасавюрт": null
  },
  "places": [
    {
      "id": "gamach-makh",
      "name": "Гамач Бургер",
      "city": "Махачкала",
      "categories": [
        "fastfood"
      ],
      "ownDelivery": false
    },
    {
      "id": "jabal-makh",
      "name": "Джабаль",
      "city": "Махачкала",
      "categories": [
        "restaurant"
      ],
      "ownDelivery": false,
      "address": "проспект Али-Гаджи Акушинского, 98Б/3",
      "mapUrl": "https://2gis.ru/makhachkala/search/%D0%94%D0%B6%D0%B0%D0%B1%D0%B0%D0%BB%D1%8C%20%D0%90%D0%BA%D1%83%D1%88%D0%B8%D0%BD%D1%81%D0%BA%D0%BE%D0%B3%D0%BE%2098%D0%91%2F3"
    },
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
      "id": "chicago-makh-nuradilova",
      "name": "Chicago Pizza",
      "city": "Махачкала",
      "categories": [
        "fastfood"
      ],
      "ownDelivery": true,
      "address": "улица Нурадилова, 93",
      "coords": [
        42.973837,
        47.510201
      ],
      "mapUrl": "https://2gis.ru/makhachkala/firm/70000001061727496"
    },
    {
      "id": "chicago-makh-abubakarova",
      "name": "Chicago Pizza",
      "city": "Махачкала",
      "categories": [
        "fastfood"
      ],
      "ownDelivery": true,
      "address": "улица Абубакарова, 18А",
      "coords": [
        42.976388,
        47.498014
      ],
      "mapUrl": "https://2gis.ru/makhachkala/firm/70000001092769300"
    },
    {
      "id": "chicago-makh-gadzhieva",
      "name": "Chicago Pizza",
      "city": "Махачкала",
      "categories": [
        "fastfood"
      ],
      "ownDelivery": true,
      "address": "улица Гайдара Гаджиева, 22Б",
      "coords": [
        42.984856,
        47.476255
      ],
      "mapUrl": "https://2gis.ru/makhachkala/firm/70000001110218362"
    },
    {
      "id": "chicago-makh-petra",
      "name": "Chicago Pizza",
      "city": "Махачкала",
      "categories": [
        "fastfood"
      ],
      "ownDelivery": true,
      "address": "проспект Петра I, 14",
      "coords": [
        42.972267,
        47.527381
      ],
      "mapUrl": "https://2gis.ru/makhachkala/firm/70000001080684202"
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
      "id": "grace-makh",
      "name": "Грейс · кольцо Кавказ",
      "city": "Махачкала",
      "categories": [
        "restaurant"
      ],
      "ownDelivery": false,
      "address": "кольцо Кавказ"
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
      "id": "stolovaya-26-makh",
      "name": "Столовая 26",
      "city": "Махачкала",
      "categories": [
        "restaurant"
      ],
      "ownDelivery": true,
      "address": "улица Магомеда Ярагского, 110",
      "coords": [
        42.962236,
        47.495222
      ],
      "mapUrl": "https://2gis.ru/makhachkala/firm/70000001079833118"
    },
    {
      "id": "sanremo-makh-malygina",
      "name": "Sanremo",
      "city": "Махачкала",
      "categories": [
        "coffee"
      ],
      "ownDelivery": false,
      "address": "улица Малыгина, 45",
      "coords": [
        42.975785,
        47.515805
      ],
      "mapUrl": "https://2gis.ru/makhachkala/firm/70000001067211560"
    },
    {
      "id": "sanremo-makh-korkmasova",
      "name": "Sanremo",
      "city": "Махачкала",
      "categories": [
        "coffee"
      ],
      "ownDelivery": false,
      "address": "улица Коркмасова, 17",
      "coords": [
        42.9819,
        47.496
      ],
      "mapUrl": "https://2gis.ru/makhachkala/search/Sanremo%20%D0%9A%D0%BE%D1%80%D0%BA%D0%BC%D0%B0%D1%81%D0%BE%D0%B2%D0%B0%2017"
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
      "id": "rostiks-makh",
      "name": "Ростикс (KFC)",
      "city": "Махачкала",
      "categories": [
        "fastfood"
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
      "id": "sushimania-makh",
      "name": "СушиМания",
      "city": "Махачкала",
      "categories": [
        "fastfood"
      ],
      "ownDelivery": true,
      "address": "улица Хизроева, 40А",
      "coords": [
        42.974854,
        47.475842
      ],
      "mapUrl": "https://2gis.ru/makhachkala/firm/70000001035311534"
    },
    {
      "id": "tbiliso-makh",
      "name": "Тбилисо",
      "city": "Махачкала",
      "categories": [
        "restaurant"
      ],
      "ownDelivery": true,
      "address": "улица Буйнакского, 7",
      "coords": [
        42.98382,
        47.510516
      ],
      "mapUrl": "https://2gis.ru/makhachkala/firm/70000001021557689"
    },
    {
      "id": "puls-makh",
      "name": "Пульс · Ляхова",
      "city": "Махачкала",
      "categories": [
        "restaurant"
      ],
      "ownDelivery": false,
      "address": "улица Ляхова"
    },
    {
      "id": "margarita-makh",
      "name": "Маргарита · доставка",
      "city": "Махачкала",
      "categories": [
        "restaurant"
      ],
      "ownDelivery": true,
      "address": "Доставка по городу",
      "phones": [
        "+7 988 860-11-10"
      ]
    },
    {
      "id": "samarkand-makh",
      "name": "Самарканд",
      "city": "Махачкала",
      "categories": [
        "restaurant"
      ],
      "ownDelivery": false,
      "address": "улица Гагарина, 56"
    },
    {
      "id": "sanremo-kas-lenina",
      "name": "Sanremo",
      "city": "Каспийск",
      "categories": [
        "coffee"
      ],
      "ownDelivery": false,
      "address": "улица Ленина, 52Д",
      "coords": [
        42.895536,
        47.631299
      ],
      "mapUrl": "https://2gis.ru/kaspiysk/firm/70000001035505844"
    },
    {
      "id": "chicago-kas",
      "name": "Chicago Pizza",
      "city": "Каспийск",
      "categories": [
        "fastfood"
      ],
      "ownDelivery": true
    },
    {
      "id": "gamach-kas",
      "name": "Гамач Бургер",
      "city": "Каспийск",
      "categories": [
        "fastfood"
      ],
      "ownDelivery": false
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
      "id": "pikri-gagarina",
      "name": "Pikri",
      "city": "Дербент",
      "categories": [
        "coffee"
      ],
      "ownDelivery": true,
      "address": "улица Юрия Гагарина, 2д",
      "coords": [
        42.060698,
        48.290531
      ],
      "description": "Кофейня.",
      "mapUrl": "https://2gis.ru/derbent/firm/70000001103291509",
      "phones": [
        "+7 989 865-75-77"
      ]
    },
    {
      "id": "pikri-gasanova",
      "name": "Pikri",
      "city": "Дербент",
      "categories": [
        "coffee"
      ],
      "ownDelivery": false,
      "address": "улица Генриха Гасанова, 5г",
      "coords": [
        42.064199,
        48.288734
      ],
      "description": "Кофейня.",
      "mapUrl": "https://2gis.ru/derbent/firm/70000001117705229",
      "phones": [
        "+7 989 865-75-77"
      ]
    },
    {
      "id": "sova-derbent",
      "name": "Сова",
      "city": "Дербент",
      "categories": [
        "coffee"
      ],
      "ownDelivery": false,
      "address": "улица Таги-Заде, 78",
      "coords": [
        42.057358,
        48.29238
      ],
      "description": "Кофейня.",
      "mapUrl": "https://2gis.ru/derbent/firm/70000001040900455",
      "phones": [
        "+7 989 888-10-75"
      ]
    },
    {
      "id": "resto-1904-derbent",
      "name": "1904",
      "city": "Дербент",
      "categories": [
        "restaurant"
      ],
      "ownDelivery": false,
      "address": "улица Таги-Заде, 23",
      "coords": [
        42.057919,
        48.2962
      ],
      "description": "Ресторан.",
      "mapUrl": "https://2gis.ru/derbent/firm/70000001076577575",
      "phones": [
        "+7 928 219-19-04"
      ]
    },
    {
      "id": "karavan-saray-derbent",
      "name": "Караван Сарай",
      "city": "Дербент",
      "categories": [
        "restaurant"
      ],
      "ownDelivery": true,
      "address": "улица Ленина, 37",
      "coords": [
        42.057365,
        48.296873
      ],
      "description": "Ресторан.",
      "mapUrl": "https://2gis.ru/derbent/firm/70000001061764567",
      "phones": [
        "+7 989 865-75-45"
      ]
    },
    {
      "id": "samburger-derbent",
      "name": "Самбургер",
      "city": "Дербент",
      "categories": [
        "fastfood"
      ],
      "ownDelivery": true,
      "address": "улица Гейдара Алиева, 6А",
      "coords": [
        42.062952,
        48.291684
      ],
      "description": "Бургерная.",
      "mapUrl": "https://2gis.ru/derbent/firm/70000001102815676",
      "phones": [
        "+7 928 960-80-00"
      ]
    },
    {
      "id": "urban-derbent",
      "name": "Urban",
      "city": "Дербент",
      "categories": [
        "fastfood"
      ],
      "ownDelivery": false,
      "address": "улица Сальмана, 12",
      "coords": [
        42.054068,
        48.289706
      ],
      "description": "Кафе.",
      "mapUrl": "https://2gis.ru/derbent/firm/70000001089059093",
      "phones": [
        "+7 928 543-53-33"
      ]
    },
    {
      "id": "mangal-derbent",
      "name": "Мангал",
      "city": "Дербент",
      "categories": [
        "fastfood"
      ],
      "ownDelivery": false,
      "address": "улица Пушкина, 60/1",
      "coords": [
        42.055946,
        48.29407
      ],
      "description": "Кафе.",
      "mapUrl": "https://2gis.ru/derbent/firm/70000001038318610",
      "phones": [
        "+7 988 692-25-02"
      ]
    },
    {
      "id": "kebab-derbent",
      "name": "Кебаб",
      "city": "Дербент",
      "categories": [
        "fastfood"
      ],
      "ownDelivery": false,
      "address": "улица Пушкина, 46",
      "coords": [
        42.056669,
        48.297057
      ],
      "description": "Кафе.",
      "mapUrl": "https://2gis.ru/derbent/firm/70000001038466474",
      "phones": [
        "+7 928 978-22-99"
      ]
    },
    {
      "id": "xfood-derbent",
      "name": "XFood · доставка",
      "city": "Дербент",
      "categories": [
        "fastfood"
      ],
      "ownDelivery": true,
      "address": "улица Курбанова, 20/1",
      "coords": [
        42.059423,
        48.294362
      ],
      "description": "Доставка еды.",
      "mapUrl": "https://2gis.ru/derbent/firm/70000001039610896",
      "phones": [
        "+7 967 121-41-41"
      ]
    },
    {
      "id": "osaka-derbent",
      "name": "Осака · доставка",
      "city": "Дербент",
      "categories": [
        "fastfood"
      ],
      "ownDelivery": true,
      "address": "улица Ленина, 4",
      "coords": [
        42.05908,
        48.302961
      ],
      "description": "Доставка суши.",
      "mapUrl": "https://2gis.ru/derbent/firm/70000001041681671",
      "phones": [
        "+7 963 427-47-81"
      ]
    },
    {
      "id": "zamzam-pushkina-70",
      "name": "Столовая «Зам-Зам»",
      "city": "Дербент",
      "categories": [
        "restaurant"
      ],
      "ownDelivery": false,
      "address": "улица Пушкина, 70",
      "coords": [
        42.055552,
        48.292595
      ],
      "description": "Столовая.",
      "mapUrl": "https://2gis.ru/derbent/firm/70000001101339781",
      "phones": [
        "+7 928 599-44-88"
      ]
    },
    {
      "id": "zamzam-buynakskogo-41",
      "name": "Столовая «Зам-Зам»",
      "city": "Дербент",
      "categories": [
        "restaurant"
      ],
      "ownDelivery": false,
      "address": "улица Буйнакского, 41",
      "coords": [
        42.055619,
        48.298347
      ],
      "description": "Столовая.",
      "mapUrl": "https://2gis.ru/derbent/firm/70000001047224932",
      "phones": [
        "+7 928 599-44-88"
      ]
    },
    {
      "id": "zamzam-lenina-93",
      "name": "Столовая «Зам-Зам»",
      "city": "Дербент",
      "categories": [
        "restaurant"
      ],
      "ownDelivery": false,
      "address": "улица Ленина, 93",
      "coords": [
        42.054979,
        48.286884
      ],
      "description": "Столовая.",
      "mapUrl": "https://2gis.ru/derbent/firm/70000001037762870",
      "phones": [
        "+7 928 599-44-88"
      ]
    },
    {
      "id": "bodry-gorets-derbent",
      "name": "Бодрый Горец",
      "city": "Дербент",
      "categories": [
        "coffee"
      ],
      "ownDelivery": false,
      "address": "улица Сальмана, 71Б",
      "coords": [
        42.041353,
        48.294613
      ],
      "description": "Кофейня.",
      "mapUrl": "https://2gis.ru/derbent/firm/70000001080122934",
      "phones": [
        "+7 999 539-88-53"
      ]
    },
    {
      "id": "marsha-derbent",
      "name": "Marsha",
      "city": "Дербент",
      "categories": [
        "coffee"
      ],
      "ownDelivery": false,
      "address": "улица Гейдара Алиева, 11в/1",
      "coords": [
        42.063272,
        48.292679
      ],
      "description": "Кофейня.",
      "mapUrl": "https://2gis.ru/derbent/firm/70000001089521401",
      "phones": [
        "+7 938 801-60-66"
      ]
    },
    {
      "id": "chi-derbent",
      "name": "Чи",
      "city": "Дербент",
      "categories": [
        "coffee"
      ],
      "ownDelivery": false,
      "address": "улица Таги-Заде, 30Б",
      "coords": [
        42.058136,
        48.295713
      ],
      "description": "Кофейня.",
      "mapUrl": "https://2gis.ru/derbent/firm/70000001048047573",
      "phones": [
        "+7 928 806-66-90"
      ]
    },
    {
      "id": "amanat-derbent",
      "name": "Аманат",
      "city": "Дербент",
      "categories": [
        "restaurant"
      ],
      "ownDelivery": false,
      "address": "улица Буйнакского, 11",
      "coords": [
        42.056682,
        48.302743
      ],
      "description": "Хинкальная.",
      "mapUrl": "https://2gis.ru/derbent/firm/70000001075856392",
      "phones": [
        "+7 928 593-00-40",
        "+7 928 596-00-90"
      ]
    },
    {
      "id": "saklya-derbent",
      "name": "Сакля",
      "city": "Дербент",
      "categories": [
        "restaurant"
      ],
      "ownDelivery": true,
      "address": "улица Пушкина, 44/3",
      "coords": [
        42.056971,
        48.298468
      ],
      "description": "Кафе.",
      "mapUrl": "https://2gis.ru/derbent/firm/70000001064209058",
      "phones": [
        "+7 928 242-00-04"
      ]
    },
    {
      "id": "jumeira-derbent",
      "name": "Джумейра",
      "city": "Дербент",
      "categories": [
        "restaurant"
      ],
      "ownDelivery": true,
      "address": "улица Вокзальная, 27/1",
      "coords": [
        42.057415,
        48.305046
      ],
      "description": "Ресторан.",
      "mapUrl": "https://2gis.ru/derbent/firm/70000001052975463",
      "phones": [
        "+7 928 460-05-05"
      ]
    },
    {
      "id": "pirs-derbent",
      "name": "Pirs",
      "city": "Дербент",
      "categories": [
        "coffee"
      ],
      "ownDelivery": false,
      "address": "проспект 345-й Дагестанской Стрелковой Дивизии, 7",
      "coords": [
        42.070512,
        48.294965
      ],
      "description": "Кофейня.",
      "mapUrl": "https://2gis.ru/derbent/firm/70000001115147557",
      "phones": [
        "+7 928 833-44-00"
      ]
    },
    {
      "id": "palmira-derbent",
      "name": "Пальмира",
      "city": "Дербент",
      "categories": [
        "restaurant"
      ],
      "ownDelivery": true,
      "address": "улица Ленина, 3",
      "coords": [
        42.059068,
        48.304227
      ],
      "description": "Чайный ресторан. Доставка указана в открытой карточке заведения.",
      "mapUrl": "https://2gis.ru/derbent/firm/70000001053439558",
      "phones": [
        "+7 928 837-70-07"
      ]
    },
    {
      "id": "myasnaya-dolina-derbent",
      "name": "Мясная долина",
      "city": "Дербент",
      "categories": [
        "grocery"
      ],
      "ownDelivery": true,
      "address": "улица Сальмана, 39",
      "coords": [
        42.050901,
        48.291355
      ],
      "description": "Магазин мяса и полуфабрикатов. Доставка отмечена в 2ГИС.",
      "mapUrl": "https://2gis.ru/derbent/firm/70000001101575633",
      "phones": [
        "+7 938 781-67-95"
      ]
    },
    {
      "id": "shaurma-shop-derbent",
      "name": "Шаурма Shop",
      "city": "Дербент",
      "categories": [
        "fastfood"
      ],
      "ownDelivery": true,
      "address": "улица Сальмана, 39",
      "coords": [
        42.050901,
        48.291355
      ],
      "description": "Точка быстрого питания. Возможность заказа доставки указана в 2ГИС.",
      "mapUrl": "https://2gis.ru/derbent/firm/70000001114365681",
      "phones": [
        "+7 938 209-19-93"
      ]
    },
    {
      "id": "chudushnaya-salmana-derbent",
      "name": "Чудушная",
      "city": "Дербент",
      "categories": [
        "restaurant"
      ],
      "ownDelivery": false,
      "address": "3-й проезд Сальмана, 19А",
      "coords": [
        42.03969,
        48.29669
      ],
      "description": "Чудушная. Контакты уточняются.",
      "mapUrl": "https://2gis.ru/derbent/geo/70030076169449018"
    },
    {
      "id": "samburger-khas",
      "name": "Самбургер",
      "city": "Хасавюрт",
      "categories": [
        "fastfood"
      ],
      "ownDelivery": false
    },
    {
      "id": "vkus-gor-sochi",
      "name": "Вкус гор",
      "city": "Сочи",
      "categories": [
        "restaurant"
      ],
      "ownDelivery": true,
      "address": "улица Чайковского, 14А",
      "coords": [
        43.594,
        39.718778
      ],
      "description": "Примечание владельца Halal Tracker: хозяин кафе не мусульманин, в заведении продают алкоголь. Мясо поставляет мусульманин, поэтому, по информации владельца проекта, еду здесь можно употреблять.",
      "mapUrl": "https://yandex.ru/maps/-/CDxBQEK7",
      "phones": [
        "+7 986 111-07-07"
      ]
    },
    {
      "id": "halal-tandyr-mangal-sochi",
      "name": "Халяль тандыр мангал",
      "city": "Сочи",
      "categories": [
        "restaurant"
      ],
      "ownDelivery": true,
      "address": "улица Гагарина, 57",
      "coords": [
        43.607773,
        39.725999
      ],
      "description": "Кафе с блюдами из тандыра и с мангала.",
      "mapUrl": "https://yandex.ru/maps/org/khalyal_tandyr_mangal/236328986474/",
      "phones": [
        "+7 918 403-94-08"
      ]
    },
    {
      "id": "halal-master-24-sochi",
      "name": "Халяль Мастер 24",
      "city": "Сочи",
      "categories": [
        "fastfood"
      ],
      "ownDelivery": true,
      "address": "улица Гагарина, 63А",
      "coords": [
        43.609584,
        39.728984
      ],
      "description": "Примечание владельца Halal Tracker: подтверждена только говядина. Халяльность курицы проверить не удалось. Заведение заявляет, что курица халяльная, но сведения о поставщике из Казахстана не удалось подтвердить.",
      "mapUrl": "https://yandex.ru/maps/org/khalyal_master_24/106466363814/",
      "phones": [
        "+7 900 291-07-60"
      ]
    },
    {
      "id": "zhizhig-galnash-sochi",
      "name": "Жижиг галнаш",
      "city": "Сочи",
      "categories": [
        "restaurant"
      ],
      "ownDelivery": true,
      "address": "улица Гагарина, 63",
      "coords": [
        43.610072,
        39.729382
      ],
      "description": "Кафе чеченской кухни.",
      "mapUrl": "https://yandex.ru/maps/org/zhizhig_galnash/134443018793/",
      "phones": [
        "+7 965 969-00-85",
        "+7 962 883-08-32"
      ]
    },
    {
      "id": "avstraliya-sochi",
      "name": "Австралия",
      "city": "Сочи",
      "categories": [
        "restaurant"
      ],
      "ownDelivery": true,
      "address": "Пластунская улица, 147/2",
      "coords": [
        43.616576,
        39.739818
      ],
      "description": "Кафе с блюдами восточной кухни.",
      "mapUrl": "https://yandex.ru/maps/org/avstraliya/1005805263/",
      "phones": [
        "+7 989 163-91-57"
      ]
    },
    {
      "id": "eshpey-adler-sochi",
      "name": "ЕшьПей",
      "city": "Сочи",
      "categories": [
        "fastfood"
      ],
      "ownDelivery": true,
      "address": "Адлер, улица Молокова, 5А",
      "coords": [
        43.429615,
        39.925404
      ],
      "description": "Фастфуд в Адлере: шаурма, бургеры, сувлаки и хот-доги. Есть доставка. В 2ГИС эта точка указана по адресу Садовая улица, 5; в Яндекс Картах — улица Молокова, 5А.",
      "workingHours": "Круглосуточно",
      "mapUrl": "https://2gis.ru/sochi/firm/70000001052493401",
      "phones": [
        "+7 999 654-51-50"
      ]
    },
    {
      "id": "dom-hleba-baysultanova-nalchik",
      "name": "Дом хлеба · Байсултанова",
      "city": "Нальчик",
      "categories": [
        "restaurant"
      ],
      "ownDelivery": true,
      "address": "улица Байсултанова, 2",
      "coords": [
        43.478943,
        43.586382
      ],
      "description": "Кафе-пекарня: хлеб, выпечка, пицца и блюда из печи. Есть доставка.",
      "workingHours": "Ежедневно, 07:00–23:00",
      "mapUrl": "https://2gis.ru/nalchik/firm/70000001047767255",
      "phones": [
        "+7 964 708-00-07"
      ]
    },
    {
      "id": "dom-hleba-pushkina-nalchik",
      "name": "Дом хлеба · Пушкина",
      "city": "Нальчик",
      "categories": [
        "restaurant"
      ],
      "ownDelivery": true,
      "address": "улица Пушкина, 2",
      "coords": [
        43.477358,
        43.599403
      ],
      "description": "Кафе-пекарня. Выпечка и готовые блюда; доступна доставка.",
      "workingHours": "Ежедневно, 08:00–23:00",
      "mapUrl": "https://2gis.ru/nalchik/firm/70000001112858874",
      "phones": [
        "+7 929 177-00-04"
      ]
    },
    {
      "id": "dom-hleba-shardanova-nalchik",
      "name": "Дом хлеба · Шарданова",
      "city": "Нальчик",
      "categories": [
        "restaurant"
      ],
      "ownDelivery": true,
      "address": "улица Шарданова, 1Б",
      "coords": [
        43.505328,
        43.602422
      ],
      "description": "Кафе-пекарня. В Яндекс Картах этот филиал указан по адресу Эльбрусская улица, 51А; в 2ГИС — улица Шарданова, 1Б. Есть доставка.",
      "workingHours": "Ежедневно, 08:30–23:00",
      "mapUrl": "https://2gis.ru/nalchik/firm/70000001067185473",
      "phones": [
        "+7 939 666-03-33"
      ]
    },
    {
      "id": "dom-hleba-tarchokova-nalchik",
      "name": "Дом хлеба · Тарчокова",
      "city": "Нальчик",
      "categories": [
        "restaurant"
      ],
      "ownDelivery": true,
      "address": "улица Тарчокова, 125в",
      "coords": [
        43.484123,
        43.56828
      ],
      "description": "Кафе-пекарня. Выпечка и готовые блюда; доступна доставка.",
      "workingHours": "Ежедневно, 08:00–23:00",
      "mapUrl": "https://2gis.ru/nalchik/firm/70000001113184687",
      "phones": [
        "+7 964 708-00-07",
        "+7 960 422-62-38",
        "+7 963 165-88-81",
        "+7 988 937-57-77"
      ]
    },
    {
      "id": "plov-morkov-shogentsukova-nalchik",
      "name": "Плов-морковь · Шогенцукова",
      "city": "Нальчик",
      "categories": [
        "restaurant"
      ],
      "ownDelivery": true,
      "address": "проспект Шогенцукова, 16",
      "coords": [
        43.480717,
        43.606847
      ],
      "description": "Кафе с пловом, блюдами с мангала, пиццей, роллами и шаурмой. Есть доставка.",
      "workingHours": "Пн–сб 09:00–02:00; вс 12:00–02:00",
      "mapUrl": "https://2gis.ru/nalchik/firm/70000001054922511",
      "phones": [
        "+7 962 086-66-61",
        "+7 938 700-01-94"
      ]
    },
    {
      "id": "plov-morkov-ashurova-nalchik",
      "name": "Плов-морковь · Ашурова",
      "city": "Нальчик",
      "categories": [
        "restaurant"
      ],
      "ownDelivery": true,
      "address": "улица Ашурова, 1а",
      "coords": [
        43.501598,
        43.645343
      ],
      "description": "Кафе с пловом, пиццей и шаурмой. Есть доставка.",
      "workingHours": "Ежедневно, 10:00–24:00",
      "mapUrl": "https://2gis.ru/nalchik/firm/70000001111500734",
      "phones": [
        "+7 928 722-22-60"
      ]
    },
    {
      "id": "burger-mania-nalchik",
      "name": "Бургер мания",
      "city": "Нальчик",
      "categories": [
        "fastfood"
      ],
      "ownDelivery": true,
      "address": "проспект Кулиева, 13Б",
      "coords": [
        43.474147,
        43.581422
      ],
      "description": "Круглосуточное кафе быстрого питания: бургеры, шаурма, такос и кесадилья. Есть доставка.",
      "workingHours": "Круглосуточно",
      "mapUrl": "https://2gis.ru/nalchik/firm/70000001033969821",
      "phones": [
        "+7 988 930-07-07",
        "+7 938 916-97-77"
      ]
    },
    {
      "id": "kompot-nalchik",
      "name": "Компот",
      "city": "Нальчик",
      "categories": [
        "restaurant",
        "fastfood"
      ],
      "ownDelivery": true,
      "address": "улица Байсултанова, 21Б",
      "coords": [
        43.48134,
        43.583006
      ],
      "description": "Кафе с бургерами, твистерами, шаурмой и напитками. Есть доставка. В 2ГИС адрес указан как Байсултанова, 21Б, а в официальном Telegram-канале — Байсултанова, 21.",
      "workingHours": "Ежедневно, 08:00–23:00",
      "mapUrl": "https://2gis.ru/nalchik/firm/70000001109849665",
      "phones": [
        "+7 960 429-62-00"
      ]
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
      "id": "dagmit",
      "name": "Дагмит",
      "city": "Махачкала",
      "categories": [
        "grocery"
      ],
      "ownDelivery": false,
      "address": "Абубакарова, 106В · Абдулхамида Юсупова, 5 · Учительская, 2",
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
