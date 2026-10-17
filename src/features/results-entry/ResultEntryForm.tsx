import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import type { Patient, ResultEntry } from '../../api/contracts';
import { useSaveResult } from '../../api/queries';
import {
  assessFormValues,
  describeEntryError,
  describeFieldError,
  summarize,
  type ParameterCategory,
  type ParameterId,
  type ReferenceConfig,
} from '../../domain';
import { formatTime, pluralize } from '../../lib/format';
import { createRequestId } from '../../lib/id';
import { ParameterField } from './ParameterField';
import { UnsavedChangesGuard } from './UnsavedChangesGuard';

const CATEGORY_TITLES: Record<ParameterCategory, string> = {
  vitals: 'Vitals',
  labs: 'Lab results',
};

type RawValues = Partial<Record<ParameterId, string>>;

interface ResultEntryFormProps {
  patient: Patient;
  config: ReferenceConfig;
  onSaved?: (entry: ResultEntry) => void;
}

function describeSaved(entry: ResultEntry): string {
  const { abnormal, critical } = entry.summary;
  const flagged =
    abnormal === 0
      ? 'All values are within normal range.'
      : `${pluralize(abnormal, 'value')} outside normal range${critical > 0 ? `, ${critical} critical` : ''}.`;
  return `Results saved at ${formatTime(entry.recordedAt)}. ${flagged}`;
}

export function ResultEntryForm({ patient, config, onSaved }: ResultEntryFormProps) {
  const [rawValues, setRawValues] = useState<RawValues>({});
  const [touched, setTouched] = useState<ReadonlySet<ParameterId>>(new Set());
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [serverFieldErrors, setServerFieldErrors] = useState<Partial<Record<ParameterId, string>>>({});
  const [savedEntry, setSavedEntry] = useState<ResultEntry | null>(null);

  // One idempotency key per draft. Reused on retry; replaced once the values change
  // after an attempt (so an edited draft is never answered with a stale saved entry).
  const [requestId, setRequestId] = useState(createRequestId);
  const requestIdUsed = useRef(false);

  const inputRefs = useRef(new Map<ParameterId, HTMLInputElement>());
  const save = useSaveResult(patient.id);

  const assessment = useMemo(() => assessFormValues(rawValues, patient.sex, config), [rawValues, patient.sex, config]);
  const liveSummary = summarize(assessment.values.map((v) => v.classification));
  const isDirty = Object.values(rawValues).some((value) => value?.trim());
  const isSaving = save.isPending;

  const saveError = save.error instanceof ApiError ? save.error : null;
  const isValidationFailure = saveError?.isValidationError ?? false;

  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  function updateValue(parameterId: ParameterId, value: string) {
    setRawValues((current) => ({ ...current, [parameterId]: value }));
    setServerFieldErrors(({ [parameterId]: _removed, ...rest }) => rest);
    setSavedEntry(null);
    if (requestIdUsed.current) {
      requestIdUsed.current = false;
      setRequestId(createRequestId());
    }
  }

  function markTouched(parameterId: ParameterId) {
    setTouched((current) => (current.has(parameterId) ? current : new Set(current).add(parameterId)));
  }

  function errorFor(parameterId: ParameterId): string | undefined {
    const field = assessment.fields[parameterId];
    if (field.status === 'invalid' && (touched.has(parameterId) || submitAttempted)) {
      const parameter = config.parameters.find((p) => p.id === parameterId)!;
      return describeFieldError(field.error, parameter, config.parameters);
    }
    return serverFieldErrors[parameterId];
  }

  function resetDraft() {
    setRawValues({});
    setTouched(new Set());
    setSubmitAttempted(false);
    setServerFieldErrors({});
    requestIdUsed.current = false;
    setRequestId(createRequestId());
    save.reset();
  }

  function submit() {
    if (isSaving) return;
    setSubmitAttempted(true);
    setSavedEntry(null);

    if (!assessment.isValid) {
      const firstInvalid = config.parameters.find((p) => assessment.fields[p.id].status === 'invalid');
      const target = firstInvalid ?? config.parameters[0];
      inputRefs.current.get(target.id)?.focus();
      return;
    }

    const values = Object.fromEntries(assessment.values.map((v) => [v.parameterId, v.value]));
    requestIdUsed.current = true;
    save.mutate(
      { clientRequestId: requestId, values },
      {
        onSuccess: (entry) => {
          resetDraft();
          setSavedEntry(entry);
          onSaved?.(entry);
        },
        onError: (error) => {
          if (error instanceof ApiError && error.isValidationError) {
            const mapped: Partial<Record<ParameterId, string>> = {};
            for (const [field, detail] of Object.entries(error.fieldErrors)) {
              mapped[field as ParameterId] = detail.message;
            }
            setServerFieldErrors(mapped);
          }
        },
      },
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit();
  }

  const categories = [...new Set(config.parameters.map((p) => p.category))];
  const showNoValuesError = submitAttempted && assessment.entryErrors.some((e) => e.code === 'NO_VALUES');

  return (
    <form className="entry" onSubmit={handleSubmit} aria-busy={isSaving} noValidate>
      <UnsavedChangesGuard when={isDirty && !isSaving} patientName={patient.name} />

      {categories.map((category) => (
        <fieldset key={category} className="entry__group">
          <legend className="entry__legend">{CATEGORY_TITLES[category]}</legend>
          {config.parameters
            .filter((p) => p.category === category)
            .map((parameter) => (
              <ParameterField
                key={parameter.id}
                parameter={parameter}
                sex={patient.sex}
                raw={rawValues[parameter.id] ?? ''}
                assessment={assessment.fields[parameter.id]}
                errorMessage={errorFor(parameter.id)}
                readOnly={isSaving}
                onChange={(value) => updateValue(parameter.id, value)}
                onBlur={() => markTouched(parameter.id)}
                inputRef={(element) => {
                  if (element) inputRefs.current.set(parameter.id, element);
                  else inputRefs.current.delete(parameter.id);
                }}
              />
            ))}
        </fieldset>
      ))}

      <div className="entry__footer">
        <p className="entry__summary" aria-live="polite">
          {liveSummary.abnormal === 0
            ? assessment.values.length > 0
              ? 'No values outside normal range so far.'
              : ''
            : `${pluralize(liveSummary.abnormal, 'value')} outside normal range${
                liveSummary.critical > 0 ? `, ${liveSummary.critical} critical` : ''
              }.`}
        </p>

        {showNoValuesError && <p className="entry__form-error">{describeEntryError({ code: 'NO_VALUES' })}</p>}

        {save.isError && (
          <div className="notice notice--error" role="alert">
            <p className="notice__title">Results not saved.</p>
            {isValidationFailure ? (
              <p className="notice__body">
                {saveError?.formErrors.length
                  ? saveError.formErrors.join(' ')
                  : 'Fix the highlighted values and save again.'}
              </p>
            ) : (
              <>
                <p className="notice__body">
                  {saveError?.message ?? 'Something went wrong.'} Your values are still in the form.
                </p>
                <button type="button" className="button button--secondary" onClick={submit} disabled={isSaving}>
                  Try again
                </button>
              </>
            )}
          </div>
        )}

        {savedEntry && (
          <p className="notice notice--success" role="status">
            {describeSaved(savedEntry)}
          </p>
        )}

        <div className="entry__actions">
          <button type="submit" className="button button--primary" disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save results'}
          </button>
          <button type="button" className="button button--quiet" onClick={resetDraft} disabled={isSaving || !isDirty}>
            Clear values
          </button>
        </div>
      </div>
    </form>
  );
}
