/**
 * Unit tests for PDF Processor Service
 * 
 * Tests PDF processing functionality including text extraction and image rendering.
 */

import * as fs from 'fs';
import * as path from 'path';
import { processPDF, extractPageText, renderPageToPng } from '../services/pdf-processor.service';

describe('PDF Processor Service', () => {
  describe('Input Validation', () => {
    it('should reject non-buffer input', async () => {
      await expect(processPDF(null as any)).rejects.toThrow('Invalid input: expected Buffer');
      await expect(processPDF(undefined as any)).rejects.toThrow('Invalid input: expected Buffer');
      await expect(processPDF('string' as any)).rejects.toThrow('Invalid input: expected Buffer');
      await expect(processPDF({} as any)).rejects.toThrow('Invalid input: expected Buffer');
    });

    it('should reject empty buffer', async () => {
      const emptyBuffer = Buffer.alloc(0);
      await expect(processPDF(emptyBuffer)).rejects.toThrow('Invalid input: PDF buffer is empty');
    });

    it('should validate page number in extractPageText', async () => {
      const buffer = Buffer.from('dummy');
      await expect(extractPageText(buffer, 0)).rejects.toThrow('Invalid page number: must be >= 1');
      await expect(extractPageText(buffer, -1)).rejects.toThrow('Invalid page number: must be >= 1');
    });

    it('should reject non-buffer in extractPageText', async () => {
      await expect(extractPageText(null as any, 1)).rejects.toThrow('Invalid input: expected Buffer');
    });
  });

  describe('Module Import', () => {
    it('should import pdf-parse successfully', async () => {
      // This test verifies that the loadPdfParse function works correctly
      // by attempting to process a minimal valid PDF
      
      // Create a minimal valid PDF buffer (PDF header + minimal content)
      const minimalPDF = Buffer.from(
        '%PDF-1.4\n' +
        '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
        '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
        '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\n' +
        'xref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000101 00000 n\n' +
        'trailer<</Size 4/Root 1 0 R>>\nstartxref\n173\n%%EOF'
      );

      // This should not throw an import error
      // Note: It might fail for other reasons (invalid PDF), but not import issues
      try {
        await processPDF(minimalPDF);
      } catch (error) {
        // Ensure the error is NOT an import error
        expect((error as Error).message).not.toContain('pdf-parse import failed');
      }
    });
  });

  describe('Error Handling', () => {
    it('should wrap errors with context', async () => {
      const invalidBuffer = Buffer.from('not a valid pdf');
      
      await expect(processPDF(invalidBuffer)).rejects.toThrow('Failed to process PDF');
    });

    it('should provide clear error messages', async () => {
      const buffer = Buffer.from('invalid pdf data');
      
      try {
        await processPDF(buffer);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Failed to process PDF');
      }
    });
  });

  describe('PDF Processing', () => {
    // Note: These tests require valid PDF files which may not be available in the test environment
    // They are included as placeholders for when test PDFs are added
    
    it.skip('should process a valid single-page PDF', async () => {
      // This would require a test PDF file
      const pdfPath = path.join(__dirname, 'fixtures', 'test-single-page.pdf');
      if (fs.existsSync(pdfPath)) {
        const buffer = fs.readFileSync(pdfPath);
        const result = await processPDF(buffer);
        
        expect(result.totalPages).toBe(1);
        expect(result.pages).toHaveLength(1);
        expect(result.pages[0].pageNumber).toBe(1);
        expect(result.pages[0].imageBuffer).toBeInstanceOf(Buffer);
      }
    });

    it.skip('should process a valid multi-page PDF', async () => {
      // This would require a test PDF file
      const pdfPath = path.join(__dirname, 'fixtures', 'test-multi-page.pdf');
      if (fs.existsSync(pdfPath)) {
        const buffer = fs.readFileSync(pdfPath);
        const result = await processPDF(buffer);
        
        expect(result.totalPages).toBeGreaterThan(1);
        expect(result.pages.length).toBe(result.totalPages);
        
        // Verify each page has required fields
        result.pages.forEach((page, index) => {
          expect(page.pageNumber).toBe(index + 1);
          expect(page.imageBuffer).toBeInstanceOf(Buffer);
          expect(page.imageBuffer.length).toBeGreaterThan(0);
        });
      }
    });
  });

  describe('Page Text Extraction', () => {
    it.skip('should extract text from a PDF page', async () => {
      // This would require a test PDF file with text
      const pdfPath = path.join(__dirname, 'fixtures', 'test-with-text.pdf');
      if (fs.existsSync(pdfPath)) {
        const buffer = fs.readFileSync(pdfPath);
        const text = await extractPageText(buffer, 1);
        
        expect(typeof text).toBe('string');
        expect(text.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Page Rendering', () => {
    it.skip('should render a specific page to PNG', async () => {
      // This would require a test PDF file
      const pdfPath = path.join(__dirname, 'fixtures', 'test-single-page.pdf');
      if (fs.existsSync(pdfPath)) {
        const buffer = fs.readFileSync(pdfPath);
        const imageBuffer = await renderPageToPng(buffer, 1);
        
        expect(imageBuffer).toBeInstanceOf(Buffer);
        expect(imageBuffer.length).toBeGreaterThan(0);
      }
    });
  });
});
