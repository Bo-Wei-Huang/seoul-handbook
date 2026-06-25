// 離線快取 (出發前用 Safari 開一次 → 之後全離線)
// v2: 逐檔快取(一個失敗不拖垮全部) + 導覽離線回退 index.html + 忽略 query
const CACHE = 'ewha-v2';
const ASSETS = ['./', './index.html', './ewha-map.png', './manifest.webmanifest', './icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // 逐檔抓(cache:'reload' 繞過 HTTP 快取),用 allSettled→單一失敗不會清空整批
    await Promise.allSettled(ASSETS.map(u => c.add(new Request(u, { cache: 'reload' }))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const ks = await caches.keys();
    await Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith((async () => {
    // 1) 快取優先(忽略 ?query,iOS 從主畫面開常帶參數)
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;
    // 2) 連線→順手存快取
    try {
      const resp = await fetch(req);
      const c = await caches.open(CACHE);
      c.put(req, resp.clone());
      return resp;
    } catch (err) {
      // 3) 離線且沒快取:導覽請求一律回退首頁(白畫面殺手)
      if (req.mode === 'navigate') {
        const fb = await caches.match('./index.html', { ignoreSearch: true })
                || await caches.match('./', { ignoreSearch: true });
        if (fb) return fb;
      }
      throw err;
    }
  })());
});
