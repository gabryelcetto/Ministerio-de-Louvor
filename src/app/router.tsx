import { PrivacyPage } from './privacy-page';
import { createBrowserRouter, type RouteObject } from 'react-router';
import { AgendaPage } from '@/features/agenda/components/agenda-page';
import { LoginPage } from '@/features/auth/components/login-page';
import { AnnouncementDetailPage } from '@/features/comunicados/components/announcement-detail-page';
import { AnnouncementFormPage } from '@/features/comunicados/components/announcement-form-page';
import { AnnouncementsPage } from '@/features/comunicados/components/announcements-page';
import { SettingsPage } from '@/features/configuracoes/components/settings-page';
import { DashboardPage } from '@/features/dashboard/components/dashboard-page';
import { EventDetailPage } from '@/features/escalas/components/event-detail-page';
import { EventEditPage } from '@/features/escalas/components/event-edit-page';
import { SetlistEditorPage } from '@/features/escalas/components/setlist-editor-page';
import { MySchedulesPage } from '@/features/escalas/components/my-schedules-page';
import { ScheduleBuilderPage } from '@/features/escalas/components/schedule-builder-page';
import { InstallPage } from '@/features/instalar/components/install-page';
import { FunctionsPage } from '@/features/integrantes/components/functions-page';
import { MemberDetailPage } from '@/features/integrantes/components/member-detail-page';
import { InviteMemberPage } from '@/features/integrantes/components/invite-member-page';
import { MembersPage } from '@/features/integrantes/components/members-page';
import { NotificationsPage } from '@/features/notificacoes/components/notifications-page';
import { ActivityPage } from '@/features/atividade/components/activity-page';
import { NewSongPage } from '@/features/repertorio/components/new-song-page';
import { SongHistoryPage } from '@/features/repertorio/components/song-history-page';
import { SongPage } from '@/features/repertorio/components/song-page';
import { SongsPage } from '@/features/repertorio/components/songs-page';
import { AppShell } from './app-shell';
import { MorePage } from './more-page';
import { NotFoundPage } from './not-found-page';
import { ProtectedRoute } from './protected-route';

/** Rotas do app (exportadas para os testes montarem o app num roteador em memória). */
export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  { path: '/privacidade', element: <PrivacyPage /> },
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
          { path: 'escalas/:eventId/editar', element: <EventEditPage /> },
          { path: 'escalas/:eventId/repertorio', element: <SetlistEditorPage /> },
          { path: 'repertorio', element: <SongsPage /> },
          { path: 'repertorio/nova', element: <NewSongPage /> },
          { path: 'repertorio/:songId', element: <SongPage /> },
          { path: 'repertorio/:songId/historico', element: <SongHistoryPage /> },
          { path: 'agenda', element: <AgendaPage /> },
          { path: 'notificacoes', element: <NotificationsPage /> },
          { path: 'comunicados', element: <AnnouncementsPage /> },
          { path: 'comunicados/novo', element: <AnnouncementFormPage /> },
          { path: 'comunicados/:announcementId', element: <AnnouncementDetailPage /> },
          { path: 'comunicados/:announcementId/editar', element: <AnnouncementFormPage /> },
          { path: 'integrantes', element: <MembersPage /> },
          { path: 'atividade', element: <ActivityPage /> },
          { path: 'integrantes/cadastrar', element: <InviteMemberPage /> },
          { path: 'integrantes/funcoes', element: <FunctionsPage /> },
          { path: 'integrantes/:memberId', element: <MemberDetailPage /> },
          { path: 'configuracoes', element: <SettingsPage /> },
          { path: 'instalar', element: <InstallPage /> },
          { path: 'mais', element: <MorePage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
];

export const router = createBrowserRouter(routes);
