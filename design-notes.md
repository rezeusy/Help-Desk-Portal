# IT Inventory Redesign Notes

## Existing structure
- React 19 + Tailwind 4 + shadcn/Radix UI, Express/tRPC/Drizzle backend.
- Authenticated dashboard shell in `client/src/components/DashboardLayout.tsx` with persistent sidebar, office list, collapsible/resizable navigation, user menu, and mobile header.
- Core screens: Dashboard, Master Inventory, Location Detail, Audit History, Admin Users.
- Auth screens: Login and Change Password.
- Existing behavior and backend contracts should remain unchanged.

## Redesign direction
- Create a modern internal operations workspace called **Northstar Inventory** while retaining the product meaning.
- Visual language: warm off-white canvas, deep ink/navy sidebar, blue-violet accent, emerald for healthy/available, amber for attention, coral/red only for destructive actions.
- Use a compact editorial type scale with `Manrope` for interface text and `DM Mono` for IDs/counts.
- Use soft elevated panels, 16–22px corner radii, subtle grid/dot background texture, clear section labels, compact toolbar controls, and strong whitespace.
- Make the sidebar feel like a branded workspace rather than generic navigation; include a small status indicator, richer active states, office chips/counts, and a compact user footer.
- Modernize Dashboard metrics into a lead KPI card plus supporting cards, add a deployment progress visualization, and maintain category/office summaries.
- Modernize Master Inventory and Location Detail toolbars and table headers, retain all selection, bulk deploy/delete, inline edit, add, edit, delete, and export flows.
- Modernize Audit History and Admin Users to match the same surface system.
- Keep interactions responsive, keyboard accessible, and within existing component conventions.
