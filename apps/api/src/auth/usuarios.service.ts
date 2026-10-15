import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Identidad } from './identidad';

/**
 * Mantiene la tabla `usuarios` al día con lo que dice el token. Recuerda lo ya escrito
 * mientras la Lambda siga caliente, para no escribir en la base en cada petición.
 *
 * El token de acceso de Cognito no trae nombre ni teléfono (el de id sí): un dato ausente
 * en el token nunca borra el guardado, así que alternar tipos de token no pierde datos
 * ni provoca escrituras.
 */
@Injectable()
export class UsuariosService {
  private readonly conocidos = new Map<string, Identidad>();

  constructor(private readonly prisma: PrismaService) {}

  /** Registra o actualiza a la persona y devuelve su identidad completa (token + base). */
  async sincronizar(identidad: Identidad): Promise<Identidad> {
    const conocido = this.conocidos.get(identidad.id);
    if (conocido && !aportaCambios(identidad, conocido)) return conocido;

    const datos = {
      rol: identidad.rol,
      ...(identidad.nombre !== null && { nombre: identidad.nombre }),
      ...(identidad.telefono !== null && { telefono: identidad.telefono }),
    };
    const usuario = await this.prisma.usuario.upsert({
      where: { id: identidad.id },
      create: { id: identidad.id, ...datos },
      update: datos,
      select: { id: true, rol: true, nombre: true, telefono: true },
    });
    this.conocidos.set(usuario.id, usuario);
    return usuario;
  }
}

/** true si el token cambia el rol o trae un nombre o teléfono distinto del conocido. */
function aportaCambios(token: Identidad, conocido: Identidad): boolean {
  return (
    token.rol !== conocido.rol ||
    (token.nombre !== null && token.nombre !== conocido.nombre) ||
    (token.telefono !== null && token.telefono !== conocido.telefono)
  );
}
