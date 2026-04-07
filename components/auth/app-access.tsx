"use client";

import { useEffect, useState } from "react";

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
  signOutSession,
} from "@/lib/firebase-auth";
import { syncSignedInUser } from "@/lib/firestore-records";

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
    default:
      return "No se pudo completar la operacion con Firebase.";
  }
};

export const AppAccess = () => {
  const [sessionUser, setSessionUser] = useState<User | null | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [sessionWarning, setSessionWarning] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = observeAuthState((nextUser) => {
      setSessionUser(nextUser);
      setIsSubmitting(false);
      setErrorMessage(null);

      if (!nextUser) {
        setSessionWarning(null);
        return;
      }

      if (!canUseLiveDashboard(nextUser)) {
        setSessionWarning(null);
        return;
      }

      void syncSignedInUser(nextUser)
        .then(() => {
          setSessionWarning(null);
        })
        .catch(() => {
          setSessionWarning(
            "La sesion esta activa, pero Firestore no pudo sincronizar el perfil del usuario. Revisa las credenciales del proyecto y las reglas.",
          );
        });
    });

    return unsubscribe;
  }, []);

  const handleEmailAccess = async (email: string, password: string) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      await signInWithEmail(email, password);
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error));
      setIsSubmitting(false);
    }
  };

  const handlePasswordReset = async (email: string) => {
    if (!email.trim()) {
      setErrorMessage("Ingresa el correo para enviar la recuperacion de acceso.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      await requestPasswordReset(email);
      setInfoMessage("Si el correo existe, Firebase enviara un enlace para restablecer la clave.");
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

  if (sessionUser === undefined) {
    return (
      <main className="auth-loading-screen">
        <section className="auth-loading-card card">
          <LoaderCircle className="auth-loading-icon" size={28} />
          <strong>Conectando acceso Firebase</strong>
          <p>Validando sesion y preparando el tablero operativo.</p>
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
        onEmailAccess={handleEmailAccess}
        onPasswordReset={handlePasswordReset}
      />
    );
  }

  const accessLevel = getUserAccessLevel(sessionUser);

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
      sessionName={sessionUser.displayName}
      sessionEmail={sessionUser.email}
      sessionWarning={sessionWarning}
      onSignOut={handleSignOut}
    />
  );
};
