// Imprime las variables de entorno de AWS para pegar en apps/api/.env.
import { MODELOS, REGION, leerSalidas, prepararCredenciales, stackObjetivo } from './comun.js';

prepararCredenciales();
const salidas = await leerSalidas();

console.log(`# AWS (stack ${stackObjetivo()}, ${new Date().toISOString().slice(0, 10)})
AWS_PROFILE=${process.env['AWS_PROFILE']}
AWS_REGION=${REGION}
S3_BUCKET_CAPTURAS=${salidas.BucketCapturas}
COGNITO_USER_POOL_ID=${salidas.UserPoolId}
COGNITO_CLIENT_ID=${salidas.UserPoolClientId}
BEDROCK_GUARDRAIL_ID=${salidas.GuardrailId}
BEDROCK_GUARDRAIL_VERSION=${salidas.GuardrailVersion}
BEDROCK_MODEL_EXTRACCION=${MODELOS.extraccion}
BEDROCK_MODEL_RESUMEN=${MODELOS.resumen}`);
