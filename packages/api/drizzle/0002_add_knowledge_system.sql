-- Migration: Add Knowledge Ingest System tables
-- Description: Adds tables for PDF document ingestion, page extraction, and semantic search

-- Knowledge documents - uploaded PDF manuals, guides, compliance docs
CREATE TABLE IF NOT EXISTS "knowledge_documents" (
  "id" SERIAL PRIMARY KEY,
  "account_id" INTEGER NOT NULL REFERENCES "accounts"("id"),
  "title" VARCHAR(500) NOT NULL,
  "source" VARCHAR(100) DEFAULT 'upload' NOT NULL,
  "tags" JSONB,
  "manufacturer" VARCHAR(255),
  "model_range" VARCHAR(255),
  "document_type" VARCHAR(100),
  "original_file_path" TEXT,
  "page_count" INTEGER,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Knowledge pages - individual pages from documents with extracted text
CREATE TABLE IF NOT EXISTS "knowledge_pages" (
  "id" SERIAL PRIMARY KEY,
  "document_id" INTEGER NOT NULL REFERENCES "knowledge_documents"("id") ON DELETE CASCADE,
  "page_number" INTEGER NOT NULL,
  "text" TEXT,
  "image_path" TEXT,
  "image_url" TEXT,
  "has_text" BOOLEAN DEFAULT FALSE,
  "is_ocred" BOOLEAN DEFAULT FALSE,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Knowledge chunks - text chunks with embeddings for semantic search
CREATE TABLE IF NOT EXISTS "knowledge_chunks" (
  "id" SERIAL PRIMARY KEY,
  "document_id" INTEGER NOT NULL REFERENCES "knowledge_documents"("id") ON DELETE CASCADE,
  "page_number" INTEGER NOT NULL,
  "chunk_index" INTEGER NOT NULL,
  "text" TEXT NOT NULL,
  "embedding" JSONB,
  "metadata" JSONB,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "idx_knowledge_pages_document_id" ON "knowledge_pages"("document_id");
CREATE INDEX IF NOT EXISTS "idx_knowledge_pages_page_number" ON "knowledge_pages"("page_number");
CREATE INDEX IF NOT EXISTS "idx_knowledge_chunks_document_id" ON "knowledge_chunks"("document_id");
CREATE INDEX IF NOT EXISTS "idx_knowledge_chunks_page_number" ON "knowledge_chunks"("page_number");
CREATE INDEX IF NOT EXISTS "idx_knowledge_documents_account_id" ON "knowledge_documents"("account_id");
CREATE INDEX IF NOT EXISTS "idx_knowledge_documents_manufacturer" ON "knowledge_documents"("manufacturer");
CREATE INDEX IF NOT EXISTS "idx_knowledge_documents_document_type" ON "knowledge_documents"("document_type");
