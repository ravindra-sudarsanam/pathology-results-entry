import { Link, useParams } from 'react-router';
import { ApiError } from '../../api/client';
import { usePatient, useReferenceConfig } from '../../api/queries';
import { EmptyState, ErrorState, LoadingState } from '../../components/AsyncStates';
import { formatSex } from '../../lib/format';
import { ResultHistory } from '../history/ResultHistory';

export function PatientPage() {
  const { patientId = '' } = useParams();
  const patient = usePatient(patientId);
  const config = useReferenceConfig();

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
      <header className="patient-header">
        <h1 id="patient-name" className="patient-header__name">
          {data.name}
        </h1>
        <dl className="patient-header__facts">
          <div>
            <dt>Age</dt>
            <dd>{data.age}</dd>
          </div>
          <div>
            <dt>Sex</dt>
            <dd>{formatSex(data.sex)}</dd>
          </div>
        </dl>
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
          <section className="panel" aria-labelledby="history-title">
            <div className="panel__header">
              <h2 id="history-title" className="panel__title">
                History
              </h2>
            </div>
            <ResultHistory patient={data} config={config.data} />
          </section>
        </>
      )}
    </article>
  );
}
