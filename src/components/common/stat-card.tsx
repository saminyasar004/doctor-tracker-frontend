import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Area, AreaChart } from "recharts";
import { Card } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { useCountUp } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";

export function StatCard({
  title,
  value,
  delta,
  spark,
  icon: Icon,
  decimals = 0,
  id,
}: {
  title: string;
  value: number;
  delta: number;
  spark: number[];
  icon: LucideIcon;
  decimals?: number;
  id: string;
}) {
  const n = useCountUp(value);
  const up = delta >= 0;
  const data = spark.map((v, i) => ({ i, v }));
  return (
    <Card className="group relative gap-0 overflow-hidden rounded-2xl p-5 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-start justify-between">
        <div className="grid size-10 place-items-center rounded-xl bg-brand text-brand-foreground glow">
          <Icon className="size-5" />
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium",
            up ? "bg-success/12 text-success" : "bg-destructive/12 text-destructive",
          )}
        >
          {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
          {Math.abs(delta).toFixed(1)}%
        </span>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{title}</p>
      <div className="mt-1 flex items-end justify-between gap-3">
        <p className="text-3xl font-semibold tabular-nums tracking-tight">
          {n.toLocaleString(undefined, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          })}
        </p>
        <ChartContainer
          config={{ v: { label: title, color: "var(--chart-1)" } }}
          className="aspect-auto h-10 w-24"
        >
          <AreaChart data={data} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
            <defs>
              <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--brand-to)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--brand-to)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="v"
              stroke="var(--brand-to)"
              strokeWidth={2}
              fill={`url(#spark-${id})`}
              animationDuration={900}
            />
          </AreaChart>
        </ChartContainer>
      </div>
    </Card>
  );
}

export function StatCardSkeleton() {
  return (
    <Card className="gap-0 rounded-2xl p-5">
      <Skeleton className="size-10 rounded-xl" />
      <Skeleton className="mt-4 h-3 w-24" />
      <Skeleton className="mt-3 h-7 w-20" />
    </Card>
  );
}
