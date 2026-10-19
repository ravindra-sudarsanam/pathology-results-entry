import { useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import type { Patient } from '../../api/contracts';
import { useCreatePatient } from '../../api/queries';
import { PATIENT_RULES } from '../../config/patientRules';
import { validatePatient, type PatientField } from '../../domain';

interface CreatePatientFormProps {
  onCreated: (patient: Patient) => void;
  onCancel: () => void;
}

type Draft = { name: string; age: string; sex: '' | 'female' | 'male' };

export function CreatePatientForm({ onCreated, onCancel }: CreatePatientFormProps) {
  const [draft, setDraft] = useState<Draft>({ name: '', age: '', sex: '' });
  const [errors, setErrors] = useState<Partial<Record<PatientField, string>>>({});
  const create = useCreatePatient();

  function update<K extends keyof Draft>(field: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors(({ [field]: _removed, ...rest }) => rest);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (create.isPending) return;

    const result = validatePatient(draft, PATIENT_RULES);
    if (!result.ok) {
      setErrors(result.errors);
      const firstField = (['name', 'age', 'sex'] as const).find((field) => result.errors[field]);
      document.getElementById(`new-patient-${firstField}`)?.focus();
      return;
    }

    create.mutate(result.patient, {
      onSuccess: (patient) => onCreated(patient),
      onError: (error) => {
        if (error instanceof ApiError && error.isValidationError) {
          setErrors(Object.fromEntries(Object.entries(error.fieldErrors).map(([field, e]) => [field, e.message])));
        }
      },
    });
  }

  const serverError = create.error instanceof ApiError && !create.error.isValidationError ? create.error : null;

  return (
    <form className="new-patient" onSubmit={handleSubmit} noValidate aria-labelledby="new-patient-title">
      <h3 id="new-patient-title" className="new-patient__title">
        New patient
      </h3>

      <div className="field">
        <label htmlFor="new-patient-name">Full name</label>
        <input
          id="new-patient-name"
          autoFocus
          autoComplete="off"
          value={draft.name}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? 'new-patient-name-error' : undefined}
          onChange={(event) => update('name', event.target.value)}
          onBlur={()=> update('name', draft.name.trim().replace(/\s+/g, ' '))}
        />
        {errors.name && (
          <p id="new-patient-name-error" className="field__error">
            {errors.name}
          </p>
        )}
      </div>

      <div className="field field--short">
        <label htmlFor="new-patient-age">Age in years</label>
        <input
          id="new-patient-age"
          inputMode="numeric"
          autoComplete="off"
          value={draft.age}
          aria-invalid={errors.age ? true : undefined}
          aria-describedby={errors.age ? 'new-patient-age-error' : undefined}
          onChange={(event) => update('age', event.target.value)}
        />
        {errors.age && (
          <p id="new-patient-age-error" className="field__error">
            {errors.age}
          </p>
        )}
      </div>

      <fieldset
        className="field field--choice"
        aria-invalid={errors.sex ? true : undefined}
        aria-describedby={errors.sex ? 'new-patient-sex-error' : undefined}
      >
        <legend>Sex (used for reference ranges)</legend>
        <div className="choice-row">
          {(['female', 'male'] as const).map((sex, index) => (
            <label key={sex} className="choice">
              <input
                id={index === 0 ? 'new-patient-sex' : undefined}
                type="radio"
                name="new-patient-sex"
                value={sex}
                checked={draft.sex === sex}
                onChange={() => update('sex', sex)}
              />
              {sex === 'female' ? 'Female' : 'Male'}
            </label>
          ))}
        </div>
        {errors.sex && (
          <p id="new-patient-sex-error" className="field__error">
            {errors.sex}
          </p>
        )}
      </fieldset>

      {serverError && (
        <div className="notice notice--error" role="alert">
          <p className="notice__title">Patient not added.</p>
          <p className="notice__body">{serverError.message} Your details are still in the form.</p>
        </div>
      )}

      <div className="new-patient__actions">
        <button type="submit" className="button button--primary" disabled={create.isPending}>
          {create.isPending ? 'Adding…' : 'Add patient'}
        </button>
        <button type="button" className="button button--quiet" onClick={onCancel} disabled={create.isPending}>
          Cancel
        </button>
      </div>
    </form>
  );
}
