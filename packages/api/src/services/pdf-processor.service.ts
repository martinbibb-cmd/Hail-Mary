/**
 * PDF Processor Service
 * 
 * Handles synchronous PDF processing:
 * - Extract text from PDF pages (native text extraction, no OCR)
 * - Render PDF pages to PNG images
 * 
 * Heavy operations (OCR, chunking, embeddings) are deferred to background jobs
 */

import pdfParse = require('pdf-parse');
import { pdfToPng, PngPageOutput } from 'pdf-to-png-converter';

export interface PageData {
  pageNumber: number;
  text: string;
  imageBuffer: Buffer;
}

export interface PDFProcessingResult {
  totalPages: number;
  pages: PageData[];
}

/**
 * Process a PDF buffer - extract text and render images for all pages
 * This runs synchronously during upload to provide immediate results
 */
export async function processPDF(pdfBuffer: Buffer): Promise<PDFProcessingResult> {
  try {
    // Safeguard: Verify pdfParse is a function
    if (typeof pdfParse !== 'function') {
      throw new Error('pdfParse import is invalid - expected a function');
    }

    // Step 1: Extract text from PDF using pdf-parse (function-based API)
    const pdfData = await pdfParse(pdfBuffer);
    const totalPages = pdfData.numpages;

    // Step 2: Render all pages to PNG images
    const pngPages: PngPageOutput[] = await pdfToPng(pdfBuffer as any, {
      returnPageContent: true,
      verbosityLevel: 0,
      // Don't specify pagesToProcess to process all pages
    });

    // Step 3: Extract text per page
    // Note: pdf-parse gives us full text, but doesn't separate by page easily
    // For v1, we'll use the full text and distribute it evenly, or use page metadata if available
    // A better approach would be to use pdf.js directly for per-page text extraction
    const pages: PageData[] = [];
    
    for (let i = 0; i < pngPages.length; i++) {
      const pageNum = i + 1;
      const pngPage = pngPages[i];
      
      // For now, assign text proportionally or leave blank if we can't extract per-page
      // In production, we'd want to use pdf.js canvas API for per-page text
      // For v1 MVP, we can use the full text on page 1 and leave others blank,
      // or distribute text evenly (crude but works for basic search)
      let pageText = '';
      
      if (i === 0) {
        // Put all extracted text on first page for now
        // This is a simplification - in production we'd extract per-page
        pageText = pdfData.text;
      }

      const imageBuffer = pngPage.content;
      if (!imageBuffer) {
        throw new Error(`Failed to get image buffer for page ${pageNum}`);
      }

      pages.push({
        pageNumber: pageNum,
        text: pageText,
        imageBuffer,
      });
    }

    return {
      totalPages,
      pages,
    };
  } catch (error) {
    console.error('Error processing PDF:', error);
    throw new Error(`Failed to process PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract text from a specific page (future enhancement)
 * For now, this is a placeholder
 */
export async function extractPageText(pdfBuffer: Buffer, pageNumber: number): Promise<string> {
  // Safeguard: Verify pdfParse is a function
  if (typeof pdfParse !== 'function') {
    throw new Error('pdfParse import is invalid - expected a function');
  }

  // This would require pdf.js canvas API for proper per-page extraction
  // For v1, we extract all text at once
  const pdfData = await pdfParse(pdfBuffer);
  return pdfData.text; // Return full text for now
}

/**
 * Render a specific page to PNG (future enhancement)
 * For now, we render all pages at once
 */
export async function renderPageToPng(pdfBuffer: Buffer, pageNumber: number): Promise<Buffer> {
  const pngPages: PngPageOutput[] = await pdfToPng(pdfBuffer as any, {
    returnPageContent: true,
    pagesToProcess: [pageNumber],
    verbosityLevel: 0,
  });

  if (pngPages.length === 0 || !pngPages[0].content) {
    throw new Error(`Failed to render page ${pageNumber}`);
  }

  return pngPages[0].content;
}
