import { Inbox } from "lucide-react";
import type { Key, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface TableColumn<TRow> {
  header: ReactNode;
  render: (row: TRow, index: number) => ReactNode;
  headerClassName?: string;
  className?: string;
}

export interface TableProps<TRow> {
  columns: TableColumn<TRow>[];
  data: TRow[];
  isLoading?: boolean;
  emptyMessage?: ReactNode;
  emptyState?: ReactNode;
  rowKey?: (row: TRow) => Key;
  className?: string;
  containerClassName?: string;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
  };
}

export default function DataTable<TRow>({
  columns,
  data,
  isLoading = false,
  emptyMessage = "No data found.",
  emptyState,
  rowKey,
  className,
  containerClassName,
  pagination,
}: TableProps<TRow>) {
  const pageCount = pagination
    ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize))
    : 1;
  const firstItem = pagination && pagination.total > 0
    ? (pagination.page - 1) * pagination.pageSize + 1
    : 0;
  const lastItem = pagination
    ? Math.min(pagination.page * pagination.pageSize, pagination.total)
    : 0;

  return (
    <div className="w-full">
      <div className={cn("w-full overflow-auto", containerClassName)}>
        <Table className={cn("w-full", className)}>
          <TableHeader>
            <TableRow>
              {columns.map((column, index) => (
                <TableHead
                  key={index}
                  className={column.headerClassName}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 6 }).map((_, rowIndex) => (
                <TableRow key={`loading-${rowIndex}`}>
                  {columns.map((column, columnIndex) => (
                    <TableCell
                      key={`loading-${rowIndex}-${columnIndex}`}
                      className={column.className}
                    >
                      <Skeleton className="h-4 w-3/4" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {!isLoading && data.length === 0 && (
              <TableRow>
                <TableCell colSpan={Math.max(columns.length, 1)} className="h-40 text-center">
                  {emptyState ?? (
                    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      <Inbox className="h-10 w-10 stroke-[1.25]" />
                      <span className="text-sm">{emptyMessage}</span>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              data.map((row, rowIndex) => (
                <TableRow
                  key={rowKey ? rowKey(row) : rowIndex}
                  className="transition-colors hover:bg-muted/30"
                >
                  {columns.map((column, columnIndex) => (
                    <TableCell
                      key={columnIndex}
                      className={column.className}
                    >
                      {column.render(row, rowIndex)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
      {pagination && (
        <div className="flex items-center justify-between gap-3 border-t px-3 py-2">
          <p className="text-xs text-muted-foreground">
            Showing {firstItem}-{lastItem} of {pagination.total}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Page {pagination.page} of {pageCount}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={isLoading || pagination.page <= 1}
              aria-label="Previous page"
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={isLoading || pagination.page >= pageCount}
              aria-label="Next page"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
