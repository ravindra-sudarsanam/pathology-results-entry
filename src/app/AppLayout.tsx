import { Outlet } from 'react-router';
import { PatientsPanel } from '../features/patients/PatientsPanel';

export function AppLayout() {
  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to results
      </a>
      <header className="topbar">
        <span className="topbar__brand">Pathology results</span>
        <span className="topbar__context">Results entry and abnormal value flagging</span>
      </header>
      <div className="shell">
        <aside className="shell__sidebar">
          <PatientsPanel />
        </aside>
        <main id="main" className="shell__main" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function SelectPatientPrompt() {
  return (
    <div className="empty empty--page">
      <p className="empty__title">Choose a patient to enter results.</p>
      <p>Pick someone from the list, or add a new patient. Their past results appear below the entry form.</p>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="empty empty--page">
      <p className="empty__title">This page doesn’t exist.</p>
      <p>Choose a patient from the list to continue.</p>
    </div>
  );
}
