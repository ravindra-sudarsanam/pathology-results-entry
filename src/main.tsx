import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/atkinson-hyperlegible-next/400.css';
import '@fontsource/atkinson-hyperlegible-next/700.css';
import './styles/tokens.css';
import './styles/app.css';
import { App } from './app/App';
import { MockApiPanel } from './mocks/MockApiPanel';

const container = document.getElementById('root')!;

async function bootstrap() {
  // Loaded separately so the mock backend is its own chunk; swapping in a real API means deleting these two lines.
  const { startMockApi } = await import('./mocks/browser');
  await startMockApi();

  createRoot(container).render(
    <StrictMode>
      <App devtools={<MockApiPanel />} />
    </StrictMode>,
  );
}

bootstrap().catch((error: unknown) => {
  // Without the mock service worker there is no API, so explain instead of rendering a broken app.
  console.error(error);
  container.innerHTML =
    '<p class="boot-error">The mock API could not start. Service workers need a modern browser on https or localhost.</p>';
});
