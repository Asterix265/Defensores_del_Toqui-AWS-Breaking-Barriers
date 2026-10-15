// Ejecuta la CLI de CDK con el perfil `toqui` por defecto, igual en Windows, macOS y Linux.
import { spawnSync } from 'node:child_process';

const env = {
  ...process.env,
  AWS_PROFILE: process.env.AWS_PROFILE ?? 'toqui',
  CDK_DISABLE_CLI_TELEMETRY: 'true',
};
const { status } = spawnSync('cdk', process.argv.slice(2), { stdio: 'inherit', env, shell: true });
process.exit(status ?? 1);
