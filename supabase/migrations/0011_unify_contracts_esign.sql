-- 0011_unify_contracts_esign.sql
-- Unify the "Contracts" and "E-Signatures" modules into a single section powered
-- by the e-signature engine. E-signature documents now ARE the contracts, so we
-- fold the business metadata (value, currency, dates, terms, description) that used
-- to live on the standalone `contracts` table onto `esign_documents`, and repoint
-- the `invoices.contract_id` foreign key at `esign_documents`.
--
-- This migration is NON-DESTRUCTIVE: the old `contracts` table and its rows are left
-- intact. Only the invoices FK target changes.

-- 1) Add business metadata columns to esign_documents.
ALTER TABLE public.esign_documents
  ADD COLUMN IF NOT EXISTS value DECIMAL(12, 2),
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS terms TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT;

-- 2) Repoint invoices.contract_id from the old `contracts` table to `esign_documents`.
--    Clear any references that don't correspond to an esign document first, so the
--    new foreign key constraint can be created without violations.
UPDATE public.invoices
SET contract_id = NULL
WHERE contract_id IS NOT NULL
  AND contract_id NOT IN (SELECT id FROM public.esign_documents);

ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_contract_id_fkey;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_contract_id_fkey
  FOREIGN KEY (contract_id)
  REFERENCES public.esign_documents(id)
  ON DELETE SET NULL;
