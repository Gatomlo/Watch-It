(function () {
  "use strict";

  // Chemin de montage (même principe que Fée Lezcomptes) : déduit de l'URL du script.
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
  function fmtDate(d) { var a = String(d).split('-'); return (+a[2]) + ' ' + MON[+a[1] - 1]; }
  function daysSince(d) { return Math.floor((Date.now() - Date.parse(d)) / 86400000); }
  function fmtLen(m) { var h = Math.floor(m / 60), r = m % 60; return h ? h + ' h' + (r ? ' ' + (r < 10 ? '0' : '') + r : '') : r + ' min'; }
  function hueOf(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; }

  var ico = {
    back: '<path d="M15 5l-7 7 7 7"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>', plus: '<path d="M12 5v14M5 12h14"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>', list: '<path d="M4 6h16M4 12h16M4 18h10"/>', checkc: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
    dice: '<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.2"/><circle cx="15.5" cy="15.5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="15.5" cy="8.5" r="1.2"/><circle cx="8.5" cy="15.5" r="1.2"/>',
    play: '<path d="M8 5l12 7-12 7z"/>', up: '<path d="M7 11v9H4v-9zM7 11l4-8c1.5 0 2.5 1 2.5 2.5V9H19a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.8 20H7"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.5l6.8-4M8.6 13.5l6.8 4"/>',
    dl: '<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>', ul: '<path d="M12 15V3M7 8l5-5 5 5M4 20h16"/>', chev: '<path d="M9 5l7 7-7 7"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5"/>', out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    filter: '<path d="M4 6h9M19 6h1M4 12h3M13 12h7M4 18h11M21 18h-1"/><circle cx="16" cy="6" r="2.2"/><circle cx="10" cy="12" r="2.2"/><circle cx="17.5" cy="18" r="2.2"/>'
  };
  function I(n, cls) { return '<svg class="ico ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + ico[n] + '</svg>'; }

  // ===================== État =====================
  // S = état partagé et synchronisé : { settings:{region,platforms[],profiles}, list[], dismissed }.
  // Fiche d'un titre dans la liste : { id:'movie:123', ty:'film'|'serie', t, y, p, g[], len, by, at, status:'todo'|'seen', r:{M,E}, note, av:{f[],at}, alert }.
  var S = null;
  var me = 'M';             // profil de cet appareil (propre à l'appareil, non synchronisé)
  try { me = localStorage.getItem('maiwatch-me') === 'E' ? 'E' : 'M'; } catch (e) {}
  var CFG = { tmdb: true, tmdbKey: { hasKey: true, last4: null, source: 'app' }, region: 'BE', ai: { provider: 'claude', hasKey: false, last4: null, tested: false } };
  var AV = {};              // disponibilité des titres de la liste : id -> { f[], r[], b[], trailer }
  var AV_AT = 0;
  var PV = {};              // plateformes connues : id -> { id, name, logo }
  var KNOWN = {};           // fiches légères vues dans les résultats : id -> item
  try { var a = JSON.parse(localStorage.getItem('maiwatch-av') || 'null'); if (a && a.map) { AV = a.map; AV_AT = a.at || 0; } } catch (e) {}
  try { var pv0 = JSON.parse(localStorage.getItem('maiwatch-pv') || 'null'); if (pv0) pv0.forEach(function (p) { PV[p.id] = p; }); } catch (e) {}

  var ui = {
    screen: 'home', hist: [], detail: null, dd: null, type: 'all', plats: [], genres: [], fq: '', fexp: false, sheet: null,
    tab: 'me', sug: {}, sugVer: 0, q: '', sr: null, srBusy: false, envie: '', env: null, envBusy: false,
    impText: '', impRows: null, impMode: 'paste', impBusy: false, pvq: '', aiMsg: '', aiBusy: false, pwMsg: '', loginError: '', setup: false, tmdbMsg: '', tmdbBusy: false
  };
  var booted = false, isAuthenticated = false, currentUsername = '';

  function defaultState() { return { settings: { region: 'BE', platforms: [], profiles: { M: 'Moi', E: 'Elle' } }, list: [], dismissed: { M: [], E: [] } }; }
  function migrate(s) {
    s = s || defaultState();
    s.settings = s.settings || {};
    s.settings.region = s.settings.region || 'BE';
    s.settings.platforms = s.settings.platforms || [];
    s.settings.profiles = Object.assign({ M: 'Moi', E: 'Elle' }, s.settings.profiles || {});
    s.list = s.list || [];
    s.dismissed = Object.assign({ M: [], E: [] }, s.dismissed || {});
    return s;
  }
  function pname(u) { return (S && S.settings.profiles[u]) || (u === 'M' ? 'Moi' : 'Elle'); }
  function initial(u) { return pname(u).charAt(0).toUpperCase() || u; }
  function other(u) { return u === 'M' ? 'E' : 'M'; }
  function entry(id) { for (var i = 0; i < S.list.length; i++) if (S.list[i].id === id) return S.list[i]; return null; }
  function know(it) { if (it && it.id) KNOWN[it.id] = Object.assign(KNOWN[it.id] || {}, it); return it; }
  function lite(it) {
    return { id: it.id, ty: it.ty, t: it.t, y: it.y || null, p: it.p || null, g: it.g || [], len: it.len || null };
  }
  function addEntry(it, status) {
    var e = Object.assign(lite(it), { by: me, at: todayISO(), status: status || 'todo', r: {}, note: '' });
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
  // Même principe que Fée Lezcomptes : l'état vit d'abord sur l'appareil (localStorage) puis
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
  function logoOf(id) { var p = PV[id]; return p && p.logo ? '<img class="pl" src="' + IMG + 'w45' + esc(p.logo) + '" alt="" loading="lazy">' : '<span class="dot" style="background:var(--muted)"></span>'; }
  function pnameOf(id) { return PV[id] ? PV[id].name : 'Plateforme ' + id; }
  function loadProviders(force) {
    if (!force && Object.keys(PV).length) return Promise.resolve();
    return api('/api/providers?region=' + encodeURIComponent(S.settings.region)).then(function (list) {
      PV = {}; list.forEach(function (p) { PV[p.id] = p; });
      try { localStorage.setItem('maiwatch-pv', JSON.stringify(list)); } catch (e) {}
    }).catch(function () {});
  }
  function platsOn() { return S.settings.platforms; }
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
  function passes(it, skip) {
    if (skip !== 'type' && ui.type !== 'all' && it.ty !== ui.type) return false;
    if (skip !== 'plat' && ui.plats.length) { var a = AV[it.id]; if (!a || !a.f.some(function (p) { return ui.plats.indexOf(p) >= 0; })) return false; }
    if (skip !== 'genre' && ui.genres.length && !(it.g || []).some(function (g) { return ui.genres.indexOf(g) >= 0; })) return false;
    return true;
  }
  function pool(scr) {
    scr = scr || ui.screen;
    if (scr === 'sug') { var s = ui.sug[ui.tab]; return s && s.items ? s.items.map(function (x) { return x.item; }) : []; }
    var st = scr === 'seen' ? 'seen' : 'todo';
    return S.list.filter(function (e) { return e.status === st; });
  }
  function nFilters() { return ui.plats.length + ui.genres.length; }

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
  function platBadge(id) { return '<span class="badge">' + logoOf(id) + esc(pnameOf(id)) + '</span>'; }
  function badges(it, av) {
    var a = av || AV[it.id], mine = a ? a.f.filter(function (p) { return platsOn().indexOf(p) >= 0; }) : [], h = '';
    mine.forEach(function (p) { h += platBadge(p); });
    var e = entry(it.id);
    if (e && e.alert && daysSince(e.alert.at) <= 21 && e.status === 'todo') {
      h += e.alert.k === 'gone' ? '<span class="badge warn">N’est plus sur ' + esc(pnameOf(e.alert.p)) + '</span>' : '<span class="badge ok">Nouveau sur ' + esc(pnameOf(e.alert.p)) + '</span>';
    }
    if (!a) h += '<span class="badge mut">Plateformes…</span>';
    else if (!mine.length) h += a.f.length ? '<span class="badge mut">Sur d’autres plateformes</span>' : (a.r.length || a.b.length ? '<span class="badge warn">Location ou achat</span>' : '<span class="badge warn">Pas en streaming</span>');
    if (a) h += a.trailer ? '<span class="badge soft">▶ Bande-annonce</span>' : '<span class="badge mut">Sans bande-annonce</span>';
    return '<div class="badges">' + h + '</div>';
  }
  function ava(u) { return '<span class="ava ' + u + '" aria-label="Ajouté par ' + esc(pname(u)) + '">' + esc(initial(u)) + '</span>'; }
  function rowHtml(it, e) {
    return '<button class="row" data-act="open" data-id="' + esc(it.id) + '">' + poster(it) + '<span class="rb"><span class="rt"><span class="title">' + esc(it.t) + '</span>' + (e ? ava(e.by) : '') + '</span><span class="meta">' + meta(it) + '</span>' + badges(it) + '</span></button>';
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
    ui.plats.forEach(function (k) { toks.push({ k: 'plat', v: k, l: pnameOf(k) }); });
    ui.genres.forEach(function (g) { toks.push({ k: 'genre', v: g, l: g }); });
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
    var plats = platsOn().map(function (k) { return crow('plat', k, pnameOf(k), pc[k] || 0, ui.plats.indexOf(k) >= 0, logoOf(k)); }).join('');
    return '<div class="scrim" data-scrim="1"><div class="sheet fsheet" role="dialog" aria-modal="true" aria-label="Filtres"><div class="fhead"><h3>Filtres</h3><button class="icon" data-act="closesheet" aria-label="Fermer">' + I('close') + '</button></div>' +
      '<div class="fbody">' +
      '<div class="fgroup"><h2>Plateformes</h2><div>' + (plats || '<span class="help">Choisissez d’abord vos plateformes dans les réglages.</span>') + '</div></div>' +
      '<div class="fgroup"><h2>Genres</h2><label for="gq" style="position:absolute;left:-9999px">Chercher un genre</label><input id="gq" class="fsearch" type="search" autocomplete="off" placeholder="Chercher un genre" value="' + esc(ui.fq) + '"><div id="glist">' + genreList() + '</div></div></div>' +
      '<div style="display:flex;gap:10px"><button class="btn ghost" style="flex:none;width:auto" data-act="resetf"' + (nFilters() ? '' : ' disabled') + '>Effacer</button><button class="btn" data-act="closesheet">Voir ' + N + ' titre' + (N > 1 ? 's' : '') + '</button></div></div></div>';
  }
  function acts(id, third) {
    return '<div style="display:flex;gap:8px;margin:-6px 0 0 64px;flex-wrap:wrap"><button class="chip" style="height:44px;padding:0 14px;background:var(--accent);border-color:var(--accent);color:var(--ink);font-weight:800" data-act="add" data-id="' + esc(id) + '">' + I('plus') + 'Ajouter</button><button class="chip" style="height:44px;padding:0 14px" data-act="already" data-id="' + esc(id) + '">' + I('check') + 'Déjà vu</button>' + (third || '') + '</div>';
  }
  function reasonHtml(parts) {
    if (!parts || !parts.length) return 'Proche de vos goûts';
    return 'Proche de ' + parts.map(function (p) { return '<b>' + esc(p.t) + '</b> (' + esc(p.l) + ')'; }).join(' et de ');
  }
  function skeletons(n) { var h = ''; for (var i = 0; i < n; i++) h += '<div class="skel"></div>'; return '<div class="list" aria-busy="true">' + h + '</div>'; }
  function errBox(msg, act) { return '<div class="empty">' + esc(msg) + (act ? '<br><button class="link" data-act="' + act + '">Réessayer</button>' : '') + '</div>'; }
  // Clé TMDB : saisie ici (vérifiée puis chiffrée côté serveur), jamais dans un fichier.
  function tmdbForm(first) {
    var T = CFG.tmdbKey || {};
    return '<div class="group"><label for="tmdbkey" class="help" style="line-height:1.5">' + (first ? '<b style="color:var(--fg)">Dernière étape : la clé TMDB.</b> ' : '') +
      'TMDB fournit les films, séries, affiches et plateformes. Compte gratuit sur <a href="https://www.themoviedb.org/signup" target="_blank" rel="noopener" style="color:var(--fg)">themoviedb.org</a>, puis ' +
      '<a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener" style="color:var(--fg)">Réglages &gt; API</a> : copiez la « Clé d’API » (ou le « Jeton d’accès en lecture »).</label>' +
      '<input id="tmdbkey" class="kinput" type="password" autocomplete="off" placeholder="' + (T.hasKey && T.last4 ? 'Clé enregistrée (…' + esc(T.last4) + '). Collez-en une autre pour la remplacer.' : 'Collez la clé TMDB') + '">' +
      '<div style="display:flex;gap:10px"><button class="btn ghost" style="height:44px" data-act="tmdbsave"' + (ui.tmdbBusy ? ' disabled' : '') + '>' + (ui.tmdbBusy ? 'Vérification…' : 'Enregistrer et vérifier') + '</button>' +
      (T.hasKey && T.source === 'app' ? '<button class="btn ghost" style="height:44px" data-act="tmdbclear">Retirer la clé</button>' : '') + '</div>' +
      (ui.tmdbMsg ? '<div class="notice" role="status">' + esc(ui.tmdbMsg) + '</div>' : '') + '</div>';
  }
  function noTmdb() { return '<div class="notice">' + tmdbForm(true) + '</div>'; }

  // ===================== Écrans =====================
  var V = {};

  V.home = function () {
    var todo = S.list.filter(function (e) { return e.status === 'todo'; }).sort(function (a, b) { return a.at < b.at ? 1 : -1; });
    var nAv = todo.filter(function (e) { return avail(e).length; }).length;
    var shown = todo.filter(function (e) { return passes(e); });
    var sub = todo.length + ' titre' + (todo.length > 1 ? 's' : '') + (platsOn().length ? ' · ' + nAv + ' dispo sur vos plateformes' : '');
    return header('À voir', sub) + (!CFG.tmdb ? noTmdb() : '') +
      (!platsOn().length && todo.length ? '<div class="notice"><b>Choisissez vos plateformes</b> dans les <button class="link" style="padding:0;min-height:0;color:var(--fg)" data-act="push" data-to="settings">réglages</button> pour voir ce qui est disponible chez vous.</div>' : '') +
      filterBar('<button class="fbtn rand" data-act="draw">' + I('dice') + 'Au hasard</button>') +
      (shown.length ? '<div class="list">' + shown.map(function (e) { return rowHtml(e, e); }).join('') + '</div>' :
        '<div class="empty">' + (todo.length ? 'Aucun titre ne correspond à ces filtres.<br><button class="link" data-act="resetf">Effacer les filtres</button>' : 'Rien dans la liste pour l’instant.<br>Touchez + ou partagez un lien depuis Signal.') + '</div>');
  };

  V.seen = function () {
    var all = S.list.filter(function (e) { return e.status === 'seen'; }).sort(function (a, b) { return a.at < b.at ? 1 : -1; });
    var seen = all.filter(function (e) { return passes(e); });
    function th(e, u) { var r = e.r[u]; return '<span class="badge' + (r ? '' : ' mut') + '">' + esc(initial(u)) + ' ' + (r === 1 ? '👍' : r === -1 ? '👎' : 'pas noté') + '</span>'; }
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
    var hero = '<div class="hero" style="background:' + (it.p ? 'linear-gradient(180deg,rgba(23,20,26,.25),var(--bg)),url(' + IMG + 'w780' + esc(it.p) + ') center/cover' : 'linear-gradient(170deg,hsl(' + h + ' 38% 36%) 0%,hsl(' + h + ' 22% 18%) 55%,var(--bg) 100%)') + '">' + back() +
      (tr ? '<a class="play" href="' + tr + '" target="_blank" rel="noopener" aria-label="Voir la bande-annonce">' + I('play') + '</a><span class="hl">Bande-annonce</span>'
        : (d ? '<span class="hl">Pas de bande-annonce trouvée · <a href="' + yt + '" target="_blank" rel="noopener">chercher sur YouTube</a></span>' : '')) + '</div>';
    var where = '';
    if (d) {
      var f = d.av.f, shown = {};
      f.forEach(function (p) {
        var on = platsOn().indexOf(p) >= 0; shown[p] = 1;
        where += '<div class="card' + (on ? '' : ' q') + '">' + logoOf(p) + '<span class="ct"><b>' + esc(pnameOf(p)) + '</b><span>Inclus dans l’abonnement</span></span><span class="st ' + (on ? 'ok' : 'no') + '">' + (on ? 'Dans votre abo' : 'Pas dans vos abos') + '</span></div>';
      });
      var extra = [];
      d.avNames.r.forEach(function (n) { extra.push(n + ' (location)'); });
      d.avNames.b.forEach(function (n) { if (d.avNames.r.indexOf(n) < 0) extra.push(n + ' (achat)'); });
      if (extra.length) where += '<div class="card q"><span class="ct"><b>Location ou achat</b><span>' + esc(extra.slice(0, 5).join(' · ')) + '</span></span></div>';
      if (!where) where = '<div class="empty">Pas disponible en streaming dans votre région pour l’instant.</div>';
    } else where = skeletons(1);
    var rates = '';
    if (e && e.status === 'seen') {
      rates = '<div class="group"><h2>Notre avis</h2>' + ['M', 'E'].map(function (u) {
        var r = e.r[u];
        return '<div class="card"><span class="ava ' + u + '">' + esc(initial(u)) + '</span><span class="ct"><b>' + esc(pname(u)) + '</b></span><button class="thumb up' + (r === 1 ? ' on' : '') + '" data-act="setr" data-id="' + esc(id) + '" data-u="' + u + '" data-v="1" aria-label="' + esc(pname(u)) + ' a aimé" aria-pressed="' + (r === 1) + '">' + I('up') + '</button><button class="thumb down' + (r === -1 ? ' on' : '') + '" data-act="setr" data-id="' + esc(id) + '" data-u="' + u + '" data-v="-1" aria-label="' + esc(pname(u)) + ' n’a pas aimé" aria-pressed="' + (r === -1) + '">' + I('up') + '</button></div>';
      }).join('') + '</div>';
    }
    var note = e ? '<div class="group"><h2>Notre note</h2><label for="note" style="position:absolute;left:-9999px">Note sur ce titre</label><textarea id="note" class="ta" rows="2" placeholder="Pourquoi on veut le voir, qui l’a conseillé…" data-note="' + esc(id) + '">' + esc(e.note || '') + '</textarea><span class="help">Ajouté par ' + esc(pname(e.by)) + ' le ' + fmtDate(e.at) + '</span></div>' : '';
    var dock;
    var rm = '<button class="icon" style="width:52px;height:52px;border-radius:26px" data-act="remove" data-id="' + esc(id) + '" aria-label="Supprimer de la liste">' + I('trash') + '</button>';
    if (!e) dock = '<button class="btn" data-act="add" data-id="' + esc(id) + '">Ajouter à ma liste</button><button class="btn ghost" style="flex:none;width:auto" data-act="already" data-id="' + esc(id) + '">Déjà vu</button>';
    else if (e.status === 'todo') dock = '<button class="btn" data-act="askseen" data-id="' + esc(id) + '">Marquer comme vu</button>' + rm;
    else dock = '<button class="btn ghost" data-act="unseen" data-id="' + esc(id) + '">Remettre à voir</button>' + rm;
    var gen = (it.g || []).join(', ');
    return hero + '<div class="group" style="gap:6px;margin-top:-6px"><h1>' + esc(it.t) + '</h1><span class="meta">' + meta(it) + (gen ? ' · ' + esc(gen) : '') + '</span></div>' +
      (d && d.ov ? '<p class="syn">' + esc(d.ov) + '</p>' : (d ? '' : '<div class="skel" style="height:72px"></div>')) +
      '<div class="group"><div class="sec"><h2>Où le voir</h2><span class="help">Source : TMDB / JustWatch</span></div>' + where + '</div>' + rates + note + '<div class="dock">' + dock + '</div>';
  };

  function addResults() {
    var q = norm(ui.q);
    if (q.length < 2) return '<h2>Recherche</h2><div class="empty">Tapez au moins deux lettres : la recherche couvre tous les films et séries de TMDB.</div>';
    if (ui.srBusy && !ui.sr) return '<h2>Recherche…</h2>' + skeletons(3);
    if (!ui.sr) return '';
    if (ui.sr.error) return errBox(ui.sr.error);
    var list = ui.sr.items;
    return '<h2>' + list.length + ' résultat' + (list.length > 1 ? 's' : '') + '</h2>' + (list.length ? list.map(function (it) {
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
      '<div class="tip">' + I('share') + '<span>Depuis Signal, un navigateur ou une appli de streaming : touchez Partager puis mAIwatch. Le titre se cherche tout seul. (Appli installée sur Android.)</span></div>' +
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
  V.sug = function () {
    var ot = other(me), tabs = [['me', pname(me)], ['other', pname(ot)], ['both', 'Nous deux']];
    var s = sugState(), body;
    if (!platsOn().length) body = '<div class="notice"><b>Choisissez vos plateformes</b> dans les <button class="link" style="padding:0;min-height:0;color:var(--fg)" data-act="push" data-to="settings">réglages</button> : les suggestions se limitent à ce que vous pouvez regarder.</div>';
    else body = '';
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
        var a = { f: it.av.f, r: it.av.r, b: it.av.b, trailer: !!it.trailer };
        return '<div class="sug"><button class="row" style="gap:12px" data-act="open" data-id="' + esc(it.id) + '">' + poster(it, 'sm') + '<span class="rb"><span class="title" style="font-size:16px">' + esc(it.t) + '</span><span class="meta" style="font-size:12px">' + meta(it) + '</span><span class="badges">' + it.av.f.filter(function (p) { return platsOn().indexOf(p) >= 0; }).map(platBadge).join('') + '</span><span class="why">' + reasonHtml(x.why) + '</span></span></button></div>' +
          acts(it.id, '<button class="chip" style="height:44px;padding:0 14px;color:var(--muted)" data-act="dismiss" data-id="' + esc(it.id) + '">' + esc(dis) + '</button>');
      };
      cards = (list.length ? '<div class="list" style="gap:14px">' + list.slice(0, nFilters() || ui.type !== 'all' ? 12 : 6).map(card).join('') + '</div>' : '<div class="empty">' + (s.items.length ? 'Aucune suggestion ne correspond à ces filtres.<br><button class="link" data-act="resetf">Effacer les filtres</button>' : 'Pas encore de suggestion. Notez quelques titres vus ou importez votre historique dans les réglages.') + '</div>') +
        (fresh.length ? '<h2 style="margin-top:6px">Récent sur vos plateformes</h2><div class="list" style="gap:14px">' + fresh.slice(0, 4).map(card).join('') + '</div>' : '');
      if (s.st === 'loading') cards = '<div aria-busy="true" style="opacity:.6">' + cards + '</div>';
    }
    return header('Pour vous', 'Selon ce que vous avez aimé et ajouté') +
      '<div class="seg" role="tablist">' + tabs.map(function (t) { return '<button class="chip' + (ui.tab === t[0] ? ' on' : '') + '" role="tab" aria-selected="' + (ui.tab === t[0]) + '" data-act="tab" data-v="' + t[0] + '">' + (t[0] === 'both' ? t[1] : 'Pour ' + esc(t[1]).toLowerCase()) + '</button>'; }).join('') + '</div>' +
      (ui.tab === 'both' ? '<p class="help" style="margin:0">Titres qui plaisent aux deux profils.</p>' : '') + body + filterBar() + cards;
  };

  V.envies = function () {
    var ai = CFG.ai.hasKey && CFG.ai.tested;
    var chips = ['Cosy', 'Frissons sans gore', 'Un épisode de 40 min'].map(function (t) { return '<button class="chip" style="height:36px;padding:0 14px;font-size:13px;color:var(--soft)" data-act="chip" data-v="' + esc(t) + '">' + t + '</button>'; }).join('');
    var r = ui.env, out = '';
    if (ui.envBusy) out = '<div class="spin">' + (CFG.ai.hasKey ? esc(PROVS[CFG.ai.provider]) + ' réfléchit…' : 'Recherche…') + '</div>' + skeletons(2);
    else if (r && r.error) out = errBox(r.error);
    else if (r) {
      var one = function (it, why, add) {
        var a = AV[it.id] || { f: it.av ? it.av.f : [], r: [], b: [], trailer: false };
        return '<div class="sug"><button class="row" style="gap:12px" data-act="open" data-id="' + esc(it.id) + '">' + poster(it, 'sm') + '<span class="rb"><span class="title" style="font-size:16px">' + esc(it.t) + '</span><span class="meta" style="font-size:12px">' + meta(it) + '</span><span class="badges">' + a.f.filter(function (p) { return platsOn().indexOf(p) >= 0; }).map(platBadge).join('') + '</span><span class="why">' + esc(why) + '</span></span></button></div>' + (add ? acts(it.id, '') : '');
      };
      var mine = r.inList.map(function (x) { return { it: entry(x.id), why: x.why }; }).filter(function (x) { return x.it; });
      out = (r.note ? '<div class="notice">' + esc(r.note) + '</div>' : '') +
        (mine.length ? '<h2>Dans votre liste</h2><div class="list" style="gap:14px">' + mine.map(function (x) { return one(x.it, x.why, false); }).join('') + '</div>' : '') +
        (r.fresh.length ? '<h2 style="margin-top:6px">Nouvelles suggestions</h2><div class="list" style="gap:14px">' + r.fresh.map(function (x) { know(x.item); return one(x.item, x.why, !entry(x.item.id)); }).join('') + '</div>' : '') +
        (!mine.length && !r.fresh.length ? '<div class="empty">Rien ne correspond exactement. Essayez d’assouplir une contrainte (durée, ton).</div>' : '');
    }
    return header('Ce soir', '') + (!CFG.tmdb ? noTmdb() : '') +
      '<label for="envie" style="position:absolute;left:-9999px">Décrivez votre envie</label><textarea id="envie" class="ta hi" rows="3" placeholder="Quelque chose de léger, moins de 2 h, qui ne fait pas trop peur…">' + esc(ui.envie) + '</textarea>' +
      '<div class="chips scroll">' + chips + '</div>' +
      '<div style="display:flex;gap:10px;align-items:center"><button class="btn" data-act="envie"' + (ui.envBusy ? ' disabled' : '') + '>Trouver</button><span class="help" style="flex:none;text-align:right">' + (CFG.ai.hasKey ? 'via ' + esc(PROVS[CFG.ai.provider]) : 'mots-clés') + '<br>vos plateformes</span></div>' +
      (!CFG.ai.hasKey ? '<div class="tip">' + I('spark') + '<span>Sans clé API, la recherche repère des mots-clés (durée, ton, série ou film). Ajoutez une clé dans les <button class="link" style="padding:0;min-height:0;color:var(--fg)" data-act="push" data-to="settings">réglages</button> pour décrire librement vos envies.</span></div>' : '') + out;
  };

  V.settings = function () {
    var A = CFG.ai;
    var st = A.hasKey ? (A.tested ? '<span class="st ok">Clé testée</span>' : '<span class="st no">Non testée</span>') : '<span class="st no">Aucune clé</span>';
    var cnt = { M: 0, E: 0 };
    S.list.forEach(function (e) { if (e.status === 'seen') { if (e.r.M) cnt.M++; if (e.r.E) cnt.E++; } });
    var provs = Object.keys(PV).map(function (k) { return PV[k]; });
    var q = norm(ui.pvq);
    var shownP = provs.filter(function (p) { return !q || norm(p.name).indexOf(q) >= 0; });
    var rows = shownP.slice(0, q ? 60 : 18).map(function (p) { return crow('mp', p.id, p.name, '', platsOn().indexOf(p.id) >= 0, logoOf(p.id)); }).join('');
    var region = '<select id="region" class="fld" aria-label="Région">' + REGIONS.map(function (r) { return '<option value="' + r[0] + '"' + (S.settings.region === r[0] ? ' selected' : '') + '>' + r[1] + '</option>'; }).join('') + '</select>';
    var T = CFG.tmdbKey || {};
    return '<header class="top tight">' + back() + '<h1 class="s">Réglages</h1></header>' +
      '<div class="group"><div class="sec"><h2>Films et séries (TMDB)</h2>' + (T.hasKey ? '<span class="st ok">Clé enregistrée</span>' : '<span class="st no">Aucune clé</span>') + '</div>' + (T.source === 'env' ? '<span class="help">Clé fournie par le serveur (variable d’environnement).</span>' : '') + tmdbForm(false) + '</div>' +
      '<div class="group"><div class="sec"><h2>Nos plateformes</h2></div>' + region +
      '<label for="pvq" style="position:absolute;left:-9999px">Chercher une plateforme</label><input id="pvq" class="fsearch" type="search" autocomplete="off" placeholder="Chercher une plateforme" value="' + esc(ui.pvq) + '">' +
      '<div id="pvlist">' + (rows || '<span class="help">' + (provs.length ? 'Aucune plateforme ne correspond.' : 'Chargement des plateformes…') + '</span>') + '</div></div>' +
      '<div class="group"><h2>Profils</h2><div class="pwd"><label class="help" for="pn-M">Premier profil</label><input id="pn-M" class="fld" data-prof="M" value="' + esc(pname('M')) + '" maxlength="20"><label class="help" for="pn-E">Second profil</label><input id="pn-E" class="fld" data-prof="E" value="' + esc(pname('E')) + '" maxlength="20"></div>' +
      '<span class="help">' + esc(pname('M')) + ' : ' + cnt.M + ' titres notés · ' + esc(pname('E')) + ' : ' + cnt.E + '</span></div>' +
      '<div class="group"><h2>Profil actif sur cet appareil</h2><div class="seg">' + ['M', 'E'].map(function (u) { return '<button class="chip' + (me === u ? ' on' : '') + '" data-act="profile" data-u="' + u + '" aria-pressed="' + (me === u) + '"><span class="ava ' + u + '">' + esc(initial(u)) + '</span>' + esc(pname(u)) + '</button>'; }).join('') + '</div></div>' +
      '<div class="group"><div class="sec"><h2>Assistant d’envies</h2>' + st + '</div><div class="seg">' + Object.keys(PROVS).map(function (p) { return '<button class="chip" style="' + (A.provider === p ? 'background:var(--surface2);border-color:var(--accent)' : '') + '" data-act="aiprov" data-v="' + p + '" aria-pressed="' + (A.provider === p) + '">' + PROVS[p] + '</button>'; }).join('') + '</div>' +
      '<label for="key" style="position:absolute;left:-9999px">Clé API ' + esc(PROVS[A.provider]) + '</label><input id="key" class="kinput" type="password" autocomplete="off" placeholder="' + (A.hasKey ? 'Clé enregistrée (…' + esc(A.last4) + '). Collez-en une autre pour la remplacer.' : 'Collez votre clé API ' + esc(PROVS[A.provider])) + '">' +
      '<div style="display:flex;gap:10px"><button class="btn ghost" style="height:44px" data-act="aisave"' + (ui.aiBusy ? ' disabled' : '') + '>' + (ui.aiBusy ? 'Test en cours…' : 'Enregistrer et tester') + '</button>' + (A.hasKey ? '<button class="btn ghost" style="height:44px" data-act="aiclear">Retirer la clé</button>' : '') + '</div>' +
      (ui.aiMsg ? '<div class="notice" role="status">' + esc(ui.aiMsg) + '</div>' : '') +
      '<span class="help">Facultatif. La clé reste sur votre serveur, chiffrée : le navigateur ne la revoit jamais. Elle sert à comprendre vos envies et à classer des titres choisis par TMDB. Chaque recherche « Ce soir » envoie votre phrase et une courte liste de titres au fournisseur choisi.</span></div>' +
      '<div class="group"><h2>Données</h2><div class="menu"><button class="mi" data-act="push" data-to="import">' + I('dl').replace('class="ico "', 'class="ico" style="stroke:var(--accent)"') + '<span class="ct"><b>Importer nos films et séries vus</b><span>Pour que les suggestions nous ressemblent dès le départ</span></span>' + I('chev') + '</button>' +
      '<button class="mi" data-act="export">' + I('ul') + '<span class="ct"><b>Exporter la liste</b><span>Fichier CSV</span></span></button></div></div>' +
      '<div class="group"><h2>Compte</h2><form class="pwd" data-form="password"><input class="fld" type="password" name="cur" placeholder="Mot de passe actuel" autocomplete="current-password" required><input class="fld" type="password" name="nw" placeholder="Nouveau mot de passe (8 caractères minimum)" autocomplete="new-password" minlength="8" required><button class="btn ghost" style="height:44px" type="submit">Changer le mot de passe</button></form>' +
      (ui.pwMsg ? '<div class="notice" role="status">' + esc(ui.pwMsg) + '</div>' : '') +
      '<button class="btn ghost" style="height:44px" data-act="logout">' + I('out') + ' Se déconnecter</button></div>' +
      '<p class="cred">Films, séries, affiches et bandes-annonces : TMDB. Ce produit utilise l’API TMDB mais n’est ni approuvé ni certifié par TMDB. Informations « où regarder » : JustWatch, via TMDB.</p>';
  };

  V.import = function () {
    var modes = [['paste', 'Coller une liste'], ['csv', 'Fichier CSV'], ['hand', 'À la main']].map(function (m) { return '<button class="chip' + (ui.impMode === m[0] ? ' on' : '') + '" style="flex:1;justify-content:center;padding:0 6px;font-size:13px" data-act="impmode" data-v="' + m[0] + '">' + m[1] + '</button>'; }).join('');
    var rows = '', n = 0;
    if (ui.impBusy) rows = skeletons(3);
    else if (ui.impRows) {
      n = ui.impRows.filter(function (r) { return r.item; }).length;
      rows = '<div class="sec"><h2>' + n + ' reconnu' + (n > 1 ? 's' : '') + ' sur ' + ui.impRows.length + ' · ' + esc(pname(me)) + '</h2></div><div class="list" style="gap:8px">' + ui.impRows.map(function (r, i) {
        if (!r.item) return '<div class="sug" style="align-items:center"><div class="poster xs" style="background:var(--line2)"></div><span class="rb" style="gap:2px"><span style="font-weight:700;color:var(--warn)">' + esc(r.raw) + '</span><span class="meta" style="font-size:12px;color:var(--warn)">Non reconnu · ignoré à l’import</span></span></div>';
        var it = r.item;
        return '<div class="sug" style="align-items:center">' + poster(it, 'xs') + '<span class="rb" style="gap:2px"><span style="font-weight:700">' + esc(it.t) + '</span><span class="meta" style="font-size:12px">' + meta(it) + '</span></span><button class="thumb up' + (r.r === 1 ? ' on' : '') + '" data-act="imprate" data-i="' + i + '" data-v="1" aria-label="J’ai aimé ' + esc(it.t) + '" aria-pressed="' + (r.r === 1) + '">' + I('up') + '</button><button class="thumb down' + (r.r === -1 ? ' on' : '') + '" data-act="imprate" data-i="' + i + '" data-v="-1" aria-label="Je n’ai pas aimé ' + esc(it.t) + '" aria-pressed="' + (r.r === -1) + '">' + I('up') + '</button></div>';
      }).join('') + '</div>';
    }
    return '<header class="top tight">' + back() + '<h1 class="s">Importer nos titres vus</h1></header><div class="seg">' + modes + '</div>' +
      (ui.impMode === 'hand' ? '<div class="tip">' + I('check') + '<span>Cherchez chaque titre avec le bouton +, puis marquez-le comme vu pour le noter. <button class="link" style="padding:0;min-height:0;color:var(--fg)" data-act="push" data-to="add">Ouvrir la recherche</button></span></div>' :
        '<div class="group" style="gap:8px">' + (ui.impMode === 'csv' ? '<label class="btn ghost" for="csv" style="display:flex;align-items:center;justify-content:center;gap:10px;cursor:pointer">' + I('file') + 'Choisir un fichier CSV</label><input id="csv" type="file" accept=".csv,text/csv,text/plain" style="position:absolute;left:-9999px"><span class="help">Exports Letterboxd, Trakt ou JustWatch : la colonne Name, Title ou Titre est utilisée.</span>' : '') +
        '<label for="imp" class="help" style="line-height:1.4">Un titre par ligne. Ajoutez l’année entre parenthèses si plusieurs films portent le même nom.</label><textarea id="imp" class="ta" rows="5" style="font-size:14px">' + esc(ui.impText) + '</textarea>' +
        '<button class="btn ghost" style="height:44px" data-act="impanalyze"' + (ui.impBusy ? ' disabled' : '') + '>Analyser la liste</button></div>') + rows +
      (ui.impRows && !ui.impBusy ? '<div class="dock"><button class="btn" data-act="impgo"' + (n ? '' : ' disabled') + '>Importer ' + n + ' titre' + (n > 1 ? 's' : '') + '</button></div><span class="help" style="text-align:center">Les titres importés vont dans « Vus », pas dans « À voir ».</span>' : '');
  };

  function sheetHtml() {
    var s = ui.sheet; if (!s) return '';
    if (s.type === 'filter') return filterSheet();
    if (s.type === 'rate') {
      var it = entry(s.id) || KNOWN[s.id]; if (!it) return '';
      return '<div class="scrim" data-scrim="1"><div class="sheet" role="dialog" aria-modal="true" aria-label="Noter"><h3>Vous avez aimé « ' + esc(it.t) + ' » ?</h3><span class="help" style="margin-top:-8px">Votre note (' + esc(pname(me)) + ') améliore les suggestions.</span><div class="rate"><button data-act="rate" data-id="' + esc(s.id) + '" data-v="1">' + I('up') + 'Oui</button><button class="dn" data-act="rate" data-id="' + esc(s.id) + '" data-v="-1">' + I('up') + 'Non</button></div><button class="btn ghost" data-act="rate" data-id="' + esc(s.id) + '" data-v="0">Marquer vu sans noter</button></div></div>';
    }
    if (s.type === 'draw') {
      var d = s.id ? entry(s.id) : null;
      return '<div class="scrim" data-scrim="1"><div class="sheet" role="dialog" aria-modal="true" aria-label="Tirage au sort">' + (d ? '<span class="help" style="text-transform:uppercase;letter-spacing:.08em;font-weight:700">Ce soir, ce sera</span><div style="display:flex;gap:14px">' + poster(d) + '<div class="rb"><h3>' + esc(d.t) + '</h3><span class="meta">' + meta(d) + '</span>' + badges(d) + '</div></div><button class="btn" data-act="open" data-id="' + esc(d.id) + '">Voir la fiche</button><button class="btn ghost" data-act="draw">Un autre</button>' : '<h3>Rien à tirer</h3><span class="help">Aucun titre de la liste ne correspond à vos filtres et à vos plateformes.</span>') + '<button class="link" data-act="closesheet" style="align-self:center">Fermer</button></div></div>';
    }
    return '';
  }

  function setupView() {
    return '<div class="login"><form data-form="setup"><img src="' + BASE + '/logo.svg" alt=""><h1>Bienvenue sur mAIwatch</h1><p class="sub" style="margin:0">Créez le compte du foyer. Il sera partagé par les deux profils.</p>' +
      (ui.loginError ? '<p class="err">' + esc(ui.loginError) + '</p>' : '') +
      '<label>Identifiant<input type="text" name="username" required maxlength="40" autocomplete="username"></label>' +
      '<label>Mot de passe (8 caractères minimum)<input type="password" name="password" required minlength="8" autocomplete="new-password"></label>' +
      '<label>Confirmer le mot de passe<input type="password" name="password2" required minlength="8" autocomplete="new-password"></label>' +
      '<label>Code d’installation<input type="text" name="code" required autocomplete="off" autocapitalize="characters" placeholder="XXXX-XXXX-XXXX"><span class="help" style="font-weight:500">Affiché dans la console du serveur : <code>pm2 logs maiwatch</code> sur un serveur, ou le terminal où tourne <code>npm start</code>. Il garantit que vous seul créez le compte.</span></label>' +
      '<button type="submit" class="btn">Créer le compte</button></form></div>';
  }
  function loginView() {
    return '<div class="login"><form data-form="login"><img src="' + BASE + '/logo.svg" alt=""><h1>mAIwatch</h1><p class="sub" style="margin:0">Notre liste de films et séries</p>' +
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
    layer.innerHTML = sheetHtml();
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
    if (s === 'settings') loadProviders();
    render();
  }

  // ===================== Actions =====================
  function itemOf(id) { return entry(id) || KNOWN[id]; }
  function afterListChange() { if (ui.screen === 'add') { var r = document.getElementById('results'); if (r) r.innerHTML = addResults(); } else render(true); }

  function openDetail(id) {
    ui.sheet = null;
    ui.hist.push({ screen: ui.screen, detail: ui.detail });
    ui.detail = id; ui.screen = 'detail'; ui.dd = null;
    render();
    api('/api/title/' + encodeURIComponent(id)).then(function (d) {
      if (ui.detail !== id) return;
      ui.dd = d; know(lite(d));
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
    var q = ui.q.trim();
    if (norm(q).length < 2) { ui.sr = null; ui.srBusy = false; return; }
    ui.srBusy = true;
    var mine = q;
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

  var A = {
    go: function (d) { ui.plats = []; ui.genres = []; go(d.to, false); },
    push: function (d) { go(d.to, true); },
    back: function () { var h = ui.hist.pop(); if (h) { ui.screen = h.screen; ui.detail = h.detail; ui.sheet = null; render(true); } else go('home'); },
    open: function (d) { openDetail(d.id); },
    tog: function (d) {
      var k = d.k, v = d.v;
      if (k === 'type') ui.type = v;
      else if (k === 'mp') { var p = Number(v), i = S.settings.platforms.indexOf(p); if (i >= 0) S.settings.platforms.splice(i, 1); else S.settings.platforms.push(p); save(); detectChanges(); }
      else { var arr = k === 'plat' ? ui.plats : ui.genres, val = k === 'plat' ? Number(v) : v, j = arr.indexOf(val); if (j >= 0) arr.splice(j, 1); else arr.push(val); }
      render(true);
    },
    openfilter: function () { ui.sheet = { type: 'filter', scr: ui.screen }; ui.fq = ''; ui.fexp = false; render(true); },
    resetf: function () { ui.plats = []; ui.genres = []; render(true); },
    fexp: function () { ui.fexp = !ui.fexp; render(true); },
    closesheet: function () { ui.sheet = null; render(true); },
    tab: function (d) { ui.tab = d.v; render(true); },
    retrysug: function () { ui.sug[ui.tab] = null; render(true); },
    draw: function () {
      var ids = S.list.filter(function (e) { return e.status === 'todo' && passes(e) && (!availKnown(e) || !platsOn().length || avail(e).length); }).map(function (e) { return e.id; });
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
    rate: function (d) {
      var e = entry(d.id); if (!e) return;
      e.status = 'seen'; e.at = todayISO(); delete e.alert; if (+d.v) e.r[me] = +d.v; save(); ui.sheet = null; render(true);
      toast(+d.v === 1 ? 'Noté 👍 · vos suggestions s’affinent' : 'Marqué comme vu');
    },
    setr: function (d) { var e = entry(d.id); if (!e) return; e.r[d.u] = e.r[d.u] === +d.v ? 0 : +d.v; save(); render(true); },
    unseen: function (d) { var e = entry(d.id); e.status = 'todo'; save(); refreshAvail(); render(true); toast('Remis dans « À voir »'); },
    remove: function (d) {
      var e = entry(d.id), i = S.list.indexOf(e); S.list.splice(i, 1); save();
      var h = ui.hist.pop(); ui.screen = h ? h.screen : 'home'; ui.detail = h ? h.detail : null; render(true);
      toast('Supprimé de la liste', 'Annuler', function () { S.list.splice(i, 0, e); save(); render(true); });
    },
    dismiss: function (d) {
      var us = ui.tab === 'both' ? ['M', 'E'] : [ui.tab === 'me' ? me : other(me)];
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
      api('/api/envies', { method: 'POST', body: { text: ui.envie, me: me } }).then(function (r) { ui.env = r; })
        .catch(function (e) { ui.env = { error: e.message }; })
        .finally(function () { ui.envBusy = false; if (ui.screen === 'envies') render(true); });
    },
    profile: function (d) { me = d.u; try { localStorage.setItem('maiwatch-me', me); } catch (e) {} ui.sugVer++; render(true); },
    aiprov: function (d) { CFG.ai.provider = d.v; render(true); },
    aisave: function () {
      var k = document.getElementById('key'), key = k ? k.value.trim() : '';
      if (!key && !CFG.ai.hasKey) { ui.aiMsg = 'Collez d’abord une clé API.'; render(true); return; }
      ui.aiBusy = true; ui.aiMsg = ''; render(true);
      api('/api/ai', { method: 'PUT', body: { provider: CFG.ai.provider, key: key } })
        .then(function () { return api('/api/ai/test', { method: 'POST' }); })
        .then(function (r) { CFG.ai = r.status; ui.aiMsg = r.ok ? 'Clé enregistrée et testée : ' + PROVS[CFG.ai.provider] + ' répond.' : 'Clé enregistrée, mais le test a échoué : ' + r.error; })
        .catch(function (e) { ui.aiMsg = e.message; })
        .finally(function () { ui.aiBusy = false; render(true); });
    },
    aiclear: function () { api('/api/ai', { method: 'DELETE' }).then(function (s) { CFG.ai = s; ui.aiMsg = 'Clé retirée.'; render(true); }).catch(function (e) { toast(e.message); }); },
    export: function () { exportCsv(); toast('Export prêt : ' + S.list.length + ' titres.'); },
    logout: function () {
      if (dirty) { toast('Des modifications ne sont pas encore envoyées : attendez le retour du réseau.'); return; }
      apiFetch('/api/logout', { method: 'POST' }).finally(function () {
        isAuthenticated = false; S = null; baseState = null; baseVersion = null; try { localStorage.removeItem(STORE_KEY); } catch (e) {}
        ui.screen = 'home'; ui.hist = []; ui.detail = null; ui.sug = {}; ui.env = null; ui.sr = null; ui.q = ''; ui.plats = []; ui.genres = []; ui.type = 'all'; ui.sheet = null; render();
      });
    },
    tmdbsave: function () {
      var inp = document.getElementById('tmdbkey'), key = inp ? inp.value.trim() : '';
      if (!key) { ui.tmdbMsg = 'Collez d’abord la clé TMDB.'; render(true); return; }
      ui.tmdbBusy = true; ui.tmdbMsg = ''; render(true);
      api('/api/tmdb-key', { method: 'PUT', body: { key: key } }).then(function (r) {
        CFG.tmdb = r.tmdb; CFG.tmdbKey = r.tmdbKey; ui.tmdbMsg = 'Clé TMDB vérifiée et enregistrée.';
        ui.sug = {}; PV = {}; return loadProviders(true).then(function () { AV = {}; AV_AT = 0; refreshAvail(); });
      }).catch(function (e) { ui.tmdbMsg = e.message; }).finally(function () { ui.tmdbBusy = false; render(true); });
    },
    tmdbclear: function () {
      api('/api/tmdb-key', { method: 'DELETE' }).then(function (r) { CFG.tmdb = r.tmdb; CFG.tmdbKey = r.tmdbKey; ui.tmdbMsg = 'Clé TMDB retirée.'; render(true); }).catch(function (e) { toast(e.message); });
    },
    syncnow: function () { syncNow(); pullState(); },
    impmode: function (d) { ui.impMode = d.v; render(true); },
    impanalyze: function () {
      var ta = document.getElementById('imp'); if (ta) ui.impText = ta.value;
      var lines = ui.impText.split(/\n/).map(function (l) { return l.trim(); }).filter(Boolean);
      if (!lines.length) { toast('Ajoutez au moins un titre.'); return; }
      ui.impBusy = true; ui.impRows = null; render(true);
      api('/api/import', { method: 'POST', body: { lines: lines } }).then(function (rows) {
        ui.impRows = rows.map(function (r) { if (r.item) know(r.item); return { raw: r.raw, item: r.item, r: r.item ? 1 : 0 }; });
      }).catch(function (e) { toast(e.message); }).finally(function () { ui.impBusy = false; render(true); });
    },
    imprate: function (d) { var r = ui.impRows[+d.i]; r.r = r.r === +d.v ? 0 : +d.v; render(true); },
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
    else if (t.id === 'pvq') { ui.pvq = t.value; render(true); var el = document.getElementById('pvq'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }
    else if (t.id === 'envie') ui.envie = t.value;
    else if (t.id === 'imp') ui.impText = t.value;
    else if (t.dataset && t.dataset.note) { var e = entry(t.dataset.note); if (e) { e.note = t.value; clearTimeout(A._nt); A._nt = setTimeout(save, 600); } }
  });
  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.dataset && t.dataset.prof) { var v = t.value.trim() || (t.dataset.prof === 'M' ? 'Moi' : 'Elle'); S.settings.profiles[t.dataset.prof] = v; save(); render(true); }
    else if (t.id === 'region') { S.settings.region = t.value; PV = {}; S.settings.platforms = []; save(); loadProviders(true).then(function () { AV = {}; AV_AT = 0; refreshAvail(); render(true); }); }
    else if (t.id === 'csv' && t.files && t.files[0]) {
      var f = new FileReader();
      f.onload = function () {
        var lines = String(f.result).replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
        var split = function (l) { return (l.match(/("([^"]|"")*"|[^,]*)(,|$)/g) || []).map(function (c) { return c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"').trim(); }); };
        var head = split(lines[0]).map(function (h) { return h.toLowerCase(); });
        var ix = head.findIndex(function (h) { return h === 'name' || h === 'title' || h === 'titre'; });
        var yix = head.findIndex(function (h) { return h === 'year' || h === 'année' || h === 'annee'; });
        var hasHead = ix >= 0; if (ix < 0) ix = 0;
        var out = (hasHead ? lines.slice(1) : lines).map(function (l) { var c = split(l); return (c[ix] || '') + (yix >= 0 && c[yix] ? ' (' + c[yix] + ')' : ''); }).filter(Boolean);
        ui.impText = out.join('\n'); ui.impMode = 'paste'; A.impanalyze();
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
    } else if (form.dataset.form === 'password') {
      api('/api/account/password', { method: 'POST', body: { currentPassword: fd.get('cur'), newPassword: fd.get('nw') } })
        .then(function () { ui.pwMsg = 'Mot de passe changé.'; }).catch(function (e) { ui.pwMsg = e.message; }).finally(function () { render(true); });
    }
  });

  // ===================== Démarrage =====================
  // Partage depuis une autre appli (share_target) : ?title=…&text=…&url=… → recherche pré-remplie.
  function handleLaunch() {
    var p = new URLSearchParams(location.search);
    var action = p.get('action'), title = p.get('title'), text = p.get('text'), url = p.get('url');
    if (!S || !isAuthenticated || !(action || title || text || url)) return;
    history.replaceState(null, '', location.pathname + location.hash);
    if (action === 'ce-soir') { ui.hist = []; ui.screen = 'envies'; render(); return; }
    var q = '';
    if (action !== 'ajouter') {
      // Le titre partagé prime ; sinon le texte. On retire les liens et les suffixes « - Netflix », « | JustWatch »…
      var clean = function (x) { return String(x || '').replace(/https?:\/\/\S+/g, ' ').replace(/\s*[|–—-]\s*(Netflix|Disney\+?|Prime Video|Apple TV\+?|JustWatch|IMDb|TMDB|AlloCiné|Wikipédia|YouTube)\b.*$/i, ' ').replace(/\s+/g, ' ').trim(); };
      var raw = clean(title) || clean(text);
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
