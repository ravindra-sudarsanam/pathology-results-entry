import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import type { Patient, ResultEntry } from '../../api/contracts';
import { usePatientResults } from '../../api/queries';
import { EmptyState, ErrorState, LoadingState } from '../../components/AsyncStates';
import { FlagBadge } from '../../components/FlagBadge';
import { SEVERITY } from '../../components/severity';
import {
  computeChanges,
  formatNumber,
  formatRange,
  isAbnormal,
  type ParameterDefinition,
  type ReferenceConfig,
  type ValueChange,
} from '../../domain';
import { formatDateTime, formatShortDate, pluralize } from '../../lib/format';

const ABNORMAL_ONLY_PARAM = 'abnormal';

interface ResultHistoryProps {
  patient: Patient;
  config: ReferenceConfig;
  /** Id of an entry saved in this session, to mark it as new. */
  highlightEntryId?: string;
}

function ChangeCell({ change, parameter }: { change?: ValueChange; parameter?: ParameterDefinition }) {
  if (!change || !parameter) return <span className="change change--none">First reading</span>;
  const since = formatShortDate(change.previousRecordedAt);
  if (change.direction === 'unchanged') return <span className="change">No change since {since}</span>;
  const arrow = change.direction === 'up' ? '↑' : '↓';
  const amount = formatNumber(Math.abs(change.difference), parameter.decimals);
  return (
    <span className="change">
      <span aria-hidden="true">{arrow} </span>
      <span className="visually-hidden">{change.direction === 'up' ? 'Up' : 'Down'} </span>
      {amount} since {since}
    </span>
  );
}

function summaryText(entry: ResultEntry): string {
  const { abnormal, critical } = entry.summary;
  if (abnormal === 0) return 'All values normal';
  return critical > 0
    ? `${pluralize(abnormal, 'value')} flagged, ${critical} critical`
    : `${pluralize(abnormal, 'value')} flagged`;
}

export function ResultHistory({ patient, config, highlightEntryId }: ResultHistoryProps) {
  const results = usePatientResults(patient.id);
  const [searchParams, setSearchParams] = useSearchParams();
  const onlyAbnormal = searchParams.get(ABNORMAL_ONLY_PARAM) === '1';

  const parametersById = useMemo(() => new Map(config.parameters.map((p) => [p.id, p])), [config.parameters]);
  const entries = useMemo(() => results.data ?? [], [results.data]);
  // Changes are computed over every entry, so filtering never changes what a value is compared with.
  const changes = useMemo(() => computeChanges(entries, config.parameters), [entries, config.parameters]);

  const visibleEntries = useMemo(() => {
    if (!onlyAbnormal) return entries;
    return entries
      .map((entry) => ({ ...entry, values: entry.values.filter((v) => isAbnormal(v.classification)) }))
      .filter((entry) => entry.values.length > 0);
  }, [entries, onlyAbnormal]);

  function setOnlyAbnormal(checked: boolean) {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (checked) next.set(ABNORMAL_ONLY_PARAM, '1');
        else next.delete(ABNORMAL_ONLY_PARAM);
        return next;
      },
      { replace: true },
    );
  }

  let body;
  if (results.isPending) {
    body = <LoadingState label="Loading results history…" lines={4} />;
  } else if (results.isError) {
    body = (
      <ErrorState
        title="Couldn’t load results history."
        message={results.error.message}
        onRetry={() => void results.refetch()}
        isRetrying={results.isFetching}
      />
    );
  } else if (entries.length === 0) {
    body = (
      <EmptyState title="No results recorded yet.">
        <p>Results you save for {patient.name} will appear here, newest first.</p>
      </EmptyState>
    );
  } else if (visibleEntries.length === 0) {
    body = (
      <EmptyState title="No abnormal values.">
        <p>
          All {pluralize(entries.length, 'saved entry', 'saved entries')} for {patient.name} are within normal range.
        </p>
        <button type="button" className="button button--secondary" onClick={() => setOnlyAbnormal(false)}>
          Show all values
        </button>
      </EmptyState>
    );
  } else {
    body = (
      <ol className="history__list">
        {visibleEntries.map((entry) => {
          const headingId = `entry-${entry.id}`;
          const entryChanges = changes.get(entry.id) ?? {};
          return (
            <li key={entry.id}>
              <article className="history-entry" aria-labelledby={headingId}>
                <div className="history-entry__header">
                  <h3 id={headingId} className="history-entry__time">
                    <time dateTime={entry.recordedAt}>{formatDateTime(entry.recordedAt)}</time>
                  </h3>
                  {entry.id === highlightEntryId && <span className="tag tag--new">Just saved</span>}
                  <span
                    className={`history-entry__summary history-entry__summary--${
                      entry.summary.critical > 0 ? 'critical' : entry.summary.abnormal > 0 ? 'abnormal' : 'normal'
                    }`}
                  >
                    {summaryText(entry)}
                  </span>
                </div>
                <table className="results-table">
                  <thead>
                    <tr>
                      <th scope="col">Parameter</th>
                      <th scope="col">Result</th>
                      <th scope="col">Flag</th>
                      <th scope="col">Normal range</th>
                      <th scope="col">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entry.values.map((value) => {
                      const parameter = parametersById.get(value.parameterId);
                      const decimals = parameter?.decimals ?? 1;
                      return (
                        <tr key={value.parameterId} className={`results-table__row--${SEVERITY[value.classification]}`}>
                          <th scope="row" data-label="Parameter">
                            {parameter?.name ?? value.parameterId}
                          </th>
                          <td data-label="Result" className="results-table__value">
                            {formatNumber(value.value, decimals)}{' '}
                            <span className="results-table__unit">{value.unit}</span>
                          </td>
                          <td data-label="Flag">
                            <FlagBadge classification={value.classification} />
                          </td>
                          <td data-label="Normal range">{formatRange(value.referenceRange.normal, decimals)}</td>
                          <td data-label="Change">
                            <ChangeCell change={entryChanges[value.parameterId]} parameter={parameter} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </article>
            </li>
          );
        })}
      </ol>
    );
  }

  const hiddenCount = entries.length - visibleEntries.length;

  return (
    <div className="history">
      <div className="history__toolbar">
        <label className="toggle">
          <input type="checkbox" checked={onlyAbnormal} onChange={(event) => setOnlyAbnormal(event.target.checked)} />
          <span>Only show abnormal values</span>
        </label>
        {onlyAbnormal && results.isSuccess && entries.length > 0 && hiddenCount > 0 && visibleEntries.length > 0 && (
          <p className="history__count">{pluralize(hiddenCount, 'entry', 'entries')} with only normal values hidden.</p>
        )}
      </div>
      {body}
    </div>
  );
}
