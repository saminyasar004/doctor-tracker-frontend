import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Activity, Stethoscope, UserPlus, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard, StatCardSkeleton } from "@/components/common/stat-card";
import {
  ConditionDonut,
  GrowthChart,
  PatientsPerDoctorChart,
  SpecializationChart,
} from "@/components/charts/charts";
import { getSession } from "@/lib/api/auth";
import { dashboardQuery } from "@/lib/queries";
import { oneOf } from "@/lib/search-params";
import type { DashboardRange } from "@/lib/api/dashboard";

const RANGES = ["7D", "30D", "12M"] as const;

export const Route = createFileRoute("/_app/dashboard")({
  validateSearch: (s: Record<string, unknown>): { range?: DashboardRange | undefined } => ({
    range: oneOf(s["range"], RANGES),
  }),
  head: () => ({
    meta: [
      { title: "Dashboard — Doctor Tracker" },
      { name: "description", content: "Analytics overview of doctors and patients." },
      { property: "og:title", content: "Dashboard — Doctor Tracker" },
      { property: "og:description", content: "Analytics overview of doctors and patients." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const range: DashboardRange = Route.useSearch().range ?? "30D";
  const navigate = Route.useNavigate();
  const { data } = useQuery(dashboardQuery(range));
  const h = new Date().getHours();
  const greet = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  // "System Administrator" reads better as "System" than as the whole name.
  const firstName = getSession()?.user.name.split(" ")[0] ?? "there";
  return (
    <div className="space-y-6">
      <div className="bg-mesh relative overflow-hidden rounded-2xl border p-6">
        <div className="bg-grid absolute inset-0 opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE, MMMM d")}</p>
            <h1 className="text-2xl font-semibold sm:text-3xl">
              {greet}, {firstName}
            </h1>
          </div>
          <Tabs
            value={range}
            onValueChange={(v) =>
              navigate({ search: { range: v as DashboardRange }, replace: true })
            }
          >
            <TabsList>
              {RANGES.map((r) => (
                <TabsTrigger key={r} value={r}>
                  {r}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data ? (
          <>
            <StatCard id="d" title="Total Doctors" icon={Stethoscope} {...data.kpis.totalDoctors} />
            <StatCard id="p" title="Total Patients" icon={Users} {...data.kpis.totalPatients} />
            <StatCard
              id="a"
              title="Avg Patients per Doctor"
              icon={Activity}
              decimals={1}
              {...data.kpis.avgPerDoctor}
            />
            <StatCard
              id="n"
              title="New Patients This Month"
              icon={UserPlus}
              {...data.kpis.newThisMonth}
            />
          </>
        ) : (
          Array.from({ length: 4 }, (_, i) => <StatCardSkeleton key={i} />)
        )}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Patients per Doctor" desc="Top 8 by patient count">
          {data && <PatientsPerDoctorChart data={data.patientsPerDoctor} />}
        </ChartCard>
        <ChartCard title="Growth over time" desc="New patients and doctors">
          {data && <GrowthChart data={data.growth} />}
        </ChartCard>
        <ChartCard title="Conditions" desc="Distribution across all patients">
          {data && <ConditionDonut data={data.conditions} />}
        </ChartCard>
        <ChartCard title="Specializations" desc="Patients and doctors by field">
          {data && <SpecializationChart data={data.specializations} />}
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-2xl shadow-soft">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
      <CardContent>{children ?? <Skeleton className="h-[300px] w-full" />}</CardContent>
    </Card>
  );
}
