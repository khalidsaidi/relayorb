"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";

type Phase = "checking" | "reset" | "verified" | "recovered" | "reset-done" | "error";
const API_KEY = "AIzaSyBz2_Itv-XF7e3q_03K2-Y5eFQNJ-D5WRE";

async function authRequest(endpoint: string, payload: Record<string, string>) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/${endpoint}?key=${encodeURIComponent(API_KEY)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      referrerPolicy: "no-referrer",
      redirect: "error",
    },
  );
  const result = (await response.json()) as { email?: string; error?: { message?: string } };
  if (!response.ok) throw new Error(result.error?.message ?? "ACTION_FAILED");
  return result;
}

export function EmailActionHandler({ mode, oobCode }: { mode: string; oobCode: string }) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    window.history.replaceState(null, "", window.location.pathname);
    if (started.current) return;
    started.current = true;
    if (!oobCode) { setPhase("error"); return; }

    const verify = async () => {
      try {
        if (mode === "verifyEmail" || mode === "recoverEmail") {
          await authRequest("accounts:update", { oobCode });
          setPhase(mode === "verifyEmail" ? "verified" : "recovered");
        } else if (mode === "resetPassword") {
          const result = await authRequest("accounts:resetPassword", { oobCode });
          setEmail(result.email ?? "");
          setPhase("reset");
        } else setPhase("error");
      } catch { setPhase("error"); }
    };
    void verify();
  }, [mode, oobCode]);

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 6 || password !== confirmation || busy) return;
    setBusy(true);
    try {
      await authRequest("accounts:resetPassword", { oobCode, newPassword: password });
      setPhase("reset-done");
    } catch { setPhase("error"); }
    finally { setBusy(false); }
  }

  return (
    <section className="w-full rounded-2xl border border-slate-700 bg-slate-950/90 p-7 text-slate-100 shadow-2xl sm:p-9">
      <p className="text-xs font-semibold tracking-[0.2em] text-cyan-300">RELAYORB</p>
      {phase === "checking" && <h1 className="mt-4 text-2xl font-semibold">Checking your link…</h1>}
      {phase === "verified" && <><h1 className="mt-4 text-2xl font-semibold">Email verified</h1><p className="mt-3 text-slate-300">Your email address is confirmed.</p></>}
      {phase === "recovered" && <><h1 className="mt-4 text-2xl font-semibold">Email change canceled</h1><p className="mt-3 text-slate-300">Your previous email address has been restored.</p></>}
      {phase === "reset" && <>
        <h1 className="mt-4 text-2xl font-semibold">Choose a new password</h1>
        {email && <p className="mt-2 text-slate-300">For {email}</p>}
        <form className="mt-6 grid gap-4" onSubmit={savePassword}>
          <label className="grid gap-2 text-sm font-medium">New password<input className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-base" type="password" autoComplete="new-password" minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <label className="grid gap-2 text-sm font-medium">Confirm password<input className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-base" type="password" autoComplete="new-password" minLength={6} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
          {password && confirmation && password !== confirmation && <p role="alert" className="text-sm text-rose-300">Passwords do not match.</p>}
          <button className="rounded-lg bg-cyan-300 px-4 py-3 font-semibold text-slate-950 disabled:opacity-60" type="submit" disabled={busy || password.length < 6 || password !== confirmation}>{busy ? "Updating…" : "Update password"}</button>
        </form>
      </>}
      {phase === "reset-done" && <><h1 className="mt-4 text-2xl font-semibold">Password updated</h1><p className="mt-3 text-slate-300">You can close this page and return to RelayOrb.</p></>}
      {phase === "error" && <><h1 className="mt-4 text-2xl font-semibold">This link can’t be used</h1><p className="mt-3 text-slate-300">It may have expired or already been used. Request a new email link and try again.</p></>}
      <Link className="mt-7 inline-block text-sm font-medium text-cyan-300 underline underline-offset-4" href="/">Return to RelayOrb</Link>
    </section>
  );
}
