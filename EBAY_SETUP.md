# eBay Auto Publish Setup

This project is prepared for automatic eBay listing publication when a new vinyl is created from admin.

## Required Environment Variables

Add these variables in local `.env.local` and Vercel project settings:

- `EBAY_ENVIRONMENT` = `sandbox` or `production`
- `EBAY_CLIENT_ID`
- `EBAY_CLIENT_SECRET`
- `EBAY_REFRESH_TOKEN`
- `EBAY_MARKETPLACE_ID` (default: `EBAY_IT`)
- `EBAY_CURRENCY` (default: `EUR`)
- `EBAY_CATEGORY_ID` (default: `176985`)
- `EBAY_MERCHANT_LOCATION_KEY`
- `EBAY_FULFILLMENT_POLICY_ID`
- `EBAY_PAYMENT_POLICY_ID`
- `EBAY_RETURN_POLICY_ID`

## Flow Already Implemented

1. Admin inserts a new vinyl from the admin UI.
2. Vinyl is saved in Supabase.
3. Admin page triggers `POST /api/ebay/publish` with the created vinyl payload.
4. API route validates the authenticated admin user against `ADMIN_EMAIL`.
5. Server calls eBay Inventory API:
   - create/update inventory item
   - create offer
   - publish offer
6. UI shows status message with listing id (if available).

## Notes

- If eBay env vars are missing, vinyl creation still works and the UI shows that eBay auto-publish is waiting for configuration.
- Current mapping publishes quantity `1` per vinyl.
- Condition mapping is handled in `src/lib/ebay.ts`.
