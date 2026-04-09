"use client";

import { useEffect, useRef, useState } from "react";

import type { User } from "firebase/auth";
import { LoaderCircle } from "lucide-react";

import { LoginScreen } from "@/components/auth/login-screen";
import { DashboardApp } from "@/components/dashboard/dashboard-app";
import { UnauthorizedScreen } from "@/components/auth/unauthorized-screen";
import { canUseLiveDashboard, getUserAccessLevel } from "@/lib/access-control";
import {
  observeAuthState,
  requestPasswordReset,
  signInWithEmail,
  signInWithGoogle,
  signInWithServerToken,
  signOutSession,
} from "@/lib/firebase-auth";
import { syncSignedInUser } from "@/lib/firestore-records";

const createAppError = (code: string) =>
  Object.assign(new Error(code), { code });

const getAuthErrorMessage = (error: unknown) => {
  const errorCode =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";

  switch (errorCode) {
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Las credenciales no son validas o el usuario todavia no existe.";
    case "auth/invalid-email":
      return "El correo ingresado no tiene un formato valido.";
    case "auth/too-many-requests":
      return "Firebase bloqueo temporalmente el acceso. Espera un momento e intenta otra vez.";
    case "auth/missing-password":
      return "Falta la clave para iniciar sesion.";
    case "auth/network-request-failed":
      return "No se pudo contactar a Firebase. Revisa la conexion y la configuracion del proyecto.";
    case "auth/popup-closed-by-user":
      return "Se cerro la ventana de Google antes de completar el ingreso.";
    case "auth/popup-blocked":
      return "El navegador bloqueo la ventana de Google. Habilita popups e intenta otra vez.";
    case "auth/cancelled-popup-request":
      return "Ya habia una solicitud de acceso con Google en curso.";
    case "auth/operation-not-allowed":
      return "El proveedor solicitado no esta habilitado en Firebase Authentication.";
    case "auth/unauthorized-domain":
      return "Este dominio todavia no esta autorizado para Google OAuth en Firebase.";
    case "auth/user-disabled":
      return "La cuenta esta deshabilitada en Firebase Authentication.";
    case "turnstile/missing-token":
    case "turnstile/verification-failed":
      return "Completa correctamente la verificacion de Cloudflare Turnstile antes de continuar.";
    case "turnstile/misconfigured":
      return "Turnstile no esta configurado correctamente en el servidor.";
    case "turnstile/service-unavailable":
      return "No se pudo validar Turnstile en este momento. Intenta nuevamente en unos segundos.";
    case "server-auth/rate-limited":
      return "Se bloquearon temporalmente los intentos de acceso por exceso de intentos. Espera y vuelve a probar.";
    case "server-auth/misconfigured":
      return "El backend de autenticacion segura no esta configurado correctamente. Revisa Firebase Admin o los permisos del service account de App Hosting.";
    case "server-auth/service-unavailable":
      return "El backend de autenticacion no pudo contactar a Firebase. Intenta nuevamente.";
    case "server-auth/login-failed":
      return "No se pudo completar el login seguro contra Firebase.";
    default:
      return "No se pudo completar la operacion con Firebase.";
  }
};

const requestSecureEmailLogin = async (
  email: string,
  password: string,
  turnstileToken: string,
) => {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      turnstileToken,
    }),
  }).catch(() => null);

  if (!response) {
    throw createAppError("server-auth/service-unavailable");
  }

  const payload = (await response.json().catch(() => null)) as {
    success?: boolean;
    error?: string;
    customToken?: string;
    fallbackMode?: string;
  } | null;

  if (!response.ok || !payload?.success) {
    throw createAppError(payload?.error ?? "server-auth/login-failed");
  }

  return {
    customToken: payload.customToken ?? null,
    fallbackMode: payload.fallbackMode ?? null,
  };
};

interface AppAccessProps {
  turnstileSiteKey: string;
}

export const AppAccess = ({ turnstileSiteKey }: AppAccessProps) => {
  const [sessionUser, setSessionUser] = useState<User | null | undefined>(
    undefined,
  );
  const [sessionAccessLevel, setSessionAccessLevel] = useState<
    "full" | "demo" | "none" | undefined
  >(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [sessionWarning, setSessionWarning] = useState<string | null>(null);
  const authResolutionIdRef = useRef(0);

  useEffect(() => {
    const unsubscribe = observeAuthState((nextUser) => {
      const currentResolutionId = authResolutionIdRef.current + 1;
      authResolutionIdRef.current = currentResolutionId;

      setSessionUser(nextUser);
      setIsSubmitting(false);
      setErrorMessage(null);

      if (!nextUser) {
        setSessionAccessLevel("none");
        setSessionWarning(null);
        return;
      }

      setSessionAccessLevel(undefined);

      void nextUser
        .getIdTokenResult()
        .then((tokenResult) => {
          if (authResolutionIdRef.current !== currentResolutionId) {
            return;
          }

          const nextAccessLevel = getUserAccessLevel(
            nextUser,
            tokenResult.signInProvider,
          );

          setSessionAccessLevel(nextAccessLevel);

          if (!canUseLiveDashboard(nextUser, tokenResult.signInProvider)) {
            setSessionWarning(null);
            return;
          }

          return syncSignedInUser(nextUser)
            .then(() => {
              if (authResolutionIdRef.current === currentResolutionId) {
                setSessionWarning(null);
              }
            })
            .catch(() => {
              if (authResolutionIdRef.current === currentResolutionId) {
                setSessionWarning(
                  "La sesion esta activa, pero Firestore no pudo sincronizar el perfil del usuario. Revisa las credenciales del proyecto y las reglas.",
                );
              }
            });
        })
        .catch(() => {
          if (authResolutionIdRef.current === currentResolutionId) {
            setSessionAccessLevel(getUserAccessLevel(nextUser));
            setSessionWarning(null);
          }
        });
    });

    return () => {
      authResolutionIdRef.current += 1;
      unsubscribe();
    };
  }, []);

  const handleEmailAccess = async (
    email: string,
    password: string,
    turnstileToken: string,
  ) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const loginResult = await requestSecureEmailLogin(
        email,
        password,
        turnstileToken,
      );

      if (loginResult.customToken) {
        await signInWithServerToken(loginResult.customToken);
        return;
      }

      if (loginResult.fallbackMode === "client-password") {
        await signInWithEmail(email, password);
        return;
      }

      throw createAppError("server-auth/login-failed");
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error));
      setIsSubmitting(false);
    }
  };

  const handleGoogleAccess = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      await signInWithGoogle();
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error));
      setIsSubmitting(false);
    }
  };

  const handlePasswordReset = async (email: string) => {
    if (!email.trim()) {
      setErrorMessage(
        "Ingresa el correo para enviar la recuperacion de acceso.",
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      await requestPasswordReset(email);
      setInfoMessage(
        "Si el correo existe, Firebase enviara un enlace para restablecer la clave.",
      );
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setInfoMessage(null);

    void signOutSession().catch((error) => {
      setErrorMessage(getAuthErrorMessage(error));
      setIsSubmitting(false);
    });
  };

  if (sessionUser === undefined || (sessionUser && sessionAccessLevel === undefined)) {
    return (
      <main className="auth-loading-screen">
        <section className="auth-loading-card card">
          <LoaderCircle className="auth-loading-icon" size={28} />
          <strong>Solicitando Acceso</strong>
          <p>Validando sesion y preparando el Dashboard.</p>
        </section>
      </main>
    );
  }

  if (!sessionUser) {
    return (
      <LoginScreen
        isSubmitting={isSubmitting}
        errorMessage={errorMessage}
        infoMessage={infoMessage}
        turnstileSiteKey={turnstileSiteKey}
        onGoogleAccess={handleGoogleAccess}
        onEmailAccess={handleEmailAccess}
        onPasswordReset={handlePasswordReset}
      />
    );
  }

  const accessLevel = sessionAccessLevel ?? "none";

  if (accessLevel === "demo") {
    return (
      <DashboardApp
        key={`demo-${sessionUser.uid}`}
        sessionName={sessionUser.displayName}
        sessionEmail={sessionUser.email}
        sessionWarning="Estás usando el dashboard en modo 'demo'. Puedes crear, editar, eliminar y exportar registros de ejemplo, pero nada se guarda y todos los cambios se pierden al recargar."
        dataMode="demo"
        onSignOut={handleSignOut}
      />
    );
  }

  if (accessLevel === "none") {
    return (
      <UnauthorizedScreen
        sessionEmail={sessionUser.email}
        sessionUid={sessionUser.uid}
        accessLevel={accessLevel}
        onSignOut={handleSignOut}
      />
    );
  }

  return (
    <DashboardApp
      key={`full-${sessionUser.uid}`}
      sessionName={sessionUser.displayName}
      sessionEmail={sessionUser.email}
      sessionWarning={sessionWarning}
      dataMode="live"
      onSignOut={handleSignOut}
    />
  );
};
