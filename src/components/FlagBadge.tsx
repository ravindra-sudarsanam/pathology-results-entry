import { CLASSIFICATION_LABELS, type Classification } from '../domain';
import { SEVERITY } from './severity';

const ARROWS: Record<Classification, string> = {
  NORMAL: '',
  LOW: '↓',
  HIGH: '↑',
  CRITICAL_LOW: '↓↓',
  CRITICAL_HIGH: '↑↑',
};

interface FlagBadgeProps {
  classification: Classification;
  id?: string;
}

/**
 * Colour plus a text label, so the meaning never relies on colour alone.
 * Critical uses a solid fill; low/high use a tint; normal stays quiet.
 */
export function FlagBadge({ classification, id }: FlagBadgeProps) {
  const arrow = ARROWS[classification];
  return (
    <span id={id} className={`flag flag--${SEVERITY[classification]}`} data-classification={classification}>
      {arrow && (
        <span className="flag__arrow" aria-hidden="true">
          {arrow}
        </span>
      )}
      <span className="flag__label">{CLASSIFICATION_LABELS[classification]}</span>
    </span>
  );
}
