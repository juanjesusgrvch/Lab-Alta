"use client";

import { Ban, ShieldCheck } from "lucide-react";

interface UnauthorizedScreenProps {
  sessionEmail?: string | null;
  sessionUid: string;
  accessLevel: "none";
  onSignOut: () => void;
}

export const UnauthorizedScreen = ({
  sessionEmail,
  sessionUid,
  accessLevel,
  onSignOut,
}: UnauthorizedScreenProps) => (
  <main className="auth-screen">
    <div className="auth-shell auth-shell--single">
      <section className="auth-panel card">
        <div className="auth-panel__header">
          <span className="eyebrow">Acceso restringido</span>
          <h2>La sesion existe, pero no esta habilitada para operar.</h2>
          <p>
            No eres usuario autorizado. Si esta no es la cuenta correcta, cierra
            sesion e ingresa con el usuario habilitado.
          </p>
        </div>

        <div className="auth-pill-row">
          <div className="auth-pill">
            <ShieldCheck size={16} />
            <span>{sessionEmail ?? "Usuario autenticado"}</span>
          </div>
          <div className="auth-pill">
            <Ban size={16} />
            <span>{sessionUid}</span>
          </div>
        </div>

        <p className="auth-message auth-message--error">
          {accessLevel === "none"
            ? "Esta cuenta no integra la lista de acceso habilitada."
            : "La cuenta no tiene permisos suficientes para operar."}
        </p>

        <button type="button" className="ghost-button" onClick={onSignOut}>
          Cerrar sesion
        </button>
      </section>
    </div>
  </main>
);
