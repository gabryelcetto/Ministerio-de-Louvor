/// <reference lib="webworker" />
/**
 * Service worker próprio (estratégia injectManifest do vite-plugin-pwa).
 * - Pré-cacheia os arquivos do build (lista injetada em self.__WB_MANIFEST).
 * - Navegações caem no index.html (a SPA abre offline depois da 1ª visita).
 * - Chamadas ao Supabase NÃO são cacheadas aqui: dados sempre vêm da rede.
 * Web Push entra aqui depois do protótipo.
 */
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')));

self.addEventListener('message', (event) => {
  const data = event.data as { type?: string } | null;
  if (data?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});
