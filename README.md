# Lab Alta

Base operativa en `Next.js + TypeScript` para trabajar con tres frentes:

1. `defectos`
2. `descargas`
3. `muestras`

## Stack

- Next.js App Router
- TypeScript
- Firebase Authentication + Firestore
- Recharts para graficos
- jsPDF + html2canvas para exportacion PDF

## Arranque

```bash
npm install
npm run dev
```

La app queda disponible en `http://localhost:3000`.

## Firebase

Copiar `.env.local.example` a `.env.local` y completar:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`

Para el login seguro por backend con `custom token`, completar ademas una de estas opciones:

- Variables de service account:
  - `FIREBASE_ADMIN_PROJECT_ID`
  - `FIREBASE_ADMIN_CLIENT_EMAIL`
  - `FIREBASE_ADMIN_PRIVATE_KEY`
- O credenciales ADC disponibles en el entorno donde corre Next.js / App Hosting.

Rate limit opcional del login:

- `AUTH_LOGIN_RATE_LIMIT_WINDOW_MS`
- `AUTH_LOGIN_RATE_LIMIT_LOCKOUT_MS`
- `AUTH_LOGIN_RATE_LIMIT_MAX_FAILURES`
- `AUTH_REQUIRE_SERVER_CUSTOM_TOKEN`

Si `AUTH_REQUIRE_SERVER_CUSTOM_TOKEN=true`, el login por email falla cuando el
backend no puede emitir el custom token de Firebase Admin. Si no se define, la
app conserva la validacion por Turnstile y backend, pero puede continuar con
`signInWithEmail` como fallback para no bloquear el acceso operativo.

La inicializacion vive en `lib/firebase.ts`.

La capa de autenticacion vive en `lib/firebase-auth.ts`.

La capa base de Firestore vive en `lib/firestore-records.ts`.

### Colecciones previstas

- `usuarios`
- `defectos`
- `descargas`
- `muestras`

### Reglas base

- Solo el operador inicial autorizado puede leer y escribir en `defectos`, `descargas` y `muestras`.
- Solo el operador autorizado puede crear o actualizar su propio documento en `usuarios/{uid}`.
- Las sesiones `google.com` entran en modo UI-only y no pueden leer ni escribir en Firestore.
- Una cuenta autenticada pero fuera de la allowlist no entra al dashboard real y no toca Firestore.

### Usuario inicial autorizado

- UID habilitado: `UID: firestore.rules`
- La allowlist local vive en `lib/access-control.ts`.
- La restriccion de reglas vive en `firestore.rules`.
- Para sumar los otros dos accesos, agrega sus UIDs a `allowedOperatorAccounts`.

## Carpetas operativas

Se agrego una estructura local para entradas manuales o importaciones:

- `registros/defectos`
- `registros/descargas`
- `registros/muestras`

## Estructura principal

- `app/`: entrada de la aplicacion y estilos globales.
- `components/auth/`: puerta de login y acceso.
- `components/dashboard/`: shell visual del tablero.
- `components/modules/`: modulos funcionales actuales.
- `lib/`: Firebase, acceso a datos y utilidades.
- `registros/`: carpetas locales para carga operativa.
- `types/`: modelos de dominio.

## Siguiente paso natural

1. Habilitar Email/Password en Firebase Authentication.
2. Crear usuarios iniciales en Firebase Console.
3. Reemplazar progresivamente los mocks por `createRecord`, `saveRecord` y `listLatestRecords`.
4. Definir roles y permisos mas finos si el tablero va a tener distintos perfiles.
