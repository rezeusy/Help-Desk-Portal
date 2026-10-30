import { useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Boxes, Check, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      toast.success("Welcome back");
      window.location.assign("/");
    },
    onError: (error) => toast.error(error.message || "Unable to sign in"),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !password) {
      toast.error("Enter your username and password");
      return;
    }
    loginMutation.mutate({ username: username.trim(), password });
  };

  return (
    <main className="surface-grid min-h-screen bg-[#11142a] px-4 py-6 text-white sm:px-8 sm:py-10">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1fr_460px] lg:gap-16">
        <section className="hidden lg:block">
          <div className="mb-12 flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#5367f2] shadow-[0_12px_28px_rgba(83,103,242,0.35)]"><Boxes className="h-5 w-5" /></span><div><p className="text-sm font-extrabold tracking-[0.08em]">IT GLOBAL</p><p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">LYNX - STARS · Inventory</p></div></div>
          <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.24em] text-[#aab4ff]">Everything in its place</p>
          <h1 className="max-w-xl text-5xl font-extrabold leading-[1.06] tracking-[-0.06em]">A clearer view of the equipment your team depends on.</h1>
          <p className="mt-6 max-w-lg text-base leading-8 text-slate-400">Manage inventory, record office receipts, and keep every deployment accountable from one calm workspace.</p>
          <div className="mt-10 grid max-w-lg gap-3 sm:grid-cols-2"><div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-4"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-300"><Check className="h-4 w-4" /></span><span className="text-sm text-slate-300">Live stock visibility</span></div><div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-4"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#8e9aff]/10 text-[#b9c0ff]"><ShieldCheck className="h-4 w-4" /></span><span className="text-sm text-slate-300">Role-aware access</span></div></div>
          <div className="mt-12 flex items-center gap-2 text-xs text-slate-500"><LockKeyhole className="h-4 w-4 text-emerald-400" />Your workspace is protected by secure sign-in.</div>
        </section>

        <Card className="rounded-[26px] border-white/10 bg-white text-slate-950 shadow-[0_28px_80px_rgba(0,0,0,0.28)]">
          <CardHeader className="space-y-4 p-7 pb-5 sm:p-8 sm:pb-5"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef0ff] text-[#5367f2]"><KeyRound className="h-5 w-5" /></div><div><p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#5367f2]">Secure access</p><CardTitle className="text-2xl font-extrabold tracking-[-0.04em]">Welcome back</CardTitle><p className="mt-2 text-sm leading-6 text-slate-500">Use the account created for you by an administrator.</p></div></CardHeader>
          <CardContent className="p-7 pt-2 sm:p-8 sm:pt-2"><form onSubmit={submit} className="space-y-5"><div className="space-y-2"><Label htmlFor="username" className="text-xs font-bold text-slate-700">Username</Label><Input id="username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="e.g. alex.it" className="h-11 rounded-xl bg-slate-50" /></div><div className="space-y-2"><div className="flex items-center justify-between"><Label htmlFor="password" className="text-xs font-bold text-slate-700">Password</Label><span className="text-[11px] text-slate-400">Minimum 8 characters</span></div><Input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" className="h-11 rounded-xl bg-slate-50" /></div><Button type="submit" className="h-11 w-full rounded-xl bg-[#5367f2] shadow-[0_8px_18px_rgba(83,103,242,0.2)] hover:bg-[#4457e6]" disabled={loginMutation.isPending}>{loginMutation.isPending ? "Signing in…" : <>Sign in <ArrowRight className="ml-2 h-4 w-4" /></>}</Button></form><div className="my-6 flex items-center gap-3"><Separator className="flex-1" /><span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">or</span><Separator className="flex-1" /></div><Button variant="outline" className="h-11 w-full rounded-xl border-slate-200 bg-white" onClick={() => { window.location.href = getLoginUrl(); }}>Continue with admin sign-in</Button><p className="mt-6 text-center text-xs text-slate-400"><Link href="/" className="font-semibold text-[#5367f2] underline underline-offset-4">Return to inventory</Link></p></CardContent>
        </Card>
      </div>
    </main>
  );
}
