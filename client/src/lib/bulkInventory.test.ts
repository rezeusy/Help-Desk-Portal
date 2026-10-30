import { describe, expect, it } from 'vitest';
import {
  areAllVisibleSelected,
  toggleSelection,
  toggleVisibleSelection,
  validateBulkDeployForm,
} from './bulkInventory';

describe('Master Inventory bulk-action UI behavior', () => {
  it('selects and deselects individual inventory rows', () => {
    const selected = toggleSelection(new Set<string>(), 'laptop', true);
    expect(selected).toEqual(new Set(['laptop']));
    expect(toggleSelection(selected, 'laptop', false)).toEqual(new Set());
  });

  it('selects only the visible filtered rows and preserves hidden selections', () => {
    const existing = new Set(['hidden-item']);
    const selected = toggleVisibleSelection(existing, ['laptop', 'monitor'], true);

    expect(selected).toEqual(new Set(['hidden-item', 'laptop', 'monitor']));
    expect(areAllVisibleSelected(selected, ['laptop', 'monitor'])).toBe(true);

    const deselected = toggleVisibleSelection(selected, ['laptop', 'monitor'], false);
    expect(deselected).toEqual(new Set(['hidden-item']));
  });

  it('validates the bulk deploy office and quantity controls', () => {
    expect(validateBulkDeployForm('', '2')).toEqual({ valid: false, message: 'Choose an office' });
    expect(validateBulkDeployForm('office-a', '0')).toEqual({
      valid: false,
      message: 'Quantity must be a whole number greater than zero',
    });
    expect(validateBulkDeployForm('office-a', '2')).toEqual({ valid: true, quantity: 2 });
  });
});
