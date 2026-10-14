import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setupServer } from 'msw/node';
import { getGetHealthMockHandler } from './api/generated/health/health.msw';
import { App } from './App';

const server = setupServer(
  getGetHealthMockHandler({
    status: 'ok',
    version: '0.0.0',
    timestamp: '2026-10-14T00:00:00.000Z',
    dependencies: { database: 'up' },
  }),
);

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('App', () => {
  it('muestra el estado de salud de la API', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <App />
      </QueryClientProvider>,
    );
    expect(await screen.findByText('API operativa · base de datos conectada')).toBeInTheDocument();
  });
});
