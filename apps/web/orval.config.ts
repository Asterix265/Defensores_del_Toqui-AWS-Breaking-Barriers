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
    },
  },
});
