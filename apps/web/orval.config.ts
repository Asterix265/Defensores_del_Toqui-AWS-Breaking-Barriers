import { defineConfig } from 'orval';

export default defineConfig({
  api: {
    input: { target: '../api/openapi.json' },
    output: {
      mode: 'tags-split',
      target: 'src/api/generated',
      schemas: 'src/api/generated/model',
      client: 'react-query',
      httpClient: 'fetch',
      baseUrl: '/api',
      mock: true,
      clean: true,
      formatter: 'prettier',
      // Agrega el ID token de Cognito a cada llamada (ver src/api/fetch-con-token.ts).
      override: { mutator: { path: 'src/api/fetch-con-token.ts', name: 'fetchConToken' } },
    },
  },
});
