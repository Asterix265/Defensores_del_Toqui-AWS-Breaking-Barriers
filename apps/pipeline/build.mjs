// Empaqueta cada handler en un archivo ESM independiente para Lambda (runtime nodejs24.x).
import { build } from 'esbuild';
import { readdirSync, rmSync } from 'node:fs';

const entryPoints = readdirSync('src/handlers')
  .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
  .map((file) => `src/handlers/${file}`);

// Sin restos de builds anteriores: todo lo que queda en dist entra al zip de la Lambda.
rmSync('dist', { recursive: true, force: true });

await build({
  entryPoints,
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  outExtension: { '.js': '.mjs' },
  sourcemap: true,
  minify: true,
  // El runtime de Lambda ya incluye AWS SDK v3.
  external: ['@aws-sdk/*'],
  logLevel: 'info',
});
