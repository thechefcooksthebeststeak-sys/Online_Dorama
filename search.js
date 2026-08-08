/* ═══════════════════════════════════════════════
   search.js — дорама іздеу
   Мақсаты: атын жазсаң — сол шығады; жазғаның
   каталогта жоқ болса — ұқсастары шығады.

   Қазақ әріптерінің әртүрлі жазылуын да көтереді:
   «коктем» ↔ «көктем», «казак» ↔ «қазақ».
   ═══════════════════════════════════════════════ */

const Search = {

  /** Әріптерді бір қалыпқа келтіру */
  fold(text) {
    const map = { "ә":"а","ғ":"г","қ":"к","ң":"н","ө":"о","ұ":"у","ү":"у","һ":"х","і":"и","ё":"е","й":"и","ъ":"","ь":"" };
    return (text || "").toLowerCase()
      .replace(/[әғқңөұүһіёйъь]/g, c => map[c])
      .replace(/[^\p{L}\p{N}\s]/gu, " ")   // тек тыныс белгілерін алып тастаймыз
      .replace(/\s+/g, " ").trim();
  },

  /** Екі жолдың арасындағы қашықтық (қате теруді кешіру үшін) */
  distance(a, b) {
    if (a === b) return 0;
    if (!a.length || !b.length) return Math.max(a.length, b.length);

    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const row = [i];
      for (let j = 1; j <= b.length; j++) {
        row[j] = Math.min(
          prev[j] + 1,                                    // өшіру
          row[j - 1] + 1,                                 // қосу
          prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)   // ауыстыру
        );
      }
      prev = row;
    }
    return prev[b.length];
  },

  /** Бір дорама сұранысқа қаншалық сай — 0 болса мүлдем сай емес */
  score(d, query) {
    const q = this.fold(query);
    if (!q) return 0;

    const title = this.fold(d.title);
    const orig  = this.fold(d.titleOriginal);
    const alts  = (d.alt || []).map(a => this.fold(a));
    let s = 0;

    if (title === q)                                          s = 100;
    else if (title.startsWith(q))                             s = 85;
    else if (title.includes(q))                               s = 70;
    else if (alts.some(a => a === q))                          s = 90;
    else if (alts.some(a => a.startsWith(q)))                  s = 78;
    else if (orig && orig.includes(q))                         s = 68;
    else if (alts.some(a => a.includes(q)))                    s = 66;
    else if (title.split(" ").some(w => w.startsWith(q)))      s = 60;
    else {
      // Қате терілген болуы мүмкін
      const names = [title, ...alts].filter(Boolean);
      const full  = Math.min(...names.map(n => this.distance(n, q)));
      const limit = Math.max(1, Math.floor(Math.max(title.length, q.length) / 4));

      if (full <= limit) s = 55 - full * 4;
      else if (q.length >= 4) {
        const word = Math.min(...names.flatMap(n => n.split(" ")).map(w => this.distance(w, q)));
        if (word <= 2) s = 45 - word * 5;
      }
    }

    // Атауынан таппасақ — басқа өрістерден
    if (!s) {
      if (this.fold(d.genres.join(" ")).includes(q))       s = 30;
      else if (this.fold(d.country).includes(q))           s = 26;
      else if (this.fold((d.mood || []).join(" ")).includes(q)) s = 24;
      else if (this.fold(d.description).includes(q))       s = 16;
    }

    return s ? s + d.rating / 10 : 0;   // тең түскенде рейтинг шешеді
  },

  /** Табылғандар, ең сәйкесі бірінші */
  run(list, query) {
    return list
      .map(d => ({ d, s: this.score(d, query) }))
      .filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map(x => x.d);
  },

  /** Ештеңе табылмағанда: атауы жақындарын ұсыну */
  similar(list, query, limit = 6) {
    const q = this.fold(query);
    if (!q) return [];

    return list
      .map(d => {
        const names = [this.fold(d.title), ...(d.alt || []).map(a => this.fold(a))].filter(Boolean);
        // Ең жақын сөзді де, толық атауды да қараймыз
        const byWord = Math.min(...names.flatMap(n => n.split(" ")).map(w => this.distance(w, q)));
        const near = Math.min(...names.map(n => this.distance(n, q)), byWord);
        return { d, near };
      })
      .sort((a, b) => a.near - b.near || b.d.rating - a.d.rating)
      .slice(0, limit)
      .map(x => x.d);
  }
};
