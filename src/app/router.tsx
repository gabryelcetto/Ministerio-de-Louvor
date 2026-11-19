import { createBrowserRouter } from 'react-router';
import { LoginPage } from '@/features/auth/components/login-page';
import { AppShell } from './app-shell';
import { HomePage } from './home-page';
import { NotFoundPage } from './not-found-page';
import { PlaceholderPage } from './placeholder-page';
import { ProtectedRoute } from './protected-route';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'escalas/*', element: <PlaceholderPage title="Escalas" /> },
          { path: 'repertorio/*', element: <PlaceholderPage title="Repertório" /> },
          { path: 'agenda', element: <PlaceholderPage title="Agenda" /> },
          { path: 'notificacoes', element: <PlaceholderPage title="Notificações" /> },
          { path: 'comunicados', element: <PlaceholderPage title="Comunicados" /> },
          { path: 'integrantes', element: <PlaceholderPage title="Integrantes" /> },
          { path: 'configuracoes', element: <PlaceholderPage title="Configurações" /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
