import { Inbox } from "lucide-react";
import type { Key, ReactNode } from "react";

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
}: TableProps<TRow>) {
  return (
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
  );
}
