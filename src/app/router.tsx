import { createBrowserRouter } from 'react-router';
import { AgendaPage } from '@/features/agenda/components/agenda-page';
import { LoginPage } from '@/features/auth/components/login-page';
import { DashboardPage } from '@/features/dashboard/components/dashboard-page';
import { EventDetailPage } from '@/features/escalas/components/event-detail-page';
import { MySchedulesPage } from '@/features/escalas/components/my-schedules-page';
import { AppShell } from './app-shell';
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
          { index: true, element: <DashboardPage /> },
          { path: 'escalas', element: <MySchedulesPage /> },
          // As notificações do banco apontam para /escalas/<id do evento>.
          { path: 'escalas/:eventId', element: <EventDetailPage /> },
          { path: 'repertorio/*', element: <PlaceholderPage title="Repertório" /> },
          { path: 'agenda', element: <AgendaPage /> },
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
