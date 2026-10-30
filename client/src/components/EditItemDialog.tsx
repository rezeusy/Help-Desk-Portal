import { useState, useEffect } from 'react';
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
import { COMPANIES } from '@/lib/companies';

const CATEGORIES = ['Computer', 'Accessories', 'Peripheral', 'Cables', 'Misc.'];

interface EditItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: any;
  onSubmit: (data: { id: string; name?: string; category?: string; company?: (typeof COMPANIES)[number]; totalQty?: number; notes?: string }) => void;
  isLoading: boolean;
}

export function EditItemDialog({ open, onOpenChange, item, onSubmit, isLoading }: EditItemDialogProps) {
  const [formData, setFormData] = useState({ name: '', category: '', company: '' as (typeof COMPANIES)[number] | '', totalQty: 0, notes: '' });

  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name,
        category: item.category,
        company: item.company || '',
        totalQty: item.totalQty,
        notes: item.notes || '',
      });
    }
  }, [item, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.category || !formData.company) {
      alert('Please fill in all required fields');
      return;
    }
    onSubmit({
      id: item.id,
      name: formData.name,
      category: formData.category,
      company: formData.company || undefined,
      totalQty: formData.totalQty,
      notes: formData.notes || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Item</DialogTitle>
          <DialogDescription>Update inventory item details</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="id">Item ID</Label>
            <Input id="id" value={item?.id} disabled className="bg-muted" />
          </div>
          <div>
            <Label htmlFor="name">Item Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              disabled={isLoading}
            />
          </div>
          <div>
            <Label htmlFor="category">Category *</Label>
            <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
              <SelectTrigger id="category" disabled={isLoading}>
                <SelectValue />
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
            <Label htmlFor="company">Company ownership *</Label>
            <Select value={formData.company} onValueChange={(value) => setFormData({ ...formData, company: value as (typeof COMPANIES)[number] })}>
              <SelectTrigger id="company" disabled={isLoading}><SelectValue placeholder="Select Globalstar or Globalynx" /></SelectTrigger>
              <SelectContent>{COMPANIES.map((company) => <SelectItem key={company} value={company}>{company}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="totalQty">Total Quantity *</Label>
            <Input
              id="totalQty"
              type="number"
              min="0"
              value={formData.totalQty}
              onChange={(e) => setFormData({ ...formData, totalQty: parseInt(e.target.value) || 0 })}
              disabled={isLoading}
            />
          </div>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
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
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
