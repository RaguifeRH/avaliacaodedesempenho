/* ============================================================
   CAMADA DE DADOS
   Mesma interface para o Firebase (produção) e para o modo
   demonstração (localStorage). O resto do sistema só usa DB e AUTH.
   ============================================================ */
(function () {
  const FB_VER = "10.12.0";
  const cfg = window.FIREBASE_CONFIG || {};
  const MODO = cfg.apiKey && cfg.projectId ? "firebase" : "demo";
  window.MODO_DADOS = MODO;

  function loadScript(src) {
    return new Promise((ok, err) => {
      const s = document.createElement("script");
      s.src = src; s.onload = ok; s.onerror = () => err(new Error("Falha ao carregar " + src));
      document.head.appendChild(s);
    });
  }
  const clone = (o) => JSON.parse(JSON.stringify(o));

  /* ---------------- FIREBASE ---------------- */
  async function initFirebase() {
    const base = `https://cdn.jsdelivr.net/npm/firebase@${FB_VER}/`;
    await loadScript(base + "firebase-app-compat.js");
    await loadScript(base + "firebase-auth-compat.js");
    await loadScript(base + "firebase-firestore-compat.js");
    const app = firebase.initializeApp(cfg);
    const fs = app.firestore();
    const auth = app.auth();
    let sec = null; // app secundário: cria contas sem derrubar a sessão do RH

    const DB = {
      async get(col, id) {
        const d = await fs.collection(col).doc(id).get();
        return d.exists ? { id: d.id, ...d.data() } : null;
      },
      async list(col, where = []) {
        let q = fs.collection(col);
        where.forEach(([f, op, v]) => (q = q.where(f, op, v)));
        const s = await q.get();
        return s.docs.map((d) => ({ id: d.id, ...d.data() }));
      },
      async set(col, id, data, merge = false) {
        await fs.collection(col).doc(id).set(data, { merge });
      },
      async update(col, id, data) {
        await fs.collection(col).doc(id).update(data);
      },
      async add(col, data) {
        const r = await fs.collection(col).add(data);
        return r.id;
      },
      async del(col, id) {
        await fs.collection(col).doc(id).delete();
      },
      /* ops: [{op:'set'|'update'|'delete', col, id, data, merge}] — em lotes de 400 */
      async batch(ops, onProg) {
        for (let i = 0; i < ops.length; i += 400) {
          const b = fs.batch();
          ops.slice(i, i + 400).forEach((o) => {
            const ref = fs.collection(o.col).doc(o.id);
            if (o.op === "delete") b.delete(ref);
            else if (o.op === "update") b.update(ref, o.data);
            else b.set(ref, o.data, { merge: !!o.merge });
          });
          await b.commit();
          onProg && onProg(Math.min(i + 400, ops.length), ops.length);
        }
      },
    };

    const AUTH = {
      onChange(cb) { auth.onAuthStateChanged((u) => cb(u ? { uid: u.uid } : null)); },
      async login(email, senha) { await auth.signInWithEmailAndPassword(email, senha); },
      async logout() { await auth.signOut(); },
      async changePassword(nova) { await auth.currentUser.updatePassword(nova); },
      async createUser(email, senha) {
        if (!sec) sec = firebase.initializeApp(cfg, "secundario");
        const r = await sec.auth().createUserWithEmailAndPassword(email, senha);
        const uid = r.user.uid;
        await sec.auth().signOut();
        return uid;
      },
      /* conta do próprio usuário (setup inicial) */
      async createSelf(email, senha) {
        const r = await auth.createUserWithEmailAndPassword(email, senha);
        return r.user.uid;
      },
      /* link de criação/recuperação de senha (só contas com e-mail real: administradores) */
      async resetPassword(email) { auth.languageCode = "pt-BR"; await auth.sendPasswordResetEmail(email); },
      currentUid() { return auth.currentUser ? auth.currentUser.uid : null; },
    };
    return { DB, AUTH };
  }

  /* ---------------- DEMONSTRAÇÃO (localStorage) ---------------- */
  function initDemo() {
    const KEY = "avaliacao_raguife_demo_v1";
    const SKEY = "avaliacao_raguife_demo_sessao";
    let mem;
    try { mem = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { mem = null; }
    if (!mem) mem = { cols: {}, users: {} };
    let pend = null;
    const flush = () => { pend = null; try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) { /* sem storage: fica em memória */ } };
    const save = () => { if (!pend) pend = setTimeout(flush, 80); };
    window.addEventListener("beforeunload", () => pend && (clearTimeout(pend), flush()));
    const col = (c) => (mem.cols[c] = mem.cols[c] || {});
    let seq = Date.now();
    const newId = () => "d" + (seq++).toString(36);
    const tick = () => new Promise((r) => setTimeout(r, 0));
    const match = (d, [f, op, v]) => {
      const x = d[f];
      if (op === "==") return x === v;
      if (op === "!=") return x !== v;
      if (op === "in") return v.includes(x);
      if (op === "array-contains") return Array.isArray(x) && x.includes(v);
      if (op === ">=") return x >= v;
      if (op === "<=") return x <= v;
      return true;
    };
    const merge = (a, b) => Object.assign({}, a || {}, b);

    const DB = {
      async get(c, id) { await tick(); const d = col(c)[id]; return d ? { id, ...clone(d) } : null; },
      async list(c, where = []) {
        await tick();
        return Object.entries(col(c)).filter(([, d]) => where.every((w) => match(d, w))).map(([id, d]) => ({ id, ...clone(d) }));
      },
      async set(c, id, data, m = false) { col(c)[id] = m ? merge(col(c)[id], clone(data)) : clone(data); save(); },
      async update(c, id, data) {
        if (!col(c)[id]) throw new Error("Documento não encontrado: " + c + "/" + id);
        col(c)[id] = merge(col(c)[id], clone(data)); save();
      },
      async add(c, data) { const id = newId(); col(c)[id] = clone(data); save(); return id; },
      async del(c, id) { delete col(c)[id]; save(); },
      async batch(ops, onProg) {
        ops.forEach((o) => {
          if (o.op === "delete") delete col(o.col)[o.id];
          else if (o.op === "update") col(o.col)[o.id] = merge(col(o.col)[o.id], clone(o.data));
          else col(o.col)[o.id] = o.merge ? merge(col(o.col)[o.id], clone(o.data)) : clone(o.data);
        });
        save(); onProg && onProg(ops.length, ops.length); await tick();
      },
    };

    let listener = null;
    let sess = null;
    try { sess = sessionStorage.getItem(SKEY); } catch (e) { sess = null; }
    const fire = () => listener && listener(sess ? { uid: sess } : null);
    const setSess = (uid) => { sess = uid; try { uid ? sessionStorage.setItem(SKEY, uid) : sessionStorage.removeItem(SKEY); } catch (e) {} fire(); };
    const err = (code) => { const e = new Error(code); e.code = code; return e; };

    const AUTH = {
      onChange(cb) { listener = cb; setTimeout(fire, 0); },
      async login(email, senha) {
        await tick();
        const u = mem.users[email];
        if (!u || u.senha !== senha) throw err("auth/invalid-credential");
        setSess(u.uid);
      },
      async logout() { setSess(null); },
      async changePassword(nova) {
        const e = Object.keys(mem.users).find((k) => mem.users[k].uid === sess);
        if (e) { mem.users[e].senha = nova; save(); }
      },
      async createUser(email, senha) {
        if (mem.users[email]) throw err("auth/email-already-in-use");
        const uid = "u" + newId();
        mem.users[email] = { uid, senha }; save();
        return uid;
      },
      async createSelf(email, senha) { const uid = await AUTH.createUser(email, senha); setSess(uid); return uid; },
      async resetPassword() { throw err("demo/sem-email"); },
      currentUid() { return sess; },
      /* só no modo demonstração */
      resetDemo() { try { localStorage.removeItem(KEY); sessionStorage.removeItem(SKEY); } catch (e) {} location.reload(); },
    };
    return Promise.resolve({ DB, AUTH });
  }

  window.initStore = async function () {
    const r = MODO === "firebase" ? await initFirebase() : await initDemo();
    window.DB = r.DB;
    window.AUTH = r.AUTH;
    return MODO;
  };
})();
