import { createBrowserRouter } from 'react-router';
import { AgendaPage } from '@/features/agenda/components/agenda-page';
import { LoginPage } from '@/features/auth/components/login-page';
import { AnnouncementsPage } from '@/features/comunicados/components/announcements-page';
import { SettingsPage } from '@/features/configuracoes/components/settings-page';
import { DashboardPage } from '@/features/dashboard/components/dashboard-page';
import { EventDetailPage } from '@/features/escalas/components/event-detail-page';
import { MySchedulesPage } from '@/features/escalas/components/my-schedules-page';
import { ScheduleBuilderPage } from '@/features/escalas/components/schedule-builder-page';
import { InstallPage } from '@/features/instalar/components/install-page';
import { InviteMemberPage } from '@/features/integrantes/components/invite-member-page';
import { MembersPage } from '@/features/integrantes/components/members-page';
import { NotificationsPage } from '@/features/notificacoes/components/notifications-page';
import { SongHistoryPage } from '@/features/repertorio/components/song-history-page';
import { SongPage } from '@/features/repertorio/components/song-page';
import { SongsPage } from '@/features/repertorio/components/songs-page';
import { AppShell } from './app-shell';
import { NotFoundPage } from './not-found-page';
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
          { path: 'escalas/montar', element: <ScheduleBuilderPage /> },
          // As notificações do banco apontam para /escalas/<id do evento>.
          { path: 'escalas/:eventId', element: <EventDetailPage /> },
          { path: 'repertorio', element: <SongsPage /> },
          { path: 'repertorio/:songId', element: <SongPage /> },
          { path: 'repertorio/:songId/historico', element: <SongHistoryPage /> },
          { path: 'agenda', element: <AgendaPage /> },
          { path: 'notificacoes', element: <NotificationsPage /> },
          { path: 'comunicados', element: <AnnouncementsPage /> },
          { path: 'integrantes', element: <MembersPage /> },
          { path: 'integrantes/cadastrar', element: <InviteMemberPage /> },
          { path: 'configuracoes', element: <SettingsPage /> },
          { path: 'instalar', element: <InstallPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
