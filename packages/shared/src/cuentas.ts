import { z } from 'zod';
import { GrupoSchema, TextoNuloSchema } from './registro.js';

// ---- Cuentas del jardín (panel-directora-y-aprendizaje, D5) ----
// Solo la directora las administra. El jardín sale siempre de su token, nunca del cuerpo.

/** `pendiente`: invitada, todavía no cambia la contraseña temporal. */
export const EstadoCuentaSchema = z.enum(['activa', 'pendiente', 'desactivada']);
export type EstadoCuenta = z.infer<typeof EstadoCuentaSchema>;

export const CuentaSchema = z
  .object({
    /** `username` de Cognito (el `sub`). */
    usuario: z.string(),
    email: TextoNuloSchema,
    nombre: TextoNuloSchema,
    grupo: GrupoSchema.nullable(),
    estado: EstadoCuentaSchema,
    creadaEn: z.iso.datetime().nullable(),
  })
  .meta({ id: 'Cuenta' });
export type Cuenta = z.infer<typeof CuentaSchema>;

export const ListarCuentasResponseSchema = z.object({ cuentas: z.array(CuentaSchema) });
export type ListarCuentasResponse = z.infer<typeof ListarCuentasResponseSchema>;

/** `strict`: un `idJardin` u otro campo en el cuerpo se rechaza con 400. */
export const InvitarCuentaRequestSchema = z.strictObject({
  email: z.email().max(254),
  nombre: z.string().trim().min(2).max(80),
  grupo: GrupoSchema,
});
export type InvitarCuentaRequest = z.infer<typeof InvitarCuentaRequestSchema>;

export const CuentaResponseSchema = z.object({ cuenta: CuentaSchema });
export type CuentaResponse = z.infer<typeof CuentaResponseSchema>;
