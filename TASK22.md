# TASK22 — Responsive Polish, Loading States, Error Boundaries

## Phase
Phase 5: Advanced Features

## What to Build
Add loading skeletons, error boundaries, toast notifications, Suspense boundaries, and make the sidebar collapsible on mobile. Final responsive polish pass.

## Steps

1. **LoadingSkeleton component** (`components/LoadingSkeleton.tsx`):
   - Reusable skeleton variants: `card`, `table`, `chart`, `text`
   - Animated pulse effect (Tailwind `animate-pulse`)
   - Props: variant, count (number of skeleton items), className

2. **ErrorBoundary component** (`components/ErrorBoundary.tsx`):
   - React error boundary class component
   - Catches rendering errors, shows friendly message
   - "Try Again" button that resets the error state
   - Log error details to console

3. **Toast component** (`components/Toast.tsx`):
   - Toast notification system: success, error, warning, info variants
   - Auto-dismiss after configurable timeout
   - Toast context provider + `useToast()` hook
   - Position: bottom-right
   - Stack multiple toasts

4. **Update Sidebar** (`components/Sidebar.tsx`):
   - Collapsible on mobile (hamburger menu button)
   - Overlay mode on small screens
   - Smooth slide animation
   - Close on route change (mobile)
   - Close on outside click (mobile)

5. **Add Suspense boundaries** to key pages:
   - Wrap data-fetching sections in `<Suspense fallback={<LoadingSkeleton />}>`
   - Pages to update: Dashboard, Program Catalog, Learner Explorer, all analytics pages

6. **Wrap pages with ErrorBoundary:**
   - Add ErrorBoundary to root layout or per-page as needed

7. **Responsive polish:**
   - Ensure all tables are horizontally scrollable on mobile
   - Stack metric cards vertically on small screens
   - Charts resize properly
   - Filter panels stack or collapse on mobile

## Files to Create/Modify
- `components/LoadingSkeleton.tsx` (new)
- `components/ErrorBoundary.tsx` (new)
- `components/Toast.tsx` (new)
- `components/Sidebar.tsx` (modify — add mobile collapse)
- `app/layout.tsx` (modify — add ErrorBoundary, Toast provider)
- Various page files (add Suspense boundaries)

## Browser Verification
- Loading skeletons appear briefly while data loads
- Simulated error shows error boundary with "Try Again"
- Toast notifications appear on actions (import success, export complete, etc.)
- Sidebar collapses to hamburger menu on mobile viewport
- All pages look good on mobile (375px), tablet (768px), desktop (1280px+)
- No horizontal overflow on any page at mobile width
