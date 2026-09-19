"use client";

import Link from "next/link";
import {
  Ambulance,
  Building2,
  CheckCircle2,
  Clock3,
  HeartPulse,
  PowerOff,
  Route,
  XCircle,
} from "lucide-react";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useDashboardSummary } from "@/hooks/use-dashboard-summary";
import { getFriendlyApiErrorMessage } from "@/lib/api";

export default function AdminPage() {
  const { data, isLoading, isError, error } = useDashboardSummary();

  if (isLoading) {
    return (
      <main className="p-4 sm:p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">
              Loading dashboard summary...
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (isError || !data) {
    return (
      <main className="p-4 sm:p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <p className="font-medium text-red-800">
              Failed to load dashboard summary
            </p>
            <p className="mt-1 text-sm text-red-700">
              {getFriendlyApiErrorMessage(error)}
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  const ambulanceStatus = data.ambulances.byStatus;
  const requestStatus = data.emergencyRequests.byStatus;

  return (
    <main className="space-y-6 p-4 sm:p-6">
      <section className="overflow-hidden rounded-lg border border-blue-100/80 bg-white/90 shadow-xl shadow-blue-950/5 backdrop-blur">
        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Badge className="border-blue-200 bg-blue-50 text-blue-700">
              <HeartPulse className="size-3.5" />
              System overview
            </Badge>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight">
              Admin Dashboard
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Monitor ambulances, emergency requests, and hospital capacity
              from one operational view.
            </p>
          </div>
          <Badge className="border-slate-200 bg-slate-50 text-slate-700">
            Live backend stats
          </Badge>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          description="All registered ambulance units"
          href="/admin/ambulances"
          icon={Ambulance}
          title="Total ambulances"
          value={data.ambulances.total}
        />
        <AdminStatCard
          description="Ready for dispatch"
          href="/admin/ambulances?status=available&active=active"
          icon={CheckCircle2}
          title="Available ambulances"
          tone="green"
          value={ambulanceStatus.available}
        />
        <AdminStatCard
          description="Units currently offline"
          href="/admin/ambulances?status=offline"
          icon={PowerOff}
          title="Offline ambulances"
          tone="red"
          value={ambulanceStatus.offline}
        />
        <AdminStatCard
          description="Hospitals in the network"
          href="/admin/hospitals"
          icon={Building2}
          title="Hospitals"
          tone="blue"
          value={data.hospitals.total}
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          description="All emergency requests"
          href="/admin/requests"
          icon={HeartPulse}
          title="Total requests"
          tone="slate"
          value={data.emergencyRequests.total}
        />
        <AdminStatCard
          description="Requests awaiting assignment"
          href="/admin/requests?status=pending"
          icon={Clock3}
          title="Pending requests"
          tone="amber"
          value={requestStatus.pending}
        />
        <AdminStatCard
          description="Requests not completed or cancelled"
          href="/admin/requests?active=true"
          icon={Route}
          title="Active trips"
          tone="blue"
          value={data.emergencyRequests.active}
        />
        <AdminStatCard
          description="Cancelled requests"
          href="/admin/requests?status=cancelled"
          icon={XCircle}
          title="Cancelled requests"
          tone="red"
          value={requestStatus.cancelled}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Link
          aria-label="Open completed requests"
          className="block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-blue-500/25"
          href="/admin/requests?status=completed"
        >
        <Card className="h-full border-blue-100/80 bg-white/90 shadow-lg shadow-blue-950/5 transition hover:border-blue-200 hover:bg-white hover:shadow-xl hover:shadow-blue-950/10">
          <CardHeader>
            <h2 className="text-lg font-semibold">Request completion</h2>
            <p className="text-sm text-muted-foreground">
              Completed request count from backend status totals.
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-4xl font-semibold">
                  {requestStatus.completed}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  completed requests
                </p>
              </div>
              <Badge className="border-green-200 bg-green-50 text-green-700">
                Completed
              </Badge>
            </div>
          </CardContent>
        </Card>
        </Link>

        <Link
          aria-label="Open hospital capacity"
          className="block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-blue-500/25"
          href="/admin/hospitals?status=available&hasAvailableBeds=true"
        >
        <Card className="h-full border-blue-100/80 bg-white/90 shadow-lg shadow-blue-950/5 transition hover:border-blue-200 hover:bg-white hover:shadow-xl hover:shadow-blue-950/10">
          <CardHeader>
            <h2 className="text-lg font-semibold">Hospital capacity</h2>
            <p className="text-sm text-muted-foreground">
              Availability across registered hospitals.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Available hospitals
              </span>
              <span className="font-medium">{data.hospitals.available}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                With available beds
              </span>
              <span className="font-medium">
                {data.hospitals.withAvailableBeds}
              </span>
            </div>
          </CardContent>
        </Card>
        </Link>
      </section>
    </main>
  );
}
