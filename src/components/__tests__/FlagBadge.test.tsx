import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Classification } from '../../domain';
import { FlagBadge } from '../FlagBadge';

describe('FlagBadge', () => {
  it.each<[Classification, string, string]>([
    ['NORMAL', 'Normal', 'normal'],
    ['LOW', 'LOW', 'abnormal'],
    ['HIGH', 'HIGH', 'abnormal'],
    ['CRITICAL_LOW', 'CRITICAL LOW', 'critical'],
    ['CRITICAL_HIGH', 'CRITICAL HIGH', 'critical'],
  ])('%s shows the text label "%s" (never colour alone)', (classification, label, severity) => {
    render(<FlagBadge classification={classification} id="flag" />);
    const badge = document.getElementById('flag')!;

    expect(badge).toHaveTextContent(label);
    expect(screen.getByText(label)).toBeVisible();
    expect(badge).toHaveClass(`flag--${severity}`);
  });

  it('styles critical differently from low/high so it stands out more', () => {
    const { container } = render(
      <>
        <FlagBadge classification="HIGH" />
        <FlagBadge classification="CRITICAL_HIGH" />
      </>,
    );
    const [high, critical] = container.querySelectorAll('.flag');
    expect(high.className).not.toBe(critical.className);
  });

  it('hides the arrow from screen readers so only the words are announced', () => {
    render(<FlagBadge classification="CRITICAL_HIGH" id="flag" />);
    const arrow = document.querySelector('.flag__arrow')!;
    expect(arrow).toHaveAttribute('aria-hidden', 'true');
    expect(arrow).toHaveTextContent('↑↑');
  });
});
