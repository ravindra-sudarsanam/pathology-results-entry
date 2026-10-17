import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { mockNetwork } from '../../../mocks/network';
import { SEED_PATIENT_IDS } from '../../../mocks/seed';
import { renderApp } from '../../../test/renderApp';

/**
 * Integration tests: the real app (routing, queries, form) talking to the mock
 * API through MSW. Only the network is simulated.
 */

async function openPatient(patientId: string) {
  const app = renderApp(`/patients/${patientId}`);
  await screen.findByRole('heading', { level: 1 });
  await screen.findByRole('button', { name: 'Save results' });
  return app;
}

const historySection = () => screen.getByRole('region', { name: 'History' });

describe('results entry', () => {
  it('flags values as the nurse types, with a text label next to the field', async () => {
    const { user } = await openPatient(SEED_PATIENT_IDS.meera);

    const potassium = screen.getByLabelText('Potassium');
    await user.type(potassium, '6.4');
    expect(potassium).toHaveAccessibleDescription(expect.stringContaining('CRITICAL HIGH'));

    const systolic = screen.getByLabelText('Systolic BP');
    await user.type(systolic, '145');
    expect(systolic).toHaveAccessibleDescription(expect.stringContaining('HIGH'));

    await user.clear(systolic);
    await user.type(systolic, '120');
    expect(systolic).toHaveAccessibleDescription(expect.stringContaining('Normal'));

    expect(screen.getByText('1 value outside normal range, 1 critical.')).toBeInTheDocument();
  });

  it('treats an impossible value as a validation error, not as a flag, and blocks saving', async () => {
    const { user } = await openPatient(SEED_PATIENT_IDS.meera);

    const systolic = screen.getByLabelText('Systolic BP');
    await user.type(systolic, '900');
    await user.tab();

    expect(systolic).toBeInvalid();
    expect(systolic).toHaveAccessibleDescription(expect.stringContaining('Not a possible Systolic BP value'));
    expect(systolic).not.toHaveAccessibleDescription(expect.stringContaining('CRITICAL'));

    await user.click(screen.getByRole('button', { name: 'Save results' }));
    expect(systolic).toHaveFocus();
    expect(within(historySection()).getByText('No results recorded yet.')).toBeInTheDocument();
  });

  it('asks for at least one value before saving', async () => {
    const { user } = await openPatient(SEED_PATIENT_IDS.meera);
    await user.click(screen.getByRole('button', { name: 'Save results' }));
    expect(screen.getByText('Enter at least one value before saving.')).toBeInTheDocument();
  });

  it('keeps what the nurse typed when a save fails, and saves on retry', async () => {
    const { user } = await openPatient(SEED_PATIENT_IDS.meera);

    await user.type(screen.getByLabelText('Potassium'), '6.4');
    await user.type(screen.getByLabelText('Heart rate'), '72');

    mockNetwork.failNext('saveResult');
    await user.click(screen.getByRole('button', { name: 'Save results' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Results not saved.');
    expect(alert).toHaveTextContent('Your values are still in the form.');
    expect(screen.getByLabelText('Potassium')).toHaveValue('6.4');
    expect(screen.getByLabelText('Heart rate')).toHaveValue('72');
    expect(within(historySection()).getByText('No results recorded yet.')).toBeInTheDocument();

    await user.click(within(alert).getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('status', { name: '' })).toHaveTextContent(
      /Results saved at \d\d:\d\d\. 1 value outside normal range, 1 critical\./,
    );
    expect(screen.getByLabelText('Potassium')).toHaveValue('');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // The server's classification shows up in history straight away.
    const history = historySection();
    expect(await within(history).findByText('Just saved')).toBeInTheDocument();
    expect(within(history).getByText('CRITICAL HIGH')).toBeInTheDocument();
  });

  it('does not create a duplicate when the first save went through but its response was lost', async () => {
    const { user } = await openPatient(SEED_PATIENT_IDS.daniel);
    const history = historySection();
    await within(history).findAllByRole('article');
    const entriesBefore = within(history).getAllByRole('article').length;

    await user.type(screen.getByLabelText('Potassium'), '5.6');
    mockNetwork.failNext('saveResult', 'errorAfterSave');
    await user.click(screen.getByRole('button', { name: 'Save results' }));
    await user.click(await screen.findByRole('button', { name: 'Try again' }));

    await screen.findByText(/Results saved at/);
    await waitFor(() => expect(within(history).getAllByRole('article')).toHaveLength(entriesBefore + 1));
  });

  it('applies the patient’s sex-specific haemoglobin range', async () => {
    const { user } = await openPatient(SEED_PATIENT_IDS.daniel); // male: normal 13.5–17.5
    const haemoglobin = screen.getByLabelText('Haemoglobin');
    expect(haemoglobin).toHaveAccessibleDescription(expect.stringContaining('Normal 13.5–17.5 (male)'));
    await user.type(haemoglobin, '13.0');
    expect(haemoglobin).toHaveAccessibleDescription(expect.stringContaining('LOW'));
  });

  it('warns before switching patient with unsaved values, and never carries them over', async () => {
    const { user } = await openPatient(SEED_PATIENT_IDS.meera);
    await user.type(screen.getByLabelText('Potassium'), '4.0');

    await user.click(screen.getByRole('link', { name: /Asha Menon/ }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Results for Meera Iyer are not saved.');

    await user.click(within(dialog).getByRole('button', { name: 'Stay and finish' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Meera Iyer');
    expect(screen.getByLabelText('Potassium')).toHaveValue('4.0');

    await user.click(screen.getByRole('link', { name: /Asha Menon/ }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Discard and leave' }));
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Asha Menon'));
    expect(await screen.findByLabelText('Potassium')).toHaveValue('');
  });
});
