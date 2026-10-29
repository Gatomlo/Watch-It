// Service worker : rend l'app installable et utilisable sans réseau.
// - Fichiers de l'interface : réseau d'abord, copie en cache si le réseau manque ou traîne plus de 4 s.
// - Polices Google et affiches TMDB : cache d'abord.
// - /api/… : jamais touché ici ; l'app garde elle-même ses données (localStorage) et les synchronise au retour du réseau.
// - Notifications push : affichage et ouverture de l'appli au toucher.
// Changer VERSION quand la liste FILES change.
var VERSION = 'mw-v3';
var FILES = ['./', 'index.html', 'app.js', 'styles.css', 'manifest.json', 'logo.svg', 'logo.png', 'icon-192.png', 'badge-96.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];
var TIMEOUT_MS = 4000;
var MEDIA_CACHE = 'mw-media';

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION && k !== MEDIA_CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function networkFirst(req, cacheKey) {
  return caches.open(VERSION).then(function (cache) {
    var fromCache = function () {
      return cache.match(cacheKey || req, { ignoreSearch: true }).then(function (r) { return r || cache.match('./'); });
    };
    return new Promise(function (resolve) {
      var done = false;
      var finish = function (r) { if (!done && r) { done = true; resolve(r); } };
      var timer = setTimeout(function () { fromCache().then(function (r) { finish(r); }); }, TIMEOUT_MS);
      fetch(req).then(function (res) {
        if (res.ok) cache.put(cacheKey || req, res.clone());
        clearTimeout(timer);
        if (done) return;
        done = true;
        resolve(res);
      }).catch(function () {
        clearTimeout(timer);
        fromCache().then(function (r) { if (!done) { done = true; resolve(r || Response.error()); } });
      });
    });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin === location.origin) {
    var scope = new URL(self.registration.scope).pathname;
    if (url.pathname.indexOf(scope + 'api/') === 0) return;
    e.respondWith(networkFirst(req, req.mode === 'navigate' ? './' : null));
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com' || url.hostname === 'image.tmdb.org') {
    e.respondWith(caches.open(MEDIA_CACHE).then(function (cache) {
      return cache.match(req).then(function (hit) {
        return hit || fetch(req).then(function (res) { if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res; });
      });
    }));
  }
});

self.addEventListener('push', function (e) {
  var data = {};
  try { data = e.data ? e.data.json() : {}; } catch (err) {}
  e.waitUntil(self.registration.showNotification(data.title || 'Watch-It', {
    body: data.body || '', icon: 'icon-192.png', badge: 'badge-96.png', tag: data.tag || 'maiwatch', actions: data.actions || [],
    data: { url: data.url || './', id: data.id || null, u: data.u || null, pid: data.pid || null }
  }));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var d = e.notification.data || {};
  // « Moi aussi » / « Pas pour moi » sans ouvrir l'appli ; si la requête échoue (session expirée, hors ligne), on ouvre l'écran des ajouts.
  if ((e.action === 'want' || e.action === 'no') && d.id && d.u) {
    e.waitUntil(fetch('api/react', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: d.id, u: d.u, want: e.action === 'want' }) })
      .then(function (r) { if (!r.ok) throw new Error('react'); return r.json(); })
      .then(function (r) {
        return self.registration.showNotification('Watch-It', { body: e.action === 'want' ? '« ' + r.title + ' » ajouté à ce que vous voulez voir.' : '« ' + r.title + ' » écarté.', icon: 'icon-192.png', tag: e.notification.tag, silent: true })
          .then(function () { return new Promise(function (ok) { setTimeout(ok, 4000); }); })
          .then(function () { return self.registration.getNotifications({ tag: e.notification.tag }); })
          .then(function (l) { l.forEach(function (n) { n.close(); }); });
      })
      .catch(function () { return self.clients.openWindow(new URL(d.url || './', self.registration.scope).href); }));
    return;
  }
  // « Partant » / « Pas ce soir » pour une proposition de ce soir.
  if ((e.action === 'tok' || e.action === 'tno') && d.pid && d.u) {
    e.waitUntil(fetch('api/tonight/answer', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pid: d.pid, u: d.u, ok: e.action === 'tok' }) })
      .then(function (r) { if (!r.ok) throw new Error('tonight'); return r.json(); })
      .then(function (r) { return self.registration.showNotification('Watch-It', { body: e.action === 'tok' ? '« ' + r.title + ' » : c’est noté pour ce soir.' : '« ' + r.title + ' » : pas ce soir.', icon: 'icon-192.png', tag: e.notification.tag, silent: true }); })
      .catch(function () { return self.clients.openWindow(new URL(d.url || './', self.registration.scope).href); }));
    return;
  }
  var url = d.url || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    var abs = new URL(url, self.registration.scope).href;
    for (var i = 0; i < list.length; i++) {
      if ('focus' in list[i]) return list[i].focus().then(function (c) { return c && 'navigate' in c ? c.navigate(abs) : c; });
    }
    return self.clients.openWindow(abs);
  }));
});
