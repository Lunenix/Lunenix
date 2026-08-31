-- Migration: Add editable content support to esign_documents
-- Allows Word documents to be converted to editable rich-text HTML,
-- edited in a WYSIWYG editor, and then regenerated as PDFs.

ALTER TABLE esign_documents
  ADD COLUMN IF NOT EXISTS content TEXT,
  ADD COLUMN IF NOT EXISTS content_type TEXT DEFAULT 'uploaded_pdf' CHECK (content_type IN ('uploaded_pdf', 'editable_document'));

COMMENT ON COLUMN esign_documents.content IS 'Editable rich-text HTML content for .docx uploads (mammoth conversion)';
COMMENT ON COLUMN esign_documents.content_type IS 'Document source: uploaded_pdf (original PDF, not editable) or editable_document (converted from .docx or authored in-app)';
