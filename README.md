# Lab Alta Dashboard

Base inicial de una app web en `Next.js + TypeScript` para operar tres procesos:

1. Base de defectos analizados en produccion.
2. Base de mercaderia al natural para ingresos por camion.
3. Control de muestras almacenadas en deposito.

## Stack

- Next.js App Router
- TypeScript
- Firebase SDK preparada para Firestore
- Recharts para graficos interactivos
- jsPDF + html2canvas para exportacion PDF

## Puesta en marcha

```bash
npm install
npm run dev
```

La app queda disponible en `http://localhost:3000`.

## Variables de entorno

Copiar `.env.local.example` a `.env.local` y completar:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`

La inicializacion esta centralizada en `lib/firebase.ts`.

En desarrollo local, la app usa `.env.local`.

En Firebase App Hosting, la app puede usar la configuracion web inyectada automaticamente por el entorno, por lo que no hace falta versionar las variables `NEXT_PUBLIC_FIREBASE_*` dentro de `apphosting.yaml`.

Importante: la `apiKey` de Firebase Web no funciona como un secreto de servidor. Segun la documentacion oficial de Firebase, identifica el proyecto pero no autoriza acceso a Firestore o Storage por si sola. La proteccion real depende de Firebase Security Rules y, si corresponde, App Check.

## Colecciones sugeridas en Firestore

- `defectAnalyses`
- `naturalInbound`
- `storedSamples`

## Estructura principal

- `app/`: layout global, pagina principal y estilos.
- `components/dashboard/`: shell del dashboard y primitivas visuales.
- `components/modules/`: cada pestaña de negocio.
- `lib/`: configuracion Firebase, mock data, utilidades de formato y exportacion PDF.
- `types/`: modelos de dominio compartidos.

## Proximos pasos recomendados

1. Reemplazar los arrays mock por lectura/escritura en Firestore.
2. Agregar autenticacion y roles por perfil.
3. Persistir filtros y vistas frecuentes.
4. Incorporar exportaciones PDF con branding y encabezados fijos.
5. Definir estrategia de despliegue en Firebase Hosting.

## Hosting en Firebase

Para produccion tenes dos caminos viables:

1. Firebase App Hosting si queres un flujo moderno compatible con frameworks.
2. Firebase Hosting con integracion de frameworks para desplegar el build de Next.

Antes de desplegar conviene definir el `projectId`, reglas de Firestore y politica de acceso por usuarios.
