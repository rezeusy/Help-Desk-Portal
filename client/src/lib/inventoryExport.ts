import * as XLSX from 'xlsx';

export type ExportInventoryItem = {
  id: string;
  name: string;
  category: string;
  company?: string | null;
  totalQty: number;
  deployedQty?: number | null;
  notes?: string | null;
};

export type ExportLocationItem = {
  itemId: string;
  deployedQty?: number | null;
};

export type ExportLocation = {
  id: string;
  name: string;
  items: ExportLocationItem[];
};

export type InventoryWorkbookData = {
  items: ExportInventoryItem[];
  locations: ExportLocation[];
};

const numberValue = (value: number | null | undefined) => Number(value ?? 0);

const setColumnWidths = (sheet: XLSX.WorkSheet, widths: number[]) => {
  sheet['!cols'] = widths.map((wch) => ({ wch }));
};

export function buildInventoryWorkbook({ items, locations }: InventoryWorkbookData, generatedAt = new Date()) {
  const normalizedItems = [...items].sort((a, b) => a.name.localeCompare(b.name));
  const normalizedLocations = [...locations].sort((a, b) => a.name.localeCompare(b.name));
  const itemById = new Map(normalizedItems.map((item) => [item.id, item]));

  const masterRows = normalizedItems.map((item) => {
    const deployedQty = numberValue(item.deployedQty);
    return {
      'Item ID': item.id,
      'Item Name': item.name,
      Category: item.category,
      Company: item.company || 'Needs assignment',
      'Total Quantity': item.totalQty,
      'Deployed Quantity': deployedQty,
      'Available Quantity': item.totalQty - deployedQty,
      Notes: item.notes || '',
    };
  });

  const officeDetailRows = normalizedLocations.flatMap((location) =>
    [...(location.items || [])]
      .sort((a, b) => a.itemId.localeCompare(b.itemId))
      .map((assignment) => {
        const item = itemById.get(assignment.itemId);
        return {
          'Office ID': location.id,
          'Office Name': location.name,
          'Item ID': assignment.itemId,
          'Item Name': item?.name || '(Item no longer in master inventory)',
          Company: item?.company || 'Needs assignment',
          Category: item?.category || '',
          'Deployed Quantity': numberValue(assignment.deployedQty),
          'Master Total Quantity': item?.totalQty ?? 0,
          'Master Available Quantity': item ? item.totalQty - numberValue(item.deployedQty) : 0,
        };
      }),
  );

  const officeSummaryRows = normalizedLocations.map((location) => {
    const assignments = (location.items || []).filter((assignment) => numberValue(assignment.deployedQty) > 0);
    return {
      'Office ID': location.id,
      'Office Name': location.name,
      'Unique Item Types': assignments.length,
      'Deployed Units': assignments.reduce((total, assignment) => total + numberValue(assignment.deployedQty), 0),
    };
  });

  const totalUnits = normalizedItems.reduce((total, item) => total + item.totalQty, 0);
  const deployedUnits = normalizedItems.reduce((total, item) => total + numberValue(item.deployedQty), 0);
  const assignmentLines = officeDetailRows.length;
  const summaryRows = [
    { Metric: 'Report Generated', Value: generatedAt.toISOString() },
    { Metric: 'Master Inventory Item Types', Value: normalizedItems.length },
    { Metric: 'Total Inventory Units', Value: totalUnits },
    { Metric: 'Deployed Units', Value: deployedUnits },
    { Metric: 'Available Units', Value: totalUnits - deployedUnits },
    { Metric: 'Offices Tracked', Value: normalizedLocations.length },
    { Metric: 'Office Assignment Lines', Value: assignmentLines },
  ];

  const workbook = XLSX.utils.book_new();
  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  const masterSheet = XLSX.utils.json_to_sheet(masterRows);
  const officeSummarySheet = XLSX.utils.json_to_sheet(officeSummaryRows);
  const officeDetailSheet = XLSX.utils.json_to_sheet(officeDetailRows);

  setColumnWidths(summarySheet, [34, 28]);
  setColumnWidths(masterSheet, [14, 30, 18, 18, 18, 20, 20, 42]);
  setColumnWidths(officeSummarySheet, [14, 30, 20, 18]);
  setColumnWidths(officeDetailSheet, [14, 28, 14, 30, 18, 18, 20, 22, 24]);

  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
  XLSX.utils.book_append_sheet(workbook, masterSheet, 'Master Inventory');
  XLSX.utils.book_append_sheet(workbook, officeSummarySheet, 'Office Summary');
  XLSX.utils.book_append_sheet(workbook, officeDetailSheet, 'Office Detail');

  return workbook;
}

export function exportInventoryWorkbook(data: InventoryWorkbookData, generatedAt = new Date()) {
  const workbook = buildInventoryWorkbook(data, generatedAt);
  const dateStamp = generatedAt.toISOString().slice(0, 10);
  const filename = `it-inventory-summary-${dateStamp}.xlsx`;
  XLSX.writeFile(workbook, filename);
  return filename;
}
