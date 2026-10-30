import { describe, expect, it } from 'vitest';
import { filterInventoryItems, filterOfficeItemsByCompany, type InventoryFilterItem, type InventoryFilterState } from './inventoryFilters';

const items: InventoryFilterItem[] = [
  { id: 'LAP-01', name: 'ThinkPad Laptop', category: 'Computer', company: 'Globalstar', totalQty: 12, deployedQty: 8, notes: 'Engineering pool' },
  { id: 'MON-02', name: '4K Monitor', category: 'Peripheral', company: 'Globalynx', totalQty: 6, deployedQty: 0, notes: 'Desk setup' },
  { id: 'CAB-03', name: 'USB-C Cable', category: 'Cables', company: null, totalQty: 3, deployedQty: 3, notes: null },
  { id: 'KEY-04', name: 'Wireless Keyboard', category: 'Accessories', company: 'Globalynx', totalQty: 8, deployedQty: 2, notes: 'Spare equipment' },
];

const baseFilters: InventoryFilterState = {
  searchQuery: '',
  category: '',
  deployment: 'all',
  stock: 'all',
  notes: 'all',
  sort: 'relevance',
};

describe('filterInventoryItems', () => {
  it('searches across IDs, names, categories, and notes', () => {
    expect(filterInventoryItems(items, { ...baseFilters, searchQuery: 'engineering' }).map((item) => item.id)).toEqual(['LAP-01']);
    expect(filterInventoryItems(items, { ...baseFilters, searchQuery: 'cables' }).map((item) => item.id)).toEqual(['CAB-03']);
    expect(filterInventoryItems(items, { ...baseFilters, searchQuery: 'MON-02' }).map((item) => item.id)).toEqual(['MON-02']);
  });

  it('filters and searches by company ownership', () => {
    expect(filterInventoryItems(items, { ...baseFilters, company: 'Globalynx' }).map((item) => item.id)).toEqual(['MON-02', 'KEY-04']);
    expect(filterInventoryItems(items, { ...baseFilters, company: 'unassigned' }).map((item) => item.id)).toEqual(['CAB-03']);
    expect(filterInventoryItems(items, { ...baseFilters, searchQuery: 'globalstar' }).map((item) => item.id)).toEqual(['LAP-01']);
  });

  it('filters mixed-office rows by company while excluding zero-quantity rows', () => {
    const officeItems = [
      { id: 'LAP-01', company: 'Globalstar', deployedQty: 3 },
      { id: 'MON-02', company: 'Globalynx', deployedQty: 2 },
      { id: 'CAB-03', company: null, deployedQty: 1 },
      { id: 'KEY-04', company: 'Globalstar', deployedQty: 0 },
    ];

    expect(filterOfficeItemsByCompany(officeItems, 'Globalstar').map((item) => item.id)).toEqual(['LAP-01']);
    expect(filterOfficeItemsByCompany(officeItems, 'Globalynx').map((item) => item.id)).toEqual(['MON-02']);
    expect(filterOfficeItemsByCompany(officeItems, 'unassigned').map((item) => item.id)).toEqual(['CAB-03']);
    expect(filterOfficeItemsByCompany(officeItems).map((item) => item.id)).toEqual(['LAP-01', 'MON-02', 'CAB-03']);
  });

  it('combines category, stock, deployment, and notes filters', () => {
    const result = filterInventoryItems(items, {
      ...baseFilters,
      category: 'Computer',
      deployment: 'partial',
      stock: 'in-stock',
      notes: 'with-notes',
    });

    expect(result.map((item) => item.id)).toEqual(['LAP-01']);
  });

  it('handles out-of-stock and without-notes states', () => {
    const result = filterInventoryItems(items, {
      ...baseFilters,
      deployment: 'fully-deployed',
      stock: 'out-of-stock',
      notes: 'without-notes',
    });

    expect(result.map((item) => item.id)).toEqual(['CAB-03']);
  });

  it('sorts by available quantity and uses relevance for search results', () => {
    expect(filterInventoryItems(items, { ...baseFilters, sort: 'available-desc' }).map((item) => item.id)).toEqual(['MON-02', 'KEY-04', 'LAP-01', 'CAB-03']);
    expect(filterInventoryItems(items, { ...baseFilters, searchQuery: 'lap', sort: 'relevance' }).map((item) => item.id)).toEqual(['LAP-01']);
  });
});
