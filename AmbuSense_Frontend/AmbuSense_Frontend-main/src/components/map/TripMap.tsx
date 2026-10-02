"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useFullTripRoute } from "@/hooks/use-trip-route";
import { getFriendlyApiErrorMessage } from "@/lib/api";
import {
  acquireSocketConnection,
  releaseSocketConnection,
  socket,
} from "@/lib/socket";
import type { Ambulance } from "@/types/ambulances";
import type { EmergencyRequest } from "@/types/emergency-requests";
import type { RouteCoordinates } from "@/types/routes";

const TripMapClient = dynamic(() => import("./TripMap.client"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[400px] items-center justify-center bg-muted/30 text-sm text-muted-foreground">
      Loading map...
    </div>
  ),
});

type TrackingLocationPayload = {
  requestId: string;
  ambulanceId: string;
  coordinates: RouteCoordinates;
  timestamp?: string;
};

type TrackingJoinResponse = {
  ok: boolean;
  trackingActive: boolean;
  ambulanceId?: string;
  coordinates?: RouteCoordinates;
  locationUpdatedAt?: string;
};

function getRequestId(request: EmergencyRequest) {
  return request.id ?? request._id ?? "";
}

function getAmbulanceId(ambulance: Ambulance | null | undefined) {
  return ambulance?.id ?? ambulance?._id ?? "";
}

function isValidCoordinates(
  coordinates: RouteCoordinates | null | undefined,
): coordinates is RouteCoordinates {
  return (
    Array.isArray(coordinates) &&
    coordinates.length === 2 &&
    coordinates.every((coordinate) => Number.isFinite(coordinate))
  );
}

function formatDistance(value: number | undefined) {
  if (typeof value !== "number") {
    return "Route unavailable";
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)} km`;
  }

  return `${Math.round(value)} m`;
}

function formatDuration(value: number | undefined) {
  if (typeof value !== "number") {
    return "Duration unavailable";
  }

  return `${Math.max(1, Math.round(value / 60))} min`;
}

export function TripMap({ trip }: { trip: EmergencyRequest }) {
  const queryClient = useQueryClient();
  const requestId = getRequestId(trip);
  const ambulanceId = getAmbulanceId(trip.assignedAmbulance);
  const [liveAmbulanceCoordinates, setLiveAmbulanceCoordinates] =
    useState<RouteCoordinates | null>(
      trip.assignedAmbulance?.locationUpdatedAt
        ? trip.assignedAmbulance.currentLocation?.coordinates ?? null
        : null,
    );
  const [locationUpdatedAt, setLocationUpdatedAt] = useState<string | null>(
    trip.assignedAmbulance?.locationUpdatedAt ?? null,
  );
  const [trackingActive, setTrackingActive] = useState(false);
  const [clockNow, setClockNow] = useState(Date.now());
  const [isFullscreen, setIsFullscreen] = useState(false);

  const ambulanceCoordinates = liveAmbulanceCoordinates;
  const pickupCoordinates = trip.pickupLocation?.coordinates;
  const hospitalCoordinates = trip.assignedHospital?.location?.coordinates;
  const hasCoordinates =
    isValidCoordinates(ambulanceCoordinates) &&
    isValidCoordinates(pickupCoordinates) &&
    isValidCoordinates(hospitalCoordinates);
  const routeQuery = useFullTripRoute(
    requestId,
    Boolean(requestId && ambulanceId && hasCoordinates),
  );

  useEffect(() => {
    const storedLocationIsGps = Boolean(
      trip.assignedAmbulance?.locationUpdatedAt,
    );
    setLiveAmbulanceCoordinates(
      storedLocationIsGps
        ? trip.assignedAmbulance?.currentLocation?.coordinates ?? null
        : null,
    );
    setLocationUpdatedAt(
      storedLocationIsGps
        ? trip.assignedAmbulance?.locationUpdatedAt ?? null
        : null,
    );
  }, [
    ambulanceId,
    requestId,
    trip.assignedAmbulance?.locationUpdatedAt,
    trip.status,
  ]);

  useEffect(() => {
    if (
      !requestId ||
      !ambulanceId ||
      trip.status === "completed" ||
      trip.status === "cancelled"
    ) {
      return;
    }

    let mounted = true;
    const joinRequestRoom = () => {
      socket.emit(
        "tracking.request.join",
        { requestId },
        (response: TrackingJoinResponse) => {
          if (!mounted || !response?.ok) return;
          setTrackingActive(response.trackingActive);
          if (
            response.trackingActive &&
            response.ambulanceId === ambulanceId &&
            response.locationUpdatedAt &&
            isValidCoordinates(response.coordinates)
          ) {
            setLiveAmbulanceCoordinates(response.coordinates);
            setLocationUpdatedAt(response.locationUpdatedAt ?? null);
          }
        },
      );
    };
    const handleLocationUpdated = (payload: TrackingLocationPayload) => {
      if (
        payload.requestId !== requestId ||
        payload.ambulanceId !== ambulanceId ||
        !isValidCoordinates(payload.coordinates)
      ) {
        return;
      }

      setLiveAmbulanceCoordinates(payload.coordinates);
      setLocationUpdatedAt(payload.timestamp ?? new Date().toISOString());
      setTrackingActive(true);
      queryClient.invalidateQueries({
        queryKey: ["trip-route", "full", requestId],
      });
    };
    const handleTrackingStopped = (payload: { requestId: string }) => {
      if (payload.requestId === requestId) setTrackingActive(false);
    };
    const handleDisconnect = () => setTrackingActive(false);

    socket.on("connect", joinRequestRoom);
    socket.on("disconnect", handleDisconnect);
    socket.on("tracking.location.updated", handleLocationUpdated);
    socket.on("tracking.stopped", handleTrackingStopped);
    const token = acquireSocketConnection();
    if (socket.connected) joinRequestRoom();

    return () => {
      mounted = false;
      socket.emit("tracking.request.leave", { requestId });
      socket.off("connect", joinRequestRoom);
      socket.off("disconnect", handleDisconnect);
      socket.off("tracking.location.updated", handleLocationUpdated);
      socket.off("tracking.stopped", handleTrackingStopped);
      releaseSocketConnection(token);
    };
  }, [ambulanceId, queryClient, requestId, trip.status]);

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  // Close fullscreen on Escape key
  useEffect(() => {
    if (!isFullscreen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isFullscreen]);

  // Prevent body scroll when fullscreen is open
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isFullscreen]);

  const routeSummary = useMemo(() => {
    if (!routeQuery.data) {
      return null;
    }

    return {
      distance: formatDistance(routeQuery.data.totalDistance),
      duration: formatDuration(routeQuery.data.totalDuration),
    };
  }, [routeQuery.data]);

  const mapProps = hasCoordinates
    ? {
        ambulanceCoordinates: ambulanceCoordinates!,
        hospitalCoordinates: hospitalCoordinates!,
        pickupCoordinates: pickupCoordinates!,
        route: routeQuery.data ?? null,
        ambulanceDetails: {
          code: trip.assignedAmbulance?.ambulanceCode ?? "Unknown",
          driverName: trip.assignedAmbulance?.driverName,
        },
        hospitalDetails: {
          name: trip.assignedHospital?.name ?? "Hospital",
        },
        patientDetails: {
          name: trip.patientName,
          phone: trip.patientPhone,
        },
        onFullscreenToggle: () => setIsFullscreen((v) => !v),
      }
    : null;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-50 p-2 text-blue-700">
                <MapPin className="size-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Trip map</h2>
                <p className="text-sm text-muted-foreground">
                  Ambulance, pickup, hospital, and OSRM route overview.
                </p>
              </div>
            </div>
            {routeSummary ? (
              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-right text-xs">
                <p className="font-medium">{routeSummary.distance}</p>
                <p className="text-muted-foreground">{routeSummary.duration}</p>
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p aria-live="polite" className="text-sm text-muted-foreground">
            {!locationUpdatedAt
              ? trackingActive
                ? "Waiting for driver's location..."
                : trip.status === "assigned"
                  ? "Waiting for driver to accept and start the trip."
                  : "Driver location unavailable."
              : clockNow - new Date(locationUpdatedAt).getTime() > 30000
                ? "Driver location unavailable. Last update is stale."
                : `Live location updated ${Math.max(0, Math.floor((clockNow - new Date(locationUpdatedAt).getTime()) / 1000))} seconds ago.`}
          </p>
          {!hasCoordinates ? (
            <MapState
              description="The map needs ambulance, pickup, and hospital coordinates before it can render."
              title="Map coordinates unavailable"
            />
          ) : null}

          {hasCoordinates && routeQuery.isError ? (
            <MapState
              description={getFriendlyApiErrorMessage(routeQuery.error)}
              title="Route unavailable"
              tone="warning"
            />
          ) : null}

          {hasCoordinates ? (
            <div className="overflow-hidden rounded-xl border">
              <TripMapClient {...mapProps!} fullscreen={false} />
            </div>
          ) : null}

          {hasCoordinates && routeQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">
              Loading OSRM route...
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* Fullscreen overlay — rendered via a portal so it covers the whole viewport */}
      {isFullscreen && hasCoordinates
        ? createPortal(
            <div
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 9999,
                background: "#000",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Compact top bar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  background: "rgba(0,0,0,0.7)",
                  backdropFilter: "blur(8px)",
                  color: "#fff",
                  flexShrink: 0,
                  zIndex: 10000,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <MapPin size={18} />
                  <span style={{ fontWeight: 600, fontSize: "14px" }}>Trip map</span>
                  {routeSummary ? (
                    <span
                      style={{
                        fontSize: "12px",
                        background: "rgba(255,255,255,0.15)",
                        borderRadius: "6px",
                        padding: "2px 8px",
                        marginLeft: "8px",
                      }}
                    >
                      {routeSummary.distance} · {routeSummary.duration}
                    </span>
                  ) : null}
                </div>
                <button
                  onClick={() => setIsFullscreen(false)}
                  title="Exit fullscreen (Esc)"
                  style={{
                    background: "rgba(255,255,255,0.15)",
                    border: "1px solid rgba(255,255,255,0.3)",
                    borderRadius: "6px",
                    color: "#fff",
                    padding: "4px 12px",
                    cursor: "pointer",
                    fontSize: "13px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" />
                  </svg>
                  Exit fullscreen
                </button>
              </div>

              {/* Map fills the remaining height */}
              <div style={{ flex: 1, position: "relative" }}>
                <TripMapClient
                  {...mapProps!}
                  fullscreen={true}
                  onFullscreenToggle={() => setIsFullscreen(false)}
                />
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function MapState({
  description,
  title,
  tone = "default",
}: {
  description: string;
  title: string;
  tone?: "default" | "warning";
}) {
  return (
    <div
      className={
        tone === "warning"
          ? "flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900"
          : "flex gap-3 rounded-lg border bg-muted/30 p-4 text-muted-foreground"
      }
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-sm">{description}</p>
      </div>
    </div>
  );
}
