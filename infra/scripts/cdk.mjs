// Ejecuta la CLI de CDK con el perfil `toqui` por defecto, igual en Windows, macOS y Linux. En la
// CI (credenciales OIDC en el entorno) no fija perfil: no existe y CDK fallaría al buscarlo.
import { spawnSync } from 'node:child_process';

const conCredenciales =
  process.env.AWS_ACCESS_KEY_ID ||
  process.env.AWS_WEB_IDENTITY_TOKEN_FILE ||
  process.env.CI === 'true';
const env = {
  ...process.env,
  ...(conCredenciales ? {} : { AWS_PROFILE: process.env.AWS_PROFILE ?? 'toqui' }),
  CDK_DISABLE_CLI_TELEMETRY: 'true',
};
const { status } = spawnSync('cdk', process.argv.slice(2), { stdio: 'inherit', env, shell: true });
process.exit(status ?? 1);
