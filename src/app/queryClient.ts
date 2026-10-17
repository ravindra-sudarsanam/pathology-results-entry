import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/client';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Retry once for server/network errors; never for 4xx, which won't fix themselves.
        retry: (failureCount, error) =>
          failureCount < 1 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
        // Keeps armed demo failures from being consumed by a background refetch.
        refetchOnWindowFocus: false,
      },
      mutations: {
        // Saves are retried by the nurse, explicitly, with the same idempotency key.
        retry: false,
      },
    },
  });
}
