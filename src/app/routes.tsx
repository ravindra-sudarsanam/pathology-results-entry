import type { RouteObject } from 'react-router';
import { PatientPage } from '../features/patients/PatientPage';
import { AppLayout, NotFoundPage, SelectPatientPrompt } from './AppLayout';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <SelectPatientPrompt /> },
      { path: 'patients/:patientId', element: <PatientPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
