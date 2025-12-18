/**
 * Knowledge Service
 * 
 * Handles PDF document ingestion, text extraction, chunking, and semantic search
 */

import { db } from '../db/drizzle-client';
import { knowledgeDocuments, knowledgePages, knowledgeChunks } from '../db/drizzle-schema';
import { eq, and, sql } from 'drizzle-orm';
import * as fs from 'fs/promises';
import * as path from 'path';

// Storage path for knowledge documents (should be in appdata or persistent volume)
// Default to /mnt/user/appdata for NAS deployments, or data directory for other deployments
const DEFAULT_STORAGE_PATH = process.env.IS_DOCKER === 'true' 
  ? '/mnt/user/appdata/atlas-knowledge'
  : '/var/lib/atlas-knowledge';
const KNOWLEDGE_STORAGE_PATH = process.env.KNOWLEDGE_STORAGE_PATH || DEFAULT_STORAGE_PATH;

export interface DocumentMetadata {
  title: string;
  tags?: string[];
  manufacturer?: string;
  modelRange?: string;
  documentType?: string;
}

export interface UploadDocumentResult {
  documentId: number;
  pageCount: number;
  storagePath: string;
}

export interface PageImage {
  pageNumber: number;
  imagePath: string;
  imageUrl: string;
}

export interface SearchResult {
  chunkId: number;
  documentId: number;
  title: string;
  pageNumber: number;
  text: string;
  score: number;
  metadata?: any;
}

export interface Citation {
  chunkId: number;
  documentId: number;
  title: string;
  pageNumber: number;
  textSnippet: string;
}

/**
 * Initialize storage directory for knowledge documents
 */
export async function initializeStorage(): Promise<void> {
  try {
    await fs.mkdir(KNOWLEDGE_STORAGE_PATH, { recursive: true });
    await fs.mkdir(path.join(KNOWLEDGE_STORAGE_PATH, 'docs'), { recursive: true });
    console.log('Knowledge storage initialized at:', KNOWLEDGE_STORAGE_PATH);
  } catch (error) {
    console.error('Failed to initialize knowledge storage:', error);
    throw error;
  }
}

/**
 * Store uploaded PDF file
 */
export async function storeDocument(
  accountId: number,
  fileBuffer: Buffer,
  metadata: DocumentMetadata
): Promise<UploadDocumentResult> {
  // Create document record
  const [document] = await db.insert(knowledgeDocuments).values({
    accountId,
    title: metadata.title,
    source: 'upload',
    tags: metadata.tags ? JSON.stringify(metadata.tags) : null,
    manufacturer: metadata.manufacturer,
    modelRange: metadata.modelRange,
    documentType: metadata.documentType,
    pageCount: 0, // Will be updated after PDF processing
  }).returning();

  // Create storage directory for this document
  const docDir = path.join(KNOWLEDGE_STORAGE_PATH, 'docs', document.id.toString());
  await fs.mkdir(docDir, { recursive: true });

  // Save original PDF file
  const pdfPath = path.join(docDir, 'original.pdf');
  await fs.writeFile(pdfPath, fileBuffer);

  // Update document with file path
  await db.update(knowledgeDocuments)
    .set({ originalFilePath: pdfPath })
    .where(eq(knowledgeDocuments.id, document.id));

  return {
    documentId: document.id,
    pageCount: 0,
    storagePath: pdfPath,
  };
}

/**
 * Store page image and text
 */
export async function storePage(
  documentId: number,
  pageNumber: number,
  imageBuffer: Buffer,
  extractedText?: string
): Promise<void> {
  const docDir = path.join(KNOWLEDGE_STORAGE_PATH, 'docs', documentId.toString());
  const imagePath = path.join(docDir, `page_${pageNumber.toString().padStart(3, '0')}.png`);
  
  // Save page image
  await fs.writeFile(imagePath, imageBuffer);

  // Create page record
  await db.insert(knowledgePages).values({
    documentId,
    pageNumber,
    text: extractedText || null,
    imagePath,
    imageUrl: `/api/knowledge/${documentId}/pages/${pageNumber}/image`,
    hasText: !!extractedText && extractedText.length > 0,
    isOcred: false,
  });
}

/**
 * Store text chunk with embedding
 */
export async function storeChunk(
  documentId: number,
  pageNumber: number,
  chunkIndex: number,
  text: string,
  embedding?: number[],
  metadata?: any
): Promise<void> {
  await db.insert(knowledgeChunks).values({
    documentId,
    pageNumber,
    chunkIndex,
    text,
    embedding: embedding ? JSON.stringify(embedding) : null,
    metadata: metadata ? JSON.stringify(metadata) : null,
  });
}

/**
 * Update document page count
 */
export async function updatePageCount(documentId: number, pageCount: number): Promise<void> {
  await db.update(knowledgeDocuments)
    .set({ pageCount })
    .where(eq(knowledgeDocuments.id, documentId));
}

/**
 * Get document by ID
 */
export async function getDocument(documentId: number) {
  const [document] = await db.select()
    .from(knowledgeDocuments)
    .where(eq(knowledgeDocuments.id, documentId));
  return document;
}

/**
 * List all documents for an account
 */
export async function listDocuments(accountId: number) {
  return db.select()
    .from(knowledgeDocuments)
    .where(eq(knowledgeDocuments.accountId, accountId))
    .orderBy(sql`${knowledgeDocuments.createdAt} DESC`);
}

/**
 * Get page image path
 */
export async function getPageImagePath(documentId: number, pageNumber: number): Promise<string | null> {
  const [page] = await db.select()
    .from(knowledgePages)
    .where(and(
      eq(knowledgePages.documentId, documentId),
      eq(knowledgePages.pageNumber, pageNumber)
    ));
  
  return page?.imagePath || null;
}

/**
 * Search chunks using simple text matching (placeholder for semantic search)
 * TODO: Implement proper embedding-based search when pgvector is available
 */
export async function searchChunks(
  accountId: number,
  query: string,
  topK: number = 10
): Promise<SearchResult[]> {
  // Simple text search for now - will be replaced with embedding similarity search
  const results = await db.select({
    chunkId: knowledgeChunks.id,
    documentId: knowledgeChunks.documentId,
    title: knowledgeDocuments.title,
    pageNumber: knowledgeChunks.pageNumber,
    text: knowledgeChunks.text,
    metadata: knowledgeChunks.metadata,
  })
    .from(knowledgeChunks)
    .innerJoin(knowledgeDocuments, eq(knowledgeChunks.documentId, knowledgeDocuments.id))
    .where(and(
      eq(knowledgeDocuments.accountId, accountId),
      sql`${knowledgeChunks.text} ILIKE ${'%' + query + '%'}`
    ))
    .limit(topK);

  return results.map(r => ({
    chunkId: r.chunkId,
    documentId: r.documentId,
    title: r.title,
    pageNumber: r.pageNumber,
    text: r.text,
    score: 0.5, // Placeholder score
    metadata: r.metadata,
  }));
}

/**
 * Get citations for specific chunk IDs
 */
export async function getCitations(chunkIds: number[]): Promise<Citation[]> {
  const results = await db.select({
    chunkId: knowledgeChunks.id,
    documentId: knowledgeChunks.documentId,
    title: knowledgeDocuments.title,
    pageNumber: knowledgeChunks.pageNumber,
    text: knowledgeChunks.text,
  })
    .from(knowledgeChunks)
    .innerJoin(knowledgeDocuments, eq(knowledgeChunks.documentId, knowledgeDocuments.id))
    .where(sql`${knowledgeChunks.id} = ANY(${chunkIds})`);

  return results.map(r => ({
    chunkId: r.chunkId,
    documentId: r.documentId,
    title: r.title,
    pageNumber: r.pageNumber,
    textSnippet: r.text.substring(0, 200) + (r.text.length > 200 ? '...' : ''),
  }));
}

/**
 * Delete document and all associated data
 */
export async function deleteDocument(documentId: number): Promise<void> {
  // Delete from database (cascades to pages and chunks)
  await db.delete(knowledgeDocuments).where(eq(knowledgeDocuments.id, documentId));

  // Delete from filesystem
  const docDir = path.join(KNOWLEDGE_STORAGE_PATH, 'docs', documentId.toString());
  try {
    await fs.rm(docDir, { recursive: true, force: true });
  } catch (error) {
    console.error('Failed to delete document files:', error);
  }
}
