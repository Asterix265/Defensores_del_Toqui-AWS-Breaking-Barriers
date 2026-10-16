## Purpose

Publicar la web automáticamente desde la rama principal del repositorio y servirla con la API en el mismo dominio HTTPS, sin pasos manuales del equipo.

## ADDED Requirements

### Requirement: Publicación automática desde main
Cada push a `main` SHALL compilar y publicar la web sin pasos manuales. Una compilación fallida SHALL dejar publicada la versión anterior.

#### Scenario: Merge a main
- **WHEN** se mergea un PR a `main` que cambia la web
- **THEN** la nueva versión queda publicada en la URL de producción sin ejecutar comandos locales

#### Scenario: Compilación fallida
- **WHEN** la compilación de la web falla
- **THEN** la URL sigue sirviendo la versión anterior y el fallo aparece en el historial de compilaciones

### Requirement: API en el mismo dominio
La web SHALL llegar a la API mediante rutas `/api/*` del mismo dominio, y las peticiones SHALL conservar la cabecera `Authorization`.

#### Scenario: Llamada autenticada
- **WHEN** la web publicada llama a `/api/me` con un token válido
- **THEN** recibe la respuesta de la API sin errores de CORS

#### Scenario: Salud por el dominio de la web
- **WHEN** se consulta `/api/health` en el dominio de la web
- **THEN** responde la API con el estado de sus dependencias

### Requirement: Rutas de la aplicación
Las rutas internas de la web SHALL servir la aplicación al abrirlas directamente o al recargar, sin afectar las rutas `/api/*` ni los archivos estáticos.

#### Scenario: Recarga en una ruta interna
- **WHEN** se recarga la página en una ruta interna de la web
- **THEN** se carga la aplicación y no se obtiene un 404

### Requirement: Subida de archivos desde la web publicada
El almacenamiento de capturas SHALL aceptar subidas firmadas desde el dominio de la web publicada y rechazar otros orígenes de navegador.

#### Scenario: Subida desde producción
- **WHEN** la web publicada sube un audio con la URL firmada
- **THEN** la subida termina sin error de CORS
