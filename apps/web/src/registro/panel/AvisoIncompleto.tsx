import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';

/**
 * Aviso de datos incompletos: alguna consulta falló, las métricas afectadas son parciales y la
 * descarga del CSV queda bloqueada hasta que se reintente con éxito.
 */
export function AvisoIncompleto({
  faltan,
  notas = false,
  onReintentar,
}: {
  /** Niños o niñas cuya trayectoria no se cargó. */
  faltan: number;
  /** Tampoco se cargaron las notas confirmadas. */
  notas?: boolean;
  onReintentar: () => void;
}) {
  const partes = [
    faltan > 0 && `los registros de ${faltan} ${faltan === 1 ? 'niño o niña' : 'niños o niñas'}`,
    notas && 'las notas de la semana',
  ].filter(Boolean);
  return (
    <Alert
      severity="warning"
      sx={{ mt: 2.5, borderRadius: '14px' }}
      action={
        <Button color="inherit" variant="text" onClick={onReintentar} sx={{ minHeight: 40 }}>
          Reintentar
        </Button>
      }
    >
      Datos incompletos: no se pudieron cargar {partes.join(' ni ')}. Las métricas marcadas como
      parciales no los incluyen, el rezago no se calcula en esas salas y la descarga del CSV queda
      bloqueada hasta reintentar.
    </Alert>
  );
}
