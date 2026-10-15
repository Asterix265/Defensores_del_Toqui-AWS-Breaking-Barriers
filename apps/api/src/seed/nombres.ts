// Nombres sintéticos y deterministas para el dataset E-1, que solo trae identificadores.
// Son nombres comunes elegidos por el equipo; no corresponden a personas reales.

const FEMENINOS = [
  'Martina',
  'Sofía',
  'Agustina',
  'Emilia',
  'Isidora',
  'Josefa',
  'Florencia',
  'Antonella',
  'Catalina',
  'Trinidad',
  'Amanda',
  'Maite',
  'Julieta',
  'Valentina',
  'Fernanda',
  'Constanza',
];
const MASCULINOS = [
  'Benjamín',
  'Tomás',
  'Mateo',
  'Lucas',
  'Joaquín',
  'Vicente',
  'Agustín',
  'Maximiliano',
  'Gaspar',
  'Martín',
  'Cristóbal',
  'Facundo',
  'Santiago',
  'Alonso',
  'Bastián',
  'Lautaro',
];
const NEUTROS = ['Alex', 'Ariel', 'Dani', 'Noa', 'René', 'Sasha', 'Andrea', 'Cruz'];
const APELLIDOS = [
  'Rojas',
  'Muñoz',
  'Díaz',
  'Pérez',
  'Soto',
  'Contreras',
  'Silva',
  'Martínez',
  'Sepúlveda',
  'Morales',
  'Rodríguez',
  'López',
  'Fuentes',
  'Hernández',
  'Torres',
  'Araya',
  'Flores',
  'Espinoza',
  'Valenzuela',
  'Castillo',
  'Tapia',
  'Reyes',
  'Gutiérrez',
  'Castro',
  'Pizarro',
];

function numero(id: string): number {
  return Number(id.replace(/\D/g, '')) || 0;
}

/** Nombre según el sexo registrado (`x` y `no_informado` reciben nombres neutros). */
export function nombreSintetico(
  id: string,
  sexo: 'f' | 'm' | 'x' | 'no_informado',
): { nombres: string; apellidos: string } {
  const n = numero(id);
  const lista = sexo === 'f' ? FEMENINOS : sexo === 'm' ? MASCULINOS : NEUTROS;
  const primero = APELLIDOS[(n * 7) % APELLIDOS.length]!;
  const segundo = APELLIDOS[(n * 11 + 3) % APELLIDOS.length]!;
  return { nombres: lista[n % lista.length]!, apellidos: `${primero} ${segundo}` };
}
