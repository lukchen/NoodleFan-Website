-- Add financial-reporting columns to orders.
-- Populated by the stripe-webhook function from the charge's balance_transaction.
-- Run this in the Supabase SQL editor (or `npx supabase db push`) before deploying
-- the updated stripe-webhook. Safe to re-run (IF NOT EXISTS).
--
-- stripe_payment_intent : PaymentIntent id (pi_...), for reconciliation / refunds
-- stripe_fee            : Stripe processing fee, in dollars
-- net_income           : payout after Stripe fee (total - fee), in dollars

alter table orders
  add column if not exists stripe_payment_intent text,
  add column if not exists stripe_fee numeric(10, 2),
  add column if not exists net_income numeric(10, 2);
