"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ambulance,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FileImage,
  FileUp,
  History,
  Lock,
  MapPin,
  Navigation,
  Phone,
  RadioTower,
  Route,
  ShieldAlert,
  ShieldCheck,
  WifiOff,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TripMap } from "@/components/map/TripMap";
import { LocationDisplay } from "@/components/location/location-display";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useMe } from "@/hooks/use-auth";
import {
  useDriverAmbulance,
  useUpdateAmbulanceStatus,
} from "@/hooks/use-driver-ambulance";
import {
  driverTripKeys,
  useDriverMyTrip,
  useRejectDriverTrip,
  useUpdateDriverTripStatus,
} from "@/hooks/use-driver-trip";
import { api, getFriendlyApiErrorMessage } from "@/lib/api";
import {
  acquireSocketConnection,
  releaseSocketConnection,
  socket,
} from "@/lib/socket";
import type { Ambulance as AmbulanceType } from "@/types/ambulances";
import type {
  DriverDocumentUploadResponse,
  UploadedMedia,
} from "@/types/auth";
import type {
  EmergencyRequest,
  EmergencyRequestStatus,
} from "@/types/emergency-requests";

const documentTypes = [
  "Driving License",
  "National ID",
  "Ambulance Permit",
] as const;

type VerificationState = "verified" | "pending" | "required" | "rejected";

function getVerificationState(
  isVerified: boolean | undefined,
  documentImageId: string | null | undefined,
  verificationNote: string | null | undefined,
): VerificationState {
  if (isVerified) {
    return "verified";
  }

  if (documentImageId && verificationNote) {
    return "rejected";
  }

  if (documentImageId) {
    return "pending";
  }

  return "required";
}

function verificationCopy(state: VerificationState) {
  if (state === "verified") {
    return {
      label: "Verified",
      title: "Verified driver",
      description:
        "Your profile is approved. You can access trip controls as they become available.",
      badgeClass: "border-green-200 bg-green-50 text-green-700",
      Icon: ShieldCheck,
    };
  }

  if (state === "pending") {
    return {
      label: "Waiting for admin approval",
      title: "Waiting for admin approval",
      description:
        "Your document is uploaded. An admin must verify it before you can accept trips.",
      badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
      Icon: Clock3,
    };
  }

  if (state === "rejected") {
    return {
      label: "Rejected",
      title: "Document needs attention",
      description:
        "Your last submission was not approved. Review the note and upload a replacement document.",
      badgeClass: "border-red-200 bg-red-50 text-red-700",
      Icon: XCircle,
    };
  }

  return {
    label: "Not uploaded",
    title: "Verification required",
    description:
      "Upload a driver document so an admin can review your profile.",
    badgeClass: "border-red-200 bg-red-50 text-red-700",
    Icon: ShieldAlert,
  };
}

function resolveMediaUrl(media: UploadedMedia | null) {
  if (!media?.url) {
    return null;
  }

  if (media.url.startsWith("http")) {
    return media.url;
  }

  const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL || "https://sahayatra-backend-fa4y.onrender.com/api";
  const origin = apiBaseUrl.replace(/\/api\/?$/, "");

  return `${origin}${media.url}`;
}

const nextStatusByStatus: Partial<
  Record<EmergencyRequestStatus, EmergencyRequestStatus>
> = {
  assigned: "en-route",
  "en-route": "at-patient",
  "at-patient": "transporting",
  transporting: "at-hospital",
  "at-hospital": "completed",
};

function formatStatus(value: string | null | undefined) {
  if (!value) {
    return "Not assigned";
  }

  return value
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function getStatusClass(status: EmergencyRequestStatus) {
  switch (status) {
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "assigned":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "en-route":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "at-patient":
      return "border-red-200 bg-red-50 text-red-700";
    case "transporting":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "at-hospital":
      return "border-red-200 bg-red-50 text-red-700";
    case "completed":
      return "border-green-200 bg-green-50 text-green-700";
    case "cancelled":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatLocation(request: EmergencyRequest) {
  const coordinates = request.pickupLocation?.coordinates;
  return (
    <LocationDisplay
      coordinates={coordinates}
      label="Pickup location"
      tone="muted"
    />
  );
}

function getAmbulanceId(ambulance: AmbulanceType | null | undefined) {
  return ambulance?.id ?? ambulance?._id ?? "";
}

function getAmbulanceLabel(ambulance: AmbulanceType | null | undefined) {
  return ambulance?.ambulanceCode ?? "Not assigned";
}

function getRequestId(request: EmergencyRequest | null | undefined) {
  return request?.id ?? request?._id ?? "";
}

function getHospitalLabel(request: EmergencyRequest | null | undefined) {
  return request?.assignedHospital?.name ?? "Not assigned";
}

function isTrackableTrip(trip: EmergencyRequest | null | undefined) {
  return Boolean(
    trip &&
      ["en-route", "at-patient", "transporting", "at-hospital"].includes(
        trip.status,
      ) &&
      getAmbulanceId(trip.assignedAmbulance),
  );
}

// Full-screen emergency alert overlay shown when a new trip is assigned
function EmergencyAlertOverlay({
  isStatusPending,
  isRejectPending,
  onStatusUpdate,
  onTripReject,
  trip,
}: {
  isStatusPending: boolean;
  isRejectPending: boolean;
  onStatusUpdate: (status: EmergencyRequestStatus) => void;
  onTripReject: (requestId: string) => void;
  trip: EmergencyRequest;
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      aria-live="assertive"
      aria-modal="true"
      id="emergency-alert-overlay"
      role="alertdialog"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(10, 10, 20, 0.97)",
        animation: "emergencyFlash 1s ease-in-out infinite alternate",
      }}
    >
      <style>{`
        @keyframes emergencyFlash {
          from { background: rgba(10, 10, 20, 0.97); }
          to   { background: rgba(40, 0, 0, 0.97); }
        }
        @keyframes emergencyPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50%       { transform: scale(1.06); opacity: 0.85; }
        }
        @keyframes emergencyRing {
          0%   { box-shadow: 0 0 0 0px rgba(239,68,68,0.7); }
          70%  { box-shadow: 0 0 0 30px rgba(239,68,68,0); }
          100% { box-shadow: 0 0 0 0px rgba(239,68,68,0); }
        }
        #emergency-alert-overlay .alert-icon {
          animation: emergencyPulse 1s ease-in-out infinite;
        }
        #emergency-alert-overlay .ring-btn {
          animation: emergencyRing 1.4s ease-out infinite;
        }
      `}</style>

      {/* Icon + title */}
      <div className="alert-icon mb-6 flex flex-col items-center gap-4 text-center">
        <div style={{
          fontSize: "5rem",
          lineHeight: 1,
          filter: "drop-shadow(0 0 24px rgba(239,68,68,0.9))",
        }}>🚨</div>
        <h1 style={{
          color: "#fff",
          fontSize: "clamp(1.6rem, 5vw, 2.4rem)",
          fontWeight: 800,
          letterSpacing: "-0.02em",
          textShadow: "0 0 30px rgba(239,68,68,0.7)",
          margin: 0,
        }}>New Emergency Request</h1>
        <p style={{
          color: "rgba(255,255,255,0.65)",
          fontSize: "1rem",
          margin: 0,
          maxWidth: "26rem",
        }}>A patient needs urgent assistance. Please respond immediately.</p>
      </div>

      {/* Trip details */}
      <div style={{
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: "1rem",
        padding: "1.25rem 1.75rem",
        marginBottom: "2rem",
        width: "min(90vw, 28rem)",
        display: "grid",
        gap: "0.6rem",
      }}>
        {trip.patientName && (
          <div style={{ display: "flex", justifyContent: "space-between", color: "#fff" }}>
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.82rem" }}>Patient</span>
            <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{trip.patientName}</span>
          </div>
        )}
        {trip.patientPhone && (
          <div style={{ display: "flex", justifyContent: "space-between", color: "#fff" }}>
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.82rem" }}>Phone</span>
            <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{trip.patientPhone}</span>
          </div>
        )}
        {trip.assignedHospital?.name && (
          <div style={{ display: "flex", justifyContent: "space-between", color: "#fff" }}>
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.82rem" }}>Hospital</span>
            <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{trip.assignedHospital.name}</span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "1rem",
        width: "min(90vw, 28rem)",
      }}>
        <button
          className="ring-btn"
          disabled={isStatusPending || isRejectPending}
          id="emergency-accept-btn"
          onClick={() => onStatusUpdate("en-route")}
          style={{
            padding: "1.1rem",
            borderRadius: "1rem",
            border: "none",
            background: "linear-gradient(135deg, #16a34a, #15803d)",
            color: "#fff",
            fontSize: "1.05rem",
            fontWeight: 700,
            cursor: isStatusPending || isRejectPending ? "not-allowed" : "pointer",
            opacity: isStatusPending || isRejectPending ? 0.6 : 1,
            letterSpacing: "0.01em",
          }}
          type="button"
        >
          {isStatusPending ? "Accepting…" : "✓ Accept"}
        </button>
        <button
          disabled={isStatusPending || isRejectPending}
          id="emergency-reject-btn"
          onClick={() => onTripReject(getRequestId(trip))}
          style={{
            padding: "1.1rem",
            borderRadius: "1rem",
            border: "none",
            background: "linear-gradient(135deg, #dc2626, #b91c1c)",
            color: "#fff",
            fontSize: "1.05rem",
            fontWeight: 700,
            cursor: isStatusPending || isRejectPending ? "not-allowed" : "pointer",
            opacity: isStatusPending || isRejectPending ? 0.6 : 1,
            letterSpacing: "0.01em",
          }}
          type="button"
        >
          {isRejectPending ? "Rejecting…" : "✕ Reject"}
        </button>
      </div>
    </div>,
    document.body,
  );
}

function DriverTripPanel({
  onTripSelect,
  isStatusPending,
  isRejectPending,
  isTrackingActive,
  lastKnownLocation,
  onStatusUpdate,
  onTripReject,
  queryError,
  queryIsError,
  queryIsLoading,
  selectedTripId,
  trackingMessage,
  trips,
  trip,
}: {
  onTripSelect: (requestId: string) => void;
  isStatusPending: boolean;
  isRejectPending: boolean;
  isTrackingActive: boolean;
  lastKnownLocation: LastKnownLocation | null;
  onStatusUpdate: (status: EmergencyRequestStatus) => void;
  onTripReject: (requestId: string) => void;
  queryError: unknown;
  queryIsError: boolean;
  queryIsLoading: boolean;
  selectedTripId: string;
  trackingMessage: string;
  trips: EmergencyRequest[];
  trip: EmergencyRequest | null;
}) {
  const nextStatus = trip ? nextStatusByStatus[trip.status] : undefined;
  const isAssigned = trip?.status === "assigned";
  const tripSelector = trips.length > 1 ? (
    <div className="space-y-2">
      <Label htmlFor="driver-trip-request">Active request</Label>
      <select
        className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-xs outline-none transition focus-visible:border-blue-500 focus-visible:ring-3 focus-visible:ring-blue-500/20"
        id="driver-trip-request"
        onChange={(event) => onTripSelect(event.target.value)}
        value={trips.some((item) => getRequestId(item) === selectedTripId) ? selectedTripId : ""}
      >
        <option value="">Choose a request</option>
        {trips.map((item) => {
          const requestId = getRequestId(item);
          return (
            <option key={requestId} value={requestId}>
              {item.patientName} - {formatStatus(item.status)} - {requestId.slice(-6)}
            </option>
          );
        })}
      </select>
    </div>
  ) : null;

  // Store the latest onTripReject to use inside the timer without resetting it
  const onTripRejectRef = useRef(onTripReject);
  useEffect(() => {
    onTripRejectRef.current = onTripReject;
  }, [onTripReject]);

  // Continuously vibrate and set auto-reject timer while the trip is in "assigned" state
  useEffect(() => {
    if (!isAssigned) return;

    let intervalId: NodeJS.Timeout | undefined;
    if ("vibrate" in navigator) {
      // Immediate first burst
      navigator.vibrate([500, 300]);

      intervalId = setInterval(() => {
        navigator.vibrate([500, 300]);
      }, 800); // repeat every 800ms (500 on + 300 off)
    }

    const triggerReject = () => {
      onTripRejectRef.current(getRequestId(trip));
      toast.info("Trip auto-rejected and forwarded to another driver due to inactivity", { duration: 5000 });
    };

    const timeoutId = setTimeout(triggerReject, 60000);

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
      if ("vibrate" in navigator) {
        navigator.vibrate(0); // stop any in-progress vibration
      }
    };
  }, [isAssigned, isStatusPending, trip?._id, trip?.id]);

  if (queryIsLoading) {
    return (
      <Card id="trip">
        <CardContent className="space-y-3 p-6">
          <div className="h-10 rounded bg-muted" />
          <div className="h-10 rounded bg-muted" />
          <div className="h-10 rounded bg-muted" />
        </CardContent>
      </Card>
    );
  }

  if (queryIsError) {
    return (
      <Card className="border-red-200 bg-red-50" id="trip">
        <CardContent className="p-6">
          <p className="font-medium text-red-800">
            Failed to load active trip
          </p>
          <p className="mt-1 text-sm text-red-700">
            {getFriendlyApiErrorMessage(queryError)}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!trip) {
    return (
      <Card id="trip">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-50 p-2 text-blue-700">
              <Route className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">
                {trips.length > 1 ? "Choose an active trip" : "No active trip"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {trips.length > 1
                  ? "Select the request you want to manage."
                  : "Assigned emergency trips will appear here automatically."}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {tripSelector}
          <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
            {trips.length > 1
              ? "Choose a request to view its trip details and status actions."
              : "Live tracking is idle until dispatch assigns an active trip to your ambulance."}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6" id="trip">
      {/* Full-screen overlay when awaiting accept/reject */}
      {isAssigned && (
        <EmergencyAlertOverlay
          isRejectPending={isRejectPending}
          isStatusPending={isStatusPending}
          onStatusUpdate={onStatusUpdate}
          onTripReject={onTripReject}
          trip={trip!}
        />
      )}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-50 p-2 text-blue-700">
                <Route className="size-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">My active trip</h2>
                <p className="text-sm text-muted-foreground">
                  Current emergency assignment and destination details.
                </p>
              </div>
            </div>
            <Badge className={getStatusClass(trip.status)}>
              {formatStatus(trip.status)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <TripDetail label="Patient" value={trip.patientName} />
          <TripDetail
            icon={<Phone className="size-3.5 text-muted-foreground" />}
            label="Phone"
            value={trip.patientPhone}
          />
          <TripDetail
            icon={<MapPin className="size-3.5 text-muted-foreground" />}
            label="Pickup Location"
            value={formatLocation(trip)}
          />
          <TripDetail
            icon={<Ambulance className="size-3.5 text-muted-foreground" />}
            label="Ambulance"
            value={getAmbulanceLabel(trip.assignedAmbulance)}
          />
          <TripDetail label="Hospital" value={getHospitalLabel(trip)} />
          <TripDetail label="Assigned" value={formatDate(trip.assignedAt)} />
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-50 p-2 text-blue-700">
                <CheckCircle2 className="size-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold">Status actions</h2>
                <p className="text-sm text-muted-foreground">
                  Advance the trip one lifecycle step at a time.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {trip.status === "assigned" ? (
              <>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm animate-pulse">
                  <p className="font-semibold text-amber-800 flex items-center gap-2">
                    🚨 New Emergency Request
                  </p>
                  <p className="mt-1 text-amber-700">
                    A patient needs urgent assistance. Please accept or reject this request.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    className="w-full bg-green-600 text-white hover:bg-green-700 font-semibold shadow-sm"
                    disabled={isStatusPending || isRejectPending}
                    onClick={() => onStatusUpdate("en-route")}
                    type="button"
                  >
                    {isStatusPending ? "Accepting..." : "✓ Accept"}
                  </Button>
                  <Button
                    className="w-full bg-red-600 text-white hover:bg-red-700 font-semibold shadow-sm"
                    disabled={isStatusPending || isRejectPending}
                    onClick={() => onTripReject(getRequestId(trip))}
                    type="button"
                  >
                    {isRejectPending ? "Rejecting..." : "✕ Reject"}
                  </Button>
                </div>
              </>
            ) : nextStatus ? (
              <>
                <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                  <p className="text-muted-foreground">Next status</p>
                  <p className="mt-1 font-medium">
                    {formatStatus(trip.status)} to {formatStatus(nextStatus)}
                  </p>
                </div>
                <Button
                  className="w-full bg-blue-600 text-white hover:bg-blue-700"
                  disabled={isStatusPending}
                  onClick={() => onStatusUpdate(nextStatus)}
                  type="button"
                >
                  {isStatusPending
                    ? "Updating..."
                    : `Mark ${formatStatus(nextStatus)}`}
                </Button>
              </>
            ) : (
              <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                No further status action is available for this trip.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-50 p-2 text-blue-700">
                <RadioTower className="size-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold">Live tracking</h2>
                <p className="text-sm text-muted-foreground">
                  Sends your ambulance location while this trip is active.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Badge
              className={
                isTrackingActive
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }
            >
              <Navigation className="size-3.5" />
              {isTrackingActive ? "Live tracking active" : "Tracking idle"}
            </Badge>
            <p className="text-sm text-muted-foreground">{trackingMessage}</p>
            <div className="rounded-lg border bg-muted/30 p-4 text-sm">
              <p className="text-muted-foreground">Last known location</p>
              <div className="mt-1 font-medium">
                <LocationDisplay
                  coordinates={lastKnownLocation?.coordinates}
                  label="Ambulance location"
                />
              </div>
              {lastKnownLocation ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Accuracy:{" "}
                  {lastKnownLocation.accuracy !== null
                    ? `${Math.round(lastKnownLocation.accuracy)}m`
                    : "unknown"}{" "}
                  - {formatDate(lastKnownLocation.timestamp)}
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <TripMap driverLocation={lastKnownLocation} trip={trip} />
    </div>
  );
}

function TripDetail({
  icon,
  label,
  value,
}: {
  icon?: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </p>
      <div className="mt-1 break-words font-medium">{value}</div>
    </div>
  );
}

type LastKnownLocation = {
  coordinates: [number, number];
  accuracy: number | null;
  timestamp: string;
};

export type DriverDashboardMode = "overview" | "verification" | "trip";

function OverviewActionCard({
  description,
  href,
  Icon,
  title,
}: {
  description: string;
  href: string;
  Icon: typeof ShieldCheck;
  title: string;
}) {
  return (
    <Link
      className="group block rounded-lg border border-blue-100/80 bg-white/90 p-6 shadow-lg shadow-blue-950/5 transition hover:border-blue-200 hover:bg-white hover:shadow-xl hover:shadow-blue-950/10"
      href={href}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 transition group-hover:bg-white">
          <Icon className="size-5" />
        </div>
      </div>
    </Link>
  );
}

export default function DriverPage() {
  return <DriverDashboardContent mode="overview" />;
}

function useDriverTripSocketInvalidation(enabled: boolean) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const token = acquireSocketConnection();

    const invalidateTrip = () => {
      queryClient.invalidateQueries({ queryKey: driverTripKeys.all });
    };

    const invalidateAmbulance = () => {
      queryClient.invalidateQueries({ queryKey: ["driver", "my-ambulance"] });
    };

    const invalidateAll = () => {
      queryClient.invalidateQueries({ queryKey: driverTripKeys.all });
      queryClient.invalidateQueries({ queryKey: ["driver", "my-ambulance"] });
    };

    // Trip lifecycle events
    socket.on("emergency.request.updated", invalidateAll);
    socket.on("emergency.request.dispatched", invalidateAll);
    socket.on("emergency.request.cancelled", invalidateTrip);
    socket.on("emergency.request.deleted", invalidateTrip);

    // Ambulance events (status change, assignment, etc.)
    socket.on("ambulance.updated", invalidateAmbulance);
    socket.on("ambulance.status.updated", invalidateAmbulance);

    return () => {
      socket.off("emergency.request.updated", invalidateAll);
      socket.off("emergency.request.dispatched", invalidateAll);
      socket.off("emergency.request.cancelled", invalidateTrip);
      socket.off("emergency.request.deleted", invalidateTrip);
      socket.off("ambulance.updated", invalidateAmbulance);
      socket.off("ambulance.status.updated", invalidateAmbulance);
      releaseSocketConnection(token);
    };
  }, [enabled, queryClient]);
}

function useDriverLiveLocationTracking({
  isVerified,
  trip,
}: {
  isVerified: boolean;
  trip: EmergencyRequest | null | undefined;
}) {
  const watcherRef = useRef<number | null>(null);
  const lastLocationSentAtRef = useRef(0);
  const [lastKnownLocation, setLastKnownLocation] =
    useState<LastKnownLocation | null>(null);
  const [trackingMessage, setTrackingMessage] = useState(
    "Live tracking is waiting for an active trip.",
  );
  const [isTrackingActive, setIsTrackingActive] = useState(false);
  const ambulanceId = getAmbulanceId(trip?.assignedAmbulance);
  const requestId = trip?.id ?? trip?._id ?? "";
  const tripStatus = trip?.status;
  const canTrack = isVerified && isTrackableTrip(trip);

  useEffect(() => {
    function stopWatching(message: string) {
      if (watcherRef.current !== null) {
        navigator.geolocation.clearWatch(watcherRef.current);
        watcherRef.current = null;
      }

      setIsTrackingActive(false);
      setTrackingMessage(message);
    }

    if (!isVerified) {
      stopWatching("Driver verification is required before live tracking.");
      return;
    }

    if (!trip || !requestId) {
      stopWatching("Live tracking starts when an active trip is assigned.");
      return;
    }

    if (tripStatus === "completed" || tripStatus === "cancelled") {
      stopWatching("Live tracking stopped because the trip is closed.");
      return;
    }

    if (!ambulanceId) {
      stopWatching("Live tracking needs an assigned ambulance.");
      return;
    }

    if (!canTrack) {
      stopWatching("Live tracking starts when the assigned trip is active.");
      return;
    }

    if (!("geolocation" in navigator)) {
      stopWatching("Location tracking is unavailable in this browser.");
      return;
    }

    const token = acquireSocketConnection();

    setTrackingMessage("Live tracking active");
    setIsTrackingActive(true);

    watcherRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const coordinates: [number, number] = [
          position.coords.longitude,
          position.coords.latitude,
        ];
        const timestamp = new Date(position.timestamp).toISOString();

        setLastKnownLocation({
          coordinates,
          accuracy: Number.isFinite(position.coords.accuracy)
            ? position.coords.accuracy
            : null,
          timestamp,
        });
        setTrackingMessage("Live tracking active");
        setIsTrackingActive(true);

        const now = Date.now();
        if (now - lastLocationSentAtRef.current >= 5000) {
          lastLocationSentAtRef.current = now;
          socket.emit("ambulance.location.send", {
            ambulanceId,
            requestId,
            coordinates,
            accuracy: position.coords.accuracy,
            timestamp,
          });
        }
      },
      (error) => {
        setIsTrackingActive(false);
        if (error.code === error.PERMISSION_DENIED) {
          setTrackingMessage(
            "Location permission was denied. Enable location access to share live updates.",
          );
          return;
        }

        setTrackingMessage(error.message || "Could not read current location.");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 15000,
      },
    );

    return () => {
      if (watcherRef.current !== null) {
        navigator.geolocation.clearWatch(watcherRef.current);
        watcherRef.current = null;
      }
      setIsTrackingActive(false);
      releaseSocketConnection(token);
    };
  }, [ambulanceId, canTrack, isVerified, requestId, tripStatus]);

  return {
    isTrackingActive,
    lastKnownLocation,
    trackingMessage,
  };
}

export function DriverDashboardContent({
  mode = "overview",
}: {
  mode?: DriverDashboardMode;
}) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [uploadedMedia, setUploadedMedia] = useState<UploadedMedia | null>(
    null,
  );
  const [documentType, setDocumentType] =
    useState<(typeof documentTypes)[number]>("Driving License");
  const [selectedTripId, setSelectedTripId] = useState(() =>
    typeof window === "undefined"
      ? ""
      : new URLSearchParams(window.location.search).get("requestId") ?? "",
  );
  const { data, isLoading, isFetching } = useMe();
  const profile = data?.profile;
  const verificationState = getVerificationState(
    profile?.isVerified,
    profile?.documentImageId,
    profile?.verificationNote,
  );
  const copy = verificationCopy(verificationState);
  const isVerified = verificationState === "verified";
  const hasDocument = !!profile?.documentImageId || !!uploadedMedia;
  useDriverTripSocketInvalidation(isVerified);
  const myTripQuery = useDriverMyTrip(isVerified);
  const updateTripStatus = useUpdateDriverTripStatus();
  const rejectTrip = useRejectDriverTrip();
  const activeTrips = myTripQuery.data ?? [];
  const activeTrip =
    activeTrips.find((trip) => getRequestId(trip) === selectedTripId) ??
    (activeTrips.length === 1 ? activeTrips[0] : null);
  const driverAmbulanceQuery = useDriverAmbulance();
  const ambulance = driverAmbulanceQuery.data;
  const updateAmbulanceStatus = useUpdateAmbulanceStatus();
  const { isTrackingActive, lastKnownLocation, trackingMessage } =
    useDriverLiveLocationTracking({
      isVerified,
      trip: activeTrip,
    });
  const documentMedia = useQuery({
    queryKey: ["uploads", "media", profile?.documentImageId],
    queryFn: async () => {
      const { data } = await api.get<UploadedMedia>(
        `/uploads/media/${profile?.documentImageId}`,
      );
      return data;
    },
    enabled: !!profile?.documentImageId,
  });
  const resolvedMedia = uploadedMedia ?? documentMedia.data ?? null;
  const documentPreviewUrl = resolveMediaUrl(resolvedMedia);
  const StatusIcon = copy.Icon;
  const showOverview = mode === "overview";
  const showVerification = mode === "verification";
  const showTrip = mode === "trip";

  const uploadDocument = useMutation({
    mutationFn: async (formData: FormData) => {
      const { data } = await api.post<DriverDocumentUploadResponse>(
        "/uploads/driver-document",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );
      return data;
    },
    onSuccess: async (data) => {
      toast.success("Document uploaded for review");
      setUploadedMedia(data.media);
      setSelectedFileName(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    },
    onError: (error) => {
      toast.error(getFriendlyApiErrorMessage(error));
    },
  });

  function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("Choose a document image to upload");
      return;
    }

    const formData = new FormData();
    formData.append("documentType", documentType);
    formData.append("file", file);
    uploadDocument.mutate(formData);
  }

  async function handleTripStatusUpdate(status: EmergencyRequestStatus) {
    const requestId = getRequestId(activeTrip);
    if (!requestId) {
      toast.error("Trip ID is missing");
      return;
    }

    try {
      await updateTripStatus.mutateAsync({ requestId, status });
      toast.success(`Trip status updated to ${formatStatus(status)}`);
    } catch (error) {
      toast.error(getFriendlyApiErrorMessage(error));
    }
  }

  async function handleTripReject(requestId: string) {
    if (!requestId) {
      toast.error("Trip ID is missing");
      return;
    }

    try {
      await rejectTrip.mutateAsync(requestId);
      toast.success("Request rejected. Dispatching to next available driver.");
    } catch (error) {
      toast.error(getFriendlyApiErrorMessage(error));
    }
  }

  if (isLoading) {
    return (
      <main className="p-6">
        <div className="mx-auto max-w-5xl">
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">
                Loading driver dashboard...
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="p-4 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="overflow-hidden rounded-lg border border-blue-100/80 bg-white/90 shadow-xl shadow-blue-950/5 backdrop-blur">
          <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                <Ambulance className="size-4" />
                Driver workspace
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
                Welcome, {data?.user.fullName ?? "Driver"}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Complete verification before operational trip controls become
                available.
              </p>
            </div>
            <Badge className={copy.badgeClass}>
              <StatusIcon className="size-3.5" />
              {copy.label}
            </Badge>
          </div>
          <div className="grid border-t bg-blue-50/50 sm:grid-cols-3">
            <div className="border-b p-4 sm:border-b-0 sm:border-r">
              <p className="text-xs text-muted-foreground">Profile status</p>
              <p className="mt-1 text-sm font-medium">{copy.title}</p>
            </div>
            <div className="border-b p-4 sm:border-b-0 sm:border-r">
              <p className="text-xs text-muted-foreground">Document</p>
              <p className="mt-1 text-sm font-medium">
                {hasDocument ? "Uploaded" : "Not uploaded"}
              </p>
            </div>
            <div className="p-4">
              <p className="text-xs text-muted-foreground">Trip controls</p>
              <p className="mt-1 text-sm font-medium">
                {isVerified ? "Unlocked" : "Locked"}
              </p>
            </div>
          </div>
        </section>

        {isVerified && ambulance?.status === "completed" && (
          <Card className="border-blue-200 bg-blue-50/50 shadow-md backdrop-blur">
            <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-blue-900 flex items-center gap-2">
                  <CheckCircle2 className="size-5 text-blue-600 animate-bounce" />
                  Trip Completed!
                </h2>
                <p className="text-sm text-blue-700 mt-1">
                  Please select your availability status to continue receiving emergency assignments.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  className="bg-green-600 text-white hover:bg-green-700 shadow-sm"
                  disabled={updateAmbulanceStatus.isPending}
                  onClick={() => {
                    updateAmbulanceStatus.mutate({
                      ambulanceId: ambulance.id || ambulance._id || "",
                      status: "available"
                    }, {
                      onSuccess: () => {
                        toast.success("You are now Online (Available)");
                      }
                    });
                  }}
                >
                  Stay Online
                </Button>
                <Button
                  className="bg-slate-600 text-white hover:bg-slate-700 shadow-sm"
                  disabled={updateAmbulanceStatus.isPending}
                  onClick={() => {
                    updateAmbulanceStatus.mutate({
                      ambulanceId: ambulance.id || ambulance._id || "",
                      status: "offline"
                    }, {
                      onSuccess: () => {
                        toast.success("You are now Offline");
                      }
                    });
                  }}
                >
                  Go Offline
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isVerified && ambulance?.status === "offline" && (
          <Card className="border-slate-200 bg-slate-50/80 shadow-md backdrop-blur">
            <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <WifiOff className="size-5 text-slate-500" />
                  Welcome back!
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  Your ambulance is currently <strong>Offline</strong>. Would you like to go Online and receive emergency assignments?
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  className="bg-green-600 text-white hover:bg-green-700 shadow-sm"
                  disabled={updateAmbulanceStatus.isPending}
                  onClick={() => {
                    updateAmbulanceStatus.mutate({
                      ambulanceId: ambulance.id || ambulance._id || "",
                      status: "available"
                    }, {
                      onSuccess: () => {
                        toast.success("You are now Online and ready to receive assignments.");
                      }
                    });
                  }}
                >
                  Go Online
                </Button>
                <Button
                  variant="outline"
                  disabled={updateAmbulanceStatus.isPending}
                >
                  Stay Offline
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {showOverview ? (
          <section className="grid gap-6 md:grid-cols-3">
            <OverviewActionCard
              description="Review verification status, uploaded documents, and replacement upload controls."
              href="/driver/verification"
              Icon={ShieldCheck}
              title="Verification"
            />
            <OverviewActionCard
              description="Open active trip details, lifecycle actions, live tracking, and the three-point trip map."
              href="/driver/trip"
              Icon={Route}
              title="Trip controls"
            />
            <OverviewActionCard
              description="View your past and active emergency ride history."
              href="/driver/history"
              Icon={History}
              title="Ride history"
            />
          </section>
        ) : null}

        {!showOverview ? (
        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            {showVerification ? (
              <>
            <Card id="verification">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">
                      Verification status
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {copy.description}
                    </p>
                  </div>
                  <div className="rounded-lg bg-blue-50 p-2 text-blue-700">
                    <StatusIcon className="size-5" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <p className="text-sm text-muted-foreground">
                      Document type
                    </p>
                    <p className="mt-1 font-medium">
                      {profile?.documentType ?? documentType}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <p className="text-sm text-muted-foreground">
                      Upload status
                    </p>
                    <p className="mt-1 font-medium">
                      {hasDocument ? "Document uploaded" : "No document yet"}
                    </p>
                  </div>
                </div>

                {profile?.verificationNote ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                    {profile.verificationNote}
                  </div>
                ) : null}

                {!isVerified ? (
                  <div className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    <Lock className="mt-0.5 size-4 shrink-0" />
                    <p>
                      Admin verification is required before accepting trips or
                      updating trip status.
                    </p>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {hasDocument ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold">
                        Verification document
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {documentPreviewUrl
                          ? "Preview of your latest uploaded document."
                          : documentMedia.isLoading
                            ? "Loading document preview..."
                            : "Document uploaded. Preview is unavailable."}
                      </p>
                    </div>
                    <FileCheck2 className="size-5 text-blue-600" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {documentPreviewUrl ? (
                    <div className="overflow-hidden rounded-lg border bg-slate-50">
                      <img
                        alt="Uploaded driver verification document"
                        className="max-h-80 w-full object-contain"
                        src={documentPreviewUrl}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
                      <FileImage className="size-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">
                          Document uploaded
                        </p>
                        <p className="text-sm text-muted-foreground">
                          We could not load the image URL, but your document is
                          uploaded.
                        </p>
                      </div>
                    </div>
                  )}
                  <Separator />
                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                    <div>
                      <p className="font-medium">
                        {profile?.documentType ?? documentType}
                      </p>
                      <p className="text-muted-foreground">{copy.label}</p>
                    </div>
                    {!isVerified ? (
                      <Badge className="border-slate-200 bg-white text-slate-700">
                        Replace document below
                      </Badge>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {!isVerified ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-blue-50 p-2 text-blue-700">
                      <FileUp className="size-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">
                        {hasDocument
                          ? "Replace verification document"
                          : "Upload verification document"}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Upload a JPEG, PNG, or WebP image for admin review.
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <form className="space-y-4" onSubmit={handleUpload}>
                    <div className="space-y-2">
                      <Label htmlFor="documentType">Document type</Label>
                      <select
                      title="document-type"
                        id="documentType"
                        className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-xs outline-none transition focus-visible:border-blue-500 focus-visible:ring-3 focus-visible:ring-blue-500/20"
                        value={documentType}
                        onChange={(event) =>
                          setDocumentType(
                            event.target
                              .value as (typeof documentTypes)[number],
                          )
                        }
                      >
                        {documentTypes.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="file">Document image</Label>
                      <label
                        className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-blue-200 bg-blue-50/50 px-4 py-8 text-center transition hover:bg-blue-50"
                        htmlFor="file"
                      >
                        <FileUp className="size-8 text-blue-600" />
                        <span className="mt-3 text-sm font-medium text-slate-900">
                          Choose a document image
                        </span>
                        <span className="mt-1 text-xs text-muted-foreground">
                          JPEG, PNG, or WebP
                        </span>
                        {selectedFileName ? (
                          <span className="mt-3 rounded-full bg-white px-3 py-1 text-xs font-medium text-blue-700">
                            {selectedFileName}
                          </span>
                        ) : null}
                      </label>
                      <Input
                        id="file"
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        onChange={(event) =>
                          setSelectedFileName(
                            event.target.files?.[0]?.name ?? null,
                          )
                        }
                      />
                    </div>

                    <Button
                      className="h-11 bg-blue-600 text-white hover:bg-blue-700"
                      disabled={uploadDocument.isPending || isFetching}
                      type="submit"
                    >
                      {uploadDocument.isPending
                        ? "Uploading..."
                        : hasDocument
                          ? "Replace document"
                          : "Upload document"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ) : null}
              </>
            ) : null}

            {showTrip && isVerified ? (
              <DriverTripPanel
                onTripSelect={(requestId) => {
                  setSelectedTripId(requestId);
                  const url = new URL(window.location.href);
                  if (requestId) {
                    url.searchParams.set("requestId", requestId);
                  } else {
                    url.searchParams.delete("requestId");
                  }
                  window.history.replaceState(null, "", url);
                }}
                isStatusPending={updateTripStatus.isPending}
                isRejectPending={rejectTrip.isPending}
                isTrackingActive={isTrackingActive}
                lastKnownLocation={lastKnownLocation}
                onStatusUpdate={handleTripStatusUpdate}
                onTripReject={handleTripReject}
                queryError={myTripQuery.error}
                queryIsError={myTripQuery.isError}
                queryIsLoading={myTripQuery.isLoading}
                selectedTripId={selectedTripId}
                trackingMessage={trackingMessage}
                trips={activeTrips}
                trip={activeTrip}
              />
            ) : null}

            {showTrip && !isVerified ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-blue-50 p-2 text-blue-700">
                      <Lock className="size-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">
                        Trip controls locked
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Complete driver verification before active trip tools
                        and live tracking become available.
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button
                    asChild
                    className="bg-blue-600 text-white hover:bg-blue-700"
                  >
                    <Link href="/driver/verification">Go to verification</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : null}
          </div>

          <Card className="h-fit">
            <CardHeader>
              <h2 className="text-lg font-semibold">Driver profile</h2>
              <p className="text-sm text-muted-foreground">
                Basic account details from your session.
              </p>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Email</p>
                <p className="font-medium">{data?.user.email}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Phone</p>
                <p className="font-medium">{data?.user.phone}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Verification</p>
                <p className="font-medium">{copy.label}</p>
              </div>
              {isVerified && ambulance && (
                <div className="pt-2">
                  <Separator className="my-3" />
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Operational Status</p>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block size-2.5 rounded-full ${
                        ambulance.status === "available" ? "bg-green-500 animate-pulse" :
                        ambulance.status === "offline" ? "bg-slate-400" :
                        "bg-amber-500"
                      }`} />
                      <span className="font-medium capitalize">{ambulance.status}</span>
                    </div>
                    {(ambulance.status === "available" || ambulance.status === "offline") && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          updateAmbulanceStatus.mutate({
                            ambulanceId: ambulance.id || ambulance._id || "",
                            status: ambulance.status === "available" ? "offline" : "available"
                          }, {
                            onSuccess: () => {
                              toast.success(`You are now ${ambulance.status === "available" ? "Offline" : "Online"}`);
                            }
                          });
                        }}
                        disabled={updateAmbulanceStatus.isPending}
                      >
                        {ambulance.status === "available" ? "Go Offline" : "Go Online"}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        ) : null}
      </div>
    </main>
  );
}
