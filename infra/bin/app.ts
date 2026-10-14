import { App } from 'aws-cdk-lib';
import { BaseStack } from '../lib/base-stack.js';

const app = new App();

// Sin cuenta explícita: la plantilla se sintetiza sin credenciales. La región es fija.
new BaseStack(app, 'ToquiBase', { env: { region: 'us-east-1' } });
