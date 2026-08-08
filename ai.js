/* ═══════════════════════════════════════════════
   ai.js — DORAMA AI
   Пайдаланушының қазақша сұранысын түсініп,
   каталогтан 5-10 дорама таңдайды.

   Екі режимде жұмыс істейді:
   1. Жергілікті (әдепкі) — интернетсіз, тегін, кілт керек емес
   2. Сервер арқылы — SHOP.aiEndpoint қойылса, нағыз Claude сұралады
   ═══════════════════════════════════════════════ */

const AI = {

  /** Сұранысты талдау: не керек, не керек емес */
  parse(text) {
    const q = text.toLowerCase();
    const words = q.split(/[^\wа-яёәғқңөұүһі]+/i).filter(Boolean);

    const want = { genres: [], mood: [], filters: [], countries: [] };
    const avoid = { genres: [], mood: [] };

    for (const rule of AI_RULES) {
      const hit = rule.words.find(w => q.includes(w));
      if (!hit) continue;

      // Табылған сөзден кейінгі 3 сөздің ішінде «емес» бар ма?
      const at = words.findIndex(w => hit.startsWith(w) || w.startsWith(hit.split(" ")[0]));
      const after = words.slice(at + 1, at + 4).join(" ");
      const negated = AI_NEGATIONS.some(n => after.includes(n));

      const box = negated ? avoid : want;
      if (rule.genres) box.genres.push(...rule.genres);
      if (rule.mood)   box.mood.push(...rule.mood);
      if (!negated) {
        if (rule.filter)  want.filters.push(rule.filter);
        if (rule.country) want.countries.push(rule.country);
      }
    }
    return { want, avoid, raw: text };
  },

  /** Әр дорамаға ұпай беріп, ең жақсыларын таңдау */
  rank(list, parsed) {
    const { want, avoid } = parsed;

    const scored = list.map(d => {
      const mood = d.mood || [];
      let score = 0;
      let matched = 0;                       // талапқа нақты неше рет сәйкес келді
      const why = [];

      // Керек емес нәрсе болса — мүлдем алып тастаймыз
      if (avoid.genres.some(g => d.genres.includes(g))) return null;
      if (avoid.mood.some(m => mood.includes(m))) return null;

      for (const g of new Set(want.genres))
        if (d.genres.includes(g)) { score += 10; matched++; why.push(g); }

      for (const m of new Set(want.mood))
        if (mood.includes(m)) { score += 8; matched++; why.push(m); }

      for (const f of want.filters)
        if (f(d)) { score += 5; matched++; }

      // Ел көрсетілсе — басқа елдікі мүлдем жарамайды
      if (want.countries.length) {
        if (!want.countries.includes(d.country)) return null;
        score += 7; matched++; why.push(d.country);
      }

      // Терістеу ғана айтылса («қайғылы емес»), тірі қалғанның бәрі жарайды
      if (!want.genres.length && !want.mood.length && !want.filters.length && !want.countries.length
          && (avoid.genres.length || avoid.mood.length)) matched++;

      const q = parsed.raw.toLowerCase();
      if (q.includes(d.title.toLowerCase())) { score += 15; matched++; }

      score += d.rating;                       // тең түскенде рейтинг шешеді
      if (d.popular) score += 1.5;

      const genreHit = want.genres.some(g => d.genres.includes(g));
      return { d, score, matched, genreHit, why: [...new Set(why)] };
    }).filter(Boolean);

    // Көп талапқа сай келгені жоғары тұрады, тең болса — ұпайы
    scored.sort((a, b) => b.matched - a.matched || b.score - a.score);

    // Жанр аталса әрі сол жанрдан жеткілікті болса — басқасын араластырмаймыз
    if (want.genres.length) {
      const pure = scored.filter(x => x.genreHit);
      if (pure.length >= 5) return pure;
    }
    return scored;
  },

  /** Негізгі функция: сұраныс → ұсыныстар */
  async recommend(text) {
    const list = await DB.dramas();
    if (!list.length) return { reply: "Каталог әзірге бос.", picks: [] };

    // Сервер режимі
    if (SHOP.aiEndpoint) {
      try {
        const res = await fetch(SHOP.aiEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: text,
            catalog: list.map(d => ({
              id: d.id, title: d.title, genres: d.genres, mood: d.mood || [],
              country: d.country, episodes: d.episodes, rating: d.rating, price: d.price
            }))
          })
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        const picks = (data.ids || []).map(id => list.find(d => d.id === id)).filter(Boolean);
        if (picks.length) return { reply: data.reply || "", picks: picks.map(d => ({ d, why: [] })) };
      } catch (err) {
        console.warn("AI сервері жауап бермеді, жергілікті режимге көштік:", err.message);
      }
    }

    // Жергілікті режим
    const parsed = this.parse(text);
    const scored = this.rank(list, parsed);
    const hasSignal = parsed.want.genres.length || parsed.want.mood.length
                   || parsed.want.filters.length || parsed.want.countries.length
                   || parsed.avoid.genres.length || parsed.avoid.mood.length;

    // Талапқа шын сәйкес келгендер ғана
    const hits = scored.filter(x => x.matched > 0);
    let picks = hits.slice(0, 8);
    let topped = 0;

    // Тым аз болса — жақын келетіндерімен толықтырамыз
    if (picks.length < 5) {
      const rest = scored.filter(x => x.matched === 0).slice(0, 5 - picks.length);
      topped = rest.length;
      picks = [...picks, ...rest];
    }

    return { reply: this.explain(parsed, picks, hasSignal, hits.length, topped), picks };
  },

  /** Жауаптың бірінші сөйлемін құрастыру */
  explain(parsed, picks, hasSignal, hitCount, topped) {
    if (!picks.length)
      return "Осы талапқа сай дорама табылмады. Талапты жұмсартып көріңіз — мысалы, жанрды алып тастаңыз.";

    if (!hasSignal)
      return `Сұранысты нақты түсінбедім, сондықтан ең жоғары бағаланғандарын ұсынайын. Қалауыңызды жазсаңыз — жанр, көңіл-күй, ел, серия саны — дәлірек таңдаймын.`;

    const parts = [];
    if (parsed.want.genres.length)    parts.push([...new Set(parsed.want.genres)].join(" + "));
    if (parsed.want.mood.length)      parts.push([...new Set(parsed.want.mood)].join(", "));
    if (parsed.want.countries.length) parts.push(parsed.want.countries.join(", "));

    const avoided = [...new Set([...parsed.avoid.genres, ...parsed.avoid.mood])];
    const tail = avoided.length ? `, ал ${avoided.join(", ")} дегендерін алып тастадым` : "";

    const extra = topped
      ? ` Дәл сәйкесі ${hitCount} ғана болды, сондықтан жақын келетін тағы ${topped} дорама қостым.`
      : "";

    return `${parts.join(" · ") || "Таңдау"} бойынша ${hitCount} дорама таптым${tail}.${extra}`;
  }
};
