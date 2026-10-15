/**
 * Datos y proveedor simulado para la demo de «Registro Simple».
 * Nombres y notas son sintéticos: no provienen del dataset ni de niños o niñas reales.
 */

export type Formato = 'audio' | 'foto' | 'texto';

/** Dominios del dataset sintético (ver docs/contexto-desafio.md). */
export type Dominio =
  'cognitivo' | 'lenguaje_comunicacion' | 'motor_fino' | 'motor_grueso' | 'socioemocional';

export interface Nino {
  id: string;
  nombre: string;
  iniciales: string;
  sala: string;
  fondo: string;
  tinta: string;
}

export interface Nota {
  id: string;
  ninoId: string;
  /** Nombre de la tía que registró la nota. */
  educadora: string;
  formato: Formato;
  creada: Date;
  /** Duración de la grabación en segundos (solo audio). */
  duracion?: number;
  texto: string;
  area: Dominio;
  /** Propuesta del proveedor simulado, para comparar con la decisión final de la educadora. */
  sugerencia: { texto: string; area: Dominio | null };
}

export const DOMINIOS: Dominio[] = [
  'lenguaje_comunicacion',
  'motor_fino',
  'motor_grueso',
  'socioemocional',
  'cognitivo',
];

export const ETIQUETA_DOMINIO: Record<Dominio, string> = {
  cognitivo: 'Cognitivo',
  lenguaje_comunicacion: 'Lenguaje',
  motor_fino: 'Motor fino',
  motor_grueso: 'Motor grueso',
  socioemocional: 'Socioemocional',
};

export const COLOR_DOMINIO: Record<Dominio, { fondo: string; tinta: string }> = {
  cognitivo: { fondo: '#F1E6FA', tinta: '#4f2a73' },
  lenguaje_comunicacion: { fondo: '#E3ECFA', tinta: '#1d3f73' },
  motor_fino: { fondo: '#FFF1DB', tinta: '#7a4300' },
  motor_grueso: { fondo: '#E6F4E7', tinta: '#005312' },
  socioemocional: { fondo: '#FDE8EA', tinta: '#92001c' },
};

/** Sala de la tía que usa la app en el celular. */
export const SALA = 'Sala Cuna Mayor';

export const SALAS = [SALA, 'Sala Cuna Menor', 'Medio Menor'];

type NinoBase = Omit<Nino, 'sala'>;

const enSala = (sala: string, ninos: NinoBase[]): Nino[] => ninos.map((n) => ({ ...n, sala }));

export const NINOS: Nino[] = [
  ...enSala(SALA, [
    { id: 'demo-1', nombre: 'Martina', iniciales: 'MP', fondo: '#FDE8EA', tinta: '#92001c' },
    { id: 'demo-2', nombre: 'Benjamín', iniciales: 'BS', fondo: '#FDF4DC', tinta: '#594400' },
    { id: 'demo-3', nombre: 'Sofía', iniciales: 'SR', fondo: '#E6F4E7', tinta: '#005312' },
    { id: 'demo-4', nombre: 'Tomás', iniciales: 'TA', fondo: '#E3ECFA', tinta: '#1d3f73' },
    { id: 'demo-5', nombre: 'Agustina', iniciales: 'AL', fondo: '#F1E6FA', tinta: '#4f2a73' },
    { id: 'demo-6', nombre: 'Mateo', iniciales: 'MV', fondo: '#FFF1DB', tinta: '#7a4300' },
    { id: 'demo-7', nombre: 'Emilia', iniciales: 'EC', fondo: '#E0F3F1', tinta: '#0f5049' },
    { id: 'demo-8', nombre: 'Lucas', iniciales: 'LG', fondo: '#FCE4F0', tinta: '#7a1f4f' },
    { id: 'demo-9', nombre: 'Isidora', iniciales: 'IR', fondo: '#EFE4D8', tinta: '#3A2414' },
  ]),
  ...enSala('Sala Cuna Menor', [
    { id: 'demo-10', nombre: 'Josefa', iniciales: 'JF', fondo: '#F1E6FA', tinta: '#4f2a73' },
    { id: 'demo-11', nombre: 'Joaquín', iniciales: 'JR', fondo: '#E0F3F1', tinta: '#0f5049' },
  ]),
  ...enSala('Medio Menor', [
    { id: 'demo-12', nombre: 'Vicente', iniciales: 'VP', fondo: '#E0F3F1', tinta: '#0f5049' },
    { id: 'demo-13', nombre: 'Florencia', iniciales: 'FS', fondo: '#FCE4F0', tinta: '#7a1f4f' },
  ]),
];

export const NINOS_DE_MI_SALA = NINOS.filter((n) => n.sala === SALA);

interface Lectura {
  texto: string;
  area: Dominio;
}

/** Respuestas fijas que simulan la transcripción del audio y la lectura del post-it. */
const LECTURAS: Record<'audio' | 'foto', Lectura[]> = {
  audio: [
    {
      texto: 'Buscó el autito que tapé con el pañal y dijo “ba-ba-ba” mirando a su compañero.',
      area: 'lenguaje_comunicacion',
    },
    {
      texto: 'Se puso los zapatos sola después de la siesta y me los mostró contenta.',
      area: 'socioemocional',
    },
  ],
  foto: [
    {
      texto: 'Apiló 4 bloques de espuma solo y aplaudió cuando no se cayeron.',
      area: 'motor_fino',
    },
    { texto: 'Gateó hasta el sonajero y lo agitó para que sonara.', area: 'motor_grueso' },
  ],
};

export function simularLectura(formato: 'audio' | 'foto', semilla: number): Lectura {
  const lista = LECTURAS[formato];
  return lista[semilla % lista.length] as Lectura;
}

const PALABRAS_CLAVE: Record<Dominio, string[]> = {
  lenguaje_comunicacion: ['dijo', 'palabra', 'cancion', 'hablo', 'balbuce', 'senalo', 'pidio'],
  motor_fino: ['bloque', 'apilo', 'pinza', 'lapiz', 'encaj', 'cuchara', 'boton'],
  motor_grueso: ['gate', 'camin', 'corri', 'rampa', 'salt', 'trep', 'pelota'],
  socioemocional: ['content', 'compart', 'abraz', 'llor', 'sonri', 'companer', 'consol'],
  cognitivo: ['busco', 'escond', 'encontr', 'orden', 'clasific', 'color', 'forma'],
};

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * Sugerencia de área por palabras clave para notas escritas. Simula al proveedor de IA:
 * no clasifica ni diagnostica; la educadora siempre confirma o cambia el área.
 */
export function sugerirArea(texto: string): Dominio | null {
  const limpio = normalizar(texto);
  let mejor: Dominio | null = null;
  let mejorPuntaje = 0;
  for (const dominio of DOMINIOS) {
    const puntaje = PALABRAS_CLAVE[dominio].filter((p) => limpio.includes(p)).length;
    if (puntaje > mejorPuntaje) {
      mejor = dominio;
      mejorPuntaje = puntaje;
    }
  }
  return mejor;
}

export function nuevoId(): string {
  return `nota-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function haceMinutos(ahora: Date, minutos: number): Date {
  return new Date(ahora.getTime() - minutos * 60_000);
}

function diasAtras(ahora: Date, dias: number, hora: number, minuto: number): Date {
  const fecha = new Date(ahora);
  fecha.setDate(fecha.getDate() - dias);
  fecha.setHours(hora, minuto, 0, 0);
  return fecha;
}

export function notasDeEjemplo(ahora: Date): Nota[] {
  const ejemplos: Omit<Nota, 'id' | 'sugerencia'>[] = [
    {
      ninoId: 'demo-3',
      educadora: 'Mercedes',
      formato: 'audio',
      creada: haceMinutos(ahora, 25),
      duracion: 22,
      texto: 'Se puso los zapatos sola después de la siesta y me los mostró contenta.',
      area: 'socioemocional',
    },
    {
      ninoId: 'demo-4',
      educadora: 'Mercedes',
      formato: 'foto',
      creada: haceMinutos(ahora, 60),
      texto: 'Gateó hasta el sonajero y lo agitó para que sonara.',
      area: 'motor_grueso',
    },
    {
      ninoId: 'demo-10',
      educadora: 'Andrea',
      formato: 'audio',
      creada: haceMinutos(ahora, 90),
      duracion: 15,
      texto: 'Giró hacia mí cuando la llamé por su nombre durante la colación.',
      area: 'socioemocional',
    },
    {
      ninoId: 'demo-1',
      educadora: 'Mercedes',
      formato: 'texto',
      creada: diasAtras(ahora, 1, 15, 10),
      texto: 'Señaló el gato del cuento cuando le pregunté dónde estaba.',
      area: 'lenguaje_comunicacion',
    },
    {
      ninoId: 'demo-12',
      educadora: 'Romina',
      formato: 'texto',
      creada: diasAtras(ahora, 1, 16, 30),
      texto: 'Subió y bajó la rampa del patio sin ayuda, varias veces seguidas.',
      area: 'motor_grueso',
    },
    {
      ninoId: 'demo-11',
      educadora: 'Andrea',
      formato: 'texto',
      creada: diasAtras(ahora, 2, 12, 5),
      texto: 'Tomó la cuchara y se llevó la papilla a la boca casi sin derramar.',
      area: 'motor_fino',
    },
    {
      ninoId: 'demo-2',
      educadora: 'Mercedes',
      formato: 'foto',
      creada: diasAtras(ahora, 3, 10, 40),
      texto: 'Encajó la pieza redonda en el tablero después de varios intentos.',
      area: 'cognitivo',
    },
    {
      ninoId: 'demo-13',
      educadora: 'Romina',
      formato: 'foto',
      creada: diasAtras(ahora, 4, 11, 20),
      texto: 'Ordenó los animales por tamaño y nombró al más grande.',
      area: 'cognitivo',
    },
    {
      ninoId: 'demo-5',
      educadora: 'Mercedes',
      formato: 'audio',
      creada: diasAtras(ahora, 9, 9, 15),
      duracion: 18,
      texto: 'Dijo “agua” y apuntó a la botella cuando tuvo sed.',
      area: 'lenguaje_comunicacion',
    },
  ];
  return ejemplos.map((n, i) => ({
    ...n,
    id: `ejemplo-${i + 1}`,
    sugerencia: { texto: n.texto, area: n.area },
  }));
}
