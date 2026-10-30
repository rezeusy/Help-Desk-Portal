import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { CategoryTag } from '@/components/CategoryTag';
import { CompanyBadge } from '@/components/CompanyBadge';
import type { CompanyFilter } from '@/lib/companies';
import { AddItemDialog } from '@/components/AddItemDialog';
import { EditItemDialog } from '@/components/EditItemDialog';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';
import { ArrowUpDown, BriefcaseBusiness, Edit2, Filter, Plus, Search, Send, SlidersHorizontal, Trash2, Wrench, X } from 'lucide-react';
import { InventoryExportButton } from '@/components/InventoryExportButton';
import { toast } from 'sonner';
import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import {
  areAllVisibleSelected,
  toggleSelection,
  toggleVisibleSelection,
  validateBulkDeployForm,
} from '@/lib/bulkInventory';
import {
  filterInventoryItems,
  type DeploymentFilter,
  type InventorySort,
  type NotesFilter,
  type StockFilter,
} from '@/lib/inventoryFilters';

const CATEGORIES = ['Computer', 'Accessories', 'Peripheral', 'Cables', 'Misc.'] as const;

export default function MasterInventory() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterCompany, setFilterCompany] = useState<CompanyFilter>('all');
  const [filterDeployment, setFilterDeployment] = useState<DeploymentFilter>('all');
  const [filterStock, setFilterStock] = useState<StockFilter>('all');
  const [filterNotes, setFilterNotes] = useState<NotesFilter>('all');
  const [sortBy, setSortBy] = useState<InventorySort>('relevance');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [deletingItem, setDeletingItem] = useState<any>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [showBulkDeployDialog, setShowBulkDeployDialog] = useState(false);
  const [bulkDeployLocation, setBulkDeployLocation] = useState('');
  const [bulkDeployQty, setBulkDeployQty] = useState('1');
  const [, setLocation] = useLocation();

  const { data: items, isLoading, refetch } = trpc.inventory.list.useQuery();
  const { data: locations } = trpc.locations.list.useQuery();
  const utils = trpc.useUtils();

  const createMutation = trpc.inventory.create.useMutation({
    onSuccess: () => {
      toast.success('Item added successfully');
      refetch();
      setShowAddDialog(false);
    },
    onError: (error) => toast.error(error.message || 'Failed to add item'),
  });

  const updateMutation = trpc.inventory.update.useMutation({
    onSuccess: () => {
      toast.success('Item updated successfully');
      refetch();
      setShowEditDialog(false);
      setEditingItem(null);
    },
    onError: (error) => toast.error(error.message || 'Failed to update item'),
  });

  const deleteMutation = trpc.inventory.delete.useMutation({
    onSuccess: () => {
      toast.success('Item deleted successfully');
      refetch();
      setShowDeleteDialog(false);
      setDeletingItem(null);
    },
    onError: (error) => toast.error(error.message || 'Failed to delete item'),
  });

  const bulkDeleteMutation = trpc.inventory.bulkDelete.useMutation({
    onSuccess: ({ deletedCount }) => {
      toast.success(`${deletedCount} items deleted successfully`);
      refetch();
      utils.inventory.list.invalidate();
      utils.locations.list.invalidate();
      utils.stats.dashboard.invalidate();
      setShowBulkDeleteDialog(false);
      setSelectedItems(new Set());
    },
    onError: (error) => toast.error(error.message || 'Failed to delete selected items'),
  });

  const bulkDeployMutation = trpc.locationItems.bulkDeploy.useMutation({
    onSuccess: ({ deployedCount }) => {
      toast.success(`${deployedCount} items deployed successfully`);
      refetch();
      utils.inventory.list.invalidate();
      utils.locations.list.invalidate();
      utils.stats.dashboard.invalidate();
      setShowBulkDeployDialog(false);
      setSelectedItems(new Set());
      setBulkDeployLocation('');
      setBulkDeployQty('1');
    },
    onError: (error) => toast.error(error.message || 'Failed to deploy selected items'),
  });

  const filterState = useMemo(
    () => ({
      searchQuery,
      category: filterCategory,
      company: filterCompany,
      deployment: filterDeployment,
      stock: filterStock,
      notes: filterNotes,
      sort: sortBy,
    }),
    [searchQuery, filterCategory, filterCompany, filterDeployment, filterStock, filterNotes, sortBy],
  );

  const filteredItems = useMemo(() => filterInventoryItems(items ?? [], filterState), [items, filterState]);
  const activeFilterCount = [filterCategory, filterCompany !== 'all' ? filterCompany : '', filterDeployment !== 'all' ? filterDeployment : '', filterStock !== 'all' ? filterStock : '', filterNotes !== 'all' ? filterNotes : ''].filter(Boolean).length;
  const hasActiveFilters = Boolean(searchQuery.trim()) || activeFilterCount > 0 || sortBy !== 'relevance';

  const clearFilters = () => {
    setSearchQuery('');
    setFilterCategory('');
    setFilterCompany('all');
    setFilterDeployment('all');
    setFilterStock('all');
    setFilterNotes('all');
    setSortBy('relevance');
  };

  const visibleIds = filteredItems.map((item) => item.id);
  const allVisibleSelected = areAllVisibleSelected(selectedItems, visibleIds);

  const handleSelectAll = (checked: boolean) => {
    setSelectedItems(toggleVisibleSelection(selectedItems, visibleIds, checked));
  };

  const handleSelectItem = (itemId: string, checked: boolean) => {
    setSelectedItems(toggleSelection(selectedItems, itemId, checked));
  };

  const openBulkDeploy = () => {
    if (selectedItems.size === 0) {
      toast.error('Select at least one item first');
      return;
    }
    if (!locations?.length) {
      toast.error('Add an office before deploying items');
      return;
    }
    setBulkDeployLocation(locations[0].id);
    setShowBulkDeployDialog(true);
  };

  const confirmBulkDeploy = () => {
    const validation = validateBulkDeployForm(bulkDeployLocation, bulkDeployQty);
    if (!validation.valid) {
      toast.error(validation.message);
      return;
    }
    bulkDeployMutation.mutate({
      locationId: bulkDeployLocation,
      itemIds: Array.from(selectedItems),
      deployedQty: validation.quantity,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.24em] text-[#5367f2]">Asset control</p>
          <h1 className="text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">Master inventory</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Manage every IT asset, receipt, and deployment from one place.</p>
        </div>
        {selectedItems.size > 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-[#cdd3ff] bg-[#eef0ff] px-3 py-2 text-sm text-[#3f4fd2] dark:border-[#47518c] dark:bg-[#2b3155] dark:text-[#dbe0ff]">
            <span className="font-bold">{selectedItems.size} selected</span>
            <button type="button" className="rounded-md p-1 transition-colors hover:bg-[#dfe3ff] dark:hover:bg-white/10" onClick={() => setSelectedItems(new Set())} aria-label="Clear selection"><X className="h-4 w-4" /></button>
          </div>
        )}
      </div>

      <div className="soft-panel rounded-2xl border-0 bg-white p-4 dark:bg-card">
        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-[11.5rem_21.75rem_minmax(0,1fr)] xl:items-start xl:gap-3">
          <div className="min-w-0 sm:col-span-2 xl:col-span-1">
            <label className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">Search inventory</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search by ID, name, company, category, or notes..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-11 w-full rounded-xl bg-[#fafaff] pl-10 pr-10 dark:bg-white/[0.04]" />
              {searchQuery && <button type="button" onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-[#eef0ff] hover:text-[#5367f2] dark:hover:bg-white/10" aria-label="Clear search"><X className="h-4 w-4" /></button>}
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">Search across asset IDs, names, company ownership, categories, and notes.</p>
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:col-span-2 sm:grid-cols-2 sm:gap-4 xl:col-span-1 xl:gap-16 xl:pt-6">
            <div className="min-w-0">
              <label className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">Category</label>
            <Select value={filterCategory || 'all'} onValueChange={(value) => setFilterCategory(value === 'all' ? '' : value)}>
              <SelectTrigger className="h-11 w-full rounded-xl bg-[#fafaff] dark:bg-white/[0.04]"><SelectValue placeholder="All categories" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All categories</SelectItem>{CATEGORIES.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="min-w-0">
              <label className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">Company</label>
            <Select value={filterCompany} onValueChange={(value) => setFilterCompany(value as CompanyFilter)}>
              <SelectTrigger className="h-11 w-full rounded-xl bg-[#fafaff] dark:bg-white/[0.04]"><SelectValue placeholder="All companies" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All companies</SelectItem><SelectItem value="Globalstar">Globalstar</SelectItem><SelectItem value="Globalynx">Globalynx</SelectItem><SelectItem value="unassigned">Needs assignment</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex min-w-0 flex-wrap items-start gap-2 sm:col-span-2 xl:col-span-1 xl:justify-end xl:gap-2 xl:pl-12 xl:pt-6">
            <Button type="button" variant="outline" onClick={() => setShowAdvancedFilters((current) => !current)} className={`h-11 whitespace-nowrap rounded-xl ${showAdvancedFilters || activeFilterCount > 0 ? 'border-[#cdd3ff] bg-[#eef0ff] text-[#5367f2] dark:border-[#47518c] dark:bg-[#2b3155] dark:text-[#dbe0ff]' : ''}`}>
              <SlidersHorizontal className="mr-2 h-4 w-4" />Filters{activeFilterCount > 0 && <span className="ml-1.5 rounded-full bg-[#5367f2] px-1.5 py-0.5 text-[10px] font-bold text-white">{activeFilterCount}</span>}
            </Button>
            {selectedItems.size > 0 && <div className="flex gap-2"><Button variant="outline" onClick={openBulkDeploy} className="h-11 whitespace-nowrap rounded-xl border-[#cdd3ff] text-[#5367f2] hover:bg-[#eef0ff] dark:border-[#47518c] dark:hover:bg-[#2b3155]"><Send className="mr-2 h-4 w-4" />Deploy</Button><Button variant="destructive" onClick={() => setShowBulkDeleteDialog(true)} className="h-11 whitespace-nowrap rounded-xl"><Trash2 className="mr-2 h-4 w-4" />Delete</Button></div>}
            <div className="flex min-w-0 flex-wrap gap-2 xl:justify-end"><InventoryExportButton /><Button variant="outline" onClick={() => setLocation('/non-working')} className="h-11 whitespace-nowrap rounded-xl"><Wrench className="mr-2 h-4 w-4 text-amber-600" />Non-working</Button><Button onClick={() => setShowAddDialog(true)} className="h-11 whitespace-nowrap rounded-xl bg-[#5367f2] px-4 shadow-[0_8px_18px_rgba(83,103,242,0.2)] hover:bg-[#4457e6]"><Plus className="mr-2 h-4 w-4" />Add item</Button></div>
          </div>
        </div>

        {showAdvancedFilters && <div className="mt-4 grid gap-3 border-t border-border/70 pt-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">Deployment state</label>
            <Select value={filterDeployment} onValueChange={(value) => setFilterDeployment(value as DeploymentFilter)}>
              <SelectTrigger className="h-10 rounded-xl bg-[#fafaff] dark:bg-white/[0.04]"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Any deployment</SelectItem><SelectItem value="available">Has availability</SelectItem><SelectItem value="not-deployed">Not deployed</SelectItem><SelectItem value="partial">Partially deployed</SelectItem><SelectItem value="fully-deployed">Fully deployed</SelectItem></SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">Stock status</label>
            <Select value={filterStock} onValueChange={(value) => setFilterStock(value as StockFilter)}>
              <SelectTrigger className="h-10 rounded-xl bg-[#fafaff] dark:bg-white/[0.04]"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Any stock status</SelectItem><SelectItem value="in-stock">In stock</SelectItem><SelectItem value="low-stock">Low stock · 1–5</SelectItem><SelectItem value="out-of-stock">Out of stock</SelectItem></SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">Notes</label>
            <Select value={filterNotes} onValueChange={(value) => setFilterNotes(value as NotesFilter)}>
              <SelectTrigger className="h-10 rounded-xl bg-[#fafaff] dark:bg-white/[0.04]"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Any notes</SelectItem><SelectItem value="with-notes">With notes</SelectItem><SelectItem value="without-notes">Without notes</SelectItem></SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">Sort results</label>
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as InventorySort)}>
              <SelectTrigger className="h-10 rounded-xl bg-[#fafaff] dark:bg-white/[0.04]"><ArrowUpDown className="mr-2 h-3.5 w-3.5 text-muted-foreground" /><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="relevance">Relevance</SelectItem><SelectItem value="name-asc">Name · A to Z</SelectItem><SelectItem value="available-desc">Available · high to low</SelectItem><SelectItem value="deployed-desc">Deployed · high to low</SelectItem><SelectItem value="total-desc">Total · high to low</SelectItem></SelectContent>
            </Select>
          </div>
        </div>}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span><span className="data-mono font-semibold text-foreground">{filteredItems.length}</span> matching {filteredItems.length === 1 ? 'asset' : 'assets'} <span className="mx-1 text-border">/</span> {items?.length ?? 0} total</span>
          <div className="flex items-center gap-2">
            {hasActiveFilters ? <><span className="inline-flex items-center gap-1.5 rounded-full bg-[#eef0ff] px-2.5 py-1 font-medium text-[#5367f2] dark:bg-[#2b3155] dark:text-[#dbe0ff]"><Filter className="h-3 w-3" />Filters active</span><Button type="button" variant="ghost" size="sm" onClick={clearFilters} className="h-7 rounded-lg px-2 text-xs text-muted-foreground hover:text-[#5367f2]">Reset</Button></> : <span>Showing all inventory</span>}
          </div>
        </div>
      </div>

      <Card className="soft-panel overflow-hidden rounded-2xl border-0 bg-white dark:bg-card">
        <CardHeader className="border-b border-border/70 bg-[#fafaff] px-6 py-5 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between gap-3"><div><CardTitle className="text-base font-bold tracking-tight">Inventory items</CardTitle><p className="mt-1 text-xs text-muted-foreground">A live view of all tracked equipment. Deployed includes units assigned to offices; non-working is a tracked subset.</p></div><span className="data-mono rounded-full bg-[#eef0ff] px-2.5 py-1 text-[10px] font-medium text-[#5367f2] dark:bg-[#2b3155] dark:text-[#cdd3ff]">{filteredItems.length} visible</span></div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-0 bg-[#f7f8fc] hover:bg-[#f7f8fc] dark:bg-white/[0.03] dark:hover:bg-white/[0.03]">
                  <TableHead className="w-12">
                    <input type="checkbox" aria-label="Select all visible items" checked={allVisibleSelected} onChange={(event) => handleSelectAll(event.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-blue-600" />
                  </TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">ID</TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Company</TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Name</TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Category</TableHead>
                  <TableHead className="text-right text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Total</TableHead>
                  <TableHead className="text-right text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Deployed</TableHead>
                  <TableHead className="text-right text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Non-working</TableHead>
                  <TableHead className="text-right text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Available</TableHead>
                  <TableHead className="text-center text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Progress</TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Notes</TableHead>
                  <TableHead className="text-right text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length === 0 ? (
                  <TableRow>                  <TableCell colSpan={12} className="py-8 text-center text-sm text-muted-foreground">No items found</TableCell></TableRow>
                ) : filteredItems.map((item) => {
                  const available = item.availableQty ?? Math.max(0, item.totalQty - (item.deployedQty || 0));
                  const deploymentPercent = item.totalQty > 0 ? Math.min(100, Math.round(((item.deployedQty || 0) / item.totalQty) * 100)) : 0;
                  return (
                    <TableRow key={item.id} className={`transition-colors hover:bg-[#f8f8ff] dark:hover:bg-white/[0.03] ${selectedItems.has(item.id) ? 'bg-[#eef0ff] dark:bg-[#2b3155]' : ''}`}>
                      <TableCell className="w-12"><input type="checkbox" aria-label={`Select ${item.name}`} checked={selectedItems.has(item.id)} onChange={(event) => handleSelectItem(item.id, event.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-blue-600" /></TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{item.id}</TableCell>
                      <TableCell><CompanyBadge company={item.company} /></TableCell>
                      <TableCell className="font-medium text-sm">{item.name}</TableCell>
                      <TableCell><CategoryTag category={item.category} /></TableCell>
                      <TableCell className="text-right font-mono text-sm">{item.totalQty}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{item.deployedQty || 0}</TableCell>
                      <TableCell className={`text-right font-mono text-sm ${(item.nonWorkingQty || 0) > 0 ? 'font-semibold text-amber-600' : 'text-muted-foreground'}`}>{item.nonWorkingQty || 0}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{available}</TableCell>
                      <TableCell className="text-center"><div className="flex items-center justify-center gap-2"><div className="h-1.5 w-12 overflow-hidden rounded-full bg-[#e5e7f0] dark:bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-[#5367f2] to-[#8d99ff]" style={{ width: `${deploymentPercent}%` }} /></div><span className="w-8 text-right text-xs font-semibold text-muted-foreground">{deploymentPercent}%</span></div></TableCell>
                      <TableCell className="max-w-xs truncate text-xs text-muted-foreground">{item.notes || '—'}</TableCell>
                      <TableCell className="text-right"><div className="flex justify-end gap-1"><Button variant="ghost" size="sm" onClick={() => { setEditingItem(item); setShowEditDialog(true); }} className="h-7 w-7 p-0"><Edit2 className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="sm" onClick={() => { setDeletingItem(item); setShowDeleteDialog(true); }} className="h-7 w-7 p-0 text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button></div></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AddItemDialog open={showAddDialog} onOpenChange={setShowAddDialog} onSubmit={(data: any) => createMutation.mutate(data)} isLoading={createMutation.isPending} />
      {editingItem && <EditItemDialog open={showEditDialog} onOpenChange={setShowEditDialog} item={editingItem} onSubmit={(data: any) => updateMutation.mutate(data)} isLoading={updateMutation.isPending} />}
      {deletingItem && <DeleteConfirmDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog} title="Delete Item" description={`Are you sure you want to delete "${deletingItem.name}"? This action cannot be undone.`} onConfirm={() => deleteMutation.mutate(deletingItem.id)} isLoading={deleteMutation.isPending} />}

      <DeleteConfirmDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog} title={`Delete ${selectedItems.size} items?`} description="The selected inventory items and their location quantities will be permanently removed." onConfirm={() => bulkDeleteMutation.mutate(Array.from(selectedItems))} isLoading={bulkDeleteMutation.isPending} />

      <Dialog open={showBulkDeployDialog} onOpenChange={setShowBulkDeployDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deploy selected items</DialogTitle>
            <DialogDescription>Set the quantity for each selected item at the chosen office. Existing quantities at that office will be replaced.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Office</label>
              <Select value={bulkDeployLocation} onValueChange={setBulkDeployLocation}>
                <SelectTrigger><SelectValue placeholder="Choose an office" /></SelectTrigger>
                <SelectContent>{locations?.map((location) => <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Quantity per selected item</label>
              <Input type="number" min={1} step={1} value={bulkDeployQty} onChange={(event) => setBulkDeployQty(event.target.value)} />
              <p className="text-xs text-muted-foreground"><BriefcaseBusiness className="mr-1 inline h-3.5 w-3.5" />Stock availability is checked before any changes are saved.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDeployDialog(false)}>Cancel</Button>
            <Button onClick={confirmBulkDeploy} disabled={bulkDeployMutation.isPending}>{bulkDeployMutation.isPending ? 'Deploying…' : 'Deploy items'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

