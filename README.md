# FSTail Platform — overlay con módulo Radar Freelancer + CRM

Este ZIP usa **las mismas rutas del monorepo** de `final.zip`.

## Estructura (rutas reales)

```
apps/api/src/applications/     # CRM + bid real + award monitor
apps/api/src/daily-tasks/      # tareas + routine-context
apps/api/src/radar/            # filter estricto + FreelancerAuthClient (OAuth)
apps/api/src/app.module.ts     # imports nuevos módulos
apps/desktop/src/main.js       # notificaciones con click
apps/desktop/src/preload.js    # electronAPI.notify
apps/web/app/(platform)/dashboard/
apps/web/app/(platform)/applications/
apps/web/components/radar/QuickBidCard.tsx
apps/web/next.config.js        # rewrite /api -> Nest
prisma/schema.prisma
prisma/migrations/20260907190000_add_freelancer_crm_tasks/
packages/types/src/index.ts
docs/FREELANCER_DEVELOPER_API.md
docs/FREELANCER_RADAR_CRM.md
.env.example
```

## Cómo usar

### Opción A — merge sobre tu repo actual
Descomprimí **encima** de tu copia de FSTail (las rutas coinciden).
Después:

```bash
cd apps/api
npx prisma migrate deploy
npx prisma generate
```

Completá en `.env` las vars `FREELANCER_*` (ver docs/FREELANCER_DEVELOPER_API.md).

### Opción B — solo archivos nuevos
Copiá solo las carpetas listadas arriba a las mismas rutas en tu monorepo.

## Qué incluye de nuevo
- Filtro calidad: payment_verified, hire_rate>=60%, desc>=120, bids<=15
- Bid real vía Developer API (OAuth 1.0a)
- Award monitor cada 5 min + POST /applications/sync-awards
- Dashboard multi Dev1/Dev2 + Prompt de rutina
- CRM + chat por postulación
- Notificaciones Electron con navegación al click

NOTA: este paquete NO incluye node_modules, .next ni dist. Corré `npm install` en la raíz del monorepo.
