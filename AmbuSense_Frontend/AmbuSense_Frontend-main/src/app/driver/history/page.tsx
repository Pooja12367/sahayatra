"use client";

import { useQuery } from "@tanstack/react-query";
import { Ambulance, ArrowLeft, History } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEmergencyRequests } from "@/hooks/use-emergency-requests";
import type { EmergencyRequestStatus } from "@/types/emergency-requests";
import { Button } from "@/components/ui/button";

function formatRequestStatus(value: string | undefined) {
  if (!value) return "Unknown";
  return value.split("-").map(p => p[0].toUpperCase() + p.slice(1)).join(" ");
}

function getRequestStatusClass(status: EmergencyRequestStatus) {
  switch (status) {
    case "completed":
      return "border-green-200 bg-green-50 text-green-700";
    case "cancelled":
      return "border-red-200 bg-red-50 text-red-700";
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-blue-200 bg-blue-50 text-blue-700";
  }
}

function formatDate(value: string | undefined | null) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function DriverHistoryPage() {
  const { data: requests, isLoading, isError } = useEmergencyRequests();

  return (
    <main className="p-4 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="overflow-hidden rounded-lg border border-blue-100/80 bg-white/90 shadow-xl shadow-blue-950/5 backdrop-blur p-6">
          <div className="flex items-center gap-4">
            <Button asChild variant="outline" size="icon" className="shrink-0">
              <Link href="/driver">
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                <History className="size-4" />
                Ride History
              </div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                Past and Active Rides
              </h1>
            </div>
          </div>
        </section>

        <Card>
          {isLoading ? (
            <CardContent className="p-6 text-sm text-muted-foreground text-center">
              Loading history...
            </CardContent>
          ) : isError ? (
            <CardContent className="p-6 text-sm text-red-600 text-center">
              Failed to load ride history.
            </CardContent>
          ) : !requests || requests.length === 0 ? (
            <CardContent className="flex flex-col items-center justify-center p-10 text-center">
              <History className="size-10 text-muted-foreground" />
              <h2 className="mt-4 text-lg font-semibold">No rides found</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                You haven't completed or been assigned to any rides yet.
              </p>
            </CardContent>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Hospital</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map(req => (
                    <TableRow key={req.id ?? req._id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatDate(req.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{req.patientName}</div>
                        <div className="text-xs text-muted-foreground">{req.patientPhone}</div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {req.pickupLocation?.coordinates ? "Location tracked" : "N/A"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {req.assignedHospital?.name ?? "Not assigned"}
                      </TableCell>
                      <TableCell>
                        <Badge className={getRequestStatusClass(req.status)}>
                          {formatRequestStatus(req.status)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
