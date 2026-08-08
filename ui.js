/* ═══════════════════════════════════════════════
   ui.js — қайталанатын UI бөліктері
   ═══════════════════════════════════════════════ */

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** 900 → "900 ₸" */
const money = n => new Intl.NumberFormat("kk-KZ").format(Math.round(n)) + " " + SHOP.currency;

/** 1739000000000 → "12 ақпан, 2026" */
const dateKz = ts => new Date(ts).toLocaleDateString("kk-KZ", { day: "numeric", month: "long", year: "numeric" });

const esc = s => String(s ?? "").replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Дорама карточкасы */
function cardHTML(d) {
  const tag = d.isNew ? "Жаңа" : (d.popular ? "ТОП" : "");
  return `
  <a class="card" href="#/drama/${d.id}">
    <div class="card__poster">
      <div class="card__top">
        ${tag ? `<span class="card__tag">${tag}</span>` : "<span></span>"}
        <span class="card__rate">${d.trailer ? "▶ " : ""}★ ${d.rating.toFixed(1)}</span>
      </div>
      <img src="${esc(Img.url(d.poster))}" alt="${esc(d.title)} постері" loading="lazy">
      <div class="card__over">
        <button class="btn btn--primary" data-add="${d.id}">Себетке</button>
      </div>
    </div>
    <div class="card__meta">
      <div class="card__title">${esc(d.title)}</div>
      <div class="card__sub"><span>${esc(d.country)}</span>·<span>${d.episodes} серия</span></div>
      <div class="card__price">${money(d.price)}</div>
    </div>
  </a>`;
}

/** Көлденең тізбек */
function railHTML(id, items) {
  return `
  <div class="rail" id="rail-${id}">
    <button class="rail__arrow rail__arrow--l" data-scroll="-1" aria-label="Артқа"><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button>
    <div class="rail__track">${items.map(cardHTML).join("")}</div>
    <button class="rail__arrow rail__arrow--r" data-scroll="1" aria-label="Алға"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button>
  </div>`;
}

/** Хабарлама */
let toastTimer;
function toast(text) {
  const box = $("#toasts");
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = text;
  box.appendChild(el);
  clearTimeout(toastTimer);
  setTimeout(() => { el.style.opacity = "0"; setTimeout(() => el.remove(), 350); }, 2600);
}

/** Бос экран */
function emptyHTML(title, text, btn) {
  return `<div class="empty">
    <h3>${esc(title)}</h3>
    <p class="muted">${esc(text)}</p>
    ${btn ? `<a class="btn btn--primary" href="${btn.href}" style="margin-top:16px">${esc(btn.label)}</a>` : ""}
  </div>`;
}

/** Трейлер сілтемесін танып, қалай ойнатуды шешеміз.
 *  YouTube → кірістірілген ойнатқыш, тікелей файл → өз ойнатқышымыз. */
function parseTrailer(url) {
  if (!url) return null;

  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return { kind: "youtube", id: yt[1] };

  // TikTok: толық сілтеме керек (vm.tiktok.com қысқа сілтемесінен нөмір алынбайды)
  const tt = url.match(/tiktok\.com\/(?:.*\/video\/|embed\/v2\/|embed\/)(\d{6,})/);
  if (tt) return { kind: "tiktok", id: tt[1] };

  if (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(url)) return { kind: "file", src: url };
  return { kind: "link", src: url };
}

/** Модал терезені басқару */
const Modal = {
  open(el) { el.hidden = false; document.body.classList.add("no-scroll"); },
  close(el) { el.hidden = true; document.body.classList.remove("no-scroll"); }
};
