# Mobile Optimization - Master Plan 📱

Objective: Ensure "DinoPlatform" feels like a native app on mobile devices. Every button, text, and element must be perfectly sized and positioned.

## 1. Global Shell (App.jsx / Index.css)
- [ ] **Navigation Bar**: Ensure hamburger menu works smoothly.
- [ ] **Sidebar**: Must fully collapse/overlay on mobile.
- [ ] **Typography**: Base font size 16px for legibility.
- [ ] **Touch Targets**: All buttons min-height 44px.

## 2. Operational Pages (Drivers/Field Staff)
### Route Planner (Rutas)
- [ ] **Map View**: Ensure map is usable on small screens.
- [ ] **Optimized List**: Drag & drop might be hard on mobile; ensure "Optimize" button is prominent.
- [ ] **Cards vs Tables**: Switch table rows to "Card Cards" for stops.

### Collections (Cortes)
- [x] **Layout**: Stacked panels (Done).
- [ ] **Modals**: Full screen modals for data entry (Done).
- [ ] **Signature**: Ensure signature canvas is large enough.

### Refills (Rellenos)
- [ ] **History Table**: Convert to "Timeline Card" view on mobile.
- [ ] **Form Modal**: Full screen with large inputs.

## 3. Management Pages (Admin)
### Machines (Gestión)
- [ ] **Grid**: 1 column on mobile.
- [ ] **Search Bar**: Sticky or easily accessible.
- [ ] **Actions**: "Floating Action Button" (FAB) style for "New Machine"?

### Dashboard (Home)
- [ ] **Stats Cards**: 1 column grid.
- [ ] **Charts**: Ensure responsive resizing (Recharts usually handles this, but container needs check).

## 4. Execution Plan
1. **Global Shell Fixes**: `App.css`, `index.css`.
2. **Refills Optimization**: `Refills.css`.
3. **Route Planner Optimization**: `RoutePlanner.css`.
4. **Machines Optimization**: `Machines.css` (Reviewing recent conflicts).
5. **Dashboard Optimization**: `Dashboard.css`.
