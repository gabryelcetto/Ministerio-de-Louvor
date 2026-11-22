/// <reference lib="webworker" />
/**
 * Service worker próprio (estratégia injectManifest do vite-plugin-pwa).
 * - Pré-cacheia os arquivos do build (lista injetada em self.__WB_MANIFEST).
 * - Navegações caem no index.html (a SPA abre offline depois da 1ª visita).
 * - Chamadas ao Supabase NÃO são cacheadas aqui: dados sempre vêm da rede.
 * - Web Push (Fase H): mostra o aviso e, ao tocar, abre (ou foca) o app na tela certa.
 */
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { parsePushMessage } from './lib/push';

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

self.addEventListener('push', (event) => {
  let data: unknown;
  try {
    data = event.data?.json();
  } catch {
    data = { body: event.data?.text() };
  }
  const message = parsePushMessage(data);
  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      data: { url: message.url },
      ...(message.tag ? { tag: message.tag } : {}),
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = parsePushMessage(event.notification.data).url;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus();
          if ('navigate' in client) await client.navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
