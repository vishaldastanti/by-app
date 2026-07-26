/**
 * ── SEC-05 FIX: Pagination utility to prevent unbounded list queries ──
 * 
 * Prevents DB denial-of-service by capping results and supporting page/limit query params.
 * Default limit: 50 (configurable per-endpoint). Max limit: 500.
 * 
 * Usage:
 *   const { from, to } = parsePagination(req.query);
 *   const { data } = await supabase.from('table').select('*').range(from, to);
 */

const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 50;

export interface PaginationResult {
  from: number;
  to: number;
  page: number;
  limit: number;
}

export function parsePagination(
  query: Record<string, any>,
  defaultLimit: number = DEFAULT_LIMIT
): PaginationResult {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(query.limit as string) || defaultLimit));
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  return { from, to, page, limit };
}
