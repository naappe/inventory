const CACHE_NAME = "money-plan-v6";
const APP_FILES = [
  "./",
  "./index.html",
  "./ot.html",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

function injectOtNav(html) {
  if (html.includes('class="otNavLink"')) return html;

  const navTarget = '<button data-page="categories">Categories</button>\n      </nav>';
  const navReplacement = '<button data-page="categories">Categories</button><a class="otNavLink" href="./ot.html">OT Work</a>\n      </nav>';

  const css = `\n  .nav .otNavLink {\n    display: inline-flex;\n    align-items: center;\n    justify-content: center;\n    border: 1px solid rgba(255, 255, 255, .14);\n    border-radius: 10px;\n    background: rgba(255, 255, 255, .1);\n    color: rgba(255, 255, 255, .82);\n    padding: 9px 11px;\n    font-weight: 800;\n    text-decoration: none;\n    white-space: nowrap;\n  }\n  .nav .otNavLink:hover {\n    background: rgba(255, 255, 255, .16);\n  }\n  @media (max-width: 700px) {\n    .nav { grid-template-columns: repeat(4, 1fr) !important; }\n    .nav .otNavLink {\n      border: 0;\n      background: transparent;\n      color: var(--m);\n      padding: 9px 7px;\n      font-size: 13px;\n    }\n  }\n`;

  let updated = html.replace(navTarget, navReplacement);
  if (updated !== html) updated = updated.replace('</style>', css + '</style>');
  return updated;
}

async function transformHomeResponse(response) {
  if (!response) return response;
  const type = response.headers.get("content-type") || "";
  if (!type.includes("text/html")) return response;

  const html = await response.text();
  const transformed = injectOtNav(html);
  const headers = new Headers(response.headers);
  headers.set("content-type", "text/html; charset=utf-8");
  headers.delete("content-length");

  return new Response(transformed, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isMoneyPlanHome(url, request) {
  if (request.mode !== "navigate") return false;
  const scopePath = new URL(self.registration.scope).pathname;
  return url.pathname === scopePath || url.pathname === scopePath + "index.html";
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: "window" }))
      .then((clients) => Promise.all(clients.map((client) => {
        const url = new URL(client.url);
        const scopePath = new URL(self.registration.scope).pathname;
        if (url.pathname === scopePath || url.pathname === scopePath + "index.html") {
          return client.navigate(client.url).catch(() => null);
        }
        return null;
      }))),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (isMoneyPlanHome(url, event.request)) {
    event.respondWith(
      fetch(event.request)
        .then(async (response) => {
          if (response.ok) {
            const transformed = await transformHomeResponse(response.clone());
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, transformed.clone()));
            return transformed;
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request) || await caches.match("./");
          return transformHomeResponse(cached);
        }),
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("./"))),
  );
});
