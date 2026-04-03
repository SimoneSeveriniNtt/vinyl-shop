# Vinyl Shop — Project Guidelines

## Build & Dev Commands

```bash
npm run dev       # Start dev server at http://localhost:3000
npm run build     # Production build (run after changes to validate)
npm run lint      # ESLint check
```

Always run `npm run build` after edits to catch TypeScript errors before finishing.

## Architecture

```
src/
  app/                  # Next.js App Router pages
    admin/              # Protected admin CRUD — checks Supabase Auth session
    api/checkout/       # POST route: saves order, marks vinyls sold, sends emails
    catalog/            # Listing + filters
    catalog/[id]/       # Vinyl detail + gallery
    cart/               # Cart summary
    checkout/           # Buyer form → calls /api/checkout
  components/           # Shared UI (VinylCard, Navbar, ImageUpload, etc.)
  context/
    CartContext.tsx      # Cart state — persisted in localStorage
    AuthContext.tsx      # Supabase Auth session wrapper
  lib/
    supabase.ts          # Supabase client (anon key — for frontend)
    types.ts             # All TypeScript interfaces + CONDITIONS + CONDITION_LABELS
```

## Key Conventions

**Supabase clients — two separate clients:**
- `supabase` (anon key) → frontend & client components
- In `src/app/api/*/route.ts` use `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS

**Condition values:** stored in DB as English (`Mint`, `Near Mint`, etc.), displayed in Italian via `CONDITION_LABELS` from `src/lib/types.ts`. Never hardcode Italian strings for conditions — always use the map.

**Available flag:** `vinyls.available = false` means "Venduto". The `/api/checkout` route sets this automatically on purchase. Admin can toggle it back via the form.

**Images:** cover stored in `vinyls.cover_url`; extra gallery images in `vinyl_images` table (`image_url`, `sort_order`). Uploaded to Supabase Storage bucket `vinyl-images` via `ImageUpload` component.

**Admin auth:** protected client-side via `AuthContext` — if no session, renders `<AdminLogin />`. No middleware file.

**Email:** uses Resend (`RESEND_API_KEY` in `.env.local`). Two emails per order: admin notification + buyer confirmation. Sender must be `onboarding@resend.dev` until a verified domain is set in Resend dashboard. Key: add real API key to `.env.local`.

## Environment Variables (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY      # server-side only
RESEND_API_KEY                  # get from resend.com
ADMIN_EMAIL                     # order notification recipient
```

## Database Schema

See [`supabase-schema.sql`](./supabase-schema.sql) for full schema.  
Tables: `genres`, `vinyls`, `vinyl_images`, `orders`, `order_items`  
Storage bucket: `vinyl-images` (public)

## Pitfalls

- `update-covers.js` at root is a leftover one-time script — safe to delete.
- Do **not** use `NEXT_PUBLIC_SUPABASE_ANON_KEY` in API routes — use `SUPABASE_SERVICE_ROLE_KEY`.
- Tailwind v4 is used — utility class generation is automatic, no `content` array in config needed.
- Admin user is a Supabase Auth user — to reset credentials use the Supabase dashboard or a temporary Node script calling `supabase.auth.admin.updateUserById`.

