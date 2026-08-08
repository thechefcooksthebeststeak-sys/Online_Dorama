/* ═══════════════════════════════════════════════
   app.js — маршрутизатор және барлық беттер
   Реті: 1. Көмекші  2. Беттер  3. Админ
         4. Оқиғалар 5. Іске қосу
   ═══════════════════════════════════════════════ */

const APP = $("#app");

/* ── 1. Көмекші ──────────────────────────────── */

/** "#/store?q=гоблин" → { path:"/store", query:{q:"гоблин"} } */
function parseRoute() {
  const raw = location.hash.slice(1) || "/";
  const [path, qs] = raw.split("?");
  return { path, query: Object.fromEntries(new URLSearchParams(qs || "")) };
}

const go = to => { location.hash = to; };

/** Бетті ауыстырғанда жоғарыға көтеру */
function render(html) {
  APP.innerHTML = html;
  window.scrollTo(0, 0);
}

/** Меню сілтемелерін белгілеу */
function markNav(path) {
  const root = "/" + (path.split("/")[1] || "");
  $$("[data-nav]").forEach(a => a.classList.toggle("is-active", a.dataset.nav === root));
}

/** Кіру қажет болса — терезені ашып, false қайтарады */
function requireAuth(message = "Алдымен аккаунтқа кіріңіз") {
  if (Auth.user) return true;
  toast(message);
  Modal.open($("#authModal"));
  return false;
}

/* ── 2. Беттер ───────────────────────────────── */

/* ---- 2.1 Басты бет ---- */
async function viewHome() {
  const all = await DB.dramas();
  const popular = all.filter(d => d.popular);
  const fresh   = all.filter(d => d.isNew);
  const top     = [...all].sort((a, b) => b.rating - a.rating).slice(0, 5);

  render(`
    <section class="hero" id="hero">
      ${top.map((d, i) => `
        <div class="hero__slide ${i === 0 ? "is-on" : ""}" data-i="${i}">
          <div class="hero__art" style="background-image:url('${esc(Img.url(d.poster))}')"></div>
        </div>`).join("")}

      <div class="hero__body">
        <div class="hero__inner" id="heroText"></div>
      </div>

      <div class="hero__dots" id="heroDots">
        ${top.map((_, i) => `<button data-dot="${i}" class="${i === 0 ? "is-on" : ""}" aria-label="${i + 1}-баннер"></button>`).join("")}
      </div>
    </section>

    <section class="section">
      <div class="section__head"><h2>Категориялар</h2></div>
      <div class="cats">
        <a href="#/store">Барлығы</a>
        ${GENRES.map(g => `<a href="#/store?genre=${encodeURIComponent(g)}">${esc(g)}</a>`).join("")}
      </div>
    </section>

    <section class="section">
      <div class="section__head">
        <h2>Ең танымал дорамалар</h2>
        <a href="#/store">Бәрін көру →</a>
      </div>
      ${railHTML("pop", popular.length ? popular : all.slice(0, 8))}
    </section>

    <section class="section">
      <div class="section__head">
        <h2>Жаңа шыққан дорамалар</h2>
        <a href="#/store">Бәрін көру →</a>
      </div>
      ${railHTML("new", fresh.length ? fresh : all.slice(-6))}
    </section>

    ${tgPromoHTML()}
  `);

  startHero(top);
}

/** Telegram арнасының жарнамасы */
function tgPromoHTML() {
  if (!SHOP.telegram) return "";
  return `
  <section class="section">
    <div class="tgpromo">
      <div class="tgpromo__ic">
        <svg viewBox="0 0 24 24"><path d="M21.5 4.3L2.9 11.4c-.9.3-.9 1.6.1 1.9l4.6 1.4 1.8 5.5c.3.8 1.3 1 1.9.4l2.6-2.5 4.6 3.4c.7.5 1.7.1 1.9-.7l3-14.6c.2-.9-.7-1.6-1.5-1.3z"/><path d="M7.6 14.7L18 7.2l-8.3 8.6-.3 3.9"/></svg>
      </div>
      <div class="tgpromo__txt">
        <h2>Telegram арнамызға жазыл</h2>
        <p class="muted">Жаңа дорамалар, жеңілдіктер мен ұсыныстар алдымен сонда шығады.</p>
      </div>
      <a class="btn btn--tg" href="${esc(SHOP.telegram)}" target="_blank" rel="noopener">Жазылу</a>
    </div>
  </section>`;
}

/** Баннер слайдері */
let heroTimer;
function startHero(list) {
  if (!list.length) return;
  clearInterval(heroTimer);
  let i = 0;

  const paint = () => {
    const d = list[i];
    $("#heroText").innerHTML = `
      <div class="hero__eyebrow">
        <span class="pill pill--accent">★ ${d.rating.toFixed(1)}</span>
        <span class="pill">${esc(d.country)}</span>
        <span class="pill">${d.episodes} серия</span>
        <span class="pill">${d.year}</span>
      </div>
      <h1>${esc(d.title)}</h1>
      <p class="hero__desc">${esc(d.description)}</p>
      <div class="hero__cta">
        <a class="btn btn--primary" href="#/drama/${d.id}">Толығырақ</a>
        <button class="btn btn--ghost" data-add="${d.id}">Себетке · ${money(d.price)}</button>
      </div>`;
    $$("#hero .hero__slide").forEach(s => s.classList.toggle("is-on", +s.dataset.i === i));
    $$("#heroDots button").forEach(b => b.classList.toggle("is-on", +b.dataset.dot === i));
  };

  const next = () => { i = (i + 1) % list.length; paint(); };
  paint();
  heroTimer = setInterval(next, 7000);

  $("#heroDots").addEventListener("click", e => {
    const b = e.target.closest("[data-dot]");
    if (!b) return;
    i = +b.dataset.dot; paint();
    clearInterval(heroTimer); heroTimer = setInterval(next, 7000);
  });
}

/* ---- 2.2 DORAMA AI ---- */
const AI_SAMPLES = [
  "Романтикалық, бірақ соңы қайғылы емес",
  "Күлкілі әрі қысқа болсын",
  "Корей детективі керек",
  "Жаңа, арзан, жеңіл нәрсе",
  "Қорқынышты емес, жылы дорама"
];

function viewAI() {
  render(`
    <div class="page">
      <div class="aihead">
        <div class="aihead__bot">🤖</div>
        <div>
          <h1 class="page__title" style="margin:0">DORAMA AI</h1>
          <p class="muted" style="margin:4px 0 0">Көңіл-күйіңді жаз — саған лайық дораманы тауып берейін.</p>
        </div>
      </div>

      <div class="chat" id="chat"></div>

      <div class="samples" id="samples">
        ${AI_SAMPLES.map(t => `<button data-ask="${esc(t)}">${esc(t)}</button>`).join("")}
      </div>

      <form class="askbar" id="askForm">
        <input id="askInput" placeholder="Мысалы: махаббат туралы, бірақ жылатпайтын…"
               autocomplete="off" required>
        <button class="btn btn--primary" type="submit" aria-label="Жіберу">
          <svg viewBox="0 0 24 24" style="width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </button>
      </form>
    </div>
  `);

  const chat = $("#chat");

  const bubble = (who, html) => {
    const el = document.createElement("div");
    el.className = "msg msg--" + who;
    el.innerHTML = html;
    chat.appendChild(el);
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return el;
  };

  const ask = async text => {
    if (!text.trim()) return;
    $("#samples").hidden = true;
    bubble("me", esc(text));

    const thinking = bubble("ai", `<span class="dots"><i></i><i></i><i></i></span>`);
    const res = await AI.recommend(text);

    thinking.innerHTML = esc(res.reply);
    if (res.picks.length) {
      thinking.insertAdjacentHTML("beforeend", `
        <div class="picks">
          ${res.picks.map(p => `
            <a class="pick" href="#/drama/${p.d.id}">
              <img src="${esc(Img.url(p.d.poster))}" alt="">
              <div class="pick__body">
                <b>${esc(p.d.title)}</b>
                <span class="muted">★ ${p.d.rating.toFixed(1)} · ${p.d.episodes} серия · ${esc(p.d.country)}</span>
                ${p.why.length ? `<span class="pick__why">${p.why.map(w => esc(w)).join(" · ")}</span>` : ""}
              </div>
              <span class="pick__price">${money(p.d.price)}</span>
            </a>`).join("")}
        </div>`);
    }
    thinking.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  $("#askForm").addEventListener("submit", e => {
    e.preventDefault();
    const v = $("#askInput").value;
    $("#askInput").value = "";
    ask(v);
  });

  $("#samples").addEventListener("click", e => {
    const b = e.target.closest("[data-ask]");
    if (b) ask(b.dataset.ask);
  });

  bubble("ai", "Сәлем! Қандай дорама іздеп жүрсің? Жанрын, көңіл-күйін, тіпті «ұзақ болмасын» дегеніңді де жаза бер.");
}

/* ---- 2.3 Дүкен ---- */
async function viewStore(query) {
  const all = await DB.dramas();
  const maxPrice = Math.max(1000, ...all.map(d => d.price));

  render(`
    <div class="page">
      <h1 class="page__title">Дүкен</h1>
      <p class="page__lead">Барлығы ${all.length} дорама. Сүзгі арқылы өзіңе керегін тап.</p>

      <div class="filters" id="filters">
        <input type="search" id="fq" placeholder="Атауы бойынша іздеу…" value="${esc(query.q || "")}">
        <select id="fgenre">
          <option value="">Барлық жанр</option>
          ${GENRES.map(g => `<option ${query.genre === g ? "selected" : ""}>${esc(g)}</option>`).join("")}
        </select>
        <select id="fcountry">
          <option value="">Барлық ел</option>
          ${COUNTRIES.map(c => `<option ${query.country === c ? "selected" : ""}>${esc(c)}</option>`).join("")}
        </select>
        <select id="fsort">
          <option value="pop">Танымал бойынша</option>
          <option value="cheap">Алдымен арзаны</option>
          <option value="rich">Алдымен қымбаты</option>
          <option value="rate">Рейтинг бойынша</option>
        </select>
        <label class="range">Баға: <b id="fpriceVal">${money(maxPrice)}</b> дейін
          <input type="range" id="fprice" min="0" max="${maxPrice}" step="50" value="${maxPrice}">
        </label>
        <button class="btn btn--ghost filters__reset" id="freset">Тазалау</button>
      </div>

      <div class="note" id="storeNote" hidden></div>
      <div class="grid" id="storeGrid"></div>
    </div>
  `);

  const apply = () => {
    const q       = $("#fq").value.trim();   // Search өзі әріп регистрін реттейді
    const genre   = $("#fgenre").value;
    const country = $("#fcountry").value;
    const limit   = +$("#fprice").value;
    const sort    = $("#fsort").value;
    $("#fpriceVal").textContent = money(limit);

    // Алдымен мәтін бойынша, сосын сүзгілер
    const byText = q ? Search.run(all, q) : all;
    let list = byText.filter(d =>
      (!genre || d.genres.includes(genre)) &&
      (!country || d.country === country) &&
      d.price <= limit
    );

    const sorters = {
      cheap: (a, b) => a.price - b.price,
      rich:  (a, b) => b.price - a.price,
      rate:  (a, b) => b.rating - a.rating,
      pop:   (a, b) => (b.popular === true) - (a.popular === true) || b.rating - a.rating
    };
    // Іздеу кезінде "танымал" емес, сәйкестік реті сақталады
    if (!q || sort !== "pop") list.sort(sorters[sort]);

    if (list.length) {
      $("#storeGrid").innerHTML = list.map(cardHTML).join("");
      $("#storeNote").hidden = true;
      return;
    }

    // Ештеңе табылмады. Атына жақындарын ұсынамыз.
    const near = q ? Search.similar(all, q, 6) : [];

    if (near.length) {
      $("#storeNote").hidden = false;
      $("#storeNote").innerHTML = `
        <b>«${esc(q)}» табылмады.</b>
        <span>Каталогта мұндай дорама жоқ. Атауы ұқсастары мыналар:</span>`;
      $("#storeGrid").innerHTML = near.map(cardHTML).join("");
    } else {
      $("#storeNote").hidden = true;
      $("#storeGrid").innerHTML = emptyHTML("Ештеңе табылмады", "Сүзгіні өзгертіп көріңіз.",
        { href: "#/store", label: "Сүзгіні тазалау" });
    }
  };

  $("#filters").addEventListener("input", apply);
  $("#freset").addEventListener("click", () => {
    $("#fq").value = ""; $("#fgenre").value = ""; $("#fcountry").value = "";
    $("#fsort").value = "pop"; $("#fprice").value = maxPrice;
    apply();
  });

  apply();
}

/* ---- 2.4 Дорама беті ---- */
async function viewDrama(id) {
  const d = await DB.drama(id);
  if (!d) return render(`<div class="page">${emptyHTML("Дорама табылмады", "Мүмкін ол жойылған.", { href: "#/store", label: "Дүкенге" })}</div>`);

  DB.trackView(d.id);                        // қаралым статистикасы үшін
  const owned = Auth.user?.purchases?.includes(d.id);
  const all = await DB.dramas();
  const similar = all.filter(x => x.id !== d.id && x.genres.some(g => d.genres.includes(g))).slice(0, 6);

  render(`
    <article class="detail">
      <div class="detail__bg"><img src="${esc(Img.url(d.poster))}" alt=""></div>

      <div class="detail__grid">
        <div class="detail__poster"><img src="${esc(Img.url(d.poster))}" alt="${esc(d.title)} постері"></div>

        <div>
          <h1>${esc(d.title)}</h1>
          ${d.titleOriginal ? `<p class="detail__orig">${esc(d.titleOriginal)} · ${d.year}</p>` : ""}

          <div class="detail__pills">
            ${d.genres.map(g => `<span class="pill">${esc(g)}</span>`).join("")}
            <span class="pill pill--accent">${esc(d.country)}</span>
          </div>

          <div class="detail__stats">
            <div><small>Рейтинг</small><b>★ ${d.rating.toFixed(1)}</b></div>
            <div><small>Серия саны</small><b>${d.episodes}</b></div>
            <div><small>Шыққан жылы</small><b>${d.year}</b></div>
            <div><small>Ел</small><b>${esc(d.country)}</b></div>
          </div>

          <p class="detail__desc">${esc(d.description)}</p>

          ${d.images.length ? `
            <h3 style="font-size:16px;margin-top:30px">Кадрлар</h3>
            <div class="gallery" id="gallery">
              ${d.images.map((src, i) => `
                <button data-shot="${i}" aria-label="${i + 1}-суретті үлкейту">
                  <img src="${esc(Img.url(src))}" alt="${esc(d.title)} кадры" loading="lazy">
                </button>`).join("")}
            </div>` : ""}

          <div class="buybar">
            ${d.trailer ? `
              <button class="btn btn--light" id="playTrailer">
                <svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:currentColor;stroke:none"><path d="M8 5.5v13l11-6.5z"/></svg>
                Үзіндіні көру
              </button>` : ""}
            <span class="buybar__price">${money(d.price)}</span>
            ${owned
              ? `<a class="btn btn--light" href="#/profile">Сатып алынған — профильде</a>`
              : `<button class="btn btn--primary" data-add="${d.id}">Себетке қосу</button>
                 <button class="btn btn--wa" data-buy="${d.id}">WhatsApp арқылы алу</button>`}
          </div>
        </div>
      </div>

      ${similar.length ? `
      <section class="section">
        <div class="section__head"><h2>Ұқсас дорамалар</h2></div>
        ${railHTML("sim", similar)}
      </section>` : ""}
    </article>
  `);

  if (d.images.length) openGalleryOn($("#gallery"), d.images);

  const play = $("#playTrailer");
  if (play) play.addEventListener("click", () => showTrailer(d));
}

/** Трейлерді терезеде ойнату */
function showTrailer(d) {
  const t = parseTrailer(d.trailer);
  if (!t) return;
  if (t.kind === "link") return window.open(t.src, "_blank", "noopener");

  const box = document.createElement("div");
  box.className = "lightbox";
  box.innerHTML = `
    <button class="lightbox__x" data-x aria-label="Жабу">&times;</button>
    <div class="player ${t.kind === "tiktok" ? "player--tall" : ""}">
      ${{
        youtube: `<iframe src="https://www.youtube-nocookie.com/embed/${esc(t.id)}?autoplay=1&rel=0"
                    title="${esc(d.title)} үзіндісі" allow="autoplay; encrypted-media; fullscreen"
                    allowfullscreen frameborder="0"></iframe>`,

        tiktok: `<iframe src="https://www.tiktok.com/embed/v2/${esc(t.id)}"
                    title="${esc(d.title)} үзіндісі" allow="encrypted-media; fullscreen"
                    allowfullscreen frameborder="0"></iframe>`,

        file: `<video src="${esc(t.src || "")}" controls autoplay playsinline
                   controlsList="nodownload" oncontextmenu="return false"></video>`
      }[t.kind]}
      <p class="player__cap">${esc(d.title)} · үзінді</p>
    </div>`;

  document.body.appendChild(box);
  document.body.classList.add("no-scroll");

  const close = () => {
    box.remove();
    document.body.classList.remove("no-scroll");
    removeEventListener("keydown", esc2);
  };
  const esc2 = e => { if (e.key === "Escape") close(); };
  addEventListener("keydown", esc2);
  box.addEventListener("click", e => {
    if (e.target.closest("[data-x]") || e.target === box) close();
  });
}

/** Суретті үлкейтіп көрсету (← → және Esc жұмыс істейді) */
function openGalleryOn(root, images) {
  root.addEventListener("click", e => {
    const b = e.target.closest("[data-shot]");
    if (b) showShot(+b.dataset.shot);
  });

  function showShot(i) {
    const box = document.createElement("div");
    box.className = "lightbox";
    box.innerHTML = `
      <button class="lightbox__x" data-x aria-label="Жабу">&times;</button>
      ${images.length > 1 ? `
        <button class="lightbox__nav lightbox__nav--l" data-step="-1" aria-label="Алдыңғы"><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button>
        <button class="lightbox__nav lightbox__nav--r" data-step="1" aria-label="Келесі"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button>` : ""}
      <img src="${esc(Img.url(images[i]))}" alt="Кадр">`;
    document.body.appendChild(box);
    document.body.classList.add("no-scroll");

    const close = () => { box.remove(); document.body.classList.remove("no-scroll"); removeEventListener("keydown", keys); };
    const step = n => { i = (i + n + images.length) % images.length; box.querySelector("img").src = Img.url(images[i]); };

    box.addEventListener("click", e => {
      const nav = e.target.closest("[data-step]");
      if (nav) return step(+nav.dataset.step);
      if (e.target.closest("[data-x]") || e.target === box) close();
    });

    const keys = e => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    };
    addEventListener("keydown", keys);
  }
}

/* ---- 2.5 Себет ---- */
function viewCart() {
  const items = Cart.items;

  render(`
    <div class="page">
      <h1 class="page__title">Себет</h1>
      <p class="page__lead">${items.length ? items.length + " дорама таңдалды" : "Себет әзірге бос"}</p>

      ${items.length ? `
      <div class="cart">
        <div id="cartList">
          ${items.map(i => `
            <div class="cart__item">
              <img src="${esc(Img.url(i.poster))}" alt="">
              <div>
                <h4>${esc(i.title)}</h4>
                <div class="muted" style="font-size:13px">Бір реттік сатып алу · мәңгілік қолжетімді</div>
              </div>
              <div style="display:flex;align-items:center;gap:10px">
                <b style="color:var(--purple)">${money(i.price)}</b>
                <button class="cart__x" data-del="${i.id}" aria-label="Өшіру">
                  <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
                </button>
              </div>
            </div>`).join("")}
        </div>

        <aside class="summary">
          <h3>Тапсырыс</h3>
          <div class="summary__row"><span>Дорама саны</span><span>${items.length}</span></div>
          <div class="summary__row"><span>Жеткізу</span><span>Тегін (сілтеме)</span></div>
          <div class="summary__row summary__row--total"><span>Барлығы</span><b>${money(Cart.total())}</b></div>
          <button class="btn btn--wa btn--full" id="toCheckout" style="margin-top:16px">WhatsApp арқылы тапсырыс беру</button>
          <button class="btn btn--ghost btn--full" id="clearCart" style="margin-top:10px">Себетті тазалау</button>
        </aside>
      </div>` : emptyHTML("Себет бос", "Дүкеннен ұнағанын таңдап, себетке қос.", { href: "#/store", label: "Дүкенге өту" })}
    </div>
  `);

  const checkout = $("#toCheckout");
  if (checkout) checkout.addEventListener("click", () => go("/checkout"));

  const clear = $("#clearCart");
  if (clear) clear.addEventListener("click", () => { Cart.clear(); toast("Себет тазаланды"); viewCart(); });
}

/* ---- 2.6 WhatsApp арқылы тапсырыс ---- */

/** Тапсырыс мәтінін құрастыру — WhatsApp-қа осы кетеді */
function orderText(items, orderId) {
  const lines = items.map((i, n) => `${n + 1}. ${i.title} — ${money(i.price)}`);
  const total = items.reduce((s, i) => s + i.price, 0);

  return [
    `Сәлем! ${SHOP.name} сайтынан тапсырыс бергім келеді.`,
    "",
    ...lines,
    "",
    `Барлығы: ${money(total)}`,
    `Тапсырыс №: ${orderId}`
  ].join("\n");
}

/** WhatsApp-ты ашу */
function openWhatsApp(items, orderId) {
  const url = `https://wa.me/${SHOP.whatsapp}?text=${encodeURIComponent(orderText(items, orderId))}`;
  window.open(url, "_blank", "noopener");
}

/** Тапсырысты тіркеп, WhatsApp-қа жіберу.
 *  Кіру міндетті емес — қонақ та тапсырыс бере алады. */
async function sendOrder(items) {
  if (!items.length) return;

  const order = await DB.createOrder({
    userId:    Auth.user?.id    || null,
    userName:  Auth.user?.name  || "Қонақ",
    userEmail: Auth.user?.email || "",
    method: "WhatsApp",
    items: items.map(i => ({ id: i.id, title: i.title, price: i.price, poster: i.poster })),
    total: items.reduce((s, i) => s + i.price, 0)
  });

  openWhatsApp(items, order.id);
  return order;
}

function viewCheckout() {
  if (!Cart.items.length) return go("/cart");

  const items = Cart.items;
  const total = Cart.total();

  render(`
    <div class="page">
      <h1 class="page__title">Тапсырыс беру</h1>
      <p class="page__lead">Түймені бассаңыз, WhatsApp ашылады да, тапсырыс мәтіні дайын тұрады. Жіберіңіз — біз бағасын айтып, сілтемені саламыз.</p>

      <div class="pay">
        <div>
          <div class="wabox">
            <div class="wabox__ic">
              <svg viewBox="0 0 24 24"><path d="M20 11.5a8 8 0 01-11.9 7L4 20l1.6-4A8 8 0 1120 11.5z"/></svg>
            </div>
            <h3>WhatsApp арқылы</h3>
            <p class="muted">Тапсырыс осы нөмірге барады:<br><b style="color:var(--text)">${esc(SHOP.whatsappShow)}</b></p>

            <div class="preview">
              <small>WhatsApp-қа кететін мәтін:</small>
              <pre id="waPreview">${esc(orderText(items, "…"))}</pre>
            </div>
          </div>
        </div>

        <aside class="summary">
          <h3>Тапсырыс құрамы</h3>
          ${items.map(i => `<div class="summary__row"><span>${esc(i.title)}</span><span>${money(i.price)}</span></div>`).join("")}
          <div class="summary__row summary__row--total"><span>Барлығы</span><b>${money(total)}</b></div>

          <button class="btn btn--wa btn--full" id="waBtn" style="margin-top:16px">
            <svg viewBox="0 0 24 24" style="width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M20 11.5a8 8 0 01-11.9 7L4 20l1.6-4A8 8 0 1120 11.5z"/></svg>
            WhatsApp-қа жіберу
          </button>

          <p class="muted" style="font-size:12px;margin:12px 0 0">
            ${Auth.user
              ? "Төлем расталған соң дорамалар профиліңізге қосылады."
              : "Кірмей-ақ тапсырыс бере аласыз. Аккаунт ашсаңыз, сатып алғандарыңыз профильде сақталады."}
          </p>
        </aside>
      </div>
    </div>
  `);

  $("#waBtn").addEventListener("click", async e => {
    e.target.disabled = true;
    const order = await sendOrder(items);
    Cart.clear();
    go("/success/" + order.id);
  });
}

/* ---- 2.7 Тапсырыс жіберілді ---- */
async function viewSuccess(orderId) {
  const list = await DB.orders(Auth.user?.id);
  const order = list.find(o => o.id === orderId);

  render(`
    <div class="page">
      <div class="success">
        <div class="success__ring"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7"/></svg></div>
        <h1 style="font-size:24px;margin-bottom:10px">Тапсырыс қабылданды</h1>
        <p class="muted">WhatsApp ашылды ма? Дайын мәтінді жіберіңіз — біз бірден жауап береміз.<br>
        Төлем расталған соң дорамалар профиліңізге қосылады.</p>

        ${order ? `<p class="pill pill--accent" style="margin-top:18px">Тапсырыс № ${esc(order.id)} · ${money(order.total)}</p>` : ""}

        ${SHOP.telegram ? `<p class="muted" style="margin-top:18px;font-size:14px">
          Жаңалықтарды өткізіп алма — <a href="${esc(SHOP.telegram)}" target="_blank" rel="noopener"
          style="color:var(--purple);font-weight:700">Telegram арнамызға жазыл</a>.
        </p>` : ""}
        <div style="display:flex;gap:10px;justify-content:center;margin-top:24px;flex-wrap:wrap">
          ${order ? `<button class="btn btn--wa" id="reopenWa">WhatsApp қайта ашу</button>` : ""}
          <a class="btn btn--ghost" href="#/store">Тағы таңдау</a>
          <a class="btn btn--ghost" href="#/profile">Профиль</a>
        </div>
      </div>
    </div>
  `);

  const again = $("#reopenWa");
  if (again) again.addEventListener("click", () => openWhatsApp(order.items, order.id));
}

/* ---- 2.8 Профиль ---- */
async function viewProfile() {
  if (!Auth.user) {
    render(`<div class="page">${emptyHTML("Аккаунтқа кіріңіз", "Сатып алған дорамаларыңыз бен тапсырыстарыңыз осында сақталады.")}
      <div style="text-align:center;margin-top:-40px"><button class="btn btn--primary" id="openAuth">Кіру / Тіркелу</button></div></div>`);
    $("#openAuth").addEventListener("click", () => Modal.open($("#authModal")));
    return;
  }

  const u = Auth.user;
  const [all, orders] = await Promise.all([DB.dramas(), DB.orders(u.id)]);
  const owned = all.filter(d => (u.purchases || []).includes(d.id));
  const waiting = orders.filter(o => o.status === "Күтілуде").length;

  render(`
    <div class="page">
      <div class="phead">
        <div class="avatar">${esc((u.name || "?")[0].toUpperCase())}</div>
        <div>
          <h1 class="page__title" style="margin:0">${esc(u.name)}</h1>
          <p class="muted" style="margin:4px 0 0">${esc(u.email)}</p>
        </div>
        <button class="btn btn--ghost" id="logoutBtn" style="margin-left:auto">Шығу</button>
      </div>

      <div class="tabs" id="pTabs">
        <button class="tab is-active" data-p="lib">Кітапханам (${owned.length})</button>
        <button class="tab" data-p="ord">Тапсырыс тарихы (${orders.length})</button>
        <button class="tab" data-p="set">Баптаулар</button>
      </div>

      <div id="pBody"></div>
    </div>
  `);

  const panes = {
    lib: () => `
      ${waiting ? `<div class="note"><b>${waiting} тапсырыс күтілуде</b>
        <span>Төлем расталған соң дорамалар осында пайда болады.</span></div>` : ""}
      ${owned.length
        ? `<div class="grid">${owned.map(cardHTML).join("")}</div>`
        : emptyHTML("Кітапхана бос", "Төлемі расталған дорамалар осында тұрады.", { href: "#/store", label: "Дүкенге өту" })}`,

    ord: () => orders.length
      ? `<div class="orders">${orders.map(o => `
          <div class="order">
            <div class="order__top">
              <span class="order__id">№ ${esc(o.id)}</span>
              <span class="status status--${o.status === "Төленді" ? "ok" : o.status === "Күтілуде" ? "wait" : "no"}">${esc(o.status)}</span>
            </div>
            <div class="order__items">${o.items.map(i => esc(i.title)).join(" · ")}</div>
            <div class="summary__row" style="padding-bottom:0">
              <span>${dateKz(o.createdAt)} · ${esc(o.method)}</span>
              <b style="color:var(--purple)">${money(o.total)}</b>
            </div>
          </div>`).join("")}</div>`
      : emptyHTML("Тапсырыс жоқ", "Алғашқы тапсырысыңызды дүкеннен бастаңыз.", { href: "#/store", label: "Дүкенге өту" }),

    set: () => `
      <form class="adminform form" id="setForm" style="max-width:460px">
        <label>Аты-жөні<input name="name" value="${esc(u.name)}" required></label>
        <label>Email<input value="${esc(u.email)}" disabled></label>
        <button class="btn btn--primary" type="submit">Сақтау</button>
      </form>`
  };

  const show = key => {
    $("#pBody").innerHTML = panes[key]();
    const f = $("#setForm");
    if (f) f.addEventListener("submit", async e => {
      e.preventDefault();
      await Auth.updateProfile({ name: f.elements.name.value.trim() });
      toast("Сақталды");
      viewProfile();
    });
  };
  show("lib");

  $("#pTabs").addEventListener("click", e => {
    const b = e.target.closest("[data-p]");
    if (!b) return;
    $$("#pTabs .tab").forEach(t => t.classList.toggle("is-active", t === b));
    show(b.dataset.p);
  });

  $("#logoutBtn").addEventListener("click", async () => {
    await Auth.logout();
    toast("Шықтыңыз");
    go("/");
  });
}

/* ── 4. Оқиғалар ─────────────────────────────── */

/* Маршрутизатор */
async function route() {
  const { path, query } = parseRoute();
  const [, root, param] = path.split("/");
  markNav(path);
  clearInterval(heroTimer);

  try {
  switch (root) {
    case "":         await viewHome(); break;
    case "ai":       viewAI(); break;
    case "store":    await viewStore(query); break;
    case "drama":    await viewDrama(param); break;
    case "cart":     viewCart(); break;
    case "checkout": viewCheckout(); break;
    case "success":  await viewSuccess(param); break;
    case "profile":  await viewProfile(); break;
    default:         render(`<div class="page">${emptyHTML("Бет табылмады", "Мұндай сілтеме жоқ.", { href: "#/", label: "Басты бетке" })}</div>`);
  }
  } catch (err) {
    // Бет ешқашан бос қалмауы керек — қатені көрсетіп қоямыз
    console.error("Бет ашылмады:", err);
    render(`<div class="page">${emptyHTML(
      "Бет ашылмады",
      (err.code || err.message || "Белгісіз қате") + " — F12 → Console-дан толығырақ көріңіз.",
      { href: "#/", label: "Басты бетке" })}</div>`);
  }
}

/* Себетке қосу — барлық беттерде бір жерден */
document.addEventListener("click", async e => {
  const add = e.target.closest("[data-add]");
  const buy = e.target.closest("[data-buy]");
  const del = e.target.closest("[data-del]");

  if (add) {
    e.preventDefault();
    const d = await DB.drama(add.dataset.add);
    toast(Cart.add(d) ? `«${d.title}» себетке қосылды` : "Бұл дорама себетте бар");
  }

  if (buy) {
    e.preventDefault();
    buy.disabled = true;
    const d = await DB.drama(buy.dataset.buy);
    const order = await sendOrder([d]);      // себетке қоспай-ақ бірден
    go("/success/" + order.id);
  }

  if (del) {
    Cart.remove(del.dataset.del);
    toast("Себеттен алынды");
    viewCart();
  }
});

/* Рельс көрсеткіштері */
document.addEventListener("click", e => {
  const arrow = e.target.closest("[data-scroll]");
  if (!arrow) return;
  const track = arrow.closest(".rail").querySelector(".rail__track");
  track.scrollBy({ left: +arrow.dataset.scroll * track.clientWidth * 0.8, behavior: "smooth" });
});

/* ── Іздеу және жазып жатқанда шығатын тізім ── */
const acBox = $("#acList");
const acInput = $("#searchInput");
let acItems = [], acPos = -1;

const acClose = () => {
  acBox.hidden = true; acItems = []; acPos = -1;
  acInput.setAttribute("aria-expanded", "false");
};

const acOpen = async () => {
  const q = acInput.value.trim();
  if (q.length < 2) return acClose();

  const all = await DB.dramas();
  let found = Search.run(all, q).slice(0, 6);
  let note = "";

  // Дәл сол атау жоқ болса — ұқсастарын көрсетеміз
  if (!found.length) {
    found = Search.similar(all, q, 5);
    note = `«${esc(q)}» табылмады — мүмкін мынаның бірі?`;
  }
  if (!found.length) return acClose();

  acItems = found;
  acPos = -1;
  acBox.hidden = false;
  acInput.setAttribute("aria-expanded", "true");
  acBox.innerHTML = `
    ${note ? `<div class="ac__head">${note}</div>` : ""}
    ${found.map((d, i) => `
      <div class="ac__item" role="option" data-i="${i}">
        <img src="${esc(Img.url(d.poster))}" alt="">
        <span class="ac__txt">
          <b>${esc(d.title)}</b>
          <span>★ ${d.rating.toFixed(1)} · ${esc(d.genres[0] || d.country)} · ${d.episodes} серия</span>
        </span>
        <span class="ac__price">${money(d.price)}</span>
      </div>`).join("")}
    <div class="ac__all" data-all>Барлық нәтижені көру →</div>`;
};

const acGo = i => {
  const picked = acItems[i];        // acClose() тізімді тазалайды — алдымен алып қоямыз
  if (!picked) return;
  acClose();
  acInput.value = "";
  go("/drama/" + picked.id);
};

acInput.addEventListener("input", acOpen);
acInput.addEventListener("focus", acOpen);

acBox.addEventListener("mousedown", e => {      // blur-дан бұрын жұмыс істеуі керек
  e.preventDefault();
  if (e.target.closest("[data-all]")) {
    const q = acInput.value.trim();
    acClose(); acInput.blur();
    return go("/store" + (q ? "?q=" + encodeURIComponent(q) : ""));
  }
  const item = e.target.closest("[data-i]");
  if (item) acGo(+item.dataset.i);
});

acInput.addEventListener("keydown", e => {
  if (acBox.hidden) return;
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    acPos = (acPos + (e.key === "ArrowDown" ? 1 : -1) + acItems.length) % acItems.length;
    $$("#acList .ac__item").forEach(el => el.classList.toggle("is-on", +el.dataset.i === acPos));
  }
  if (e.key === "Enter" && acPos >= 0) { e.preventDefault(); acGo(acPos); }
  if (e.key === "Escape") acClose();
});

document.addEventListener("click", e => {
  if (!e.target.closest("#searchForm")) acClose();
});

$("#searchForm").addEventListener("submit", e => {
  e.preventDefault();
  const q = acInput.value.trim();
  acClose();
  go("/store" + (q ? "?q=" + encodeURIComponent(q) : ""));
  acInput.blur();
});

/* Тақырып (қараңғы / жарық) */
$("#themeBtn").addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  LS.set("theme", next);
});

/* Мобиль мәзірі */
$("#burger").addEventListener("click", () => $("#nav").classList.toggle("is-open"));
$("#nav").addEventListener("click", () => $("#nav").classList.remove("is-open"));

/* Панельдің көлеңкесі */
addEventListener("scroll", () => {
  $("#topbar").classList.toggle("is-stuck", scrollY > 20);
}, { passive: true });

/* Аккаунт терезесі */
const authModal = $("#authModal");
$("#authBtn").addEventListener("click", () => {
  if (Auth.user) go("/profile"); else Modal.open(authModal);
});
authModal.addEventListener("click", e => { if (e.target.dataset.close !== undefined) Modal.close(authModal); });
addEventListener("keydown", e => { if (e.key === "Escape") Modal.close(authModal); });

$("#authTabs").addEventListener("click", e => {
  const b = e.target.closest("[data-tab]");
  if (!b) return;
  $$("#authTabs .tab").forEach(t => t.classList.toggle("is-active", t === b));
  $("#loginForm").hidden  = b.dataset.tab !== "login";
  $("#signupForm").hidden = b.dataset.tab !== "signup";
});

$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const err = $("#loginErr"); err.hidden = true;
  try {
    const el = e.target.elements;
    await Auth.login(el.email.value.trim(), el.password.value);
    Modal.close(authModal); e.target.reset();
    toast("Қош келдіңіз!");
    route();
  } catch (ex) { err.textContent = friendlyError(ex); err.hidden = false; }
});

$("#signupForm").addEventListener("submit", async e => {
  e.preventDefault();
  const err = $("#signupErr"); err.hidden = true;
  try {
    const el = e.target.elements;
    await Auth.signup(el.name.value.trim(), el.email.value.trim(), el.password.value);
    Modal.close(authModal); e.target.reset();
    toast(`Қош келдің, ${Auth.user.name}!`);
    go("/profile");
    route();
  } catch (ex) { err.textContent = friendlyError(ex); err.hidden = false; }
});

/** Firebase қателерін қазақшалау */
function friendlyError(ex) {
  const map = {
    "auth/invalid-credential": "Email не құпиясөз қате",
    "auth/wrong-password":     "Құпиясөз қате",
    "auth/user-not-found":     "Мұндай пайдаланушы жоқ",
    "auth/email-already-in-use": "Бұл email тіркелген",
    "auth/weak-password":      "Құпиясөз тым қысқа (кемінде 6 таңба)",
    "auth/invalid-email":      "Email дұрыс жазылмаған",
    "auth/network-request-failed": "Интернет байланысы жоқ",
    "auth/operation-not-allowed": "Firebase-те Email/Password әдісі қосылмаған",
    "permission-denied":       "Firestore ережелері рұқсат бермеді"
  };
  return map[ex?.code] || ex?.message || "Қате шықты, қайталап көріңіз";
}

/* ── 5. Іске қосу ────────────────────────────── */

/** Экран бос қалмасын: не болғанын жазып көрсетеміз */
function bootError(reason) {
  const splash = document.getElementById("splash");
  if (splash) splash.classList.add("is-done");
  document.getElementById("app").innerHTML = `
    <div class="page">
      <div class="empty">
        <h3>Сайт жүктелмеді</h3>
        <p class="muted" style="max-width:44ch;margin-inline:auto">${esc(reason)}</p>
        <p class="muted" style="font-size:13px;margin-top:14px">
          Беттi жаңартып көріңіз. Қайталанса — файлдардың бәрі серверде тұрғанын тексеріңіз.
        </p>
      </div>
    </div>`;
}

/** Барлық скрипт жүктелген бе? */
function missingParts() {
  const need = {
    "config.js": typeof SHOP,
    "store.js":  typeof DB,
    "search.js": typeof Search,
    "ai.js":     typeof AI,
    "ui.js":     typeof esc
  };
  return Object.keys(need).filter(k => need[k] === "undefined");
}

(async function init() {
  const missing = missingParts();
  if (missing.length) return bootError("Мына файл(дар) жүктелмеді: " + missing.join(", "));

  document.documentElement.dataset.theme = LS.get("theme", "dark");
  $("#year").textContent = new Date().getFullYear();
  $("#waFooter").href = "https://wa.me/" + SHOP.whatsapp;   // нөмір тек config.js-те тұрады

  Cart.onChange(items => {
    const badge = $("#cartCount");
    badge.textContent = items.length;
    badge.hidden = !items.length;
  });

  Auth.onChange(user => {
    $("#authBtn").textContent = user ? (user.name || "Профиль").split(" ")[0] : "Кіру";
    $(".nav__admin").hidden = !Auth.isAdmin();  // admin.html-ге сілтейді
  });

  DB.onChange(() => {});           // кэшті тазарту үшін

  try {
    await Img.init();              // суреттер қоймасын ашу
    await Auth.init();
    await route();
  } catch (err) {
    console.error("Іске қосу қатесі:", err);
    return bootError(err.message || String(err));
  }

  addEventListener("hashchange", route);
  setTimeout(() => $("#splash").classList.add("is-done"), 450);
})();

/* Бәрібір бір нәрсе тұрып қалса — 8 секундтан кейін экранды босатамыз */
setTimeout(() => {
  const splash = document.getElementById("splash");
  if (splash && !splash.classList.contains("is-done"))
    bootError("Жүктелу тым ұзаққа созылды. Байланысты тексеріңіз.");
}, 8000);
