import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { buildInventoryWorkbook } from './inventoryExport';

describe('inventory Excel export', () => {
  it('creates summary, master, office summary, and office detail worksheets', () => {
    const workbook = buildInventoryWorkbook({
      items: [
        { id: 'MON', name: 'Monitor', category: 'Peripheral', company: 'Globalynx', totalQty: 5, deployedQty: 2, notes: null },
        { id: 'LAP', name: 'Laptop', category: 'Computer', company: 'Globalstar', totalQty: 10, deployedQty: 4, notes: 'Refresh in 2027' },
      ],
      locations: [
        { id: 'HQ', name: 'Headquarters', items: [{ itemId: 'LAP', deployedQty: 3 }] },
        { id: 'BR', name: 'Branch Office', items: [{ itemId: 'MON', deployedQty: 2 }] },
        { id: 'EMPTY', name: 'Empty Office', items: [] },
      ],
    }, new Date('2026-08-25T00:00:00.000Z'));

    expect(workbook.SheetNames).toEqual(['Summary', 'Master Inventory', 'Office Summary', 'Office Detail']);

    const summary = XLSX.utils.sheet_to_json<{ Metric: string; Value: string | number }>(workbook.Sheets.Summary);
    expect(summary).toContainEqual({ Metric: 'Master Inventory Item Types', Value: 2 });
    expect(summary).toContainEqual({ Metric: 'Total Inventory Units', Value: 15 });
    expect(summary).toContainEqual({ Metric: 'Deployed Units', Value: 6 });
    expect(summary).toContainEqual({ Metric: 'Available Units', Value: 9 });
    expect(summary).toContainEqual({ Metric: 'Offices Tracked', Value: 3 });
    expect(summary).toContainEqual({ Metric: 'Office Assignment Lines', Value: 2 });

    const master = XLSX.utils.sheet_to_json<Record<string, string | number>>(workbook.Sheets['Master Inventory']);
    expect(master[0]).toMatchObject({ 'Item ID': 'LAP', Company: 'Globalstar', 'Total Quantity': 10, 'Deployed Quantity': 4, 'Available Quantity': 6 });
    expect(master[1]).toMatchObject({ 'Item ID': 'MON', Company: 'Globalynx', 'Total Quantity': 5, 'Deployed Quantity': 2, 'Available Quantity': 3 });

    const officeSummary = XLSX.utils.sheet_to_json<Record<string, string | number>>(workbook.Sheets['Office Summary']);
    expect(officeSummary).toContainEqual({ 'Office ID': 'EMPTY', 'Office Name': 'Empty Office', 'Unique Item Types': 0, 'Deployed Units': 0 });
    expect(officeSummary).toContainEqual({ 'Office ID': 'HQ', 'Office Name': 'Headquarters', 'Unique Item Types': 1, 'Deployed Units': 3 });

    const officeDetail = XLSX.utils.sheet_to_json<Record<string, string | number>>(workbook.Sheets['Office Detail']);
    expect(officeDetail).toHaveLength(2);
    expect(officeDetail).toContainEqual(expect.objectContaining({ 'Office Name': 'Headquarters', 'Item ID': 'LAP', Company: 'Globalstar', 'Deployed Quantity': 3 }));
    expect(officeDetail).toContainEqual(expect.objectContaining({ 'Office Name': 'Branch Office', 'Item ID': 'MON', Company: 'Globalynx', 'Deployed Quantity': 2 }));
  });
});
