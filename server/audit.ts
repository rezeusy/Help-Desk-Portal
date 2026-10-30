import type { InsertAuditEvent } from '../drizzle/schema';

type AuditActor = { id?: number; name?: string | null };

type OfficeReceiptAuditInput = {
  action: 'office_receipt_existing' | 'office_receipt_new';
  itemId: string;
  itemName: string;
  locationId: string;
  locationName: string;
  quantity: number;
  officeQtyBefore: number;
  officeQtyAfter: number;
  masterTotalBefore: number;
  masterTotalAfter: number;
  nonWorkingBefore?: number;
  nonWorkingAfter?: number;
  actor?: AuditActor;
};

export function buildOfficeReceiptAuditEvent(input: OfficeReceiptAuditInput): InsertAuditEvent {
  return {
    action: input.action,
    itemId: input.itemId,
    itemName: input.itemName,
    locationId: input.locationId,
    locationName: input.locationName,
    quantityDelta: input.quantity,
    quantityBefore: input.officeQtyBefore,
    quantityAfter: input.officeQtyAfter,
    actorId: input.actor?.id,
    actorName: input.actor?.name || null,
    metadata: JSON.stringify({
      masterTotalBefore: input.masterTotalBefore,
      masterTotalAfter: input.masterTotalAfter,
      officeQtyBefore: input.officeQtyBefore,
      officeQtyAfter: input.officeQtyAfter,
      nonWorkingBefore: input.nonWorkingBefore ?? 0,
      nonWorkingAfter: input.nonWorkingAfter ?? 0,
    }),
  };
}
