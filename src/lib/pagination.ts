export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export type Pagination = {
  page: number;
  pageSize: number;
  skip: number;
};

export type PaginationResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export function parsePagination(url: URL): {
  pagination?: Pagination;
  error?: string;
} {
  const rawPage = url.searchParams.get("page");
  const rawPageSize = url.searchParams.get("pageSize");
  if (rawPage === null && rawPageSize === null) return {};
  if (rawPage === null) return { error: "page is required when pageSize is provided" };

  const page = Number(rawPage);
  const pageSize = rawPageSize === null ? DEFAULT_PAGE_SIZE : Number(rawPageSize);
  if (!Number.isSafeInteger(page) || page < 1)
    return { error: "page must be a positive integer" };
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE)
    return { error: `pageSize must be between 1 and ${MAX_PAGE_SIZE}` };

  return {
    pagination: {
      page,
      pageSize,
      skip: (page - 1) * pageSize,
    },
  };
}

export function paginationResult<T>(
  items: T[],
  total: number,
  pagination: Pagination,
): PaginationResult<T> {
  return {
    items,
    total,
    page: pagination.page,
    pageSize: pagination.pageSize,
  };
}
