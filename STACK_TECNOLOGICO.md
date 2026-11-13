# Stack Tecnologico - Clinica Horizonte

## Estado y alcance

Esta arquitectura parte del dossier de planificacion y ahora tiene una base funcional en `clinica-horizonte-api/` y `clinica-horizonte-app/`. Implementa los flujos principales para desarrollo local, pero no esta certificada para produccion ni para datos clinicos reales. La compilacion nativa de Tauri requiere Rust, que no estaba instalado en el entorno de construccion.

La solucion se divide en una aplicacion de escritorio para puestos administrativos y clinicos, una API central y servicios operacionales. La aplicacion de escritorio permite implementar el modo de contingencia con almacenamiento local cifrado y acceso a la llave del sistema operativo.

## Tecnologias

| Capa | Tecnologia propuesta | Responsabilidad |
| --- | --- | --- |
| Aplicacion | Tauri 2, React, TypeScript y Vite | Cliente de escritorio multiplataforma; interfaz y actualizaciones firmadas. |
| Estado y API del cliente | TanStack Query y TypeScript | Consultas y cache en memoria; tipos locales por ahora. La generacion del cliente desde OpenAPI queda pendiente. |
| Cache de contingencia | SQLite con SQLCipher, clave en el almacen seguro del sistema operativo | Copia cifrada y de solo lectura de la agenda diaria; sin fichas ni diagnosticos. |
| API | Node.js LTS, NestJS y TypeScript | API REST, validacion, reglas de negocio, autorizacion y auditoria. |
| Contrato | OpenAPI 3 y `@nestjs/swagger` | Contrato versionado y generacion del cliente de la aplicacion. |
| Identidad | Keycloak con OpenID Connect, MFA TOTP y politicas de sesion | Identidades individuales, MFA obligatoria, roles y expiracion por inactividad. |
| Persistencia | PostgreSQL y Prisma | Datos transaccionales, restricciones, migraciones y acceso tipado. |
| Auditoria | Outbox PostgreSQL; reenvio Syslog/TLS a SIEM externo y almacenamiento WORM pendientes | Trazabilidad local inicial; no afirmar inmutabilidad hasta desplegar el destino externo. |
| Contenedores | Docker Compose para desarrollo y pruebas; contenedores en Linux soportado para despliegue | Entornos reproducibles y aislamiento de servicios. |
| Observabilidad | OpenTelemetry, Prometheus y Grafana; eventos de seguridad al SIEM | Metricas, trazas, salud de servicios y alertas operacionales. |
| Pruebas | Jest/Supertest y Testcontainers en API; Vitest/Testing Library y Playwright en app | Pruebas unitarias, integracion y flujos criticos de usuario. |

Las versiones concretas deben fijarse al iniciar el desarrollo y actualizarse mediante una politica de parches. No se recomienda agregar Kubernetes hasta que la carga y los requisitos de disponibilidad lo justifiquen.

## Distribucion del repositorio

```text
clinica-horizonte v3/
  STACK_TECNOLOGICO.md
  clinica-horizonte-api/
    src/
      auth/             # OIDC, identidad y traduccion de roles
      users/            # Usuarios y asignacion de roles
      patients/         # Identificacion y datos de contacto
      appointments/     # Agenda y asignaciones
      medical-records/  # Fichas y controles de acceso clinico
      audit/            # Outbox, eventos y consultas autorizadas
      common/            # Guards, validacion, filtros y manejo de errores
    prisma/              # Schema y migraciones
    test/                # Pruebas de integracion
    openapi.yaml          # Contrato publicado/versionado
  clinica-horizonte-app/
    src/                  # UI React y cliente OpenAPI generado
    src-tauri/            # Codigo Rust, capacidades nativas y almacen seguro
    tests/                # Pruebas de UI y flujos E2E
```

La estructura es orientativa; al crear los proyectos se debe evitar duplicar carpetas. La API expone Swagger y el documento JSON en `/docs-json`. El cliente actual consume la API mediante tipos TypeScript locales; la generacion automatica desde OpenAPI aun no esta conectada al build.

## Seguridad y reglas de arquitectura

- **Autenticacion:** OIDC con Authorization Code + PKCE y MFA TOTP obligatoria en Keycloak. La politica de sesion debe cerrar o bloquear tras 15 minutos de inactividad. No guardar contrasenas ni secretos MFA en PostgreSQL.
- **Autorizacion:** Roles de administrador TI, personal administrativo, profesional y auditor. Aplicar permisos en guards y tambien en servicios por recurso: el profesional solo consulta fichas con asignacion vigente; el personal administrativo nunca recibe campos clinicos; TI no accede a fichas.
- **Break-glass:** Exigir motivo, registrar evento prioritario y notificar al auditor. Limitar y alertar sobre volumen y frecuencia; no convertir la excepcion en acceso permanente.
- **Datos sensibles:** TLS en transito y cifrado de volumen/base de datos en reposo. Cifrar RUT y contenido clinico en la aplicacion usando claves gestionadas fuera de la base de datos, con versionado y rotacion. No registrar contenido clinico, tokens ni secretos en logs.
- **Auditoria:** Persistir el evento en un outbox dentro de la transaccion de negocio y entregarlo de forma asincrona al SIEM. La cuenta de aplicacion no debe poder editar ni borrar auditoria; los eventos exportados se conservan en almacenamiento inmutable. Registrar consultas clinicas ademas de cambios.
- **Agenda offline:** Descargar solo la agenda minima del dia, cifrada en SQLite, con expiracion y borrado remoto/logico cuando corresponda. En contingencia, la vista es de solo lectura y muestra claramente la hora de ultima sincronizacion. No guardar fichas medicas localmente.
- **Respaldos:** Estrategia 3-2-1 cifrada, con copia externa fuera de linea o con retencion WORM y pruebas periodicas de restauracion. Las copias no comparten credenciales ni permisos de escritura con produccion.
- **Red y secretos:** TLS interno/externo, servicios y bases de datos no expuestos directamente a Internet, secretos fuera del repositorio y de las imagenes, actualizaciones de sistema y dependencias con proceso de parcheo.

## Modelo de datos y decisiones de dominio

Entidades principales: `Role`, `User` (referencia de identidad), `Patient`, `Appointment`, `MedicalRecord`, `AuditEvent` y `EmergencyAccessEvent`. Usar UUID, claves foraneas, restricciones de integridad e indices por paciente, profesional, estado y fecha. Evitar duplicar credenciales del proveedor de identidad en la base clinica.

Los permisos se validan en cada consulta y mutacion, no solo ocultando controles en la interfaz. La consulta de agenda debe devolver DTOs diferentes para administracion y profesionales, para impedir que datos clinicos lleguen accidentalmente al cliente.

## Despliegue y calidad

- Desarrollo: servicios de API y PostgreSQL en Docker Compose; Keycloak y SIEM pueden usarse como servicios de prueba aislados.
- Produccion: Linux con soporte vigente, TLS terminado en proxy inverso, PostgreSQL en red privada, secretos gestionados externamente y respaldos externos inmutables. Mantener ambientes separados y cuentas de servicio de minimo privilegio.
- CI: lint, formato, chequeo de tipos, pruebas, validacion/generacion OpenAPI, escaneo de dependencias e imagenes y build reproducible. Bloquear releases si falla una prueba de permisos o migracion.
- Pruebas de aceptacion obligatorias: MFA y sesion inactiva; matriz CRUD por rol; aislamiento de fichas; break-glass y alerta; auditoria ante exito/error; cache offline cifrada y expirada; restauracion de respaldo.

## Punto por resolver del dossier

HU-03 indica que la agenda pasa a modo de solo lectura sin conectividad, pero tambien pide sincronizar el estado de las citas al reconectar. Son comportamientos incompatibles si el usuario no puede cambiar estados offline. Esta propuesta conserva el requisito mas restrictivo: modo offline de solo lectura y reconciliacion de la copia local al recuperar conexion, sin mutaciones offline. Si se necesitan confirmaciones sin red, habra que definir una cola de comandos, reglas de conflicto, idempotencia y auditoria antes de implementarla.

## Orden recomendado de construccion

1. Crear proyectos API y app, fijar versiones y pipeline de CI.
2. Definir OpenAPI, roles, permisos y migraciones iniciales.
3. Implementar identidad/MFA, autorizacion por recurso y pruebas negativas.
4. Implementar agenda y datos clinicos con cifrado y auditoria externa.
5. Implementar modo contingencia local, expiracion y pruebas de sincronizacion.
6. Preparar despliegue, respaldos inmutables, monitoreo y simulacros de restauracion/incidentes.