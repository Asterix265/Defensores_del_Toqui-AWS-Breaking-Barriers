/**
 * Texto anonimizado por el Guardrail de Bedrock (marcadores de `infra/lib/componentes.ts`) frente al
 * texto original de la nota. Claude solo recibe el anonimizado; la educadora ve el original
 * (corregir-hallazgos-demo).
 */
const MARCADOR = /(\{(?:NAME|EMAIL|PHONE|ADDRESS)\})/;

interface Tramo {
  marcador: boolean;
  anonimizado: [number, number];
  original: [number, number];
}

/**
 * Empareja el texto anonimizado con el original: los tramos literales coinciden y cada marcador
 * cubre el dato que reemplazó. Null si los textos no corresponden.
 */
function alinear(anonimizado: string, original: string): Tramo[] | null {
  const partes = anonimizado.split(MARCADOR);
  const tramos: Tramo[] = [];
  let a = 0;
  let o = 0;
  for (let i = 0; i < partes.length; i += 2) {
    const literal = partes[i]!;
    let inicio: number;
    if (i === 0) {
      if (!original.startsWith(literal)) return null;
      inicio = 0;
    } else {
      // Después de un marcador: el dato reemplazado ocupa al menos un carácter.
      const ultimo = i === partes.length - 1;
      inicio = ultimo ? original.length - literal.length : original.indexOf(literal, o + 1);
      if (inicio < o + 1 || !original.startsWith(literal, inicio)) return null;
      const marcador = partes[i - 1]!;
      tramos.push({ marcador: true, anonimizado: [a, a + marcador.length], original: [o, inicio] });
      a += marcador.length;
    }
    tramos.push({
      marcador: false,
      anonimizado: [a, a + literal.length],
      original: [inicio, inicio + literal.length],
    });
    a += literal.length;
    o = inicio + literal.length;
  }
  return o === original.length ? tramos : null;
}

/**
 * Posición en el original de una posición del anonimizado. Dentro de un marcador, el inicio de una
 * cita toma el dato desde su comienzo y el fin, hasta su final.
 */
function mapear(tramos: Tramo[], posicion: number, esFin: boolean): number {
  for (const {
    marcador,
    anonimizado: [a0, a1],
    original: [o0, o1],
  } of tramos) {
    if (marcador) {
      if (posicion > a0 && posicion < a1) return esFin ? o1 : o0;
    } else if (posicion >= a0 && posicion <= a1) {
      return o0 + (posicion - a0);
    }
  }
  return posicion;
}

/**
 * Fragmento del texto original que corresponde a una cita del anonimizado: «{NAME} apiló» →
 * «Mateo apiló». Null si la cita no está en el anonimizado o los textos no corresponden.
 */
export function citaEnOriginal(cita: string, anonimizado: string, original: string): string | null {
  const inicio = anonimizado.indexOf(cita);
  if (inicio === -1) return null;
  if (anonimizado === original) return cita;
  const tramos = alinear(anonimizado, original);
  if (!tramos) return null;
  const desde = mapear(tramos, inicio, false);
  const hasta = mapear(tramos, inicio + cita.length, true);
  return original.slice(desde, hasta);
}
