# Módulo Radar Freelancer + CRM + Dashboard Operativo

## Qué se implementó

### 1. Schema Prisma
- `BidStatus` enum
- `Application` (postulaciones con tracking de competencia)
- `Message` (chat integrado)
- `DailyTask` (gestor de tareas + salud operativa multi-tag Dev1/Dev2)

Migración: `prisma/migrations/20260907190000_add_freelancer_crm_tasks/`

```bash
cd apps/api
npx prisma migrate deploy   # o migrate dev
npx prisma generate
```

### 2. Filtro de calidad estricto (`radarFilter.ts`)
Reglas:
1. `payment_verified === true`
2. Si `reviews > 0` → `hire_rate >= 0.60`
3. `description.length >= 120`
4. `bid_count <= 15`

También: extracción de texto de adjuntos (placeholder para pipeline async).

`FreelancerClient` ahora normaliza estos campos y aplica el filtro estricto.

### 3. Backend NestJS
- `ApplicationsModule` → CRUD + mensajes + markAwardedToOther
- `DailyTasksModule` → tareas diarias + `GET /daily-tasks/routine-context` (Prompt-Hub)

Endpoints:
- `POST /applications`
- `GET /applications?status=&assignedTo=`
- `GET /applications/:id`
- `PATCH /applications/:id/status`
- `POST /applications/:id/messages`
- `POST /daily-tasks`
- `GET /daily-tasks?userTag=&date=`
- `GET /daily-tasks/routine-context?userTag=`
- `PATCH /daily-tasks/:id`

### 4. Frontend (Next.js App Router)
- `components/radar/QuickBidCard.tsx` — postulación un-clic
- `app/(platform)/dashboard/page.tsx` — Home operativo multi-tag + energía + Prompt-Hub
- `app/(platform)/applications/page.tsx` — CRM lista
- `app/(platform)/applications/[id]/page.tsx` — Chat + detalle

### 5. Electron
- `notification:show` y `notify` con click → restore window + navigate-to-application
- `electronAPI.notify` y `onNavigateToApplication` en preload

## Cómo conectar el frontend al API

Agregá en `apps/web/next.config.js` (o `.mjs`):

```js
async rewrites() {
  return [
    { source: '/api/:path*', destination: 'http://localhost:4000/:path*' }, // puerto de Nest
  ];
}
```

O usá variables de entorno `NEXT_PUBLIC_API_URL`.

## Próximos pasos opcionales
1. Worker que poll Freelancer para detectar adjudicaciones y llame a `markAwardedToOther`.
2. Proxy real de envío de bids a `POST /api/projects/0.1/bids/` (requiere OAuth token de Freelancer).
3. Extracción real de PDF/DOCX (pdf-parse + mammoth) en cola.
4. Traducción automática de descripciones (DeepL / LLM).

---

## Actualización: Bid real + Award Monitor

- `FreelancerAuthClient` (`apps/api/src/radar/freelancer-auth.client.ts`) — OAuth 1.0a puro
- `POST /applications` ahora **coloca el bid real** en Freelancer si hay credenciales
- `AwardMonitorService` — cada 5 min revisa postulaciones abiertas y actualiza ganador
- `POST /applications/sync-awards` — trigger manual
- Guía completa: **docs/FREELANCER_DEVELOPER_API.md**
