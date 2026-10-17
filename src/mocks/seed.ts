import { REFERENCE_CONFIG } from '../config/referenceConfig';
import { assessSubmission, type ParameterId, type Patient } from '../domain';
import { db } from './db';

type Reading = Partial<Record<ParameterId, number>>;

interface SeedPatient {
  patient: Patient;
  /** Readings oldest first, with how many days ago each was recorded. */
  history: Array<{ daysAgo: number; values: Reading }>;
}

/** Stable ids so tests and bookmarks can refer to seeded patients. */
export const SEED_PATIENT_IDS = {
  asha: 'p-asha-menon',
  rahul: 'p-rahul-verma',
  grace: 'p-grace-thomas',
  daniel: 'p-daniel-okafor',
  meera: 'p-meera-iyer',
} as const;

const SEED: SeedPatient[] = [
  {
    // Blood pressure and glucose creeping up over three visits.
    patient: { id: SEED_PATIENT_IDS.asha, name: 'Asha Menon', age: 54, sex: 'female' },
    history: [
      { daysAgo: 62, values: { systolicBp: 126, diastolicBp: 80, heartRate: 74, bloodGlucose: 96, haemoglobin: 12.6 } },
      { daysAgo: 31, values: { systolicBp: 138, diastolicBp: 86, heartRate: 78, bloodGlucose: 104 } },
      { daysAgo: 3, values: { systolicBp: 146, diastolicBp: 94, heartRate: 81, bloodGlucose: 112, haemoglobin: 12.4 } },
    ],
  },
  {
    // Potassium rising into the critical range on the latest entry.
    patient: { id: SEED_PATIENT_IDS.rahul, name: 'Rahul Verma', age: 61, sex: 'male' },
    history: [
      { daysAgo: 45, values: { potassium: 4.6, heartRate: 88, systolicBp: 128, diastolicBp: 78 } },
      { daysAgo: 14, values: { potassium: 5.4, heartRate: 92 } },
      { daysAgo: 1, values: { potassium: 6.3, heartRate: 58, systolicBp: 118, diastolicBp: 72, haemoglobin: 13.9 } },
    ],
  },
  {
    // Mild anaemia that is improving.
    patient: { id: SEED_PATIENT_IDS.grace, name: 'Grace Thomas', age: 29, sex: 'female' },
    history: [
      { daysAgo: 40, values: { haemoglobin: 10.8, heartRate: 96 } },
      { daysAgo: 10, values: { haemoglobin: 11.6, heartRate: 84, systolicBp: 112, diastolicBp: 70 } },
    ],
  },
  {
    // All values normal: shows the empty state of the "only abnormal" filter.
    patient: { id: SEED_PATIENT_IDS.daniel, name: 'Daniel Okafor', age: 45, sex: 'male' },
    history: [
      {
        daysAgo: 7,
        values: {
          systolicBp: 118,
          diastolicBp: 76,
          heartRate: 66,
          haemoglobin: 15.1,
          bloodGlucose: 88,
          potassium: 4.2,
        },
      },
    ],
  },
  {
    // No results yet: shows the empty history state.
    patient: { id: SEED_PATIENT_IDS.meera, name: 'Meera Iyer', age: 72, sex: 'female' },
    history: [],
  },
];

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Seed data goes through the same validate-and-classify path as a real save,
 * so no classification is ever hand-written.
 */
export function seedDatabase(now: Date = new Date()): void {
  db.reset();
  for (const { patient, history } of SEED) {
    const saved = db.insertPatient(patient, patient.id);
    for (const { daysAgo, values } of history) {
      const assessment = assessSubmission(values, saved.sex, REFERENCE_CONFIG);
      if (!assessment.isValid) {
        throw new Error(`Invalid seed reading for ${saved.name}: ${JSON.stringify(assessment.fields)}`);
      }
      // Readings at 09:30 local time so the history looks like morning ward rounds.
      const recordedAt = new Date(now.getTime() - daysAgo * DAY_MS);
      recordedAt.setHours(9, 30, 0, 0);
      db.insertResult(saved, assessment.values, { recordedAt });
    }
  }
}
