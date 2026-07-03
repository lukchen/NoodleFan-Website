-- Support per-dish customization (option groups: protein, spice, veg, etc.) and the
-- draft-order checkout flow (create-checkout inserts a 'pending' row up front, then
-- stripe-webhook flips it to 'paid'; the old flow inserted only on payment).
--
-- No new columns needed — `items` (jsonb) already stores each line's option summary
-- (optionsZh/optionsEn), and `status` already accepts arbitrary text. This migration
-- only documents the new 'pending' status value and unblocks it from being surfaced
-- as a real order.
--
-- Run in the Supabase SQL editor (or `npx supabase db push`) before deploying the
-- updated create-checkout / stripe-webhook / admin-orders / order-status functions.

comment on column orders.status is
  'Order lifecycle: pending (checkout draft, unpaid — created by create-checkout, never shown to the kitchen or customer) -> paid -> preparing -> ready -> completed.';
