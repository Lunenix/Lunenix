-- Invoice Stripe Payment Links. Does not recreate invoices or change due_date/total.

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS stripe_payment_link_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_url text;
