import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { mockNetwork } from '../../../mocks/network';
import { SEED_PATIENT_IDS } from '../../../mocks/seed';
import { renderApp } from '../../../test/renderApp';

const historySection = () => screen.getByRole('region', { name: 'History' });

async function openHistory(patientId: string, query = '') {
  const app = renderApp(`/patients/${patientId}${query}`);
  await screen.findByRole('heading', { level: 1 });
  return app;
}

describe('patient history view', () => {
  it('lists past entries newest first, with flags, ranges and change from the previous value', async () => {
    await openHistory(SEED_PATIENT_IDS.rahul);
    const entries = await within(historySection()).findAllByRole('article');
    expect(entries).toHaveLength(3);

    const latest = entries[0];
    expect(within(latest).getByText('1 critical', { exact: false })).toBeInTheDocument();
    const potassiumRow = within(latest).getByRole('row', { name: /Potassium/ });
    expect(potassiumRow).toHaveTextContent('6.3 mmol/L');
    expect(potassiumRow).toHaveTextContent('CRITICAL HIGH');
    expect(potassiumRow).toHaveTextContent('3.5–5.0');
    expect(potassiumRow).toHaveTextContent(/Up\s*0\.9 since/);

    // The oldest entry has nothing to compare with.
    expect(within(entries[2]).getAllByText('First reading').length).toBeGreaterThan(0);
  });

  it('"Only show abnormal values" hides normal values and entries with nothing abnormal', async () => {
    const { user, router } = await openHistory(SEED_PATIENT_IDS.rahul);
    const history = historySection();
    await within(history).findAllByRole('article');
    expect(within(history).getAllByRole('row', { name: /Systolic BP/ }).length).toBeGreaterThan(0);

    await user.click(within(history).getByRole('checkbox', { name: 'Only show abnormal values' }));

    const entries = within(history).getAllByRole('article');
    expect(entries).toHaveLength(2); // the first visit was all normal
    expect(within(history).queryByRole('row', { name: /Systolic BP/ })).not.toBeInTheDocument();
    expect(within(history).getByRole('row', { name: /Heart rate/ })).toHaveTextContent('LOW');
    expect(within(history).getByText('1 entry with only normal values hidden.')).toBeInTheDocument();
    // The filter lives in the URL, so refresh and back/forward keep it.
    expect(router.state.location.search).toBe('?abnormal=1');
  });

  it('explains when the filter leaves nothing to show, and offers a way back', async () => {
    const { user } = await openHistory(SEED_PATIENT_IDS.daniel, '?abnormal=1');
    const history = historySection();

    expect(await within(history).findByText('No abnormal values.')).toBeInTheDocument();
    await user.click(within(history).getByRole('button', { name: 'Show all values' }));
    expect(within(history).getAllByRole('article')).toHaveLength(1);
    expect(within(history).getByRole('checkbox', { name: 'Only show abnormal values' })).not.toBeChecked();
  });

  it('shows an empty state for a patient with no results', async () => {
    await openHistory(SEED_PATIENT_IDS.meera);
    expect(await within(historySection()).findByText('No results recorded yet.')).toBeInTheDocument();
  });

  it('shows an error with a retry when history fails to load', async () => {
    mockNetwork.failNext('listResults');
    const { user } = await openHistory(SEED_PATIENT_IDS.asha);
    const history = historySection();

    const alert = await within(history).findByRole('alert');
    expect(alert).toHaveTextContent('Couldn’t load results history.');

    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await within(history).findAllByRole('article')).toHaveLength(3);
  });
});
