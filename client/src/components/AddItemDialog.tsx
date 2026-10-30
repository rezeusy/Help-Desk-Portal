import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { COMPANIES } from '@/lib/companies';

const CATEGORIES = ['Computer', 'Accessories', 'Peripheral', 'Cables', 'Misc.'];

interface AddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { id: string; name: string; category: string; company: (typeof COMPANIES)[number]; totalQty: number; notes?: string }) => void;
  isLoading: boolean;
}

export function AddItemDialog({ open, onOpenChange, onSubmit, isLoading }: AddItemDialogProps) {
  const [formData, setFormData] = useState({ id: '', name: '', category: '', company: '', totalQty: 0, notes: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.id.trim()) {
      toast.error('Item ID is required');
      return;
    }
    if (!formData.name.trim()) {
      toast.error('Item Name is required');
      return;
    }
    if (!formData.category) {
      toast.error('Category is required');
      return;
    }
    if (!formData.company) {
      toast.error('Company ownership is required');
      return;
    }
    if (formData.totalQty <= 0) {
      toast.error('Total Quantity must be greater than 0');
      return;
    }
    onSubmit({
      id: formData.id.trim(),
      name: formData.name.trim(),
      category: formData.category,
      company: formData.company as (typeof COMPANIES)[number],
      totalQty: formData.totalQty,
      notes: formData.notes.trim() || undefined,
    });
    setFormData({ id: '', name: '', category: '', company: '', totalQty: 0, notes: '' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Add New Item</DialogTitle>
          <DialogDescription>Create a new inventory item with all required details</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="id" className="font-medium">Item ID <span className="text-destructive">*</span></Label>
            <Input
              id="id"
              placeholder="e.g., DSK-001"
              value={formData.id}
              onChange={(e) => setFormData({ ...formData, id: e.target.value })}
              disabled={isLoading}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="name" className="font-medium">Item Name <span className="text-destructive">*</span></Label>
            <Input
              id="name"
              placeholder="e.g., Desktop Computer"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              disabled={isLoading}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="category" className="font-medium">Category <span className="text-destructive">*</span></Label>
            <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
              <SelectTrigger id="category" disabled={isLoading} className="mt-1">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="company" className="font-medium">Company ownership <span className="text-destructive">*</span></Label>
            <Select value={formData.company} onValueChange={(value) => setFormData({ ...formData, company: value })}>
              <SelectTrigger id="company" disabled={isLoading} className="mt-1"><SelectValue placeholder="Select Globalstar or Globalynx" /></SelectTrigger>
              <SelectContent>{COMPANIES.map((company) => <SelectItem key={company} value={company}>{company}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="totalQty" className="font-medium">Total Quantity <span className="text-destructive">*</span></Label>
            <Input
              id="totalQty"
              type="number"
              min="1"
              placeholder="1"
              value={formData.totalQty || ''}
              onChange={(e) => setFormData({ ...formData, totalQty: parseInt(e.target.value) || 0 })}
              disabled={isLoading}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Additional notes..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              disabled={isLoading}
              className="min-h-20"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Adding...' : 'Add Item'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
