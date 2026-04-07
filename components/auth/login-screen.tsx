"use client";

import { useState } from "react";

import { Database, FolderTree, LockKeyhole, ShieldCheck } from "lucide-react";

import { firestoreCollections, recordsWorkspaceFolders } from "@/lib/firebase";

interface LoginScreenProps {
  isSubmitting: boolean;
  errorMessage: string | null;
  infoMessage: string | null;
  onEmailAccess: (email: string, password: string) => Promise<void>;
  onPasswordReset: (email: string) => Promise<void>;
}

const accessCards = [
  {
    title: "Defectos",
    collection: firestoreCollections.defects,
    folder: recordsWorkspaceFolders.defects,
    description: "Registro base para analisis, hallazgos y trazabilidad por lote.",
  },
  {
    title: "Descargas",
    collection: firestoreCollections.downloads,
    folder: recordsWorkspaceFolders.downloads,
    description: "Entrada de ingresos operativos y seguimiento de recepcion.",
  },
  {
    title: "Muestras",
    collection: firestoreCollections.samples,
    folder: recordsWorkspaceFolders.samples,
    description: "Resguardo local y estructura lista para el control de deposito.",
  },
] as const;

export const LoginScreen = ({
  isSubmitting,
  errorMessage,
  infoMessage,
  onEmailAccess,
  onPasswordReset,
}: LoginScreenProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onEmailAccess(email, password);
  };

  return (
    <main className="auth-screen">
      <div className="auth-shell">
        <section className="auth-hero card">
          <span className="auth-badge">Repositorio listo para reiniciar</span>

          <div className="auth-hero__copy">
            <h1>Acceso Firebase para defectos, descargas y muestras.</h1>
            <p>
              La base del proyecto ya quedo limpia y preparada para trabajar por
              modulos. El ingreso ahora pasa por Firebase Authentication y la
              estructura de Firestore quedo alineada con los tres frentes operativos.
            </p>
          </div>

          <div className="auth-pill-row">
            <div className="auth-pill">
              <ShieldCheck size={16} />
              <span>Ingreso autenticado</span>
            </div>
            <div className="auth-pill">
              <Database size={16} />
              <span>Firestore listo</span>
            </div>
            <div className="auth-pill">
              <FolderTree size={16} />
              <span>Carpetas operativas creadas</span>
            </div>
          </div>

          <div className="auth-resource-grid">
            {accessCards.map((card) => (
              <article key={card.collection} className="auth-resource-card">
                <span>{card.title}</span>
                <strong>{card.collection}</strong>
                <p>{card.description}</p>
                <code>{card.folder}</code>
              </article>
            ))}
          </div>
        </section>

        <section className="auth-panel card">
          <div className="auth-panel__header">
            <span className="eyebrow">Login de entrada</span>
            <h2>Ingresar al tablero</h2>
            <p>
              Usa Email/Password de Firebase Authentication. Si aun no habilitaste
              el proveedor, puedes hacerlo desde Firebase Console o con Firebase CLI.
              Solo las cuentas asignadas en la allowlist interna podran abrir el
              dashboard real.
            </p>
          </div>

          {errorMessage ? (
            <p className="auth-message auth-message--error">{errorMessage}</p>
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
                onChange={(event) => setEmail(event.target.value)}
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
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Ingresa tu clave"
              />
            </label>

            <button type="submit" className="primary-button" disabled={isSubmitting}>
              <LockKeyhole size={16} />
              {isSubmitting ? "Ingresando..." : "Entrar"}
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
