import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartConfig } from "@/components/ui/chart";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

export const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--tone-emerald)",
  "var(--tone-orange)",
  "var(--tone-violet)",
  "var(--tone-sky)",
  "var(--tone-rose)",
  "var(--tone-amber)",
  "var(--tone-slate)",
];

export function PatientsPerDoctorChart({
  data,
}: {
  data: { name: string; specialization: string; patients: number }[];
}) {
  return (
    <ChartContainer
      config={{ patients: { label: "Patients", color: "var(--chart-1)" } }}
      className="aspect-auto h-[300px] w-full"
    >
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 24 }}>
        <defs>
          <linearGradient id="ppd" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--brand-from)" />
            <stop offset="100%" stopColor="var(--brand-to)" />
          </linearGradient>
        </defs>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis type="number" hide />
        <YAxis
          dataKey="name"
          type="category"
          width={132}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: string) => (v.length > 18 ? `${v.slice(0, 17)}…` : v)}
        />
        <ChartTooltip
          cursor={{ fill: "var(--muted)" }}
          content={({ active, payload }) => {
            const p = payload?.[0]?.payload as
              { name: string; specialization: string; patients: number } | undefined;
            if (!active || !p) return null;
            return (
              <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-soft">
                <p className="font-semibold">{p.name}</p>
                <p className="text-muted-foreground">{p.specialization}</p>
                <p className="mt-1 font-medium tabular-nums">{p.patients} patients</p>
              </div>
            );
          }}
        />
        <Bar
          dataKey="patients"
          fill="url(#ppd)"
          radius={[0, 6, 6, 0]}
          barSize={18}
          animationDuration={800}
        />
      </BarChart>
    </ChartContainer>
  );
}

export function GrowthChart({
  data,
}: {
  data: { label: string; patients: number; doctors: number }[];
}) {
  return (
    <ChartContainer
      config={{
        patients: { label: "New patients", color: "var(--chart-1)" },
        doctors: { label: "New doctors", color: "var(--chart-2)" },
      }}
      className="aspect-auto h-[300px] w-full"
    >
      <AreaChart data={data} margin={{ left: -16, right: 8, top: 8 }}>
        <defs>
          {(["patients", "doctors"] as const).map((k) => (
            <linearGradient key={k} id={`g-${k}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={`var(--color-${k})`} stopOpacity={0.35} />
              <stop offset="100%" stopColor={`var(--color-${k})`} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={16} />
        <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
        <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Area
          type="monotone"
          dataKey="patients"
          stroke="var(--color-patients)"
          strokeWidth={2}
          fill="url(#g-patients)"
          animationDuration={900}
        />
        <Area
          type="monotone"
          dataKey="doctors"
          stroke="var(--color-doctors)"
          strokeWidth={2}
          fill="url(#g-doctors)"
          animationDuration={900}
        />
      </AreaChart>
    </ChartContainer>
  );
}

export function ConditionDonut({ data }: { data: { name: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const config: ChartConfig = {};
  data.forEach((d, i) => {
    config[d.name] = {
      label: d.name,
      color: PALETTE[i % PALETTE.length] ?? PALETTE[0] ?? "var(--chart-1)",
    };
  });
  return (
    <div className="grid h-full items-center gap-4 sm:grid-cols-[1fr_1fr]">
      <ChartContainer config={config} className="mx-auto aspect-square h-[220px]">
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="name" />} />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="58%"
            outerRadius="86%"
            paddingAngle={2}
            strokeWidth={0}
            animationDuration={900}
          >
            {data.map((d, i) => (
              <Cell key={d.name} fill={PALETTE[i % PALETTE.length]} />
            ))}
            <Label
              content={({ viewBox }) => {
                if (!viewBox || !("cx" in viewBox) || viewBox.cx == null || viewBox.cy == null)
                  return null;
                return (
                  <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                    <tspan
                      x={viewBox.cx}
                      y={viewBox.cy - 6}
                      className="fill-foreground text-2xl font-semibold"
                    >
                      {total}
                    </tspan>
                    <tspan
                      x={viewBox.cx}
                      y={viewBox.cy + 16}
                      className="fill-muted-foreground text-xs"
                    >
                      patients
                    </tspan>
                  </text>
                );
              }}
            />
          </Pie>
        </PieChart>
      </ChartContainer>
      <ul className="space-y-1.5 text-sm">
        {data.slice(0, 8).map((d, i) => (
          <li key={d.name} className="flex items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: PALETTE[i % PALETTE.length] }}
            />
            <span className="flex-1 truncate">{d.name}</span>
            <span className="tabular-nums text-muted-foreground">
              {((d.value / total) * 100).toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SpecializationChart({
  data,
}: {
  data: { name: string; doctors: number; patients: number }[];
}) {
  return (
    <ChartContainer
      config={{
        patients: { label: "Patients", color: "var(--chart-1)" },
        doctors: { label: "Doctors", color: "var(--chart-2)" },
      }}
      className="aspect-auto h-[300px] w-full"
    >
      <BarChart data={data} margin={{ left: -16, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="name"
          tickLine={false}
          axisLine={false}
          interval={0}
          angle={-35}
          textAnchor="end"
          height={54}
          fontSize={11}
        />
        <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
        <ChartTooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="patients" radius={[6, 6, 0, 0]} animationDuration={800}>
          {data.map((d, i) => (
            <Cell key={d.name} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Bar>
        <Bar
          dataKey="doctors"
          fill="var(--color-doctors)"
          radius={[6, 6, 0, 0]}
          fillOpacity={0.35}
          animationDuration={800}
        />
      </BarChart>
    </ChartContainer>
  );
}

export function MonthlyBars({ data }: { data: { label: string; patients: number }[] }) {
  return (
    <ChartContainer
      config={{ patients: { label: "Patients added", color: "var(--chart-1)" } }}
      className="aspect-auto h-[180px] w-full"
    >
      <BarChart data={data} margin={{ left: -24, right: 4, top: 8 }}>
        <defs>
          <linearGradient id="mb" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand-to)" />
            <stop offset="100%" stopColor="var(--brand-from)" />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
        <ChartTooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltipContent />} />
        <Bar dataKey="patients" fill="url(#mb)" radius={[5, 5, 0, 0]} animationDuration={800} />
      </BarChart>
    </ChartContainer>
  );
}
