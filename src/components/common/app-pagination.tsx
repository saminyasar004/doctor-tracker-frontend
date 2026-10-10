import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Pagination as PaginationRoot,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Paginated } from "@/lib/types";

function pageList(page: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, page - 1, page, page + 1].filter((p) => p >= 1 && p <= total));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((p, i) => {
    const prev = i > 0 ? sorted[i - 1] : undefined;
    if (prev !== undefined && p - prev > 1) out.push("…");
    out.push(p);
  });
  return out;
}

export function Pagination({
  meta,
  onPageChange,
  onLimitChange,
  limitOptions = [10, 20, 50],
}: {
  meta: Paginated<unknown>["meta"];
  onPageChange: (p: number) => void;
  onLimitChange?: ((l: number) => void) | undefined;
  limitOptions?: number[] | undefined;
}) {
  const from = meta.total ? (meta.page - 1) * meta.limit + 1 : 0;
  const to = Math.min(meta.page * meta.limit, meta.total);
  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t px-4 py-3 sm:flex-row">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>
          Showing <span className="font-medium text-foreground">{from}</span> to{" "}
          <span className="font-medium text-foreground">{to}</span> of{" "}
          <span className="font-medium text-foreground">{meta.total}</span>
        </span>
        {onLimitChange && (
          <Select value={String(meta.limit)} onValueChange={(v) => onLimitChange(Number(v))}>
            <SelectTrigger aria-label="Rows per page" className="h-8 w-[76px] rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {limitOptions.map((l) => (
                <SelectItem key={l} value={String(l)}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <PaginationRoot className="mx-0 w-auto">
        <PaginationContent>
          <PaginationItem>
            <Button
              variant="ghost"
              size="sm"
              disabled={!meta.hasPrev}
              onClick={() => onPageChange(meta.page - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft /> <span className="hidden sm:inline">Prev</span>
            </Button>
          </PaginationItem>
          {pageList(meta.page, meta.totalPages).map((p, i) =>
            p === "…" ? (
              <PaginationItem key={`e${i}`} className="hidden sm:block">
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={p} className="hidden sm:block">
                <Button
                  variant={p === meta.page ? "outline" : "ghost"}
                  size="sm"
                  className="min-w-8"
                  aria-current={p === meta.page ? "page" : undefined}
                  onClick={() => onPageChange(p)}
                >
                  {p}
                </Button>
              </PaginationItem>
            ),
          )}
          <PaginationItem>
            <Button
              variant="ghost"
              size="sm"
              disabled={!meta.hasNext}
              onClick={() => onPageChange(meta.page + 1)}
              aria-label="Next page"
            >
              <span className="hidden sm:inline">Next</span> <ChevronRight />
            </Button>
          </PaginationItem>
        </PaginationContent>
      </PaginationRoot>
    </div>
  );
}
