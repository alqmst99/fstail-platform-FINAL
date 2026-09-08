# FSTail — Módulo Radar Freelancer + CRM + Award Monitor

Paquete con todos los archivos nuevos/modificados para integrar en el monorepo FSTail.

## Contenido

```
applications/          → Nest module CRM (bids + messages + sync)
daily-tasks/           → Gestor de tareas + Prompt-Hub
radar/                 → Client público + OAuth Developer API + filter estricto
  freelancer-auth.client.ts  ← bids reales (OAuth 1.0a)
  radarFilter.ts
  freelancer.client.ts       ← enhanced
app.module.ts          → imports ApplicationsModule + DailyTasksModule
prisma/                → schema + migration 20260907190000_...
desktop/               → main.js + preload.js (notificaciones)
web/                   → dashboard, applications CRM, QuickBidCard, next.config.js
docs/
  FREELANCER_DEVELOPER_API.md  ← guía OAuth / API developer
  FREELANCER_RADAR_CRM.md
.env.example           → vars FREELANCER_*
packages-types-index.ts → pegar/mergear en packages/types/src/index.ts
```

## Instalación rápida

1. Copiá `applications/`, `daily-tasks/` y el contenido de `radar/` a `apps/api/src/`
2. Reemplazá `apps/api/src/app.module.ts` con el incluido (o mergeá imports)
3. Mergeá `prisma/schema.prisma` y copiá la carpeta de migration
4. `npx prisma migrate deploy && npx prisma generate` (desde apps/api o raíz)
5. Mergeá types desde `packages-types-index.ts`
6. Copiá páginas web y `QuickBidCard`
7. Reemplazá `apps/desktop/src/main.js` y `preload.js` (o mergeá handlers de notify)
8. Completá `.env` con FREELANCER_* (ver docs/FREELANCER_DEVELOPER_API.md)

## Qué hace

- **Radar**: filtro payment_verified + hire_rate≥60% + desc≥120 + bids≤15
- **Postular y Mandar**: bid real vía Developer API + guarda Application
- **Award monitor**: cada 5 min detecta si ganaste o perdiste y guarda winnerBidPrice
- **Dashboard**: multi Dev1/Dev2, energía, tareas, prompt de rutina
- **CRM + chat**: lista y conversación por postulación
- **Electron**: notificación clickeable → enfoca ventana y navega a la app

Ver docs/FREELANCER_DEVELOPER_API.md para OAuth y tokens.
