import { describe, expect, it } from 'vitest';

/**
 * These contract-level expectations document the two distinct office flows:
 * deployment consumes existing master availability, while a receipt adds new stock.
 */
describe('office inventory quantity semantics', () => {
  it('deploying an existing master item increases deployed quantity only', () => {
    const masterBefore = { totalQty: 10, deployedQty: 4, availableQty: 6 };
    const officeBefore = 0;
    const quantity = 3;

    const masterAfter = {
      totalQty: masterBefore.totalQty,
      deployedQty: masterBefore.deployedQty + quantity,
      availableQty: masterBefore.availableQty - quantity,
    };
    const officeAfter = officeBefore + quantity;

    expect(masterAfter).toEqual({ totalQty: 10, deployedQty: 7, availableQty: 3 });
    expect(officeAfter).toBe(3);
  });

  it('receiving new stock can increase both master total and office quantity', () => {
    const masterBefore = { totalQty: 10 };
    const officeBefore = 0;
    const quantity = 3;

    expect({
      totalQty: masterBefore.totalQty + quantity,
      officeQty: officeBefore + quantity,
    }).toEqual({ totalQty: 13, officeQty: 3 });
  });
});
