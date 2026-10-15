import { Inject, Injectable } from '@nestjs/common';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import { grupoDesdeToken, type Identidad } from './identidad';

/** Resultado de verificar un token: identidad, token inválido o persona sin grupo o jardín. */
export type Verificacion =
  { ok: true; identidad: Identidad } | { ok: false; motivo: 'token_invalido' | 'sin_permiso' };

type VerificadorCognito = { verify(token: string): Promise<Record<string, unknown>> };

/** Usuario fijo de `AUTH_MODE=local` cuando la petición no trae token. */
export const USUARIO_LOCAL: Identidad = {
  id: 'local-educadora',
  email: 'educadora@local.test',
  nombre: 'Educadora local',
  grupo: 'educadora',
  idJardin: 'JAR-0001',
};

const TOKEN_LOCAL = /^local:(educadora|directora):(JAR-\d{4})(?::([A-Za-z0-9_-]{1,64}))?$/;

@Injectable()
export class VerificadorToken {
  private readonly cognito: VerificadorCognito | null;

  constructor(@Inject(ENV) env: Env) {
    this.cognito =
      env.AUTH_MODE === 'cognito'
        ? (CognitoJwtVerifier.create({
            userPoolId: env.COGNITO_USER_POOL_ID!,
            clientId: env.COGNITO_CLIENT_ID!,
            // El token de id trae el correo y `custom:id_jardin`; el de acceso no, así que se exige el de id.
            tokenUse: 'id',
          }) as unknown as VerificadorCognito)
        : null;
  }

  get modoLocal(): boolean {
    return this.cognito === null;
  }

  async verificar(token: string): Promise<Verificacion> {
    if (!this.cognito) return verificarLocal(token);

    let claims: Record<string, unknown>;
    try {
      claims = await this.cognito.verify(token);
    } catch {
      return { ok: false, motivo: 'token_invalido' };
    }
    const grupo = grupoDesdeToken(claims['cognito:groups']);
    const idJardin = texto(claims['custom:id_jardin']);
    if (!grupo || !idJardin) return { ok: false, motivo: 'sin_permiso' };
    return {
      ok: true,
      identidad: {
        id: String(claims['sub']),
        email: texto(claims['email']),
        nombre: texto(claims['name']),
        grupo,
        idJardin,
      },
    };
  }
}

function verificarLocal(token: string): Verificacion {
  const match = TOKEN_LOCAL.exec(token);
  if (!match) return { ok: false, motivo: 'token_invalido' };
  const [, grupo, idJardin, id] = match as unknown as [string, Identidad['grupo'], string, string?];
  const sub = id ?? `local-${grupo}-${idJardin}`;
  return {
    ok: true,
    identidad: { id: sub, email: `${sub}@local.test`, nombre: sub, grupo, idJardin },
  };
}

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : null;
}
