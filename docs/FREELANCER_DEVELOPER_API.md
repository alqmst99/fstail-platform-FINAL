# Freelancer Developer API — OAuth 2.0 (guía práctica)

Tu app del portal usa **OAuth 2.0** (App ID + Secret), no OAuth 1.0a.

## Estado de la app

Si dice **Pending Approval**, los scopes avanzados (`fln:project_manage`) suelen **no funcionar** hasta que Freelancer apruebe la app.  
Podés probar `basic` / lectura, pero **bids y manage** pueden devolver 403.

## Variables `.env`

```env
FREELANCER_CLIENT_ID=tu-app-id
FREELANCER_CLIENT_SECRET=tu-secret
FREELANCER_REDIRECT_URI=http://localhost:3000/callback
FREELANCER_ACCESS_TOKEN=   # se obtiene con el flujo de abajo
FREELANCER_REFRESH_TOKEN=
FREELANCER_USER_ID=        # numérico; se puede sacar de GET /users/0.1/self/
```

**Nunca** commits del secret ni tokens al repo.

## Flujo OAuth (una vez)

### 1. Abrí la URL de autorización

Con el API corriendo:

```http
GET /freelancer-oauth/authorize-url
Authorization: Bearer <tu JWT FSTail>
```

O armala a mano:

```
https://www.freelancer.com/oauth/authorize?response_type=code&client_id=TU_CLIENT_ID&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback&scope=basic%20fln%3Aproject_manage%20fln%3Auser_information&prompt=select_account%20consent
```

### 2. Redirect URI

Tiene que coincidir **exactamente** con la de la app:

- `http://localhost:3000/callback`  (Next)
- o `http://localhost:3001/freelancer-oauth/callback` (Nest directo)

Si usás el API Nest:

```http
GET http://localhost:3001/freelancer-oauth/callback?code=...
```

Esa ruta intercambia el `code` y te muestra `ACCESS_TOKEN` + `REFRESH_TOKEN` para pegar en `.env`.

### 3. Token endpoint (referencia)

```
POST https://accounts.freelancer.com/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code=...
&client_id=...
&client_secret=...
&redirect_uri=http://localhost:3000/callback
```

### 4. Llamadas a la API

Header:

```
Freelancer-OAuth-V1: <access_token>
```

Endpoints que usa FSTail:

| Acción | Método | Path |
|--------|--------|------|
| Bid | POST | `/projects/0.1/bids/` |
| Proyecto + selected bids | GET | `/projects/0.1/projects/{id}/?selected_bids=true` |
| Self | GET | `/users/0.1/self/` |
| Mensajes | GET/POST | `/messages/0.1/messages/` |

## Scopes de tu app

- `basic` — perfil básico  
- `fln:user_information` — info de usuario  
- `fln:project_manage` — projects, **bids**, milestones  

Sin aprobación + scope manage, `placeBid` falla.

## Troubleshooting

| Error | Qué revisar |
|-------|-------------|
| Pending Approval | Esperar aprobación o contactar support Freelancer |
| invalid_client | CLIENT_ID / SECRET mal copiados |
| redirect_uri mismatch | Debe ser idéntico al del portal |
| 401 en API | Token expirado → refresh o re-auth |
| 403 en bids | Scope manage o app no approved |
| invalid signature | Estabas en OAuth1; este stack es OAuth2 |

## Seguridad

- Secret y tokens solo en `.env` / secret manager  
- No en el frontend ni en el ZIP público  
- Si el secret se filtró (chat, commit), regeneralo en el portal de developers
