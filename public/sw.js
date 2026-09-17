const STATIC_CACHE =
  "verbo-static-v2";

const RUNTIME_CACHE =
  "verbo-runtime-v2";

const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/verbo-icon.png",
];

self.addEventListener(
  "install",
  (event) => {
    event.waitUntil(
      caches
        .open(STATIC_CACHE)
        .then((cache) =>
          cache.addAll(
            APP_SHELL,
          ),
        ),
    );

    self.skipWaiting();
  },
);

self.addEventListener(
  "activate",
  (event) => {
    event.waitUntil(
      caches
        .keys()
        .then(
          (cacheNames) =>
            Promise.all(
              cacheNames
                .filter(
                  (name) =>
                    name !==
                      STATIC_CACHE &&
                    name !==
                      RUNTIME_CACHE,
                )
                .map((name) =>
                  caches.delete(
                    name,
                  ),
                ),
            ),
        ),
    );

    self.clients.claim();
  },
);

self.addEventListener(
  "fetch",
  (event) => {
    const request =
      event.request;

    if (
      request.method !==
      "GET"
    ) {
      return;
    }

    const url =
      new URL(
        request.url,
      );

    /*
     * Nunca interfere nas
     * consultas de versão.
     */
    if (
      url.searchParams.has(
        "__verbo_check",
      )
    ) {
      event.respondWith(
        fetch(request),
      );

      return;
    }

    /*
     * Recursos externos:
     * Supabase, Mercado Pago,
     * PDFs assinados etc.
     *
     * Não armazenamos
     * automaticamente.
     */
    if (
      url.origin !==
      self.location.origin
    ) {
      return;
    }

    /*
     * Navegação do React.
     *
     * Online:
     * busca versão atual.
     *
     * Offline:
     * usa o shell "/" para
     * o React Router abrir
     * a rota localmente.
     */
    if (
      request.mode ===
      "navigate"
    ) {
      event.respondWith(
        fetch(request)
          .then(
            async (
              response,
            ) => {
              const cache =
                await caches.open(
                  RUNTIME_CACHE,
                );

              cache.put(
                request,
                response.clone(),
              );

              return response;
            },
          )
          .catch(
            async () => {
              const cached =
                await caches.match(
                  request,
                );

              if (cached) {
                return cached;
              }

              return caches.match(
                "/",
              );
            },
          ),
      );

      return;
    }

    /*
     * Arquivos estáticos:
     * JS, CSS, imagens,
     * fontes e outros
     * recursos do próprio app.
     *
     * Cache-first deixa o app
     * muito mais confiável
     * offline.
     */
    event.respondWith(
      caches
        .match(request)
        .then(
          async (
            cached,
          ) => {
            if (cached) {
              return cached;
            }

            try {
              const response =
                await fetch(
                  request,
                );

              if (
                !response ||
                response.status !==
                  200
              ) {
                return response;
              }

              const cache =
                await caches.open(
                  RUNTIME_CACHE,
                );

              cache.put(
                request,
                response.clone(),
              );

              return response;
            } catch (
              error
            ) {
              return new Response(
                "",
                {
                  status: 503,
                  statusText:
                    "Offline",
                },
              );
            }
          },
        ),
    );
  },
);