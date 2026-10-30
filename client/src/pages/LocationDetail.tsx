import React, { useMemo, useState } from 'react';
import { useRoute } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { CategoryTag } from '@/components/CategoryTag';
import { CompanyBadge } from '@/components/CompanyBadge';
import { COMPANIES, type CompanyFilter } from '@/lib/companies';
import { filterOfficeItemsByCompany } from '@/lib/inventoryFilters';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { BriefcaseBusiness, Building2, PackagePlus } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIES = ['Computer', 'Accessories', 'Peripheral', 'Cables', 'Misc.'] as const;
type AddMode = 'existing' | 'new';

export default function LocationDetail() {
  const [, params] = useRoute('/location/:id');
  const locationId = params?.id as string;
  const [editingQty, setEditingQty] = useState<{ itemId: string; qty: number; nonWorkingQty: number } | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>('existing');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [companyFilter, setCompanyFilter] = useState<CompanyFilter>('all');
  const [newQty, setNewQty] = useState('1');
  const [newNonWorkingQty, setNewNonWorkingQty] = useState('0');
  const [newItemForm, setNewItemForm] = useState({
    id: '',
    name: '',
    category: 'Computer' as (typeof CATEGORIES)[number],
    company: '' as (typeof COMPANIES)[number] | '',
    notes: '',
  });

  const { data: locations, isLoading, refetch } = trpc.locations.list.useQuery();
  const { data: items } = trpc.inventory.list.useQuery();
  const utils = trpc.useUtils();

  const refreshInventoryViews = async () => {
    refetch();
    await Promise.all([
      utils.inventory.list.invalidate(),
      utils.locations.list.invalidate(),
      utils.stats.dashboard.invalidate(),
      utils.reports.nonWorking.invalidate(),
      utils.reports.inventoryExport.invalidate(),
    ]);
  };

  const updateMutation = trpc.locationItems.update.useMutation({
    onSuccess: async () => {
      toast.success('Office quantity updated');
      await refreshInventoryViews();
      setEditingQty(null);
    },
    onError: (error) => toast.error(error.message || 'Unable to update office quantity'),
  });

  const addToLocationMutation = trpc.locationItems.addToLocation.useMutation({
    onSuccess: async (item) => {
      toast.success(`${item?.name || 'Item'} added to this office and Master Inventory`);
      await refreshInventoryViews();
      setShowAddDialog(false);
      setSelectedItemId('');
      setNewQty('1');
      setNewNonWorkingQty('0');
      setNewItemForm({ id: '', name: '', category: 'Computer', company: '', notes: '' });
    },
    onError: (error) => toast.error(error.message || 'Unable to add item to this office'),
  });

  const deployExistingMutation = trpc.locationItems.update.useMutation({
    onSuccess: async () => {
      toast.success('Existing Master Inventory stock deployed to this office');
      await refreshInventoryViews();
      setShowAddDialog(false);
      setSelectedItemId('');
      setNewQty('1');
      setNewNonWorkingQty('0');
    },
    onError: (error) => toast.error(error.message || 'Unable to deploy existing stock'),
  });

  const location = useMemo(() => locations?.find((office) => office.id === locationId), [locations, locationId]);
  const locationItemsMap = useMemo(() => {
    if (!location?.items) return {};
    return location.items.reduce((acc, locationItem) => {
      acc[locationItem.itemId] = { deployedQty: locationItem.deployedQty, nonWorkingQty: locationItem.nonWorkingQty ?? 0 };
      return acc;
    }, {} as Record<string, { deployedQty: number; nonWorkingQty: number }>);
  }, [location]);

  const itemsWithQty = useMemo(() => {
    if (!items) return [];
    return items.map((item) => ({
      ...item,
      deployedQty: locationItemsMap[item.id]?.deployedQty || 0,
      nonWorkingQty: locationItemsMap[item.id]?.nonWorkingQty || 0,
    }));
  }, [items, locationItemsMap]);

  const deployedItems = itemsWithQty.filter((item) => item.deployedQty > 0);
  const visibleDeployedItems = filterOfficeItemsByCompany(itemsWithQty, companyFilter);
  const selectedMasterItem = itemsWithQty.find((item) => item.id === selectedItemId);

  const openAddDialog = () => {
    setAddMode(itemsWithQty.length ? 'existing' : 'new');
    setSelectedItemId(itemsWithQty[0]?.id || '');
    setNewQty('1');
    setNewNonWorkingQty('0');
    setShowAddDialog(true);
  };

  const submitOfficeAddition = () => {
    const quantity = Number(newQty);
    const nonWorkingQty = Number(newNonWorkingQty);
    if (!Number.isInteger(quantity) || quantity < 1) {
      toast.error('Quantity must be a whole number greater than zero');
      return;
    }
    if (!Number.isInteger(nonWorkingQty) || nonWorkingQty < 0 || nonWorkingQty > quantity) {
      toast.error('Non-working quantity must be between zero and the quantity being added');
      return;
    }

    if (addMode === 'existing') {
      if (!selectedItemId) {
        toast.error('Choose an existing Master Inventory item');
        return;
      }
      const selected = itemsWithQty.find((item) => item.id === selectedItemId);
      if (!selected) {
        toast.error('The selected Master Inventory item is no longer available');
        return;
      }
      const currentNonWorking = selected.nonWorkingQty;
      const available = selected.availableQty ?? Math.max(0, selected.totalQty - (selected.deployedQty ?? 0) - (selected.nonWorkingQty ?? 0));
      if (quantity > available) {
        toast.error(`Only ${available} available unit${available === 1 ? '' : 's'} remain for ${selected.name}`);
        return;
      }
      if (currentNonWorking + nonWorkingQty > selected.deployedQty + quantity) {
        toast.error('Non-working units cannot exceed the resulting office quantity');
        return;
      }
      deployExistingMutation.mutate({
        locationId,
        itemId: selectedItemId,
        deployedQty: selected.deployedQty + quantity,
        nonWorkingQty: currentNonWorking + nonWorkingQty,
      });
      return;
    }

    if (!newItemForm.id.trim() || !newItemForm.name.trim()) {
      toast.error('Enter an item ID and name for the new Master Inventory item');
      return;
    }
    if (!newItemForm.company) {
      toast.error('Choose whether this new item belongs to Globalstar or Globalynx');
      return;
    }

    addToLocationMutation.mutate({
      locationId,
      quantity,
      nonWorkingQty,
      newItem: {
        id: newItemForm.id.trim(),
        name: newItemForm.name.trim(),
        category: newItemForm.category,
        company: newItemForm.company,
        notes: newItemForm.notes.trim() || undefined,
      },
    });
  };

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-10" /><Skeleton className="h-64" /></div>;
  }

  if (!location) {
    return <div className="py-8 text-center text-muted-foreground">Location not found</div>;
  }

  const totalDeployed = itemsWithQty.reduce((sum, item) => sum + item.deployedQty, 0);

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.24em] text-[#5367f2]">Office inventory</p>
          <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef0ff] text-[#5367f2] dark:bg-[#2b3155]"><Building2 className="h-5 w-5" /></span><h1 className="text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">{location.name}</h1></div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground"><span className="data-mono font-medium text-foreground">{totalDeployed}</span> units assigned at this office.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select aria-label="Filter office inventory by company" value={companyFilter} onChange={(event) => setCompanyFilter(event.target.value as CompanyFilter)} className="h-10 rounded-xl border border-border bg-white px-3 text-xs font-semibold text-foreground shadow-sm outline-none focus:ring-2 focus:ring-[#5367f2]/30 dark:bg-card">
            <option value="all">All companies</option>
            <option value="Globalstar">Globalstar</option>
            <option value="Globalynx">Globalynx</option>
            <option value="unassigned">Needs assignment</option>
          </select>
          <Button onClick={openAddDialog} className="h-10 rounded-xl bg-[#5367f2] shadow-[0_8px_18px_rgba(83,103,242,0.2)] hover:bg-[#4457e6]"><PackagePlus className="mr-2 h-4 w-4" />Add item to office</Button>
        </div>
      </div>

      <Card className="soft-panel overflow-hidden rounded-2xl border-0 bg-white dark:bg-card">
        <CardHeader className="border-b border-border/70 bg-[#fafaff] px-6 py-5 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between gap-3"><div><CardTitle className="text-base font-bold tracking-tight">Items at this office</CardTitle><p className="mt-1 text-xs text-muted-foreground">Assigned equipment and live quantities</p></div><span className="data-mono rounded-full bg-[#eef0ff] px-2.5 py-1 text-[10px] font-medium text-[#5367f2] dark:bg-[#2b3155] dark:text-[#cdd3ff]">{visibleDeployedItems.length} of {deployedItems.length} types</span></div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-0 bg-[#f7f8fc] hover:bg-[#f7f8fc] dark:bg-white/[0.03] dark:hover:bg-white/[0.03]">
                  <TableHead className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">ID</TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Company</TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Name</TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Category</TableHead>
                  <TableHead className="text-right text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Master total</TableHead>
                  <TableHead className="text-right text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Master deployed</TableHead>
                  <TableHead className="text-right text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">At office</TableHead>
                  <TableHead className="text-right text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Non-working</TableHead>
                  <TableHead className="text-right text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleDeployedItems.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">{deployedItems.length === 0 ? 'No items assigned yet. Add an existing or new item from this office.' : 'No items match this company filter.'}</TableCell></TableRow>
                ) : visibleDeployedItems.map((item) => (
                  <TableRow key={item.id} className="transition-colors hover:bg-[#f8f8ff] dark:hover:bg-white/[0.03]">
                    <TableCell className="font-mono text-xs text-muted-foreground">{item.id}</TableCell>
                    <TableCell><CompanyBadge company={item.company} /></TableCell>
                    <TableCell className="font-medium text-sm">{item.name}</TableCell>
                    <TableCell><CategoryTag category={item.category} /></TableCell>
                    <TableCell className="text-right font-mono text-sm">{item.totalQty}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{item.deployedQty}</TableCell>
                    <TableCell className="text-right">
                      {editingQty?.itemId === item.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <div className="flex flex-col gap-1"><Input aria-label={`Working quantity for ${item.name}`} type="number" min="0" max={item.totalQty} value={editingQty.qty} onChange={(event) => setEditingQty({ ...editingQty, qty: Number(event.target.value) || 0 })} className="h-8 w-20 text-right font-mono text-sm" autoFocus /><Input aria-label={`Non-working quantity for ${item.name}`} type="number" min="0" max={editingQty.qty} value={editingQty.nonWorkingQty} onChange={(event) => setEditingQty({ ...editingQty, nonWorkingQty: Number(event.target.value) || 0 })} className="h-8 w-20 text-right font-mono text-sm" /></div>
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => updateMutation.mutate({ locationId, itemId: item.id, deployedQty: editingQty.qty, nonWorkingQty: editingQty.nonWorkingQty })} disabled={updateMutation.isPending}>Save</Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditingQty(null)} disabled={updateMutation.isPending}>Cancel</Button>
                        </div>
                      ) : <span className="font-mono text-sm">{item.deployedQty}</span>}
                    </TableCell>
                    <TableCell className="text-right"><span className={`font-mono text-sm ${item.nonWorkingQty > 0 ? 'font-semibold text-amber-600' : 'text-muted-foreground'}`}>{item.nonWorkingQty}</span></TableCell>
                    <TableCell className="text-right">
                      {editingQty?.itemId !== item.id && <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditingQty({ itemId: item.id, qty: item.deployedQty, nonWorkingQty: item.nonWorkingQty })}>Edit</Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add items to {location.name}</DialogTitle>
            <DialogDescription>
              Deploy available units from Master Inventory to this office, or receive genuinely new stock. Existing items consume available stock without increasing the Master Inventory total; new items add stock to both places.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant={addMode === 'existing' ? 'default' : 'outline'} onClick={() => setAddMode('existing')} disabled={!itemsWithQty.length}>Existing master item</Button>
              <Button type="button" variant={addMode === 'new' ? 'default' : 'outline'} onClick={() => setAddMode('new')}>Create new item</Button>
            </div>

            {addMode === 'existing' ? (
              <div className="space-y-3 rounded-lg border bg-slate-50 p-4 dark:bg-slate-900">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Master Inventory item</label>
                  <select value={selectedItemId} onChange={(event) => setSelectedItemId(event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    {itemsWithQty.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.id} · {item.company || 'Needs assignment'}</option>)}
                  </select>
                </div>
                {selectedMasterItem && <p className="text-xs text-muted-foreground"><BriefcaseBusiness className="mr-1 inline h-3.5 w-3.5" />Master total: {selectedMasterItem.totalQty} · Available to deploy: {selectedMasterItem.availableQty ?? Math.max(0, selectedMasterItem.totalQty - selectedMasterItem.deployedQty - selectedMasterItem.nonWorkingQty)}. Existing stock is transferred, not added.</p>}
              </div>
            ) : (
              <div className="space-y-3 rounded-lg border bg-slate-50 p-4 dark:bg-slate-900">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2"><label className="text-sm font-medium">Item ID</label><Input placeholder="e.g. LAP-001" value={newItemForm.id} onChange={(event) => setNewItemForm((current) => ({ ...current, id: event.target.value }))} /></div>
                  <div className="space-y-2"><label className="text-sm font-medium">Name</label><Input placeholder="e.g. Laptop" value={newItemForm.name} onChange={(event) => setNewItemForm((current) => ({ ...current, name: event.target.value }))} /></div>
                </div>
                <div className="space-y-2"><label className="text-sm font-medium">Category</label><select value={newItemForm.category} onChange={(event) => setNewItemForm((current) => ({ ...current, category: event.target.value as (typeof CATEGORIES)[number] }))} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">{CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select></div>
                <div className="space-y-2"><label className="text-sm font-medium">Company ownership <span className="text-destructive">*</span></label><select value={newItemForm.company} onChange={(event) => setNewItemForm((current) => ({ ...current, company: event.target.value as (typeof COMPANIES)[number] }))} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="" disabled>Select a company</option>{COMPANIES.map((company) => <option key={company} value={company}>{company}</option>)}</select></div>
                <div className="space-y-2"><label className="text-sm font-medium">Notes <span className="font-normal text-muted-foreground">(optional)</span></label><Input placeholder="Optional notes" value={newItemForm.notes} onChange={(event) => setNewItemForm((current) => ({ ...current, notes: event.target.value }))} /></div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">{addMode === 'existing' ? 'Quantity to deploy from Master Inventory' : 'Quantity being received'}</label>
              <Input type="number" min={1} step={1} value={newQty} onChange={(event) => setNewQty(event.target.value)} />
              <label className="text-sm font-medium">Non-working units</label>
              <Input type="number" min={0} step={1} max={Number(newQty) || 0} value={newNonWorkingQty} onChange={(event) => setNewNonWorkingQty(event.target.value)} />
              <p className="text-xs text-muted-foreground">Non-working units remain assigned to this office but are separated from working deployment totals for repair or disposal.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={submitOfficeAddition} disabled={addToLocationMutation.isPending || deployExistingMutation.isPending}>{addToLocationMutation.isPending || deployExistingMutation.isPending ? 'Saving…' : addMode === 'existing' ? 'Deploy existing stock' : 'Receive new stock'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
