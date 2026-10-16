import { useCallback, useRef, useState } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

/**
 * Qué se pierde al salir de una nota (diseño D3 de `corregir-interfaz-web`): nada, lo capturado
 * (grabación, texto o niño o niña por elegir) o nada pero la nota queda «Sin revisar» en la API.
 */
export type EnCurso = 'no' | 'captura' | 'revision';

const TEXTOS = {
  captura: {
    titulo: '¿Salir sin guardar?',
    detalle: 'La nota que estás haciendo se perderá.',
    seguir: 'Seguir con la nota',
    salir: 'Salir',
  },
  revision: {
    titulo: '¿Dejar la revisión para después?',
    detalle: 'La nota queda en «Mis notas» como «Sin revisar» y puedes terminarla después.',
    seguir: 'Seguir revisando',
    salir: 'Dejar para después',
  },
} as const;

/**
 * Confirmación para salir de una nota. `marcar` lo llama la nota con lo que hay en curso;
 * `pedir(salir)` sale de inmediato si no hay nada o muestra el diálogo. `hayEnCurso` sirve para
 * decidir si el botón Atrás debe esperar la confirmación.
 */
export function useSalidaNota() {
  const enCurso = useRef<EnCurso>('no');
  const [pendiente, setPendiente] = useState<{
    tipo: Exclude<EnCurso, 'no'>;
    salir: () => void;
  } | null>(null);

  const marcar = useCallback((estado: EnCurso) => {
    enCurso.current = estado;
  }, []);
  const hayEnCurso = useCallback(() => enCurso.current !== 'no', []);
  const pedir = useCallback((salir: () => void) => {
    const tipo = enCurso.current;
    if (tipo === 'no') salir();
    else setPendiente({ tipo, salir });
  }, []);

  const textos = pendiente ? TEXTOS[pendiente.tipo] : TEXTOS.captura;
  const dialogo = (
    <Dialog
      open={pendiente !== null}
      onClose={() => setPendiente(null)}
      aria-labelledby="titulo-salida-nota"
      aria-describedby="detalle-salida-nota"
    >
      <DialogTitle id="titulo-salida-nota" sx={{ fontWeight: 800 }}>
        {textos.titulo}
      </DialogTitle>
      <DialogContent>
        <DialogContentText id="detalle-salida-nota">{textos.detalle}</DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button variant="text" onClick={() => setPendiente(null)}>
          {textos.seguir}
        </Button>
        <Button
          variant="contained"
          onClick={() => {
            const salir = pendiente?.salir;
            enCurso.current = 'no';
            setPendiente(null);
            salir?.();
          }}
        >
          {textos.salir}
        </Button>
      </DialogActions>
    </Dialog>
  );

  return { marcar, hayEnCurso, pedir, dialogo };
}
