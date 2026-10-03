// Service Worker - 离线缓存（Network-First 策略）
// 版本号递增会触发重新安装，清理所有旧缓存
const CACHE_VERSION = 'v26';
const CACHE_NAME = `account-book-${CACHE_VERSION}`;

// 安装：跳过等待，立即激活
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).catch(() => {
      // 忽略缓存失败
    }),
  );
  self.skipWaiting();
});

// 激活：清理旧缓存 + 立即接管所有客户端
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // 删除所有旧版本缓存
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name)),
        );
      }),
      // 立即接管所有打开的页面
      self.clients.claim(),
    ]),
  );
});

// 拦截请求：Network-First 策略
// 优先从网络获取最新资源，网络失败时回退到缓存（保证离线可用）
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // 只缓存 GET 请求
  if (request.method !== 'GET') return;

  // 跳过非 http/https 请求
  if (!request.url.startsWith('http')) return;

  // 跳过跨域请求（如 CDN 第三方资源）
  const requestOrigin = new URL(request.url).origin;
  const selfOrigin = self.location.origin;
  if (requestOrigin !== selfOrigin) return;

  // 跳过 API / 数据请求
  if (request.url.includes('/api/') || request.url.includes('/capability/')) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        // 网络成功：更新缓存并返回
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          }).catch(() => {});
        }
        return networkResponse;
      })
      .catch(() => {
        // 网络失败：回退到缓存
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // 导航请求且离线，尝试回退到根路径缓存
          if (request.mode === 'navigate') {
            // 优先用 SW 所在目录的 index（子路径部署兼容）
            const baseUrl = new URL('./', self.location).href;
            return caches.match(baseUrl).then((baseCached) => {
              if (baseCached) return baseCached;
              // 再尝试 / (根路径)
              return caches.match('/').then((rootCached) => {
                return rootCached || new Response('<h1>离线且无缓存</h1>', { status: 503, statusText: 'Service Unavailable', headers: { 'Content-Type': 'text/html; charset=utf-8' } });
              });
            });
          }
          return new Response('', { status: 503, statusText: 'Service Unavailable' });
        });
      }),
  );
});

// 接收来自页面的消息：跳过等待并激活
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
