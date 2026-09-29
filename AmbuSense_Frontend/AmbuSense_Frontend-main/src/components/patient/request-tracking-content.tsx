"use client";

import Link from "next/link";
import { ArrowLeft, Check, Clock3, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TripMap } from "@/components/map/TripMap";
import { useFullTripRoute } from "@/hooks/use-trip-route";
import { useMyRequest } from "@/hooks/use-my-requests";
import { getFriendlyApiErrorMessage } from "@/lib/api";
import type { EmergencyRequestStatus } from "@/types/emergency-requests";

const timeline: { label: string; status: EmergencyRequestStatus }[] = [
  { label: "Request created", status: "pending" },
  { label: "Ambulance assigned", status: "assigned" },
  { label: "Driver on the way", status: "en-route" },
  { label: "Arrived at pickup", status: "at-patient" },
  { label: "Patient picked up", status: "transporting" },
  { label: "Arrived at hospital", status: "at-hospital" },
  { label: "Request completed", status: "completed" },
];

const statusOrder = timeline.map((item) => item.status);

function formatStatus(status: EmergencyRequestStatus) {
  return status.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatCoordinateDistance(distance?: number) {
  if (distance === undefined || !Number.isFinite(distance)) return null;
  return distance >= 1000
    ? `${(distance / 1000).toFixed(1)} km`
    : `${Math.round(distance)} m`;
}

export function RequestTrackingContent({ requestId }: { requestId: string }) {
  const requestQuery = useMyRequest(requestId);
  const request = requestQuery.data;
  const ambulanceId = request?.assignedAmbulance?.id ?? request?.assignedAmbulance?._id;
  const isClosed = request?.status === "completed" || request?.status === "cancelled";
  const tripStarted = request?.status !== "pending" && request?.status !== "assigned";
  const routeQuery = useFullTripRoute(
    requestId,
    Boolean(
      ambulanceId &&
        !isClosed &&
        tripStarted &&
        request?.assignedAmbulance?.locationUpdatedAt,
    ),
  );

  if (requestQuery.isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
        <div className="h-8 w-56 animate-pulse rounded bg-muted" />
        <div className="h-72 animate-pulse rounded-lg bg-muted" />
        <div className="h-40 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (requestQuery.isError || !request) {
    return (
      <div className="mx-auto max-w-3xl p-4 sm:p-6">
        <Button asChild variant="ghost">
          <Link href="/patient/requests"><ArrowLeft className="size-4" /> Requests</Link>
        </Button>
        <Card className="mt-4">
          <CardContent className="py-10 text-center">
            <h1 className="text-lg font-semibold">Tracking unavailable</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {getFriendlyApiErrorMessage(requestQuery.error)}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const assigned = Boolean(ambulanceId);
  const currentIndex = statusOrder.indexOf(request.status);
  const leg = routeQuery.data?.ambulanceToPickup;
  const distance = formatCoordinateDistance(leg?.distanceInMeters);
  const eta = typeof leg?.durationInMinutes === "number"
    ? `${Math.max(1, Math.round(leg.durationInMinutes))} min`
    : null;

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild className="-ml-3 mb-2" variant="ghost">
            <Link href="/patient/requests"><ArrowLeft className="size-4" /> Request history</Link>
          </Button>
          <h1 className="text-2xl font-semibold">Ambulance tracking</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Request #{request.id ?? request._id}
          </p>
        </div>
        <Badge>{formatStatus(request.status)}</Badge>
      </div>

      {!assigned && request.status === "pending" ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          Waiting for ambulance assignment. This page will show tracking when a driver is assigned.
        </div>
      ) : null}
      {isClosed ? (
        <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
          This request is closed. Live tracking has stopped.
        </div>
      ) : null}

      {assigned && !isClosed ? <TripMap trip={request} /> : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
        <Card>
          <CardHeader><h2 className="font-semibold">Request information</h2></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Info label="Patient" value={request.patientName} />
            <Info label="Patient phone" value={request.patientPhone} />
            <Info label="Pickup" value={request.pickupAddress || request.pickupLocation.coordinates.join(", ")} />
            <Info label="Preferred hospital" value={request.assignedHospital?.name ?? "Not assigned"} />
            <Info label="Notes" value={request.notes?.trim() || "None"} />
            {assigned ? <Info label="Estimated arrival" value={eta ?? "Route estimate unavailable"} /> : null}
            {assigned ? <Info label="Distance to pickup" value={distance ?? "Route distance unavailable"} /> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><h2 className="font-semibold">Ambulance and driver</h2></CardHeader>
          <CardContent className="space-y-4">
            {request.assignedAmbulance ? (
              <>
                <Info label="Ambulance number" value={request.assignedAmbulance.ambulanceCode} />
                <Info label="Driver" value={request.assignedAmbulance.driverName} />
                <Info label="Driver phone" value={request.assignedAmbulance.phone} />
                <Button asChild variant="outline">
                  <a href={`tel:${request.assignedAmbulance.phone}`}><Phone className="size-4" /> Call driver</a>
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No ambulance has been assigned yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><h2 className="font-semibold">Request progress</h2></CardHeader>
        <CardContent>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {timeline.map((item, index) => {
              const done = request.status === "cancelled"
                ? index === 0
                : currentIndex >= index;
              const current = request.status !== "cancelled" && currentIndex === index;
              return (
                <li className="flex items-center gap-3" key={item.status}>
                  <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${done ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"}`}>
                    {done ? <Check className="size-4" /> : <Clock3 className="size-4" />}
                  </span>
                  <span className={current ? "text-sm font-semibold" : "text-sm text-muted-foreground"}>{item.label}</span>
                </li>
              );
            })}
          </ol>
          {request.status === "cancelled" ? (
            <p className="mt-4 text-sm text-destructive">Request cancelled{request.cancellationReason ? `: ${request.cancellationReason}` : "."}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-medium">{value}</p>
    </div>
  );
}