import React, { useState } from "react";
import { ArrowRight, Boxes, Check, KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ChangePassword() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const changePasswordMutation = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      toast.success("Password updated. Welcome to Northstar.");
      window.location.assign("/");
    },
    onError: (error) => toast.error(error.message || "Unable to update password"),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8) {
      toast.error("Use at least 8 characters");
      return;
    }
    if (password !== confirmation) {
      toast.error("Passwords do not match");
      return;
    }
    changePasswordMutation.mutate({ password });
  };

  return (
    <main className="surface-grid min-h-screen bg-[#11142a] px-4 py-6 text-white sm:px-8 sm:py-10">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1fr_460px] lg:gap-16">
        <section className="hidden lg:block"><div className="mb-12 flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#5367f2] shadow-[0_12px_28px_rgba(83,103,242,0.35)]"><Boxes className="h-5 w-5" /></span><div><p className="text-sm font-extrabold tracking-[0.08em]">NORTHSTAR</p><p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">Inventory workspace</p></div></div><p className="mb-4 text-[11px] font-bold uppercase tracking-[0.24em] text-[#aab4ff]">One quick security step</p><h1 className="max-w-xl text-5xl font-extrabold leading-[1.06] tracking-[-0.06em]">Make your workspace access private to you.</h1><p className="mt-6 max-w-lg text-base leading-8 text-slate-400">An administrator issued a temporary password for your account. Create a private password now to access the inventory workspace.</p><div className="mt-10 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-sm text-slate-300"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-300"><Check className="h-4 w-4" /></span>Your temporary password will be retired after this step.</div></section>

        <Card className="rounded-[26px] border-white/10 bg-white text-slate-950 shadow-[0_28px_80px_rgba(0,0,0,0.28)]"><CardHeader className="space-y-4 p-7 pb-5 sm:p-8 sm:pb-5"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef0ff] text-[#5367f2]"><KeyRound className="h-5 w-5" /></div><div><p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#5367f2]">Account security</p><CardTitle className="text-2xl font-extrabold tracking-[-0.04em]">Choose a new password</CardTitle><p className="mt-2 text-sm leading-6 text-slate-500">Your temporary password can no longer be used after this step.</p></div></CardHeader><CardContent className="p-7 pt-2 sm:p-8 sm:pt-2"><form onSubmit={submit} className="space-y-5"><div className="space-y-2"><Label htmlFor="new-password" className="text-xs font-bold text-slate-700">New password</Label><Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" className="h-11 rounded-xl bg-slate-50" /></div><div className="space-y-2"><Label htmlFor="confirm-password" className="text-xs font-bold text-slate-700">Confirm new password</Label><Input id="confirm-password" type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Enter it again" className="h-11 rounded-xl bg-slate-50" /></div><Button type="submit" className="h-11 w-full rounded-xl bg-[#5367f2] shadow-[0_8px_18px_rgba(83,103,242,0.2)] hover:bg-[#4457e6]" disabled={changePasswordMutation.isPending}>{changePasswordMutation.isPending ? "Updating password…" : <>Update password <ArrowRight className="ml-2 h-4 w-4" /></>}</Button></form><p className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400"><ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />Passwords are stored securely.</p></CardContent></Card>
      </div>
    </main>
  );
}
