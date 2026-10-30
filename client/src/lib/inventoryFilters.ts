import type { CompanyFilter } from './companies';

export type InventoryCategory = 'Computer' | 'Accessories' | 'Peripheral' | 'Cables' | 'Misc.';
export type DeploymentFilter = 'all' | 'available' | 'not-deployed' | 'partial' | 'fully-deployed';
export type StockFilter = 'all' | 'in-stock' | 'low-stock' | 'out-of-stock';
export type NotesFilter = 'all' | 'with-notes' | 'without-notes';
export type InventorySort = 'relevance' | 'name-asc' | 'available-desc' | 'deployed-desc' | 'total-desc';

export interface InventoryFilterItem {
  id: string;
  name: string;
  category: InventoryCategory | string;
  totalQty: number;
  deployedQty?: number | null;
  nonWorkingQty?: number | null;
  availableQty?: number | null;
  notes?: string | null;
  company?: string | null;
}

export interface InventoryFilterState {
  searchQuery: string;
  category: string;
  deployment: DeploymentFilter;
  stock: StockFilter;
  notes: NotesFilter;
  sort: InventorySort;
  company?: CompanyFilter;
}

export const LOW_STOCK_THRESHOLD = 5;

function normalized(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase();
}

function searchScore(item: InventoryFilterItem, query: string) {
  if (!query) return 0;

  const id = normalized(item.id);
  const name = normalized(item.name);
  const searchable = [id, name, normalized(item.category), normalized(item.company), normalized(item.notes)].join(' ');
  const terms = query.split(/\s+/).filter(Boolean);

  return terms.reduce((score, term) => {
    if (id === term) return score + 100;
    if (id.startsWith(term)) return score + 70;
    if (name.startsWith(term)) return score + 50;
    if (name.includes(term)) return score + 30;
    if (searchable.includes(term)) return score + 10;
    return score;
  }, 0);
}

function matchesDeploymentFilter(item: InventoryFilterItem, filter: DeploymentFilter, availableQty: number, deployedQty: number) {
  if (filter === 'all') return true;
  if (filter === 'available') return availableQty > 0;
  if (filter === 'not-deployed') return deployedQty === 0;
  if (filter === 'partial') return deployedQty > 0 && availableQty > 0;
  return item.totalQty > 0 && availableQty <= 0;
}

function matchesStockFilter(filter: StockFilter, availableQty: number) {
  if (filter === 'all') return true;
  if (filter === 'in-stock') return availableQty > 0;
  if (filter === 'low-stock') return availableQty > 0 && availableQty <= LOW_STOCK_THRESHOLD;
  return availableQty <= 0;
}

function matchesNotesFilter(filter: NotesFilter, notes: string) {
  if (filter === 'all') return true;
  if (filter === 'with-notes') return notes.length > 0;
  return notes.length === 0;
}

function matchesCompanyFilter(company: string | null | undefined, filter: CompanyFilter = 'all') {
  if (filter === 'all') return true;
  if (filter === 'unassigned') return !company;
  return company === filter;
}

export function filterOfficeItemsByCompany<T extends { company?: string | null; deployedQty?: number | null }>(items: T[], company: CompanyFilter = 'all') {
  return items.filter((item) => {
    if ((item.deployedQty ?? 0) <= 0) return false;
    if (company === 'all') return true;
    if (company === 'unassigned') return !item.company;
    return item.company === company;
  });
}

export function filterInventoryItems(items: InventoryFilterItem[], filters: InventoryFilterState) {
  const query = normalized(filters.searchQuery);

  return items
    .map((item, index) => {
      const totalQty = Math.max(0, item.totalQty ?? 0);
      const deployedQty = Math.max(0, item.deployedQty ?? 0);
      const availableQty = Math.max(0, item.availableQty ?? totalQty - deployedQty);
      const notes = normalized(item.notes);
      const searchable = [item.id, item.name, item.category, item.company ?? '', item.notes ?? ''].map(normalized).join(' ');
      const searchMatches = !query || query.split(/\s+/).filter(Boolean).every((term) => searchable.includes(term));

      return {
        item,
        index,
        availableQty,
        deployedQty,
        score: searchMatches ? searchScore(item, query) : -1,
        matches:
          searchMatches &&
          (!filters.category || item.category === filters.category) &&
          matchesCompanyFilter(item.company, filters.company) &&
          matchesDeploymentFilter(item, filters.deployment, availableQty, deployedQty) &&
          matchesStockFilter(filters.stock, availableQty) &&
          matchesNotesFilter(filters.notes, notes),
      };
    })
    .filter((entry) => entry.matches)
    .sort((a, b) => {
      if (filters.sort === 'relevance' && query && b.score !== a.score) return b.score - a.score;
      if (filters.sort === 'name-asc') return a.item.name.localeCompare(b.item.name);
      if (filters.sort === 'available-desc' && b.availableQty !== a.availableQty) return b.availableQty - a.availableQty;
      if (filters.sort === 'deployed-desc' && b.deployedQty !== a.deployedQty) return b.deployedQty - a.deployedQty;
      if (filters.sort === 'total-desc' && b.item.totalQty !== a.item.totalQty) return b.item.totalQty - a.item.totalQty;
      return a.index - b.index;
    })
    .map(({ item }) => item);
}
