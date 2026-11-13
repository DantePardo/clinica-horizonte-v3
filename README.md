# Clínica Horizonte

Aplicación de escritorio Tauri/React, API NestJS y PostgreSQL. Este repositorio contiene una base funcional para desarrollo; no está certificada ni lista para almacenar datos clínicos reales.

## Requisitos de desarrollo

- Node.js 22 LTS y npm
- Docker Desktop
- Rust estable, Visual Studio C++ Build Tools y WebView2 para compilar Tauri en Windows

## Inicio local

1. En esta carpeta, ejecuta `.\tools\init-local.ps1` en PowerShell. Crea configuraciones ignoradas por Git y dos llaves aleatorias distintas para el cifrado de datos; no imprime ni reemplaza secretos existentes.
2. Inicia PostgreSQL y Keycloak: `docker compose up -d`.
3. En Keycloak (`http://localhost:8080`), usa el usuario administrador definido en `.env`. El realm `clinica-horizonte` se importa al iniciar. Crea usuarios, asigna un rol de realm y verifica que el usuario complete la configuración TOTP obligatoria.
4. Instala y ejecuta la API:

   ```powershell
   cd clinica-horizonte-api
   npm ci
   npm run prisma:generate
   npm run prisma:migrate -- --name init
   npm run start:dev
   ```

5. En otra terminal, inicia la interfaz web: `cd clinica-horizonte-app; npm ci; npm run dev`. Abre `http://localhost:1420`. Para escritorio, instala Rust y ejecuta `npm run tauri dev` desde la carpeta de la aplicación.

Swagger está disponible en `http://localhost:3000/docs`; el estado de API en `/api/health`.

Las contraseñas del `.env.example` raíz son solo de desarrollo y quedan ligadas al volumen PostgreSQL ya inicializado. No expongas estos servicios fuera de loopback ni uses datos reales; cambia las credenciales antes de cualquier entorno compartido.

## Funciones implementadas

- Inicio OIDC con PKCE, roles de realm y cierre local por inactividad de 15 minutos.
- Agenda diaria, creación/confirmación/cancelación de citas y filtrado de agenda profesional.
- Alta y búsqueda básica de pacientes; RUT y contacto cifrados con AES-256-GCM y clave HMAC separada para búsqueda de duplicados.
- Fichas clínicas cifradas, acceso médico asociado a cita activa y apertura de emergencia justificada.
- Outbox de auditoría para solicitudes autenticadas.
- En Tauri, cache de agenda del día en SQLite/SQLCipher con llave del almacén seguro del sistema operativo; al fallar API, queda disponible solo lectura.

## Límites operacionales pendientes

La configuración Docker y las contraseñas de ejemplo son solo para desarrollo. El outbox aún necesita un consumidor que lo entregue a un SIEM externo/WORM y notifique al auditor. No se debe declarar inmutabilidad solo por guardar eventos en PostgreSQL. También faltan una política real de llaves/KMS, despliegue TLS, respaldos 3-2-1 con pruebas de restauración y revisión de seguridad independiente. El modo offline no sincroniza mutaciones, de acuerdo con la decisión conservadora del dossier.
