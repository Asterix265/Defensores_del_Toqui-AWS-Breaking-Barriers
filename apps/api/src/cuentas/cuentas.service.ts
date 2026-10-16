import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import type { Cuenta, Grupo, InvitarCuentaRequest } from '@toqui/shared';
import type { Identidad } from '../auth/identidad';
import {
  CorreoYaRegistrado,
  DirectorioService,
  UsuarioNoEncontrado,
  type UsuarioDirectorio,
} from './directorio.service';

/**
 * Cuentas del jardín administradas por la directora (D5). El jardín sale siempre del token de
 * quien llama: no se puede crear ni tocar una cuenta de otro jardín.
 */
@Injectable()
export class CuentasService {
  constructor(private readonly directorio: DirectorioService) {}

  async listar(identidad: Identidad): Promise<Cuenta[]> {
    this.exigirCognito();
    const usuarios = await this.directorio.listar();
    return usuarios
      .filter(({ usuario }) => usuario.idJardin === identidad.idJardin)
      .map(({ usuario, grupo }) => aCuenta(usuario, grupo))
      .sort((a, b) => (a.email ?? '').localeCompare(b.email ?? ''));
  }

  async invitar(identidad: Identidad, datos: InvitarCuentaRequest): Promise<Cuenta> {
    this.exigirCognito();
    try {
      const usuario = await this.directorio.invitar({
        email: datos.email.toLowerCase(),
        nombre: datos.nombre,
        grupo: datos.grupo,
        idJardin: identidad.idJardin,
      });
      return aCuenta(usuario, datos.grupo);
    } catch (error) {
      if (error instanceof CorreoYaRegistrado) {
        throw new ConflictException('Ese correo ya tiene cuenta');
      }
      throw error;
    }
  }

  async reenviar(identidad: Identidad, usuario: string): Promise<Cuenta> {
    const cuenta = await this.delJardin(identidad, usuario);
    if (cuenta.estadoCognito !== 'FORCE_CHANGE_PASSWORD') {
      throw new BadRequestException('La cuenta ya definió su contraseña');
    }
    await this.directorio.reenviar(cuenta.usuario);
    return aCuenta(cuenta, null);
  }

  async habilitar(identidad: Identidad, usuario: string, habilitado: boolean): Promise<Cuenta> {
    const cuenta = await this.delJardin(identidad, usuario);
    if (!habilitado && (cuenta.sub === identidad.id || cuenta.usuario === identidad.id)) {
      throw new BadRequestException('No puedes desactivar tu propia cuenta');
    }
    await this.directorio.habilitar(cuenta.usuario, habilitado);
    return aCuenta({ ...cuenta, habilitado }, null);
  }

  private async delJardin(identidad: Identidad, usuario: string): Promise<UsuarioDirectorio> {
    this.exigirCognito();
    let cuenta;
    try {
      cuenta = await this.directorio.obtener(usuario);
    } catch (error) {
      if (error instanceof UsuarioNoEncontrado) throw new NotFoundException('Cuenta no encontrada');
      throw error;
    }
    if (cuenta.idJardin !== identidad.idJardin) {
      throw new ForbiddenException('La cuenta pertenece a otro jardín');
    }
    return cuenta;
  }

  private exigirCognito(): void {
    if (!this.directorio.disponible) {
      throw new NotImplementedException(
        'La administración de cuentas requiere AUTH_MODE=cognito y COGNITO_USER_POOL_ID',
      );
    }
  }
}

function aCuenta(u: UsuarioDirectorio, grupo: Grupo | null): Cuenta {
  let estado: Cuenta['estado'] = 'activa';
  if (!u.habilitado) estado = 'desactivada';
  else if (u.estadoCognito === 'FORCE_CHANGE_PASSWORD') estado = 'pendiente';
  return {
    usuario: u.usuario,
    email: u.email,
    nombre: u.nombre,
    grupo,
    estado,
    creadaEn: u.creadoEn ? u.creadoEn.toISOString() : null,
  };
}
