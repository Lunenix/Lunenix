-- Phase 4: Contracts & Invoices Migration
-- Description: Creates contracts and invoices tables with RLS policies

-- ============================================
-- CONTRACTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  
  -- Contract details
  contract_number TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'active', 'completed', 'cancelled')),
  
  -- Dates
  start_date DATE,
  end_date DATE,
  signed_at TIMESTAMPTZ,
  
  -- Financial
  value DECIMAL(12, 2),
  currency TEXT DEFAULT 'USD',
  
  -- Terms and conditions
  terms TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique contract number per workspace
  UNIQUE (workspace_id, contract_number)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_contracts_workspace ON public.contracts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_contracts_contact ON public.contracts(contact_id);
CREATE INDEX IF NOT EXISTS idx_contracts_project ON public.contracts(project_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON public.contracts(status);

-- Enable RLS
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for contracts
CREATE POLICY "Users can view contracts in their workspaces"
  ON public.contracts FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert contracts in their workspaces"
  ON public.contracts FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update contracts in their workspaces"
  ON public.contracts FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete contracts in their workspaces"
  ON public.contracts FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- INVOICES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  
  -- Invoice details
  invoice_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  
  -- Dates
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  
  -- Line items (JSONB array)
  -- Each item: {description: string, quantity: number, unit_price: number, amount: number}
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Financial calculations
  subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
  tax_rate DECIMAL(5, 2) DEFAULT 0,
  tax_amount DECIMAL(12, 2) DEFAULT 0,
  total DECIMAL(12, 2) NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  
  -- Additional info
  notes TEXT,
  payment_terms TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique invoice number per workspace
  UNIQUE (workspace_id, invoice_number)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_invoices_workspace ON public.invoices(workspace_id);
CREATE INDEX IF NOT EXISTS idx_invoices_contact ON public.invoices(contact_id);
CREATE INDEX IF NOT EXISTS idx_invoices_contract ON public.invoices(contract_id);
CREATE INDEX IF NOT EXISTS idx_invoices_project ON public.invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON public.invoices(due_date);

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- RLS Policies for invoices
CREATE POLICY "Users can view invoices in their workspaces"
  ON public.invoices FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert invoices in their workspaces"
  ON public.invoices FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update invoices in their workspaces"
  ON public.invoices FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete invoices in their workspaces"
  ON public.invoices FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger to auto-update updated_at for contracts
CREATE OR REPLACE FUNCTION update_contracts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION update_contracts_updated_at();

-- Trigger to auto-update updated_at for invoices
CREATE OR REPLACE FUNCTION update_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_invoices_updated_at();
