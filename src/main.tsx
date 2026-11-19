import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { AppProviders } from '@/app/providers';
import { router } from '@/app/router';
import { registerSW } from 'virtual:pwa-register';
import './index.css';

// Service worker (PWA). registerType 'prompt': a nova versão só entra quando o usuário aceita,
// para o app não recarregar no meio de um culto.
const updateServiceWorker = registerSW({
  onNeedRefresh() {
    if (window.confirm('Há uma nova versão do app. Atualizar agora?')) {
      void updateServiceWorker(true);
    }
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Elemento #root não encontrado no index.html');

createRoot(rootElement).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);
