// Empaqueta cada handler en un archivo ESM independiente para Lambda (runtime nodejs24.x).
import { build } from 'esbuild';
import { readdirSync } from 'node:fs';

const entryPoints = readdirSync('src/handlers')
  .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
  .map((file) => `src/handlers/${file}`);

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
