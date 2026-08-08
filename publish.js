/* ═══════════════════════════════════════════════
   publish.js — админнен GitHub-қа жариялау
   Тек admin.html жүктейді.

   Қалай жұмыс істейді:
   admin.html → GitHub API → js/config.js жаңарады
             → GitHub Pages өзі қайта құрастырады
             → дүкен сайты жаңа каталогты көрсетеді

   Токен тек осы браузердің жадында тұрады, ешқашан
   сайт файлдарына жазылмайды.
   ═══════════════════════════════════════════════ */

const Publish = {

  /* ---- Баптау ----
     Репозиторий деректері config.js-тен келеді (сайтпен бірге жаңарады).
     Тек токен браузерде сақталады — ол ешқашан файлға жазылмайды. */
  cfg() {
    return { ...GITHUB, token: LS.get("ghToken", "") };
  },
  saveToken(token) { LS.set("ghToken", token); },
  ready() { const c = this.cfg(); return !!(c.owner && c.repo && c.token); },

  /* ---- base64 (қазақ әріптерін бұзбайтын) ---- */
  encode(text) {
    const bytes = new TextEncoder().encode(text);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 8192)          // ұзын жолда стек толып кетпесін
      bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(bin);
  },
  decode(b64) {
    const bin = atob(b64.replace(/\s/g, ""));
    return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
  },

  /* ---- GitHub API ---- */
  async api(path, options = {}) {
    const c = this.cfg();
    const res = await fetch(`https://api.github.com/repos/${c.owner}/${c.repo}/${path}`, {
      ...options,
      headers: {
        Authorization: "Bearer " + c.token,
        Accept: "application/vnd.github+json",
        ...(options.headers || {})
      }
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const err = new Error(this.explain(res.status, body.message));
      err.status = res.status;          // findConfig осыны қарайды
      throw err;
    }
    return res.json();
  },

  explain(status, message) {
    if (status === 401) return "Токен жарамсыз немесе мерзімі өткен";
    if (status === 403) return "Токенде бұл репозиторийге жазу құқығы жоқ";
    if (status === 404) return "Репозиторий не файл табылмады — атауын тексер";
    if (status === 409) return "Файл бұл аралықта өзгеріпті — қайта байқап көр";
    return message || ("GitHub қатесі: " + status);
  },

  /** config.js қай жерде жатқанын өзі табады:
   *  қалталы құрылымда js/config.js, жалпақ құрылымда config.js */
  async findConfig() {
    const tried = [];
    for (const path of ["js/config.js", "config.js"]) {
      try { return { ...(await this.getFile(path)), path }; }
      catch (err) {
        // Файл жоқ болса ғана келесісін қараймыз.
        // Токен қате, құқық жоқ деген қателерді жасырмаймыз.
        if (err.status !== 404) throw err;
        tried.push(path);
      }
    }
    throw new Error("config.js табылмады (қаралғаны: " + tried.join(", ") + ")");
  },

  async getFile(path) {
    const c = this.cfg();
    const data = await this.api(`contents/${path}?ref=${c.branch}`);
    return { text: this.decode(data.content), sha: data.sha };
  },

  async putFile(path, text, sha, message) {
    const c = this.cfg();
    return this.api(`contents/${path}`, {
      method: "PUT",
      body: JSON.stringify({
        message,
        content: this.encode(text),
        sha,
        branch: c.branch
      })
    });
  },

  /* ---- Каталогты config.js ішіне жазу ---- */

  /** Ескі SEED_DRAMAS блогын жаңасымен алмастырып, нұсқасын өсіру */
  patchConfig(source, catalogCode) {
    const start = source.indexOf("const SEED_DRAMAS");
    if (start === -1) throw new Error("config.js ішінен SEED_DRAMAS табылмады");

    // Блоктың соңы — жол басындағы "];"
    const end = source.indexOf("\n];", start);
    if (end === -1) throw new Error("SEED_DRAMAS блогының соңы табылмады");

    let out = source.slice(0, start) + catalogCode + source.slice(end + 3);

    // Кэш жаңарсын деп нұсқаны өсіреміз
    out = out.replace(/const CATALOG_VERSION = (\d+);/,
      (_, n) => `const CATALOG_VERSION = ${+n + 1};`);

    return out;
  },

  /** Толық жариялау. onStep — әр қадамды хабарлау үшін. */
  async run(catalogCode, onStep = () => {}) {
    onStep("config.js оқылуда…");
    const file = await this.findConfig();

    onStep("Каталог жаңартылуда…");
    const updated = this.patchConfig(file.text, catalogCode);

    if (updated === file.text) {
      onStep("Өзгеріс жоқ — бәрі бұрыннан бірдей.");
      return { changed: false };
    }

    onStep("GitHub-қа жіберілуде…");
    await this.putFile(file.path, updated, file.sha,
      `Каталог жаңартылды (${new Date().toLocaleString("kk-KZ")})`);

    onStep("Дайын! GitHub Pages 1-3 минутта қайта құрастырады.");
    return { changed: true };
  }
};
