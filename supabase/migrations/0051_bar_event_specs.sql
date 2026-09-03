-- Event specs on bar_events: retainer amount and deposit paid (amount only; Luna never collects cards).

ALTER TABLE public.bar_events
  ADD COLUMN IF NOT EXISTS deposit_paid BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.bar_events
  ADD COLUMN IF NOT EXISTS retainer_amount NUMERIC NOT NULL DEFAULT 0;
