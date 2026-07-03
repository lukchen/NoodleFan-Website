-- The draft-order flow inserts the order BEFORE the Stripe Checkout Session exists
-- (create-checkout: insert 'pending' draft -> create session -> write session id back),
-- so stripe_session_id must be nullable. Uniqueness (if any) is unaffected: Postgres
-- allows multiple NULLs under a unique constraint.

alter table orders alter column stripe_session_id drop not null;
