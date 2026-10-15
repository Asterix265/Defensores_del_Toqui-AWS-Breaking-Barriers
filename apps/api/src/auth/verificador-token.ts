import { Inject, Injectable } from '@nestjs/common';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import { rolDesdeGrupos, type Identidad } from './identidad';

/** Resultado de verificar un token: identidad, token inválido o persona sin grupo habilitado. */
export type Verificacion =
  { ok: true; identidad: Identidad } | { ok: false; motivo: 'token_invalido' | 'sin_rol' };

type VerificadorCognito = { verify(token: string): Promise<Record<string, unknown>> };

const TOKEN_DEV = /^dev:(registrador|supervisor):([A-Za-z0-9_-]{1,64})$/;

@Injectable()
export class VerificadorToken {
  private readonly cognito: VerificadorCognito | null;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.cognito =
      env.AUTH_MODO === 'cognito'
        ? (CognitoJwtVerifier.create({
            userPoolId: env.COGNITO_USER_POOL_ID!,
            clientId: env.COGNITO_CLIENT_ID!,
            // Acepta token de id (trae nombre y teléfono) o de acceso; ambos traen los grupos.
            tokenUse: null,
          }) as unknown as VerificadorCognito)
        : null;
  }

  async verificar(token: string): Promise<Verificacion> {
    if (!this.cognito) return this.verificarDev(token);

    let claims: Record<string, unknown>;
    try {
      claims = await this.cognito.verify(token);
    } catch {
      return { ok: false, motivo: 'token_invalido' };
    }
    const rol = rolDesdeGrupos(claims['cognito:groups']);
    if (!rol) return { ok: false, motivo: 'sin_rol' };
    return {
      ok: true,
      identidad: {
        id: String(claims['sub']),
        rol,
        nombre: texto(claims['name']) ?? nombreCompleto(claims),
        telefono: texto(claims['phone_number']),
      },
    };
  }

  private verificarDev(token: string): Verificacion {
    const match = TOKEN_DEV.exec(token);
    if (!match) return { ok: false, motivo: 'token_invalido' };
    const [, rol, sub] = match as unknown as [string, Identidad['rol'], string];
    return { ok: true, identidad: { id: sub, rol, nombre: sub, telefono: null } };
  }
}

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : null;
}

function nombreCompleto(claims: Record<string, unknown>): string | null {
  const partes = [texto(claims['given_name']), texto(claims['family_name'])].filter(Boolean);
  return partes.length ? partes.join(' ') : null;
}
