"use client";

import { useState } from "react";

import { LockKeyhole } from "lucide-react";

import { Turnstile } from "@/components/auth/turnstile";

interface LoginScreenProps {
  isSubmitting: boolean;
  errorMessage: string | null;
  infoMessage: string | null;
  turnstileSiteKey: string;
  onGoogleAccess: () => Promise<void>;
  onEmailAccess: (
    email: string,
    password: string,
    turnstileToken: string,
  ) => Promise<void>;
  onPasswordReset: (email: string) => Promise<void>;
}

export const LoginScreen = ({
  isSubmitting,
  errorMessage,
  infoMessage,
  turnstileSiteKey,
  onGoogleAccess,
  onEmailAccess,
  onPasswordReset,
}: LoginScreenProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileError, setTurnstileError] = useState<string | null>(null);
  const [turnstileRenderKey, setTurnstileRenderKey] = useState(0);

  const resetTurnstileChallenge = () => {
    setTurnstileToken("");
    setTurnstileRenderKey((current) => current + 1);
  };

  const handleTurnstileFailure = () => {
    setTurnstileToken("");
    setTurnstileError(
      "La verificacion de seguridad expiro o fallo. Completa el desafio otra vez.",
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!turnstileSiteKey) {
      setTurnstileError(
        "Cloudflare Turnstile no esta configurado en el entorno actual.",
      );
      return;
    }

    if (!turnstileToken) {
      setTurnstileError(
        "Completa la verificacion de seguridad antes de intentar ingresar.",
      );
      return;
    }

    setTurnstileError(null);

    try {
      await onEmailAccess(email, password, turnstileToken);
    } finally {
      resetTurnstileChallenge();
    }
  };

  return (
    <main className="auth-screen">
      <div className="auth-shell auth-shell--single">
        <section className="auth-panel card">
          <div className="auth-panel__header">
            <span className="eyebrow">Login de entrada</span>
            <h2>Ingresar al tablero</h2>
            <p>
              Usa tu Email/Password asignado por la empresa. Puedes loguearte
              con Google si prefieres entrar en el modo 'Demo' sin afectar los
              datos reales.
            </p>
          </div>

          {turnstileError || errorMessage ? (
            <p className="auth-message auth-message--error">
              {turnstileError ?? errorMessage}
            </p>
          ) : null}

          {infoMessage ? (
            <p className="auth-message auth-message--info">{infoMessage}</p>
          ) : null}

          <form className="auth-form" onSubmit={handleSubmit}>
            <label>
              Correo
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setTurnstileError(null);
                }}
                placeholder="tu.usuario@empresa.com"
              />
            </label>

            <label>
              Clave
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setTurnstileError(null);
                }}
                placeholder="Ingresa tu clave"
              />
            </label>

            {turnstileSiteKey ? (
              <Turnstile
                key={turnstileRenderKey}
                siteKey={turnstileSiteKey}
                className="auth-turnstile"
                onVerify={(token) => {
                  setTurnstileToken(token);
                  setTurnstileError(null);
                }}
                onExpire={handleTurnstileFailure}
                onError={handleTurnstileFailure}
              />
            ) : (
              <p className="auth-message auth-message--error">
                No se pudo inicializar la verificacion de seguridad para este
                entorno.
              </p>
            )}

            <button
              type="submit"
              className="primary-button"
              disabled={isSubmitting}
            >
              <LockKeyhole size={16} />
              {isSubmitting ? "Ingresando..." : "Entrar"}
            </button>

            <button
              type="button"
              className="google-auth-button"
              onClick={() => void onGoogleAccess()}
              disabled={isSubmitting}
            >
              <span className="google-auth-button__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                  <path
                    fill="#4285F4"
                    d="M21.6 12.23c0-.72-.06-1.25-.19-1.8H12v3.4h5.53c-.11.84-.73 2.1-2.1 2.95l-.02.11 3.01 2.33.21.02c1.96-1.81 3.09-4.46 3.09-7.01Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 22c2.7 0 4.96-.89 6.62-2.41l-3.2-2.47c-.86.6-2 .97-3.42.97-2.65 0-4.89-1.75-5.69-4.16l-.11.01-3.13 2.42-.04.1A9.99 9.99 0 0 0 12 22Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M6.31 13.93A5.98 5.98 0 0 1 6 12c0-.67.11-1.32.29-1.93l-.01-.13-3.17-2.45-.1.05A10 10 0 0 0 2 12c0 1.61.38 3.14 1.05 4.46l3.26-2.53Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.91c1.79 0 2.99.77 3.68 1.41l2.69-2.62C16.95 3.37 14.7 2 12 2a9.99 9.99 0 0 0-8.95 5.54l3.28 2.53C7.14 7.66 9.36 5.91 12 5.91Z"
                  />
                </svg>
              </span>
              Continuar con Google
            </button>

            <button
              type="button"
              className="ghost-button"
              onClick={() => void onPasswordReset(email)}
              disabled={isSubmitting}
            >
              Recuperar acceso
            </button>
          </form>
        </section>
      </div>
    </main>
  );
};
