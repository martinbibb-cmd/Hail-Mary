/**
 * Knowledge API Routes
 * 
 * Handles PDF document ingestion and retrieval:
 * - POST /api/knowledge/upload - Upload a PDF document
 * - GET /api/knowledge - List all documents
 * - GET /api/knowledge/:docId - Get document details
 * - GET /api/knowledge/:docId/pages/:pageNo/image - Get page image
 * - POST /api/knowledge/search - Search for knowledge
 * - GET /api/knowledge/citations - Get citations for chunk IDs
 * - DELETE /api/knowledge/:docId - Delete a document
 */

import { Router, Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware';
import multer from 'multer';
import * as knowledgeService from '../services/knowledge.service';
import * as pdfProcessor from '../services/pdf-processor.service';
import * as fs from 'fs/promises';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB limit
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

// All knowledge routes require authentication
router.use(requireAuth);

/**
 * POST /api/knowledge/upload
 * Upload a PDF document (admin only)
 */
router.post('/upload', requireAdmin, upload.single('pdf'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No PDF file uploaded',
      });
    }

    const { title, tags, manufacturer, modelRange, documentType } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Document title is required',
      });
    }

    // Get account ID from authenticated user
    const accountId = req.user?.accountId;
    if (!accountId) {
      return res.status(401).json({
        success: false,
        error: 'User account not properly configured',
      });
    }

    // Parse tags if provided as JSON string
    let parsedTags: string[] | undefined;
    if (tags) {
      try {
        parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
      } catch {
        parsedTags = [tags];
      }
    }

    // Store the document
    const result = await knowledgeService.storeDocument(
      accountId,
      req.file.buffer,
      {
        title,
        tags: parsedTags,
        manufacturer,
        modelRange,
        documentType,
      }
    );

    // Process PDF synchronously: extract text and render page images
    // This is required for v1 so Sarah/Rocky can cite pages immediately
    console.log(`Processing PDF for document ${result.documentId}...`);
    const pdfResult = await pdfProcessor.processPDF(req.file.buffer);
    
    // Store each page with image and text
    for (const page of pdfResult.pages) {
      await knowledgeService.storePage(
        result.documentId,
        page.pageNumber,
        page.imageBuffer,
        page.text
      );
    }

    // Update document with page count
    await knowledgeService.updatePageCount(result.documentId, pdfResult.totalPages);

    console.log(`PDF processing complete for document ${result.documentId}: ${pdfResult.totalPages} pages`);

    // TODO: Trigger background job for heavy processing (OCR fallback, chunking, embeddings)
    // For now, pages are immediately searchable

    return res.json({
      success: true,
      message: 'Document uploaded and processed successfully.',
      data: {
        docId: result.documentId,
        pageCount: pdfResult.totalPages,
      },
    });
  } catch (error: any) {
    console.error('Error uploading document:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to upload document',
      details: error.message,
    });
  }
});

/**
 * GET /api/knowledge
 * List all documents for the user's account
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const accountId = req.user?.accountId;
    if (!accountId) {
      return res.status(401).json({
        success: false,
        error: 'User account not properly configured',
      });
    }
    const documents = await knowledgeService.listDocuments(accountId);

    return res.json({
      success: true,
      data: documents,
    });
  } catch (error: any) {
    console.error('Error listing documents:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to list documents',
      details: error.message,
    });
  }
});

/**
 * GET /api/knowledge/:docId
 * Get document details
 */
router.get('/:docId', async (req: Request, res: Response) => {
  try {
    const docId = parseInt(req.params.docId, 10);
    if (isNaN(docId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid document ID',
      });
    }

    const document = await knowledgeService.getDocument(docId);
    
    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found',
      });
    }

    // Check if user has access to this document
    const accountId = req.user?.accountId;
    if (!accountId) {
      return res.status(401).json({
        success: false,
        error: 'User account not properly configured',
      });
    }
    if (document.accountId !== accountId && req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    return res.json({
      success: true,
      data: document,
    });
  } catch (error: any) {
    console.error('Error getting document:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get document',
      details: error.message,
    });
  }
});

/**
 * GET /api/knowledge/:docId/pages/:pageNo/image
 * Get page image
 */
router.get('/:docId/pages/:pageNo/image', async (req: Request, res: Response) => {
  try {
    const docId = parseInt(req.params.docId, 10);
    const pageNo = parseInt(req.params.pageNo, 10);

    if (isNaN(docId) || isNaN(pageNo)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid document or page number',
      });
    }

    // Get document to check access
    const document = await knowledgeService.getDocument(docId);
    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found',
      });
    }

    const accountId = req.user?.accountId;
    if (!accountId) {
      return res.status(401).json({
        success: false,
        error: 'User account not properly configured',
      });
    }
    
    if (document.accountId !== accountId && req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    // Get page image path
    const imagePath = await knowledgeService.getPageImagePath(docId, pageNo);
    if (!imagePath) {
      return res.status(404).json({
        success: false,
        error: 'Page image not found',
      });
    }

    // Serve the image file
    try {
      const imageBuffer = await fs.readFile(imagePath);
      res.setHeader('Content-Type', 'image/png');
      res.send(imageBuffer);
    } catch (error) {
      return res.status(404).json({
        success: false,
        error: 'Image file not found',
      });
    }
  } catch (error: any) {
    console.error('Error getting page image:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get page image',
      details: error.message,
    });
  }
});

/**
 * POST /api/knowledge/search
 * Search for knowledge pages (v1 - page-level search)
 */
router.post('/search', async (req: Request, res: Response) => {
  try {
    const { query, topK = 10 } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required',
      });
    }

    // Validate topK parameter
    const validatedTopK = Math.min(Math.max(1, topK), 100);

    const accountId = req.user?.accountId;
    if (!accountId) {
      return res.status(401).json({
        success: false,
        error: 'User account not properly configured',
      });
    }
    
    // Use page-level search for v1
    const results = await knowledgeService.searchPages(accountId, query, validatedTopK);

    return res.json({
      success: true,
      data: results,
    });
  } catch (error: any) {
    console.error('Error searching knowledge:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to search knowledge',
      details: error.message,
    });
  }
});

/**
 * GET /api/knowledge/citations
 * Get citations for page references (v1) or chunk IDs (future)
 * 
 * v1 usage: ?docId=1&pageNo=5 or ?pages=[{"docId":1,"pageNo":5},{"docId":2,"pageNo":3}]
 * future: ?chunkIds=1,2,3
 */
router.get('/citations', async (req: Request, res: Response) => {
  try {
    const { chunkIds, docId, pageNo, pages } = req.query;

    // v1: Support page-level citations (docId + pageNo or pages array)
    if (docId || pages) {
      let pagePairs: Array<{ docId: number; pageNo: number }> = [];

      if (pages) {
        // Parse pages JSON array
        try {
          const parsedPages = typeof pages === 'string' ? JSON.parse(pages) : pages;
          if (Array.isArray(parsedPages)) {
            pagePairs = parsedPages.map((p: any) => ({
              docId: parseInt(p.docId, 10),
              pageNo: parseInt(p.pageNo, 10),
            }));
          }
        } catch (e) {
          return res.status(400).json({
            success: false,
            error: 'Invalid pages parameter format',
          });
        }
      } else if (docId && pageNo) {
        // Single page reference
        pagePairs = [{
          docId: parseInt(docId as string, 10),
          pageNo: parseInt(pageNo as string, 10),
        }];
      }

      if (pagePairs.length === 0 || pagePairs.some(p => isNaN(p.docId) || isNaN(p.pageNo))) {
        return res.status(400).json({
          success: false,
          error: 'Invalid page references',
        });
      }

      const citations = await knowledgeService.getPageCitations(pagePairs);

      return res.json({
        success: true,
        data: citations,
      });
    }

    // Future: Support chunk-level citations
    if (chunkIds) {
      // Parse chunk IDs (can be comma-separated string or array)
      const ids = Array.isArray(chunkIds)
        ? chunkIds.map(id => parseInt(id as string, 10))
        : (chunkIds as string).split(',').map(id => parseInt(id.trim(), 10));

      if (ids.some(isNaN)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid chunk IDs',
        });
      }

      const citations = await knowledgeService.getCitations(ids);

      return res.json({
        success: true,
        data: citations,
      });
    }

    return res.status(400).json({
      success: false,
      error: 'Either chunkIds or page references (docId+pageNo or pages) are required',
    });
  } catch (error: any) {
    console.error('Error getting citations:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get citations',
      details: error.message,
    });
  }
});

/**
 * DELETE /api/knowledge/:docId
 * Delete a document (admin only)
 */
router.delete('/:docId', requireAdmin, async (req: Request, res: Response) => {
  try {
    const docId = parseInt(req.params.docId, 10);
    if (isNaN(docId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid document ID',
      });
    }

    // Check if document exists
    const document = await knowledgeService.getDocument(docId);
    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found',
      });
    }

    await knowledgeService.deleteDocument(docId);

    return res.json({
      success: true,
      message: 'Document deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting document:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete document',
      details: error.message,
    });
  }
});

export default router;
