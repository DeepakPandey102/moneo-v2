import { useEffect } from "react";
import { useApp } from "../context/AppContext";

// Google One Tap: if the visitor is already signed into Google in this
// browser, a small "Continue as …" prompt appears (and returning users can be
// signed in automatically). Only runs when VITE_GOOGLE_CLIENT_ID is set.
//
// Security: we generate a random nonce, give Google its SHA-256 hash, and give
// Supabase the original. Supabase checks they match, so a stolen token can't
// be replayed.

function randomNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes));
}

async function sha256Hex(text) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

let scriptPromise = null;
function loadGsiScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = resolve;
      s.onerror = () => { scriptPromise = null; reject(new Error("GSI failed to load")); };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

export function useGoogleOneTap({ enabled = true, onError } = {}) {
  const { loginWithGoogleIdToken, t } = useApp();

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!enabled || !clientId || !window.crypto?.subtle) return;
    let cancelled = false;

    (async () => {
      try {
        await loadGsiScript();
        if (cancelled) return;
        const rawNonce = randomNonce();
        const hashedNonce = await sha256Hex(rawNonce);
        window.google.accounts.id.initialize({
          client_id: clientId,
          nonce: hashedNonce,
          auto_select: true,
          cancel_on_tap_outside: true,
          use_fedcm_for_prompt: true,
          callback: async ({ credential }) => {
            const result = await loginWithGoogleIdToken(credential, rawNonce);
            if (!result.ok) onError?.(t(result.error));
          },
        });
        window.google.accounts.id.prompt();
      } catch (err) {
        console.warn("Google One Tap unavailable:", err.message);
      }
    })();

    return () => {
      cancelled = true;
      try { window.google?.accounts?.id?.cancel(); } catch { /* ignore */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
