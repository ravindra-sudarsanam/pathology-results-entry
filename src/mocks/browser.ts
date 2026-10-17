import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';
import { seedDatabase } from './seed';

export async function startMockApi(): Promise<void> {
  seedDatabase();
  const worker = setupWorker(...handlers);
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: true,
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  });
}
