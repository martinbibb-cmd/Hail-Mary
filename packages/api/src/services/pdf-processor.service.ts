/**
 * PDF Processor Service
 * 
 * Handles synchronous PDF processing:
 * - Extract text from PDF pages (native text extraction, no OCR)
 * - Render PDF pages to PNG images
 * 
 * Heavy operations (OCR, chunking, embeddings) are deferred to background jobs
 */

import { pdfToPng, PngPageOutput } from 'pdf-to-png-converter';

type PdfParseResult = { numpages: number; text: string };
type PdfParseFn = (dataBuffer: Buffer, options?: unknown) => Promise<PdfParseResult>;

let cachedPdfParse: PdfParseFn | null = null;

async function loadPdfParse(): Promise<PdfParseFn> {
  if (cachedPdfParse) {
    return cachedPdfParse;
  }

  const mod = await import('pdf-parse');

  // Handle different export patterns:
  // 1. Direct function (mod itself is a function) - old API
  // 2. Default export (mod.default) - old API with default export
  // 3. Named export PDFParse (mod.PDFParse) - new v2.4.5+ class-based API
  let ParseModule: any;
  
  if (typeof mod === 'function') {
    ParseModule = mod;
  } else if (mod.default && typeof mod.default === 'function') {
    ParseModule = mod.default;
  } else if ((mod as any).PDFParse && typeof (mod as any).PDFParse === 'function') {
    ParseModule = (mod as any).PDFParse;
  } else {
    throw new Error(
      `CRITICAL: pdf-parse import failed. Expected a function but got ${typeof mod}. Check package installation or module system.`
    );
  }

  // Create a wrapper function that handles both old function-based and new class-based APIs
  const parsePdf = async (dataBuffer: Buffer, options?: unknown): Promise<PdfParseResult> => {
    // Check if it's the old function-based API by testing if we can call it directly
    try {
      // Try old API: direct function call
      const result = await ParseModule(dataBuffer, options);
      if (result && typeof result.numpages === 'number' && typeof result.text === 'string') {
        return result as PdfParseResult;
      }
    } catch (firstError) {
      // If old API fails, try new class-based API
      try {
        // New API: instantiate class and call getText()
        // The new API expects Uint8Array, not Buffer
        const uint8Array = new Uint8Array(dataBuffer);
        const parser = new ParseModule(uint8Array, options);
        const textResult = await parser.getText();
        
        // Convert new API result format to old API format
        return {
          numpages: textResult.total || 0,
          text: textResult.text || '',
        };
      } catch (secondError) {
        // If both APIs fail, throw a detailed error
        throw new Error(
          `pdf-parse failed with both old and new API. ` +
          `Old API error: ${(firstError as Error).message}. ` +
          `New API error: ${(secondError as Error).message}`
        );
      }
    }
    
    // If we got here, the result from the old API was invalid
    throw new Error('pdf-parse returned unexpected result format');
  };

  cachedPdfParse = parsePdf as PdfParseFn;
  return cachedPdfParse;
}

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
    // Validate input
    if (!Buffer.isBuffer(pdfBuffer)) {
      throw new Error('Invalid input: expected Buffer, got ' + typeof pdfBuffer);
    }
    if (pdfBuffer.length === 0) {
      throw new Error('Invalid input: PDF buffer is empty');
    }

    const parsePdf = await loadPdfParse();
    // Step 1: Extract text from PDF using pdf-parse (function-based API)
    const pdfData = await parsePdf(pdfBuffer);
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
  // Validate input
  if (!Buffer.isBuffer(pdfBuffer)) {
    throw new Error('Invalid input: expected Buffer, got ' + typeof pdfBuffer);
  }
  if (pageNumber < 1) {
    throw new Error('Invalid page number: must be >= 1, got ' + pageNumber);
  }

  const parsePdf = await loadPdfParse();
  // This would require pdf.js canvas API for proper per-page extraction
  // For v1, we extract all text at once
  const pdfData = await parsePdf(pdfBuffer);
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
