import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { AppProviders } from '@/app/providers';
import { router } from '@/app/router';
import { initInstallCapture } from '@/lib/install';
import { registerSW } from 'virtual:pwa-register';
// Inter auto-hospedada (só o alfabeto latino, que cobre o português): funciona offline e entra
// no cache do PWA. Nada de Google Fonts.
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/inter/latin-800.css';
import './index.css';

// Antes de tudo: o navegador pode oferecer a instalação logo no carregamento.
initInstallCapture();

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
