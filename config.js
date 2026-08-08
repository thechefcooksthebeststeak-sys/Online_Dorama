/* ═══════════════════════════════════════════════
   config.js — баптаулар мен бастапқы дерек
   ═══════════════════════════════════════════════ */

/**
 * FIREBASE БАПТАУЫ
 * console.firebase.google.com → Project settings → Your apps → Web
 * Осындағы мәндерді өз жобаңның мәндерімен алмастыр.
 * Бос қалдырсаң — сайт демо режимде (localStorage) жұмыс істей береді.
 */
const FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

/** Дүкен деректері */
const SHOP = {
  name: "Online Dorama",
  whatsapp: "77054314996",           // тапсырыс осы нөмірге барады
  whatsappShow: "+7 705 431 49 96",  // сайтта көрінетін түрі
  currency: "₸",
  adminEmail: "admin@doramahub.kz",  // Firebase-тегі әкімші аккаунты

  /* DORAMA AI. Бос болса — жергілікті логика жұмыс істейді (тегін, кілт керек емес).
     Өз серверің болса, соның мекенжайын жаз — сонда нағыз Claude жауап береді.
     Мысалы: "https://whatsapp-saas-production-a443.up.railway.app/api/recommend"
     API кілтін ЕШҚАШАН осы файлға жазба — ол серверде тұруы керек. */
  aiEndpoint: "",

  /* Админ панеліне кіретін құпия код.
     Мұнда кодтың өзі емес, SHA-256 «саусақ ізі» ғана жатыр —
     файлды ашқан адам кодты оқи алмайды.

     Кодты ауыстыру: браузердің консолінде (F12) мынаны орындап,
     шыққан жолды төмендегі мәннің орнына қой:
        await sha256("менің-жаңа-кодым")

     ЕСКЕРТУ: Firebase қосулы болса, бұл код сонымен қатар
     adminEmail аккаунтының құпиясөзі болады — сонда тексеруді
     сервер жүргізеді де, кодты айналып өту мүмкін болмайды. */
  adminCodeHash: "32b8476c3d87730b9bb0ee8fd8fab3c7bd005cf90e9d5f2436531e0d342441fd"
};

/* Жариялау үшін GitHub деректері.
   Репозиторийдің атын өзгертсең — тек осы жерді түзетесің.
   Токен мұнда ЖОҚ: ол тек әкімшінің браузерінде сақталады. */
const GITHUB = {
  owner:  "thechefcooksthebeststeak-sys",
  repo:   "Online_Dorama",
  branch: "main"
};

const GENRES   = ["Романтика","Драма","Комедия","Триллер","Тарихи","Фэнтези","Детектив","Мектеп"];
const COUNTRIES = ["Корея","Қытай","Түркия","Жапония","Тайланд"];
const MOODS    = ["жылы","жеңіл","ауыр","күлкілі","шиеленісті","көз жасы","бақытты соңы","қайғылы соңы"];

/* ═══════════════════════════════════════════════
   DORAMA AI сөздігі
   Әр жазба: адам қалай айтады → нені білдіреді.
   Жаңа сөз қосу үшін тек words тізіміне жаз.
   ═══════════════════════════════════════════════ */
const AI_RULES = [
  { words:["романтик","махаббат","ғашық","сүйіспеншілік","любов","romance","роман"], genres:["Романтика"] },
  { words:["күлкі","көңілді","комедия","жеңіл","смешн","весел","comedy"],            genres:["Комедия"], mood:["күлкілі","жеңіл"] },
  { words:["қорқыныш","шиеленіс","триллер","қауіп","thriller"],                       genres:["Триллер"], mood:["шиеленісті"] },
  { words:["детектив","қылмыс","тергеу","жұмбақ","құпия","расследован"],              genres:["Детектив"] },
  { words:["тарихи","патша","хан","сағеук","ежелгі","историческ"],                    genres:["Тарихи"] },
  { words:["фэнтези","сиқыр","фантаст","ғажайып","магия"],                            genres:["Фэнтези"] },
  { words:["мектеп","жастар","студент","оқушы","школ"],                               genres:["Мектеп"] },
  { words:["драма","өмірлік","ауыр","терең"],                                         genres:["Драма"], mood:["ауыр"] },

  { words:["қайғылы","мұңды","жылат","көз жас","қайғы","грустн","печальн","sad"],     mood:["қайғылы соңы","көз жасы"] },
  { words:["бақытты","жақсы аяқтал","хэппи","happy","жылы аяқтал"],                   mood:["бақытты соңы"] },
  { words:["жылы","жайлы","жұмсақ","тыныш"],                                          mood:["жылы"] },

  { words:["қысқа","аз серия","тез көр"],   filter:d => d.episodes <= 16 },
  { words:["ұзақ","көп серия"],             filter:d => d.episodes >= 24 },
  { words:["жаңа","соңғы","2025","2026"],   filter:d => d.isNew || d.year >= 2024 },
  { words:["арзан","ұтымды","қымбат емес"], filter:d => d.price <= 800 },
  { words:["үздік","мықты","ең жақсы","жоғары рейтинг"], filter:d => d.rating >= 8.5 },

  { words:["корей","корея","korean"],   country:"Корея" },
  { words:["қытай","китай","chinese"],  country:"Қытай" },
  { words:["түрік","турец","turkish"],  country:"Түркия" },
  { words:["жапон","япон","japanese"],  country:"Жапония" },
  { words:["тай","тайланд","thai"],     country:"Тайланд" }
];

/* Терістеу сөздері: «қайғылы емес» дегенді түсіну үшін */
const AI_NEGATIONS = ["емес","жоқ","болмасын","керекпейді","without","без","не хочу","қаламаймын"];

/** Постер жоқ болса — атауынан әдемі градиент постер жасаймыз */
function makePoster(title, seed) {
  const pairs = [
    ["#8B5CF6","#2E1065"], ["#6D28D9","#111827"], ["#A78BFA","#1E1B4B"],
    ["#7C3AED","#0F0F0F"], ["#C4B5FD","#4C1D95"], ["#5B21B6","#0F0F0F"]
  ];
  const i = (seed ?? title.length) % pairs.length;
  const [c1, c2] = pairs[i];
  const short = title.length > 22 ? title.slice(0, 21) + "…" : title;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>
      </linearGradient>
    </defs>
    <rect width="400" height="600" fill="${c2}"/>
    <circle cx="300" cy="140" r="210" fill="url(#g)" opacity="0.85"/>
    <circle cx="90" cy="470" r="150" fill="url(#g)" opacity="0.45"/>
    <text x="34" y="520" fill="#ffffff" font-family="Unbounded, sans-serif"
          font-size="30" font-weight="800">${escapeXml(short)}</text>
    <text x="34" y="552" fill="#ffffff" opacity=".65" font-family="Manrope, sans-serif"
          font-size="17" letter-spacing="3">ONLINE DORAMA</text>
  </svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

function escapeXml(s) {
  return String(s).replace(/[<>&'"]/g, c =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]));
}

/* Каталогты файлдан өзгерткен сайын осы санды 1-ге өсір.
   Онсыз бұрын кірген адамның браузерінде ескі тізім қалып қояды. */
const CATALOG_VERSION = 1;

/** Каталог. Firebase жоқ болса — сайт тікелей осыдан жұмыс істейді. */
const SEED_DRAMAS = [
  { title:"Гоблин", alt:["Goblin", "Токкэби", "Guardian: The Lonely and Great God"], titleOriginal:"도깨비", country:"Корея", genres:["Фэнтези","Романтика"], year:2016, rating:9.1, episodes:16, price:900, popular:true,  isNew:false, description:"Мың жыл бойы өлмей жүрген жауынгер өз қарғысын аяқтайтын жалғыз адамды іздейді. Ажал періштесімен бір пәтерде тұру одан да қиынға соғады. Тағдыр, махаббат және өткенді жіберу туралы әдемі әңгіме.", mood:["жылы", "бақытты соңы", "көз жасы"] },
  { title:"Итэвон класы", alt:["Itaewon Class", "Итэвон Класс"], titleOriginal:"이태원 클라쓰", country:"Корея", genres:["Драма"], year:2020, rating:8.6, episodes:16, price:800, popular:true, isNew:false, description:"Әкесінен айырылған жас жігіт Итэвон көшесінде шағын бар ашып, ел билеген алпауыт компанияға қарсы шығады. Кек пен адалдық арасындағы шекара туралы.", mood:["ауыр", "бақытты соңы", "шиеленісті"] },
  { title:"Апаттық қону", alt:["Crash Landing on You", "Крэш Лендинг", "Аварийная посадка любви", "CLOY"], titleOriginal:"사랑의 불시착", country:"Корея", genres:["Романтика","Комедия"], year:2019, rating:9.0, episodes:16, price:900, popular:true, isNew:false, description:"Оңтүстіктің бай мұрагері параплан апатынан кейін шекараның арғы бетіне түсіп кетеді. Оны тапқан офицер жасыруға көмектеседі — сөйтіп мүмкін емес махаббат басталады.", mood:["жылы", "бақытты соңы", "күлкілі"] },
  { title:"Менің атым Ким Сам Сун", alt:["My Name is Kim Sam Soon", "Меня зовут Ким Сам Сун"], titleOriginal:"내 이름은 김삼순", country:"Корея", genres:["Романтика","Комедия"], year:2005, rating:8.2, episodes:16, price:600, popular:false, isNew:false, description:"Кондитер Сам Сун жұмысынан да, жігітінен де айырылады. Ресторан иесімен жасанды қарым-қатынас жасау келісімі шынайы сезімге ұласады.", mood:["жеңіл", "күлкілі", "бақытты соңы"] },
  { title:"Құпия орман", alt:["Stranger", "Secret Forest", "Тайный лес"], titleOriginal:"비밀의 숲", country:"Корея", genres:["Детектив","Триллер"], year:2017, rating:8.9, episodes:16, price:850, popular:true, isNew:false, description:"Эмоцияны сезінбейтін прокурор мен адал полиция қызметкері прокуратура ішіндегі жемқорлықты ашады. Әр серия — жаңа түйін.", mood:["шиеленісті", "ауыр"] },
  { title:"Жиырма бесінші сағат", alt:["Twenty Five Twenty One", "25 21", "Двадцать пять двадцать один"], titleOriginal:"스물다섯 스물하나", country:"Корея", genres:["Романтика","Мектеп"], year:2022, rating:8.7, episodes:16, price:900, popular:false, isNew:true, description:"Дағдарыс жылдары арманынан айырылған қылышшы қыз бен бәрін жоғалтқан жігіт кездеседі. Жастық шақ пен алғашқы махаббат туралы жылы әңгіме.", mood:["жылы", "қайғылы соңы", "көз жасы"] },
  { title:"Айсберг", alt:["Iceberg"], titleOriginal:"빙산", country:"Корея", genres:["Драма","Триллер"], year:2025, rating:8.4, episodes:12, price:1000, popular:false, isNew:true, description:"Мұздай суық іскер әйел бір түнде бүкіл байлығынан айырылады. Қайта көтерілу жолында өткен өмірінің құпиялары бетке шығады.", mood:["ауыр", "шиеленісті"] },
  { title:"Ұмытылған жаз", alt:["Forgotten Summer", "Забытое лето"], titleOriginal:"잊혀진 여름", country:"Қытай", genres:["Романтика","Драма"], year:2024, rating:8.1, episodes:24, price:750, popular:false, isNew:true, description:"Он жылдан кейін туған қаласына оралған суретші бірінші махаббатымен қайта кездеседі. Есте қалған жаз бен айтылмай қалған сөздер туралы.", mood:["жылы", "қайғылы соңы", "көз жасы"] },
  { title:"Ай сарайы", alt:["Moon Palace", "Лунный дворец"], titleOriginal:"月宫", country:"Қытай", genres:["Тарихи","Фэнтези"], year:2023, rating:8.5, episodes:40, price:1100, popular:true, isNew:false, description:"Тәңір патшалығынан қуылған құдай пенде болып қайта туады. Мыңжылдық кек пен мәңгілік сүйіспеншілік бір-бірімен шайқасады.", mood:["ауыр", "қайғылы соңы"] },
  { title:"Қара махаббат", alt:["Kara Sevda", "Endless Love", "Черная любовь"], titleOriginal:"Kara Sevda", country:"Түркия", genres:["Романтика","Драма"], year:2015, rating:8.8, episodes:74, price:1200, popular:true, isNew:false, description:"Кедей отбасының баласы мен ауқатты қыздың арасындағы қиын махаббат. Байлық, кек және таңдау туралы ұзақ әрі күшті хикая.", mood:["ауыр", "қайғылы соңы", "көз жасы"] },
  { title:"Токио әуені", alt:["Tokyo Melody", "Мелодия Токио"], titleOriginal:"東京のメロディ", country:"Жапония", genres:["Драма","Романтика"], year:2024, rating:7.9, episodes:10, price:700, popular:false, isNew:true, description:"Естуден айырылған пианист қайта сахнаға шығуға тырысады. Дыбыссыз әлемде музыканы қалай сезінуге болатыны туралы.", mood:["жылы", "бақытты соңы"] },
  { title:"Түнгі базар", alt:["Night Market"], titleOriginal:"ตลาดกลางคืน", country:"Тайланд", genres:["Комедия","Детектив"], year:2023, rating:7.6, episodes:12, price:650, popular:false, isNew:false, description:"Бангкоктың түнгі базарында жоғалған жәшік бүкіл ауданды астаң-кестең етеді. Күлкілі әрі шиеленісті детектив.", mood:["жеңіл", "күлкілі", "шиеленісті"] }
];
