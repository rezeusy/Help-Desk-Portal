export function toggleSelection(selectedIds: Set<string>, itemId: string, checked: boolean) {
  const next = new Set(selectedIds);
  if (checked) next.add(itemId);
  else next.delete(itemId);
  return next;
}

export function toggleVisibleSelection(
  selectedIds: Set<string>,
  visibleIds: string[],
  checked: boolean,
) {
  const next = new Set(selectedIds);
  visibleIds.forEach((itemId) => {
    if (checked) next.add(itemId);
    else next.delete(itemId);
  });
  return next;
}

export function areAllVisibleSelected(selectedIds: Set<string>, visibleIds: string[]) {
  return visibleIds.length > 0 && visibleIds.every((itemId) => selectedIds.has(itemId));
}

export function validateBulkDeployForm(locationId: string, quantityInput: string) {
  const quantity = Number(quantityInput);
  if (!locationId) return { valid: false as const, message: 'Choose an office' };
  if (!Number.isInteger(quantity) || quantity < 1) {
    return { valid: false as const, message: 'Quantity must be a whole number greater than zero' };
  }
  return { valid: true as const, quantity };
}
