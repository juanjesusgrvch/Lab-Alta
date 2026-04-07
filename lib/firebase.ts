import {
  getApp,
  getApps,
  initializeApp,
  type FirebaseApp,
  type FirebaseOptions,
} from "firebase/app";
import {
  getAnalytics,
  isSupported,
  type Analytics,
} from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export const firestoreCollections = {
  defects: "defectos",
  downloads: "descargas",
  samples: "muestras",
  users: "usuarios",
} as const;

export const recordsWorkspaceFolders = {
  defects: "registros/defectos",
  downloads: "registros/descargas",
  samples: "registros/muestras",
} as const;

export type OperationalRecordKey = keyof typeof recordsWorkspaceFolders;

const hasExplicitFirebaseConfig = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.storageBucket &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId,
);

export const hasFirebaseConfig = hasExplicitFirebaseConfig;

export const getFirebaseApp = (): FirebaseApp => {
  if (getApps().length) {
    return getApp();
  }

  try {
    return hasExplicitFirebaseConfig ? initializeApp(firebaseConfig) : initializeApp();
  } catch {
    throw new Error(
      "No se pudo inicializar Firebase. En desarrollo, completa NEXT_PUBLIC_FIREBASE_* en .env.local. En Firebase App Hosting, usa la configuracion automatica del entorno o variables definidas en la consola.",
    );
  }
};

export const getFirebaseAuth = () => getAuth(getFirebaseApp());

export const getFirebaseDb = () => getFirestore(getFirebaseApp());

let analyticsPromise: Promise<Analytics | null> | null = null;

export const getFirebaseAnalytics = async () => {
  if (typeof window === "undefined") {
    return null;
  }

  if (!analyticsPromise) {
    analyticsPromise = isSupported()
      .then((supported) => (supported ? getAnalytics(getFirebaseApp()) : null))
      .catch(() => null);
  }

  return analyticsPromise;
};
