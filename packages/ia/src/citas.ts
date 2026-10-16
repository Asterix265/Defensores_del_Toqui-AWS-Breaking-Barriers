import { patronFlexible, ubicarCita } from './validacion.js';

/** Marcadores que pone el Guardrail al anonimizar: `{NAME}`, `{EMAIL}`, `{rut-chileno}`… */
const MARCADOR = /\{[A-Za-z0-9_-]+\}/;
const MARCADORES = new RegExp(MARCADOR.source, 'g');

/** La cita como expresión regular: literales escapados y cada marcador como `.+?`. */
function cuerpo(cita: string): string {
  return cita.split(MARCADORES).map(patronFlexible).join('.+?');
}

/**
 * Anclas tomadas del texto anonimizado alrededor de la cita: el literal previo (o el inicio)
 * y el siguiente (o el final). Evitan que un marcador en un extremo capture de más o de menos.
 */
function anclas(textoAnonimo: string, inicio: number, fin: number): [string, string] {
  const previos = textoAnonimo.slice(0, inicio).split(MARCADORES);
  const siguientes = textoAnonimo.slice(fin).split(MARCADORES);
  const antes = patronFlexible(previos.at(-1) ?? '');
  const despues = patronFlexible(siguientes[0] ?? '');
  return [
    previos.length === 1 ? `^${antes}` : antes,
    siguientes.length === 1 ? `${despues}$` : despues,
  ];
}

/**
 * Lleva una cita tomada del texto anonimizado al texto original y devuelve el fragmento tal
 * cual está en el original, o `null` si no se puede ubicar.
 */
export function mapearCita(
  cita: string,
  textoAnonimo: string,
  textoOriginal: string,
): string | null {
  if (textoOriginal.includes(cita) && cita) return cita;
  if (!MARCADOR.test(cita)) return ubicarCita(cita, textoOriginal);

  const enAnonimo = ubicarCita(cita, textoAnonimo);
  const base = enAnonimo ?? cita;
  const patron = cuerpo(base);
  const candidatos: RegExp[] = [];
  if (enAnonimo !== null) {
    const inicio = textoAnonimo.indexOf(enAnonimo);
    const [antes, despues] = anclas(textoAnonimo, inicio, inicio + enAnonimo.length);
    candidatos.push(new RegExp(`(?<=${antes})${patron}(?=${despues})`, 'iu'));
  }
  candidatos.push(new RegExp(patron, 'iu'));

  for (const regex of candidatos) {
    const fragmento = regex.exec(textoOriginal)?.[0];
    if (fragmento && textoOriginal.includes(fragmento)) return fragmento;
  }
  return null;
}
