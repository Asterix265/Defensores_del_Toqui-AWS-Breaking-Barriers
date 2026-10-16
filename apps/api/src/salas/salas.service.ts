import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  EstadoSalaResponse,
  NivelEducativo,
  ResumenJardinResponse,
  ResumenSala,
} from '@toqui/shared';
import type { Identidad } from '../auth/identidad';
import { aColumnaFecha, desdeColumnaFecha, edadEnMeses, hoyEn, sumarDias } from '../comun/fechas';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import {
  REGLAS,
  alertasDeSalas,
  alertasIndividuales,
  decisionesVigentes,
  resumirNucleo,
  type DecisionValidada,
} from './reglas';

/** Ventana de actividad de registro que muestra la vista general. */
const DIAS_ACTIVIDAD = 30;

interface SalaFila {
  id: string;
  salaGrupo: string;
  idNivelEducativo: string;
}

interface NinoFila {
  id: string;
  idSala: string;
  fechaNacimiento: Date;
}

/**
 * Estado por núcleo de las salas y vista general del jardín (D1). Se calcula al consultar con
 * las valoraciones del dataset y de la app; las reglas viven en `reglas.ts`.
 */
@Injectable()
export class SalasService {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
  ) {}

  async estadoSala(
    identidad: Identidad,
    salaGrupo: string,
    corte = hoyEn(this.env.ZONA_HORARIA),
  ): Promise<EstadoSalaResponse> {
    const sala = await this.prisma.sala.findUnique({
      where: { idJardin_salaGrupo: { idJardin: identidad.idJardin, salaGrupo } },
      select: { id: true, salaGrupo: true, idNivelEducativo: true },
    });
    if (!sala) throw new NotFoundException('Sala no encontrada en el jardín');

    const [nucleos, ninos] = await Promise.all([this.nucleos(), this.ninos([sala.id], corte)]);
    const decisiones = await this.decisiones(
      ninos.map((n) => n.id),
      corte,
    );
    const niveles = decisionesVigentes(decisiones, corte);
    return {
      sala: sala.salaGrupo,
      idSala: sala.id,
      nivelEducativo: sala.idNivelEducativo as NivelEducativo,
      corte,
      matriculados: ninos.length,
      nucleos: nucleos.map((n) => resumirNucleo(n, niveles, ninos.length)),
      niveles,
      alertas: alertasIndividuales(niveles),
      reglas: REGLAS,
    };
  }

  async resumenJardin(
    identidad: Identidad,
    corte = hoyEn(this.env.ZONA_HORARIA),
  ): Promise<ResumenJardinResponse> {
    const salas: SalaFila[] = await this.prisma.sala.findMany({
      where: { idJardin: identidad.idJardin },
      select: { id: true, salaGrupo: true, idNivelEducativo: true },
      orderBy: { salaGrupo: 'asc' },
    });
    const [nucleos, ninos] = await Promise.all([
      this.nucleos(),
      this.ninos(
        salas.map((s) => s.id),
        corte,
      ),
    ]);
    const [decisiones, observaciones] = await Promise.all([
      this.decisiones(
        ninos.map((n) => n.id),
        corte,
      ),
      this.prisma.observacion.findMany({
        where: {
          nino: { idJardin: identidad.idJardin },
          fechaObservacion: {
            gt: aColumnaFecha(sumarDias(corte, -DIAS_ACTIVIDAD)),
            lte: aColumnaFecha(corte),
          },
        },
        select: { nino: { select: { idSala: true } } },
      }),
    ]);
    const salaDe = new Map(ninos.map((n) => [n.id, n.idSala]));
    const niveles = decisionesVigentes(decisiones, corte);

    const resumenes = salas.map((sala) => {
      const deLaSala = ninos.filter((n) => n.idSala === sala.id);
      const nivelesSala = niveles.filter((n) => salaDe.get(n.idNino) === sala.id);
      const alertas = alertasIndividuales(nivelesSala);
      const edades = deLaSala.map((n) => edadEnMeses(desdeColumnaFecha(n.fechaNacimiento), corte));
      const posibles = deLaSala.length * nucleos.length;
      return {
        sala,
        resumen: {
          sala: sala.salaGrupo,
          idSala: sala.id,
          nivelEducativo: sala.idNivelEducativo as NivelEducativo,
          matriculados: deLaSala.length,
          edadMinMeses: edades.length ? Math.min(...edades) : null,
          edadMaxMeses: edades.length ? Math.max(...edades) : null,
          edadPromedioMeses: edades.length
            ? Math.round((edades.reduce((a, b) => a + b, 0) / edades.length) * 10) / 10
            : null,
          cobertura: posibles ? nivelesSala.length / posibles : 0,
          observaciones30Dias: observaciones.filter((o) => o.nino.idSala === sala.id).length,
          alertasIndividuales: alertas.length,
          ninosConAlerta: new Set(alertas.map((a) => a.idNino)).size,
          nucleos: nucleos.map((n) => resumirNucleo(n, nivelesSala, deLaSala.length)),
          alertasSala: [],
        } satisfies ResumenSala as ResumenSala,
      };
    });

    // Las salas solo se comparan con otras del mismo nivel educativo.
    for (const nivel of new Set(salas.map((s) => s.idNivelEducativo))) {
      const equivalentes = resumenes.filter((r) => r.sala.idNivelEducativo === nivel);
      const alertas = alertasDeSalas(equivalentes.map((r) => r.resumen));
      for (const r of equivalentes) r.resumen.alertasSala = alertas.get(r.sala.id) ?? [];
    }

    return {
      idJardin: identidad.idJardin,
      corte,
      salas: resumenes.map((r) => r.resumen),
      reglas: REGLAS,
    };
  }

  private async nucleos(): Promise<string[]> {
    const filas = await this.prisma.nucleo.findMany({
      orderBy: { id: 'asc' },
      select: { id: true },
    });
    return filas.map((n) => n.id);
  }

  /** Matriculados al corte (como el dataset: `fecha_ingreso` ≤ corte). */
  private ninos(idsSala: string[], corte: string): Promise<NinoFila[]> {
    return this.prisma.nino.findMany({
      where: { idSala: { in: idsSala }, fechaIngreso: { lte: aColumnaFecha(corte) } },
      select: { id: true, idSala: true, fechaNacimiento: true },
    });
  }

  private async decisiones(idsNino: string[], corte: string): Promise<DecisionValidada[]> {
    const filas = await this.prisma.valoracion.findMany({
      where: {
        idNino: { in: idsNino },
        nivelValidado: { not: null },
        fechaCorte: { lte: aColumnaFecha(corte) },
      },
      select: {
        idNino: true,
        idNucleo: true,
        nivelValidado: true,
        fechaCorte: true,
        fechaDecision: true,
      },
    });
    return filas.map((v) => ({
      idNino: v.idNino,
      nucleo: v.idNucleo,
      nivel: v.nivelValidado!,
      fechaCorte: desdeColumnaFecha(v.fechaCorte),
      fechaDecision: v.fechaDecision ? desdeColumnaFecha(v.fechaDecision) : null,
    }));
  }
}
