## ADDED Requirements

### Requirement: Monorepo multiplataforma
El repositorio SHALL organizarse como monorepo pnpm con Node 24 LTS y una versión de pnpm fijadas. Sus comandos SHALL ejecutarse como scripts de `package.json` que funcionen en Windows, macOS y Linux sin depender de bash ni de PowerShell.

#### Scenario: Preparación en cualquier sistema
- **WHEN** una persona con Node 24, Corepack y Docker clona el repositorio y ejecuta el comando de preparación en Windows, macOS o Linux
- **THEN** se instalan las dependencias de todos los paquetes sin pasos específicos del sistema operativo

#### Scenario: Fin de línea consistente
- **WHEN** se hace checkout del repositorio en Windows
- **THEN** los archivos de texto mantienen fin de línea LF

### Requirement: Servicios locales
El repositorio SHALL proveer PostgreSQL 17 mediante Docker Compose, y la API SHALL conectarse a él mediante Prisma con una migración inicial aplicable.

#### Scenario: Base de datos local
- **WHEN** se inicia Docker Compose y se aplican las migraciones
- **THEN** PostgreSQL acepta conexiones y Prisma confirma que la migración inicial está aplicada

### Requirement: Esqueletos ejecutables
Cada paquete (`apps/web`, `apps/api`, `apps/pipeline`, `packages/shared`, `infra`) SHALL compilar, y el comando de desarrollo SHALL levantar la web y la API en paralelo.

#### Scenario: Desarrollo local
- **WHEN** se ejecuta el comando de desarrollo con la base local iniciada
- **THEN** la web queda disponible en el puerto 5173, la API en el 3000, y la web muestra el estado de salud obtenido de la API

#### Scenario: Salud de la API
- **WHEN** se consulta `GET /health`
- **THEN** la API responde con su estado y el de la conexión a la base de datos

#### Scenario: Handler de pipeline
- **WHEN** se ejecutan las pruebas de `apps/pipeline`
- **THEN** un handler de ejemplo se invoca localmente y devuelve una respuesta válida según su esquema

### Requirement: Contrato de API compartido
El contrato SHALL definirse con esquemas zod en `packages/shared`. La API SHALL validar con ellos y publicar OpenAPI en `/docs`, y el cliente web SHALL generarse con orval desde el documento exportado.

#### Scenario: Regeneración del contrato
- **WHEN** se modifica el esquema de salud y se ejecuta el comando de contrato
- **THEN** se actualizan `openapi.json` y el cliente generado, y el chequeo de tipos de la web refleja el cambio

### Requirement: Configuración validada
La API y el pipeline SHALL validar sus variables de entorno con zod al arrancar y fallar con un mensaje claro si alguna falta o es inválida. El repositorio SHALL incluir `.env.example` sin valores reales y SHALL ignorar los archivos `.env`.

#### Scenario: Variable faltante
- **WHEN** la API arranca sin `DATABASE_URL`
- **THEN** termina de inmediato indicando la variable faltante

### Requirement: Calidad automatizada
El repositorio SHALL ofrecer comandos de lint, chequeo de tipos, pruebas y build para todos los paquetes, y una integración continua que los ejecute en cada pull request.

#### Scenario: Pull request
- **WHEN** se abre un pull request
- **THEN** la integración continua ejecuta lint, tipos, pruebas y build, e informa si falla alguno

### Requirement: Infraestructura sintetizable sin desplegar
`infra` SHALL contener una aplicación CDK en TypeScript para `us-east-1` que sintetice sin errores y sin credenciales, y SHALL NOT desplegar recursos como parte de este cambio.

#### Scenario: Síntesis
- **WHEN** se ejecuta el comando de síntesis de infraestructura
- **THEN** se genera la plantilla de CloudFormation sin crear recursos en AWS

### Requirement: Imagen de contenedor de la API
La API SHALL tener un Dockerfile que produzca una imagen ejecutable con Node 24, configurable solo por variables de entorno.

#### Scenario: Ejecución en contenedor
- **WHEN** se construye la imagen y se ejecuta con `DATABASE_URL` apuntando al PostgreSQL local
- **THEN** `GET /health` responde correctamente desde el contenedor
