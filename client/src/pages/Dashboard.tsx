import { trpc } from "@/lib/trpc";
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryTag } from "@/components/CategoryTag";
import { InventoryExportButton } from "@/components/InventoryExportButton";
import { ArrowUpRight, Boxes, Building2, CircleCheck, Package, TrendingUp } from "lucide-react";

const statCards = [
  { key: "totalItems", label: "Asset types", hint: "Tracked in master inventory", icon: Package, tone: "indigo" },
  { key: "totalQty", label: "Total units", hint: "Across all categories", icon: Boxes, tone: "violet" },
  { key: "availableQty", label: "Available", hint: "Ready to deploy", icon: CircleCheck, tone: "emerald" },
] as const;

export default function Dashboard() {
  const { data: stats, isLoading } = trpc.stats.dashboard.useQuery();

  if (isLoading) {
    return <div className="space-y-6"><div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]"><Skeleton className="h-64 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></div><div className="grid gap-4 lg:grid-cols-3"><Skeleton className="h-32 rounded-2xl" /><Skeleton className="h-32 rounded-2xl" /><Skeleton className="h-32 rounded-2xl" /></div><div className="grid gap-5 lg:grid-cols-2"><Skeleton className="h-72 rounded-2xl" /><Skeleton className="h-72 rounded-2xl" /></div></div>;
  }

  if (!stats) return null;

  const deploymentPercent = stats.totalQty > 0 ? Math.round((stats.deployedQty / stats.totalQty) * 100) : 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.24em] text-[#5367f2]">Operations overview</p>
          <h1 className="text-3xl font-extrabold tracking-[-0.04em] text-[#151a2d] dark:text-white sm:text-4xl">Good morning, team.</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Keep a clear view of what is in stock, what is deployed, and where your equipment is working.</p>
        </div>
        <InventoryExportButton />
      </header>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="surface-grid soft-panel overflow-hidden rounded-[22px] border-0 bg-[#1b2040] text-white">
          <CardContent className="relative flex h-full min-h-[260px] flex-col justify-between p-6 sm:p-8">
            <div className="absolute -right-20 -top-28 h-72 w-72 rounded-full bg-[#5367f2]/30 blur-3xl" />
            <div className="relative flex items-start justify-between gap-5">
              <div>
                <div className="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#b9c0ff]"><TrendingUp className="h-4 w-4" />Deployment pulse</div>
                <p className="text-5xl font-extrabold tracking-[-0.06em] sm:text-6xl">{deploymentPercent}<span className="text-3xl text-[#9ca8ff]">%</span></p>
                <p className="mt-2 text-sm text-slate-300">of all inventory units are currently deployed</p>
              </div>
              <div className="hidden rounded-2xl border border-white/10 bg-white/[0.08] px-3 py-2 text-right sm:block"><p className="data-mono text-lg font-medium text-[#dfe2ff]">{stats.deployedQty}</p><p className="text-[10px] uppercase tracking-wider text-slate-400">units live</p></div>
            </div>
            <div className="relative mt-8">
              <div className="mb-2 flex items-center justify-between text-xs text-slate-400"><span>Deployment coverage</span><span className="data-mono text-slate-300">{stats.availableQty} available</span></div>
              <div className="h-3 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-[#8491ff] to-[#c4c9ff] transition-all duration-500" style={{ width: `${deploymentPercent}%` }} /></div>
              <div className="mt-4 flex items-center gap-2 text-xs text-slate-400"><span className="h-2 w-2 rounded-full bg-[#aab4ff]" />A healthy baseline means every unit has a clear home.</div>
            </div>
          </CardContent>
        </Card>

        <Card className="soft-panel rounded-[22px] border-0 bg-white dark:bg-card">
          <CardHeader className="flex-row items-start justify-between space-y-0 p-6 pb-2"><div><p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-muted-foreground">Workspace pulse</p><CardTitle className="mt-2 text-lg font-bold tracking-tight">Inventory at a glance</CardTitle></div><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eef0ff] text-[#5367f2] dark:bg-[#2b3155]"><ArrowUpRight className="h-4 w-4" /></div></CardHeader>
          <CardContent className="space-y-4 p-6 pt-4"><div className="flex items-center justify-between border-b border-border/70 pb-4"><span className="text-sm text-muted-foreground">Total units</span><span className="data-mono text-lg font-medium">{stats.totalQty}</span></div><div className="flex items-center justify-between border-b border-border/70 pb-4"><span className="text-sm text-muted-foreground">Currently deployed</span><span className="data-mono text-lg font-medium text-[#5367f2]">{stats.deployedQty}</span></div><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Ready to deploy</span><span className="data-mono text-lg font-medium text-[#19956d]">{stats.availableQty}</span></div></CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {statCards.map(({ key, label, hint, icon: Icon, tone }) => {
          const value = stats[key];
          const toneClass = tone === "emerald" ? "bg-[#e4f7ef] text-[#178a68] dark:bg-[#173d35]" : tone === "violet" ? "bg-[#eee9ff] text-[#7659d5] dark:bg-[#302658]" : "bg-[#e9ecff] text-[#5367f2] dark:bg-[#29305c]";
          return <Card key={key} className="soft-panel rounded-2xl border-0 bg-white dark:bg-card"><CardContent className="flex items-start justify-between p-5"><div><p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">{label}</p><p className="data-mono mt-3 text-3xl font-medium tracking-[-0.05em]">{value}</p><p className="mt-1 text-xs text-muted-foreground">{hint}</p></div><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${toneClass}`}><Icon className="h-[18px] w-[18px]" /></div></CardContent></Card>;
        })}
      </section>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="soft-panel overflow-hidden rounded-2xl border-0 bg-white dark:bg-card"><CardHeader className="flex-row items-center justify-between space-y-0 border-b border-border/70 px-6 py-5"><div><CardTitle className="text-base font-bold tracking-tight">Inventory mix</CardTitle><p className="mt-1 text-xs text-muted-foreground">Where your units are concentrated</p></div><Boxes className="h-5 w-5 text-[#5367f2]" /></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow className="border-0 bg-[#fafaff] hover:bg-[#fafaff] dark:bg-white/[0.03] dark:hover:bg-white/[0.03]"><TableHead className="px-6 text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">Category</TableHead><TableHead className="text-right text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">Types</TableHead><TableHead className="px-6 text-right text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">Units</TableHead></TableRow></TableHeader><TableBody>{Object.entries(stats.byCategory).map(([category, data]) => <TableRow key={category} className="border-border/50 hover:bg-[#f8f8ff] dark:hover:bg-white/[0.03]"><TableCell className="px-6 py-4"><CategoryTag category={category as any} /></TableCell><TableCell className="data-mono text-right text-sm text-muted-foreground">{data.types}</TableCell><TableCell className="data-mono px-6 text-right text-sm font-medium">{data.units}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>

        <Card className="soft-panel overflow-hidden rounded-2xl border-0 bg-white dark:bg-card"><CardHeader className="flex-row items-center justify-between space-y-0 border-b border-border/70 px-6 py-5"><div><CardTitle className="text-base font-bold tracking-tight">Office coverage</CardTitle><p className="mt-1 text-xs text-muted-foreground">Deployed equipment by location</p></div><Building2 className="h-5 w-5 text-[#5367f2]" /></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow className="border-0 bg-[#fafaff] hover:bg-[#fafaff] dark:bg-white/[0.03] dark:hover:bg-white/[0.03]"><TableHead className="px-6 text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">Location</TableHead><TableHead className="text-right text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">Deployed</TableHead><TableHead className="px-6 text-right text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">Status</TableHead></TableRow></TableHeader><TableBody>{stats.locations.length === 0 ? <TableRow><TableCell colSpan={3} className="px-6 py-10 text-center text-sm text-muted-foreground">No offices yet</TableCell></TableRow> : stats.locations.map((loc) => <TableRow key={loc.id} className="border-border/50 hover:bg-[#f8f8ff] dark:hover:bg-white/[0.03]"><TableCell className="px-6 py-4"><div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#eef0ff] text-[#5367f2] dark:bg-[#2b3155]"><Building2 className="h-4 w-4" /></span><div><p className="text-sm font-semibold">{loc.name}</p><p className="text-xs text-muted-foreground">{loc.itemCount} item types</p></div></div></TableCell><TableCell className="data-mono text-right text-sm font-medium">{loc.deployed}</TableCell><TableCell className="px-6 text-right"><Badge className="border-0 bg-[#e4f7ef] text-[#178a68] hover:bg-[#e4f7ef] dark:bg-[#173d35] dark:text-[#77d9b8]">Active</Badge></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
      </section>
    </div>
  );
}
