import { createBrowserRouter } from 'react-router';
import { HomePage } from './home-page';
import { NotFoundPage } from './not-found-page';

export const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '*', element: <NotFoundPage /> },
]);
