// Configura la app de Amplify Hosting (conectada a GitHub desde la consola) a partir de las
// salidas de ToquiApp: reglas de reescritura, variables del build, build automático de main y la
// configuración de build guardada en la consola, que se iguala a amplify.yml.
// Uso: `pnpm aws:prod:amplify` (aplica) o `pnpm aws:prod:amplify --dry-run` (solo muestra).
import { readFileSync } from 'node:fs';
import {
  AmplifyClient,
  GetAppCommand,
  GetBranchCommand,
  UpdateAppCommand,
  UpdateBranchCommand,
  type CustomRule,
} from '@aws-sdk/client-amplify';
import { REGION, leerSalidasStack, prepararCredenciales } from './comun.js';

/** App creada en la consola; TOQUI_AMPLIFY_APP_ID permite apuntar a otra. */
const APP_ID = process.env['TOQUI_AMPLIFY_APP_ID'] ?? 'dgsos3g6dvh6h';
const RAMA = 'main';
const SOLO_MOSTRAR = process.argv.includes('--dry-run');
/** La consola guarda su propia configuración de build; se reemplaza por la del repositorio. */
const BUILD_SPEC = readFileSync(new URL('../../amplify.yml', import.meta.url), 'utf8');

/** Extensiones que se sirven tal cual; el resto de rutas sin extensión van a la SPA. */
const ESTATICOS =
  'css|gif|ico|jpg|jpeg|js|json|map|png|svg|txt|ttf|webmanifest|webp|woff|woff2|xml';

prepararCredenciales();
const salidas = await leerSalidasStack('ToquiApp');
// CloudFront de ToquiApp: entrada HTTPS de la API (/api/* → ALB).
const cloudfront = salidas['WebUrl'];
if (!cloudfront) throw new Error('El stack ToquiApp no expone WebUrl. ¿Está desplegado?');

const reglas: CustomRule[] = [
  // Primero la API: mismo dominio para el navegador, sin CORS; conserva Authorization.
  { source: '/api/<*>', target: `${cloudfront}/api/<*>`, status: '200' },
  // Rutas de la SPA (recarga en una ruta interna) sin tocar archivos estáticos.
  {
    source: `</^[^.]+$|\\.(?!(${ESTATICOS})$)([^.]+$)/>`,
    target: '/index.html',
    status: '200',
  },
];

const variables: Record<string, string> = {
  AMPLIFY_MONOREPO_APP_ROOT: 'apps/web',
  VITE_AWS_REGION: REGION,
  ...(salidas['UserPoolId'] && { VITE_COGNITO_USER_POOL_ID: salidas['UserPoolId'] }),
  ...(salidas['UserPoolClientId'] && { VITE_COGNITO_CLIENT_ID: salidas['UserPoolClientId'] }),
};

const amplify = new AmplifyClient({ region: REGION });
const { app } = await amplify.send(new GetAppCommand({ appId: APP_ID }));
if (!app) throw new Error(`No existe la app de Amplify ${APP_ID} en ${REGION}.`);

// Se conservan las variables definidas en la consola; las de este script tienen prioridad.
const entorno = { ...app.environmentVariables, ...variables };
const { branch } = await amplify.send(new GetBranchCommand({ appId: APP_ID, branchName: RAMA }));

console.log(`App ${app.name} (${APP_ID}) → https://${RAMA}.${app.defaultDomain}`);
console.log(`Repositorio: ${app.repository ?? '(sin conectar)'}`);
console.log('Reglas:');
for (const r of reglas) console.log(`  ${r.source} → ${r.target} (${r.status})`);
console.log('Variables del build:');
for (const [clave, valor] of Object.entries(variables)) console.log(`  ${clave}=${valor}`);
console.log(`Build automático de ${RAMA}: ${branch?.enableAutoBuild ? 'sí' : 'no → se activa'}`);
console.log(
  `Configuración de build: ${app.buildSpec?.trim() === BUILD_SPEC.trim() ? 'igual a amplify.yml' : 'distinta → se reemplaza por amplify.yml'}`,
);

if (SOLO_MOSTRAR) {
  console.log('\n--dry-run: no se aplicó ningún cambio.');
} else {
  await amplify.send(
    new UpdateAppCommand({
      appId: APP_ID,
      customRules: reglas,
      environmentVariables: entorno,
      buildSpec: BUILD_SPEC,
    }),
  );
  if (!branch?.enableAutoBuild) {
    await amplify.send(
      new UpdateBranchCommand({ appId: APP_ID, branchName: RAMA, enableAutoBuild: true }),
    );
  }
  console.log('\nApp actualizada. El próximo push a main compila con esta configuración.');
}
