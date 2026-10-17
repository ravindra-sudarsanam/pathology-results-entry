import type { ReactNode } from 'react';

export function LoadingState({ label, lines = 3 }: { label: string; lines?: number }) {
  return (
    <div className="loading" role="status">
      <span className="visually-hidden">{label}</span>
      {Array.from({ length: lines }, (_, index) => (
        <span key={index} className="loading__line" aria-hidden="true" />
      ))}
    </div>
  );
}

interface ErrorStateProps {
  title: string;
  message?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export function ErrorState({ title, message, onRetry, isRetrying = false }: ErrorStateProps) {
  return (
    <div className="notice notice--error" role="alert">
      <p className="notice__title">{title}</p>
      {message && <p className="notice__body">{message}</p>}
      {onRetry && (
        <button type="button" className="button button--secondary" onClick={onRetry} disabled={isRetrying}>
          {isRetrying ? 'Trying again…' : 'Try again'}
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <p className="empty__title">{title}</p>
      {children}
    </div>
  );
}
