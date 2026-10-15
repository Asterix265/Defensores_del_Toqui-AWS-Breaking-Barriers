import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Identidad } from './identidad';

/**
 * Mantiene la tabla `usuarios` al día con lo que dice el token. Recuerda lo ya escrito
 * mientras la Lambda siga caliente, para no escribir en la base en cada petición.
 */
@Injectable()
export class UsuariosService {
  private readonly sincronizados = new Map<string, string>();

  constructor(private readonly prisma: PrismaService) {}

  async sincronizar(identidad: Identidad): Promise<void> {
    const huella = JSON.stringify([identidad.rol, identidad.nombre, identidad.telefono]);
    if (this.sincronizados.get(identidad.id) === huella) return;

    const datos = { rol: identidad.rol, nombre: identidad.nombre, telefono: identidad.telefono };
    await this.prisma.usuario.upsert({
      where: { id: identidad.id },
      create: { id: identidad.id, ...datos },
      update: datos,
    });
    this.sincronizados.set(identidad.id, huella);
  }
}
