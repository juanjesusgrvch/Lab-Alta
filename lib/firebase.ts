import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAnalytics,
  isSupported,
  type Analytics,
} from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export const firestoreCollections = {
  defectAnalyses: "defectAnalyses",
  naturalInbound: "naturalInbound",
  storedSamples: "storedSamples",
} as const;

export const hasFirebaseConfig = Object.values(firebaseConfig).every(Boolean);

export const getFirebaseApp = (): FirebaseApp => {
  if (!hasFirebaseConfig) {
    throw new Error(
      "Faltan variables NEXT_PUBLIC_FIREBASE_* en .env.local para inicializar Firebase.",
    );
  }

  return getApps().length ? getApp() : initializeApp(firebaseConfig);
};

export const getFirebaseDb = () => getFirestore(getFirebaseApp());

let analyticsPromise: Promise<Analytics | null> | null = null;

export const getFirebaseAnalytics = async () => {
  if (typeof window === "undefined" || !hasFirebaseConfig) {
    return null;
  }

  if (!analyticsPromise) {
    analyticsPromise = isSupported().then((supported) =>
      supported ? getAnalytics(getFirebaseApp()) : null,
    );
  }

  return analyticsPromise;
};
