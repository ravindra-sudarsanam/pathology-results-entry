import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { mockNetwork } from '../../../mocks/network';
import { renderApp } from '../../../test/renderApp';

const patientList = () => screen.getByRole('navigation', { name: 'Patient list' });

describe('patients panel', () => {
  it('lists patients with their latest result summary', async () => {
    renderApp('/');
    await screen.findByRole('navigation', { name: 'Patient list' });

    const rahul = within(patientList()).getByRole('link', { name: /Rahul Verma/ });
    expect(rahul).toHaveTextContent('61 y, male');
    expect(rahul).toHaveTextContent('1 critical');
    expect(within(patientList()).getByRole('link', { name: /Meera Iyer/ })).toHaveTextContent('No results yet');
  });

  it('shows an error and recovers on retry', async () => {
    mockNetwork.failNext('listPatients');
    const { user } = renderApp('/');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Couldn’t load patients.');
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('navigation', { name: 'Patient list' })).toBeInTheDocument();
  });

  it('filters the list by name', async () => {
    const { user } = renderApp('/');
    await screen.findByRole('navigation', { name: 'Patient list' });

    await user.type(screen.getByRole('searchbox', { name: 'Search patients by name' }), 'gra');
    expect(within(patientList()).getAllByRole('link')).toHaveLength(1);

    await user.clear(screen.getByRole('searchbox', { name: 'Search patients by name' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search patients by name' }), 'zz');
    expect(screen.getByText('No patients match “zz”.')).toBeInTheDocument();
  });

  it('validates a new patient, then opens their page once created', async () => {
    const { user } = renderApp('/');
    await screen.findByRole('navigation', { name: 'Patient list' });

    await user.click(screen.getByRole('button', { name: 'New patient' }));
    const form = screen.getByRole('form', { name: 'New patient' });
    await user.click(within(form).getByRole('button', { name: 'Add patient' }));

    expect(within(form).getByLabelText('Full name')).toHaveAccessibleDescription('Enter the patient’s name.');
    expect(within(form).getByLabelText('Full name')).toHaveFocus();

    await user.type(within(form).getByLabelText('Full name'), 'Lena Fischer');
    await user.type(within(form).getByLabelText('Age in years'), '16');
    await user.click(within(form).getByRole('radio', { name: 'Female' }));
    await user.click(within(form).getByRole('button', { name: 'Add patient' }));
    expect(within(form).getByLabelText('Age in years')).toHaveAccessibleDescription(/between 18 and 120/);

    await user.clear(within(form).getByLabelText('Age in years'));
    await user.type(within(form).getByLabelText('Age in years'), '38');
    await user.click(within(form).getByRole('button', { name: 'Add patient' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Lena Fischer' })).toBeInTheDocument();
    expect(await within(patientList()).findByRole('link', { name: /Lena Fischer/ })).toBeInTheDocument();
  });
});
