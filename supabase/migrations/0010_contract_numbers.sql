-- Phase 10: Auto-generated contract numbers
-- Adds contract_number column and a helper function for atomic sequential generation

-- ============================================
-- Add contract_number column
-- ============================================
ALTER TABLE public.esign_documents
  ADD COLUMN IF NOT EXISTS contract_number TEXT;

-- Create a unique index to prevent duplicates within a workspace
CREATE UNIQUE INDEX IF NOT EXISTS idx_esign_docs_contract_number
  ON public.esign_documents(workspace_id, contract_number)
  WHERE contract_number IS NOT NULL;

-- ============================================
-- Helper function to generate next contract number
-- ============================================
-- This function atomically finds the next contract number for a workspace/year
-- Format: CNT-{YEAR}-{SEQUENCE} (e.g., CNT-2026-001)
CREATE OR REPLACE FUNCTION public.generate_contract_number(
  p_workspace_id UUID,
  p_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_prefix TEXT;
  v_next_seq INTEGER;
  v_contract_number TEXT;
BEGIN
  -- Build the prefix (e.g., "CNT-2026-")
  v_prefix := 'CNT-' || p_year::TEXT || '-';
  
  -- Find the highest existing sequence number for this workspace and year
  SELECT COALESCE(
    MAX(
      CASE 
        WHEN contract_number ~ ('^' || v_prefix || '[0-9]+$')
        THEN SUBSTRING(contract_number FROM LENGTH(v_prefix) + 1)::INTEGER
        ELSE 0
      END
    ),
    0
  ) + 1
  INTO v_next_seq
  FROM public.esign_documents
  WHERE workspace_id = p_workspace_id
    AND contract_number IS NOT NULL
    AND contract_number LIKE v_prefix || '%';
  
  -- Format the sequence with leading zeros (3 digits)
  v_contract_number := v_prefix || LPAD(v_next_seq::TEXT, 3, '0');
  
  RETURN v_contract_number;
END;
$$;
