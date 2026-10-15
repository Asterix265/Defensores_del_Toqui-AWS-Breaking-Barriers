import { App } from 'aws-cdk-lib';
import { DevStack } from '../lib/dev-stack.js';

const app = new App();

// Cuenta tomada de las credenciales al desplegar; la región es fija por la SCP del evento.
new DevStack(app, 'ToquiDev', {
  env: { account: process.env['CDK_DEFAULT_ACCOUNT'], region: 'us-east-1' },
  description: 'Defensores del Toqui: recursos AWS compartidos para desarrollo',
});
