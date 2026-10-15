import { App } from 'aws-cdk-lib';
import { AppStack } from '../lib/app-stack.js';
import { DatosStack } from '../lib/datos-stack.js';
import { DevStack } from '../lib/dev-stack.js';
import { RedStack } from '../lib/red-stack.js';

const app = new App();

// Cuenta tomada de las credenciales al desplegar; la región es fija por la SCP del evento.
const env = { account: process.env['CDK_DEFAULT_ACCOUNT'], region: 'us-east-1' };

// Desarrollo: servicios compartidos que usa el equipo desde su máquina.
new DevStack(app, 'ToquiDev', {
  env,
  description: 'Defensores del Toqui: recursos AWS compartidos para desarrollo',
});

// Producción (demo): red → datos → aplicación.
const red = new RedStack(app, 'ToquiRed', { env, description: 'Defensores del Toqui: red' });
const datos = new DatosStack(app, 'ToquiDatos', {
  env,
  vpc: red.vpc,
  description: 'Defensores del Toqui: Aurora Serverless v2',
});
new AppStack(app, 'ToquiApp', {
  env,
  vpc: red.vpc,
  cluster: datos.cluster,
  secretoApp: datos.secretoApp,
  description: 'Defensores del Toqui: web, API, pipeline e identidad',
});
