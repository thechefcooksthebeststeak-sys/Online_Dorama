/* ═══════════════════════════════════════════════
   store.js — дерек қабаты
   Firebase баптаулары толтырылса → Firestore + Auth
   толтырылмаса → localStorage (демо режим)
   Екі жағдайда да API бірдей: DB.dramas(), DB.login()...
   ═══════════════════════════════════════════════ */

const HAS_FIREBASE =
  !!FIREBASE_CONFIG.apiKey && !!FIREBASE_CONFIG.projectId && typeof firebase !== "undefined";

let fbAuth = null, fbDb = null;

if (HAS_FIREBASE) {
  firebase.initializeApp(FIREBASE_CONFIG);
  fbAuth = firebase.auth();
  fbDb = firebase.firestore();
}

/* ── localStorage көмекшілері ─────────────────── */
const LS = {
  get(key, fallback) {
    try { const v = localStorage.getItem("dh:" + key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem("dh:" + key, JSON.stringify(value)); } catch {}
  },
  del(key) { try { localStorage.removeItem("dh:" + key); } catch {} }
};

const uid = () => Math.random().toString(36).slice(2, 10);

/* ── Дерекқор ─────────────────────────────────── */
/* ═══════════════════════════════════════════════
   sha256 — құпия кодты тексеру үшін
   crypto.subtle тек https/localhost-та жұмыс істейді,
   сондықтан таза JS нұсқасы да қасында тұр.
   ═══════════════════════════════════════════════ */
async function sha256(text) {
  if (crypto?.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
  }
  return sha256Js(text);
}

/** crypto.subtle жоқ жерге (file://, content://) арналған нұсқа */
function sha256Js(text) {
  const K = [], H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  for (let i = 0, n = 2; i < 64; n++) {                    // алғашқы 64 жай санның түбірлері
    let prime = true;
    for (let d = 2; d * d <= n; d++) if (n % d === 0) { prime = false; break; }
    if (prime) K[i++] = Math.floor((Math.cbrt(n) % 1) * 2 ** 32);
  }

  const bytes = [...new TextEncoder().encode(text)];
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i--) bytes.push((bitLen / 2 ** (8 * i)) & 0xff);

  const rotr = (x, n) => (x >>> n) | (x << (32 - n));

  for (let i = 0; i < bytes.length; i += 64) {
    const w = new Uint32Array(64);
    for (let j = 0; j < 16; j++)
      w[j] = (bytes[i+j*4] << 24) | (bytes[i+j*4+1] << 16) | (bytes[i+j*4+2] << 8) | bytes[i+j*4+3];
    for (let j = 16; j < 64; j++) {
      const s0 = rotr(w[j-15],7) ^ rotr(w[j-15],18) ^ (w[j-15] >>> 3);
      const s1 = rotr(w[j-2],17) ^ rotr(w[j-2],19)  ^ (w[j-2] >>> 10);
      w[j] = (w[j-16] + s0 + w[j-7] + s1) >>> 0;
    }
    let [a,b,c,d,e,f,g,h] = H;
    for (let j = 0; j < 64; j++) {
      const S1 = rotr(e,6) ^ rotr(e,11) ^ rotr(e,25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[j] + w[j]) >>> 0;
      const S0 = rotr(a,2) ^ rotr(a,13) ^ rotr(a,22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h=g; g=f; f=e; e=(d+t1)>>>0; d=c; c=b; b=a; a=(t1+t2)>>>0;
    }
    [a,b,c,d,e,f,g,h].forEach((v, k) => H[k] = (H[k] + v) >>> 0);
  }
  return H.map(v => v.toString(16).padStart(8, "0")).join("");
}

/* ═══════════════════════════════════════════════
   Img — суреттер қоймасы (IndexedDB)
   localStorage-ға қарағанда ондаған есе кең әрі
   base64 емес, Blob түрінде сақтайды (33% үнемді).
   IndexedDB жоқ болса — base64-ке қайта түседі.
   ═══════════════════════════════════════════════ */
const Img = {
  _db: null,
  _urls: new Map(),          // "idb:abc" → blob: сілтемесі

  async init() {
    try {
      this._db = await new Promise((resolve, reject) => {
        if (!indexedDB) return reject(new Error("IndexedDB жоқ"));
        const req = indexedDB.open("doramahub", 1);
        req.onupgradeneeded = () => req.result.createObjectStore("images");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      await this._loadAll();
    } catch (err) {
      console.warn("IndexedDB қолжетімсіз, base64 режимі:", err.message);
      this._db = null;
    }
  },

  get available() { return !!this._db; },

  _tx(mode) { return this._db.transaction("images", mode).objectStore("images"); },

  /** Барлық суретті бір рет жадқа жүктеп, blob: сілтемелерін дайындау */
  _loadAll() {
    return new Promise(resolve => {
      const req = this._tx("readonly").openCursor();
      req.onsuccess = e => {
        const cur = e.target.result;
        if (!cur) return resolve();
        this._urls.set("idb:" + cur.key, URL.createObjectURL(cur.value));
        cur.continue();
      };
      req.onerror = () => resolve();
    });
  },

  /** Blob сақтап, "idb:xxx" кілтін қайтарады */
  async put(blob) {
    if (!this._db) return null;
    const key = uid() + uid();
    await new Promise((resolve, reject) => {
      const req = this._tx("readwrite").put(blob, key);
      req.onsuccess = resolve;
      req.onerror = () => reject(req.error);
    });
    const ref = "idb:" + key;
    this._urls.set(ref, URL.createObjectURL(blob));
    return ref;
  },

  /** Сақтауға жарамды сілтемеге айналдыру (тегте осыны қолданамыз) */
  url(src) {
    if (!src) return "";
    return src.startsWith("idb:") ? (this._urls.get(src) || "") : src;
  },

  async remove(src) {
    if (!src || !src.startsWith("idb:") || !this._db) return;
    const url = this._urls.get(src);
    if (url) { URL.revokeObjectURL(url); this._urls.delete(src); }
    this._tx("readwrite").delete(src.slice(4));
  },

  /** IndexedDB-дегі суретті base64 түрінде алу (файлға көшіру үшін) */
  async dataUrl(ref) {
    if (!ref) return "";
    if (!ref.startsWith("idb:")) return ref;
    if (!this._db) return "";
    const blob = await new Promise(res => {
      const req = this._tx("readonly").get(ref.slice(4));
      req.onsuccess = () => res(req.result);
      req.onerror = () => res(null);
    });
    if (!blob) return "";
    return new Promise(res => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => res("");
      r.readAsDataURL(blob);
    });
  },

  /** Қанша орын алғанын шамалау */
  async usage() {
    try {
      const est = await navigator.storage.estimate();
      return { used: est.usage || 0, quota: est.quota || 0 };
    } catch { return null; }
  }
};

const DB = {
  mode: HAS_FIREBASE ? "firebase" : "demo",
  _cache: null,
  _listeners: [],

  onChange(fn) { this._listeners.push(fn); },
  _emit() { this._cache = null; this._listeners.forEach(fn => fn()); },

  /* ---- Дорамалар ---- */
  async dramas() {
    if (this._cache) return this._cache;

    if (HAS_FIREBASE) {
      let list = [];
      try {
        const snap = await fbDb.collection("dramas").get();
        list = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        if (!list.length) {                    // дерекқор бос → бастапқы деректі жүктеу
          const batch = fbDb.batch();
          SEED_DRAMAS.forEach(d => batch.set(fbDb.collection("dramas").doc(), d));
          await batch.commit();
          const again = await fbDb.collection("dramas").get();
          list = again.docs.map(d => ({ id: d.id, ...d.data() }));
        }
      } catch (err) {
        console.warn("Firestore-дан дорама алынбады, уақытша тізім:", err.code || err.message);
        list = SEED_DRAMAS.map(d => ({ id: uid(), ...d }));
      }
      this._cache = list.map(normalize);
      return this._cache;
    }

    // Файлдағы каталог жаңарса, браузердегі ескі көшірмені тастаймыз
    let list = LS.get("dramas", null);
    if (!list || LS.get("catalogVersion", 0) !== CATALOG_VERSION) {
      list = SEED_DRAMAS.map(d => ({ id: uid(), ...d }));
      LS.set("dramas", list);
      LS.set("catalogVersion", CATALOG_VERSION);
    }
    this._cache = list.map(normalize);
    return this._cache;
  },

  async drama(id) {
    const all = await this.dramas();
    return all.find(d => d.id === id) || null;
  },

  async addDrama(data) {
    if (HAS_FIREBASE) await fbDb.collection("dramas").add(data);
    else { const list = LS.get("dramas", []); list.unshift({ id: uid(), ...data }); LS.set("dramas", list); }
    this._emit();
  },

  async updateDrama(id, data) {
    if (HAS_FIREBASE) await fbDb.collection("dramas").doc(id).update(data);
    else {
      const list = LS.get("dramas", []);
      const i = list.findIndex(d => d.id === id);
      if (i > -1) list[i] = { ...list[i], ...data };
      LS.set("dramas", list);
    }
    this._emit();
  },

  async removeDrama(id) {
    if (HAS_FIREBASE) await fbDb.collection("dramas").doc(id).delete();
    else LS.set("dramas", LS.get("dramas", []).filter(d => d.id !== id));
    this._emit();
  },

  /* ---- Тапсырыстар ---- */
  /** Тапсырыс жасау. Төлем WhatsApp арқылы қолмен расталады,
   *  сондықтан жаңа тапсырыс бірден «Күтілуде» болып тұрады. */
  async createOrder(order) {
    const rec = {
      id: "DH-" + Date.now().toString(36).toUpperCase(),
      createdAt: Date.now(),
      status: "Күтілуде",
      ...order
    };

    if (HAS_FIREBASE) {
      try { await fbDb.collection("orders").doc(rec.id).set(rec); }
      catch (err) { console.warn("Тапсырыс жазылмады:", err.code || err.message); }
    } else {
      const orders = LS.get("orders", []); orders.unshift(rec); LS.set("orders", orders);
    }
    this._emit();
    return rec;
  },

  /** Тапсырыс күйін өзгерту. «Төленді» болса — дорамалар
   *  сатып алушының кітапханасына қосылады. */
  async setOrderStatus(id, status) {
    let rec = null;

    if (HAS_FIREBASE) {
      try {
        const doc = await fbDb.collection("orders").doc(id).get();
        rec = doc.data();
        await fbDb.collection("orders").doc(id).update({ status });
      } catch (err) { console.warn("Күй өзгертілмеді:", err.code || err.message); }
    } else {
      const orders = LS.get("orders", []);
      rec = orders.find(o => o.id === id);
      if (rec) { rec.status = status; LS.set("orders", orders); }
    }

    if (status === "Төленді" && rec && rec.userId) await this._grant(rec);
    this._emit();
  },

  /** Дорамаларды пайдаланушының кітапханасына қосу */
  async _grant(rec) {
    const ids = rec.items.map(i => i.id);

    if (HAS_FIREBASE) {
      try {
        await fbDb.collection("users").doc(rec.userId).set(
          { purchases: firebase.firestore.FieldValue.arrayUnion(...ids) }, { merge: true });
      } catch (err) { console.warn("Кітапхана жаңартылмады:", err.code || err.message); }
    } else {
      const users = LS.get("users", []);
      const u = users.find(x => x.id === rec.userId);
      if (u) {
        u.purchases = Array.from(new Set([...(u.purchases || []), ...ids]));
        LS.set("users", users);
      }
    }

    if (Auth.user && Auth.user.id === rec.userId)
      Auth.user.purchases = Array.from(new Set([...(Auth.user.purchases || []), ...ids]));
  },

  /** Дорама ашылған сайын санағышты өсіру.
   *  Демо режимде — браузерде, Firebase-те — stats жинағында. */
  async trackView(id) {
    const local = LS.get("views", {});
    local[id] = (local[id] || 0) + 1;
    LS.set("views", local);

    if (HAS_FIREBASE) {
      try {
        await fbDb.collection("stats").doc(id).set(
          { views: firebase.firestore.FieldValue.increment(1) }, { merge: true });
      } catch (err) { console.warn("Қаралым жазылмады:", err.code || err.message); }
    }
  },

  /** { dramaId: саны } картасын қайтарады */
  async views() {
    if (HAS_FIREBASE) {
      try {
        const snap = await fbDb.collection("stats").get();
        const map = {};
        snap.docs.forEach(d => map[d.id] = d.data().views || 0);
        return map;
      } catch (err) { console.warn("Қаралымдар оқылмады:", err.code || err.message); }
    }
    return LS.get("views", {});
  },

  async orders(userId) {
    if (HAS_FIREBASE) {
      try {
        let q = fbDb.collection("orders");
        if (userId) q = q.where("userId", "==", userId);
        const snap = await q.get();
        return snap.docs.map(d => d.data()).sort((a, b) => b.createdAt - a.createdAt);
      } catch (err) {
        console.warn("Тапсырыстар оқылмады:", err.code || err.message);
        return [];
      }
    }
    const all = LS.get("orders", []);
    return userId ? all.filter(o => o.userId === userId) : all;
  },

  /* ---- Пайдаланушылар (админ панелі үшін) ---- */
  async users() {
    if (HAS_FIREBASE) {
      try {
        const snap = await fbDb.collection("users").get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (err) {
        console.warn("Пайдаланушылар оқылмады:", err.code || err.message);
        return [];
      }
    }
    return LS.get("users", []);
  },

  async removeUser(id) {
    if (HAS_FIREBASE) await fbDb.collection("users").doc(id).delete();
    else LS.set("users", LS.get("users", []).filter(u => u.id !== id));
  }
};

/** Дорама жазбасын толықтыру (постер жоқ болса — жасаймыз) */
function normalize(d, i) {
  return {
    ...d,
    genres: d.genres || [],
    images: d.images || [],
    mood: d.mood || [],
    alt: d.alt || [],
    trailer: d.trailer || "",
    price: Number(d.price) || 0,
    rating: Number(d.rating) || 0,
    episodes: Number(d.episodes) || 0,
    poster: d.poster && d.poster.trim() ? d.poster.trim() : makePoster(d.title, (d.title || "").length + (d.year || 0))
  };
}

/* ── Аутентификация ───────────────────────────── */
const Auth = {
  user: null,
  _listeners: [],

  onChange(fn) { this._listeners.push(fn); fn(this.user); },
  _emit() { this._listeners.forEach(fn => fn(this.user)); },

  isAdmin() { return !!this.user && this.user.email === SHOP.adminEmail; },

  /** Firebase пайдаланушысынан профиль жинау.
   *  Firestore қолжетімсіз болса да кіру бұзылмауы керек. */
  async _hydrate(fu) {
    let data = {};
    try {
      const doc = await fbDb.collection("users").doc(fu.uid).get();
      if (doc.exists) data = doc.data();
    } catch (err) {
      console.warn("Firestore профилі оқылмады:", err.code || err.message);
    }
    this.user = {
      id: fu.uid,
      email: fu.email,
      name: data.name || fu.displayName
            || (this.user && this.user.id === fu.uid ? this.user.name : null)
            || fu.email.split("@")[0],
      purchases: data.purchases || []
    };
  },

  async init() {
    if (HAS_FIREBASE) {
      return new Promise(resolve => {
        let done = false;
        fbAuth.onAuthStateChanged(async fu => {
          try {
            if (fu) await this._hydrate(fu);
            else this.user = null;
          } catch (err) {
            console.warn("Auth күйі:", err);
            this.user = fu ? { id: fu.uid, email: fu.email, name: fu.email.split("@")[0], purchases: [] } : null;
          }
          this._emit();
          if (!done) { done = true; resolve(); }
        });
      });
    }
    const savedId = LS.get("session", null);
    if (savedId === "admin") this.user = { id: "admin", name: "Админ", email: SHOP.adminEmail, purchases: [] };
    else if (savedId) this.user = LS.get("users", []).find(u => u.id === savedId) || null;
    this._emit();
  },

  async signup(name, email, password) {
    if (HAS_FIREBASE) {
      const cred = await fbAuth.createUserWithEmailAndPassword(email, password);

      // Есімді бірден Auth-қа жазамыз — Firestore істемей қалса да сақталады
      try { await cred.user.updateProfile({ displayName: name }); } catch {}

      // Кіру осы жерде аяқталады: Firestore сәтсіз болса да пайдаланушы кірген болып саналады
      this.user = { id: cred.user.uid, email: cred.user.email, name, purchases: [] };
      this._emit();

      try {
        await fbDb.collection("users").doc(cred.user.uid)
          .set({ name, email, purchases: [], createdAt: Date.now() });
      } catch (err) {
        console.warn("Профиль Firestore-ға жазылмады:", err.code || err.message);
      }
      return;
    }
    const users = LS.get("users", []);
    if (users.some(u => u.email === email)) throw new Error("Бұл email тіркелген");
    const u = { id: uid(), name, email, password, purchases: [], createdAt: Date.now() };
    users.push(u); LS.set("users", users); LS.set("session", u.id);
    this.user = u; this._emit();
  },

  async login(email, password) {
    if (HAS_FIREBASE) {
      const cred = await fbAuth.signInWithEmailAndPassword(email, password);
      await this._hydrate(cred.user);   // Firestore істемесе де кіреміз
      this._emit();
      return;
    }

    const users = LS.get("users", []);
    const u = users.find(x => x.email === email && x.password === password);
    if (!u) throw new Error("Email не құпиясөз қате");
    LS.set("session", u.id); this.user = u; this._emit();
  },

  /** Админ панеліне бір ғана код арқылы кіру.
   *  Firebase қосулы болса — код сол әкімші аккаунтының құпиясөзі,
   *  яғни тексеруді сервер жүргізеді (айналып өту мүмкін емес).
   *  Firebase жоқ болса — код хэші жергілікті салыстырылады. */
  async loginWithCode(code) {
    if (HAS_FIREBASE) {
      const cred = await fbAuth.signInWithEmailAndPassword(SHOP.adminEmail, code);
      await this._hydrate(cred.user);
      this._emit();
      return;
    }

    if (await sha256(code) !== SHOP.adminCodeHash) throw new Error("Код қате");

    this.user = { id: "admin", name: "Админ", email: SHOP.adminEmail, purchases: [] };
    LS.set("session", "admin");
    this._emit();
  },

  async logout() {
    if (HAS_FIREBASE) await fbAuth.signOut();
    else { LS.del("session"); this.user = null; this._emit(); }
  },

  async updateProfile(patch) {
    if (!this.user) return;
    if (HAS_FIREBASE) await fbDb.collection("users").doc(this.user.id).set(patch, { merge: true });
    else {
      const users = LS.get("users", []);
      const i = users.findIndex(u => u.id === this.user.id);
      if (i > -1) { users[i] = { ...users[i], ...patch }; LS.set("users", users); }
    }
    this.user = { ...this.user, ...patch };
    this._emit();
  }
};

/* ── Себет ────────────────────────────────────── */
const Cart = {
  items: LS.get("cart", []),
  _listeners: [],

  onChange(fn) { this._listeners.push(fn); fn(this.items); },
  _save() { LS.set("cart", this.items); this._listeners.forEach(fn => fn(this.items)); },

  has(id) { return this.items.some(i => i.id === id); },
  count() { return this.items.length; },
  total() { return this.items.reduce((s, i) => s + i.price, 0); },

  add(drama) {
    if (this.has(drama.id)) return false;
    this.items.push({ id: drama.id, title: drama.title, price: drama.price, poster: drama.poster });
    this._save(); return true;
  },
  remove(id) { this.items = this.items.filter(i => i.id !== id); this._save(); },
  clear() { this.items = []; this._save(); }
};
