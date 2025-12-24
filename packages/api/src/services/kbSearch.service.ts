/**
 * KB retrieval helper (v1)
 *
 * Reuses the existing Knowledge Service (page-level storage + search).
 * Returns "chunk-like" refs so callers can cite stable identifiers.
 */

import * as knowledgeService from './knowledge.service';

export type KbPassage = {
  title: string;
  docId: string;
  ref: string; // e.g. "chunk:123:5" (docId:pageNo)
  text: string;
};

export async function kbSearch(
  accountId: number,
  query: string,
  topK: number = 5
): Promise<KbPassage[]> {
  const limit = Math.min(Math.max(1, topK), 25);

  // v1 search is page-level; use it as the canonical retrieval system.
  const hits = await knowledgeService.searchPages(accountId, query, limit);
  if (!hits || hits.length === 0) return [];

  const out: KbPassage[] = [];
  for (const h of hits.slice(0, limit)) {
    const page = await knowledgeService.getPage(h.documentId, h.pageNumber);
    const text = (page?.text || h.snippet || '').trim();
    out.push({
      title: h.title,
      docId: String(h.documentId),
      // "chunk-like" reference for now. (PR #7 can make this true chunkIds.)
      ref: `chunk:${h.documentId}:${h.pageNumber}`,
      text,
    });
  }

  return out;
}

