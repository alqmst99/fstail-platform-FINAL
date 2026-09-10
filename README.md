# FSTail Platform

Plataforma interna para captar proyectos de desarrollo web en Freelancer, preparar y enviar postulaciones, analizar resultados y documentar auditorías de sitios.

## Módulos

- **Radar**: búsqueda de proyectos, filtros de calidad, precio medio, precio sugerido y generación de propuestas con IA.
- **Postulaciones**: envío real de bids, conversación, estados, adjudicación y análisis de conversión/precio.
- **Auditorías**: plantillas por secciones, score, observaciones, evidencias y archivo de resultados.
- **CRM y operaciones**: clientes, proyectos, reportes, tareas diarias y aplicación de escritorio.

## Requisitos

Node.js 20+, npm 10+, Docker Desktop y PostgreSQL/Redis. La instalación completa, variables, OAuth de Freelancer, auditorías y troubleshooting está en [docs/DEVELOPERS.md](docs/DEVELOPERS.md).

## Inicio rápido

```powershell
npm install
docker compose up -d
npm run db:migrate
npm run dev
```

La API queda en `http://localhost:3001` y Swagger en `http://localhost:3001/api/docs`. La web usa el puerto 3000.

## Validación

```powershell
npm run typecheck
npm run build
```

No se versionan secretos, `node_modules`, `.next` ni `dist`. Usá `.env.example` como base y mantené los tokens de Freelancer únicamente en el entorno local o en un secret manager.
