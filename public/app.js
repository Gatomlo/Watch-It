(function () {
  "use strict";

  // Chemin de montage : déduit de l'URL du script.
  var BASE = (function () {
    try {
      var u = document.currentScript && document.currentScript.src;
      if (!u) return '';
      return new URL('.', u).pathname.replace(/\/$/, '');
    } catch (e) { return ''; }
  })();

  var IMG = 'https://image.tmdb.org/t/p/';
  var MON = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  var REGIONS = [['BE', 'Belgique'], ['FR', 'France'], ['CH', 'Suisse'], ['LU', 'Luxembourg'], ['CA', 'Canada']];
  var PROVS = { claude: 'Claude', gemini: 'Gemini', mistral: 'Mistral' };

  // ===================== Utilitaires =====================
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); }
  function norm(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
  function sameJson(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function todayISO() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function fmtDate(d) { var a = String(d).split('-'); return (+a[2]) + ' ' + MON[+a[1] - 1] + (+a[0] !== new Date().getFullYear() ? ' ' + a[0] : ''); }
  function daysSince(d) { return Math.floor((Date.now() - Date.parse(d)) / 86400000); }
  function fmtLen(m) { var h = Math.floor(m / 60), r = m % 60; return h ? h + ' h' + (r ? ' ' + (r < 10 ? '0' : '') + r : '') : r + ' min'; }
  function hueOf(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; }

  // Thème : sombre (défaut), clair ou auto ; mémorisé sur l'appareil.
  var THEME = 'dark';
  try { THEME = localStorage.getItem('maiwatch-theme') || 'dark'; } catch (e) {}
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', THEME);
    var light = THEME === 'light' || (THEME === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);
    var m = document.querySelector('meta[name=theme-color]'); if (m) m.setAttribute('content', light ? '#f7f1ea' : '#17141a');
  }
  applyTheme();

  var ico = {
    back: '<path d="M15 5l-7 7 7 7"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>', plus: '<path d="M12 5v14M5 12h14"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>', list: '<path d="M4 6h16M4 12h16M4 18h10"/>', checkc: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
    dice: '<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.2"/><circle cx="15.5" cy="15.5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="15.5" cy="8.5" r="1.2"/><circle cx="8.5" cy="15.5" r="1.2"/>',
    play: '<path d="M8 5l12 7-12 7z"/>', share: '<path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>', up: '<path d="M7 11v9H4v-9zM7 11l4-8c1.5 0 2.5 1 2.5 2.5V9H19a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.8 20H7"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.5l6.8-4M8.6 13.5l6.8 4"/>',
    dl: '<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>', ul: '<path d="M12 15V3M7 8l5-5 5 5M4 20h16"/>', chev: '<path d="M9 5l7 7-7 7"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5"/>', out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    star: '<path d="M12 2.8l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.7 6.1 21l1.2-6.6L2.5 9.8l6.6-.9z"/>',
    filter: '<path d="M4 6h9M19 6h1M4 12h3M13 12h7M4 18h11M21 18h-1"/><circle cx="16" cy="6" r="2.2"/><circle cx="10" cy="12" r="2.2"/><circle cx="17.5" cy="18" r="2.2"/>'
  };
  function I(n, cls) { return '<svg class="ico ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + ico[n] + '</svg>'; }

  // ===================== État =====================
  // S = état partagé et synchronisé : { settings:{region,platforms[],profiles}, list[], dismissed }.
  // Fiche d'un titre dans la liste : { id:'movie:123', ty:'film'|'serie', t, y, p, g[], len, by, at, status:'todo'|'seen', r:{M,E}, note, av:{f[],at}, alert }.
  var S = null;
  var me = 'M';             // profil de cet appareil (propre à l'appareil, non synchronisé)
  try { me = localStorage.getItem('maiwatch-me') === 'E' ? 'E' : 'M'; } catch (e) {}
  var CFG = { tmdb: true, tmdbKey: { hasKey: true, last4: null, source: 'app' }, region: 'BE', ai: { provider: 'claude', hasKey: false, last4: null, tested: false }, streaming: { hasKey: false, last4: null, mode: 'direct' } };
  var AV = {};              // disponibilité des titres de la liste : id -> { f[], r[], b[], trailer }
  var AV_AT = 0;
  var PV = {}, PVL = [];    // plateformes connues : id -> { id, name, logo } ; PVL = même liste, dans l'ordre de popularité
  // Installation (PWA) : Chrome / Edge / Android proposent beforeinstallprompt ; iPhone passe par « Partager ».
  var deferredInstall = null;
  function isStandalone() { return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true; }
  function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
  function installHidden() { try { return localStorage.getItem('maiwatch-install-hidden') === '1'; } catch (e) { return false; } }
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferredInstall = e; if (isAuthenticated) safeRender(); });
  window.addEventListener('appinstalled', function () { deferredInstall = null; if (isAuthenticated) { toast('Watch-It est installée.'); safeRender(); } });
  var KNOWN = {};           // fiches légères vues dans les résultats : id -> item
  try { var a = JSON.parse(localStorage.getItem('maiwatch-av') || 'null'); if (a && a.map) { AV = a.map; AV_AT = a.at || 0; } } catch (e) {}
  try { var pv0 = JSON.parse(localStorage.getItem('maiwatch-pv') || 'null'); if (pv0) { pv0.forEach(function (p) { PV[p.id] = p; }); PVL = pv0; } } catch (e) {}

  var ui = {
    screen: 'home', hist: [], detail: null, dd: null, type: 'all', plats: [], genres: [], fq: '', fexp: false, sheet: null,
    tab: 'me', sug: {}, sugOff: {}, mi: {}, sugVer: 0, epOpen: false, epSeason: null, epData: {}, epExp: {}, epErr: {}, q: '', sr: null, srBusy: false, envie: '', env: null, envBusy: false,
    impText: '', impRows: null, impMode: 'paste', impBusy: false, pvq: '', aiMsg: '', aiBusy: false, pwMsg: '', loginError: '', setup: false, tmdbMsg: '', tmdbBusy: false,
    sset: 'menu', accMsg: '', aiDraftModel: null, aiModels: null, keyEdit: {}, keyConfirm: null, soon: null, cs: 'envie', cols: [], who: 'all', lk: {}, colOpen: null, colq: '', noteEdit: null, noteDraft: null, drawWho: 'both', matchTy: 'all', matchSrc: 'mix', saMode: null, saMsg: '', saBusy: false, tb: { mode: 'none', min: 0, start: '', end: '' }, nf: null, impHints: null, matchBusy: false, lbUser: '', trUser: '', trakt: { hasKey: false, last4: null }, push: { st: 'unknown', endpoint: null, msg: '' }
  };
  var booted = false, isAuthenticated = false, currentUsername = '';

  function defaultState() { return { settings: { region: 'BE', platforms: [], profiles: { M: 'Moi', E: 'Elle' }, ratingScale: 5 }, list: [], dismissed: { M: [], E: [] }, match: null, tonight: null, collections: [] }; }
  function migrate(s) {
    s = s || defaultState();
    s.settings = s.settings || {};
    s.settings.region = s.settings.region || 'BE';
    s.settings.platforms = s.settings.platforms || [];
    s.settings.profiles = Object.assign({ M: 'Moi', E: 'Elle' }, s.settings.profiles || {});
    s.list = s.list || [];
    s.dismissed = Object.assign({ M: [], E: [] }, s.dismissed || {});
    s.match = s.match || null;
    s.tonight = s.tonight || null;
    s.collections = s.collections || [];
    return s;
  }
  function pname(u) { return (S && S.settings.profiles[u]) || (u === 'M' ? 'Moi' : 'Elle'); }
  function initial(u) { return pname(u).charAt(0).toUpperCase() || u; }
  function other(u) { return u === 'M' ? 'E' : 'M'; }
  function entry(id) { for (var i = 0; i < S.list.length; i++) if (S.list[i].id === id) return S.list[i]; return null; }
  function know(it) { if (it && it.id) KNOWN[it.id] = Object.assign(KNOWN[it.id] || {}, it); return it; }
  function lite(it) {
    var o = { id: it.id, ty: it.ty, t: it.t, y: it.y || null, p: it.p || null, g: it.g || [], len: it.len || null };
    var dt = it.date || it.d;
    if (dt && dt > todayISO()) o.d = dt;
    return o;
  }
  function addEntry(it, status) {
    var e = Object.assign(lite(it), { by: me, at: todayISO(), status: status || 'todo', r: {}, note: '' });
    if (e.status === 'todo' && S.settings.addFor === 'both') e.w = { M: true, E: true }; // option : voulu par les deux dès l'ajout
    S.list.push(e);
    return e;
  }

  // ===================== API =====================
  function apiFetch(url, options) {
    options = options || {};
    options.credentials = 'same-origin';
    if (options.body && typeof options.body !== 'string') {
      options.headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
      options.body = JSON.stringify(options.body);
    }
    return fetch(BASE + url, options);
  }
  // JSON ou erreur lisible (message du serveur).
  function api(url, options) {
    return apiFetch(url, options).then(function (r) {
      if (r.status === 401) { handleUnauthorized(); throw new Error('Session expirée.'); }
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) {
          var e = new Error(j.error === 'tmdb_not_configured' ? 'Ajoutez d’abord la clé TMDB dans les réglages.' : (j.error || 'Erreur ' + r.status));
          e.code = j.error; throw e;
        }
        return j;
      });
    }, function () { throw new Error('Pas de connexion. Réessayez quand le réseau revient.'); });
  }

  // ===================== Synchronisation et hors-ligne =====================
  // L'état vit d'abord sur l'appareil (localStorage) puis
  // part au serveur ; en cas de 409, fusion à trois (base / local / serveur) puis renvoi.
  var STORE_KEY = 'maiwatch-data';
  var baseState = null, baseVersion = null, dirty = false, online = true, syncing = false, syncAgain = false, retryTimer = null, renderDeferred = false;

  function persistLocal() { try { localStorage.setItem(STORE_KEY, JSON.stringify({ state: S, base: baseState, version: baseVersion, dirty: dirty, user: currentUsername })); } catch (e) {} }
  function readLocal() { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || null; } catch (e) { return null; } }
  function isPlainObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function idList(arr) { return arr.every(function (x) { return isPlainObj(x) && typeof x.id === 'string'; }); }
  function scalarList(arr) { return arr.every(function (x) { return x === null || typeof x !== 'object'; }); }
  function merge3(base, mine, theirs) {
    if (sameJson(mine, theirs)) return mine;
    if (sameJson(mine, base)) return theirs;
    if (sameJson(theirs, base)) return mine;
    if (isPlainObj(mine) && isPlainObj(theirs)) {
      var bo = isPlainObj(base) ? base : {}, out = {};
      Object.keys(Object.assign({}, bo, theirs, mine)).forEach(function (k) { var v = merge3(bo[k], mine[k], theirs[k]); if (v !== undefined) out[k] = v; });
      return out;
    }
    if (Array.isArray(mine) && Array.isArray(theirs)) {
      var ba = Array.isArray(base) ? base : [];
      if (idList(mine) && idList(theirs) && idList(ba)) {
        var index = function (arr) { var m = {}; arr.forEach(function (x) { m[x.id] = x; }); return m; };
        var bm = index(ba), mm = index(mine), tm = index(theirs);
        var ids = theirs.map(function (x) { return x.id; });
        mine.forEach(function (x) { if (!tm[x.id]) ids.push(x.id); });
        var res = [];
        ids.forEach(function (id) { var v = merge3(bm[id], mm[id], tm[id]); if (v !== undefined) res.push(v); });
        return res;
      }
      if (scalarList(mine) && scalarList(theirs) && scalarList(ba)) {
        var kept = theirs.filter(function (x) { return !(ba.indexOf(x) !== -1 && mine.indexOf(x) === -1); });
        mine.forEach(function (x) { if (ba.indexOf(x) === -1 && kept.indexOf(x) === -1) kept.push(x); });
        return kept;
      }
    }
    if (mine === undefined) return theirs;
    return mine;
  }

  // Pas de rendu pendant une saisie : on attend la sortie du champ.
  function safeRender() {
    var a = document.activeElement;
    if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) { renderDeferred = true; return; }
    render(true);
  }
  document.addEventListener('focusout', function () { if (renderDeferred) setTimeout(function () { var a = document.activeElement; if (!a || !/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) { renderDeferred = false; render(true); } }, 50); });

  function syncChip() {
    if (!isAuthenticated) return '';
    if (!online) return '<button class="sync off" data-act="syncnow" aria-label="Hors ligne : toucher pour réessayer"><i></i>' + (dirty ? 'Hors ligne · en attente' : 'Hors ligne') + '</button>';
    if (dirty || syncing) return '<button class="sync" data-act="syncnow" aria-label="Envoi en cours"><i></i>Envoi…</button>';
    return '';
  }
  function updateSyncStatus() { var el = document.getElementById('syncslot'); if (el) el.innerHTML = syncChip(); }
  function setOnline(v) { if (online === v) return; online = v; updateSyncStatus(); }
  function scheduleRetry() { clearTimeout(retryTimer); retryTimer = setTimeout(function () { if (dirty) syncNow(); else pullState(); }, 15000); }
  function versionOf(r) { var v = r.headers.get('X-State-Version'); return v != null && /^\d+$/.test(v) ? Number(v) : null; }
  function receiveRemote(remote, version) {
    remote = migrate(remote);
    S = (dirty && S) ? migrate(merge3(baseState, S, remote)) : clone(remote);
    baseState = clone(remote);
    baseVersion = version;
    ui.sugVer++;
    persistLocal();
    if (matchApply()) setTimeout(save, 0);
  }
  // Un match (envie des deux) met le titre dans la liste « À voir », voulu par les deux ; sans effet si déjà fait.
  function matchApply() {
    var m = S && S.match, changed = false; if (!m || m.st === 'wait' || m.st === 'no') return false;
    matchResults(m).forEach(function (c) {
      var e = entry(c.id);
      if (!e) { e = addEntry(c, 'todo'); e.w = { M: true, E: true }; changed = true; ui.matchNew = true; return; }
      if (e.status !== 'todo') return;
      if (!e.w || !e.w.M || !e.w.E) { e.w = { M: true, E: true }; changed = true; }
      if (e.no) { delete e.no; changed = true; }
    });
    return changed;
  }
  function handleUnauthorized() { isAuthenticated = false; render(); }

  function save() { dirty = true; ui.sugVer++; persistLocal(); updateSyncStatus(); syncNow(); }

  function syncNow() {
    if (!dirty || !isAuthenticated) return;
    if (baseVersion == null) { pullState(); return; }
    if (syncing) { syncAgain = true; return; }
    syncing = true;
    var sent = clone(S), hadOffline = !online;
    apiFetch('/api/state', { method: 'PUT', body: sent, headers: { 'X-Base-Version': String(baseVersion) } }).then(function (r) {
      if (r.status === 401) { handleUnauthorized(); return; }
      if (r.status === 409) {
        setOnline(true);
        return r.json().then(function (body) { receiveRemote(body.state, versionOf(r)); syncAgain = true; safeRender(); });
      }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json().then(function (body) {
        baseState = sent; baseVersion = body.version; dirty = !sameJson(S, sent); persistLocal(); setOnline(true);
        if (hadOffline && !dirty) toast('Modifications synchronisées.');
      });
    }).catch(function () { setOnline(false); scheduleRetry(); }).finally(function () {
      syncing = false; updateSyncStatus();
      if (syncAgain) { syncAgain = false; syncNow(); }
    });
  }

  function pullState() {
    if (!isAuthenticated || syncing) return Promise.resolve();
    if (dirty && baseVersion != null) { syncNow(); return Promise.resolve(); }
    return apiFetch('/api/state', { cache: 'no-store' }).then(function (r) {
      if (r.status === 401) { handleUnauthorized(); return; }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var v = versionOf(r);
      return r.json().then(function (remote) {
        setOnline(true);
        if (S && v != null && v === baseVersion && !dirty) return;
        var first = !S;
        receiveRemote(remote, v);
        if (first) render(); else safeRender();
        if (dirty) syncNow();
      });
    }).catch(function () { setOnline(false); scheduleRetry(); }).finally(updateSyncStatus);
  }

  var pollTimer = null;
  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(function () { if (!document.hidden) pullState(); }, 20000);
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && isAuthenticated) { pullState(); maybeRefreshAvail(); } });
  window.addEventListener('online', function () { if (isAuthenticated) { if (dirty) syncNow(); else pullState(); } });
  window.addEventListener('offline', function () { setOnline(false); });

  // ===================== Plateformes et disponibilité =====================
  // Marque d'une plateforme d'après son nom (TMDB et Streaming Availability nomment un peu différemment).
  function brandOf(name) {
    var n = norm(name || '');
    if (/netflix/.test(n)) return 'netflix';
    if (/\bhbo\b|\bmax\b/.test(n)) return 'max';
    if (/prime video|amazon prime/.test(n)) return 'prime';
    if (/disney/.test(n)) return 'disney';
    if (/apple tv/.test(n)) return 'apple';
    if (/canal/.test(n)) return 'canal';
    if (/paramount/.test(n)) return 'paramount';
    if (/youtube/.test(n)) return 'youtube';
    return n;
  }
  function saOn() { return !!(CFG.streaming && CFG.streaming.hasKey); }
  // Liens à afficher / partager : choix du foyer (Réglages > Partage), TMDB / JustWatch par défaut.
  function linkOpt(k) { var l = S.settings.links; return l && l[k] != null ? !!l[k] : true; }
  function tmdbLink(d) {
    if (!d || !d.av || !d.av.link) return null;
    try { var u = new URL(d.av.link); u.searchParams.set('language', 'fr-FR'); return u.toString(); } catch (e) { return d.av.link; }
  }
  // Lien direct du titre chez une plateforme (Streaming Availability) : d'abord celles du foyer.
  function platLink(d) {
    var ls = ui.lk[d.id]; if (!saOn() || !Array.isArray(ls) || !ls.length) return null;
    var mine = {}; platsOn().forEach(function (p) { mine[brandOf(pnameOf(p))] = 1; });
    var order = ls.filter(function (l) { return l.type === 'subscription' || l.type === 'free' || l.type === 'addon'; });
    var hit = order.filter(function (l) { return mine[brandOf(l.name)]; })[0] || order[0] || ls[0];
    return hit ? { name: hit.name, url: hit.link } : null;
  }
  function linkFor(d, providerId) {
    var ls = ui.lk[d.id]; if (!saOn() || !linkOpt('plat') || !Array.isArray(ls)) return null;
    var b = brandOf(pnameOf(providerId)), hit = ls.filter(function (l) { return brandOf(l.name) === b; })[0];
    return hit ? hit.link : null;
  }
  function shareLinks(d) {
    var out = [], pl = linkOpt('plat') ? platLink(d) : null, tl = linkOpt('tmdb') || !pl ? tmdbLink(d) : null;
    if (pl) out.push({ label: pl.name, url: pl.url });
    if (tl) out.push({ label: 'TMDB / JustWatch', url: tl });
    return out;
  }
  function loadLinks(id) {
    if (!saOn() || !linkOpt('plat') || ui.lk[id] !== undefined) return;
    ui.lk[id] = 'loading';
    api('/api/title/' + encodeURIComponent(id) + '/links').then(function (l) { ui.lk[id] = l; }).catch(function () { ui.lk[id] = 'err'; }).finally(function () { if (ui.detail === id && ui.screen === 'detail') safeRender(); });
  }
  function logoOf(id) { var p = PV[id]; return p && p.logo ? '<img class="pl" src="' + IMG + 'w45' + esc(p.logo) + '" alt="" loading="lazy">' : '<span class="dot" style="background:var(--muted)"></span>'; }
  function pnameOf(id) { return PV[id] ? PV[id].name : 'Plateforme ' + id; }
  function loadProviders(force) {
    if (!force && PVL.length) { expandSelected(); return Promise.resolve(); }
    return api('/api/providers?region=' + encodeURIComponent(S.settings.region)).then(function (list) {
      PV = {}; PVL = list; list.forEach(function (p) { PV[p.id] = p; });
      try { localStorage.setItem('maiwatch-pv', JSON.stringify(list)); } catch (e) {}
      expandSelected();
    }).catch(function () {});
  }
  function platsOn() { return S.settings.platforms; }
  function famKey(name) {
    var n = norm(name || '').replace(/\b(with|avec) ads?\b|\bstandard\b|\bbasic\b|\bamazon channel\b|\bapple tv channel\b|\broku premium channel\b|\bamazon\b|\bhbo\b|\bplus\b/g, ' ').replace(/\s+/g, ' ').trim();
    return n || norm(name || '');
  }
  function famIds(id) {
    var p = PV[id], key = p ? famKey(p.name) : null, out = [id];
    if (key) PVL.forEach(function (q) { if (q.id !== id && famKey(q.name) === key) out.push(q.id); });
    return out;
  }
  // Familles : [{ key, name, ids[] }] à partir d'une liste d'identifiants (ordre de PVL, puis inconnus).
  function famsOf(ids) {
    var out = [], idx = {};
    ids.forEach(function (id) {
      var p = PV[id], key = p ? famKey(p.name) : 'id' + id;
      if (idx[key] == null) { idx[key] = out.length; out.push({ key: key, name: '', ids: [], first: id }); }
      out[idx[key]].ids.push(id);
    });
    out.forEach(function (f) {
      var best = f.ids.map(function (i) { return PV[i]; }).filter(Boolean).sort(function (a, b) { return a.name.length - b.name.length; })[0];
      f.name = best ? best.name : 'Plateforme ' + f.first; f.first = best ? best.id : f.first;
    });
    return out;
  }
  function selFams() { return famsOf(platsOn()); }
  function expandSelected() {
    if (!S || !PVL.length) return;
    var cur = platsOn(), add = [];
    cur.forEach(function (id) { famIds(id).forEach(function (x) { if (cur.indexOf(x) < 0 && add.indexOf(x) < 0) add.push(x); }); });
    if (add.length) { S.settings.platforms = cur.concat(add); save(); }
  }
  function toggleIds(arr, ids) {
    var any = ids.some(function (i) { return arr.indexOf(i) >= 0; });
    ids.forEach(function (i) { var j = arr.indexOf(i); if (any) { if (j >= 0) arr.splice(j, 1); } else if (j < 0) arr.push(i); });
    return !any;
  }
  function avail(it) { var a = AV[it.id]; return a ? a.f.filter(function (p) { return platsOn().indexOf(p) >= 0; }) : []; }
  function availKnown(it) { return !!AV[it.id]; }

  function refreshAvail() {
    if (!isAuthenticated || !S) return Promise.resolve();
    var ids = S.list.filter(function (e) { return e.status === 'todo'; }).map(function (e) { return e.id; });
    if (!ids.length) { AV_AT = Date.now(); return Promise.resolve(); }
    return api('/api/availability', { method: 'POST', body: { ids: ids } }).then(function (map) {
      Object.keys(map).forEach(function (k) { AV[k] = map[k]; });
      AV_AT = Date.now();
      try { localStorage.setItem('maiwatch-av', JSON.stringify({ at: AV_AT, map: AV })); } catch (e) {}
      detectChanges();
      safeRender();
    }).catch(function () {});
  }
  function maybeRefreshAvail() { if (Date.now() - AV_AT > 6 * 3600 * 1000) refreshAvail(); }

  // Compare avec la dernière disponibilité connue : « N'est plus sur… » / « Nouveau sur… ».
  function detectChanges() {
    var changed = false, plats = platsOn();
    S.list.forEach(function (e) {
      if (e.status !== 'todo' || !AV[e.id]) return;
      var now = AV[e.id].f, prev = e.av && e.av.f;
      if (!prev) { e.av = { f: now.slice(), at: todayISO() }; changed = true; return; }
      if (sameJson(prev.slice().sort(), now.slice().sort())) return;
      var gone = prev.filter(function (p) { return now.indexOf(p) < 0 && plats.indexOf(p) >= 0; });
      var fresh = now.filter(function (p) { return prev.indexOf(p) < 0 && plats.indexOf(p) >= 0; });
      if (gone.length) e.alert = { k: 'gone', p: gone[0], at: todayISO() };
      else if (fresh.length) e.alert = { k: 'new', p: fresh[0], at: todayISO() };
      e.av = { f: now.slice(), at: todayISO() }; changed = true;
    });
    if (changed) save();
  }

  // ===================== Filtres =====================
  function colName(id) { for (var i = 0; i < S.collections.length; i++) if (S.collections[i].id === id) return S.collections[i].name; return ''; }
  function passes(it, skip) {
    if (skip !== 'type' && ui.type !== 'all' && it.ty !== ui.type) return false;
    if (skip !== 'plat' && ui.plats.length) { var a = AV[it.id]; if (!a || !a.f.some(function (p) { return ui.plats.indexOf(p) >= 0; })) return false; }
    if (skip !== 'genre' && ui.genres.length && !(it.g || []).some(function (g) { return ui.genres.indexOf(g) >= 0; })) return false;
    if (skip !== 'col' && ui.cols.length) { var en = entry(it.id); if (!en || !(en.l || []).some(function (l) { return ui.cols.indexOf(l) >= 0; })) return false; }
    if (skip !== 'who' && ui.who !== 'all') { var ew = entry(it.id); if (ew && ew.status === 'todo' && !whoOk(ew)) return false; }
    return true;
  }
  function other() { return me === 'M' ? 'E' : 'M'; }
  function whoOk(e, w) {
    w = w || ui.who;
    if (w === 'me') return wants(e, me);
    if (w === 'other') return wants(e, other());
    if (w === 'both') return wants(e, 'M') && wants(e, 'E');
    return true;
  }
  // « Au hasard » : sauf filtre « Qui veut le voir » choisi, on tire parmi les titres voulus par les deux.
  function drawSwitch() {
    if (ui.who !== 'all') return '<span class="help" style="text-align:center">Filtre « Qui veut le voir : ' + esc(whoLabel(ui.who)) + ' » appliqué.</span>';
    return '<div class="seg" role="group" aria-label="Tirer parmi">' + [['both', 'Voulus par les deux'], ['all', 'Tous']].map(function (x) { return '<button class="chip' + (ui.drawWho === x[0] ? ' on' : '') + '" data-act="drawwho" data-v="' + x[0] + '" aria-pressed="' + (ui.drawWho === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div>';
  }
  function drawWho() { return ui.who !== 'all' ? ui.who : ui.drawWho; }
  function whoLabel(w) { return w === 'me' ? 'Moi' : w === 'other' ? pname(other()) : w === 'both' ? 'Les deux' : 'Tous'; }
  function pool(scr) {
    scr = scr || ui.screen;
    if (scr === 'sug') { var s = ui.sug[ui.tab]; return s && s.items ? s.items.map(function (x) { return x.item; }) : []; }
    var st = scr === 'seen' ? 'seen' : 'todo';
    return S.list.filter(function (e) { return e.status === st; });
  }
  function nFilters() { return famsOf(ui.plats).length + ui.genres.length + ui.cols.length + (ui.who !== 'all' ? 1 : 0); }

  // ===================== Pièces d'interface =====================
  function poster(it, cls) {
    var h = hueOf(it.t || '');
    var ini = esc((it.t || '?').replace(/^(Le|La|Les|The|L’|À|Un|Une)\s+/i, '').charAt(0).toUpperCase());
    return '<div class="poster ' + (cls || '') + '" style="background:linear-gradient(160deg,hsl(' + h + ' 38% 36%),hsl(' + h + ' 24% 13%))" aria-hidden="true">' +
      (it.p ? '<img src="' + IMG + (cls === 'xs' ? 'w92' : 'w185') + esc(it.p) + '" alt="" loading="lazy" onerror="this.remove()">' : '') + '<span>' + ini + '</span></div>';
  }
  function meta(it) {
    if (it.ty === 'film') return 'Film' + (it.y ? ' · ' + it.y : '') + (it.len ? ' · ' + fmtLen(it.len) : '');
    return 'Série' + (it.y ? ' · ' + it.y : '') + (it.seasons ? ' · ' + it.seasons + ' saison' + (it.seasons > 1 ? 's' : '') : '') + (it.len ? ' · ' + it.len + ' min' : '');
  }
  // Badge plateforme : logo + nom ; sur téléphone le nom est masqué (lecteurs d'écran : conservé) quand le logo existe.
  function platBadge(id) {
    var hasLogo = !!(PV[id] && PV[id].logo);
    return '<span class="badge pb" title="' + esc(pnameOf(id)) + '">' + logoOf(id) + '<span' + (hasLogo ? ' class="pn"' : '') + '>' + esc(pnameOf(id)) + '</span></span>';
  }
  function badges(it, av) {
    var a = av || AV[it.id], mine = a ? a.f.filter(function (p) { return platsOn().indexOf(p) >= 0; }) : [], h = '';
    mine.forEach(function (p) { h += platBadge(p); });
    var e = entry(it.id);
    if (e && e.alert && daysSince(e.alert.at) <= 21 && e.status === 'todo') {
      h += e.alert.k === 'gone' ? '<span class="badge warn">N’est plus sur ' + esc(pnameOf(e.alert.p)) + '</span>' : '<span class="badge ok">Nouveau sur ' + esc(pnameOf(e.alert.p)) + '</span>';
    }
    if (e && e.l && e.l.length) e.l.slice(0, 2).forEach(function (l) { var nm = colName(l); if (nm) h += '<span class="badge soft">' + esc(nm) + '</span>'; });
    if (e && e.status === 'todo' && it.d && it.d > todayISO()) h += '<span class="badge soft">Sortie le ' + fmtDate(it.d) + '</span>';
    if (e && e.status === 'todo' && it.ty === 'serie') h += progBadge(e, a);
    var soon = !!(it.d && it.d > todayISO());
    if (soon) return '<div class="badges">' + h + '</div>';
    if (!a) h += '<span class="badge mut">Plateformes…</span>';
    else if (!mine.length) h += a.f.length ? '<span class="badge mut">Sur d’autres plateformes</span>' : (a.r.length || a.b.length ? '<span class="badge warn">Location ou achat</span>' : '<span class="badge warn">Pas en streaming</span>');
    if (a) h += a.trailer ? '<span class="badge soft tr" title="Bande-annonce disponible">' + I('play') + '<span class="tn">Bande-annonce</span></span>' : '<span class="badge mut tr" title="Pas de bande-annonce">' + I('play') + '<span class="tn">Sans bande-annonce</span></span>';
    return '<div class="badges">' + h + '</div>';
  }
  function starRow(cur, act, attrs, cls) {
    var h = '';
    for (var i = 1; i <= 5; i++) h += '<button class="star' + (cur >= i ? ' on' : '') + '" data-act="' + act + '" ' + attrs + ' data-v="' + i + '" aria-label="' + i + ' étoile' + (i > 1 ? 's' : '') + '" aria-pressed="' + (cur === i) + '">' + I('star') + '</button>';
    return '<div class="stars ' + (cls || '') + '" role="group" aria-label="Note">' + h + '</div>';
  }
  // Suivi des séries : e.prog = { s, e } = dernier épisode vu ; a = infos TMDB { se:[{n,c}], last, next, ended }.
  function nextEp(e, a) {
    var se = a && a.se; if (!se || !se.length) return null;
    var p = e.prog || {}, cnt = {}; se.forEach(function (x) { cnt[x.n] = x.c; });
    if (!p.s) return { s: se[0].n, e: 1 };
    var s2 = p.s, ep = (p.e || 0) + 1;
    if (cnt[s2] && ep > cnt[s2]) { var nx = se.filter(function (x) { return x.n > s2; })[0]; if (!nx) return null; s2 = nx.n; ep = 1; }
    return { s: s2, e: ep };
  }
  function airedUpTo(a, n) { if (!a || !a.last) return true; return n.s < a.last.s || (n.s === a.last.s && n.e <= a.last.e); }
  function progBadge(e, a) {
    if (!a || !a.se || !e.prog || !e.prog.s) return '';
    var n = nextEp(e, a);
    if (n && airedUpTo(a, n)) return '<span class="badge go">Reprendre : S' + n.s + 'E' + n.e + '</span>';
    if (a.next && a.next.date) return '<span class="badge soft">Prochain épisode le ' + fmtDate(a.next.date) + '</span>';
    if (!n && a.ended) return '<span class="badge ok">Terminée : à marquer comme vue</span>';
    return '<span class="badge soft">À jour : S' + e.prog.s + 'E' + e.prog.e + '</span>';
  }

  function ava(u) { return '<span class="ava ' + u + '" aria-label="Ajouté par ' + esc(pname(u)) + '">' + esc(initial(u)) + '</span>'; }
  // Qui veut le voir : e.w = { M:true, E:true } ; sans e.w, seul celui qui l'a ajouté.
  function wants(e, u) { return e.w ? !!e.w[u] : e.by === u; }
  // Titres ajoutés par l'autre profil, pas encore voulus ni refusés par moi.
  function pending() {
    var o = me === 'M' ? 'E' : 'M';
    return S.list.filter(function (e) { return e.status === 'todo' && e.by === o && !wants(e, me) && !(e.no && e.no[me]); }).sort(function (a, b) { return a.at < b.at ? 1 : -1; });
  }
  // Listes qui ne sont pas encore cochées sur la fiche, filtrées par la recherche.
  function colList(id) {
    var e = entry(id), q = norm(ui.colq), have = (e && e.l) || [];
    var rest = S.collections.filter(function (c) { return have.indexOf(c.id) < 0 && (!q || norm(c.name).indexOf(q) >= 0); });
    if (!rest.length) return '<span class="help">' + (q ? 'Aucune liste ne correspond à « ' + esc(ui.colq) + ' ».' : 'Toutes les listes sont déjà cochées.') + '</span>';
    return rest.map(function (c) { return '<button class="mi" data-act="coltog" data-id="' + esc(id) + '" data-c="' + esc(c.id) + '"><span class="ct"><b>' + esc(c.name) + '</b></span></button>'; }).join('');
  }
  function avas(e) { return '<span class="avs">' + ['M', 'E'].filter(function (u) { return wants(e, u); }).map(function (u) { return '<span class="ava ' + u + '" aria-label="' + esc(pname(u)) + ' veut le voir">' + esc(initial(u)) + '</span>'; }).join('') + '</span>'; }
  function rowHtml(it, e) {
    var b = '<button class="row" data-act="open" data-id="' + esc(it.id) + '">' + poster(it) + '<span class="rb"><span class="rt"><span class="title">' + esc(it.t) + '</span>' + (e ? avas(e) : '') + '</span><span class="meta">' + meta(it) + '</span>' + badges(it) + '</span></button>';
    if (e && e.status === 'todo' && !wants(e, me)) return '<div class="rowx">' + b + '<button class="chip want" data-act="want" data-id="' + esc(it.id) + '" data-u="' + me + '">+ Moi aussi</button></div>';
    return b;
  }
  function back() { return '<button class="icon" data-act="back" aria-label="Retour">' + I('back') + '</button>'; }
  function nav() {
    function b(s, l, ic) { return '<button class="nb' + (ui.screen === s ? ' on' : '') + '" data-act="go" data-to="' + s + '"' + (ui.screen === s ? ' aria-current="page"' : '') + '>' + I(ic) + l + '</button>'; }
    return '<nav class="nav" aria-label="Navigation">' + b('home', 'À voir', 'list') + b('seen', 'Vus', 'checkc') + '<button class="fab" data-act="push" data-to="add" aria-label="Ajouter un titre">' + I('plus') + '</button>' + b('sug', 'Pour vous', 'spark') + b('envies', 'Ce soir', 'dice') + '</nav>';
  }
  function header(title, sub) {
    return '<header class="top"><div><h1>' + title + '</h1>' + (sub ? '<p class="sub">' + sub + '</p>' : '') + '</div><div class="hright"><span id="syncslot">' + syncChip() + '</span><button class="icon" data-act="push" data-to="settings" aria-label="Réglages">' + I('gear') + '</button></div></header>';
  }
  function typeSeg() {
    return '<div class="seg" role="group" aria-label="Type">' + [['all', 'Tous'], ['film', 'Films'], ['serie', 'Séries']].map(function (t) { return '<button class="chip' + (ui.type === t[0] ? ' on' : '') + '" data-act="tog" data-k="type" data-v="' + t[0] + '" aria-pressed="' + (ui.type === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div>';
  }
  function filterBar(extra) {
    var toks = [];
    famsOf(ui.plats).forEach(function (f) { toks.push({ k: 'plat', v: f.ids.join(','), l: f.name }); });
    ui.genres.forEach(function (g) { toks.push({ k: 'genre', v: g, l: g }); });
    ui.cols.forEach(function (c) { toks.push({ k: 'col', v: c, l: colName(c) || 'Liste' }); });
    if (ui.who !== 'all' && ui.screen !== 'sug' && ui.screen !== 'seen') toks.push({ k: 'who', v: 'all', l: 'Veut le voir : ' + whoLabel(ui.who) });
    var n = toks.length;
    var tk = '<div class="toks">' + toks.map(function (t) { return '<button class="tok" data-act="tog" data-k="' + t.k + '" data-v="' + esc(t.v) + '" aria-label="Retirer le filtre ' + esc(t.l) + '">' + esc(t.l) + I('close') + '</button>'; }).join('') + '</div>';
    var fb = '<button class="fbtn' + (n ? ' on' : '') + '" data-act="openfilter">' + I('filter') + 'Filtrer' + (n ? '<span class="cnt">' + n + '</span>' : '') + '</button>';
    if (extra) return typeSeg() + '<div class="group" style="gap:8px"><div class="fbar">' + fb + extra + '</div>' + (n ? '<div class="fbar">' + tk + '</div>' : '') + '</div>';
    return typeSeg() + '<div class="fbar">' + fb + tk + '</div>';
  }
  function crow(k, v, label, n, on, lead) {
    return '<button class="crow" data-act="tog" data-k="' + k + '" data-v="' + esc(v) + '" aria-pressed="' + on + '"><span class="box">' + I('check') + '</span>' + (lead || '') + '<span class="nm">' + esc(label) + '</span><span class="n">' + n + '</span></button>';
  }
  function genreList() {
    var cs = pool(ui.sheet.scr), set = {};
    cs.filter(function (c) { return passes(c, 'genre'); }).forEach(function (c) { (c.g || []).forEach(function (g) { set[g] = (set[g] || 0) + 1; }); });
    ui.genres.forEach(function (g) { if (!set[g]) set[g] = 0; });
    var ks = Object.keys(set).sort(function (a, b) { return set[b] - set[a] || a.localeCompare(b); }), q = norm(ui.fq), tot = ks.length;
    if (q) ks = ks.filter(function (g) { return norm(g).indexOf(q) >= 0; });
    else if (!ui.fexp && ks.length > 6) { var top = ks.slice(0, 6); ks = top.concat(ui.genres.filter(function (g) { return top.indexOf(g) < 0; })); }
    var h = ks.map(function (g) { return crow('genre', g, g, set[g], ui.genres.indexOf(g) >= 0); }).join('');
    if (!ks.length) h = '<span class="help" style="padding:10px 2px">Aucun genre ne correspond.</span>';
    if (!q && tot > 6) h += '<button class="link" style="align-self:flex-start" data-act="fexp">' + (ui.fexp ? 'Voir moins' : 'Voir les ' + tot + ' genres') + '</button>';
    return h;
  }
  function filterSheet() {
    var cs = pool(ui.sheet.scr), N = cs.filter(function (c) { return passes(c); }).length;
    var pc = {};
    cs.filter(function (c) { return passes(c, 'plat'); }).forEach(function (c) { var a = AV[c.id]; if (a) a.f.forEach(function (k) { pc[k] = (pc[k] || 0) + 1; }); });
    var plats = selFams().map(function (f) { var n = 0; cs.filter(function (c) { return passes(c, 'plat'); }).forEach(function (c) { var a = AV[c.id]; if (a && a.f.some(function (x) { return f.ids.indexOf(x) >= 0; })) n++; }); return crow('plat', f.ids.join(','), f.name, n, f.ids.some(function (x) { return ui.plats.indexOf(x) >= 0; }), logoOf(f.first)); }).join('');
    var colGroup = '';
    if (ui.sheet.scr !== 'sug' && S.collections.length) {
      var cc = {};
      cs.filter(function (c) { return passes(c, 'col'); }).forEach(function (c) { var en = entry(c.id); (en && en.l || []).forEach(function (l) { cc[l] = (cc[l] || 0) + 1; }); });
      colGroup = '<div class="fgroup"><h2>Listes</h2><div>' + S.collections.map(function (c) { return crow('col', c.id, c.name, cc[c.id] || 0, ui.cols.indexOf(c.id) >= 0); }).join('') + '</div></div>';
    }
    var whoGroup = (ui.sheet.scr === 'sug' || ui.sheet.scr === 'seen') ? '' : '<div class="fgroup"><h2>Qui veut le voir</h2><div class="seg" role="group" aria-label="Qui veut le voir">' + ['all', 'me', 'other', 'both'].map(function (w) { return '<button class="chip' + (ui.who === w ? ' on' : '') + '" data-act="tog" data-k="who" data-v="' + w + '" aria-pressed="' + (ui.who === w) + '">' + esc(whoLabel(w)) + '</button>'; }).join('') + '</div></div>';
    return '<div class="scrim" data-scrim="1"><div class="sheet fsheet" role="dialog" aria-modal="true" aria-label="Filtres"><div class="fhead"><h3>Filtres</h3><button class="icon" data-act="closesheet" aria-label="Fermer">' + I('close') + '</button></div>' +
      '<div class="fbody">' + whoGroup + colGroup +
      '<div class="fgroup"><h2>Plateformes</h2><div>' + (plats || '<span class="help">Choisissez d’abord vos plateformes dans les réglages.</span>') + '</div></div>' +
      '<div class="fgroup"><h2>Genres</h2><label for="gq" style="position:absolute;left:-9999px">Chercher un genre</label><input id="gq" class="fsearch" type="search" autocomplete="off" placeholder="Chercher un genre" value="' + esc(ui.fq) + '"><div id="glist">' + genreList() + '</div></div></div>' +
      '<div style="display:flex;gap:10px"><button class="btn ghost" style="flex:none;width:auto" data-act="resetf"' + (nFilters() ? '' : ' disabled') + '>Effacer</button><button class="btn" data-act="closesheet">Voir ' + N + ' titre' + (N > 1 ? 's' : '') + '</button></div></div></div>';
  }
  function acts(id, third) {
    return '<div style="display:flex;gap:8px;margin:-6px 0 0 64px;flex-wrap:wrap"><button class="chip" style="height:44px;padding:0 14px;background:var(--accent);border-color:var(--accent);color:var(--ink);font-weight:800" data-act="add" data-id="' + esc(id) + '">' + I('plus') + 'Ajouter</button><button class="chip" style="height:44px;padding:0 14px" data-act="already" data-id="' + esc(id) + '">' + I('check') + 'Déjà vu</button>' + (third || '') + '</div>';
  }
  function reasonHtml(parts) {
    if (!parts || !parts.length) return 'Proche de vos goûts';
    var recs = parts.filter(function (p) { return p.t; }), gen = parts.filter(function (p) { return p.g; }), h = [];
    if (recs.length) h.push('Proche de ' + recs.map(function (p) { return '<b>' + esc(p.t) + '</b> (' + esc(p.l) + ')'; }).join(' et de '));
    if (gen.length) h.push('Genres que vous aimez : ' + esc(gen[0].g));
    return h.join(' · ') || 'Proche de vos goûts';
  }
  function skeletons(n) { var h = ''; for (var i = 0; i < n; i++) h += '<div class="skel"></div>'; return '<div class="list" aria-busy="true">' + h + '</div>'; }
  function errBox(msg, act) { return '<div class="empty">' + esc(msg) + (act ? '<br><button class="link" data-act="' + act + '">Réessayer</button>' : '') + '</div>'; }
  // Clé TMDB : saisie ici (vérifiée puis chiffrée côté serveur), jamais dans un fichier.
  // Une clé API enregistrée s'affiche en lecture seule : modification et retrait sont des gestes explicites.
  function keyConfirmBox(k, what, act) {
    if (ui.keyConfirm !== k) return '';
    return '<div class="notice" role="alertdialog"><b>Retirer cette clé ?</b><br>' + esc(what) + '<div style="display:flex;gap:10px;margin-top:10px"><button class="btn ghost" style="height:44px" data-act="keycancel">Garder la clé</button><button class="btn" style="height:44px;background:var(--warn);color:var(--bg)" data-act="' + act + '">Oui, la retirer</button></div></div>';
  }
  function tmdbForm(first) {
    var T = CFG.tmdbKey || {}, editing = !T.hasKey || ui.keyEdit.tmdb;
    if (!editing) {
      return '<div class="group"><div class="card"><span class="ct"><b>Clé TMDB enregistrée</b><span>…' + esc(T.last4 || '') + (T.source === 'env' ? ' · fournie par le serveur' : '') + '</span></span><span class="st ok">Active</span></div>' +
        (T.source === 'app' ? '<div style="display:flex;gap:10px"><button class="btn ghost" style="height:44px" data-act="keyedit" data-v="tmdb">Modifier la clé</button><button class="btn ghost" style="height:44px" data-act="keyask" data-v="tmdb">Retirer</button></div>' : '') +
        keyConfirmBox('tmdb', 'Films et séries ne s’afficheront plus tant qu’aucune clé n’est enregistrée.', 'tmdbclear') +
        (ui.tmdbMsg ? '<div class="notice" role="status">' + esc(ui.tmdbMsg) + '</div>' : '') + '</div>';
    }
    return '<div class="group"><label for="tmdbkey" class="help" style="line-height:1.5">' + (first ? '<b style="color:var(--fg)">Dernière étape : la clé TMDB.</b> ' : '') +
      'TMDB fournit les films, séries, affiches et plateformes. Compte gratuit sur <a href="https://www.themoviedb.org/signup" target="_blank" rel="noopener" style="color:var(--fg)">themoviedb.org</a>, puis ' +
      '<a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener" style="color:var(--fg)">Réglages &gt; API</a> : copiez la « Clé d’API » (ou le « Jeton d’accès en lecture »).</label>' +
      '<input id="tmdbkey" class="kinput" type="password" autocomplete="off" placeholder="Collez la nouvelle clé TMDB">' +
      '<div style="display:flex;gap:10px"><button class="btn ghost" style="height:44px" data-act="tmdbsave"' + (ui.tmdbBusy ? ' disabled' : '') + '>' + (ui.tmdbBusy ? 'Vérification…' : 'Enregistrer et vérifier') + '</button>' +
      (T.hasKey ? '<button class="btn ghost" style="height:44px" data-act="keycancel">Annuler</button>' : '') + '</div>' +
      (ui.tmdbMsg ? '<div class="notice" role="status">' + esc(ui.tmdbMsg) + '</div>' : '') + '</div>';
  }
  function noTmdb() { return '<div class="notice">' + tmdbForm(true) + '</div>'; }

  function installBanner() {
    if (isStandalone() || installHidden()) return '';
    var hide = '<button class="icon" style="width:44px;height:44px;flex:none" data-act="installhide" aria-label="Masquer ce message">' + I('close') + '</button>';
    if (deferredInstall) return '<div class="inst" role="region" aria-label="Installer l’application"><div style="flex:1;min-width:0"><b>Installer Watch-It</b><span class="help" style="display:block">En plein écran, comme une appli.</span></div><button class="btn" data-act="install">Installer</button>' + hide + '</div>';
    if (isIOS()) return '<div class="inst" role="region" aria-label="Installer l’application"><div style="flex:1;min-width:0"><b>Installer Watch-It</b><span class="help" style="display:block">Dans Safari : touchez Partager, puis « Sur l’écran d’accueil ».</span></div>' + hide + '</div>';
    return '';
  }

  // ===================== Écrans =====================
  var V = {};

  // « Proposer ce soir » : une proposition à la fois dans S.tonight = {pid, id, t, y, ty, p, by, at, st:'pending'|'ok'|'no'} ; masquée dès le lendemain.
  function tonightLive() {
    var t = S.tonight; if (!t || !t.pid) return null;
    return t.at === todayISO() ? t : null;
  }
  function tonightBanner() {
    var t = tonightLive(), o = me === 'M' ? 'E' : 'M', ac = function (a, v) { return 'data-act="' + a + '" data-v="' + v + '"'; };
    if (!t) return '';
    var head = '<button class="row" style="gap:12px;align-items:center" data-act="open" data-id="' + esc(t.id) + '">' + poster(t, 'sm') + '<span class="rb"><span class="title" style="font-size:16px">' + esc(t.t) + '</span><span class="meta" style="font-size:12px">' + meta(t) + '</span></span></button>';
    if (t.st === 'ok') return '<div class="notice tonight" role="region" aria-label="Au programme ce soir"><b>★ Ce soir : vous êtes partants tous les deux</b>' + head + '<button class="link" style="min-height:44px" ' + ac('tonightclear', '') + '>Retirer</button></div>';
    if (t.st === 'pending' && t.by !== me) return '<div class="notice tonight" role="region" aria-label="Proposition pour ce soir"><b>' + esc(pname(t.by)) + ' propose ce soir</b>' + head + '<div class="decide"><button class="chip on" ' + ac('tonightans', 'ok') + '>Partant(e)</button><button class="chip" ' + ac('tonightans', 'no') + '>Pas ce soir</button></div></div>';
    if (t.st === 'pending') return '<div class="notice tonight"><b>Proposé à ' + esc(pname(o)) + '</b> · en attente' + head + '<button class="link" style="min-height:44px" ' + ac('tonightclear', '') + '>Annuler</button></div>';
    if (t.st === 'no' && t.by === me) return '<div class="notice tonight"><b>' + esc(pname(o)) + ' n’est pas partant(e) ce soir</b>' + head + '<button class="link" style="min-height:44px" ' + ac('tonightclear', '') + '>OK</button></div>';
    return '';
  }
  function matchInviteBanner() {
    var m = S.match, o = me === 'M' ? 'E' : 'M';
    if (!m || m.st !== 'wait' || m.by === me) return '';
    return '<button class="notice newsb" data-act="gomatch"><span><b>' + esc(pname(o)) + ' vous invite à un Match à deux</b><br><span class="help">' + (m.ty === 'film' ? 'Films' : m.ty === 'serie' ? 'Séries' : 'Films et séries') + ' · à accepter pour commencer</span></span>' + I('chev') + '</button>';
  }

  V.home = function () {
    var todo = S.list.filter(function (e) { return e.status === 'todo'; }).sort(function (a, b) { return a.at < b.at ? 1 : -1; });
    var nAv = todo.filter(function (e) { return avail(e).length; }).length;
    var shown = todo.filter(function (e) { return passes(e); });
    var sub = todo.length + ' titre' + (todo.length > 1 ? 's' : '') + (platsOn().length ? ' · ' + nAv + ' dispo sur vos plateformes' : '');
    var pend = pending(), o = me === 'M' ? 'E' : 'M';
    var newsBanner = pend.length ? '<button class="notice newsb" data-act="push" data-to="news"><span><b>' + esc(pname(o)) + ' a ajouté ' + pend.length + ' titre' + (pend.length > 1 ? 's' : '') + '</b><br><span class="help">Dites si vous voulez les voir aussi</span></span>' + I('chev') + '</button>' : '';
    return header('À voir', sub) + installBanner() + tonightBanner() + matchInviteBanner() + newsBanner + (!CFG.tmdb ? noTmdb() : '') +
      (!platsOn().length && todo.length ? '<div class="notice"><b>Choisissez vos plateformes</b> dans les <button class="link" style="padding:0;min-height:0;color:var(--fg)" data-act="push" data-to="settings">réglages</button> pour voir ce qui est disponible chez vous.</div>' : '') +
      filterBar('<button class="fbtn rand" data-act="draw">' + I('dice') + 'Au hasard</button>') +
      (shown.length ? '<div class="list">' + shown.map(function (e) { return rowHtml(e, e); }).join('') + '</div>' :
        '<div class="empty">' + (todo.length ? 'Aucun titre ne correspond à ces filtres.<br><button class="link" data-act="resetf">Effacer les filtres</button>' : 'Rien dans la liste pour l’instant.<br>Touchez + ou partagez un lien depuis Signal.') + '</div>');
  };

  V.news = function () {
    var o = me === 'M' ? 'E' : 'M', pend = pending();
    var rows = pend.map(function (e) {
      return '<div class="rowx">' + '<button class="row" data-act="open" data-id="' + esc(e.id) + '">' + poster(e) + '<span class="rb"><span class="rt"><span class="title">' + esc(e.t) + '</span></span><span class="meta">' + meta(e) + ' · ajouté le ' + esc(fmtDate(e.at)) + '</span>' + badges(e) + '</span></button>' +
        '<div class="decide"><button class="chip on" data-act="want" data-id="' + esc(e.id) + '" data-u="' + me + '">Moi aussi</button><button class="chip" data-act="nope" data-id="' + esc(e.id) + '">Pas pour moi</button></div></div>';
    }).join('');
    return '<header class="top tight">' + back() + '<h1 class="s">Ajoutés par ' + esc(pname(o)) + '</h1></header>' +
      '<p class="help" style="margin:0;line-height:1.5">Les titres que ' + esc(pname(o)) + ' a ajoutés et que vous n’avez pas encore choisis, du plus récent au plus ancien.</p>' +
      (rows ? '<div class="list">' + rows + '</div>' : '<div class="empty">Rien de nouveau : vous avez tout passé en revue.</div>');
  };

  V.seen = function () {
    var all = S.list.filter(function (e) { return e.status === 'seen'; }).sort(function (a, b) { return a.at < b.at ? 1 : -1; });
    var seen = all.filter(function (e) { return passes(e); });
    function th(e, u) { var r = e.r[u]; return '<span class="badge' + (r ? '' : ' mut') + '">' + esc(initial(u)) + ' ' + (r ? '★ ' + r : 'pas noté') + '</span>'; }
    return header('Vus', all.length + ' titre' + (all.length > 1 ? 's' : '') + ' · vos notes alimentent les suggestions') + filterBar() +
      (seen.length ? '<div class="list">' + seen.map(function (e) {
        return '<button class="row" data-act="open" data-id="' + esc(e.id) + '">' + poster(e) + '<span class="rb"><span class="title">' + esc(e.t) + '</span><span class="meta">' + meta(e) + '</span><span class="badges">' + th(e, 'M') + th(e, 'E') + '</span></span></button>';
      }).join('') + '</div>' : '<div class="empty">Rien de vu pour l’instant. Marquez un titre comme vu pour le noter.</div>');
  };

  V.detail = function () {
    var id = ui.detail, e = entry(id), d = ui.dd && ui.dd.id === id ? ui.dd : null, it = d || e || KNOWN[id];
    if (!it) return '<header class="top tight">' + back() + '</header><div class="empty">Titre introuvable.</div>';
    var yt = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(it.t + ' bande-annonce');
    var tr = d && d.trailer ? 'https://www.youtube.com/watch?v=' + encodeURIComponent(d.trailer) : null;
    var h = hueOf(it.t);
    var hero = '<div class="hero" style="background:' + (it.p ? 'linear-gradient(180deg,var(--shade),var(--bg)),url(' + IMG + 'w780' + esc(it.p) + ') center/cover' : 'linear-gradient(170deg,hsl(' + h + ' 38% 36%) 0%,hsl(' + h + ' 22% 18%) 55%,var(--bg) 100%)') + '">' + back() +
      (tr ? '<button class="play" data-act="trailer" data-k="' + esc(d.trailer) + '" aria-label="Voir la bande-annonce">' + I('play') + '</button><span class="hl">Bande-annonce</span>'
        : (d ? '<span class="hl">Pas de bande-annonce trouvée · <a href="' + yt + '" target="_blank" rel="noopener">chercher sur YouTube</a></span>' : '')) + '</div>';
    var where = '';
    if (d) {
      var f = d.av.f, shown = {};
      f.forEach(function (p) {
        var on = platsOn().indexOf(p) >= 0; shown[p] = 1;
        var lk = linkFor(d, p), body = logoOf(p) + '<span class="ct"><b>' + esc(pnameOf(p)) + '</b><span>' + (lk ? 'Ouvrir le titre sur ' + esc(pnameOf(p)) : 'Inclus dans l’abonnement') + '</span></span><span class="st ' + (on ? 'ok' : 'no') + '">' + (on ? 'Dans votre abo' : 'Pas dans vos abos') + '</span>' + (lk ? I('chev') : '');
        where += lk ? '<a class="card link-card' + (on ? '' : ' q') + '" href="' + esc(lk) + '" target="_blank" rel="noopener" aria-label="Ouvrir ' + esc(d.t) + ' sur ' + esc(pnameOf(p)) + '">' + body + '</a>' : '<div class="card' + (on ? '' : ' q') + '">' + body + '</div>';
      });
      var extra = [];
      function exLink(n, t) {
        var ls = ui.lk[d.id], b = brandOf(n), hit = saOn() && linkOpt('plat') && Array.isArray(ls) ? ls.filter(function (l) { return brandOf(l.name) === b; })[0] : null;
        return hit ? '<a href="' + esc(hit.link) + '" target="_blank" rel="noopener" style="color:var(--fg)">' + esc(n) + '</a> (' + t + ')' : esc(n + ' (' + t + ')');
      }
      d.avNames.r.forEach(function (n) { extra.push(exLink(n, 'location')); });
      d.avNames.b.forEach(function (n) { if (d.avNames.r.indexOf(n) < 0) extra.push(exLink(n, 'achat')); });
      if (extra.length) where += '<div class="card q"><span class="ct"><b>Location ou achat</b><span>' + extra.slice(0, 5).join(' · ') + '</span></span></div>';
      if (!where) where = '<div class="empty">Pas disponible en streaming dans votre région pour l’instant.</div>';
      if (shareLinks(d).length) where += '<button class="btn ghost" data-act="share" data-id="' + esc(id) + '">' + I('share') + ' Partager la fiche</button>';
      if (saOn() && linkOpt('plat') && ui.lk[id] === 'loading') where += '<span class="help">Recherche du lien direct…</span>';
    } else where = skeletons(1);
    var rates = '';
    if (e && e.status === 'seen') {
      rates = '<div class="group"><h2>Notre avis</h2>' + ['M', 'E'].map(function (u) {
        return '<div class="card"><span class="ava ' + u + '">' + esc(initial(u)) + '</span><span class="ct"><b>' + esc(pname(u)) + '</b></span>' + starRow(e.r[u] || 0, 'setr', 'data-id="' + esc(id) + '" data-u="' + u + '"', 'sm') + '</div>';
      }).join('') + '</div>';
    }
    var prog = '';
    if (e && e.ty === 'serie' && e.status === 'todo') {
      var a2 = d ? { se: d.seasonsInfo, last: d.lastEp, next: d.nextEp, ended: d.ended } : AV[id];
      if (a2 && a2.se && a2.se.length) {
        var p0 = e.prog || {}, nx = nextEp(e, a2), cnt = a2.se.filter(function (x) { return x.n === p0.s; })[0];
        var sOpts = '<option value="0"' + (!p0.s ? ' selected' : '') + '>Pas commencée</option>' + a2.se.map(function (x) { return '<option value="' + x.n + '"' + (x.n === p0.s ? ' selected' : '') + '>Saison ' + x.n + '</option>'; }).join('');
        var eOpts = '';
        if (cnt) { eOpts = '<option value="0"' + (!p0.e ? ' selected' : '') + '>Aucun épisode vu</option>'; for (var i = 1; i <= cnt.c; i++) eOpts += '<option value="' + i + '"' + (i === p0.e ? ' selected' : '') + '>Épisode ' + i + '</option>'; }
        var note2 = nx ? (airedUpTo(a2, nx) ? '' : '<span class="help">' + (a2.next && a2.next.date ? 'Prochain épisode le ' + esc(fmtDate(a2.next.date)) + '.' : 'Pas d’épisode de plus disponible pour l’instant.') + '</span>') : '<span class="help">' + (a2.ended ? 'Vous avez tout vu : marquez la série comme vue.' : 'À jour. ' + (a2.next && a2.next.date ? 'Prochain épisode le ' + esc(fmtDate(a2.next.date)) + '.' : '')) + '</span>';
        prog = '<div class="group"><h2>Où j’en suis</h2><div class="prog"><label for="prog-s" style="position:absolute;left:-9999px">Saison</label><select id="prog-s" class="fld">' + sOpts + '</select>' + (cnt ? '<label for="prog-e" style="position:absolute;left:-9999px">Épisode</label><select id="prog-e" class="fld">' + eOpts + '</select>' : '') + '</div>' +
          (nx && airedUpTo(a2, nx) ? '<button class="btn" data-act="epnext" data-id="' + esc(id) + '">J’ai vu S' + nx.s + 'E' + nx.e + '</button>' : '') + note2 + '</div>';
      }
    }
    var wg = '';
    if (e && e.status === 'todo') {
      wg = '<div class="group"><h2>Qui veut le voir ?</h2><div class="chips">' + ['M', 'E'].map(function (u) { var on = wants(e, u); return '<button class="chip p' + (on ? ' on' : '') + '" data-act="want" data-id="' + esc(id) + '" data-u="' + u + '" aria-pressed="' + on + '">' + esc(pname(u)) + '</button>'; }).join('') + '</div><span class="help">Ajouté par ' + esc(pname(e.by)) + ' le ' + fmtDate(e.at) + '</span></div>';
    }
    var colg = '';
    if (e) {
      var onC = S.collections.filter(function (c) { return (e.l || []).indexOf(c.id) >= 0; });
      var toks2 = onC.length ? '<div class="toks">' + onC.map(function (c) { return '<button class="tok" data-act="coltog" data-id="' + esc(id) + '" data-c="' + esc(c.id) + '" aria-label="Retirer de la liste ' + esc(c.name) + '">' + esc(c.name) + I('close') + '</button>'; }).join('') + '</div>' : '';
      var picker;
      if (!S.collections.length) picker = '<span class="help">Aucune liste pour l’instant. Créez-les dans <button class="link" style="padding:0;min-height:0;color:var(--fg)" data-act="push" data-to="settings">Réglages</button> &gt; Listes thématiques (« Halloween », « Avec les enfants »…).</span>';
      else if (ui.colOpen === id) picker = '<div class="combo"><label for="colq" style="position:absolute;left:-9999px">Chercher une liste</label><input id="colq" class="fsearch" type="search" autocomplete="off" placeholder="Chercher une liste" value="' + esc(ui.colq) + '"><div id="collist">' + colList(id) + '</div><button class="link" style="align-self:center" data-act="colclose">Fermer</button></div>';
      else picker = '<button class="btn ghost" style="height:44px" data-act="colopen" data-id="' + esc(id) + '">' + (onC.length ? 'Ajouter à une autre liste' : 'Ajouter à une liste') + '</button>';
      colg = '<div class="group"><h2>Listes</h2>' + toks2 + picker + '</div>';
    }
    var note = '';
    if (e) {
      var by = e.status === 'todo' ? '' : '<span class="help">Ajouté par ' + esc(pname(e.by)) + ' le ' + fmtDate(e.at) + '</span>';
      if (ui.noteEdit === id) note = '<div class="group"><h2>Notre note</h2><label for="note" style="position:absolute;left:-9999px">Note sur ce titre</label><textarea id="note" class="ta" rows="3" placeholder="Pourquoi on veut le voir, qui l’a conseillé…" data-draft="1">' + esc(ui.noteDraft != null ? ui.noteDraft : (e.note || '')) + '</textarea><div style="display:flex;gap:10px"><button class="btn ghost" style="height:44px" data-act="notecancel">Annuler</button><button class="btn" style="height:44px" data-act="notesave" data-id="' + esc(id) + '">Enregistrer</button></div></div>';
      else note = '<div class="group"><div class="sec"><h2>Notre note</h2><button class="link" style="min-height:44px" data-act="noteedit" data-id="' + esc(id) + '">' + (e.note ? 'Modifier' : 'Ajouter une note') + '</button></div>' + (e.note ? '<p class="syn" style="margin:0;white-space:pre-wrap;overflow-wrap:anywhere">' + esc(e.note) + '</p>' : '<span class="help">Pas de note pour l’instant.</span>') + by + '</div>';
    }
    var dock;
    var rm = '<button class="icon" style="width:52px;height:52px;border-radius:26px" data-act="remove" data-id="' + esc(id) + '" aria-label="Supprimer de la liste">' + I('trash') + '</button>';
    if (!e) dock = '<button class="btn" data-act="add" data-id="' + esc(id) + '">Ajouter à ma liste</button><button class="btn ghost" style="flex:none;width:auto" data-act="already" data-id="' + esc(id) + '">Déjà vu</button>';
    else if (e.status === 'todo') dock = '<button class="btn" data-act="askseen" data-id="' + esc(id) + '">Marquer comme vu</button>' + rm;
    else dock = '<button class="btn ghost" data-act="unseen" data-id="' + esc(id) + '">Remettre à voir</button>' + rm;
    var gen = (it.g || []).join(', ');
    var tn = tonightLive(), prop = tn && tn.id === id && tn.st !== 'no' ? '<span class="st ok">' + (tn.st === 'ok' ? 'Prévu ce soir' : 'Proposé ce soir') + '</span>' : '<button class="btn ghost" style="height:44px" data-act="tonight" data-id="' + esc(id) + '">Proposer ce soir à ' + esc(pname(me === 'M' ? 'E' : 'M')) + '</button>';
    where += prop;
    return hero + '<div class="group" style="gap:6px;margin-top:-6px"><h1>' + esc(it.t) + '</h1><span class="meta">' + meta(it) + (gen ? ' · ' + esc(gen) : '') + '</span></div>' +
      (d && d.ov ? '<p class="syn">' + esc(d.ov) + '</p>' : (d ? '' : '<div class="skel" style="height:72px"></div>')) +
      '<div class="group"><div class="sec"><h2>Où le voir</h2><span class="help">Source : TMDB / JustWatch</span></div>' + where + '</div>' + prog + epGuide(id, d, e) + rates + wg + colg + note + '<div class="dock">' + dock + '</div>';
  };

  // Guide des épisodes d'une série : une saison à la fois, avec les épisodes déjà vus cochés.
  function epGuide(id, d, e) {
    var se = d && d.seasonsInfo; if (!se || !se.length) return '';
    var h = '<div class="group"><div class="sec"><h2>Guide des épisodes</h2><button class="link" style="min-height:44px" data-act="epopen">' + (ui.epOpen ? 'Masquer' : 'Afficher') + '</button></div>';
    if (!ui.epOpen) return h + '</div>';
    var sn = ui.epSeason != null ? ui.epSeason : ((e && e.prog && e.prog.s) || se[0].n);
    h += '<label for="ep-season" style="position:absolute;left:-9999px">Saison</label><select id="ep-season" class="fld">' + se.map(function (x) { return '<option value="' + x.n + '"' + (x.n === sn ? ' selected' : '') + '>Saison ' + x.n + ' (' + x.c + ' épisode' + (x.c > 1 ? 's' : '') + ')</option>'; }).join('') + '</select>';
    var eps = ui.epData[id + ':' + sn];
    if (!eps) return h + (ui.epErr[id + ':' + sn] ? errBox(ui.epErr[id + ':' + sn], 'epretry') : skeletons(2)) + '</div>';
    if (!eps.length) return h + '<div class="empty">Aucun épisode référencé pour cette saison.</div></div>';
    var p = (e && e.prog) || {}, today = todayISO(), tracking = e && e.status === 'todo';
    h += '<div class="eps">' + eps.map(function (x) {
      var seen = !!e && (e.status === 'seen' || sn < (p.s || 0) || (sn === p.s && x.e <= (p.e || 0)));
      var aired = !!x.date && x.date <= today, key = sn + '-' + x.e, exp = !!ui.epExp[key];
      var chk = tracking ? (aired ? '<button class="epc' + (seen ? ' on' : '') + '" data-act="epset" data-s="' + sn + '" data-e="' + x.e + '" aria-pressed="' + seen + '" aria-label="' + (seen ? 'Épisode ' + x.e + ' vu' : 'Marquer vu jusqu’à l’épisode ' + x.e) + '">' + I('check') + '</button>' : '<span class="epc dis" aria-hidden="true"></span>') : (e ? '<span class="epc on" aria-hidden="true">' + I('check') + '</span>' : '<span class="epc dis" aria-hidden="true"></span>');
      return '<div class="ep">' + chk + '<button class="epi" data-act="epinfo" data-k="' + key + '" aria-expanded="' + exp + '"><span class="ept"><b>' + x.e + '.</b> ' + esc(x.name || 'Épisode ' + x.e) + '</span><span class="epm">' + (x.date ? esc(fmtDate(x.date)) + (aired ? '' : ' · à venir') : 'Date inconnue') + (x.len ? ' · ' + x.len + ' min' : '') + '</span>' + (x.ov ? '<span class="epo' + (exp ? ' open' : '') + '">' + esc(x.ov) + '</span>' : '') + '</button></div>';
    }).join('') + '</div>';
    if (!e) h += '<span class="help">Ajoutez la série à votre liste pour cocher les épisodes vus.</span>';
    else if (tracking) h += '<span class="help">Cochez le dernier épisode vu : les précédents sont cochés aussi.</span>';
    return h + '</div>';
  }
  function loadSeason(id, n) {
    var k = id + ':' + n; if (ui.epData[k]) return;
    delete ui.epErr[k];
    api('/api/title/' + encodeURIComponent(id) + '/season/' + n).then(function (eps) { ui.epData[k] = eps; })
      .catch(function (e) { ui.epErr[k] = e.message; })
      .finally(function () { if (ui.screen === 'detail' && ui.detail === id) safeRender(); });
  }

  function addResults() {
    var q = norm(ui.q);
    if (q.length < 2) return '<h2>Recherche</h2><div class="empty">Tapez au moins deux lettres : la recherche couvre tous les films et séries de TMDB.</div>';
    if (ui.srBusy && !ui.sr) return '<h2>Recherche…</h2>' + skeletons(3);
    if (!ui.sr) return '';
    if (ui.sr.error) return errBox(ui.sr.error);
    var list = ui.sr.items;
    var note = ui.srq ? '<span class="help">Titre repéré dans votre texte : « ' + esc(ui.srq) + ' »</span>' : '';
    return '<h2>' + list.length + ' résultat' + (list.length > 1 ? 's' : '') + '</h2>' + note + (list.length ? list.map(function (it) {
      var e = entry(it.id), a = AV[it.id] || (ui.sr.av && ui.sr.av[it.id]);
      var mine = a ? a.f.filter(function (p) { return platsOn().indexOf(p) >= 0; }) : [];
      var line = a ? (mine.length ? mine.map(pnameOf).join(', ') : (a.f.length ? 'Sur d’autres plateformes' : 'Pas en streaming')) : '';
      return '<div class="sug" style="align-items:center"><button class="row" style="gap:12px;align-items:center" data-act="open" data-id="' + esc(it.id) + '">' + poster(it, 'sm') + '<span class="rb"><span class="title" style="font-size:16px">' + esc(it.t) + '</span><span class="meta" style="font-size:12px">' + meta(it) + '</span>' + (line ? '<span class="meta" style="font-size:12px;color:' + (mine.length ? 'var(--ok)' : 'var(--warn)') + ';font-weight:600">' + esc(line) + '</span>' : '') + '</span></button>' +
        (e ? '<button class="round done" data-act="open" data-id="' + esc(it.id) + '" aria-label="Déjà dans la liste">' + I('check') + '</button>' : '<button class="round" data-act="add" data-id="' + esc(it.id) + '" aria-label="Ajouter ' + esc(it.t) + '">' + I('plus') + '</button>') + '</div>';
    }).join('') : '<div class="empty">Aucun titre trouvé. Essayez un autre mot, ou l’année entre parenthèses.</div>');
  }
  V.add = function () {
    return '<header class="top tight">' + back().replace('Retour', 'Fermer').replace(I('back'), I('close')) + '<h1 class="s">Ajouter</h1></header>' + (!CFG.tmdb ? noTmdb() : '') +
      '<div class="field"><label for="q" style="position:absolute;left:-9999px">Rechercher un film ou une série</label>' + I('search') + '<input id="q" class="input" type="search" autocomplete="off" placeholder="Un film, une série…" value="' + esc(ui.q) + '"></div>' +
      '<div class="tip">' + I('share') + '<span>Depuis Signal, un navigateur ou une appli de streaming : touchez Partager puis Watch-It. Le titre se cherche tout seul. (Appli installée sur Android.)</span></div>' +
      '<div class="group" id="results" style="gap:14px">' + addResults() + '</div>';
  };

  function sugState() { var k = ui.tab; var s = ui.sug[k]; if (!s || s.ver !== ui.sugVer) { if (!s || s.st !== 'loading') loadSug(k); s = ui.sug[k]; } return s; }
  function loadSug(tab) {
    var ver = ui.sugVer;
    ui.sug[tab] = Object.assign({}, ui.sug[tab] || {}, { st: 'loading', ver: ver, items: (ui.sug[tab] && ui.sug[tab].items) || null });
    api('/api/suggestions?tab=' + tab + '&me=' + me).then(function (items) {
      items.forEach(function (x) { know(x.item); });
      ui.sug[tab] = { st: 'ok', ver: ver, items: items };
    }).catch(function (e) { ui.sug[tab] = { st: 'err', ver: ver, err: e.message, items: null }; }).finally(function () {
      if (ui.screen === 'sug') safeRender();
    });
  }
  function soonState() {
    var s = ui.soon;
    if (!s || s.ver !== ui.sugVer) { if (!s || s.st !== 'loading') loadSoon(); s = ui.soon; }
    return s;
  }
  function loadSoon() {
    var ver = ui.sugVer;
    ui.soon = Object.assign({}, ui.soon || {}, { st: 'loading', ver: ver, items: (ui.soon && ui.soon.items) || null });
    api('/api/upcoming?me=' + me).then(function (items) {
      items.forEach(function (x) { know(x.item); });
      ui.soon = { st: 'ok', ver: ver, items: items };
    }).catch(function (e) { ui.soon = { st: 'err', ver: ver, err: e.message, items: null }; }).finally(function () { if (ui.screen === 'sug') safeRender(); });
  }
  V.sug = function () {
    var ot = other(me), tabs = [['me', pname(me)], ['other', pname(ot)], ['both', 'Nous deux'], ['soon', 'Bientôt']];
    var seg = '<div class="seg" role="tablist">' + tabs.map(function (t) { return '<button class="chip" style="padding:0 6px;font-size:13px;' + (ui.tab === t[0] ? 'background:var(--accent);border-color:var(--accent);color:var(--ink);font-weight:700' : '') + '" role="tab" aria-selected="' + (ui.tab === t[0]) + '" data-act="tab" data-v="' + t[0] + '">' + (t[0] === 'both' || t[0] === 'soon' ? esc(t[1]) : esc(t[1])) + '</button>'; }).join('') + '</div>';
    var body = '';
    if (ui.tab === 'soon') {
      var so = soonState(), cards;
      if (!CFG.tmdb) body += noTmdb();
      if (so && so.st === 'err') cards = errBox(so.err, 'retrysoon');
      else if (!so || (so.st === 'loading' && !so.items)) cards = skeletons(3);
      else cards = (so.items.length ? '<div class="list" style="gap:14px">' + so.items.map(function (x) {
        var it = x.item;
        return '<div class="sug"><button class="row" style="gap:12px" data-act="open" data-id="' + esc(it.id) + '">' + poster(it, 'sm') + '<span class="rb"><span class="title" style="font-size:16px">' + esc(it.t) + '</span><span class="meta" style="font-size:12px">' + meta(it) + '</span><span class="badges"><span class="badge go">Sortie le ' + esc(fmtDate(it.date)) + '</span></span><span class="why">' + esc(x.why) + '</span></span></button></div>' +
          '<div style="display:flex;gap:8px;margin:-6px 0 0 64px;flex-wrap:wrap"><button class="chip" style="height:44px;padding:0 14px;background:var(--accent);border-color:var(--accent);color:var(--ink);font-weight:800" data-act="add" data-id="' + esc(it.id) + '">' + I('plus') + 'Ajouter à voir</button><button class="chip" style="height:44px;padding:0 14px;color:var(--muted)" data-act="dismiss" data-id="' + esc(it.id) + '">Pas pour moi</button></div>';
      }).join('') + '</div>' : '<div class="empty">Rien de prévu qui corresponde à vos goûts pour le moment.</div>');
      return header('Pour vous', 'Sorties à venir proches de vos goûts') + seg + '<p class="help" style="margin:0">Dans les 5 prochains mois, selon vos genres préférés (' + esc(pname(me)) + ').</p>' + body + cards;
    }
    var s = sugState();
    if (!platsOn().length) body = '<div class="notice"><b>Choisissez vos plateformes</b> dans les <button class="link" style="padding:0;min-height:0;color:var(--fg)" data-act="push" data-to="settings">réglages</button> : les suggestions se limitent à ce que vous pouvez regarder.</div>';
    if (!CFG.tmdb) body += noTmdb();
    var cards = '';
    if (s && s.st === 'err') cards = errBox(s.err, 'retrysug');
    else if (!s || (s.st === 'loading' && !s.items)) cards = skeletons(3);
    else if (s.items) {
      var list = s.items.filter(function (x) { return passes(x.item); });
      var fresh = list.filter(function (x) { return x.isnew; });
      var dis = ui.tab === 'both' ? 'Pas pour nous' : 'Pas pour ' + pname(ui.tab === 'me' ? me : ot).toLowerCase();
      var card = function (x) {
        var it = x.item;
        return '<div class="sug"><button class="row" style="gap:12px" data-act="open" data-id="' + esc(it.id) + '">' + poster(it, 'sm') + '<span class="rb"><span class="title" style="font-size:16px">' + esc(it.t) + '</span><span class="meta" style="font-size:12px">' + meta(it) + '</span><span class="badges">' + it.av.f.filter(function (p) { return platsOn().indexOf(p) >= 0; }).map(platBadge).join('') + '</span><span class="why">' + reasonHtml(x.why) + '</span></span></button></div>' +
          acts(it.id, '<button class="chip" style="height:44px;padding:0 14px;color:var(--muted)" data-act="dismiss" data-id="' + esc(it.id) + '">' + esc(dis) + '</button>');
      };
      var PAGE = 6, off = ui.sugOff[ui.tab] || 0; if (off >= list.length) off = 0;
      var more = list.length > PAGE ? '<button class="btn ghost" data-act="sugmore">Autres suggestions <span class="help" style="margin-left:6px">' + (off + 1) + '–' + Math.min(off + PAGE, list.length) + ' sur ' + list.length + '</span></button>' : '';
      cards = (list.length ? '<div class="list" style="gap:14px">' + list.slice(off, off + PAGE).map(card).join('') + '</div>' + more : '<div class="empty">' + (s.items.length ? 'Aucune suggestion ne correspond à ces filtres.<br><button class="link" data-act="resetf">Effacer les filtres</button>' : 'Pas encore de suggestion. Notez quelques titres vus ou importez votre historique dans les réglages.') + '</div>') +
        (fresh.length ? '<h2 style="margin-top:6px">Récent sur vos plateformes</h2><div class="list" style="gap:14px">' + fresh.slice(0, 4).map(card).join('') + '</div>' : '');
      if (s.st === 'loading') cards = '<div aria-busy="true" style="opacity:.6">' + cards + '</div>';
    }
    return header('Pour vous', 'Selon ce que vous avez aimé et ajouté') + seg + (ui.tab === 'both' ? '<p class="help" style="margin:0">Titres qui plaisent aux deux profils.</p>' : '') + body + filterBar() + cards;
  };

  // Temps disponible : durée choisie, ou heure de début et de fin.
  function hm(m) { m = ((m % 1440) + 1440) % 1440; return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + (m % 60)).slice(-2); }
  function toMin(t) { var a = String(t || '').split(':'); return a.length === 2 ? Number(a[0]) * 60 + Number(a[1]) : null; }
  function nowRounded() { var d = new Date(), m = d.getHours() * 60 + d.getMinutes(); return hm(Math.ceil(m / 5) * 5); }
  function tbStart() { return ui.tb.start || nowRounded(); }
  function availMinutes() {
    var t = ui.tb;
    if (t.mode === 'dur') return t.min || 0;
    if (t.mode === 'end' && toMin(t.end) != null) { var d = toMin(t.end) - toMin(tbStart()); return d <= 0 ? d + 1440 : d; }
    return 0;
  }
  function endNote(it) {
    var m = availMinutes(); if (!m || !it.len) return '';
    var st = toMin(tbStart());
    if (it.ty === 'film') return ' · fini vers ' + hm(st + it.len);
    var n = Math.max(1, Math.min(6, Math.floor(m / it.len)));
    return ' · ' + n + ' épisode' + (n > 1 ? 's' : '') + ', fini vers ' + hm(st + n * it.len);
  }
  function timeBlock() {
    var t = ui.tb, m = availMinutes();
    var chips = [[0, 'Peu importe'], [60, '1 h'], [90, '1 h 30'], [120, '2 h'], [150, '2 h 30'], [180, '3 h']].map(function (c) {
      var on = c[0] === 0 ? t.mode === 'none' : (t.mode === 'dur' && t.min === c[0]);
      return '<button class="chip" style="height:40px;padding:0 14px;font-size:13px;' + (on ? 'background:var(--accent);border-color:var(--accent);color:var(--ink);font-weight:700' : 'color:var(--soft)') + '" data-act="tbdur" data-v="' + c[0] + '" aria-pressed="' + on + '">' + c[1] + '</button>';
    }).join('');
    var summary = !m ? 'Sans contrainte de durée.' : (t.mode === 'dur' ? fmtLen(m) + ' disponibles : à partir de ' + tbStart() + ', fini avant ' + hm(toMin(tbStart()) + m) + '.' : fmtLen(m) + ' entre ' + tbStart() + ' et ' + t.end + '.');
    return '<div class="group" style="gap:8px"><h2>Temps disponible</h2><div class="chips scroll">' + chips + '</div>' +
      '<div class="prog"><label class="help" for="tb-start" style="flex:none">De</label><input id="tb-start" type="time" class="fld" value="' + esc(tbStart()) + '" style="flex:1"><label class="help" for="tb-end" style="flex:none">à</label><input id="tb-end" type="time" class="fld" value="' + esc(t.end || '') + '" style="flex:1"></div>' +
      '<span class="help">' + esc(summary) + '</span></div>';
  }

  function matchMine(m) { return (m.votes && m.votes[me]) || {}; }
  function matchCur(m) { var v = matchMine(m); for (var i = 0; i < m.deck.length; i++) if (!v[m.deck[i].id]) return m.deck[i]; return null; }
  function matchResults(m) { var a = (m.votes && m.votes.M) || {}, b = (m.votes && m.votes.E) || {}; return m.deck.filter(function (c) { return a[c.id] === 1 && b[c.id] === 1; }); }
  function matchDone(m, u) { var v = (m.votes && m.votes[u]) || {}; return m.deck.every(function (c) { return v[c.id]; }); }
  // Résumé et bande-annonce d'une carte : gardés dans le paquet ; pour une ancienne partie, récupérés à l'affichage.
  function matchInfo(c) {
    if (typeof c.ov === 'string') return { ov: c.ov, tr: c.tr || null };
    var k = ui.mi[c.id];
    if (!k) { ui.mi[c.id] = { ov: '', tr: null, pending: true }; api('/api/title/' + encodeURIComponent(c.id)).then(function (d) { ui.mi[c.id] = { ov: (d.ov || '').slice(0, 280), tr: d.trailer || null }; }).catch(function () { ui.mi[c.id] = { ov: '', tr: null }; }).finally(function () { if (ui.screen === 'envies' && ui.cs === 'match') safeRender(); }); return { ov: '', tr: null }; }
    return k;
  }
  function platFull(id) { return '<span class="badge">' + logoOf(id) + esc(pnameOf(id)) + '</span>'; }

  function matchSrcSeg() {
    return '<div class="seg" role="group" aria-label="Origine des titres">' + [['mix', 'Mixte'], ['list', 'Ma liste'], ['out', 'Hors liste']].map(function (t) { return '<button class="chip' + (ui.matchSrc === t[0] ? ' on' : '') + '" aria-pressed="' + (ui.matchSrc === t[0]) + '" data-act="matchsrc" data-v="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>';
  }
  function matchTypeSeg() {
    return '<div class="seg" role="group" aria-label="Type de titres">' + [['all', 'Films et séries'], ['film', 'Films'], ['serie', 'Séries']].map(function (t) { return '<button class="chip' + (ui.matchTy === t[0] ? ' on' : '') + '" aria-pressed="' + (ui.matchTy === t[0]) + '" data-act="matchty" data-v="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>';
  }
  function matchView() {
    var m = S.match, ot = other(me), h = '';
    if (m && m.st === 'no' && m.by !== me) m = null; // refus : l'autre revoit l'écran de lancement
    if (ui.matchBusy) return skeletons(2);
    if (!m) {
      return '<div class="notice"><b>Match à deux.</b> Chacun de son côté (sur son téléphone), vous balayez une même sélection de titres : « Envie » ou « Pas envie ». Les titres que vous voulez tous les deux apparaissent ici.</div>' +
        matchTypeSeg() + matchSrcSeg() + '<span class="help">« Ma liste » : vos titres « À voir » disponibles chez vous. « Hors liste » : des suggestions. « Mixte » : moitié-moitié.</span><button class="btn" data-act="matchstart">Lancer et inviter ' + esc(pname(ot)) + '</button><span class="help">La sélection mélange votre liste « À voir » et des suggestions pour vous deux, sur vos plateformes.</span>';
    }
    var tyw = m.ty === 'film' ? 'de films' : m.ty === 'serie' ? 'de séries' : 'de films et séries';
    if (m.st === 'wait') {
      if (m.by === me) return '<div class="notice"><b>Invitation envoyée à ' + esc(pname(ot)) + '.</b> La partie ' + tyw + ' commencera dès qu’il ou elle l’aura acceptée.</div>' +
        '<button class="btn ghost" style="height:44px" data-act="matchinvite">Relancer ' + esc(pname(ot)) + ' (notification)</button><button class="btn ghost" style="height:44px" data-act="matchcancel">Annuler la partie</button>';
      return '<div class="notice"><b>' + esc(pname(m.by)) + ' vous invite à un Match à deux ' + tyw + '.</b> ' + m.deck.length + ' titres à balayer chacun de votre côté.</div>' +
        '<div class="decide"><button class="chip on" data-act="matchaccept">Accepter</button><button class="chip" data-act="matchdecline">Refuser</button></div>';
    }
    if (m.st === 'no' && m.by === me) return '<div class="notice"><b>' + esc(pname(ot)) + ' ne veut pas jouer pour l’instant.</b></div><button class="btn ghost" style="height:44px" data-act="matchcancel">OK</button>';
    var cur = matchCur(m), res = matchResults(m), tyl = (m.ty === 'film' ? 'Films' : m.ty === 'serie' ? 'Séries' : 'Films et séries') + (m.src === 'list' ? ' de la liste' : m.src === 'out' ? ' hors liste' : ''), voted = m.deck.filter(function (c) { return matchMine(m)[c.id]; }).length;
    if (cur) {
      var av = (cur.f || []).filter(function (p) { return platsOn().indexOf(p) >= 0; }), info = matchInfo(cur);
      h += '<span class="help" style="text-align:center">' + tyl + ' · titre ' + (voted + 1) + ' sur ' + m.deck.length + ' · vous votez en tant que ' + esc(pname(me)) + '</span>' +
        '<div class="mcard"><div class="mp" style="background:linear-gradient(160deg,hsl(' + hueOf(cur.t) + ' 38% 36%),hsl(' + hueOf(cur.t) + ' 24% 13%))">' + (cur.p ? '<img src="' + IMG + 'w342' + esc(cur.p) + '" alt="" onerror="this.remove()">' : '') + '<span>' + esc(cur.t.charAt(0)) + '</span></div>' +
        '<h2 style="font-family:var(--display);font-size:24px;font-weight:800;letter-spacing:-.01em;line-height:1.15;text-transform:none;color:var(--fg)">' + esc(cur.t) + '</h2><span class="meta">' + meta(cur) + (cur.g && cur.g.length ? ' · ' + esc(cur.g.slice(0, 2).join(', ')) : '') + '</span>' +
        '<div class="badges" style="justify-content:center">' + (av.length ? av.map(platFull).join('') : '<span class="badge mut">Pas sur vos plateformes</span>') + '</div>' +
        '<div class="mact"><button class="btn ghost" data-act="matchvote" data-id="' + esc(cur.id) + '" data-v="-1">Pas envie</button><button class="btn" data-act="matchvote" data-id="' + esc(cur.id) + '" data-v="1">Envie</button></div>' +
        '<button class="chip" style="height:44px;padding:0 16px" data-act="matchseen" data-id="' + esc(cur.id) + '">Déjà vu</button>' +
        (info.tr ? '<button class="chip" style="height:44px;padding:0 16px" data-act="trailer" data-k="' + esc(info.tr) + '">' + I('play').replace('class="ico "', 'class="ico" style="width:14px;height:14px;fill:currentColor;stroke:none"') + 'Bande-annonce</button>' : '') +
        (info.ov ? '<p class="syn" style="text-align:left;margin:0">' + esc(info.ov) + '</p>' : '') + '</div>';
    } else {
      h += '<div class="notice"><b>Vous avez tout balayé.</b> ' + (matchDone(m, ot) ? 'Partie terminée.' : 'En attente de ' + esc(pname(ot)) + ' (' + m.deck.filter(function (c) { return ((m.votes[ot] || {})[c.id]); }).length + ' sur ' + m.deck.length + ').') + '</div>';
    }
    h += '<div class="group"><div class="sec"><h2>Matchs</h2><span class="mbad">' + res.length + '</span></div>' + (res.length ? res.map(function (c) {
      var inL = entry(c.id);
      return '<div class="sug" style="align-items:center"><button class="row" style="gap:12px;align-items:center" data-act="open" data-id="' + esc(c.id) + '">' + poster(c, 'sm') + '<span class="rb"><span class="title" style="font-size:16px">' + esc(c.t) + '</span><span class="meta" style="font-size:12px">' + meta(c) + '</span></span></button>' +
        (inL ? '<span class="st ok">' + (inL.status === 'seen' ? 'Vu' : 'Dans la liste') + '</span>' : '') + '</div>';
    }).join('') : '<div class="empty">Pas encore de titre voulu par vous deux.</div>') + '</div>' +
      '<div class="group"><h2>Nouvelle partie</h2>' + matchTypeSeg() + matchSrcSeg() + '<button class="btn ghost" style="height:44px" data-act="matchstart">Lancer et inviter ' + esc(pname(ot)) + '</button></div>';
    return h;
  }

  V.envies = function () {
    var csw = '<div class="seg" role="tablist">' + [['envie', 'Une envie'], ['match', 'Match à deux']].map(function (t) { return '<button class="chip' + (ui.cs === t[0] ? ' on' : '') + '" role="tab" aria-selected="' + (ui.cs === t[0]) + '" data-act="cs" data-v="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>';
    if (ui.cs === 'match') return header('Ce soir', '') + csw + (!CFG.tmdb ? noTmdb() : '') + matchView();
    var chips = ['Cosy', 'Frissons sans gore', 'Un épisode de 40 min'].map(function (t) { return '<button class="chip" style="height:36px;padding:0 14px;font-size:13px;color:var(--soft)" data-act="chip" data-v="' + esc(t) + '">' + t + '</button>'; }).join('');
    var r = ui.env, out = '';
    if (ui.envBusy) out = '<div class="spin">' + (CFG.ai.hasKey ? esc(PROVS[CFG.ai.provider]) + ' réfléchit…' : 'Recherche…') + '</div>' + skeletons(2);
    else if (r && r.error) out = errBox(r.error);
    else if (r) {
      var one = function (it, why, add) {
        var a = AV[it.id] || { f: it.av ? it.av.f : [], r: [], b: [], trailer: false };
        return '<div class="sug"><button class="row" style="gap:12px" data-act="open" data-id="' + esc(it.id) + '">' + poster(it, 'sm') + '<span class="rb"><span class="title" style="font-size:16px">' + esc(it.t) + '</span><span class="meta" style="font-size:12px">' + meta(it) + '</span><span class="badges">' + a.f.filter(function (p) { return platsOn().indexOf(p) >= 0; }).map(platBadge).join('') + '</span><span class="why">' + esc(why + endNote(it)) + '</span></span></button></div>' + (add ? acts(it.id, '') : '');
      };
      var mine = r.inList.map(function (x) { return { it: entry(x.id), why: x.why }; }).filter(function (x) { return x.it; });
      out = (r.note ? '<div class="notice">' + esc(r.note) + '</div>' : '') +
        (mine.length ? '<h2>Dans votre liste</h2><div class="list" style="gap:14px">' + mine.map(function (x) { return one(x.it, x.why, false); }).join('') + '</div>' : '') +
        (r.fresh.length ? '<h2 style="margin-top:6px">Nouvelles suggestions</h2><div class="list" style="gap:14px">' + r.fresh.map(function (x) { know(x.item); return one(x.item, x.why, !entry(x.item.id)); }).join('') + '</div>' : '') +
        (!mine.length && !r.fresh.length ? '<div class="empty">Rien ne correspond exactement. Essayez d’assouplir une contrainte (durée, ton).</div>' : '');
    }
    return header('Ce soir', '') + csw + (!CFG.tmdb ? noTmdb() : '') +
      '<label for="envie" style="position:absolute;left:-9999px">Décrivez votre envie</label><textarea id="envie" class="ta hi" rows="3" placeholder="Quelque chose de léger, moins de 2 h, qui ne fait pas trop peur…">' + esc(ui.envie) + '</textarea>' +
      '<div class="chips scroll">' + chips + '</div>' + timeBlock() +
      '<div style="display:flex;gap:10px;align-items:center"><button class="btn" data-act="envie"' + (ui.envBusy ? ' disabled' : '') + '>Trouver</button><span class="help" style="flex:none;text-align:right">' + (CFG.ai.hasKey ? 'via ' + esc(PROVS[CFG.ai.provider]) : 'mots-clés') + '<br>vos plateformes</span></div>' +
      (!CFG.ai.hasKey ? '<div class="tip">' + I('spark') + '<span>Sans clé API, la recherche repère des mots-clés (durée, ton, série ou film). Ajoutez une clé dans les <button class="link" style="padding:0;min-height:0;color:var(--fg)" data-act="push" data-to="settings">réglages</button> pour décrire librement vos envies.</span></div>' : '') + out;
  };

  function pushSection() {
    var P = ui.push, lbl, btns = '', help;
    if (P.st === 'unsupported') { lbl = '<span class="st no">Indisponible</span>'; help = 'Ce navigateur ne gère pas les notifications. Sur iPhone, ajoutez d’abord l’appli à l’écran d’accueil.'; }
    else if (P.st === 'denied') { lbl = '<span class="st bad">Bloquées</span>'; help = 'Les notifications sont bloquées pour ce site : autorisez-les dans les réglages du navigateur.'; }
    else if (P.st === 'on') { lbl = '<span class="st ok">Activées</span>'; help = 'Choisissez ci-dessous ce qui vous est notifié sur cet appareil.'; btns = '<button class="btn ghost" style="height:44px" data-act="pushtest">Envoyer un test</button><button class="btn ghost" style="height:44px" data-act="pushoff">Désactiver</button>'; }
    else { lbl = '<span class="st no">Désactivées</span>'; help = 'Recevez une notification quand un titre de votre liste quitte l’une de vos plateformes. À activer sur chaque appareil.'; btns = '<button class="btn ghost" style="height:44px" data-act="pushon">Activer sur cet appareil</button>'; }
    var kinds = '';
    if (P.st === 'on' && P.prefs) {
      var o = me === 'M' ? 'E' : 'M';
      kinds = '<div class="group"><h2>Me prévenir quand</h2>' + [['added', pname(o) + ' ajoute un titre', 'Regroupé si elle en ajoute plusieurs d’un coup.'], ['release', 'Un titre de ma liste sort', 'Pour les titres ajoutés avant leur sortie, le jour J.'], ['gone', 'Un titre quitte mes plateformes', 'Vérifié toutes les 6 h.'], ['match', pname(o) + ' lance un Match à deux', 'Invitation à jouer.'], ['tonight', pname(o) + ' propose un titre ce soir', 'Et sa réponse à votre proposition.']].map(function (k) {
        var on = P.prefs[k[0]] !== false;
        return '<button class="card" style="text-align:left;width:100%" data-act="pushpref" data-k="' + k[0] + '" aria-pressed="' + on + '"><span class="ct"><b>' + esc(k[1]) + '</b><span>' + esc(k[2]) + '</span></span><span class="st ' + (on ? 'ok' : 'no') + '">' + (on ? 'Oui' : 'Non') + '</span></button>';
      }).join('') + (P.prefs.release !== false ? '<div class="card"><span class="ct"><label for="pushhour"><b>Heure de la notification de sortie</b></label><span>Envoyée ce jour-là à l’heure choisie (heure de Bruxelles).</span></span><select id="pushhour" class="fld" style="width:auto" aria-label="Heure">' + Array.apply(null, Array(24)).map(function (_, h) { return '<option value="' + h + '"' + (h === P.prefs.hour ? ' selected' : '') + '>' + h + ' h</option>'; }).join('') + '</select></div>' : '') + '<span class="help">Cet appareil est réglé sur le profil « ' + esc(pname(me)) + ' ». Pour changer, réactivez les notifications après avoir choisi le profil.</span></div>';
    }
    return '<div class="group"><div class="sec"><h2>État</h2>' + lbl + '</div>' + (btns ? '<div style="display:flex;gap:10px">' + btns + '</div>' : '') + (P.msg ? '<div class="notice" role="status">' + esc(P.msg) + '</div>' : '') + '<span class="help">' + help + '</span></div>' + kinds;
  }
  // Réglages : un menu de rubriques, chacune dans sa page (ui.sset).
  function platRows() {
    var q = norm(ui.pvq);
    if (!PVL.length) return '<span class="help">Chargement des plateformes…</span>';
    var fams = famsOf(PVL.map(function (p) { return p.id; })).filter(function (f) { return !q || norm(f.name).indexOf(q) >= 0; });
    if (!fams.length) return '<span class="help">Aucune plateforme ne correspond à « ' + esc(ui.pvq) + ' ».</span>';
    return fams.map(function (f) { var on = f.ids.some(function (x) { return platsOn().indexOf(x) >= 0; }); return crow('mp', f.ids.join(','), f.name, on ? 'Choisie' : '', on, logoOf(f.first)); }).join('');
  }
  function mrow(key, icon, title, sub) {
    return '<button class="mi" data-act="sset" data-v="' + key + '">' + I(icon, '') + '<span class="ct"><b>' + title + '</b><span>' + sub + '</span></span>' + I('chev') + '</button>';
  }
  function subHeader(title) { return '<header class="top tight">' + back() + '<h1 class="s">' + title + '</h1></header>'; }

  function setMenu() {
    var T = CFG.tmdbKey || {}, A = CFG.ai, np = selFams().length;
    var plSub = np ? np + ' choisie' + (np > 1 ? 's' : '') + ' : ' + esc(selFams().slice(0, 3).map(function (f) { return f.name; }).join(', ') + (np > 3 ? '…' : '')) : '<span class="w">Aucune choisie</span>';
    var shSub = [linkOpt('tmdb') ? 'TMDB / JustWatch' : '', linkOpt('plat') ? (saOn() ? 'Plateforme' : '') : ''].filter(Boolean).join(' + ') || 'Aucun lien';
    var tmSub = T.hasKey ? 'Clé enregistrée' : '<span class="w">À configurer : sans clé, rien ne s’affiche</span>';
    var aiSub = A.hasKey ? esc(PROVS[A.provider]) + (A.tested ? ' · testé' : ' · non testé') : 'Facultatif · non configuré';
    var P = ui.push, pSub = P.st === 'on' ? 'Activées sur cet appareil' : (P.st === 'denied' ? 'Bloquées par le navigateur' : (P.st === 'unsupported' ? 'Indisponibles ici' : 'Désactivées'));
    return '<header class="top tight">' + back() + '<h1 class="s">Réglages</h1></header>' +
      '<div class="who"><span class="av">' + esc((currentUsername || '?').charAt(0).toUpperCase()) + '</span><div style="display:flex;flex-direction:column;gap:2px;min-width:0"><span class="help">Connecté en tant que</span><b style="font-size:16px;overflow-wrap:anywhere">' + esc(currentUsername || 'identifiant inconnu') + '</b></div></div>' +
      '<div class="group"><h2>Cet appareil est utilisé par</h2><div class="seg">' + ['M', 'E'].map(function (u) { return '<button class="chip' + (me === u ? ' on' : '') + '" data-act="profile" data-u="' + u + '" aria-pressed="' + (me === u) + '"><span class="ava ' + u + '">' + esc(initial(u)) + '</span>' + esc(pname(u)) + '</button>'; }).join('') + '</div></div>' +
      '<div class="group"><h2>Notre foyer</h2><div class="menu">' + mrow('plats', 'play', 'Plateformes de streaming', plSub) + mrow('profils', 'checkc', 'Profils', esc(pname('M') + ' · ' + pname('E'))) + mrow('lists', 'list', 'Listes thématiques', S.collections.length + ' liste' + (S.collections.length > 1 ? 's' : '')) + '</div></div>' +
      '<div class="group"><h2>Services</h2><div class="menu">' + mrow('tmdb', 'search', 'Films et séries (TMDB)', tmSub) + mrow('share', 'share', 'Partage des fiches', shSub) + mrow('ai', 'spark', 'Assistant d’envies', aiSub) + mrow('notif', 'dice', 'Notifications', pSub) + '</div></div>' +
      '<div class="group"><h2>Données</h2><div class="menu"><button class="mi" data-act="push" data-to="import">' + I('dl').replace('class="ico "', 'class="ico" style="stroke:var(--accent)"') + '<span class="ct"><b>Importer nos films et séries vus</b><span>Liste, CSV, Letterboxd, Trakt, Netflix</span></span>' + I('chev') + '</button>' +
      '<button class="mi" data-act="export">' + I('ul') + '<span class="ct"><b>Exporter la liste</b><span>Fichier CSV</span></span></button></div></div>' +
      '<div class="group"><h2>Application</h2><div class="menu">' + mrow('install', 'dl', 'Installer l’application', isStandalone() ? 'Déjà installée' : (deferredInstall ? 'Disponible : touchez pour installer' : 'Mode d’emploi')) + mrow('theme', 'gear', 'Apparence', THEME === 'light' ? 'Clair' : (THEME === 'auto' ? 'Automatique' : 'Sombre')) + mrow('account', 'out', 'Compte', 'Identifiant, mot de passe, déconnexion') + '</div></div>' +
      '<p class="cred">Films, séries, affiches et bandes-annonces : TMDB. Ce produit utilise l’API TMDB mais n’est ni approuvé ni certifié par TMDB. Informations « où regarder » : JustWatch, via TMDB.</p>';
  }

  function setPlats() {
    var fams = selFams();
    var region = '<select id="region" class="fld" aria-label="Pays">' + REGIONS.map(function (r) { return '<option value="' + r[0] + '"' + (S.settings.region === r[0] ? ' selected' : '') + '>' + r[1] + '</option>'; }).join('') + '</select>';
    var sel = fams.length ? fams.map(function (f) {
      return '<div class="card"><span style="display:flex;align-items:center">' + logoOf(f.first) + '</span><span class="ct"><b>' + esc(f.name) + '</b></span><button class="link" style="min-height:44px" data-act="tog" data-k="mp" data-v="' + f.ids.join(',') + '" aria-label="Retirer ' + esc(f.name) + '">Retirer</button></div>';
    }).join('') : '<div class="empty">Aucune plateforme choisie pour l’instant.<br>Cochez ci-dessous celles auxquelles vous êtes abonnés.</div>';
    var region0 = (REGIONS.filter(function (r) { return r[0] === S.settings.region; })[0] || [S.settings.region, S.settings.region])[1];
    var nAll = famsOf(PVL.map(function (p) { return p.id; })).length;
    return subHeader('Plateformes') +
      '<div class="group"><div class="sec"><h2>Mes plateformes</h2><span class="st ' + (fams.length ? 'ok' : 'no') + '">' + fams.length + ' choisie' + (fams.length > 1 ? 's' : '') + '</span></div>' + sel + '</div>' +
      '<div class="group"><h2>Pays</h2>' + region + '<span class="help">Les plateformes proposées et les disponibilités dépendent du pays. Changer de pays remet la liste à zéro.</span></div>' +
      '<div class="group"><div class="sec"><h2>Toutes les plateformes · ' + esc(region0) + '</h2><span class="help">' + nAll + ' disponible' + (nAll > 1 ? 's' : '') + '</span></div>' +
      '<label for="pvq" style="position:absolute;left:-9999px">Chercher une plateforme</label><input id="pvq" class="fsearch" type="search" autocomplete="off" placeholder="Chercher (Netflix, Max, Canal+…)" value="' + esc(ui.pvq) + '">' +
      '<div id="pvlist">' + platRows() + '</div><span class="help">Source : TMDB / JustWatch. Les variantes d’une même plateforme (par exemple « avec publicités ») sont regroupées : choisir « Amazon Prime Video » couvre toutes ses versions.</span></div>';
  }

  function setProfils() {
    var cnt = { M: 0, E: 0 };
    S.list.forEach(function (e) { if (e.status === 'seen') { if (e.r.M) cnt.M++; if (e.r.E) cnt.E++; } });
    var af = S.settings.addFor === 'both' ? 'both' : 'me';
    var addFor = '<div class="group"><h2>Quand j’ajoute un titre à voir</h2><div class="seg" role="group" aria-label="Qui veut le voir par défaut">' + [['me', 'Moi seul'], ['both', 'Nous deux']].map(function (x) { return '<button class="chip' + (af === x[0] ? ' on' : '') + '" data-act="addfor" data-v="' + x[0] + '" aria-pressed="' + (af === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div><span class="help">' + (af === 'both' ? 'Le titre est marqué comme voulu par vous deux ; l’autre n’est pas notifié. Chacun peut retirer son envie depuis la fiche.' : 'Seul celui qui l’ajoute le veut ; l’autre est notifié et peut répondre « Moi aussi ».') + '</span></div>';
    return subHeader('Profils') +
      '<p class="help" style="margin:0;line-height:1.5">Le foyer partage un seul compte, avec deux profils : chacun a ses propres notes et ses suggestions.</p>' +
      '<div class="group"><div class="pwd"><label class="help" for="pn-M">Premier profil</label><input id="pn-M" class="fld" data-prof="M" value="' + esc(pname('M')) + '" maxlength="20"><label class="help" for="pn-E">Second profil</label><input id="pn-E" class="fld" data-prof="E" value="' + esc(pname('E')) + '" maxlength="20"></div></div>' +
      addFor +
      '<span class="help">' + esc(pname('M')) + ' : ' + cnt.M + ' titre' + (cnt.M > 1 ? 's' : '') + ' noté' + (cnt.M > 1 ? 's' : '') + ' · ' + esc(pname('E')) + ' : ' + cnt.E + ' titre' + (cnt.E > 1 ? 's' : '') + ' noté' + (cnt.E > 1 ? 's' : '') + '</span>';
  }

  function setLists() {
    return subHeader('Listes thématiques') +
      '<p class="help" style="margin:0;line-height:1.5">Rangez un titre dans une ou plusieurs listes depuis sa fiche, puis filtrez « À voir » par liste.</p>' +
      '<div class="group">' + (S.collections.length ? S.collections.map(function (c) {
        var n = S.list.filter(function (e) { return (e.l || []).indexOf(c.id) >= 0; }).length;
        return '<div style="display:flex;gap:8px;align-items:center"><label for="cn-' + esc(c.id) + '" style="position:absolute;left:-9999px">Nom de la liste</label><input id="cn-' + esc(c.id) + '" class="fld" data-colname="' + esc(c.id) + '" value="' + esc(c.name) + '" maxlength="30"><span class="help" style="flex:none">' + n + '</span><button class="icon" data-act="coldel" data-c="' + esc(c.id) + '" aria-label="Supprimer la liste ' + esc(c.name) + '">' + I('trash') + '</button></div>';
      }).join('') : '<div class="empty">Aucune liste pour l’instant.</div>') +
      '<div style="display:flex;gap:8px"><label for="newcol" style="position:absolute;left:-9999px">Nouvelle liste</label><input id="newcol" class="fld" maxlength="30" placeholder="Nouvelle liste" autocomplete="off"><button class="btn ghost" style="flex:none;width:auto;height:48px" data-act="colnew">Créer</button></div></div>';
  }

  function setTmdb() {
    var T = CFG.tmdbKey || {};
    return subHeader('Films et séries (TMDB)') +
      '<div class="sec"><h2>Clé TMDB</h2>' + (T.hasKey ? '<span class="st ok">Clé enregistrée</span>' : '<span class="st bad">Aucune clé</span>') + '</div>' +
      (T.source === 'env' ? '<span class="help">Clé fournie par le serveur (variable d’environnement).</span>' : '') + tmdbForm(false) +
      '<p class="cred">Films, séries, affiches et bandes-annonces : TMDB. Ce produit utilise l’API TMDB mais n’est ni approuvé ni certifié par TMDB. Informations « où regarder » : JustWatch, via TMDB.</p>';
  }

  function setShare() {
    var K = CFG.streaming || {}, editing = !K.hasKey || ui.keyEdit.sa, m = ui.saMode || K.mode || 'direct';
    function opt(k, title, sub, off) { var on = linkOpt(k) && !off; return '<button class="card" style="text-align:left;width:100%"' + (off ? ' disabled' : '') + ' data-act="linkopt" data-k="' + k + '" aria-pressed="' + on + '"><span class="ct"><b>' + title + '</b><span>' + sub + '</span></span><span class="st ' + (on ? 'ok' : 'no') + '">' + (on ? 'Activé' : 'Désactivé') + '</span></button>'; }
    var keyBlock;
    if (!editing) {
      keyBlock = '<div class="card"><span class="ct"><b>Streaming Availability</b><span>Clé enregistrée (…' + esc(K.last4 || '') + ') · ' + (K.mode === 'rapid' ? 'RapidAPI' : 'accès direct') + '</span></span><span class="st ok">Active</span></div>' +
        '<div style="display:flex;gap:10px"><button class="btn ghost" style="height:44px" data-act="keyedit" data-v="sa">Modifier</button><button class="btn ghost" style="height:44px" data-act="keyask" data-v="sa">Retirer</button></div>' +
        keyConfirmBox('sa', 'Les fiches ne proposeront plus le lien direct vers la plateforme.', 'saclear');
    } else {
      keyBlock = '<span class="help" style="line-height:1.5">Facultatif. <b style="color:var(--fg)">Streaming Availability</b> donne le lien direct du titre chez Netflix, Prime, Disney+, Max… Compte gratuit sur <a href="https://developers.movieofthenight.com/" target="_blank" rel="noopener" style="color:var(--fg)">developers.movieofthenight.com</a> (ou via <a href="https://rapidapi.com/movie-of-the-night-movie-of-the-night-default/api/streaming-availability" target="_blank" rel="noopener" style="color:var(--fg)">RapidAPI</a>). Vérifiez le quota gratuit sur leur page tarifs.</span>' +
        '<div class="seg" role="group" aria-label="Origine de la clé">' + [['direct', 'Accès direct'], ['rapid', 'RapidAPI']].map(function (x) { return '<button class="chip' + (m === x[0] ? ' on' : '') + '" data-act="samode" data-v="' + x[0] + '" aria-pressed="' + (m === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div>' +
        '<label for="sakey" style="position:absolute;left:-9999px">Clé Streaming Availability</label><input id="sakey" class="kinput" type="password" autocomplete="off" placeholder="Collez la clé API">' +
        '<div style="display:flex;gap:10px"><button class="btn ghost" style="height:44px" data-act="sasave"' + (ui.saBusy ? ' disabled' : '') + '>' + (ui.saBusy ? 'Vérification…' : 'Enregistrer et vérifier') + '</button>' + (K.hasKey ? '<button class="btn ghost" style="height:44px" data-act="keycancel">Annuler</button>' : '') + '</div>';
    }
    return subHeader('Partage des fiches') +
      '<div class="group"><h2>Liens à afficher et à partager</h2>' + opt('tmdb', 'Fiche TMDB / JustWatch', 'Page du titre avec les plateformes de votre pays, en français. Fonctionne toujours.') +
      opt('plat', 'Fiche de la plateforme', saOn() ? 'Lien direct vers le titre chez Netflix, Prime, etc.' : 'Demande la clé Streaming Availability ci-dessous.', !saOn()) + '</div>' +
      '<div class="group"><h2>Lien direct (facultatif)</h2>' + keyBlock + (ui.saMsg ? '<div class="notice" role="status">' + esc(ui.saMsg) + '</div>' : '') +
      '<span class="help">La clé reste sur votre serveur, chiffrée. Chaque fiche ouverte envoie à ce service l’identifiant TMDB du titre et votre pays ; le résultat est gardé 24 h.</span></div>';
  }

  function setAi() {
    var A = CFG.ai, editing = !A.hasKey || ui.keyEdit.ai;
    var head = subHeader('Assistant d’envies') + '<p class="help" style="margin:0;line-height:1.5">Facultatif. Avec une clé API, « Ce soir » comprend vos envies écrites librement. Sans clé, la recherche reste possible par mots-clés.</p>';
    var foot = '<span class="help">La clé reste sur votre serveur, chiffrée : le navigateur ne la revoit jamais. Chaque recherche « Ce soir » envoie votre phrase et une courte liste de titres au fournisseur choisi.</span>';
    if (!editing) {
      return head + '<div class="group"><div class="card"><span class="ct"><b>' + esc(PROVS[A.provider]) + '</b><span>Clé enregistrée (…' + esc(A.last4 || '') + ') · ' + esc(A.model || '') + '</span></span>' + (A.tested ? '<span class="st ok">Testée</span>' : '<span class="st no">Non testée</span>') + '</div>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn ghost" style="height:44px;flex:1 1 40%" data-act="keyedit" data-v="ai">Modifier</button><button class="btn ghost" style="height:44px;flex:1 1 40%" data-act="aitest"' + (ui.aiBusy ? ' disabled' : '') + '>' + (ui.aiBusy ? 'Test…' : 'Tester') + '</button><button class="btn ghost" style="height:44px;flex:1 1 40%" data-act="keyask" data-v="ai">Retirer</button></div>' +
        keyConfirmBox('ai', 'La recherche « Ce soir » reviendra aux mots-clés.', 'aiclear') +
        (ui.aiMsg ? '<div class="notice" role="status">' + esc(ui.aiMsg) + '</div>' : '') + foot + '</div>';
    }
    return head + '<div class="group"><h2>Fournisseur</h2><div class="seg">' + Object.keys(PROVS).map(function (p) { return '<button class="chip" style="' + (A.provider === p ? 'background:var(--surface2);border-color:var(--accent)' : '') + '" data-act="aiprov" data-v="' + p + '" aria-pressed="' + (A.provider === p) + '">' + PROVS[p] + '</button>'; }).join('') + '</div>' +
      '<label for="key" style="position:absolute;left:-9999px">Clé API ' + esc(PROVS[A.provider]) + '</label><input id="key" class="kinput" type="password" autocomplete="off" placeholder="' + (A.hasKey ? 'Nouvelle clé (laisser vide pour garder l’actuelle)' : 'Collez votre clé API ' + esc(PROVS[A.provider])) + '">' +
      '<div class="group" style="gap:6px"><label for="aimodel" class="help">Modèle (à changer seulement si le fournisseur retire l’actuel)</label><input id="aimodel" class="fld" autocomplete="off" autocapitalize="off" spellcheck="false" value="' + esc(ui.aiDraftModel != null ? ui.aiDraftModel : ((A.models && A.models[A.provider] && A.models[A.provider].model) || '')) + '" placeholder="' + esc((A.models && A.models[A.provider] && A.models[A.provider].def) || '') + '">' +
      (ui.aiModels ? '<span class="help">' + ui.aiModels.length + ' modèle' + (ui.aiModels.length > 1 ? 's' : '') + ' disponible' + (ui.aiModels.length > 1 ? 's' : '') + ' (les plus récents en premier)</span><div class="chips" style="max-height:200px;overflow:auto">' + (ui.aiModels.length ? ui.aiModels.map(function (m) { return '<button class="chip" style="height:36px;padding:0 12px;font-size:12px" data-act="aipick" data-v="' + esc(m) + '">' + esc(m) + '</button>'; }).join('') : '<span class="help">Aucun modèle trouvé.</span>') + '</div>' : '') +
      (A.hasKey ? '<button class="link" style="align-self:flex-start" data-act="aimodels">Voir les modèles disponibles</button>' : '<span class="help">Après l’enregistrement de la clé, vous pourrez lister les modèles disponibles.</span>') + '</div>' +
      '<div style="display:flex;gap:10px"><button class="btn ghost" style="height:44px" data-act="aisave"' + (ui.aiBusy ? ' disabled' : '') + '>' + (ui.aiBusy ? 'Test en cours…' : 'Enregistrer et tester') + '</button>' + (A.hasKey ? '<button class="btn ghost" style="height:44px" data-act="keycancel">Annuler</button>' : '') + '</div>' +
      (ui.aiMsg ? '<div class="notice" role="status">' + esc(ui.aiMsg) + '</div>' : '') + foot + '</div>';
  }

  function setInstall() {
    var h = subHeader('Installer l’application');
    if (isStandalone()) return h + '<div class="notice"><b>Watch-It est déjà installée</b> sur cet appareil : ouvrez-la depuis son icône sur l’écran d’accueil.</div>';
    var secure = location.protocol === 'https:' || location.hostname === 'localhost';
    h += '<p class="help" style="margin:0;line-height:1.5">Installée, Watch-It s’ouvre en plein écran comme une appli, fonctionne hors ligne et, sur Android, apparaît dans le menu Partager (par exemple depuis Signal) pour ajouter un titre.</p>';
    if (!secure) h += '<div class="notice">L’installation exige une adresse en <b>https://</b>. Ouvrez le site avec cette adresse.</div>';
    if (deferredInstall) h += '<button class="btn" data-act="install">Installer maintenant</button>';
    else h += '<div class="notice">Le navigateur ne propose pas le bouton d’installation sur cet appareil pour l’instant. Suivez le mode d’emploi ci-dessous.</div>';
    var row = function (t, d) { return '<div class="card"><span class="ct"><b>' + t + '</b><span>' + d + '</span></span></div>'; };
    return h + '<div class="group"><h2>Mode d’emploi</h2>' + row('Android (Chrome)', 'Menu ⋮ puis « Installer l’application » (ou « Ajouter à l’écran d’accueil »).') + row('iPhone et iPad (Safari)', 'Touchez Partager (le carré avec une flèche), puis « Sur l’écran d’accueil ». Cela ne fonctionne pas depuis un autre navigateur.') + row('Ordinateur (Chrome, Edge)', 'Icône d’installation à droite de la barre d’adresse, ou menu ⋮ puis « Enregistrer et partager » > « Installer ».') + '</div>';
  }
  function setTheme() {
    return subHeader('Apparence') + '<div class="group"><div class="seg">' + [['dark', 'Sombre'], ['light', 'Clair'], ['auto', 'Auto']].map(function (t) { return '<button class="chip' + (THEME === t[0] ? ' on' : '') + '" data-act="theme" data-v="' + t[0] + '" aria-pressed="' + (THEME === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div><span class="help">« Auto » suit le réglage clair ou sombre de votre téléphone. Ce choix est propre à cet appareil.</span></div>';
  }

  function setAccount() {
    return subHeader('Compte') +
      '<div class="who"><span class="av">' + esc((currentUsername || '?').charAt(0).toUpperCase()) + '</span><div style="display:flex;flex-direction:column;gap:2px;min-width:0"><span class="help">Identifiant actuel</span><b style="font-size:16px;overflow-wrap:anywhere">' + esc(currentUsername || 'inconnu') + '</b></div></div>' +
      '<div class="group"><h2>Changer l’identifiant</h2><form class="pwd" data-form="username"><label for="acc-user" style="position:absolute;left:-9999px">Nouvel identifiant</label><input id="acc-user" class="fld" name="username" value="' + esc(currentUsername || '') + '" maxlength="40" autocomplete="username" required><button class="btn ghost" style="height:44px" type="submit">Enregistrer l’identifiant</button></form>' + (ui.accMsg ? '<div class="notice" role="status">' + esc(ui.accMsg) + '</div>' : '') + '</div>' +
      '<div class="group"><h2>Changer le mot de passe</h2><form class="pwd" data-form="password"><input class="fld" type="password" name="cur" placeholder="Mot de passe actuel" autocomplete="current-password" required><input class="fld" type="password" name="nw" placeholder="Nouveau mot de passe (8 caractères minimum)" autocomplete="new-password" minlength="8" required><button class="btn ghost" style="height:44px" type="submit">Changer le mot de passe</button></form>' + (ui.pwMsg ? '<div class="notice" role="status">' + esc(ui.pwMsg) + '</div>' : '') + '</div>' +
      '<button class="btn ghost" style="height:44px" data-act="logout">' + I('out') + ' Se déconnecter</button>';
  }

  V.settings = function () {
    switch (ui.sset) {
      case 'plats': return setPlats();
      case 'profils': return setProfils();
      case 'lists': return setLists();
      case 'tmdb': return setTmdb();
      case 'ai': return setAi();
      case 'share': return setShare();
      case 'notif': return subHeader('Notifications') + pushSection();
      case 'theme': return setTheme();
      case 'install': return setInstall();
      case 'account': return setAccount();
      default: return setMenu();
    }
  };

  // Historique Netflix (CSV « Activité de visionnage » ou ViewingActivity.csv de l'export complet).
  function csvSplit(l) { return (l.match(/("([^"]|"")*"|[^,]*)(,|$)/g) || []).map(function (c) { return c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"').trim(); }); }
  function parseNetflix(text) {
    var lines = String(text).replace(/^\ufeff/, '').split(/\r?\n/).filter(Boolean);
    if (!lines.length) return null;
    var head = csvSplit(lines[0]).map(function (h) { return h.toLowerCase(); });
    var ti = head.indexOf('title'); if (ti < 0) ti = head.indexOf('titre');
    if (ti < 0) return null;
    var pi = head.indexOf('profile name'), vi = head.indexOf('supplemental video type'), di = head.indexOf('duration');
    var out = [];
    lines.slice(1).forEach(function (l) {
      var c = csvSplit(l);
      if (vi >= 0 && c[vi]) return;
      if (di >= 0 && c[di]) { var d = c[di].split(':'); if (d.length === 3 && Number(d[0]) * 3600 + Number(d[1]) * 60 + Number(d[2]) < 300) return; }
      if (c[ti]) out.push({ profile: pi >= 0 ? c[pi] : '', title: c[ti] });
    });
    return out;
  }
  function netflixTitles() {
    var nf = ui.nf; if (!nf) return [];
    var re = /^(.*?):\s*(Season|Saison|Limited Series|Série limitée|Collection|Miniseries|Mini-série)\b/i, seen = {}, out = [];
    nf.entries.forEach(function (e) {
      if (nf.profile && e.profile && e.profile !== nf.profile) return;
      var m = re.exec(e.title), t = m ? m[1].trim() : e.title, ty = m ? 'serie' : 'film', k = ty + '|' + t.toLowerCase();
      if (!t || seen[k]) return; seen[k] = 1; out.push({ title: t, ty: ty });
    });
    return out;
  }
  function netflixPanel() {
    var nf = ui.nf, titles = netflixTitles();
    var h = '<div class="group" style="gap:8px"><span class="help" style="line-height:1.5">Sur netflix.com : <b style="color:var(--fg)">Compte &gt; Profil &gt; Activité de visionnage &gt; Télécharger tout</b> (fichier CSV). Si vous avez demandé vos données complètes, prenez le fichier <code>ViewingActivity.csv</code>.</span>' +
      '<label class="btn ghost" for="nfcsv" style="display:flex;align-items:center;justify-content:center;gap:10px;cursor:pointer">' + I('file') + 'Choisir le fichier CSV</label><input id="nfcsv" type="file" accept=".csv,text/csv,text/plain" style="position:absolute;left:-9999px">';
    if (nf && nf.error) h += '<div class="notice">' + esc(nf.error) + '</div>';
    else if (nf) {
      if (nf.profiles.length > 1) h += '<label for="nfprof" class="help">Profil Netflix à importer</label><select id="nfprof" class="fld"><option value="">Tous les profils</option>' + nf.profiles.map(function (p) { return '<option value="' + esc(p) + '"' + (nf.profile === p ? ' selected' : '') + '>' + esc(p) + '</option>'; }).join('') + '</select>';
      h += '<span class="help">' + titles.length + ' titre' + (titles.length > 1 ? 's' : '') + ' distinct' + (titles.length > 1 ? 's' : '') + (titles.length > 200 ? ' (les 200 plus récents seront analysés)' : '') + '. Les séries sont ajoutées à « Vus » ; les titres que Netflix a retirés ou mal nommés peuvent ne pas être reconnus.</span>' +
        '<button class="btn ghost" style="height:44px" data-act="nfanalyze"' + (titles.length && !ui.impBusy ? '' : ' disabled') + '>Analyser ' + titles.length + ' titre' + (titles.length > 1 ? 's' : '') + '</button>';
    }
    return h + '</div>';
  }

  V.import = function () {
    var modes = [['paste', 'Liste'], ['csv', 'CSV'], ['lb', 'Letterboxd'], ['trakt', 'Trakt'], ['netflix', 'Netflix'], ['hand', 'À la main']].map(function (m) { return '<button class="chip' + (ui.impMode === m[0] ? ' on' : '') + '" style="justify-content:center;padding:0 6px;font-size:13px" data-act="impmode" data-v="' + m[0] + '">' + m[1] + '</button>'; }).join('');
    var rows = '', n = 0;
    if (ui.impBusy) rows = skeletons(3);
    else if (ui.impRows) {
      n = ui.impRows.filter(function (r) { return r.item; }).length;
      rows = '<div class="sec"><h2>' + n + ' reconnu' + (n > 1 ? 's' : '') + ' sur ' + ui.impRows.length + ' · ' + esc(pname(me)) + '</h2><button class="link" style="padding:0;min-height:44px" data-act="impbulk">★ 4 aux titres sans note</button></div><div class="list" style="gap:8px">' + ui.impRows.map(function (r, i) {
        if (!r.item) return '<div class="sug" style="align-items:center"><div class="poster xs" style="background:var(--line2)"></div><span class="rb" style="gap:2px"><span style="font-weight:700;color:var(--warn)">' + esc(r.raw) + '</span><span class="meta" style="font-size:12px;color:var(--warn)">Non reconnu · ignoré à l’import</span></span></div>';
        var it = r.item, o = '<option value="0">Pas noté</option>';
        for (var k = 1; k <= 5; k++) o += '<option value="' + k + '"' + (r.r === k ? ' selected' : '') + '>' + '★'.repeat(k) + '</option>';
        return '<div class="sug" style="align-items:center">' + poster(it, 'xs') + '<span class="rb" style="gap:2px"><span style="font-weight:700">' + esc(it.t) + '</span><span class="meta" style="font-size:12px">' + meta(it) + '</span></span><select class="fld" style="width:104px;flex:none" data-impr="' + i + '" aria-label="Note de ' + esc(it.t) + '">' + o + '</select></div>';
      }).join('') + '</div>';
    }
    var panel;
    if (ui.impMode === 'hand') panel = '<div class="tip">' + I('check') + '<span>Cherchez chaque titre avec le bouton +, puis marquez-le comme vu pour le noter. <button class="link" style="padding:0;min-height:0;color:var(--fg)" data-act="push" data-to="add">Ouvrir la recherche</button></span></div>';
    else if (ui.impMode === 'lb') panel = '<div class="group" style="gap:8px"><label for="lbu" class="help" style="line-height:1.4">Nom d’utilisateur Letterboxd (profil public). L’import lit les 50 derniers films du flux public ; pour tout l’historique, exportez vos données depuis Letterboxd (Paramètres > Import &amp; export) et utilisez l’onglet CSV.</label><input id="lbu" class="fld" autocomplete="off" autocapitalize="off" placeholder="monpseudo" value="' + esc(ui.lbUser) + '"><button class="btn ghost" style="height:44px" data-act="lbfetch"' + (ui.impBusy ? ' disabled' : '') + '>Récupérer mes films</button></div>';
    else if (ui.impMode === 'trakt') {
      var tEdit = !ui.trakt.hasKey || ui.keyEdit.trakt;
      panel = !tEdit ?
        '<div class="group" style="gap:8px"><label for="tru" class="help">Nom d’utilisateur Trakt (profil public)</label><input id="tru" class="fld" autocomplete="off" autocapitalize="off" placeholder="monpseudo" value="' + esc(ui.trUser) + '"><button class="btn ghost" style="height:44px" data-act="traktfetch"' + (ui.impBusy ? ' disabled' : '') + '>Récupérer mes titres</button>' +
          '<span class="help">Client ID enregistré (…' + esc(ui.trakt.last4) + ').</span><div style="display:flex;gap:10px"><button class="btn ghost" style="height:44px" data-act="keyedit" data-v="trakt">Modifier</button><button class="btn ghost" style="height:44px" data-act="keyask" data-v="trakt">Retirer</button></div>' + keyConfirmBox('trakt', 'L’import Trakt demandera de nouveau un Client ID.', 'traktclear') + '</div>' :
        '<div class="group" style="gap:8px"><label for="trk" class="help" style="line-height:1.5">Trakt demande un <b style="color:var(--fg)">Client ID</b> gratuit : créez une application sur <a href="https://trakt.tv/oauth/applications/new" target="_blank" rel="noopener" style="color:var(--fg)">trakt.tv/oauth/applications</a> (Redirect URI : <code>urn:ietf:wg:oauth:2.0:oob</code>), puis collez son Client ID ici. Il est chiffré sur votre serveur.</label><input id="trk" class="kinput" type="password" autocomplete="off" placeholder="Client ID Trakt"><div style="display:flex;gap:10px"><button class="btn ghost" style="height:44px" data-act="traktsave">Enregistrer</button>' + (ui.trakt.hasKey ? '<button class="btn ghost" style="height:44px" data-act="keycancel">Annuler</button>' : '') + '</div></div>';
    } else if (ui.impMode === 'netflix') { panel = netflixPanel();
    } else panel = '<div class="group" style="gap:8px">' + (ui.impMode === 'csv' ? '<label class="btn ghost" for="csv" style="display:flex;align-items:center;justify-content:center;gap:10px;cursor:pointer">' + I('file') + 'Choisir un fichier CSV</label><input id="csv" type="file" accept=".csv,text/csv,text/plain" style="position:absolute;left:-9999px"><span class="help">Exports Letterboxd, Trakt ou JustWatch : la colonne Name, Title ou Titre est utilisée (et Rating si elle existe).</span>' : '') +
      '<label for="imp" class="help" style="line-height:1.4">Un titre par ligne. Ajoutez l’année entre parenthèses si plusieurs films portent le même nom.</label><textarea id="imp" class="ta" rows="5" style="font-size:14px">' + esc(ui.impText) + '</textarea>' +
      '<button class="btn ghost" style="height:44px" data-act="impanalyze"' + (ui.impBusy ? ' disabled' : '') + '>Analyser la liste</button></div>';
    return '<header class="top tight">' + back() + '<h1 class="s">Importer nos titres vus</h1></header><div class="seg wrap">' + modes + '</div>' + panel + rows +
      (ui.impRows && !ui.impBusy ? '<div class="dock"><button class="btn" data-act="impgo"' + (n ? '' : ' disabled') + '>Importer ' + n + ' titre' + (n > 1 ? 's' : '') + '</button></div><span class="help" style="text-align:center">Les titres importés vont dans « Vus », pas dans « À voir ».</span>' : '');
  };

  function sheetHtml() {
    var s = ui.sheet; if (!s) return '';
    if (s.type === 'filter') return filterSheet();
    if (s.type === 'rate') {
      var it = entry(s.id) || KNOWN[s.id]; if (!it) return '';
      return '<div class="scrim" data-scrim="1"><div class="sheet" role="dialog" aria-modal="true" aria-label="Noter"><h3>Votre note pour « ' + esc(it.t) + ' » ?</h3><span class="help" style="margin-top:-8px">Note de ' + esc(pname(me)) + ' : elle améliore les suggestions.</span>' + starRow(0, 'rate', 'data-id="' + esc(s.id) + '"', 'big') + '<button class="btn ghost" data-act="rate" data-id="' + esc(s.id) + '" data-v="0">Marquer vu sans noter</button></div></div>';
    }
    if (s.type === 'trailer') {
      var tk = encodeURIComponent(s.key);
      return '<div class="scrim" data-scrim="1"><div class="sheet" role="dialog" aria-modal="true" aria-label="Bande-annonce"><div class="fhead"><h3>Bande-annonce</h3><button class="icon" data-act="closesheet" aria-label="Fermer">' + I('close') + '</button></div>' +
        '<div class="tframe"><iframe src="https://www.youtube-nocookie.com/embed/' + tk + '?autoplay=1&rel=0&playsinline=1&modestbranding=1" title="Bande-annonce" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>' +
        '<a class="link" style="align-self:center" href="https://www.youtube.com/watch?v=' + tk + '" target="_blank" rel="noopener">Ne démarre pas ? Ouvrir dans YouTube</a></div></div>';
    }
    if (s.type === 'draw') {
      var d = s.id ? entry(s.id) : null;
      return '<div class="scrim" data-scrim="1"><div class="sheet" role="dialog" aria-modal="true" aria-label="Tirage au sort">' + (d ? '<span class="help" style="text-transform:uppercase;letter-spacing:.08em;font-weight:700">Ce soir, ce sera</span><div style="display:flex;gap:14px">' + poster(d) + '<div class="rb"><h3>' + esc(d.t) + '</h3><span class="meta">' + meta(d) + '</span>' + badges(d) + '</div></div><button class="btn" data-act="open" data-id="' + esc(d.id) + '">Voir la fiche</button><button class="btn ghost" data-act="draw">Un autre</button>' : '<h3>Rien à tirer</h3><span class="help">' + (drawWho() === 'both' && ui.who === 'all' ? 'Aucun titre voulu par vous deux ne correspond à vos filtres et à vos plateformes.' : 'Aucun titre de la liste ne correspond à vos filtres et à vos plateformes.') + '</span>') + drawSwitch() + '<button class="link" data-act="closesheet" style="align-self:center">Fermer</button></div></div>';
    }
    return '';
  }

  function setupView() {
    return '<div class="login"><form data-form="setup"><img src="' + BASE + '/logo.svg" alt=""><h1>Bienvenue sur Watch-It</h1><p class="sub" style="margin:0">Créez le compte du foyer. Il sera partagé par les deux profils.</p>' +
      (ui.loginError ? '<p class="err">' + esc(ui.loginError) + '</p>' : '') +
      '<label>Identifiant<input type="text" name="username" required maxlength="40" autocomplete="username"></label>' +
      '<label>Mot de passe (8 caractères minimum)<input type="password" name="password" required minlength="8" autocomplete="new-password"></label>' +
      '<label>Confirmer le mot de passe<input type="password" name="password2" required minlength="8" autocomplete="new-password"></label>' +
      '<label>Code d’installation<input type="text" name="code" required autocomplete="off" autocapitalize="characters" placeholder="XXXX-XXXX-XXXX"><span class="help" style="font-weight:500">Affiché dans la console du serveur : <code>pm2 logs maiwatch</code> sur un serveur, ou le terminal où tourne <code>npm start</code>. Il garantit que vous seul créez le compte.</span></label>' +
      '<button type="submit" class="btn">Créer le compte</button></form></div>';
  }
  function loginView() {
    return '<div class="login"><form data-form="login"><img src="' + BASE + '/logo.svg" alt=""><h1>Watch-It</h1><p class="sub" style="margin:0">Notre liste de films et séries</p>' +
      (ui.loginError ? '<p class="err">' + esc(ui.loginError) + '</p>' : '') +
      '<label>Identifiant<input type="text" name="username" required autocomplete="username"></label><label>Mot de passe<input type="password" name="password" required autocomplete="current-password"></label>' +
      '<label class="rem"><input type="checkbox" name="remember" checked> Rester connecté sur cet appareil</label><button type="submit" class="btn">Se connecter</button></form></div>';
  }

  // ===================== Rendu =====================
  var MAIN = { home: 1, seen: 1, sug: 1, envies: 1 };
  var layer = document.getElementById('layer'), appEl = document.getElementById('app'), toastEl = document.getElementById('toast');
  function render(keepScroll) {
    var y = window.scrollY;
    if (!booted) { appEl.innerHTML = '<div class="loading"><img src="' + BASE + '/logo.svg" alt="">Chargement…</div>'; return; }
    if (!isAuthenticated) { appEl.innerHTML = ui.setup ? setupView() : loginView(); layer.innerHTML = ''; return; }
    if (!S) { appEl.innerHTML = '<div class="loading"><img src="' + BASE + '/logo.svg" alt="">Pas de connexion au serveur.<br>La liste s’affichera dès que le réseau revient.</div>'; return; }
    renderDeferred = false;
    var fb = document.querySelector('.fbody'), fs = fb ? fb.scrollTop : 0;
    appEl.innerHTML = V[ui.screen]() + (MAIN[ui.screen] ? nav() : '');
    if (!(ui.sheet && ui.sheet.type === 'trailer' && layer.querySelector('.tframe'))) layer.innerHTML = sheetHtml();
    var fb2 = document.querySelector('.fbody'); if (fb2) fb2.scrollTop = fs;
    if (keepScroll) window.scrollTo(0, y); else window.scrollTo(0, 0);
  }
  var toastTimer = null, toastFn = null;
  function toast(msg, label, fn) {
    toastEl.hidden = false;
    toastEl.innerHTML = '<span>' + esc(msg) + '</span>' + (label ? '<button data-act="undo">' + esc(label) + '</button>' : '');
    toastFn = fn || null;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.hidden = true; }, 5000);
  }
  function go(s, push) {
    if (push) ui.hist.push({ screen: ui.screen, detail: ui.detail }); else ui.hist = [];
    ui.screen = s; ui.sheet = null;
    if (s === 'settings') { ui.sset = 'menu'; loadProviders(); refreshPush(); }
    if (s === 'import') loadTrakt();
    render();
  }

  // ===================== Actions =====================
  function itemOf(id) { return entry(id) || KNOWN[id]; }
  function afterListChange() { if (ui.screen === 'add') { var r = document.getElementById('results'); if (r) r.innerHTML = addResults(); } else render(true); }

  function openDetail(id) {
    ui.sheet = null;
    ui.hist.push({ screen: ui.screen, detail: ui.detail });
    ui.detail = id; ui.screen = 'detail'; ui.dd = null; ui.epOpen = false; ui.epSeason = null; ui.epExp = {}; ui.colOpen = null; ui.colq = ''; ui.noteEdit = null; ui.noteDraft = null;
    render();
    api('/api/title/' + encodeURIComponent(id)).then(function (d) {
      if (ui.detail !== id) return;
      ui.dd = d; know(lite(d)); loadLinks(id);
      var e = entry(id);
      if (e) { // complète la fiche gardée dans la liste (durée, genres…) sans bruit
        var ch = false;
        ['len', 'y', 'p'].forEach(function (k) { if (!e[k] && d[k]) { e[k] = d[k]; ch = true; } });
        if ((!e.g || !e.g.length) && d.g.length) { e.g = d.g; ch = true; }
        if (ch) save();
      }
      if (ui.screen === 'detail') safeRender();
    }).catch(function (e) { if (ui.detail === id && ui.screen === 'detail') toast(e.message); });
  }

  function runSearch() {
    var mine = ui.q.trim(), q = titleFromShare(mine) || mine;
    if (norm(q).length < 2) { ui.sr = null; ui.srBusy = false; return; }
    ui.srBusy = true;
    ui.srq = q !== mine ? q : '';
    var m = /^(.*?)[\s(]+((?:19|20)\d{2})\)?$/.exec(q);
    api('/api/search?q=' + encodeURIComponent(m ? m[1] : q) + (m ? '&year=' + m[2] : '')).then(function (items) {
      if (ui.q.trim() !== mine) return;
      items.forEach(know);
      ui.sr = { items: items, av: {} };
      ui.srBusy = false;
      var r = document.getElementById('results'); if (r) r.innerHTML = addResults();
      var ids = items.slice(0, 10).map(function (i) { return i.id; });
      if (ids.length) api('/api/availability', { method: 'POST', body: { ids: ids } }).then(function (map) {
        if (ui.q.trim() !== mine || !ui.sr) return;
        ui.sr.av = map; var r2 = document.getElementById('results'); if (r2) r2.innerHTML = addResults();
      }).catch(function () {});
    }).catch(function (e) {
      if (ui.q.trim() !== mine) return;
      ui.sr = { error: e.message, items: [] }; ui.srBusy = false;
      var r = document.getElementById('results'); if (r) r.innerHTML = addResults();
    });
  }
  var searchTimer = null;

  function exportCsv() {
    var cell = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    var lines = [['Titre', 'Année', 'Type', 'Statut', 'Genres', 'Note ' + pname('M'), 'Note ' + pname('E'), 'Ajouté par', 'Date', 'Note'].map(cell).join(',')];
    S.list.forEach(function (e) {
      lines.push([e.t, e.y, e.ty === 'film' ? 'Film' : 'Série', e.status === 'seen' ? 'Vu' : 'À voir', (e.g || []).join('; '), e.r.M || '', e.r.E || '', pname(e.by), e.at, e.note].map(cell).join(','));
    });
    var blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'maiwatch-' + todayISO() + '.csv';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  function b64ToBytes(b64) {
    var pad = '='.repeat((4 - b64.length % 4) % 4), raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/')), out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  function refreshPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) { ui.push = { st: 'unsupported', endpoint: null, msg: '' }; return; }
    if (Notification.permission === 'denied') { ui.push = { st: 'denied', endpoint: null, msg: '' }; return; }
    navigator.serviceWorker.getRegistration().then(function (reg) { return reg ? reg.pushManager.getSubscription() : null; }).then(function (sub) {
      ui.push = { st: sub ? 'on' : 'off', endpoint: sub ? sub.endpoint : null, msg: ui.push.msg || '', prefs: ui.push.prefs };
      if (ui.screen === 'settings') render(true);
      if (sub) api('/api/push/status', { method: 'POST', body: { endpoint: sub.endpoint } }).then(function (r) { ui.push.prefs = r.prefs; if (ui.screen === 'settings') render(true); }).catch(function () {});
    }).catch(function () { ui.push = { st: 'off', endpoint: null, msg: '' }; });
  }
  function loadTrakt() { api('/api/trakt-key').then(function (st) { ui.trakt = st; if (ui.screen === 'import') render(true); }).catch(function () {}); }
  function importFrom(url, user) {
    ui.impBusy = true; ui.impRows = null; render(true);
    api(url, { method: 'POST', body: { user: user } }).then(function (rows) {
      ui.impRows = rows.map(function (r) { if (r.item) know(r.item); return { raw: r.raw, item: r.item, r: r.r || 0 }; });
      if (!rows.length) toast('Aucun titre trouvé pour ce profil.');
    }).catch(function (e) { toast(e.message); }).finally(function () { ui.impBusy = false; render(true); });
  }

  var A = {
    go: function (d) { ui.plats = []; ui.genres = []; ui.cols = []; ui.who = 'all'; go(d.to, false); },
    push: function (d) { go(d.to, true); },
    sset: function (d) { ui.keyEdit = {}; ui.keyConfirm = null; ui.sset = d.v; if (d.v === 'plats') { loadProviders(); ui.pvq = ''; } if (d.v === 'notif') refreshPush(); render(); },
    back: function () { if (ui.screen === 'settings' && ui.sset !== 'menu') { ui.sset = 'menu'; ui.keyEdit = {}; ui.keyConfirm = null; render(); return; } var h = ui.hist.pop(); if (h) { ui.screen = h.screen; ui.detail = h.detail; ui.sheet = null; render(true); } else go('home'); },
    open: function (d) { openDetail(d.id); },
    share: function () {
      var d = ui.dd; if (!d || !d.av) return;
      if (ui.lk[d.id] === 'loading') { toast('Lien direct en cours de recherche, réessayez dans un instant.'); return; }
      var ls = shareLinks(d); if (!ls.length) return;
      var head = d.t + (d.y ? ' (' + d.y + ')' : ''), body = ls.map(function (l) { return l.label + ' : ' + l.url; }).join('\n');
      if (navigator.share) { navigator.share(ls.length === 1 ? { title: d.t, text: head, url: ls[0].url } : { title: d.t, text: head + '\n' + body }).catch(function () {}); return; }
      var all = head + '\n' + body;
      if (navigator.clipboard) navigator.clipboard.writeText(all).then(function () { toast('Lien copié'); }, function () { toast(all); }); else toast(all);
    },
    addfor: function (d) { S.settings.addFor = d.v; save(); render(true); },
    nope: function (d) {
      var e = entry(d.id); if (!e) return;
      e.no = e.no || {}; e.no[me] = true; save(); render(true);
      toast('« ' + e.t + ' » écarté pour vous', 'Annuler', function () { delete e.no[me]; save(); render(true); });
    },
    want: function (d) {
      var e = entry(d.id); if (!e) return;
      var w = e.w || (function () { var o = {}; o[e.by] = true; return o; })();
      if (w[d.u]) { if (Object.keys(w).filter(function (k) { return w[k]; }).length < 2) { toast('Au moins une personne doit vouloir le voir.'); return; } delete w[d.u]; }
      else w[d.u] = true;
      if (w[d.u] && e.no) delete e.no[d.u];
      e.w = w; save(); render(true);
      toast(w[d.u] ? pname(d.u) + ' veut aussi le voir' : pname(d.u) + ' ne veut plus le voir');
    },
    tog: function (d) {
      var k = d.k, v = d.v;
      if (k === 'type') ui.type = v;
      else if (k === 'who') ui.who = v;
      else if (k === 'mp') { var mids = String(v).split(',').map(Number), mname = famsOf(mids)[0].name, added = toggleIds(S.settings.platforms, mids); save(); detectChanges(); toast(mname + (added ? ' ajoutée à vos plateformes' : ' retirée de vos plateformes') + ' (' + selFams().length + ' au total)'); }
      else if (k === 'plat') { toggleIds(ui.plats, String(v).split(',').map(Number)); }
      else { var arr = k === 'col' ? ui.cols : ui.genres, j = arr.indexOf(v); if (j >= 0) arr.splice(j, 1); else arr.push(v); }
      render(true);
    },
    openfilter: function () { ui.sheet = { type: 'filter', scr: ui.screen }; ui.fq = ''; ui.fexp = false; render(true); },
    resetf: function () { ui.plats = []; ui.genres = []; ui.cols = []; ui.who = 'all'; ui.sugOff = {}; render(true); },
    fexp: function () { ui.fexp = !ui.fexp; render(true); },
    closesheet: function () { ui.sheet = null; render(true); },
    tab: function (d) { ui.tab = d.v; render(true); },
    sugmore: function () {
      var s = ui.sug[ui.tab], n = s && s.items ? s.items.filter(function (x) { return passes(x.item); }).length : 0, nx = (ui.sugOff[ui.tab] || 0) + 6;
      ui.sugOff[ui.tab] = nx >= n ? 0 : nx; render();
    },
    retrysoon: function () { ui.soon = null; render(true); },
    cs: function (d) { ui.cs = d.v; render(true); },
    theme: function (d) { THEME = d.v; try { localStorage.setItem('maiwatch-theme', THEME); } catch (e) {} applyTheme(); render(true); },
    retrysug: function () { ui.sug[ui.tab] = null; render(true); },
    drawwho: function (d) { ui.drawWho = d.v; ui.sheet = null; A.draw(); },
    draw: function () {
      var ids = S.list.filter(function (e) { return e.status === 'todo' && passes(e, 'who') && whoOk(e, drawWho()) && (!availKnown(e) || !platsOn().length || avail(e).length); }).map(function (e) { return e.id; });
      var prev = ui.sheet && ui.sheet.id, p2 = ids.filter(function (i) { return i !== prev; }); if (p2.length) ids = p2;
      ui.sheet = { type: 'draw', id: ids.length ? ids[Math.floor(Math.random() * ids.length)] : null }; render(true);
    },
    add: function (d) {
      var it = itemOf(d.id); if (!it || entry(d.id)) return;
      addEntry(it, 'todo'); save();
      var kn = (ui.dd && ui.dd.id === d.id) ? ui.dd : KNOWN[d.id];
      if (kn && kn.av) AV[d.id] = { f: kn.av.f, r: kn.av.r, b: kn.av.b, trailer: !!kn.trailer };
      var t = it.t; afterListChange(); refreshAvail();
      toast('« ' + t + ' » ajouté à la liste', 'Annuler', function () { S.list = S.list.filter(function (e) { return e.id !== d.id; }); save(); afterListChange(); });
    },
    already: function (d) {
      var it = itemOf(d.id); if (!it) return;
      var e = entry(d.id);
      if (!e) addEntry(it, 'seen'); else { e.status = 'seen'; e.at = todayISO(); }
      save(); ui.sheet = { type: 'rate', id: d.id }; render(true);
    },
    askseen: function (d) { ui.sheet = { type: 'rate', id: d.id }; render(true); },
    setr: function (d) { var e = entry(d.id); if (!e) return; e.r[d.u] = e.r[d.u] === +d.v ? 0 : +d.v; save(); render(true); },
    rate: function (d) {
      var e = entry(d.id); if (!e) return;
      e.status = 'seen'; e.at = todayISO(); delete e.alert; if (+d.v) e.r[me] = +d.v; save(); ui.sheet = null; render(true);
      toast(+d.v ? 'Noté ' + d.v + ' ★ · vos suggestions s’affinent' : 'Marqué comme vu');
    },
    unseen: function (d) { var e = entry(d.id); e.status = 'todo'; save(); refreshAvail(); render(true); toast('Remis dans « À voir »'); },
    remove: function (d) {
      var e = entry(d.id), i = S.list.indexOf(e); S.list.splice(i, 1); save();
      var h = ui.hist.pop(); ui.screen = h ? h.screen : 'home'; ui.detail = h ? h.detail : null; render(true);
      toast('Supprimé de la liste', 'Annuler', function () { S.list.splice(i, 0, e); save(); render(true); });
    },
    dismiss: function (d) {
      var us = ui.tab === 'both' ? ['M', 'E'] : [ui.tab === 'other' ? other(me) : me];
      us.forEach(function (u) { if (S.dismissed[u].indexOf(d.id) < 0) S.dismissed[u].push(d.id); }); save(); render(true);
      toast('Compris, on en proposera moins comme celui-ci', 'Annuler', function () { us.forEach(function (u) { S.dismissed[u] = S.dismissed[u].filter(function (i) { return i !== d.id; }); }); save(); render(true); });
    },
    chip: function (d) {
      ui.envie = d.v === 'Cosy' ? 'Quelque chose de cosy pour ce soir, un film doudou.' : d.v === 'Frissons sans gore' ? 'Un thriller avec des frissons, sans gore.' : 'Une série avec des épisodes de 40 min maximum, légère.';
      ui.env = null; render(true);
    },
    envie: function () {
      var ta = document.getElementById('envie'); if (ta) ui.envie = ta.value;
      if (ui.envie.trim().length < 3) { toast('Décrivez votre envie en quelques mots.'); return; }
      ui.envBusy = true; ui.env = null; render(true);
      api('/api/envies', { method: 'POST', body: { text: ui.envie, me: me, minutes: availMinutes() || undefined } }).then(function (r) { ui.env = r; })
        .catch(function (e) { ui.env = { error: e.message }; })
        .finally(function () { ui.envBusy = false; if (ui.screen === 'envies') render(true); });
    },
    profile: function (d) { me = d.u; try { localStorage.setItem('maiwatch-me', me); } catch (e) {} ui.sugVer++; ui.sugOff = {}; render(true); },
    aiprov: function (d) { CFG.ai.provider = d.v; ui.aiDraftModel = null; ui.aiModels = null; render(true); },
    aipick: function (d) { var i = document.getElementById('aimodel'); if (i) i.value = d.v; ui.aiDraftModel = d.v; },
    aimodels: function () {
      var i = document.getElementById('aimodel'); ui.aiDraftModel = i ? i.value : null;
      api('/api/ai/models').then(function (l) { ui.aiModels = l; }).catch(function (e) { ui.aiModels = []; ui.aiMsg = e.message; }).finally(function () { render(true); });
    },
    aisave: function () {
      var k = document.getElementById('key'), key = k ? k.value.trim() : '';
      if (!key && !CFG.ai.hasKey) { ui.aiMsg = 'Collez d’abord une clé API.'; render(true); return; }
      var mi = document.getElementById('aimodel'), model = mi ? mi.value.trim() : undefined;
      ui.aiBusy = true; ui.aiMsg = ''; render(true);
      api('/api/ai', { method: 'PUT', body: { provider: CFG.ai.provider, key: key, model: model } })
        .then(function () { return api('/api/ai/test', { method: 'POST' }); })
        .then(function (r) { CFG.ai = r.status; ui.keyEdit.ai = false; ui.aiDraftModel = null; ui.aiModels = null; ui.aiMsg = r.ok ? 'Clé enregistrée et testée : ' + PROVS[CFG.ai.provider] + ' répond.' : (r.transient ? 'Clé enregistrée. ' + r.error : 'Clé enregistrée, mais le test a échoué : ' + r.error); })
        .catch(function (e) { ui.aiMsg = e.message; })
        .finally(function () { ui.aiBusy = false; render(true); });
    },
    aiclear: function () { api('/api/ai', { method: 'DELETE' }).then(function (s) { CFG.ai = s; ui.aiMsg = 'Clé retirée.'; ui.keyConfirm = null; ui.keyEdit = {}; render(true); }).catch(function (e) { toast(e.message); }); },
    export: function () { exportCsv(); toast('Export prêt : ' + S.list.length + ' titres.'); },
    logout: function () {
      if (dirty) { toast('Des modifications ne sont pas encore envoyées : attendez le retour du réseau.'); return; }
      apiFetch('/api/logout', { method: 'POST' }).finally(function () {
        isAuthenticated = false; S = null; baseState = null; baseVersion = null; try { localStorage.removeItem(STORE_KEY); } catch (e) {}
        ui.screen = 'home'; ui.hist = []; ui.detail = null; ui.sug = {}; ui.env = null; ui.sr = null; ui.q = ''; ui.plats = []; ui.genres = []; ui.cols = []; ui.who = 'all'; ui.type = 'all'; ui.sheet = null; render();
      });
    },
    tmdbsave: function () {
      var inp = document.getElementById('tmdbkey'), key = inp ? inp.value.trim() : '';
      if (!key) { ui.tmdbMsg = 'Collez d’abord la clé TMDB.'; render(true); return; }
      ui.tmdbBusy = true; ui.tmdbMsg = ''; render(true);
      api('/api/tmdb-key', { method: 'PUT', body: { key: key } }).then(function (r) {
        CFG.tmdb = r.tmdb; CFG.tmdbKey = r.tmdbKey; ui.tmdbMsg = 'Clé TMDB vérifiée et enregistrée.'; ui.keyEdit.tmdb = false;
        ui.sug = {}; PV = {}; PVL = []; return loadProviders(true).then(function () { AV = {}; AV_AT = 0; refreshAvail(); });
      }).catch(function (e) { ui.tmdbMsg = e.message; }).finally(function () { ui.tmdbBusy = false; render(true); });
    },
    trailer: function (d) {
      if (navigator.onLine === false) { toast('Hors ligne : la bande-annonce a besoin du réseau.'); return; }
      ui.sheet = { type: 'trailer', key: d.k }; render(true);
    },
    epopen: function () {
      ui.epOpen = !ui.epOpen;
      if (ui.epOpen && ui.dd && ui.dd.seasonsInfo) { var e = entry(ui.detail), sn = ui.epSeason != null ? ui.epSeason : ((e && e.prog && e.prog.s) || ui.dd.seasonsInfo[0].n); ui.epSeason = sn; loadSeason(ui.detail, sn); }
      render(true);
    },
    epinfo: function (d) { ui.epExp[d.k] = !ui.epExp[d.k]; render(true); },
    epretry: function () { var k = ui.detail + ':' + ui.epSeason; delete ui.epData[k]; loadSeason(ui.detail, ui.epSeason); render(true); },
    epset: function (d) {
      var e = entry(ui.detail); if (!e || e.status !== 'todo') return;
      var s = Number(d.s), n = Number(d.e), p = e.prog || {};
      if (p.s === s && p.e === n) {
        // re-toucher le dernier épisode vu le décoche : retour à l'épisode précédent
        var se = (ui.dd && ui.dd.seasonsInfo) || [], prev = se.filter(function (x) { return x.n < s; }).pop();
        if (n > 1) e.prog = { s: s, e: n - 1 }; else if (prev) e.prog = { s: prev.n, e: prev.c }; else delete e.prog;
      } else e.prog = { s: s, e: n };
      save(); render(true);
      var a = ui.dd ? { se: ui.dd.seasonsInfo, last: ui.dd.lastEp, next: ui.dd.nextEp, ended: ui.dd.ended } : null;
      if (e.prog && a && !nextEp(e, a) && a.ended) { ui.sheet = { type: 'rate', id: ui.detail }; render(true); toast('Dernier épisode vu : la série est terminée.'); }
    },
    install: function () {
      if (!deferredInstall) { ui.sset = 'install'; if (ui.screen !== 'settings') { go('settings', true); ui.sset = 'install'; } render(); return; }
      var ev = deferredInstall; ev.prompt();
      if (ev.userChoice) ev.userChoice.then(function (c) { deferredInstall = null; if (c && c.outcome === 'dismissed') toast('Installation annulée. Vous pourrez la relancer depuis les réglages.'); safeRender(); });
    },
    installhide: function () { try { localStorage.setItem('maiwatch-install-hidden', '1'); } catch (e) {} render(true); },
    linkopt: function (d) {
      var l = S.settings.links = Object.assign({ tmdb: true, plat: true }, S.settings.links || {}), other = d.k === 'tmdb' ? 'plat' : 'tmdb';
      if (l[d.k] && !l[other] ) { toast('Gardez au moins un lien activé.'); return; }
      if (l[d.k] && other === 'plat' && !saOn()) { toast('Gardez au moins un lien activé.'); return; }
      l[d.k] = !l[d.k]; save(); render(true);
    },
    samode: function (d) { ui.saMode = d.v; render(true); },
    sasave: function () {
      var inp = document.getElementById('sakey'), key = inp ? inp.value.trim() : '';
      if (!key) { ui.saMsg = 'Collez d’abord la clé.'; render(true); return; }
      ui.saBusy = true; ui.saMsg = ''; render(true);
      api('/api/streaming-key', { method: 'PUT', body: { key: key, mode: ui.saMode || (CFG.streaming && CFG.streaming.mode) || 'direct' } }).then(function (st) { CFG.streaming = st; ui.keyEdit.sa = false; ui.saMode = null; ui.lk = {}; ui.saMsg = 'Clé vérifiée et enregistrée.'; }).catch(function (e) { ui.saMsg = e.message; }).finally(function () { ui.saBusy = false; render(true); });
    },
    saclear: function () { api('/api/streaming-key', { method: 'DELETE' }).then(function (st) { CFG.streaming = st; ui.lk = {}; ui.saMsg = 'Clé retirée.'; ui.keyConfirm = null; ui.keyEdit = {}; render(true); }).catch(function (e) { toast(e.message); }); },
    keyedit: function (d) { ui.keyEdit[d.v] = true; ui.keyConfirm = null; ui.tmdbMsg = ''; ui.aiMsg = ''; render(true); },
    keyask: function (d) { ui.keyConfirm = d.v; render(true); },
    keycancel: function () { ui.aiDraftModel = null; ui.aiModels = null; ui.keyEdit = {}; ui.keyConfirm = null; ui.tmdbMsg = ''; ui.aiMsg = ''; render(true); },
    aitest: function () {
      ui.aiBusy = true; ui.aiMsg = ''; render(true);
      api('/api/ai/test', { method: 'POST' }).then(function (r) { CFG.ai = r.status; ui.aiMsg = r.ok ? 'La clé fonctionne : ' + PROVS[CFG.ai.provider] + ' répond.' : (r.transient ? r.error : 'Le test a échoué : ' + r.error); })
        .catch(function (e) { ui.aiMsg = e.message; }).finally(function () { ui.aiBusy = false; render(true); });
    },
    tmdbclear: function () {
      api('/api/tmdb-key', { method: 'DELETE' }).then(function (r) { CFG.tmdb = r.tmdb; CFG.tmdbKey = r.tmdbKey; ui.tmdbMsg = 'Clé TMDB retirée.'; ui.keyConfirm = null; ui.keyEdit = {}; render(true); }).catch(function (e) { toast(e.message); });
    },
    epnext: function (d) {
      var e = entry(d.id); if (!e) return;
      var a = (ui.dd && ui.dd.id === d.id) ? { se: ui.dd.seasonsInfo, last: ui.dd.lastEp, next: ui.dd.nextEp, ended: ui.dd.ended } : AV[d.id];
      var n = nextEp(e, a); if (!n) return;
      e.prog = { s: n.s, e: n.e }; save();
      var after = nextEp(e, a);
      render(true);
      if (!after && a && a.ended) { ui.sheet = { type: 'rate', id: d.id }; render(true); toast('Dernier épisode vu : la série est terminée.'); }
      else toast('Épisode S' + n.s + 'E' + n.e + ' noté comme vu');
    },
    matchstart: function () {
      ui.matchBusy = true; render(true);
      var plats = platsOn();
      var card = function (it, f) {
        var o = lite(it); o.f = (f || []).filter(function (p) { return !plats.length || plats.indexOf(p) >= 0; });
        if (typeof it.ov === 'string') { o.ov = it.ov.slice(0, 280); if (it.trailer) o.tr = it.trailer; }
        return o;
      };
      Promise.all([api('/api/suggestions?tab=both&me=' + me).catch(function () { return []; }), api('/api/suggestions?tab=me&me=' + me).catch(function () { return []; })]).then(function (r) {
        var pool = {}, inL = [], inS = [], ty = ui.matchTy, src = ui.matchSrc, tyOk = function (it) { return ty === 'all' || it.ty === ty; };
        var shuffle = function (a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
        if (src !== 'out') S.list.forEach(function (e) { if (e.status === 'todo' && tyOk(e) && (!availKnown(e) || !plats.length || avail(e).length)) { pool[e.id] = card(e, AV[e.id] && AV[e.id].f); inL.push(e.id); } });
        if (src !== 'list') r[0].concat(r[1]).forEach(function (x) { know(x.item); if (tyOk(x.item) && !pool[x.item.id] && !entry(x.item.id)) { pool[x.item.id] = card(x.item, x.item.av.f); inS.push(x.item.id); } });
        var ids;
        if (src === 'mix') { // moitié liste, moitié hors liste (l'un complète l'autre s'il en manque)
          shuffle(inL); shuffle(inS);
          var nl = Math.min(inL.length, Math.max(6, 12 - inS.length));
          ids = inL.slice(0, nl).concat(inS.slice(0, 12 - nl));
        } else ids = shuffle(inL.concat(inS));
        if (ids.length < 2) { toast(src === 'list' ? 'Pas assez de titres dans votre liste « À voir » (et dispo sur vos plateformes) : ajoutez-en ou choisissez « Mixte ».' : ty === 'all' ? 'Ajoutez d’abord quelques titres ou notez des films vus.' : 'Pas assez de ' + (ty === 'film' ? 'films' : 'séries') + ' à proposer : ajoutez-en ou choisissez « Films et séries ».'); return; }
        var deck = shuffle(ids.slice(0, 12)).map(function (k) { return pool[k]; });
        return Promise.all(deck.map(function (c) {
          if (typeof c.ov === 'string') return null;
          return api('/api/title/' + encodeURIComponent(c.id)).then(function (d) { c.ov = (d.ov || '').slice(0, 280); if (d.trailer) c.tr = d.trailer; }).catch(function () { c.ov = ''; });
        })).then(function () { S.match = { id: Date.now().toString(36), deck: deck, votes: { M: {}, E: {} }, at: todayISO(), ty: ty, src: src, by: me, st: 'wait' }; save(); toast('Invitation envoyée : la partie commence quand ' + pname(me === 'M' ? 'E' : 'M') + ' accepte.'); });
      }).finally(function () { ui.matchBusy = false; render(true); });
    },
    matchaccept: function () { if (S.match && S.match.st === 'wait') { S.match.st = 'on'; save(); render(true); } },
    matchdecline: function () { if (S.match && S.match.st === 'wait') { S.match.st = 'no'; save(); render(true); } },
    matchcancel: function () { S.match = null; save(); render(true); },
    matchsrc: function (d) { ui.matchSrc = d.v; render(true); },
    matchty: function (d) { ui.matchTy = d.v; render(true); },
    gomatch: function () { ui.hist = []; ui.screen = 'envies'; ui.cs = 'match'; ui.sheet = null; render(); },
    matchinvite: function () {
      api('/api/match/invite', { method: 'POST', body: { from: me } }).then(function (r) { toast(r.sent ? 'Invitation envoyée.' : 'Aucune notification envoyée : ' + pname(me === 'M' ? 'E' : 'M') + ' doit les activer.'); }).catch(function (e) { toast(e.message); });
    },
    tonight: function (d) {
      var it = entry(d.id) || KNOWN[d.id] || (ui.dd && ui.dd.id === d.id ? ui.dd : null); if (!it) return;
      S.tonight = { pid: Date.now().toString(36), id: it.id, ty: it.ty, t: it.t, y: it.y || null, p: it.p || null, by: me, at: todayISO(), st: 'pending' };
      save(); render(true); toast('Proposition envoyée à ' + pname(me === 'M' ? 'E' : 'M') + '.');
    },
    tonightans: function (d) {
      var t = tonightLive(); if (!t || t.st !== 'pending') return;
      t.st = d.v === 'ok' ? 'ok' : 'no'; save(); render(true);
    },
    tonightclear: function () { S.tonight = null; save(); render(true); },
    matchvote: function (d) {
      var m = S.match; if (!m || m.st === 'wait' || m.st === 'no') return;
      m.votes[me] = m.votes[me] || {}; m.votes[me][d.id] = +d.v; save(); render(true);
      var c = m.deck.filter(function (x) { return x.id === d.id; })[0];
      if (+d.v === 1 && ((m.votes[other(me)] || {})[d.id] === 1) && c) {
        if (matchApply()) { save(); refreshAvail(); render(true); }
        toast('C’est un match : « ' + c.t + ' » ajouté à votre liste !');
      }
    },
    matchseen: function (d) {
      var m = S.match, c = m && m.deck.filter(function (x) { return x.id === d.id; })[0]; if (!c) return;
      var e = entry(c.id);
      if (!e) addEntry(c, 'seen'); else { e.status = 'seen'; e.at = todayISO(); }
      m.votes[me] = m.votes[me] || {}; m.votes[me][c.id] = -1; // un titre déjà vu ne peut pas être un match
      save(); ui.sheet = { type: 'rate', id: c.id }; render(true);
    },
    pushon: function () {
      ui.push.msg = '';
      Notification.requestPermission().then(function (perm) {
        if (perm !== 'granted') { ui.push = { st: perm === 'denied' ? 'denied' : 'off', endpoint: null, msg: '' }; render(true); return; }
        return Promise.all([navigator.serviceWorker.ready, api('/api/push/key')]).then(function (r) {
          return r[0].pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(r[1].publicKey) });
        }).then(function (sub) {
          return api('/api/push/subscribe', { method: 'POST', body: { sub: sub.toJSON(), profile: me } }).then(function () { ui.push = { st: 'on', endpoint: sub.endpoint, msg: 'Notifications activées sur cet appareil.', prefs: { added: true, release: true, gone: true, match: true, tonight: true } }; });
        });
      }).catch(function (e) { ui.push.msg = 'Impossible d’activer : ' + e.message; }).finally(function () { render(true); });
    },
    pushoff: function () {
      navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.getSubscription(); }).then(function (sub) {
        if (!sub) return; var ep = sub.endpoint; return sub.unsubscribe().then(function () { return api('/api/push/unsubscribe', { method: 'POST', body: { endpoint: ep } }); });
      }).then(function () { ui.push = { st: 'off', endpoint: null, msg: 'Notifications désactivées.' }; }).catch(function (e) { ui.push.msg = e.message; }).finally(function () { render(true); });
    },
    pushpref: function (d) {
      var P = ui.push; if (!P.endpoint || !P.prefs) return;
      var upd = {}; upd[d.k] = P.prefs[d.k] === false;
      api('/api/push/prefs', { method: 'POST', body: { endpoint: P.endpoint, prefs: upd } }).then(function (r) { P.prefs = r.prefs; }).catch(function (e) { toast(e.message); }).finally(function () { render(true); });
    },
    pushtest: function () {
      api('/api/push/test', { method: 'POST', body: { endpoint: ui.push.endpoint } }).then(function (r) { ui.push.msg = r.sent ? 'Notification envoyée.' : 'Aucune notification envoyée : réactivez-les.'; }).catch(function (e) { ui.push.msg = e.message; }).finally(function () { render(true); });
    },
    lbfetch: function () {
      var i = document.getElementById('lbu'); ui.lbUser = i ? i.value.trim() : ui.lbUser;
      if (!ui.lbUser) { toast('Indiquez votre nom d’utilisateur Letterboxd.'); return; }
      importFrom('/api/import/letterboxd', ui.lbUser);
    },
    traktfetch: function () {
      var i = document.getElementById('tru'); ui.trUser = i ? i.value.trim() : ui.trUser;
      if (!ui.trUser) { toast('Indiquez votre nom d’utilisateur Trakt.'); return; }
      importFrom('/api/import/trakt', ui.trUser);
    },
    traktsave: function () {
      var i = document.getElementById('trk'), k = i ? i.value.trim() : '';
      if (!k) { toast('Collez d’abord le Client ID.'); return; }
      api('/api/trakt-key', { method: 'PUT', body: { key: k } }).then(function (st) { ui.trakt = st; ui.keyEdit.trakt = false; render(true); }).catch(function (e) { toast(e.message); });
    },
    traktclear: function () { api('/api/trakt-key', { method: 'DELETE' }).then(function (st) { ui.trakt = st; ui.keyConfirm = null; ui.keyEdit = {}; render(true); }).catch(function (e) { toast(e.message); }); },
    nfanalyze: function () {
      var t = netflixTitles().slice(0, 200); if (!t.length) return;
      ui.impBusy = true; ui.impRows = null; render(true);
      api('/api/import', { method: 'POST', body: { lines: t.map(function (x) { return x.title; }), hints: t.map(function (x) { return x.ty; }) } }).then(function (rows) {
        ui.impRows = rows.map(function (r) { if (r.item) know(r.item); return { raw: r.raw, item: r.item, r: 0 }; });
      }).catch(function (e) { toast(e.message); }).finally(function () { ui.impBusy = false; render(true); });
    },
    tbdur: function (d) { var m = Number(d.v); ui.tb = m ? { mode: 'dur', min: m, start: ui.tb.start, end: '' } : { mode: 'none', min: 0, start: ui.tb.start, end: '' }; render(true); },
    coltog: function (d) {
      var e = entry(d.id); if (!e) return; e.l = e.l || [];
      var i = e.l.indexOf(d.c); if (i >= 0) e.l.splice(i, 1); else e.l.push(d.c);
      if (!e.l.length) delete e.l;
      ui.colOpen = null; ui.colq = '';
      save(); render(true);
    },
    colopen: function (d) { ui.colOpen = d.id; ui.colq = ''; render(true); var i = document.getElementById('colq'); if (i) i.focus(); },
    colclose: function () { ui.colOpen = null; ui.colq = ''; render(true); },
    noteedit: function (d) { var e = entry(d.id); ui.noteEdit = d.id; ui.noteDraft = e ? e.note || '' : ''; render(true); var t = document.getElementById('note'); if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); } },
    notecancel: function () { ui.noteEdit = null; ui.noteDraft = null; render(true); },
    notesave: function (d) {
      var e = entry(d.id), t = document.getElementById('note'); if (!e) return;
      var v = (t ? t.value : ui.noteDraft || '').trim();
      if (v) e.note = v; else delete e.note;
      ui.noteEdit = null; ui.noteDraft = null; save(); render(true); toast(v ? 'Note enregistrée' : 'Note supprimée');
    },
    colnew: function () {
      var inp = document.getElementById('newcol'), name = inp ? inp.value.trim() : ''; if (!name) { toast('Donnez un nom à la liste.'); return; }
      if (S.collections.some(function (x) { return x.name.toLowerCase() === name.toLowerCase(); })) { toast('Cette liste existe déjà.'); return; }
      S.collections.push({ id: 'c' + Date.now().toString(36), name: name }); save(); render(true);
    },
    coldel: function (d) {
      var c = S.collections.filter(function (x) { return x.id === d.c; })[0]; if (!c) return;
      var idx = S.collections.indexOf(c), had = [];
      S.collections.splice(idx, 1);
      S.list.forEach(function (e) { if (e.l && e.l.indexOf(c.id) >= 0) { had.push(e.id); e.l = e.l.filter(function (x) { return x !== c.id; }); if (!e.l.length) delete e.l; } });
      ui.cols = ui.cols.filter(function (x) { return x !== c.id; });
      save(); render(true);
      toast('Liste « ' + c.name + ' » supprimée', 'Annuler', function () {
        S.collections.splice(idx, 0, c);
        had.forEach(function (id) { var e = entry(id); if (e) { e.l = e.l || []; e.l.push(c.id); } });
        save(); render(true);
      });
    },
    impbulk: function () { (ui.impRows || []).forEach(function (r) { if (r.item && !r.r) r.r = 4; }); render(true); },
    syncnow: function () { syncNow(); pullState(); },
    impmode: function (d) { ui.impMode = d.v; ui.impRows = null; if (d.v === 'trakt') loadTrakt(); render(true); },
    impanalyze: function () {
      var ta = document.getElementById('imp'); if (ta) ui.impText = ta.value;
      var lines = ui.impText.split(/\n/).map(function (l) { return l.trim(); }).filter(Boolean);
      if (!lines.length) { toast('Ajoutez au moins un titre.'); return; }
      ui.impBusy = true; ui.impRows = null; render(true);
      api('/api/import', { method: 'POST', body: { lines: lines, hints: ui.impHints || undefined } }).then(function (rows) {
        ui.impRows = rows.map(function (r) { if (r.item) know(r.item); return { raw: r.raw, item: r.item, r: (ui.impRatings && ui.impRatings[r.raw]) || r.r || 0 }; });
        ui.impRatings = null;
      }).catch(function (e) { toast(e.message); }).finally(function () { ui.impBusy = false; render(true); });
    },
    impgo: function () {
      var n = 0;
      ui.impRows.forEach(function (r) {
        if (!r.item) return;
        var e = entry(r.item.id);
        if (!e) e = addEntry(r.item, 'seen'); else { e.status = 'seen'; }
        if (r.r) e.r[me] = r.r; n++;
      });
      save(); ui.impRows = null; ui.hist = []; ui.screen = 'settings'; render(); toast(n + ' titre' + (n > 1 ? 's' : '') + ' importé' + (n > 1 ? 's' : '') + ' dans « Vus »');
    },
    undo: function () { if (toastFn) toastFn(); toastFn = null; toastEl.hidden = true; }
  };

  document.addEventListener('click', function (ev) {
    var t = ev.target;
    if (t.dataset && t.dataset.scrim) { ui.sheet = null; render(true); return; }
    var b = t.closest && t.closest('[data-act]'); if (!b) return;
    var fn = A[b.dataset.act]; if (fn) { ev.preventDefault(); fn(b.dataset); }
  });
  document.addEventListener('input', function (ev) {
    var t = ev.target;
    if (t.id === 'q') { ui.q = t.value; ui.sr = null; var r = document.getElementById('results'); clearTimeout(searchTimer); if (norm(ui.q).length < 2) { ui.srBusy = false; if (r) r.innerHTML = addResults(); } else { ui.srBusy = true; if (r) r.innerHTML = addResults(); searchTimer = setTimeout(runSearch, 300); } }
    else if (t.id === 'gq') { ui.fq = t.value; document.getElementById('glist').innerHTML = genreList(); }
    else if (t.id === 'pvq') { ui.pvq = t.value; var plist = document.getElementById('pvlist'); if (plist) plist.innerHTML = platRows(); }
    else if (t.id === 'envie') ui.envie = t.value;
    else if (t.id === 'imp') ui.impText = t.value;
    else if (t.id === 'colq') { ui.colq = t.value; var cl = document.getElementById('collist'); if (cl) cl.innerHTML = colList(ui.colOpen); }
    else if (t.dataset && t.dataset.draft) ui.noteDraft = t.value;
  });
  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.id === 'pushhour') {
      var P0 = ui.push; if (!P0.endpoint) return;
      api('/api/push/prefs', { method: 'POST', body: { endpoint: P0.endpoint, prefs: { hour: Number(t.value) } } }).then(function (r) { P0.prefs = r.prefs; toast('Notification de sortie à ' + r.prefs.hour + ' h'); }).catch(function (e) { toast(e.message); });
    }
    else if (t.dataset && t.dataset.prof) { var v = t.value.trim() || (t.dataset.prof === 'M' ? 'Moi' : 'Elle'); S.settings.profiles[t.dataset.prof] = v; save(); render(true); }
    else if (t.id === 'prog-s' || t.id === 'prog-e') {
      var pe = entry(ui.detail); if (!pe) return;
      var ps = t.id === 'prog-s' ? Number(t.value) : (pe.prog && pe.prog.s) || 0;
      var pp = t.id === 'prog-e' ? Number(t.value) : 0;
      if (!ps) delete pe.prog; else pe.prog = { s: ps, e: pp };
      save(); render(true);
    }
    else if (t.dataset && t.dataset.impr !== undefined) { ui.impRows[+t.dataset.impr].r = Number(t.value); render(true); }
    else if (t.id === 'ep-season') { ui.epSeason = Number(t.value); loadSeason(ui.detail, ui.epSeason); render(true); }
    else if (t.id === 'tb-start') { ui.tb.start = t.value; render(true); }
    else if (t.id === 'tb-end') { ui.tb = { mode: t.value ? 'end' : 'none', min: 0, start: ui.tb.start, end: t.value }; render(true); }
    else if (t.id === 'nfprof') { ui.nf.profile = t.value; render(true); }
    else if (t.id === 'nfcsv' && t.files && t.files[0]) {
      var rd = new FileReader();
      rd.onload = function () {
        var ent = parseNetflix(rd.result);
        if (!ent || !ent.length) ui.nf = { error: 'Fichier non reconnu : il doit contenir une colonne « Title » (ou « Titre »).', entries: [], profiles: [], profile: '' };
        else { var pr = []; ent.forEach(function (e) { if (e.profile && pr.indexOf(e.profile) < 0) pr.push(e.profile); }); ui.nf = { entries: ent, profiles: pr, profile: '' }; }
        ui.impRows = null; render(true);
      };
      rd.readAsText(t.files[0]);
    }
    else if (t.dataset && t.dataset.colname) { var co = S.collections.filter(function (x) { return x.id === t.dataset.colname; })[0]; if (co) { co.name = t.value.trim() || co.name; save(); render(true); } }
    else if (t.id === 'region') { S.settings.region = t.value; PV = {}; PVL = []; S.settings.platforms = []; save(); loadProviders(true).then(function () { AV = {}; AV_AT = 0; refreshAvail(); render(true); }); }
    else if (t.id === 'csv' && t.files && t.files[0]) {
      var f = new FileReader();
      f.onload = function () {
        var lines = String(f.result).replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
        var split = function (l) { return (l.match(/("([^"]|"")*"|[^,]*)(,|$)/g) || []).map(function (c) { return c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"').trim(); }); };
        var head = split(lines[0]).map(function (h) { return h.toLowerCase(); });
        var ix = head.findIndex(function (h) { return h === 'name' || h === 'title' || h === 'titre'; });
        var yix = head.findIndex(function (h) { return h === 'year' || h === 'année' || h === 'annee'; });
        var hasHead = ix >= 0; if (ix < 0) ix = 0;
        var rix = head.findIndex(function (h) { return h === 'rating' || h === 'note'; });
        var ratings = {};
        var out = (hasHead ? lines.slice(1) : lines).map(function (l) { var c = split(l); var line = (c[ix] || '') + (yix >= 0 && c[yix] ? ' (' + c[yix] + ')' : ''); if (line && rix >= 0 && Number(c[rix]) > 0) ratings[line] = Math.min(5, Math.max(1, Math.round(Number(c[rix])))); return line; }).filter(Boolean);
        ui.impText = out.join('\n'); ui.impMode = 'paste'; ui.impRatings = ratings; A.impanalyze();
      };
      f.readAsText(t.files[0]);
    }
  });
  document.addEventListener('submit', function (ev) {
    var form = ev.target.closest && ev.target.closest('[data-form]'); if (!form) return;
    ev.preventDefault();
    var fd = new FormData(form);
    if (form.dataset.form === 'login') {
      ui.loginError = '';
      apiFetch('/api/login', { method: 'POST', body: { username: fd.get('username'), password: fd.get('password'), remember: !!fd.get('remember') } }).then(function (r) {
        return r.json().then(function (j) {
          if (!r.ok) { ui.loginError = j.error || 'Connexion impossible.'; render(); return; }
          isAuthenticated = true; currentUsername = j.username || ''; startSession();
        });
      }).catch(function () { ui.loginError = 'Pas de connexion au serveur.'; render(); });
    } else if (form.dataset.form === 'setup') {
      ui.loginError = '';
      if (fd.get('password') !== fd.get('password2')) { ui.loginError = 'Les deux mots de passe ne sont pas identiques.'; render(); return; }
      apiFetch('/api/setup', { method: 'POST', body: { username: fd.get('username'), password: fd.get('password'), code: fd.get('code') } }).then(function (r) {
        return r.json().then(function (j) {
          if (!r.ok) { ui.loginError = j.error || 'Création impossible.'; render(); return; }
          ui.setup = false; isAuthenticated = true; currentUsername = j.username || ''; startSession();
        });
      }).catch(function () { ui.loginError = 'Pas de connexion au serveur.'; render(); });
    } else if (form.dataset.form === 'username') {
      var nu = String(fd.get('username') || '').trim();
      api('/api/account/username', { method: 'POST', body: { username: nu } })
        .then(function (r) { currentUsername = r.username; persistLocal(); ui.accMsg = 'Identifiant enregistré : ' + r.username + '.'; }).catch(function (e) { ui.accMsg = e.message; }).finally(function () { render(true); });
    } else if (form.dataset.form === 'password') {
      api('/api/account/password', { method: 'POST', body: { currentPassword: fd.get('cur'), newPassword: fd.get('nw') } })
        .then(function () { ui.pwMsg = 'Mot de passe changé.'; }).catch(function (e) { ui.pwMsg = e.message; }).finally(function () { render(true); });
    }
  });

  // ===================== Démarrage =====================
  // Extrait le titre d'un texte de partage : retire les liens, « Regardez … sur Prime Video ! », « … - Netflix ».
  var PLAT_RE = '(?:Amazon Prime Video|Prime Video|Amazon|Netflix|Disney\\+|Disney Plus|Disney|Apple TV\\+?|Apple TV Plus|HBO Max|Max|Canal\\+?|Paramount\\+?|Paramount Plus|Streamz|Auvio|RTBF|YouTube|Rakuten TV|Pathé Home|MUBI|Arte|OCS|Crunchyroll|JustWatch|TMDB|IMDb|AlloCiné|Letterboxd|Trakt)';
  function titleFromShare(t) {
    var x = String(t || '').replace(/https?:\/\/\S+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!x) return '';
    var m = new RegExp('^(?:regardez|regarde|regardons|voir|découvrez|découvre|retrouvez|watch|check out|checkout|stream|streaming)\\s+(.+)\\s+(?:sur|on|via|chez|dans|with)\\s+' + PLAT_RE + '\\b.*$', 'i').exec(x);
    if (m) x = m[1];
    else {
      x = x.replace(new RegExp('\\s*[|–—-]\\s*' + PLAT_RE + '\\b.*$', 'i'), '');
      x = x.replace(new RegExp('\\s+(?:sur|on)\\s+' + PLAT_RE + '\\b[\\s!?.]*$', 'i'), '');
    }
    x = x.replace(/[!?«»"“”]+/g, ' ').replace(/\s+/g, ' ').trim();
    // « Mr Robot Season 1 », « Dark - Saison 2 épisode 3 », « Lupin S02E05 » : on ne cherche que le titre de la série.
    var cut = x.replace(/[\s:,–—-]+(?:(?:season|saison|staffel|temporada|stagione|series|série)\s*\d+|s\d{1,2}(?:\s*e\d{1,3})?|(?:episode|épisode|ep)\s*\d+)\b.*$/i, '').trim();
    return cut || x;
  }

  // Partage depuis une autre appli (share_target) : ?title=…&text=…&url=… → recherche pré-remplie.
  function handleLaunch() {
    var p = new URLSearchParams(location.search);
    var action = p.get('action'), title = p.get('title'), text = p.get('text'), url = p.get('url'), view = p.get('view');
    if (!S || !isAuthenticated || !(action || title || text || url || view)) return;
    history.replaceState(null, '', location.pathname + location.hash);
    if (view === 'news') { ui.hist = []; ui.screen = 'news'; render(); return; }
    if (view === 'match') { ui.hist = []; ui.screen = 'envies'; ui.cs = 'match'; render(); return; }
    if (view === 'tonight') { ui.hist = []; ui.screen = 'home'; render(); return; }
    if (action === 'ce-soir') { ui.hist = []; ui.screen = 'envies'; render(); return; }
    var q = '';
    if (action !== 'ajouter') {
      // Le titre partagé prime ; sinon le texte (« Regardez Masterplan sur Prime Video ! » → « Masterplan »).
      var raw = titleFromShare(title) || titleFromShare(text);
      if (!raw && url) { try { var seg = new URL(url).pathname.split('/').filter(Boolean).pop() || ''; raw = seg.replace(/[-_]+/g, ' ').replace(/\.\w+$/, '').replace(/^\d+\s*/, '').trim(); } catch (e) {} }
      q = raw.replace(/[«»"“”]/g, '').slice(0, 80);
    }
    ui.hist = []; ui.q = q; ui.sr = null; ui.screen = 'add'; render();
    if (norm(q).length >= 2) runSearch();
    var inp = document.getElementById('q'); if (inp && !q) inp.focus();
  }

  function startSession() {
    booted = true; render(); startPolling();
    api('/api/config').then(function (c) { CFG = c; }).catch(function () {}).then(function () {
      return pullState();
    }).then(function () {
      if (S) { loadProviders(); handleLaunch(); maybeRefreshAvail(); }
    });
  }

  function boot() {
    var saved = readLocal();
    if (saved && saved.state) { S = migrate(saved.state); baseState = saved.base || null; baseVersion = saved.version == null ? null : saved.version; dirty = !!saved.dirty; currentUsername = saved.user || ''; }
    apiFetch('/api/session', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (sess) {
      setOnline(true);
      isAuthenticated = !!sess.authenticated;
      if (sess.username) currentUsername = sess.username;
      if (!isAuthenticated) { ui.setup = !!sess.setup; booted = true; render(); return; }
      startSession();
    }).catch(function () {
      // Pas de réseau : on ouvre la copie gardée sur l'appareil.
      online = false; booted = true; isAuthenticated = !!S; render();
      if (S) { startPolling(); handleLaunch(); }
      scheduleRetry();
    });
  }
  render();
  boot();
})();
