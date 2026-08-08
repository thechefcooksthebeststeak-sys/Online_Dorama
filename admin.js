/* ═══════════════════════════════════════════════
   admin.js — тек admin.html бетінде жүктеледі.
   Дүкеннің негізгі коды бұл файлды мүлдем білмейді.
   ═══════════════════════════════════════════════ */

const APP = $("#app");
let adminTab = "dramas";   // қай қосымша ашық тұрғанын есте сақтаймыз

const render = html => { APP.innerHTML = html; };

async function viewAdmin() {
  if (!Auth.isAdmin()) {
    return render(`<div class="page">${emptyHTML("Тек әкімшіге", "Бұл бетке кіру құқығыңыз жоқ.", { href: "#/", label: "Басты бетке" })}</div>`);
  }

  const [dramas, orders, users, views] = await Promise.all([
    DB.dramas(), DB.orders(), DB.users(), DB.views()
  ]);

  const paid     = orders.filter(o => o.status === "Төленді");
  const pending  = orders.filter(o => o.status === "Күтілуде");
  const revenue  = paid.reduce((s, o) => s + o.total, 0);
  const sold     = paid.reduce((s, o) => s + o.items.length, 0);     // сатылған дорама саны
  const avgCheck = paid.length ? Math.round(revenue / paid.length) : 0;

  // Ең көп қаралған
  const topViewed = dramas
    .map(d => ({ d, n: views[d.id] || 0 }))
    .sort((a, b) => b.n - a.n)[0];

  // Ең көп сатылған
  const soldCount = {};
  paid.forEach(o => o.items.forEach(i => soldCount[i.id] = (soldCount[i.id] || 0) + 1));
  const topSold = dramas
    .map(d => ({ d, n: soldCount[d.id] || 0 }))
    .sort((a, b) => b.n - a.n)[0];

  render(`
    <div class="page">
      <h1 class="page__title">Админ панелі</h1>
      <p class="page__lead">Дорамаларды, тапсырыстарды және пайдаланушыларды басқару.</p>

      <div class="admin__stats">
        <div class="stat stat--big"><b>${users.length}</b><small>Қолданушы</small></div>
        <div class="stat stat--big"><b>${sold}</b><small>Сатып алу</small></div>
        <div class="stat stat--big"><b>${money(revenue)}</b><small>Жалпы табыс</small></div>
        <div class="stat"><b>${money(avgCheck)}</b><small>Орташа чек</small></div>
        <div class="stat"><b>${dramas.length}</b><small>Дорама</small></div>
        <div class="stat ${pending.length ? "stat--warn" : ""}"><b>${pending.length}</b><small>Күтілуде</small></div>
        <div class="stat"><b id="useVal">…</b><small>Суреттер орны</small></div>
      </div>

      <div class="tops">
        <div class="top">
          <small>Ең көп қаралған</small>
          ${topViewed && topViewed.n
            ? `<a href="index.html#/drama/${topViewed.d.id}" class="top__row">
                 <img src="${esc(Img.url(topViewed.d.poster))}" alt="">
                 <span><b>${esc(topViewed.d.title)}</b><i>${topViewed.n} рет ашылған</i></span>
               </a>`
            : `<p class="muted" style="margin:8px 0 0;font-size:14px">Әзірге қаралым жоқ</p>`}
        </div>

        <div class="top">
          <small>Ең көп сатылған</small>
          ${topSold && topSold.n
            ? `<a href="index.html#/drama/${topSold.d.id}" class="top__row">
                 <img src="${esc(Img.url(topSold.d.poster))}" alt="">
                 <span><b>${esc(topSold.d.title)}</b><i>${topSold.n} рет сатылған · ${money(topSold.n * topSold.d.price)}</i></span>
               </a>`
            : `<p class="muted" style="margin:8px 0 0;font-size:14px">Әзірге сатылым жоқ</p>`}
        </div>
      </div>

      <div class="tabs" id="aTabs">
        <button class="tab is-active" data-a="dramas">Дорамалар</button>
        <button class="tab" data-a="orders">Тапсырыстар</button>
        <button class="tab" data-a="users">Пайдаланушылар</button>
        ${DB.mode === "demo" ? `<button class="tab" data-a="publish">Жариялау</button>` : ""}
      </div>

      <div id="aBody"></div>
    </div>
  `);

  // Суреттер қанша орын алғанын көрсету
  Img.usage().then(u => {
    const el = $("#useVal");
    if (!el) return;
    el.textContent = u
      ? (u.used / 1048576).toFixed(1) + " МБ"
      : (Img.available ? "IndexedDB" : "шектеулі");
    el.title = u && u.quota ? "Рұқсат: " + (u.quota / 1048576).toFixed(0) + " МБ" : "";
  });

  const panes = {
    /* --- Дорамалар --- */
    dramas: () => `
      <form class="adminform form" id="dForm">
        <h3 style="font-size:16px;margin-bottom:16px" id="dFormTitle">Жаңа дорама қосу</h3>
        <input type="hidden" name="docId">
        <div class="grid2">
          <label>Атауы<input name="title" required placeholder="Гоблин"></label>
          <label>Түпнұсқа атауы<input name="titleOriginal" placeholder="도깨비"></label>
          <label>Ел
            <select name="country">${COUNTRIES.map(c => `<option>${esc(c)}</option>`).join("")}</select>
          </label>
          <label>Жанры (үтірмен)<input name="genres" placeholder="Романтика, Драма"></label>
          <label>Басқа атаулары (үтірмен)<input name="alt" placeholder="Goblin, Токкэби"></label>
          <label>Көңіл-күйі (үтірмен)<input name="mood" placeholder="жылы, бақытты соңы"></label>
          <label>Жылы<input name="year" type="number" min="1990" max="2030" value="2025"></label>
          <label>Рейтинг<input name="rating" type="number" step="0.1" min="0" max="10" value="8.5"></label>
          <label>Серия саны<input name="episodes" type="number" min="1" value="16"></label>
          <label>Бағасы (₸)<input name="price" type="number" min="0" step="50" value="900" required></label>
        </div>
        <p class="muted" style="font-size:12px;margin:2px 0 12px">
          Көңіл-күй сөздері DORAMA AI үшін керек. Мүмкін мәндер: ${MOODS.join(" · ")}<br>
          Үзінді: YouTube не TikTok сілтемесін қойсаң, орын алмайды — ең тиімдісі сол.
          Өз видеоңды жүктесең, ол GitHub-қа тікелей барады (токен қажет), 10 МБ-қа дейін.
          TikTok-та толық сілтемені ал (tiktok.com/@аты/video/…), қысқа vm.tiktok.com жарамайды.
        </p>
        <label>Сипаттамасы<textarea name="description" rows="3" placeholder="Қысқаша мазмұны…"></textarea></label>
        <div class="grid2">
          <label>Үзінді / трейлер<input name="trailer" placeholder="YouTube, TikTok немесе .mp4 сілтемесі"></label>
          <label>Немесе видео жүктеу<input type="file" id="dVideo" accept="video/*"></label>
          <label>Постер сілтемесі<input name="poster" placeholder="https://… (бос қалдырсаң автоматты жасалады)"></label>
          <label>Немесе телефоннан жүктеу<input type="file" id="dFile" accept="image/*"></label>
        </div>
        <div id="dVideoLog" class="publog" hidden style="margin-top:10px"></div>
        <img class="posterprev" id="dPrev" hidden alt="Постер алдын ала көрінісі">

        <label style="margin-top:16px">Кадрлар (бірнешеуін бірден таңдауға болады)
          <input type="file" id="dShots" accept="image/*" multiple>
        </label>
        <div class="shots" id="dShotsPrev"></div>
        <div class="grid2" style="margin-top:14px">
          <label style="display:flex;gap:8px;align-items:center;margin:0">
            <input type="checkbox" name="popular" style="width:auto;margin:0"> Танымал деп белгілеу
          </label>
          <label style="display:flex;gap:8px;align-items:center;margin:0">
            <input type="checkbox" name="isNew" style="width:auto;margin:0"> Жаңа деп белгілеу
          </label>
        </div>
        <div style="display:flex;gap:10px;margin-top:18px;flex-wrap:wrap">
          <button class="btn btn--primary" type="submit" id="dSave">Қосу</button>
          <button class="btn btn--ghost" type="button" id="dCancel" hidden>Болдырмау</button>
        </div>
      </form>

      ${DB.mode === "demo" ? `
        <div class="note" style="margin-bottom:20px">
          <b>Демо режим — өзгерістер тек осы браузерде</b>
          <span>Дүкен сайтына шығару үшін «Жариялау» бөліміне өт — бір батырмамен GitHub-қа жіберіледі.</span>
          <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap">
            <button class="btn btn--primary" id="goPublish">Жариялау</button>
            <button class="btn btn--ghost" id="exportBtn">Кодын көру</button>
          </div>
        </div>` : ""}

      <div class="tablewrap">
        <table>
          <thead><tr><th>Постер</th><th>Атауы</th><th>Ел</th><th>Серия</th><th>Қаралым</th><th>Баға</th><th>Әрекет</th></tr></thead>
          <tbody>
            ${dramas.map(d => `
              <tr>
                <td><img src="${esc(Img.url(d.poster))}" alt=""></td>
                <td><b>${esc(d.title)}</b><br><span class="muted" style="font-size:12px">${esc(d.genres.join(", "))}</span></td>
                <td>${esc(d.country)}</td>
                <td>${d.episodes}</td>
                <td>${views[d.id] || 0}</td>
                <td><b style="color:var(--purple)">${money(d.price)}</b></td>
                <td style="white-space:nowrap">
                  <button class="rowbtn" data-edit="${d.id}">Өңдеу</button>
                  <button class="rowbtn rowbtn--del" data-remove="${d.id}">Жою</button>
                </td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`,

    /* --- Тапсырыстар --- */
    orders: () => orders.length ? `
      <div class="tablewrap">
        <table>
          <thead><tr><th>№</th><th>Күні</th><th>Клиент</th><th>Дорамалар</th><th>Сома</th><th>Күйі</th><th>Әрекет</th></tr></thead>
          <tbody>
            ${orders.map(o => `
              <tr>
                <td><b>${esc(o.id)}</b></td>
                <td>${dateKz(o.createdAt)}</td>
                <td>${esc(o.userName || "—")}<br><span class="muted" style="font-size:12px">${esc(o.userEmail || "")}</span></td>
                <td>${o.items.map(i => esc(i.title)).join(", ")}</td>
                <td><b style="color:var(--purple)">${money(o.total)}</b></td>
                <td><span class="status status--${o.status === "Төленді" ? "ok" : o.status === "Күтілуде" ? "wait" : "no"}">${esc(o.status)}</span></td>
                <td style="white-space:nowrap">
                  ${o.status === "Күтілуде" ? `
                    <button class="rowbtn" data-paid="${o.id}">Төленді</button>
                    <button class="rowbtn rowbtn--del" data-cancel="${o.id}">Бас тарту</button>`
                    : `<button class="rowbtn" data-pending="${o.id}">Күтілуде</button>`}
                </td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
      <p class="muted" style="font-size:13px;margin-top:12px">
        Ақша түскенін WhatsApp-тан тексеріп, «Төленді» деп белгіле — сонда дорамалар клиенттің профиліне қосылады.
      </p>` : emptyHTML("Тапсырыс жоқ", "Алғашқы сатылым осында көрінеді."),

    /* --- Жариялау --- */
    publish: () => {
      const c = Publish.cfg();
      return `
      <div class="adminform form" style="max-width:560px">
        <h3 style="font-size:17px;margin-bottom:6px">GitHub-қа жариялау</h3>
        <p class="muted" style="font-size:13.5px;margin:0 0 18px">
          Каталогты дүкен сайтының <code>config.js</code> файлына жазады.
          GitHub Pages 1-3 минутта өзі жаңартады.
        </p>

        <div class="repobox">
          <div><small>Репозиторий</small><b>${esc(c.owner)}/${esc(c.repo)}</b></div>
          <div><small>Тармақ</small><b>${esc(c.branch)}</b></div>
        </div>
        <p class="muted" style="font-size:12px;margin:8px 0 18px">
          Бұларды өзгерту үшін <code>config.js</code> ішіндегі <code>GITHUB</code> блогын түзет.
        </p>

        <label>Токен
          <input id="ghToken" type="password" value="${esc(c.token)}" placeholder="github_pat_…"
                 autocomplete="off" spellcheck="false">
        </label>
        <p class="muted" style="font-size:12px;margin:4px 0 16px">
          Токен тек осы браузерде сақталады. GitHub → Settings → Developer settings →
          Fine-grained tokens. Құқығы: тек осы репозиторий, <b>Contents: Read and write</b>.
        </p>

        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn--primary" id="pubBtn">Дүкенге жариялау</button>
          <button class="btn btn--ghost" id="pubTest">Байланысты тексеру</button>
        </div>

        <div id="pubLog" class="publog" hidden></div>
      </div>`;
    },

    /* --- Пайдаланушылар --- */
    users: () => users.length ? `
      <div class="tablewrap">
        <table>
          <thead><tr><th>Аты</th><th>Email</th><th>Сатып алғаны</th><th>Әрекет</th></tr></thead>
          <tbody>
            ${users.map(u => `
              <tr>
                <td><b>${esc(u.name || "—")}</b></td>
                <td>${esc(u.email)}</td>
                <td>${(u.purchases || []).length} дорама</td>
                <td>${u.email === SHOP.adminEmail
                  ? `<span class="pill pill--accent">Админ</span>`
                  : `<button class="rowbtn rowbtn--del" data-deluser="${u.id}">Жою</button>`}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>` : emptyHTML("Пайдаланушы жоқ", "Тіркелгендер осында көрінеді.")
  };

  const show = key => {
    $("#aBody").innerHTML = panes[key]();
    if (key === "dramas") {
      wireDramaForm(dramas);
      const ex = $("#exportBtn");
      if (ex) ex.addEventListener("click", () => exportCatalog(dramas));
      const gp = $("#goPublish");
      if (gp) gp.addEventListener("click", () => {
        $$("#aTabs .tab").forEach(t => t.classList.toggle("is-active", t.dataset.a === "publish"));
        show("publish");
      });
    }
    if (key === "publish") wirePublish(dramas);
    adminTab = key;
  };
  show(adminTab);

  $$("#aTabs .tab").forEach(t => t.classList.toggle("is-active", t.dataset.a === adminTab));

  $("#aTabs").addEventListener("click", e => {
    const b = e.target.closest("[data-a]");
    if (!b) return;
    $$("#aTabs .tab").forEach(t => t.classList.toggle("is-active", t === b));
    show(b.dataset.a);
  });

  $("#aBody").addEventListener("click", async e => {
    const del = e.target.closest("[data-remove]");
    const edit = e.target.closest("[data-edit]");
    const delUser = e.target.closest("[data-deluser]");

    if (del && confirm("Осы дораманы жоямыз ба?")) {
      const d = dramas.find(x => x.id === del.dataset.remove);
      if (d) {                                   // орын бос қалсын
        await Img.remove(d.poster);
        for (const src of d.images || []) await Img.remove(src);
      }
      await DB.removeDrama(del.dataset.remove);
      toast("Жойылды"); viewAdmin();
    }
    if (delUser && confirm("Пайдаланушыны жоямыз ба?")) {
      await DB.removeUser(delUser.dataset.deluser);
      toast("Жойылды"); viewAdmin();
    }
    const paidBtn   = e.target.closest("[data-paid]");
    const cancelBtn = e.target.closest("[data-cancel]");
    const pendBtn   = e.target.closest("[data-pending]");

    if (paidBtn)   { await DB.setOrderStatus(paidBtn.dataset.paid, "Төленді");     toast("Төленді деп белгіленді"); return viewAdmin(); }
    if (cancelBtn) { await DB.setOrderStatus(cancelBtn.dataset.cancel, "Бас тартылды"); toast("Бас тартылды");      return viewAdmin(); }
    if (pendBtn)   { await DB.setOrderStatus(pendBtn.dataset.pending, "Күтілуде"); toast("Күтілуде");               return viewAdmin(); }

    if (edit) {
      const d = dramas.find(x => x.id === edit.dataset.edit);
      fillDramaForm(d);
      $("#dForm").scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });
}

/** Админ формасын жандандыру */
function wireDramaForm(dramas) {
  const form = $("#dForm");
  let posterData = "";
  let shots = [];

  const drawShots = () => {
    $("#dShotsPrev").innerHTML = shots.map((src, i) => `
      <figure>
        <img src="${esc(Img.url(src))}" alt="">
        <button type="button" data-shotdel="${i}" aria-label="Өшіру">&times;</button>
      </figure>`).join("");
  };

  // Постер — файлдан
  $("#dFile").addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;
    compressImage(file, 400, 600, async res => {
      posterData = await storeImage(res);
      const prev = $("#dPrev");
      prev.src = Img.url(posterData); prev.hidden = false;
    });
  });

  // Видео — тікелей GitHub-қа
  $("#dVideo").addEventListener("change", async e => {
    const file = e.target.files[0];
    if (!file) return;

    const log = $("#dVideoLog");
    log.hidden = false; log.innerHTML = "";
    const say = (t, kind = "") => {
      const row = document.createElement("div");
      row.className = "publog__row" + (kind ? " publog__row--" + kind : "");
      row.textContent = t; log.appendChild(row);
    };

    const mb = file.size / 1048576;
    say(`${file.name} · ${mb.toFixed(1)} МБ`);

    if (!Publish.ready())
      return say("Алдымен «Жариялау» бөліміне токенді енгіз", "no");

    if (mb > 25)
      return say("Файл тым үлкен. 25 МБ-тан аспасын — алдымен сығып ал.", "no");

    if (mb > 10)
      say("10 МБ-тан үлкен. Сайттың орны шектеулі (барлығы 1 ГБ).");

    const ext  = (file.name.split(".").pop() || "mp4").toLowerCase();
    const name = "video/" + Date.now().toString(36) + "." + ext;

    try {
      await Publish.putBinary(name, file, m => say(m));
      form.elements.trailer.value = name;
      say("Дайын. Сілтеме өріске қойылды: " + name, "ok");
      say("Дораманы сақтап, «Жариялау» батырмасын басуды ұмытпа.");
    } catch (err) {
      say(err.message, "no");
    }
    e.target.value = "";
  });

  // Постер — сілтемеден (жазып жатқанда бірден көрінеді)
  form.elements.poster.addEventListener("input", e => {
    const url = e.target.value.trim();
    const prev = $("#dPrev");
    if (url) { posterData = ""; prev.src = url; prev.hidden = false; }
    else prev.hidden = !posterData;
  });

  // Кадрлар — бірнеше файл
  $("#dShots").addEventListener("change", e => {
    const files = Array.from(e.target.files).slice(0, 8);
    if (!files.length) return;
    let left = files.length;
    files.forEach(f => compressImage(f, 800, 450, async res => {
      shots.push(await storeImage(res));
      if (--left === 0) { drawShots(); toast(files.length + " кадр қосылды"); }
    }));
    e.target.value = "";
  });

  $("#dShotsPrev").addEventListener("click", e => {
    const b = e.target.closest("[data-shotdel]");
    if (!b) return;
    shots.splice(+b.dataset.shotdel, 1);
    drawShots();
  });

  // Өңдеуге басқанда кадрларды форманың ішіне жүктеу
  form.addEventListener("shots:load", e => { shots = e.detail.slice(); drawShots(); });
  form.addEventListener("shots:clear", () => { shots = []; posterData = ""; drawShots(); });

  $("#dCancel").addEventListener("click", () => resetDramaForm());

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const f = new FormData(form);
    const data = {
      title: f.get("title").trim(),
      titleOriginal: f.get("titleOriginal").trim(),
      country: f.get("country"),
      genres: f.get("genres").split(",").map(s => s.trim()).filter(Boolean),
      alt:    f.get("alt").split(",").map(s => s.trim()).filter(Boolean),
      mood:   f.get("mood").split(",").map(s => s.trim()).filter(Boolean),
      year: +f.get("year"),
      rating: +f.get("rating"),
      episodes: +f.get("episodes"),
      price: +f.get("price"),
      description: f.get("description").trim(),
      trailer: f.get("trailer").trim(),
      poster: posterData || f.get("poster").trim(),
      images: shots,
      popular: f.get("popular") === "on",
      isNew: f.get("isNew") === "on"
    };

    const id = f.get("docId");
    if (id) { await DB.updateDrama(id, data); toast("Өзгертілді"); }
    else    { await DB.addDrama(data);       toast("Қосылды"); }
    viewAdmin();
  });
}

function fillDramaForm(d) {
  const el = $("#dForm").elements;
  el.docId.value         = d.id;
  el.title.value         = d.title;
  el.titleOriginal.value = d.titleOriginal || "";
  el.country.value       = d.country;
  el.genres.value        = d.genres.join(", ");
  el.alt.value           = (d.alt || []).join(", ");
  el.mood.value          = (d.mood || []).join(", ");
  el.year.value          = d.year || 2025;
  el.rating.value        = d.rating;
  el.episodes.value      = d.episodes;
  el.price.value         = d.price;
  el.description.value   = d.description || "";
  el.trailer.value       = d.trailer || "";
  el.poster.value        = (d.poster || "").startsWith("data:") ? "" : d.poster;
  el.popular.checked     = !!d.popular;
  el.isNew.checked       = !!d.isNew;

  $("#dFormTitle").textContent = "Дораманы өңдеу";
  $("#dSave").textContent = "Сақтау";
  $("#dCancel").hidden = false;
  const prev = $("#dPrev");
  prev.src = Img.url(d.poster); prev.hidden = false;

  $("#dForm").dispatchEvent(new CustomEvent("shots:load", { detail: d.images || [] }));
}

function resetDramaForm() {
  const form = $("#dForm");
  form.reset(); form.elements.docId.value = "";
  $("#dFormTitle").textContent = "Жаңа дорама қосу";
  $("#dSave").textContent = "Қосу";
  $("#dCancel").hidden = true;
  $("#dPrev").hidden = true;
  form.dispatchEvent(new CustomEvent("shots:clear"));
}

/** Суретті берілген өлшемге сығып, {blob, dataUrl} қайтарады.
 *  WebP қолдаса — соны алады (JPEG-тен ~2.5 есе жеңіл).
 *  Телефонның 4 МБ суреті постер үшін ~15 КБ болып қалады. */
function compressImage(file, W, H, done) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext("2d");
      const scale = Math.max(W / img.width, H / img.height);
      const w = img.width * scale, h = img.height * scale;
      ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);   // ортасынан қиямыз

      // WebP қолдауын тексереміз
      const type = canvas.toDataURL("image/webp").startsWith("data:image/webp")
        ? "image/webp" : "image/jpeg";

      canvas.toBlob(
        blob => done({ blob, dataUrl: canvas.toDataURL(type, 0.7) }),
        type, 0.7
      );
    };
    img.onerror = () => toast("Бұл сурет оқылмады");
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

/** Сығылған суретті сақтау орнына қарай орналастыру.
 *  Демо режим → IndexedDB (кең), Firebase → base64 (Firestore-ға кетеді). */
async function storeImage(result) {
  if (DB.mode === "demo" && Img.available) {
    const ref = await Img.put(result.blob);
    if (ref) return ref;
  }
  return result.dataUrl;
}


/* ── Жариялау ────────────────────────────────── */
function wirePublish(dramas) {
  const saveToken = () => Publish.saveToken($("#ghToken").value.trim());
  const log = $("#pubLog");
  const say = (text, kind = "") => {
    log.hidden = false;
    const line = document.createElement("div");
    line.className = "publog__row" + (kind ? " publog__row--" + kind : "");
    line.textContent = text;
    log.appendChild(line);
  };

  $("#pubTest").addEventListener("click", async () => {
    log.innerHTML = "";
    saveToken();
    if (!Publish.ready()) return say("Токенді енгіз", "no");

    say("Тексерілуде…");
    try {
      const file = await Publish.findConfig();
      const n = (file.text.match(/const CATALOG_VERSION = (\d+)/) || [])[1];
      say(`Байланыс дұрыс. ${file.path} · каталог нұсқасы: ${n || "белгісіз"}`, "ok");
    } catch (err) {
      say(err.message, "no");
    }
  });

  $("#pubBtn").addEventListener("click", async e => {
    log.innerHTML = "";
    saveToken();
    if (!Publish.ready()) return say("Токенді енгіз", "no");

    e.target.disabled = true;
    try {
      say("Каталог дайындалуда…");
      const code = await buildCatalogCode(dramas);
      const kb = Math.round(new Blob([code]).size / 1024);
      say(`${dramas.length} дорама · ${kb} КБ`);

      const res = await Publish.run(code, msg => say(msg));
      if (res.changed) say("Дүкен сайтын 2-3 минуттан кейін жаңартып қара.", "ok");
    } catch (err) {
      say(err.message, "no");
    }
    e.target.disabled = false;
  });
}

/* ── Каталогты кодқа айналдыру ───────────────── */

/** SEED_DRAMAS блогын дайындап, көшіруге береді.
 *  Жүктелген суреттер base64-ке айналады — файлдың ішінде жүре алады. */
async function exportCatalog(dramas) {
  toast("Дайындалуда…");
  const code = await buildCatalogCode(dramas);
  showExport(code, Math.round(new Blob([code]).size / 1024), dramas.length);
}

/** Каталогтың JS кодын құрастыру (жариялау да, экспорт та осыны қолданады) */
async function buildCatalogCode(dramas) {
  const rows = [];
  for (const d of dramas) {
    const poster = await Img.dataUrl(d.poster);
    const images = [];
    for (const src of d.images || []) {
      const u = await Img.dataUrl(src);
      if (u) images.push(u);
    }

    const rec = {
      title: d.title,
      alt: d.alt || [],
      titleOriginal: d.titleOriginal || "",
      country: d.country,
      genres: d.genres,
      year: d.year,
      rating: d.rating,
      episodes: d.episodes,
      price: d.price,
      popular: !!d.popular,
      isNew: !!d.isNew,
      description: d.description || "",
      mood: d.mood || [],
      trailer: d.trailer || ""
    };
    // Автоматты жасалған постерді сақтаудың қажеті жоқ
    if (poster && !poster.startsWith("data:image/svg+xml")) rec.poster = poster;
    if (images.length) rec.images = images;

    rows.push("  " + JSON.stringify(rec));
  }

  return "const SEED_DRAMAS = [\n" + rows.join(",\n") + "\n];";
}

function showExport(code, kb, count) {
  const box = document.createElement("div");
  box.className = "modal";
  box.innerHTML = `
    <div class="modal__backdrop" data-x></div>
    <div class="modal__box" style="width:min(720px,100%)">
      <button class="modal__x" data-x aria-label="Жабу">&times;</button>
      <h3 style="font-size:18px;margin-bottom:6px">Каталог коды дайын</h3>
      <p class="muted" style="font-size:13.5px;margin:0 0 14px">
        ${count} дорама · ${kb} КБ. Мынаны <code>js/config.js</code> ішіндегі
        ескі <code>SEED_DRAMAS</code> блогының орнына қой,
        сосын <code>CATALOG_VERSION</code> санын 1-ге өсір.
      </p>
      <textarea id="exOut" readonly rows="10"
        style="width:100%;font-family:monospace;font-size:11px;padding:12px;border-radius:10px;
               border:1px solid var(--line);background:var(--bg-2);color:var(--text);resize:vertical"></textarea>
      <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap">
        <button class="btn btn--primary" id="exCopy">Көшіру</button>
        <button class="btn btn--ghost" id="exFile">Файл жүктеу</button>
      </div>
      ${kb > 400 ? `<p class="muted" style="font-size:12px;margin:12px 0 0">
        Файл үлкендеу болды — суреттер соның ішінде. Постерлерді интернеттегі
        сілтемемен қойсаң, әлдеқайда жеңіл болады.</p>` : ""}
    </div>`;
  document.body.appendChild(box);
  document.body.classList.add("no-scroll");
  $("#exOut", box).value = code;

  const close = () => { box.remove(); document.body.classList.remove("no-scroll"); };
  box.addEventListener("click", e => { if (e.target.closest("[data-x]")) close(); });

  $("#exCopy", box).addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(code); }
    catch { const ta = $("#exOut", box); ta.select(); document.execCommand("copy"); }
    toast("Көшірілді");
  });

  $("#exFile", box).addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
    a.download = "catalog.js";
    a.click();
    URL.revokeObjectURL(a.href);
  });
}

/* ── Кіру қақпасы ────────────────────────────── */

function viewGate(message) {
  render(`
    <div class="page">
      <div class="gate">
        <div class="gate__mark">ONLINE<span>DORAMA</span></div>
        <div class="gate__lock">
          <svg viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V7.5a3.5 3.5 0 017 0v3"/></svg>
        </div>
        <h1>Админ панелі</h1>
        <p class="muted">${esc(message || "Кіру үшін құпия кодты енгізіңіз")}</p>

        <form class="form" id="gateForm">
          <label>Құпия код
            <div class="gate__field">
              <input name="code" type="password" required autocomplete="off"
                     autocapitalize="off" spellcheck="false" placeholder="••••••••••••">
              <button type="button" id="peek" aria-label="Кодты көрсету">
                <svg viewBox="0 0 24 24"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.6"/></svg>
              </button>
            </div>
          </label>
          <p class="form__err" id="gateErr" hidden></p>
          <button class="btn btn--primary btn--full" type="submit" id="gateBtn">Кіру</button>
        </form>

        <a href="index.html" class="muted" style="font-size:13px">← Дүкенге қайту</a>
      </div>
    </div>
  `);

  const form = $("#gateForm");
  const input = form.elements.code;

  $("#peek").addEventListener("click", () => {
    input.type = input.type === "password" ? "text" : "password";
    input.focus();
  });

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const err = $("#gateErr"); err.hidden = true;
    const btn = $("#gateBtn");
    btn.disabled = true; btn.textContent = "Тексерілуде…";

    // Кодты бірінен соң бірін теруді баяулатамыз
    await new Promise(r => setTimeout(r, 350));

    try {
      await Auth.loginWithCode(input.value);
      if (!Auth.isAdmin()) { await Auth.logout(); throw new Error("Код қате"); }
      start();
    } catch (ex) {
      err.textContent = friendlyError(ex);
      err.hidden = false;
      input.value = ""; input.focus();
      btn.disabled = false; btn.textContent = "Кіру";
    }
  });

  input.focus();
}

function friendlyError(ex) {
  const map = {
    "auth/invalid-credential": "Код қате",
    "auth/wrong-password":     "Код қате",
    "auth/user-not-found":     "Әкімші аккаунты Firebase-те жасалмаған",
    "auth/too-many-requests":  "Тым көп талпыныс — біраз күте тұрыңыз",
    "auth/network-request-failed": "Интернет байланысы жоқ",
    "permission-denied":       "Firestore ережелері рұқсат бермеді"
  };
  return map[ex?.code] || ex?.message || "Қате шықты";
}

/* ── Оқиғалар ────────────────────────────────── */

$("#logoutBtn").addEventListener("click", async () => {
  await Auth.logout();
  toast("Шықтыңыз");
  viewGate();
  $("#whoami").textContent = "";
  $("#logoutBtn").hidden = true;
});

$("#themeBtn").addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  LS.set("theme", next);
});

function start() {
  if (!Auth.isAdmin()) return viewGate();
  $("#whoami").textContent = Auth.user.email;
  $("#logoutBtn").hidden = false;
  viewAdmin();
}

/* ── Іске қосу ───────────────────────────────── */
(async function init() {
  const need = { "config.js": typeof SHOP, "store.js": typeof DB,
                 "ui.js": typeof esc, "publish.js": typeof Publish };
  const missing = Object.keys(need).filter(k => need[k] === "undefined");
  if (missing.length) {
    document.getElementById("splash").classList.add("is-done");
    document.getElementById("app").innerHTML =
      `<div class="page"><div class="empty"><h3>Жүктелмеді</h3>
       <p class="muted">Мына файл(дар) жоқ: ${missing.join(", ")}</p></div></div>`;
    return;
  }

  document.documentElement.dataset.theme = LS.get("theme", "dark");
  try {
    await Img.init();
    await Auth.init();
    start();
  } catch (err) {
    console.error(err);
    $("#app").innerHTML = `<div class="page"><div class="empty">
      <h3>Жүктелмеді</h3><p class="muted">${esc(err.message || String(err))}</p></div></div>`;
  }
  $("#splash").classList.add("is-done");
})();

/* Бір нәрсе тұрып қалса — экранды босатып, себебін жазамыз */
setTimeout(() => {
  const splash = document.getElementById("splash");
  if (!splash || splash.classList.contains("is-done")) return;
  splash.classList.add("is-done");
  document.getElementById("app").innerHTML =
    `<div class="page"><div class="empty">
       <h3>Жүктелу тым ұзаққа созылды</h3>
       <p class="muted">Бетті жаңартып көріңіз. Қайталанса — файлдардың бәрі серверде тұрғанын тексеріңіз.</p>
     </div></div>`;
}, 8000);
