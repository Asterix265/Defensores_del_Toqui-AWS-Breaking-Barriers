/**
 * Para las pruebas contra Bedrock real: si la llamada falla, relanza un error nuevo solo con el
 * nombre y el mensaje. El error del SDK trae la solicitud firmada en `$response` (con el token
 * de sesión y la firma), y vitest la imprimiría completa en la consola al fallar la prueba.
 */
export async function sinCredenciales<T>(promesa: Promise<T>): Promise<T> {
  try {
    return await promesa;
  } catch (error) {
    const { name, message } =
      error instanceof Error ? error : { name: 'Error', message: String(error) };
    const limpio = new Error(message);
    limpio.name = name;
    throw limpio;
  }
}
