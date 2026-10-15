// Crea (o actualiza) los usuarios sintéticos de prueba en el User Pool de desarrollo.
import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
  UsernameExistsException,
} from '@aws-sdk/client-cognito-identity-provider';
import {
  REGION,
  USUARIOS_PRUEBA,
  contrasenaPrueba,
  leerSalidas,
  prepararCredenciales,
} from './comun.js';

prepararCredenciales();
const password = contrasenaPrueba();
const { UserPoolId } = await leerSalidas();
const cognito = new CognitoIdentityProviderClient({ region: REGION });

for (const usuario of USUARIOS_PRUEBA) {
  try {
    await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId,
        Username: usuario.email,
        MessageAction: 'SUPPRESS',
        UserAttributes: [
          { Name: 'email', Value: usuario.email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'custom:id_jardin', Value: usuario.idJardin },
        ],
      }),
    );
    console.log(`Creado: ${usuario.email}`);
  } catch (error) {
    if (!(error instanceof UsernameExistsException)) throw error;
    console.log(`Ya existía: ${usuario.email}`);
  }
  await cognito.send(
    new AdminSetUserPasswordCommand({
      UserPoolId,
      Username: usuario.email,
      Password: password,
      Permanent: true,
    }),
  );
  await cognito.send(
    new AdminAddUserToGroupCommand({
      UserPoolId,
      Username: usuario.email,
      GroupName: usuario.grupo,
    }),
  );
}

console.log('Usuarios de prueba listos con la contraseña de TOQUI_DEV_PASSWORD.');
