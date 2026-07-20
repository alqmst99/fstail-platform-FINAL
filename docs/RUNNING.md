# Guía para ejecutar el proyecto (FSTail)

Esta guía explica cómo poner en marcha la base de datos, generar el cliente Prisma, aplicar migraciones, sembrar datos y levantar los servicios `api`, `web` y `desktop` en desarrollo.

Requisitos
- Node.js >= 20
- npm >= 10
- Git
- Docker Desktop (recomendado) o PostgreSQL + Redis instalados localmente

1) Levantar infraestructura con Docker (recomendado)

En la raíz del repo:

```bash
docker compose up -d
```

Esto crea/levanta:
- Postgres en `localhost:5432` (usuario: `fstail`, pass: `fstail_dev`, bd: `fstail_platform`)
- Redis en `localhost:6379`

2) Variables de entorno

La app `apps/api` usa `DATABASE_URL` en el `prisma/schema.prisma`. Antes de migrar o ejecutar la API, exportá la variable:

Windows (cmd):

```cmd
set DATABASE_URL=postgresql://fstail:fstail_dev@localhost:5432/fstail_platform
```

PowerShell (temporal en sesión):

```powershell
$env:DATABASE_URL = 'postgresql://fstail:fstail_dev@localhost:5432/fstail_platform'
```

Linux/macOS:

```bash
export DATABASE_URL="postgresql://fstail:fstail_dev@localhost:5432/fstail_platform"
```

3) Generar Prisma Client (si no está generado)

Desde `apps/api`:

```bash
cd apps/api
npx prisma generate --schema "..\..\prisma\schema.prisma"
```

Notas: si ves errores tipo `EPERM` al escribir archivos `.prisma/client`, asegúrate de que ningún proceso (por ejemplo `npm run dev`) esté ocupando el archivo. Detén Nest (`Ctrl+C`) y vuelve a ejecutar `prisma generate`.

4) Aplicar migraciones

Ejecutá las migraciones apuntando al `schema.prisma` del root:

```cmd
cd apps/api
cmd /c "set DATABASE_URL=postgresql://fstail:fstail_dev@localhost:5432/fstail_platform && npx prisma migrate dev --schema ..\\..\\prisma\\schema.prisma --name init"
```

(En PowerShell o bash usá la sintaxis de export correspondiente.)

5) Seed (poblar datos iniciales)

El seed está en `prisma/seed.ts` (raíz del repo). Para ejecutarlo desde `apps/api` usar el path correcto:

```cmd
cd apps/api
cmd /c "set DATABASE_URL=postgresql://fstail:fstail_dev@localhost:5432/fstail_platform && ts-node ..\\..\\prisma\\seed.ts"
```

Si `ts-node` falla buscando el archivo, ejecutalo desde la raíz con:

```bash
npx ts-node prisma/seed.ts
```

6) Levantar servicios en desarrollo

Terminal 1 — API (NestJS):

```bash
cd apps/api
npm run dev
```

La API expone Swagger en `http://localhost:3001/api/docs` por defecto.

Terminal 2 — Web (Next.js):

```bash
cd apps/web
npm run dev
```

Terminal 3 — Desktop (Electron):

```bash
cd apps/desktop
npm run dev
```

7) Solución de problemas comunes

- Prisma P1001 "Can't reach database server":
  - Verificá que Docker esté corriendo y que el contenedor `fstail_postgres` esté ``healthy`` (o que Postgres local esté arriba). Ejecutá `docker ps` y `docker logs fstail_postgres`.
  - Asegurate de tener `DATABASE_URL` correctamente exportada en la misma shell donde corras `npm run dev`.

- Prisma EPERM rename `.dll.node` al generar cliente:
  - Esto suele ocurrir porque otro proceso tiene el archivo en uso. Parar Nest (`npm run dev`) y volver a ejecutar `npx prisma generate` suele resolverlo.

- `prisma generate` no encuentra `schema.prisma` al ejecutar el script desde `apps/api`:
  - Usá la opción `--schema "..\\..\\prisma\\schema.prisma"` como en los comandos anteriores.

- `db:seed` falla con "Cannot find module './seed.ts'":
  - El script de `apps/api` ejecuta `ts-node prisma/seed.ts` relativo a `apps/api`. El seed real está en la raíz `prisma/seed.ts`. Ejecutalo con `ts-node ..\\..\\prisma\\seed.ts` o desde la raíz `npx ts-node prisma/seed.ts`.

- Emails de Docker Hub o notificaciones que no llegan:
  - Revisá Spam, reintentá con otra cuenta o usá SSO (GitHub/Google) si está disponible. Docker Desktop puede funcionar sin iniciar sesión (según versión), pero algunas integraciones requieren cuenta.

8) Cambios de código comunes que resolvimos (qué buscar si más errores TS aparecen)

- Problemas con campos JSON en Prisma (`Json` / `InputJsonValue`):
  - Si tu DTO usa `Record<string, unknown>`, convertí al asignar en Prisma: `metadata: (dto.metadata ?? {}) as any` o actualizá el DTO para usar los tipos de Prisma.

- `groupBy` de Prisma: la API TypeScript requiere `orderBy` en ciertas versiones. Añadí `orderBy: { status: 'asc' }` y mapeos más seguros: `byStatus.map((s: any) => [s.status, s._count?.status ?? 0])`.

- Actualizaciones (`update`) con campos JSON: casteá el `dto` a `any` si Prisma espera `InputJsonValue`.

- Si TypeScript reporta errores: ejecutar desde `apps/api`:

```bash
npm run typecheck
```

9) Ejecución alternativa sin Docker (Postgres instalado manualmente)

- Instalá PostgreSQL (p.ej. Postgres installer o via package manager).
- Creá usuario/BD:

```sql
CREATE USER fstail WITH PASSWORD 'fstail_dev';
CREATE DATABASE fstail_platform OWNER fstail;
```

- Seteá `DATABASE_URL` apuntando al servidor local o remoto y seguí los pasos 3–6.

10) Qué hice en el repo

- Añadí este archivo `docs/RUNNING.md` con los pasos (ubicado en `docs/RUNNING.md`).

¿Querés que ejecute ahora el seed correctamente desde la raíz y arranque la API/web/desktop? Si sí, confirmame y lo hago (ejecuto `npx ts-node prisma/seed.ts` y luego `npm run dev` en cada app).