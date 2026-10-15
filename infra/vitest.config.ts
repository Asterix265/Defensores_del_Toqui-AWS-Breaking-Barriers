import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // cdk.out contiene copias del repo (activos Docker): sus pruebas no son de este paquete.
    include: ['lib/**/*.test.ts'],
  },
});
