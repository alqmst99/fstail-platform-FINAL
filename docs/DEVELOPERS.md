# FSTail: documentación para desarrollo y operación

## Arquitectura

El monorepo usa npm workspaces y Turbo:

- `apps/api`: NestJS, Prisma y PostgreSQL.
- `apps/web`: Next.js y Tailwind.
- `apps/desktop`: Electron.
- `packages/types`: contratos TypeScript compartidos.
- `prisma`: schema, migraciones y seed del monorepo.

## Instalación local

```powershell
npm install
docker compose up -d
npm run db:migrate
npm run db:seed
npm run dev
```

Para regenerar Prisma:

```powershell
npm run db:generate
```

Si se ejecuta Prisma desde `apps/api`, usar `--schema ..\..\prisma\schema.prisma`. En PowerShell, una variable temporal es:

```powershell
$env:DATABASE_URL = 'postgresql://fstail:fstail_dev@localhost:5432/fstail_platform'
```

## Variables y Freelancer OAuth

Copiar `.env.example` a `.env`. Nunca subir secretos ni tokens.

```env
FREELANCER_CLIENT_ID=...
FREELANCER_CLIENT_SECRET=...
FREELANCER_REDIRECT_URI=http://localhost:3001/freelancer-oauth/callback
FREELANCER_ACCESS_TOKEN=...
FREELANCER_REFRESH_TOKEN=...
FREELANCER_USER_ID=...
GROQ_API_KEY=...
```

El flujo es OAuth 2: obtener la URL con `GET /api/freelancer-oauth/authorize-url`, autorizar la aplicación y completar el callback. `fln:project_manage` debe estar aprobado para colocar bids. Un 401 indica token expirado; un 403 suele indicar scope o aprobación pendiente.

## Radar

El radar consulta proyectos activos, normaliza `paymentVerified`, `timeSubmitted`, `avgBid`, `hireRate`, país y adjuntos, y aplica únicamente los filtros seleccionados. El filtro de pago verificado se basa en los campos disponibles en `owner_details`; si Freelancer no devuelve ese dato, el proyecto no se debe presentar como verificado.

La búsqueda no fuerza una lista global de skills: el texto ingresado es el criterio principal. Para reducir ruido, usar palabras como `react`, `next.js`, `typescript`, `node.js`, `nestjs`, `wordpress development` o `figma to react`, y activar payment verified, hire rate, descripción mínima y máximo de bids según el volumen deseado.

La propuesta IA recibe descripción, presupuesto, bids, skills, precio medio y precio sugerido. El precio sugerido es aproximadamente el 92% del promedio de bids; si no hay promedio, usa el 90% del mínimo del presupuesto. Revisar siempre la propuesta antes de enviar.

## Postulaciones y métricas

`POST /api/applications` coloca el bid real cuando Freelancer OAuth está configurado y guarda la postulación local. El detalle conserva descripción original, propuesta enviada, precio medio, precio sugerido, precio ofertado, días, ganador y mensajes.

La pantalla `/applications/analytics` sincroniza el historial de Freelancer y muestra conversión, bids vistos, ganadas/perdidas, diferencias contra el ganador, precio medio e insights. Registrar el ganador y su precio cuando el proyecto cierre: sin esos datos las métricas de precio no pueden explicar una pérdida.

## Auditorías: procedimiento completo

1. Crear la auditoría desde `/audit/new`, asociarla al cliente/proyecto y completar la información general.
2. Para cada sección, registrar score de 0 a 10, observaciones concretas y URLs de evidencia.
3. Capturar evidencia reproducible: URL completa, fecha/hora, viewport, dispositivo/navegador y estado de login si corresponde. No capturar contraseñas, tokens ni datos personales innecesarios.
4. Guardar capturas con una convención estable, por ejemplo `cliente/proyecto/AAAA-MM-DD/seccion-01-home.png`, y subirlas al almacenamiento definido por el equipo. Guardar la URL resultante en `evidenceUrls`.
5. Para problemas visuales, incluir captura de escritorio y móvil. Para problemas técnicos, adjuntar Lighthouse/PageSpeed, consola, headers relevantes o prueba de accesibilidad.
6. Describir impacto, evidencia y recomendación por separado. Una observación útil responde: qué falla, a quién afecta, cómo se reproduce y qué cambio lo corrige.
7. Enviar la auditoría solo cuando las secciones revisadas tengan score. El sistema calcula el score ponderado y luego bloquea la edición al pasar a `DONE`.
8. Archivar auditorías terminadas cuando ya no requieran seguimiento. No borrar evidencia: conservar la auditoría y sus URLs para comparar futuras revisiones.

### Checklist técnico recomendado

- SEO: title, description, canonical, indexación, sitemap, robots y datos estructurados.
- Rendimiento: LCP, INP, CLS, peso de imágenes, caché y móvil.
- UX: navegación, responsive, formularios, estados vacíos y mensajes de error.
- Accesibilidad: contraste, foco, teclado, labels, alt y landmarks.
- Seguridad: HTTPS, cookies, headers, formularios, exposición de secretos y dependencias.
- Contenido: claridad de la oferta, ortografía, CTA, información de contacto y consistencia.

### Experiencia `href` y enlaces

Para verificar que una experiencia o enlace funciona, registrar la URL exacta (`href`), texto visible, destino esperado, código/resultado observado y fecha. Probar enlaces internos, externos, `mailto`, `tel`, botones con navegación y enlaces que abren nueva pestaña. Un `href="#"` sin comportamiento definido, un destino 404 o un enlace que depende solo de JavaScript debe quedar como hallazgo.

## Comandos de calidad

```powershell
npm run typecheck --workspace apps/api
npm run typecheck --workspace apps/web
npm run build
```

Los errores de base de datos se revisan con `docker compose logs postgres` y los de la API con el log de Nest. Preservar los cambios locales y corregir el origen en lugar de resetear el repositorio.
