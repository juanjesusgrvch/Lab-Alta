import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type App,
  type AppOptions,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

// Credenciales
const getServiceAccountConfig = () => {
  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID?.trim() ??
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() ??
    "";
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim() ?? "";
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n") ?? "";

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  return {
    projectId,
    clientEmail,
    privateKey,
  };
};

// Diagnostico
export const getAdminCredentialDiagnostic = () => {
  const serviceAccountConfig = getServiceAccountConfig();
  const adcPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ?? "";

  if (serviceAccountConfig) {
    return {
      mode: "service-account" as const,
      message: "Firebase Admin usa credenciales desde FIREBASE_ADMIN_*.",
    };
  }

  if (adcPath) {
    return {
      mode: "adc" as const,
      message: `Firebase Admin intenta usar ADC desde GOOGLE_APPLICATION_CREDENTIALS=${adcPath}.`,
    };
  }

  return {
    mode: "missing" as const,
    message:
      "Faltan credenciales de Firebase Admin. Define FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL y FIREBASE_ADMIN_PRIVATE_KEY, o GOOGLE_APPLICATION_CREDENTIALS.",
  };
};

// Servidor
export const getAdminApp = (): App => {
  const existingApp = getApps()[0];

  if (existingApp) {
    return existingApp;
  }

  const serviceAccountConfig = getServiceAccountConfig();
  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID?.trim() ??
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  const options: AppOptions = serviceAccountConfig
    ? {
        credential: cert(serviceAccountConfig),
        projectId: serviceAccountConfig.projectId,
      }
    : {
        credential: applicationDefault(),
        projectId,
      };

  return initializeApp(options);
};

export const getAdminAuth = () => getAuth(getAdminApp());
