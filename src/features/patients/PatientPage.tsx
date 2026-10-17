import { Link, useParams } from 'react-router';
import { ApiError } from '../../api/client';
import { usePatient } from '../../api/queries';
import { EmptyState, ErrorState, LoadingState } from '../../components/AsyncStates';
import { formatSex } from '../../lib/format';

export function PatientPage() {
  const { patientId = '' } = useParams();
  const patient = usePatient(patientId);

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
    </article>
  );
}
