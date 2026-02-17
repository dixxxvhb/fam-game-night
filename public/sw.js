// Service Worker for FAM GAME NIGHT PWA
// Provides app shell caching for installability while keeping API calls network-only

const CACHE_NAME = 'fgn-v2'

// Cache app shell assets on install
self.addEventListener('install', (event) => {
  self.skipWaiting()
})

// Clean old caches on activate
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  )
})

// Network-first for everything, cache as fallback for static assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Never cache Supabase API calls or realtime connections
  if (url.hostname.includes('supabase')) return

  // Never cache POST/PUT/DELETE
  if (event.request.method !== 'GET') return

  // For navigation requests, always go to network (no cache)
  if (event.request.mode === 'navigate') return

  // For static assets: network-first with cache fallback
  // Vite hashes filenames, so old entries won't be served for new builds
  if (url.pathname.match(/\.(js|css|png|svg|woff2?)$/)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          }
          return response
        })
        .catch(() =>
          caches.open(CACHE_NAME).then((cache) => cache.match(event.request))
        )
    )
  }
})
