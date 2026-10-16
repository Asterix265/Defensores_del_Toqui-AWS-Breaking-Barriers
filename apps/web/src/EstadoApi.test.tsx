import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setupServer } from 'msw/node';
import { getGetHealthMockHandler } from './api/generated/health/health.msw';
import { EstadoApi } from './EstadoApi';

const server = setupServer(
  getGetHealthMockHandler({
    status: 'ok',
    version: '0.0.0',
    timestamp: '2026-10-14T00:00:00.000Z',
    dependencies: { database: 'up', storage: 'up', queue: 'up' },
  }),
);

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('EstadoApi', () => {
  it('muestra el estado de salud de la API', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <EstadoApi />
      </QueryClientProvider>,
    );
    expect(
      await screen.findByText(
        'API operativa · base de datos conectada · almacenamiento conectado · cola conectada',
      ),
    ).toBeInTheDocument();
  });
});
