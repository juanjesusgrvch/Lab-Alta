"use client";

import { useEffect, useRef, useState } from "react";

import Script from "next/script";

// Tipos
type TurnstileWidgetId = string;

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      theme?: "auto" | "light" | "dark";
      callback?: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
    },
  ) => TurnstileWidgetId;
  remove?: (widgetId: TurnstileWidgetId) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

interface TurnstileProps {
  siteKey: string;
  className?: string;
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
}

// Widget
export const Turnstile = ({
  siteKey,
  className,
  onVerify,
  onExpire,
  onError,
}: TurnstileProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<TurnstileWidgetId | null>(null);
  const onVerifyRef = useRef(onVerify);
  const onExpireRef = useRef(onExpire);
  const onErrorRef = useRef(onError);
  const [isScriptReady, setIsScriptReady] = useState(false);

  // Eventos
  useEffect(() => {
    onVerifyRef.current = onVerify;
    onExpireRef.current = onExpire;
    onErrorRef.current = onError;
  }, [onError, onExpire, onVerify]);

  useEffect(() => {
    if (!isScriptReady || !window.turnstile || !containerRef.current) {
      return;
    }

    if (widgetIdRef.current) {
      return;
    }

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      theme: "auto",
      callback: (token) => {
        onVerifyRef.current(token);
      },
      "expired-callback": () => {
        onExpireRef.current?.();
      },
      "error-callback": () => {
        onErrorRef.current?.();
      },
    });

    return () => {
      if (widgetIdRef.current && window.turnstile?.remove) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [isScriptReady, siteKey]);

  // Vista
  return (
    <>
      <Script
        id="cloudflare-turnstile"
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => {
          setIsScriptReady(true);
        }}
      />
      <div ref={containerRef} className={className} />
    </>
  );
};
