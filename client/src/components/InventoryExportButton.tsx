import React from 'react';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';
import { exportInventoryWorkbook } from '@/lib/inventoryExport';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function InventoryExportButton() {
  const { data: exportData, isLoading } = trpc.reports.inventoryExport.useQuery();
  const items = exportData?.items;
  const locations = exportData?.locations;

  const handleExport = () => {
    if (!items || !locations) {
      toast.error('Inventory data is still loading. Try again in a moment.');
      return;
    }

    try {
      const filename = exportInventoryWorkbook({ items, locations });
      toast.success(`Excel export downloaded: ${filename}`);
    } catch (error) {
      console.error('Inventory export failed', error);
      toast.error('Could not create the Excel export. Please try again.');
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleExport}
      disabled={isLoading}
      className="h-9 border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
      aria-label="Export inventory summary to Excel"
    >
      {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
      {isLoading ? 'Preparing…' : 'Export Excel'}
    </Button>
  );
}
