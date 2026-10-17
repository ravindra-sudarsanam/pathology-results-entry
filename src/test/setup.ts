import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';
import { mockNetwork } from '../mocks/network';
import { server } from '../mocks/node';
import { seedDatabase } from '../mocks/seed';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

beforeEach(() => {
  // Fresh data and no latency for every test; failures are armed explicitly per test.
  seedDatabase();
  mockNetwork.reset('none');
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => server.close());
