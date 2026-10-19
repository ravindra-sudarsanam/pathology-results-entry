import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ApiError } from '../../api/client';
import { usePatient, useReferenceConfig } from '../../api/queries';
import { EmptyState, ErrorState, LoadingState } from '../../components/AsyncStates';
import { formatSex } from '../../lib/format';
import { ResultHistory } from '../history/ResultHistory';
import { ResultEntryForm } from '../results-entry/ResultEntryForm';

export function PatientPage() {
  const { patientId = '' } = useParams();
  const patient = usePatient(patientId);
  const config = useReferenceConfig();
  const [lastSavedEntryId, setLastSavedEntryId] = useState<string>();

  if (patient.isPending) return <LoadingState label="Loading patient…" lines={2} />;

  if (patient.isError) {
    if (patient.error instanceof ApiError && patient.error.status === 404) {
      return (
        <EmptyState title="Patient not found.">
          <p>The link may be out of date. Choose a patient from the list.</p>
          <Link to="/">Back to patients</Link>
        </EmptyState>
      );
    }
    return (
      <ErrorState
        title="Couldn’t load this patient."
        message={patient.error.message}
        onRetry={() => void patient.refetch()}
        isRetrying={patient.isFetching}
      />
    );
  }

  const { data } = patient;

  return (
    <article className="patient-page" aria-labelledby="patient-name">
      <header className="patient-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
  <div
    style={{
      width: '3rem',
      height: '3rem',
      borderRadius: '50%',
      background: 'var(--action)',
      color: '#fff',
      display: 'grid',
      placeItems: 'center',
      fontWeight: 700,
      fontSize: '1.25rem',
      flexShrink: 0,
      boxShadow: '0 2px 6px rgba(29, 78, 137, 0.25)',
    }}
    aria-hidden="true"
  >
    {data.name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')}
  </div>
  <div>
    <h1 id="patient-name" className="patient-header__name">
      {data.name}
    </h1>
    <dl className="patient-header__facts" style={{ marginTop: '0.25rem' }}>
      <div>
        <dt>Age</dt>
        <dd>{data.age}</dd>
      </div>
      <div>
        <dt>Sex</dt>
        <dd>{formatSex(data.sex)}</dd>
      </div>
    </dl>
  </div>
</header>

      {config.isPending && <LoadingState label="Loading reference ranges…" lines={6} />}
      {config.isError && (
        <ErrorState
          title="Couldn’t load reference ranges."
          message="Results can’t be entered or flagged without them."
          onRetry={() => void config.refetch()}
          isRetrying={config.isFetching}
        />
      )}
      {config.isSuccess && (
        <>
          <section className="panel" aria-labelledby="entry-title">
            <div className="panel__header">
              <h2 id="entry-title" className="panel__title">
                New results
              </h2>
              <p className="panel__hint">Values are flagged as you type. Leave a field blank if it wasn’t measured.</p>
            </div>
            {/* Keyed by patient so a draft can never carry over to another patient. */}
            <ResultEntryForm
              key={data.id}
              patient={data}
              config={config.data}
              onSaved={(entry) => setLastSavedEntryId(entry.id)}
            />
          </section>

          <section className="panel" aria-labelledby="history-title">
            <div className="panel__header">
              <h2 id="history-title" className="panel__title">
                History
              </h2>
            </div>
            <ResultHistory patient={data} config={config.data} highlightEntryId={lastSavedEntryId} />
          </section>
        </>
      )}
    </article>
  );
}
