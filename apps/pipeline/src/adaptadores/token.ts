import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

/**
 * `PIPELINE_TOKEN` desde Secrets Manager, leído una vez por contenedor (D12): así no aparece
 * en el template ni en las variables de la Lambda.
 */
export function tokenDesdeSecreto(secreto: string, region: string): () => Promise<string> {
  let token: Promise<string> | undefined;
  return () => {
    token ??= new SecretsManagerClient({ region })
      .send(new GetSecretValueCommand({ SecretId: secreto }))
      .then(({ SecretString }) => {
        if (!SecretString) throw new Error('El secreto del pipeline está vacío');
        return SecretString;
      })
      .catch((error: unknown) => {
        token = undefined; // que el próximo intento vuelva a leerlo
        throw error;
      });
    return token;
  };
}
