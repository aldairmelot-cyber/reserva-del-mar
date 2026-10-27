/*
 * plataforma.js — reemplaza la API window.claude que la app usaba dentro de claude.ai.
 *
 * Ofrece las capacidades con la misma forma que la app ya espera:
 *   use("db")          → base de datos tipo Firestore (doc/collection, get/set/update/delete/onSnapshot)
 *   use("user")        → quién está conectado (id, nombre) y nombres de quienes cargaron cada periodo
 *   use("assets")      → guarda los archivos originales que se suben (balances, auxiliares, PDF…)
 *   use("downloads")   → guardar archivos (PDF, Excel) con la descarga normal del navegador
 *   use("permissions") → permisos siempre concedidos (no hay panel de permisos fuera de claude.ai)
 *
 * Modos (se elige en config.js):
 *   - "local":    los datos quedan en el navegador de cada persona (IndexedDB). Sin servidor.
 *   - "firebase": los datos quedan en Firestore y los comparte todo el equipo, con inicio de sesión
 *                 de Google y lista de correos autorizados (ver firestore.rules).
 *
 * En Firestore cada documento se guarda como texto JSON en el campo `j`, porque la app usa
 * tablas dentro de tablas (listas de listas), que Firestore no admite directamente.
 */
(function () {
  "use strict";
  const CFG = window.APP_CONFIG || {};
  const MODO = CFG.firebase && CFG.firebase.apiKey ? "firebase" : "local";
  const clon = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));

  /* Colecciones de la app (para respaldar y restaurar). */
  const COLECCIONES = [
    "config", "mapeos", "periodos", "balances", "aclaraciones", "acl_pdf",
    "presupuesto", "presupuesto_notas", "retencion", "retencion_pdf", "iva", "ica",
    "prorrateo_cfg", "prorrateo_mes", "cartera", "cartera_c", "cartera_p",
    "cman_raw", "cman_idx", "cman_seg", "cman_cfg", "cbl_raw", "cbl_idx", "cbl_seg",
    "dianv", "dianv_aux", "dianv_cfg", "dianv_idx", "dianv_notas",
    "verif_idx", "verif_raw", "fondo_cfg", "archivos_cargados", "_archivos", "_archivos_partes", "_usuarios", "_roles", "firmas",
  ];

  /* ------------------------------------------------------------------ perfiles */
  /* editor: el contador (correos en config.js → editores); los demás perfiles son de consulta
     y se asignan en la app (Datos → Usuarios y perfiles), guardados en _roles/<correo>. */
  const PERFILES = { editor: "Contador · editor", consejo: "Consejo de Administración", revisor: "Revisoría Fiscal", admin: "Administración" };
  let perfil = { rol: "editor", nombre: "", email: "" };
  function fijarPerfil(p) { perfil = p; window.EFPH_PERFIL = Object.freeze({ ...p, etiqueta: PERFILES[p.rol] || p.rol }); }
  const esEditor = () => perfil.rol === "editor";
  const puedeEscribir = (ruta) => esEditor() || String(ruta).startsWith("_usuarios/") || (!!perfil.firma && String(ruta).startsWith("firmas/"));
  const sinPermiso = () => { const e = new Error("Su perfil es de solo consulta."); e.code = "not_granted"; return e; };
  const negado = (e) => !!e && (e.code === "permission-denied" || e.code === "not_granted");
  if (MODO === "local") {
    let r = null; try { r = new URLSearchParams(location.search).get("perfil"); } catch (e) {}
    let fq = null; try { fq = new URLSearchParams(location.search).get("firma"); } catch (e) {}
    fijarPerfil({ rol: PERFILES[r] ? r : "editor", nombre: PERFILES[r] && r !== "editor" ? "Prueba " + PERFILES[r] : "Este equipo", email: PERFILES[r] && r !== "editor" ? "prueba-" + r + "@local" : "", firma: fq || (r === "admin" ? "representante" : r === "revisor" ? "revisor" : "") });
  }

  /* ------------------------------------------------------------------ descargas */
  const downloads = {
    async save({ filename, data }) {
      const blob = data instanceof Blob ? data : new Blob([data], { type: tipoMime(filename) });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.style.display = "none";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    },
  };
  function tipoMime(n) {
    const e = (n.split(".").pop() || "").toLowerCase();
    return { pdf: "application/pdf", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", json: "application/json", csv: "text/csv", zip: "application/zip" }[e] || "application/octet-stream";
  }

  const permissions = {
    async state(n) { return n ? "granted" : {}; },
    async request(lista) { return Object.fromEntries((lista || []).map((k) => [k, "granted"])); },
    async manage() {},
  };

  /* ------------------------------------------------------------------ BD local (IndexedDB) */
  function crearDBLocal() {
    const NOMBRE = "estados-financieros-ph", STORE = "docs";
    const cache = new Map();
    const oyentes = new Set();
    const canal = "BroadcastChannel" in window ? new BroadcastChannel(NOMBRE) : null;

    const abrir = new Promise((ok, mal) => {
      const r = indexedDB.open(NOMBRE, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => ok(r.result);
      r.onerror = () => mal(r.error);
    });
    const listo = abrir.then((idb) => new Promise((ok, mal) => {
      const req = idb.transaction(STORE, "readonly").objectStore(STORE).openCursor();
      req.onsuccess = () => { const c = req.result; if (c) { cache.set(c.key, c.value); c.continue(); } else ok(); };
      req.onerror = () => mal(req.error);
    }));
    async function escribir(ruta, valor) {
      const idb = await abrir;
      await new Promise((ok, mal) => {
        const tx = idb.transaction(STORE, "readwrite"), st = tx.objectStore(STORE);
        if (valor === undefined) st.delete(ruta); else st.put(valor, ruta);
        tx.oncomplete = ok; tx.onerror = () => mal(tx.error); tx.onabort = () => mal(tx.error);
      });
    }
    const docSnap = (ruta) => {
      const datos = cache.get(ruta);
      return { id: ruta.split("/").pop(), ref: { path: ruta }, exists: datos !== undefined, data: () => clon(datos), get: (k) => (datos ? clon(datos[k]) : undefined) };
    };
    const colSnap = (col) => {
      const docs = [...cache.keys()].filter((k) => k.startsWith(col + "/") && !k.slice(col.length + 1).includes("/")).sort().map(docSnap);
      return { docs, size: docs.length, empty: !docs.length, forEach: (f) => docs.forEach(f) };
    };
    function notificar(ruta) {
      const col = ruta.slice(0, ruta.lastIndexOf("/"));
      for (const o of oyentes) {
        if (o.tipo === "doc" && o.ruta === ruta) o.fn(docSnap(ruta));
        if (o.tipo === "col" && o.ruta === col) o.fn(colSnap(col));
      }
    }
    if (canal) canal.onmessage = (ev) => {
      const { ruta, valor } = ev.data || {};
      if (!ruta) return;
      if (valor === undefined) cache.delete(ruta); else cache.set(ruta, valor);
      notificar(ruta);
    };
    async function cambiar(ruta, valor) {
      await listo;
      valor = clon(valor);
      if (valor === undefined) cache.delete(ruta); else cache.set(ruta, valor);
      await escribir(ruta, valor);
      if (canal) canal.postMessage({ ruta, valor });
      notificar(ruta);
    }
    function suscribir(tipo, ruta, fn, err) {
      const o = { tipo, ruta, fn };
      listo.then(() => { oyentes.add(o); fn(tipo === "doc" ? docSnap(ruta) : colSnap(ruta)); }, (e) => err && err(e));
      return () => oyentes.delete(o);
    }
    const db = {
      doc(ruta) {
        return {
          id: ruta.split("/").pop(), path: ruta,
          get: () => listo.then(() => docSnap(ruta)),
          set: async (datos, opts) => { if (!puedeEscribir(ruta)) throw sinPermiso(); return cambiar(ruta, opts && opts.merge ? { ...(cache.get(ruta) || {}), ...datos } : datos); },
          update: async (datos) => { if (!puedeEscribir(ruta)) throw sinPermiso(); return cambiar(ruta, { ...(cache.get(ruta) || {}), ...datos }); },
          delete: async () => { if (!puedeEscribir(ruta)) throw sinPermiso(); return cambiar(ruta, undefined); },
          onSnapshot: (fn, err) => suscribir("doc", ruta, fn, err),
        };
      },
      collection(col) {
        return { doc: (id) => db.doc(col + "/" + id), get: () => listo.then(() => colSnap(col)), onSnapshot: (fn, err) => suscribir("col", col, fn, err) };
      },
      async exportar() { await listo; return Object.fromEntries([...cache.entries()].map(([k, v]) => [k, clon(v)])); },
      async importar(obj, reemplazar, avance) {
        await listo;
        if (reemplazar) for (const k of [...cache.keys()]) if (!(k in obj)) await cambiar(k, undefined);
        const L = Object.entries(obj); let n = 0;
        for (const [k, v] of L) { await cambiar(k, v); avance && avance(++n, L.length); }
      },
    };
    return db;
  }

  /* ------------------------------------------------------------------ BD compartida (Firebase) */
  const cargarScript = (src) => new Promise((ok, mal) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => mal(new Error("No se pudo cargar " + src)); document.head.appendChild(s); });

  /* Envoltura: la app ve objetos normales; en Firestore cada documento es { j: "<json>" }. */
  function envolverFirestore(fs) {
    /* _roles se guarda en campos simples: las reglas de seguridad leen su campo `rol`. */
    const enc = (d, ruta) => (/^(_roles|firmas)\//.test(String(ruta || "")) ? { ...(d || {}) } : { j: JSON.stringify(d === undefined ? null : d) });
    const vacioDoc = (ruta) => ({ id: ruta.split("/").pop(), ref: { path: ruta }, exists: false, data: () => undefined, get: () => undefined });
    const vacioCol = () => ({ docs: [], size: 0, empty: true, forEach: () => {} });
    const dec = (s) => { const x = s.data(); return x && typeof x.j === "string" ? JSON.parse(x.j) : x; };
    const snapDoc = (s) => ({ id: s.id, ref: { path: s.ref.path }, exists: s.exists, data: () => (s.exists ? dec(s) : undefined), get: (k) => (s.exists ? (dec(s) || {})[k] : undefined) });
    const snapCol = (q) => { const docs = q.docs.map(snapDoc); return { docs, size: docs.length, empty: !docs.length, forEach: (f) => docs.forEach(f) }; };
    const reintentar = async (f) => { try { return await f(); } catch (e) { if (e && (e.code === "unavailable" || e.code === "resource-exhausted")) { await new Promise((r) => setTimeout(r, 800 + Math.random() * 800)); return f(); } throw e; } };
    const db = {
      doc(ruta) {
        const r = fs.doc(ruta);
        return {
          id: r.id, path: ruta,
          get: async () => { try { return snapDoc(await r.get()); } catch (e) { if (negado(e)) return vacioDoc(ruta); throw e; } },
          set: async (datos, opts) => {
            if (!puedeEscribir(ruta)) throw sinPermiso();
            if (opts && opts.merge) { const s = await r.get(); datos = { ...(s.exists ? dec(s) : {}), ...datos }; }
            await reintentar(() => r.set(enc(datos, ruta)));
          },
          update: async (datos) => {
            if (!puedeEscribir(ruta)) throw sinPermiso();
            const s = await r.get();
            if (!s.exists) { const e = new Error("El documento no existe"); e.code = "not_found"; throw e; }
            await reintentar(() => r.set(enc({ ...dec(s), ...datos }, ruta)));
          },
          delete: async () => { if (!puedeEscribir(ruta)) throw sinPermiso(); return r.delete(); },
          onSnapshot: (fn, err) => r.onSnapshot((s) => fn(snapDoc(s)), err),
        };
      },
      collection(col) {
        const r = fs.collection(col);
        return {
          doc: (id) => db.doc(col + "/" + id),
          get: async () => { try { return snapCol(await r.get()); } catch (e) { if (negado(e)) return vacioCol(); throw e; } },
          onSnapshot: (fn, err) => r.onSnapshot((q) => fn(snapCol(q)), (e) => (negado(e) ? fn(vacioCol()) : err && err(e))),
        };
      },
      async exportar(avance) {
        const out = {}; let n = 0;
        for (const c of COLECCIONES) {
          const snap = await fs.collection(c).get();
          snap.forEach((d) => { out[c + "/" + d.id] = dec(d); });
          avance && avance(++n, COLECCIONES.length);
        }
        return out;
      },
      async importar(obj, reemplazar, avance) {
        if (reemplazar) {
          for (const c of COLECCIONES) {
            const snap = await fs.collection(c).get();
            for (const d of snap.docs) if (!((c + "/" + d.id) in obj)) await d.ref.delete();
          }
        }
        const L = Object.entries(obj); let n = 0;
        for (const [ruta, datos] of L) { await reintentar(() => fs.doc(ruta).set(enc(datos, ruta))); avance && avance(++n, L.length); }
      },
    };
    return db;
  }

  let promesaFirebase = null, usuarioActual = null;
  function crearDBFirebase() {
    if (promesaFirebase) return promesaFirebase;
    promesaFirebase = (async () => {
      const V = CFG.firebaseVersion || "10.12.2";
      const base = `https://www.gstatic.com/firebasejs/${V}/`;
      try {
        await cargarScript(base + "firebase-app-compat.js");
        await Promise.all([cargarScript(base + "firebase-auth-compat.js"), cargarScript(base + "firebase-firestore-compat.js")]);
      } catch (err) {
        avisoFatal("No se pudo conectar con el servidor de datos. Revise su conexión a internet y recargue la página.");
        throw err;
      }
      const app = firebase.initializeApp(CFG.firebase);
      const auth = app.auth();
      const fs = app.firestore();
      try { fs.settings({ ignoreUndefinedProperties: true, merge: true }); } catch (e) { /* ya configurado */ }
      try { await fs.enablePersistence({ synchronizeTabs: true }); } catch (e) { /* sin caché sin conexión */ }
      const salir = () => auth.signOut().then(() => location.reload());
      let usuario = await esperarSesion(auth);
      const editores = (CFG.editores || []).map((x) => String(x).toLowerCase());
      for (;;) {
        const email = String(usuario.email || "").toLowerCase();
        try {
          if (editores.includes(email)) {
            await fs.doc("config/entidad").get();
            fijarPerfil({ rol: "editor", nombre: usuario.displayName || email, email });
            break;
          }
          const s = await fs.doc("_roles/" + email).get();
          const d = s.exists ? s.data() : null;
          if (d && PERFILES[d.rol] && d.rol !== "editor") {
            fijarPerfil({ rol: d.rol, nombre: d.nombre || usuario.displayName || email, email, firma: d.rol !== "consejo" && ["representante", "contador", "revisor"].includes(d.firma) ? d.firma : "" });
            break;
          }
          await noAutorizado(usuario, auth); usuario = await esperarSesion(auth);
        } catch (err) {
          if (err && err.code === "permission-denied") { await noAutorizado(usuario, auth); usuario = await esperarSesion(auth); continue; }
          fijarPerfil({ rol: editores.includes(email) ? "editor" : "consejo", nombre: usuario.displayName || email, email });
          break;
        }
      }
      usuarioActual = usuario;
      const db = envolverFirestore(fs);
      db.doc("_usuarios/" + usuario.uid).set({ name: usuario.displayName || usuario.email || "", email: usuario.email || "", visto: new Date().toISOString() }, { merge: true }).catch(() => {});
      ponerUsuario(usuario, salir, db);
      return db;
    })();
    return promesaFirebase;
  }

  /* ------------------------------------------------------------------ usuario */
  async function crearUser() {
    const db = await obtenerDB();
    const cacheNombres = new Map();
    let id = "local", nombre = "Este equipo", correo = "";
    if (MODO === "firebase" && usuarioActual) { id = usuarioActual.uid; nombre = usuarioActual.displayName || usuarioActual.email || ""; correo = usuarioActual.email || ""; }
    return {
      async id() { return id; },
      async me() { return { id, name: nombre, email: correo }; },
      isOwner() { return esEditor(); },
      canEdit() { return esEditor(); },
      async can(n) { return n === "data.write" ? esEditor() : true; },
      perfil() { return window.EFPH_PERFIL || { rol: perfil.rol }; },
      async profiles(ids) {
        const out = {};
        await Promise.all((ids || []).map(async (u) => {
          if (!cacheNombres.has(u)) {
            let p = null; try { p = (await db.doc("_usuarios/" + u).get()).data(); } catch (e) {}
            cacheNombres.set(u, { id: u, name: (p && p.name) || (u === id ? nombre : ""), email: (p && p.email) || "" });
          }
          out[u] = cacheNombres.get(u);
        }));
        return out;
      },
      async search() { return []; },
    };
  }

  /* ------------------------------------------------------------------ archivos originales */
  /* Se guardan en la misma base, partidos en trozos de texto (sin Firebase Storage). */
  async function crearAssets() {
    const db = await obtenerDB(), T = 700000;
    const azar = () => Array.from(crypto.getRandomValues(new Uint8Array(16))).map((b) => b.toString(16).padStart(2, "0")).join("");
    return {
      async upload(blob, opts) {
        const texto = await blob.text(), id = azar(), n = Math.max(1, Math.ceil(texto.length / T));
        for (let i = 0; i < n; i++) await db.doc(`_archivos_partes/${id}_${i}`).set({ d: texto.slice(i * T, (i + 1) * T) });
        const tipo = (opts && opts.type) || blob.type || "text/plain";
        await db.doc("_archivos/" + id).set({ partes: n, bytes: texto.length, tipo, creado: new Date().toISOString() });
        return { id, url: "", sizeBytes: texto.length, contentType: tipo };
      },
      async leer(id) {
        const m = (await db.doc("_archivos/" + id).get()).data();
        if (!m) throw new Error("archivo no disponible");
        let s = "";
        for (let i = 0; i < m.partes; i++) { const p = (await db.doc(`_archivos_partes/${id}_${i}`).get()).data(); if (!p) throw new Error("falta una parte del archivo"); s += p.d; }
        return s;
      },
      async delete(id) {
        const m = (await db.doc("_archivos/" + id).get()).data();
        for (let i = 0; i < ((m && m.partes) || 0); i++) await db.doc(`_archivos_partes/${id}_${i}`).delete();
        await db.doc("_archivos/" + id).delete();
      },
      async list() {
        const s = await db.collection("_archivos").get();
        const assets = s.docs.map((d) => ({ id: d.id, url: "", sizeBytes: d.data().bytes, contentType: d.data().tipo }));
        return { assets, usage: { count: assets.length, bytes: assets.reduce((a, x) => a + (x.sizeBytes || 0), 0) } };
      },
    };
  }

  /* ------------------------------------------------------------------ avisos y portada */
  function avisoFatal(texto) {
    alCargar(() => {
      estilos(); quitarPortada();
      const d = document.createElement("div");
      d.id = "pf-portada"; d.className = "pf-portada";
      d.innerHTML = `<div class="pf-caja"><h2>Sin conexión</h2><p>${escapar(texto)}</p><button class="pf-btn" type="button">Recargar</button></div>`;
      d.querySelector("button").onclick = () => location.reload();
      document.body.appendChild(d);
    });
  }
  function noAutorizado(usuario, auth) {
    return new Promise((ok) => {
      alCargar(() => {
        estilos(); quitarPortada();
        const d = document.createElement("div");
        d.id = "pf-portada"; d.className = "pf-portada";
        d.innerHTML = `<div class="pf-caja"><h2>Acceso no autorizado</h2><p>La cuenta <b>${escapar(usuario.email || "")}</b> no tiene permiso para ver esta información. Pida al administrador que la agregue, o entre con otra cuenta.</p><button class="pf-btn" type="button">Usar otra cuenta</button></div>`;
        d.querySelector("button").onclick = async () => { await auth.signOut(); d.remove(); ok(); };
        document.body.appendChild(d);
      });
    });
  }
  function esperarSesion(auth) {
    return new Promise((ok) => {
      const parar = auth.onAuthStateChanged((u) => {
        if (u) { quitarPortada(); parar(); ok(u); }
        else mostrarPortada(auth);
      });
    });
  }

  const CSS = `
  .pf-portada{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;background:rgba(21,22,26,.78);font:15px/1.5 "Source Sans 3","Segoe UI",system-ui,sans-serif}
  .pf-caja{background:#fff;color:#262a33;border-radius:10px;border-top:4px solid #c08a45;padding:28px 26px;max-width:380px;width:calc(100% - 32px);text-align:center;box-shadow:0 10px 40px rgba(0,0,0,.3)}
  .pf-caja h2{margin:0 0 6px;font:600 18px/1.3 "Josefin Sans","Century Gothic","Segoe UI",sans-serif;color:#3e424f;letter-spacing:.02em}
  .pf-caja p{margin:0 0 16px;color:#63676f}
  .pf-btn{border:1px solid #3e424f;background:#3e424f;color:#fff;border-radius:6px;padding:9px 16px;cursor:pointer;font:inherit;font-weight:600}
  .pf-err{color:#b42318;font-size:13px;margin-top:10px}
  .pf-chip{position:fixed;right:12px;bottom:12px;z-index:50;display:flex;gap:6px;align-items:center;background:#fff;color:#262a33;border:1px solid #e4e1db;border-radius:99px;padding:4px 6px 4px 12px;font:12.5px "Source Sans 3","Segoe UI",sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.08);max-width:calc(100vw - 24px)}
  .pf-chip>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
  .pf-chip button{border:0;background:#f6eedf;color:#8a5d21;border-radius:99px;padding:3px 10px;cursor:pointer;font:inherit;font-weight:600;white-space:nowrap}
  .pf-chip button:disabled{opacity:.6;cursor:progress}
  @media print{.pf-chip,.pf-portada{display:none!important}}`;
  function estilos() { if (document.getElementById("pf-css")) return; const s = document.createElement("style"); s.id = "pf-css"; s.textContent = CSS; document.head.appendChild(s); }
  const alCargar = (f) => (document.body ? f() : document.addEventListener("DOMContentLoaded", f));

  function mostrarPortada(auth) {
    alCargar(() => {
      estilos();
      if (document.getElementById("pf-portada")) return;
      const d = document.createElement("div");
      d.id = "pf-portada"; d.className = "pf-portada";
      d.innerHTML = `<div class="pf-caja"><h2>${escapar(CFG.titulo || "Estados Financieros")}</h2><p>Inicie sesión con su cuenta de Google autorizada para ver y trabajar con la información compartida.</p><button class="pf-btn" type="button">Iniciar sesión con Google</button><div class="pf-err" hidden></div></div>`;
      d.querySelector("button").onclick = async () => {
        const e = d.querySelector(".pf-err"); e.hidden = true;
        const prov = new firebase.auth.GoogleAuthProvider(); prov.setCustomParameters({ prompt: "select_account" });
        try { await auth.signInWithPopup(prov); }
        catch (err) {
          /* En la app instalada de algunos celulares la ventana emergente no abre: se usa la redirección. */
          if (err && /popup-blocked|operation-not-supported|web-storage-unsupported/.test(err.code || "")) { try { await auth.signInWithRedirect(prov); return; } catch (e2) { err = e2; } }
          if (err && err.code === "auth/popup-closed-by-user") return;
          e.textContent = "No se pudo iniciar sesión: " + (err.message || err.code); e.hidden = false;
        }
      };
      document.body.appendChild(d);
    });
  }
  function quitarPortada() { const d = document.getElementById("pf-portada"); if (d) d.remove(); }

  function ponerUsuario(u, salir, db) {
    const etq = esEditor() ? "" : ` · ${escapar(PERFILES[perfil.rol] || perfil.rol)}`;
    ponerChip(`<span title="Datos compartidos en la nube">☁ ${escapar(u.email || u.displayName || "Usuario")}${etq}</span>`, db, "en la nube (lo verá todo el equipo)", salir, !esEditor());
  }
  function ponerRespaldoLocal(db) {
    ponerChip(`<span title="Los datos se guardan solo en este navegador">Datos en este equipo${esEditor() ? "" : " · " + escapar(PERFILES[perfil.rol])}</span>`, db, "en este equipo", null, !esEditor());
  }

  /* Chip inferior: estado + Respaldar / Restaurar (+ Salir en modo compartido). */
  function ponerChip(etiqueta, db, donde, salir, soloConsulta) {
    alCargar(() => {
      estilos();
      const c = document.createElement("div"); c.className = "pf-chip";
      if (soloConsulta) {
        c.innerHTML = `${etiqueta}${salir ? '<button type="button" data-a="salir">Salir</button>' : ""}`;
        if (salir) c.querySelector('[data-a="salir"]').onclick = salir;
        document.body.appendChild(c);
        return;
      }
      c.innerHTML = `${etiqueta}<button type="button" data-a="exp">Respaldar</button><button type="button" data-a="imp">Restaurar</button>${salir ? '<button type="button" data-a="salir">Salir</button>' : ""}<input type="file" accept=".json,application/json" hidden>`;
      const inp = c.querySelector("input"), bExp = c.querySelector('[data-a="exp"]'), bImp = c.querySelector('[data-a="imp"]');
      bExp.onclick = async () => {
        const t = bExp.textContent; bExp.disabled = true; bExp.textContent = "Preparando…";
        try {
          const datos = await db.exportar((n, tot) => { bExp.textContent = `Preparando ${Math.round(n / tot * 100)}%`; });
          const f = new Date().toISOString().slice(0, 10);
          await downloads.save({ filename: `respaldo-reserva-del-mar-${f}.json`, data: JSON.stringify({ app: "estados-financieros-ph", version: 1, fecha: new Date().toISOString(), datos }) });
        } catch (err) { alert("No se pudo generar el respaldo: " + (err.message || err)); }
        finally { bExp.disabled = false; bExp.textContent = t; }
      };
      bImp.onclick = () => inp.click();
      if (salir) c.querySelector('[data-a="salir"]').onclick = salir;
      inp.onchange = async () => {
        const f = inp.files[0]; inp.value = ""; if (!f) return;
        const t = bImp.textContent;
        try {
          const j = JSON.parse(await f.text());
          const datos = j && j.datos ? j.datos : j;
          if (!datos || typeof datos !== "object") throw new Error("archivo sin datos");
          const n = Object.keys(datos).length;
          if (!confirm(`El respaldo trae ${n} registros y se guardará ${donde}.\n\n¿Continuar?`)) return;
          const reemplazar = confirm(`¿Borrar primero lo que ya existe ${donde}?\n\nAceptar: reemplazar todo por el respaldo.\nCancelar: combinar (el respaldo sobrescribe solo los registros que trae).`);
          bImp.disabled = true;
          await db.importar(datos, reemplazar, (k, tot) => { bImp.textContent = `Restaurando ${k} de ${tot}`; });
          alert("Respaldo restaurado. La página se recargará.");
          location.reload();
        } catch (err) { alert("No se pudo restaurar el respaldo: " + (err.message || err)); }
        finally { bImp.disabled = false; bImp.textContent = t; }
      };
      document.body.appendChild(c);
    });
  }
  const escapar = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ------------------------------------------------------------------ API pública */
  let dbLocal = null, userP = null, assetsP = null;
  function obtenerDB() {
    if (MODO === "firebase") return crearDBFirebase();
    if (!dbLocal) { dbLocal = crearDBLocal(); ponerRespaldoLocal(dbLocal); }
    return Promise.resolve(dbLocal);
  }
  window.claude = {
    plataforma: MODO,
    async use(nombre) {
      if (nombre === "downloads") return downloads;
      if (nombre === "permissions") return permissions;
      if (nombre === "db") return obtenerDB();
      if (nombre === "user") return (userP = userP || crearUser());
      if (nombre === "assets") {
        const a = await (assetsP = assetsP || crearAssets());
        return esEditor() ? a : { leer: a.leer, list: a.list };
      }
      return null;
    },
  };
})();
