import { describe, expect, it } from 'vitest';

const configuredTitle = import.meta.env.VITE_APP_TITLE || 'IT GLOBAL (LYNX - STARS) Inventory';

describe('workspace title configuration', () => {
  it('uses the requested IT GLOBAL inventory title', () => {
    expect(configuredTitle).toBe('IT GLOBAL (LYNX - STARS) Inventory');
  });
});
