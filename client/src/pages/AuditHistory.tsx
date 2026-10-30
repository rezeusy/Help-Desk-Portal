import React, { useMemo, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ClipboardList, RotateCcw, Search } from 'lucide-react';

const ACTIONS = [
  { value: 'all', label: 'All changes' },
  { value: 'office_receipt_existing', label: 'Existing item receipt' },
  { value: 'office_receipt_new', label: 'New item receipt' },
  { value: 'office_quantity_update', label: 'Office quantity update' },
  { value: 'office_unassign', label: 'Office unassign' },
  { value: 'bulk_deploy', label: 'Bulk deployment' },
  { value: 'inventory_created', label: 'Master item created' },
  { value: 'inventory_stock_received', label: 'Master stock received' },
  { value: 'master_non_working_update', label: 'Unassigned condition update' },
  { value: 'inventory_updated', label: 'Master item updated' },
  { value: 'inventory_deleted', label: 'Master item deleted' },
  { value: 'office_created', label: 'Office created' },
  { value: 'office_deleted', label: 'Office deleted' },
  { value: 'user_created', label: 'User created' },
  { value: 'user_updated', label: 'User access updated' },
] as const;

const actionLabel = (action: string) => ACTIONS.find((entry) => entry.value === action)?.label || action.replaceAll('_', ' ');
const actionTone = (action: string) => {
  if (action.includes('receipt') || action === 'inventory_created' || action === 'office_created') return 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100';
  if (action.includes('delete') || action === 'office_unassign') return 'bg-red-100 text-red-700 hover:bg-red-100';
  if (action.includes('deploy') || action.includes('quantity') || action === 'inventory_stock_received' || action === 'master_non_working_update' || action.startsWith('user_')) return 'bg-blue-100 text-blue-700 hover:bg-blue-100';
  return 'bg-slate-100 text-slate-700 hover:bg-slate-100';
};

const releasedUnitsFromMetadata = (metadata: string | null | undefined) => {
  if (!metadata) return null;
  try {
    const parsed = JSON.parse(metadata) as { releasedUnits?: unknown };
    return typeof parsed.releasedUnits === 'number' ? parsed.releasedUnits : null;
  } catch {
    return null;
  }
};

const masterOnlyMetadata = (metadata: string | null | undefined) => {
  if (!metadata) return null;
  try {
    const parsed = JSON.parse(metadata) as { masterOnly?: unknown; officeAssigned?: unknown };
    return parsed.masterOnly === true || parsed.officeAssigned === false;
  } catch {
    return false;
  }
};

const masterNonWorkingQtyFromMetadata = (metadata: string | null | undefined) => {
  if (!metadata) return null;
  try {
    const parsed = JSON.parse(metadata) as { nonWorkingQty?: unknown };
    return typeof parsed.nonWorkingQty === 'number' ? parsed.nonWorkingQty : null;
  } catch {
    return null;
  }
};

const conditionChangeFromMetadata = (metadata: string | null | undefined) => {
  if (!metadata) return null;
  try {
    const parsed = JSON.parse(metadata) as { nonWorkingBefore?: unknown; nonWorkingAfter?: unknown };
    if (typeof parsed.nonWorkingBefore !== 'number' || typeof parsed.nonWorkingAfter !== 'number') return null;
    if (parsed.nonWorkingBefore === parsed.nonWorkingAfter) return null;
    return `${parsed.nonWorkingBefore} → ${parsed.nonWorkingAfter} non-working`;
  } catch {
    return null;
  }
};

const changeLabel = (event: { action: string; quantityDelta: number | null; quantityBefore?: number | null; quantityAfter?: number | null; metadata: string | null }) => {
  if (event.action === 'office_deleted') {
    const releasedUnits = releasedUnitsFromMetadata(event.metadata);
    if (releasedUnits !== null) return releasedUnits === 0 ? '0 released' : `+${releasedUnits} returned`;
  }
  const conditionChange = conditionChangeFromMetadata(event.metadata);
  const quantityChange = event.quantityDelta === null || event.quantityDelta === undefined ? null : `${event.quantityDelta > 0 ? '+' : ''}${event.quantityDelta}`;
  if (event.action === 'master_non_working_update' && typeof event.quantityBefore === 'number' && typeof event.quantityAfter === 'number') {
    return `${event.quantityBefore} → ${event.quantityAfter} unassigned non-working`;
  }
  if ((event.action === 'inventory_created' || event.action === 'inventory_stock_received') && masterOnlyMetadata(event.metadata)) {
    const nonWorkingQty = masterNonWorkingQtyFromMetadata(event.metadata);
    if (nonWorkingQty && nonWorkingQty > 0) return `${quantityChange || '—'} · +${nonWorkingQty} unassigned non-working`;
    return `${quantityChange || '—'} · Master Inventory only`;
  }
  if (conditionChange) return quantityChange && quantityChange !== '0' ? `${quantityChange} · ${conditionChange}` : conditionChange;
  return quantityChange || '—';
};

export default function AuditHistory() {
  const [action, setAction] = useState('all');
  const [search, setSearch] = useState('');
  const { data: events, isLoading, error, refetch } = trpc.audit.list.useQuery({
    limit: 200,
    offset: 0,
    action: action === 'all' ? undefined : action,
  });

  const filteredEvents = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return events || [];
    return (events || []).filter((event) => [
      event.itemId,
      event.itemName,
      event.locationName,
      event.actorName,
      event.action,
      event.metadata,
    ].some((value) => value?.toLowerCase().includes(term)));
  }, [events, search]);

  if (error) {
    return (
      <div className="space-y-7">
        <div>
          <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.24em] text-[#5367f2]">Accountability</p>
          <h1 className="text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">Audit history</h1>
        </div>
        <Card className="soft-panel rounded-2xl border-0 bg-white dark:bg-card">
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <ClipboardList className="h-10 w-10 text-muted-foreground" />
            <div>
              <h2 className="font-semibold">Audit history is temporarily unavailable</h2>
              <p className="mt-1 text-sm text-muted-foreground">We could not load the change log. Try again without losing any recorded events.</p>
            </div>
            <Button variant="outline" onClick={() => refetch()}>Try again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.24em] text-[#5367f2]">Accountability</p>
          <h1 className="text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">Audit history</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">A permanent record of inventory, office, and receipt changes.</p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isLoading} className="h-10 rounded-xl bg-white dark:bg-card"><RotateCcw className="mr-2 h-4 w-4" />Refresh history</Button>
      </div>

      <Card className="soft-panel rounded-2xl border-0 bg-white dark:bg-card">
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search item, office, actor, or action" className="pl-9" />
          </div>
          <select value={action} onChange={(event) => setAction(event.target.value)} className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm md:w-64">
            {ACTIONS.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
          </select>
        </CardContent>
      </Card>

      <Card className="soft-panel overflow-hidden rounded-2xl border-0 bg-white dark:bg-card">
        <CardHeader className="border-b border-border/70 bg-[#fafaff] px-6 py-5 dark:bg-white/[0.03]"><CardTitle className="flex items-center gap-2 text-base font-bold tracking-tight"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#eef0ff] text-[#5367f2] dark:bg-[#2b3155]"><ClipboardList className="h-4 w-4" /></span>Change log <span className="data-mono text-xs font-normal text-muted-foreground">{filteredEvents.length} events</span></CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-0 bg-[#f7f8fc] hover:bg-[#f7f8fc] dark:bg-white/[0.03] dark:hover:bg-white/[0.03]">
                  <TableHead className="text-[10px] font-extrabold uppercase tracking-[0.12em]">Date and time</TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase tracking-[0.12em]">Action</TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase tracking-[0.12em]">Item</TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase tracking-[0.12em]">Office</TableHead>
                  <TableHead className="text-right text-[10px] font-extrabold uppercase tracking-[0.12em]">Change</TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase tracking-[0.12em]">By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="py-12 text-center text-muted-foreground">Loading audit history…</TableCell></TableRow>
                ) : filteredEvents.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="py-12 text-center text-muted-foreground">No audit events match the current filters.</TableCell></TableRow>
                ) : filteredEvents.map((event) => (
                  <TableRow key={event.id} className="hover:bg-[#f8f8ff] dark:hover:bg-white/[0.03]">
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</TableCell>
                    <TableCell><Badge className={actionTone(event.action)}>{actionLabel(event.action)}</Badge></TableCell>
                    <TableCell><div className="font-medium">{event.itemName || '—'}</div><div className="font-mono text-xs text-muted-foreground">{event.itemId || '—'}</div></TableCell>
                    <TableCell>{event.locationName || (masterOnlyMetadata(event.metadata) ? 'Unassigned' : '—')}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{changeLabel(event)}</TableCell>
                    <TableCell className="text-sm">{event.actorName || 'System'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
