"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/map` },
    });
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
  }

  return (
    <> <style>{`
        .page {
          min-height: 100vh;
          background: #0a0a0a;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          font-family: 'Geist Sans', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .bg-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(oklch(0.655 0.095 78.0 / 0.04) 1px, transparent 1px),
            linear-gradient(90deg, oklch(0.655 0.095 78.0 / 0.04) 1px, transparent 1px);
          background-size: 48px 48px;
        }

        .bg-glow {
          position: absolute;
          width: 600px;
          height: 600px;
          border-radius: 50%;
          background: radial-gradient(circle, oklch(0.655 0.095 78.0 / 0.07) 0%, transparent 70%);
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none;
        }

        .content {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0;
        }

        .eyebrow {
          font-family: 'Geist Sans', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: 10px;
          font-weight: 300;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          color: oklch(0.655 0.095 78.0);
          margin-bottom: 20px;
          opacity: 0;
          animation: fadeUp 0.6s ease forwards 0.1s;
        }

        .wordmark {
          font-family: 'Geist Sans', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: clamp(72px, 10vw, 120px);
          font-weight: 700;
          color: #fff;
          letter-spacing: -0.02em;
          line-height: 1;
          margin: 0;
          opacity: 0;
          animation: fadeUp 0.7s ease forwards 0.2s;
        }

        .wordmark span {
          color: oklch(0.655 0.095 78.0);
        }

        .tagline {
          font-family: 'Geist Sans', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: 12px;
          font-weight: 300;
          color: rgba(255,255,255,0.35);
          letter-spacing: 0.15em;
          margin-top: 16px;
          margin-bottom: 64px;
          opacity: 0;
          animation: fadeUp 0.7s ease forwards 0.35s;
        }

        .card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          padding: 40px;
          width: 380px;
          display: flex;
          flex-direction: column;
          gap: 24px;
          opacity: 0;
          animation: fadeUp 0.7s ease forwards 0.5s;
          backdrop-filter: blur(12px);
        }

        .card-label {
          font-family: 'Geist Sans', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: 10px;
          font-weight: 300;
          letter-spacing: 0.25em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.3);
          text-align: center;
        }

        .divider {
          height: 1px;
          background: rgba(255,255,255,0.06);
        }

        .btn-google {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          padding: 14px 24px;
          border-radius: 10px;
          background: oklch(0.655 0.095 78.0);
          border: none;
          color: #0a0a0a;
          font-family: 'Geist Sans', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: 12px;
          font-weight: 400;
          letter-spacing: 0.1em;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.15s;
        }

        .btn-google:hover {
          opacity: 0.88;
          transform: translateY(-1px);
        }

        .btn-google:active {
          transform: translateY(0);
        }

        .btn-secondary {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          padding: 14px 24px;
          border-radius: 10px;
          background: transparent;
          border: 1px solid rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.6);
          font-family: 'Geist Sans', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: 12px;
          font-weight: 300;
          letter-spacing: 0.1em;
          cursor: pointer;
          transition: border-color 0.2s, color 0.2s, transform 0.15s;
        }

        .btn-secondary:hover {
          border-color: rgba(255,255,255,0.25);
          color: rgba(255,255,255,0.9);
          transform: translateY(-1px);
        }

        .user-name {
          font-family: 'Geist Sans', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: 20px;
          font-weight: 400;
          color: #fff;
          text-align: center;
          letter-spacing: 0.02em;
        }

        .user-name span {
          color: oklch(0.655 0.095 78.0);
        }

        .corner-mark {
          position: absolute;
          font-family: 'Geist Sans', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: 10px;
          font-weight: 300;
          letter-spacing: 0.15em;
          color: rgba(255,255,255,0.12);
          opacity: 0;
          animation: fadeIn 1s ease forwards 1s;
        }
        .corner-mark.tl { top: 32px; left: 32px; }
        .corner-mark.tr { top: 32px; right: 32px; }
        .corner-mark.bl { bottom: 32px; left: 32px; }
        .corner-mark.br { bottom: 32px; right: 32px; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>

      <div className="page">
        <div className="bg-grid" />
        <div className="bg-glow" />

       
        <span className="corner-mark tr">pinnical.app</span>

        <div className="content">
          <p className="eyebrow">Welcome to</p>
          <h1 className="wordmark">Pinn<span>i</span>cal</h1>
          <p className="tagline">The Pinnacle of Connecting With Others</p>

          {user ? (
            <div className="card">
              <p className="user-name">
                Hello, <span>{user.user_metadata.full_name?.split(" ")[0]}</span>
              </p>
              <div className="divider" />
              <button className="btn-google" onClick={() => window.location.href = "/map"}>
                Open Map
              </button>
              <button className="btn-secondary" onClick={signOut}>
                Sign out
              </button>
            </div>
          ) : (
            <div className="card">
              <p className="card-label">Get started</p>
              <div className="divider" />
              <button className="btn-google" onClick={signInWithGoogle}>
                Sign in with Google
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
