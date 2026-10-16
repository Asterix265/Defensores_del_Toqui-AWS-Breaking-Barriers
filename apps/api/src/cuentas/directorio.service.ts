import { Inject, Injectable } from '@nestjs/common';
import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminGetUserCommand,
  AdminListGroupsForUserCommand,
  CognitoIdentityProviderClient,
  ListUsersInGroupCommand,
  type AttributeType,
} from '@aws-sdk/client-cognito-identity-provider';
import type { Grupo } from '@toqui/shared';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';

/** Usuario del pool tal como lo necesita el módulo de cuentas. */
export interface UsuarioDirectorio {
  /** `Username` de Cognito (el `sub` en un pool con alias de correo). */
  usuario: string;
  sub: string | null;
  email: string | null;
  nombre: string | null;
  idJardin: string | null;
  habilitado: boolean;
  /** `FORCE_CHANGE_PASSWORD` mientras no cambie la contraseña temporal. */
  estadoCognito: string | null;
  creadoEn: Date | null;
}

/** Errores de Cognito que el módulo traduce a respuestas HTTP. */
export class CorreoYaRegistrado extends Error {}
export class UsuarioNoEncontrado extends Error {}
/** La cuenta se creó, pero `AdminAddUserToGroup` falló: quedó sin grupo y no puede ingresar. */
export class InvitacionIncompleta extends Error {}

const GRUPOS: Grupo[] = ['educadora', 'directora'];

/**
 * Puerto del User Pool para administrar cuentas (panel-directora-y-aprendizaje, D5). Solo las
 * acciones que permite el rol de tarea de la API; las pruebas lo reemplazan por un doble.
 */
@Injectable()
export class DirectorioService {
  private readonly cognito: CognitoIdentityProviderClient;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.cognito = new CognitoIdentityProviderClient({ region: env.AWS_REGION });
  }

  get disponible(): boolean {
    return this.env.AUTH_MODE === 'cognito' && Boolean(this.env.COGNITO_USER_POOL_ID);
  }

  /** Usuarios de los grupos de la app con su grupo de más permisos. */
  async listar(): Promise<{ usuario: UsuarioDirectorio; grupo: Grupo }[]> {
    const porUsuario = new Map<string, { usuario: UsuarioDirectorio; grupo: Grupo }>();
    for (const grupo of GRUPOS) {
      let token: string | undefined;
      do {
        const res = await this.cognito.send(
          new ListUsersInGroupCommand({
            UserPoolId: this.pool(),
            GroupName: grupo,
            Limit: 60,
            NextToken: token,
          }),
        );
        for (const u of res.Users ?? []) {
          const usuario = aUsuario(
            u.Username!,
            u.Attributes,
            u.Enabled,
            u.UserStatus,
            u.UserCreateDate,
          );
          // `directora` se recorre al final y gana si la persona está en ambos grupos.
          porUsuario.set(usuario.usuario, { usuario, grupo });
        }
        token = res.NextToken;
      } while (token);
    }
    return [...porUsuario.values()];
  }

  async obtener(usuario: string): Promise<UsuarioDirectorio> {
    try {
      const res = await this.cognito.send(
        new AdminGetUserCommand({ UserPoolId: this.pool(), Username: usuario }),
      );
      return aUsuario(
        res.Username!,
        res.UserAttributes,
        res.Enabled,
        res.UserStatus,
        res.UserCreateDate,
      );
    } catch (error) {
      if ((error as Error).name === 'UserNotFoundException') throw new UsuarioNoEncontrado();
      throw error;
    }
  }

  /** Crea la cuenta y Cognito envía la contraseña temporal por correo. */
  async invitar(datos: {
    email: string;
    nombre: string;
    grupo: Grupo;
    idJardin: string;
  }): Promise<UsuarioDirectorio> {
    let creado;
    try {
      creado = await this.cognito.send(
        new AdminCreateUserCommand({
          UserPoolId: this.pool(),
          Username: datos.email,
          DesiredDeliveryMediums: ['EMAIL'],
          UserAttributes: [
            { Name: 'email', Value: datos.email },
            { Name: 'email_verified', Value: 'true' },
            { Name: 'name', Value: datos.nombre },
            { Name: 'custom:id_jardin', Value: datos.idJardin },
          ],
        }),
      );
    } catch (error) {
      if ((error as Error).name === 'UsernameExistsException') throw new CorreoYaRegistrado();
      throw error;
    }
    const u = creado.User!;
    try {
      await this.asignarGrupo(u.Username!, datos.grupo);
    } catch (error) {
      // Cognito ya envió el correo: invitar de nuevo el mismo correo completa la cuenta.
      throw new InvitacionIncompleta((error as Error).name);
    }
    return aUsuario(u.Username!, u.Attributes, u.Enabled, u.UserStatus, u.UserCreateDate);
  }

  async asignarGrupo(usuario: string, grupo: Grupo): Promise<void> {
    await this.cognito.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: this.pool(),
        Username: usuario,
        GroupName: grupo,
      }),
    );
  }

  /** Grupos de la app (`educadora`, `directora`) a los que pertenece el usuario. */
  async gruposDe(usuario: string): Promise<Grupo[]> {
    const grupos: Grupo[] = [];
    let token: string | undefined;
    do {
      const res = await this.cognito.send(
        new AdminListGroupsForUserCommand({
          UserPoolId: this.pool(),
          Username: usuario,
          Limit: 60,
          NextToken: token,
        }),
      );
      for (const g of res.Groups ?? []) {
        if (GRUPOS.includes(g.GroupName as Grupo)) grupos.push(g.GroupName as Grupo);
      }
      token = res.NextToken;
    } while (token);
    return grupos;
  }

  /** Vuelve a enviar la contraseña temporal (solo cuentas que no la han cambiado). */
  async reenviar(usuario: string): Promise<void> {
    await this.cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: this.pool(),
        Username: usuario,
        MessageAction: 'RESEND',
        DesiredDeliveryMediums: ['EMAIL'],
      }),
    );
  }

  async habilitar(usuario: string, habilitado: boolean): Promise<void> {
    const datos = { UserPoolId: this.pool(), Username: usuario };
    await this.cognito.send(
      habilitado ? new AdminEnableUserCommand(datos) : new AdminDisableUserCommand(datos),
    );
  }

  private pool(): string {
    return this.env.COGNITO_USER_POOL_ID!;
  }
}

function aUsuario(
  usuario: string,
  atributos: AttributeType[] | undefined,
  habilitado: boolean | undefined,
  estado: string | undefined,
  creadoEn: Date | undefined,
): UsuarioDirectorio {
  const valor = (nombre: string) => atributos?.find((a) => a.Name === nombre)?.Value ?? null;
  return {
    usuario,
    sub: valor('sub'),
    email: valor('email'),
    nombre: valor('name'),
    idJardin: valor('custom:id_jardin'),
    habilitado: habilitado ?? true,
    estadoCognito: estado ?? null,
    creadoEn: creadoEn ?? null,
  };
}
