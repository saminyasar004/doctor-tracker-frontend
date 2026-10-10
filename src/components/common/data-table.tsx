import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Checkbox } from "@/components/ui/checkbox";
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

export interface Column<T> {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string | undefined;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  loading?: boolean | undefined;
  fetching?: boolean | undefined;
  skeletonRows?: number | undefined;
  empty?: ReactNode;
  selected?: Set<string> | undefined;
  onSelectedChange?: ((s: Set<string>) => void) | undefined;
  highlightId?: string | null | undefined;
  mobileCard?: ((row: T) => ReactNode) | undefined;
  footer?: ReactNode | undefined;
}

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  loading,
  fetching,
  skeletonRows = 8,
  empty,
  selected,
  onSelectedChange,
  highlightId,
  mobileCard,
  footer,
}: Props<T>) {
  const selectable = !!selected && !!onSelectedChange;
  const ids = rows.map(getRowId);
  const allChecked = selectable && ids.length > 0 && ids.every((id) => selected.has(id));
  const someChecked = selectable && ids.some((id) => selected.has(id));
  const toggleAll = () => {
    if (!selectable) return;
    const next = new Set(selected);
    ids.forEach((id) => (allChecked ? next.delete(id) : next.add(id)));
    onSelectedChange(next);
  };
  const toggle = (id: string) => {
    if (!selectable) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectedChange(next);
  };

  const showSkeleton = loading && rows.length === 0;
  const showEmpty = !loading && rows.length === 0;

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-soft">
      {showEmpty ? (
        empty
      ) : (
        <>
          <div className={cn("hidden md:block", fetching && "opacity-60 transition-opacity")}>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  {selectable && (
                    <TableHead className="w-10 pl-4">
                      <Checkbox
                        aria-label="Select all rows"
                        checked={allChecked ? true : someChecked ? "indeterminate" : false}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                  )}
                  {columns.map((c) => (
                    <TableHead
                      key={c.id}
                      className={cn(
                        "h-10 text-xs font-medium uppercase tracking-wide text-muted-foreground",
                        c.className,
                      )}
                    >
                      {c.header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {showSkeleton ? (
                  Array.from({ length: skeletonRows }, (_, i) => (
                    <TableRow key={i}>
                      {selectable && (
                        <TableCell className="pl-4">
                          <Skeleton className="size-4" />
                        </TableCell>
                      )}
                      {columns.map((c, j) => (
                        <TableCell key={c.id}>
                          {j === 0 ? (
                            <div className="flex items-center gap-3">
                              <Skeleton className="size-9 rounded-full" />
                              <div className="space-y-1.5">
                                <Skeleton className="h-3 w-28" />
                                <Skeleton className="h-2.5 w-36" />
                              </div>
                            </div>
                          ) : (
                            <Skeleton className="h-3 w-20" />
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <AnimatePresence initial={false}>
                    {rows.map((row, i) => {
                      const id = getRowId(row);
                      return (
                        <motion.tr
                          key={id}
                          layout="position"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{
                            opacity: 1,
                            y: 0,
                            transition: { delay: Math.min(i * 0.025, 0.25), duration: 0.2 },
                          }}
                          exit={{ opacity: 0, x: -24, transition: { duration: 0.2 } }}
                          data-state={selected?.has(id) ? "selected" : undefined}
                          className={cn(
                            "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-primary/5",
                            highlightId === id && "highlight-row",
                          )}
                        >
                          {selectable && (
                            <TableCell className="pl-4">
                              <Checkbox
                                aria-label="Select row"
                                checked={selected.has(id)}
                                onCheckedChange={() => toggle(id)}
                              />
                            </TableCell>
                          )}
                          {columns.map((c) => (
                            <TableCell key={c.id} className={cn("py-3", c.className)}>
                              {c.cell(row)}
                            </TableCell>
                          ))}
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                )}
              </TableBody>
            </Table>
          </div>
          {mobileCard && (
            <div className={cn("divide-y md:hidden", fetching && "opacity-60")}>
              {showSkeleton ? (
                Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className="flex items-center gap-3 p-4">
                    <Skeleton className="size-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="h-3 w-3/4" />
                    </div>
                  </div>
                ))
              ) : (
                <AnimatePresence initial={false}>
                  {rows.map((row, i) => {
                    const id = getRowId(row);
                    return (
                      <motion.div
                        key={id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{
                          opacity: 1,
                          y: 0,
                          transition: { delay: Math.min(i * 0.03, 0.25) },
                        }}
                        exit={{ opacity: 0, x: -24 }}
                        className={cn("flex gap-3 p-4", highlightId === id && "highlight-row")}
                      >
                        {selectable && (
                          <Checkbox
                            aria-label="Select row"
                            className="mt-1"
                            checked={selected.has(id)}
                            onCheckedChange={() => toggle(id)}
                          />
                        )}
                        <div className="min-w-0 flex-1">{mobileCard(row)}</div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>
          )}
          {footer}
        </>
      )}
    </div>
  );
}
