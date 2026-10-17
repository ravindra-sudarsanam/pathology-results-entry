import { useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router';
import type { PatientListItem } from '../../api/contracts';
import { usePatients } from '../../api/queries';
import { EmptyState, ErrorState, LoadingState } from '../../components/AsyncStates';
import { formatSex, formatShortDate, pluralize } from '../../lib/format';
import { CreatePatientForm } from './CreatePatientForm';

function LatestResult({ latest }: { latest: PatientListItem['latestResult'] }) {
  if (!latest) return <span className="patient-link__latest">No results yet</span>;
  const date = formatShortDate(latest.recordedAt);
  if (latest.critical > 0) {
    return (
      <span className="patient-link__latest patient-link__latest--critical">
        {latest.critical} critical, {date}
      </span>
    );
  }
  if (latest.abnormal > 0) {
    return (
      <span className="patient-link__latest patient-link__latest--abnormal">
        {pluralize(latest.abnormal, 'value')} flagged, {date}
      </span>
    );
  }
  return <span className="patient-link__latest">All normal, {date}</span>;
}

export function PatientsPanel() {
  const patients = usePatients();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = patients.data ?? [];
    return term ? list.filter((p) => p.name.toLowerCase().includes(term)) : list;
  }, [patients.data, search]);

  let list;
  if (patients.isPending) {
    list = <LoadingState label="Loading patients…" lines={5} />;
  } else if (patients.isError) {
    list = (
      <ErrorState
        title="Couldn’t load patients."
        message={patients.error.message}
        onRetry={() => void patients.refetch()}
        isRetrying={patients.isFetching}
      />
    );
  } else if (patients.data.length === 0) {
    list = <EmptyState title="No patients yet.">Add the first patient to start entering results.</EmptyState>;
  } else if (filtered.length === 0) {
    list = <EmptyState title={`No patients match “${search.trim()}”.`} />;
  } else {
    list = (
      <nav aria-label="Patient list">
        <ul className="patient-list">
          {filtered.map((patient) => (
            <li key={patient.id}>
              <NavLink to={`/patients/${patient.id}`} className="patient-link">
                <span className="patient-link__name">{patient.name}</span>
                <span className="patient-link__meta">
                  {patient.age} y, {formatSex(patient.sex).toLowerCase()}
                </span>
                <LatestResult latest={patient.latestResult} />
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  return (
    <section className="patients" aria-labelledby="patients-title">
      <div className="patients__header">
        <h2 id="patients-title" className="patients__title">
          Patients
        </h2>
        {!isCreating && (
          <button type="button" className="button button--secondary button--small" onClick={() => setIsCreating(true)}>
            New patient
          </button>
        )}
      </div>

      {isCreating && (
        <CreatePatientForm
          onCancel={() => setIsCreating(false)}
          onCreated={(patient) => {
            setIsCreating(false);
            navigate(`/patients/${patient.id}`);
          }}
        />
      )}

      <div className="patients__search">
        <label htmlFor="patient-search" className="visually-hidden">
          Search patients by name
        </label>
        <input
          id="patient-search"
          type="search"
          placeholder="Search by name"
          autoComplete="off"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {list}
    </section>
  );
}
