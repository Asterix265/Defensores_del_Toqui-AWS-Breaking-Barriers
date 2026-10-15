import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Sin `globals` en Vitest, Testing Library no desmonta solo entre pruebas.
afterEach(cleanup);

// jsdom no implementa las URLs de objetos que usa la vista previa del audio y la foto.
URL.createObjectURL ??= () => 'blob:prueba';
URL.revokeObjectURL ??= () => undefined;
