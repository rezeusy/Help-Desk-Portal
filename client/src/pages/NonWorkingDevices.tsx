import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, PackagePlus, Search, Wrench } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CompanyBadge } from '@/components/CompanyBadge';
import { CategoryTag } from '@/components/CategoryTag';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

const CATEGORIES = ['Computer', 'Accessories', 'Peripheral', 'Cables', 'Misc.'] as const;
type AddMode = 'existing' | 'new';

export default function NonWorkingDevices() {
  const [search, setSearch] = useState('');
  const [company, setCompany] = useState('all');
  const [office, setOffice] = useState('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [destination, setDestination] = useState<'master' | 'office'>('office');
  const [addMode, setAddMode] = useState<AddMode>('existing');
  const [selectedOfficeId, setSelectedOfficeId] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [nonWorkingQty, setNonWorkingQty] = useState('1');
  const [newItemForm, setNewItemForm] = useState({
    id: '',
    name: '',
    category: 'Computer' as (typeof CATEGORIES)[number],
    company: '' as 'Globalstar' | 'Globalynx' | '',
    notes: '',
  });

  const nonWorkingQuery = trpc.reports?.nonWorking?.useQuery?.() ?? { data: [], isLoading: false };
  const officeQuery = trpc.locations?.list?.useQuery?.() ?? { data: [] };
  const inventoryQuery = trpc.inventory?.list?.useQuery?.() ?? { data: [] };
  const { data: rows, isLoading } = nonWorkingQuery;
  const { data: offices } = officeQuery;
  const { data: inventoryItems } = inventoryQuery;
  const utils = (trpc.useUtils?.() ?? {}) as any;

  const resetCreateForm = () => {
    setDestination('office');
    setSelectedOfficeId('');
    setSelectedItemId('');
    setQuantity('1');
    setNonWorkingQty('1');
    setAddMode('existing');
    setNewItemForm({ id: '', name: '', category: 'Computer', company: '', notes: '' });
  };

  const addMutation = (trpc.locationItems?.addToLocation?.useMutation?.({
    onSuccess: async (item) => {
      toast.success(`${item?.name || 'Device'} added as non-working`);
      await Promise.all([
        utils.reports?.nonWorking?.invalidate?.(),
        utils.inventory?.list?.invalidate?.(),
        utils.locations?.list?.invalidate?.(),
        utils.stats?.dashboard?.invalidate?.(),
        utils.reports?.inventoryExport?.invalidate?.(),
      ]);
      setShowCreateDialog(false);
      resetCreateForm();
    },
    onError: (error) => toast.error(error.message || 'Unable to add non-working device'),
  }) ?? { isPending: false, mutate: () => undefined });

  const masterCreateMutation = (trpc.inventory?.create?.useMutation?.({
    onSuccess: async (item) => {
      toast.success(`${item?.name || 'Item'} added to Master Inventory only`);
      await Promise.all([
        utils.inventory?.list?.invalidate?.(),
        utils.reports?.nonWorking?.invalidate?.(),
        utils.stats?.dashboard?.invalidate?.(),
        utils.reports?.inventoryExport?.invalidate?.(),
      ]);
      setShowCreateDialog(false);
      resetCreateForm();
    },
    onError: (error) => toast.error(error.message || 'Unable to create Master Inventory item'),
  }) ?? { isPending: false, mutate: () => undefined });

  const masterStockMutation = (trpc.inventory?.addStock?.useMutation?.({
    onSuccess: async (item) => {
      toast.success(`${item?.name || 'Item'} stock increased in Master Inventory only`);
      await Promise.all([
        utils.inventory?.list?.invalidate?.(),
        utils.reports?.nonWorking?.invalidate?.(),
        utils.stats?.dashboard?.invalidate?.(),
        utils.reports?.inventoryExport?.invalidate?.(),
      ]);
      setShowCreateDialog(false);
      resetCreateForm();
    },
    onError: (error) => toast.error(error.message || 'Unable to increase Master Inventory stock'),
  }) ?? { isPending: false, mutate: () => undefined });

  const masterRecoverMutation = (trpc.inventory?.updateMasterNonWorking?.useMutation?.({
    onSuccess: async () => {
      toast.success('Unassigned device marked as working');
      await Promise.all([
        utils.reports?.nonWorking?.invalidate?.(),
        utils.inventory?.list?.invalidate?.(),
        utils.stats?.dashboard?.invalidate?.(),
      ]);
    },
    onError: (error) => toast.error(error.message || 'Unable to update unassigned device condition'),
  }) ?? { isPending: false, mutate: () => undefined });

  const recoverMutation = (trpc.locationItems?.update?.useMutation?.({
    onSuccess: async () => {
      toast.success('Device marked as working');
      await Promise.all([
        utils.reports?.nonWorking?.invalidate?.(),
        utils.inventory?.list?.invalidate?.(),
        utils.locations?.list?.invalidate?.(),
        utils.stats?.dashboard?.invalidate?.(),
      ]);
    },
    onError: (error) => toast.error(error.message || 'Unable to update device condition'),
  }) ?? { isPending: false, mutate: () => undefined });

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (rows ?? []).filter((row) => {
      const matchesCompany = company === 'all' || row.item.company === company;
      const matchesOffice = office === 'all' || (office === 'unassigned' ? !row.location : row.location?.id === office);
      const searchable = [row.item.id, row.item.name, row.item.category, row.item.company, row.location?.name || 'Unassigned'].join(' ').toLowerCase();
      return matchesCompany && matchesOffice && (!query || searchable.includes(query));
    });
  }, [rows, search, company, office]);

  const totalNonWorking = filteredRows.reduce((sum, row) => sum + row.nonWorkingQty, 0);
  const totalAssigned = filteredRows.reduce((sum, row) => sum + row.deployedQty, 0);
  const officeList = offices ?? [];
  const itemList = inventoryItems ?? [];

  const openCreateDialog = () => {
    setSelectedOfficeId(officeList[0]?.id || '');
    setSelectedItemId(itemList[0]?.id || '');
    setShowCreateDialog(true);
  };

  const submitCreate = () => {
    const nextQuantity = Number(quantity);
    const nextNonWorking = Number(nonWorkingQty);
    if (destination === 'office' && !selectedOfficeId) {
      toast.error('Choose the office where the device is located');
      return;
    }
    if (!Number.isInteger(nextQuantity) || nextQuantity < 1) {
      toast.error('Quantity must be a whole number greater than zero');
      return;
    }
    if (destination === 'office' && (!Number.isInteger(nextNonWorking) || nextNonWorking < 1 || nextNonWorking > nextQuantity)) {
      toast.error('Non-working quantity must be between one and the quantity being added');
      return;
    }
    if (addMode === 'existing') {
      if (!selectedItemId) {
        toast.error('Choose an existing Master Inventory item');
        return;
      }
      if (destination === 'master') {
        masterStockMutation.mutate({ id: selectedItemId, quantity: nextQuantity, nonWorkingQty: nextNonWorking });
      } else {
        addMutation.mutate({ locationId: selectedOfficeId, itemId: selectedItemId, quantity: nextQuantity, nonWorkingQty: nextNonWorking });
      }
      return;
    }
    if (!newItemForm.id.trim() || !newItemForm.name.trim()) {
      toast.error('Enter an item ID and name for the new device');
      return;
    }
    if (!newItemForm.company) {
      toast.error('Choose whether this device belongs to Globalstar or Globalynx');
      return;
    }
    if (destination === 'master') {
      masterCreateMutation.mutate({
        id: newItemForm.id.trim(),
        name: newItemForm.name.trim(),
        category: newItemForm.category,
        company: newItemForm.company,
        totalQty: nextQuantity,
        nonWorkingQty: nextNonWorking,
        notes: newItemForm.notes.trim() || undefined,
      });
      return;
    }

    addMutation.mutate({
      locationId: selectedOfficeId,
      quantity: nextQuantity,
      nonWorkingQty: nextNonWorking,
      newItem: {
        id: newItemForm.id.trim(),
        name: newItemForm.name.trim(),
        category: newItemForm.category,
        company: newItemForm.company,
        notes: newItemForm.notes.trim() || undefined,
      },
    });
  };

  const isSubmitting = addMutation.isPending || masterCreateMutation.isPending || masterStockMutation.isPending;
  const isRecovering = recoverMutation.isPending || masterRecoverMutation.isPending;

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.24em] text-amber-600">Condition control</p>
          <h1 className="text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">Non-working devices</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Track assigned equipment that needs repair, quarantine, or disposal without losing its office assignment or changing the owned inventory total.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"><AlertTriangle className="h-4 w-4" /><span className="font-semibold">{totalNonWorking} units need attention</span></div>
          <Button onClick={openCreateDialog} className="h-10 rounded-xl bg-[#5367f2] shadow-[0_8px_18px_rgba(83,103,242,0.2)] hover:bg-[#4457e6]"><PackagePlus className="mr-2 h-4 w-4" />Add device</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="soft-panel rounded-2xl border-0 bg-white dark:bg-card"><CardContent className="p-5"><p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">Non-working units</p><p className="mt-2 text-3xl font-extrabold tracking-tight text-amber-600">{totalNonWorking}</p><p className="mt-1 text-xs text-muted-foreground">Within the current filters</p></CardContent></Card>
        <Card className="soft-panel rounded-2xl border-0 bg-white dark:bg-card"><CardContent className="p-5"><p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">Assigned device units</p><p className="mt-2 text-3xl font-extrabold tracking-tight">{totalAssigned}</p><p className="mt-1 text-xs text-muted-foreground">Working and non-working combined</p></CardContent></Card>
      </div>

      <Card className="soft-panel rounded-2xl border-0 bg-white dark:bg-card">
        <CardContent className="p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem_12rem]">
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search non-working devices" placeholder="Search by ID, name, category, company, or office..." value={search} onChange={(event) => setSearch(event.target.value)} className="h-11 rounded-xl bg-[#fafaff] pl-10 dark:bg-white/[0.04]" /></div>
            <select aria-label="Filter non-working devices by company" value={company} onChange={(event) => setCompany(event.target.value)} className="h-11 rounded-xl border border-input bg-background px-3 text-sm"><option value="all">All companies</option><option value="Globalstar">Globalstar</option><option value="Globalynx">Globalynx</option></select>
            <select aria-label="Filter non-working devices by office" value={office} onChange={(event) => setOffice(event.target.value)} className="h-11 rounded-xl border border-input bg-background px-3 text-sm"><option value="all">All offices</option><option value="unassigned">Unassigned</option>{officeList.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select>
          </div>
        </CardContent>
      </Card>

      <Card className="soft-panel overflow-hidden rounded-2xl border-0 bg-white dark:bg-card">
        <CardHeader className="border-b border-border/70 bg-[#fafaff] px-6 py-5 dark:bg-white/[0.03]"><div className="flex items-center justify-between gap-3"><div><CardTitle className="text-base font-bold tracking-tight">Devices needing attention</CardTitle><p className="mt-1 text-xs text-muted-foreground">{filteredRows.length} matching record{filteredRows.length === 1 ? '' : 's'}</p></div><Wrench className="h-5 w-5 text-amber-600" /></div></CardHeader>
        <CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b bg-[#f7f8fc] text-left dark:bg-white/[0.03]"><th className="px-6 py-3 text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Device</th><th className="px-4 py-3 text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Company</th><th className="px-4 py-3 text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Office</th><th className="px-4 py-3 text-right text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Non-working</th><th className="px-6 py-3 text-right text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Action</th></tr></thead><tbody>
          {isLoading ? <tr><td colSpan={5} className="px-6 py-10 text-center text-sm text-muted-foreground">Loading non-working devices…</td></tr> : filteredRows.length === 0 ? <tr><td colSpan={5} className="px-6 py-10 text-center text-sm text-muted-foreground">No non-working devices match the current filters.</td></tr> : filteredRows.map((row) => <tr key={`${row.location?.id ?? 'unassigned'}-${row.item.id}`} className="border-b border-border/60 last:border-0 hover:bg-[#fafaff] dark:hover:bg-white/[0.03]"><td className="px-6 py-4"><p className="font-semibold">{row.item.name}</p><p className="font-mono text-xs text-muted-foreground">{row.item.id} · <CategoryTag category={row.item.category} /></p></td><td className="px-4 py-4"><CompanyBadge company={row.item.company} /></td><td className="px-4 py-4 font-medium">{row.location?.name || 'Unassigned'}</td><td className="px-4 py-4 text-right font-mono font-semibold text-amber-600">{row.nonWorkingQty}</td><td className="px-6 py-4 text-right"><Button size="sm" variant="outline" className="rounded-lg" onClick={() => row.location ? recoverMutation.mutate({ locationId: row.location.id, itemId: row.item.id, deployedQty: row.deployedQty, nonWorkingQty: 0 }) : masterRecoverMutation.mutate({ id: row.item.id, nonWorkingQty: 0 })} disabled={isRecovering}><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />Mark working</Button></td></tr>)}
        </tbody></table></div></CardContent>
      </Card>

      <Dialog open={showCreateDialog} onOpenChange={(open) => { setShowCreateDialog(open); if (!open) resetCreateForm(); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{destination === 'master' ? 'Add unassigned non-working inventory' : 'Add a non-working device'}</DialogTitle>
            <DialogDescription>{destination === 'master' ? 'Add faulty stock to Master Inventory without assigning it to an office. It will appear in Non-working Devices as Office: Unassigned, while deployed office totals remain unchanged.' : 'Choose the office and record the device condition directly from this page. Existing assets increase their master total and office assignment together; new assets are created in Master Inventory automatically.'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><label className="text-sm font-medium">Add destination</label><div className="grid grid-cols-2 gap-2"><Button type="button" variant={destination === 'master' ? 'default' : 'outline'} onClick={() => setDestination('master')}>Master Inventory only</Button><Button type="button" variant={destination === 'office' ? 'default' : 'outline'} onClick={() => setDestination('office')} disabled={!officeList.length}>Assign to office</Button></div></div>
            {destination === 'office' && <div className="space-y-2"><label className="text-sm font-medium">Office</label><select aria-label="Office for non-working device" value={selectedOfficeId} onChange={(event) => setSelectedOfficeId(event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="">Choose an office...</option>{officeList.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></div>}
            <div className="grid grid-cols-2 gap-2"><Button type="button" variant={addMode === 'existing' ? 'default' : 'outline'} onClick={() => setAddMode('existing')} disabled={!itemList.length}>Existing master item</Button><Button type="button" variant={addMode === 'new' ? 'default' : 'outline'} onClick={() => setAddMode('new')}>Create new item</Button></div>
            {addMode === 'existing' ? <div className="space-y-2 rounded-lg border bg-slate-50 p-4 dark:bg-slate-900"><label className="text-sm font-medium">Master Inventory item</label><select aria-label="Master item for non-working device" value={selectedItemId} onChange={(event) => setSelectedItemId(event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="">Choose an item...</option>{itemList.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.id} · {item.company}</option>)}</select></div> : <div className="space-y-3 rounded-lg border bg-slate-50 p-4 dark:bg-slate-900"><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><label className="text-sm font-medium">Asset ID</label><Input value={newItemForm.id} onChange={(event) => setNewItemForm({ ...newItemForm, id: event.target.value })} placeholder="e.g. TMP-KEYBOARD" /></div><div className="space-y-2"><label className="text-sm font-medium">Device name</label><Input value={newItemForm.name} onChange={(event) => setNewItemForm({ ...newItemForm, name: event.target.value })} placeholder="e.g. Keyboard" /></div></div><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><label className="text-sm font-medium">Category</label><select value={newItemForm.category} onChange={(event) => setNewItemForm({ ...newItemForm, category: event.target.value as (typeof CATEGORIES)[number] })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">{CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select></div><div className="space-y-2"><label className="text-sm font-medium">Company</label><select aria-label="Company for new non-working device" value={newItemForm.company} onChange={(event) => setNewItemForm({ ...newItemForm, company: event.target.value as 'Globalstar' | 'Globalynx' | '' })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="">Choose company...</option><option value="Globalstar">Globalstar</option><option value="Globalynx">Globalynx</option></select></div></div><div className="space-y-2"><label className="text-sm font-medium">Notes <span className="font-normal text-muted-foreground">(optional)</span></label><Input value={newItemForm.notes} onChange={(event) => setNewItemForm({ ...newItemForm, notes: event.target.value })} placeholder="Repair, quarantine, or disposal note" /></div></div>}
            <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><label className="text-sm font-medium">{destination === 'master' ? 'Faulty stock quantity' : 'Quantity being added'}</label><Input type="number" min="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></div>{destination === 'office' ? <div className="space-y-2"><label className="text-sm font-medium">Non-working units</label><Input type="number" min="1" max={quantity} value={nonWorkingQty} onChange={(event) => setNonWorkingQty(event.target.value)} /><p className="text-xs text-muted-foreground">At least one unit is required in this direct workflow.</p></div> : <div className="flex items-end"><p className="text-xs leading-5 text-muted-foreground">These units are stored as non-working and shown under Office: Unassigned. Deploy them later only after they are ready.</p></div>}</div>
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)} disabled={isSubmitting}>Cancel</Button><Button type="button" onClick={submitCreate} disabled={isSubmitting || (destination === 'office' && !officeList.length)}>{isSubmitting ? 'Adding...' : destination === 'master' ? 'Add to Master Inventory' : 'Add non-working device'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
