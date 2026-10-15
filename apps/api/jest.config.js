/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.spec.ts', '<rootDir>/test/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': [
      '@swc/jest',
      {
        jsc: {
          parser: { syntax: 'typescript', decorators: true },
          transform: { legacyDecorator: true, decoratorMetadata: true },
          target: 'es2023',
        },
        module: { type: 'commonjs' },
      },
    ],
  },
  moduleNameMapper: {
    // Usa el código fuente de los paquetes compartidos para no depender de su build en las pruebas.
    '^@toqui/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^@toqui/ia$': '<rootDir>/../../packages/ia/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
