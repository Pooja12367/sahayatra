"use client";

import {
  Ambulance,
  Ban,
  CalendarClock,
  CheckCircle2,
  Clock3,
  ClipboardList,
  Eye,
  History,
  Hospital,
  MoreHorizontal,
  Navigation,
  Phone,
  Plus,
  UserRound,
} from "lucide-react";
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { TripMap } from "@/components/map/TripMap";
import { LocationDisplay } from "@/components/location/location-display";
import { LocationInput } from "@/components/location/location-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getHospitalId, useHospitals } from "@/hooks/use-hospitals";
import {
  myRequestKeys,
  useCancelMyRequest,
  useCreateEmergencyRequest,
  useMyRequest,
  useMyRequests,
} from "@/hooks/use-my-requests";
import { useMe } from "@/hooks/use-auth";
import { getFriendlyApiErrorMessage } from "@/lib/api";
import { z } from "zod";
import {
  acquireSocketConnection,
  releaseSocketConnection,
  socket,
} from "@/lib/socket";
import type { Ambulance as AmbulanceType } from "@/types/ambulances";
import type {
  EmergencyRequest,
  EmergencyRequestStatus,
} from "@/types/emergency-requests";
import type { Hospital as HospitalType } from "@/types/hospitals";

type DialogMode = "view" | "cancel" | "track";
export type PatientPageMode = "overview" | "new-request" | "requests";

type RequestFormState = {
  patientName: string;
  patientPhone: string;
  longitude: string;
  latitude: string;
  pickupAddress: string;
  notes: string;
  assignedHospital: string;
};

const emptyForm: RequestFormState = {
  patientName: "",
  patientPhone: "",
  longitude: "",
  latitude: "",
  pickupAddress: "",
  notes: "",
  assignedHospital: "",
};

const activeStatuses: EmergencyRequestStatus[] = [
  "pending",
  "assigned",
  "en-route",
  "at-patient",
  "transporting",
  "at-hospital",
];

function usePatientRequestSocketInvalidation() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const token = acquireSocketConnection();

    const invalidateMyRequests = () => {
      queryClient.invalidateQueries({ queryKey: myRequestKeys.all });
    };

    socket.on("emergency.request.created", invalidateMyRequests);
    socket.on("emergency.request.updated", invalidateMyRequests);
    socket.on("emergency.request.dispatched", invalidateMyRequests);
    socket.on("emergency.request.cancelled", invalidateMyRequests);
    socket.on("emergency.request.deleted", invalidateMyRequests);

    return () => {
      socket.off("emergency.request.created", invalidateMyRequests);
      socket.off("emergency.request.updated", invalidateMyRequests);
      socket.off("emergency.request.dispatched", invalidateMyRequests);
      socket.off("emergency.request.cancelled", invalidateMyRequests);
      socket.off("emergency.request.deleted", invalidateMyRequests);
      releaseSocketConnection(token);
    };
  }, [queryClient]);
}

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

function getAmbulanceLabel(ambulance: AmbulanceType | null | undefined) {
  return ambulance?.ambulanceCode ?? "Not assigned";
}

function getHospitalLabel(hospital: HospitalType | null | undefined) {
  return hospital?.name ?? "Not assigned";
}

function canCancel(request: EmergencyRequest) {
  return request.status !== "completed" && request.status !== "cancelled";
}

function getRequestId(request: EmergencyRequest | null) {
  return request?.id ?? request?._id ?? "";
}

function parseRequestForm(form: RequestFormState) {
  if (!form.latitude.trim() || !form.longitude.trim()) {
    throw new Error("Please select a pickup location.");
  }

  const longitude = Number(form.longitude);
  const latitude = Number(form.latitude);

  const result = z
    .object({
      patientName: z.string().trim().min(2, "Patient name must be at least 2 characters."),
      patientPhone: z
        .string()
        .trim()
        .regex(/^(?:\+?977[-\s]?)?(?:0?[97]\d{9})$/, "Enter a valid Nepal mobile number."),
      latitude: z.number().finite().min(-90).max(90),
      longitude: z.number().finite().min(-180).max(180),
      notes: z.string().optional(),
      pickupAddress: z.string().optional(),
      assignedHospital: z.string().optional(),
    })
    .safeParse({
      patientName: form.patientName,
      patientPhone: form.patientPhone,
      latitude,
      longitude,
      notes: form.notes.trim() || undefined,
      pickupAddress: form.pickupAddress.trim() || undefined,
      assignedHospital: form.assignedHospital || undefined,
    });

  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "Please check the request details.");
  }

  return {
    patientName: result.data.patientName,
    patientPhone: result.data.patientPhone,
    coordinates: [longitude, latitude] as [number, number],
    ...(result.data.pickupAddress ? { pickupAddress: result.data.pickupAddress } : {}),
    ...(result.data.notes ? { notes: result.data.notes } : {}),
    ...(result.data.assignedHospital
      ? { assignedHospital: result.data.assignedHospital }
      : {}),
  };
}

export function PatientDashboardContent({
  mode = "overview",
}: {
  mode?: PatientPageMode;
}) {
  usePatientRequestSocketInvalidation();

  const { data: me } = useMe();
  const [form, setForm] = useState<RequestFormState>(emptyForm);
  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null);
  const [selectedRequest, setSelectedRequest] =
    useState<EmergencyRequest | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const myRequestsQuery = useMyRequests();
  const selectedRequestId = getRequestId(selectedRequest);
  const selectedRequestQuery = useMyRequest(
    dialogMode === "view" || dialogMode === "track" ? selectedRequestId : null,
  );
  const hospitalsQuery = useHospitals({
    status: "available",
    hasAvailableBeds: true,
    page: 1,
    limit: 100,
  });
  const createRequest = useCreateEmergencyRequest();
  const cancelRequest = useCancelMyRequest();
  const requests = useMemo(
    () =>
      [...(myRequestsQuery.data ?? [])].sort((first, second) => {
        const firstTime = first.createdAt
          ? new Date(first.createdAt).getTime()
          : 0;
        const secondTime = second.createdAt
          ? new Date(second.createdAt).getTime()
          : 0;

        return secondTime - firstTime;
      }),
    [myRequestsQuery.data],
  );
  const preferredHospitals = hospitalsQuery.data?.data ?? [];
  const activeCount = requests.filter((request) =>
    activeStatuses.includes(request.status),
  ).length;
  const pendingCount = requests.filter(
    (request) => request.status === "pending",
  ).length;
  const closedCount = requests.filter(
    (request) =>
      request.status === "completed" || request.status === "cancelled",
  ).length;
  const isMutating = createRequest.isPending || cancelRequest.isPending;
  const showCreateForm = mode === "new-request";
  const showRequests = mode === "requests";

  useEffect(() => {
    if (!me?.user) {
      return;
    }

    setForm((current) => ({
      ...current,
      patientName: current.patientName || me.user.fullName,
      patientPhone: current.patientPhone || me.user.phone,
    }));
  }, [me?.user]);

  function openViewDialog(request: EmergencyRequest) {
    setSelectedRequest(request);
    setDialogMode("view");
  }

  function openCancelDialog(request: EmergencyRequest) {
    setSelectedRequest(request);
    setCancelReason("");
    setDialogMode("cancel");
  }

  function openTrackDialog(request: EmergencyRequest) {
    setSelectedRequest(request);
    setDialogMode("track");
  }

  function closeDialog() {
    setSelectedRequest(null);
    setDialogMode(null);
  }

  async function handleCreateRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await createRequest.mutateAsync(parseRequestForm(form));
      toast.success("Emergency request created");
      setForm((current) => ({
        ...emptyForm,
        patientName: current.patientName,
        patientPhone: current.patientPhone,
      }));
    } catch (error) {
      toast.error(getFriendlyApiErrorMessage(error));
    }
  }

  async function handleCancelRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedRequest) {
      return;
    }

    const requestId = getRequestId(selectedRequest);

    if (!requestId) {
      toast.error("Request id is missing");
      return;
    }

    try {
      await cancelRequest.mutateAsync({
        requestId,
        payload: cancelReason.trim() ? { reason: cancelReason.trim() } : {},
      });
      toast.success("Emergency request cancelled");
      closeDialog();
    } catch (error) {
      toast.error(getFriendlyApiErrorMessage(error));
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <section className="rounded-lg border border-blue-100/80 bg-white/90 p-6 shadow-xl shadow-blue-950/5 backdrop-blur">
        <Badge className="border-blue-200 bg-blue-50 text-blue-700">
          <UserRound className="size-3.5" />
          Patient dashboard
        </Badge>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
          Emergency Requests
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Request ambulance support, review your request history, and follow
          dispatch updates from one place.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard Icon={ClipboardList} label="Total Requests" value={requests.length} />
        <SummaryCard Icon={Ambulance} label="Active Requests" value={activeCount} />
        <SummaryCard Icon={Clock3} label="Pending Requests" value={pendingCount} />
        <SummaryCard Icon={CheckCircle2} label="Closed Requests" value={closedCount} />
      </section>

      {mode === "overview" ? (
        <section className="grid gap-6 md:grid-cols-2">
          <OverviewActionCard
            description="Create a fresh ambulance request with pickup coordinates and optional hospital preference."
            href="/patient/new-request"
            Icon={Plus}
            title="Create emergency request"
          />
          <OverviewActionCard
            description="Review your request history, open details, cancel active requests, and track assigned trips."
            href="/patient/requests"
            Icon={History}
            title="Request history"
          />
        </section>
      ) : null}

      <div className="grid min-w-0 gap-6">
        {showCreateForm ? (
        <Card className="min-w-0 border-blue-100/80 bg-white/90 shadow-lg shadow-blue-950/5" id="new-request">
          <CardContent className="space-y-5 p-5">
            <div>
              <h2 className="text-lg font-semibold">Create emergency request</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter pickup coordinates and optional notes for dispatch.
              </p>
            </div>
            <form className="space-y-4" onSubmit={handleCreateRequest}>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                <Field label="Patient Name">
                  <Input
                    type="tel"
                    onChange={(event) =>
                      setForm({ ...form, patientName: event.target.value })
                    }
                    value={form.patientName}
                  />
                </Field>
                <Field label="Patient Phone">
                  <Input
                    onChange={(event) =>
                      setForm({ ...form, patientPhone: event.target.value })
                    }
                    value={form.patientPhone}
                  />
                </Field>
              </div>
              <LocationInput
                address={form.pickupAddress}
                latitude={form.latitude}
                longitude={form.longitude}
                onCoordinatesChange={(coordinates) =>
                  setForm((current) => ({ ...current, ...coordinates }))
                }
                onLatitudeChange={(latitude) =>
                  setForm((current) => ({ ...current, latitude }))
                }
                onLongitudeChange={(longitude) =>
                  setForm((current) => ({ ...current, longitude }))
                }
                onAddressChange={(pickupAddress) =>
                  setForm((current) => ({ ...current, pickupAddress }))
                }
                title="Pickup location"
                iconType="patient"
              />
              <Field label="Preferred Hospital">
                <select
                title="Hospital"
                  className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-xs outline-none transition focus-visible:border-blue-500 focus-visible:ring-3 focus-visible:ring-blue-500/20 disabled:opacity-50"
                  disabled={hospitalsQuery.isLoading}
                  onChange={(event) =>
                    setForm({ ...form, assignedHospital: event.target.value })
                  }
                  value={form.assignedHospital}
                >
                  <option value="">Nearest available hospital</option>
                  {preferredHospitals.map((hospital) => (
                    <option
                      key={getHospitalId(hospital)}
                      value={getHospitalId(hospital)}
                    >
                      {hospital.name} ({hospital.availableBeds} beds)
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Notes">
                <textarea
                  className="min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition placeholder:text-muted-foreground focus-visible:border-blue-500 focus-visible:ring-3 focus-visible:ring-blue-500/20"
                  onChange={(event) =>
                    setForm({ ...form, notes: event.target.value })
                  }
                  placeholder="Symptoms, landmarks, or access notes"
                  value={form.notes}
                />
              </Field>
              <Button
                className="w-full bg-blue-600 text-white hover:bg-blue-700"
                disabled={createRequest.isPending}
                type="submit"
              >
                <Plus className="size-4" />
                {createRequest.isPending ? "Submitting..." : "Create request"}
              </Button>
            </form>
          </CardContent>
        </Card>
        ) : null}

        {showRequests ? (
        <Card className="min-w-0 border-blue-100/80 bg-white/90 shadow-lg shadow-blue-950/5" id="my-requests">
          <CardContent className="space-y-4 p-4">
            <div>
              <h2 className="text-lg font-semibold">Request History</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Your request history and dispatch status.
              </p>
            </div>

            {myRequestsQuery.isLoading ? (
              <div className="space-y-3">
                <div className="h-10 rounded bg-muted" />
                <div className="h-10 rounded bg-muted" />
                <div className="h-10 rounded bg-muted" />
              </div>
            ) : null}

            {myRequestsQuery.isError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="font-medium text-red-800">
                  Failed to load requests
                </p>
                <p className="mt-1 text-sm text-red-700">
                  {getFriendlyApiErrorMessage(myRequestsQuery.error)}
                </p>
              </div>
            ) : null}

            {!myRequestsQuery.isLoading &&
            !myRequestsQuery.isError &&
            requests.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border p-10 text-center">
                <ClipboardList className="size-10 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">
                  No requests yet
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Create an emergency request to start dispatch.
                </p>
              </div>
            ) : null}

            {requests.length > 0 ? (
              <div className="max-w-full overflow-x-auto">
                <Table className="min-w-[880px] table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[130px]">Status</TableHead>
                      <TableHead className="w-[170px]">Ambulance</TableHead>
                      <TableHead className="w-[220px]">Hospital</TableHead>
                      <TableHead className="w-[170px]">Created</TableHead>
                      <TableHead className="w-[90px] text-right">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((request) => (
                      <TableRow key={request.id ?? request._id}>
                        <TableCell>
                          <Badge
                            className={`w-28 justify-center ${getStatusClass(
                              request.status,
                            )}`}
                          >
                            {formatStatus(request.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-2 truncate text-sm">
                            <Ambulance className="size-3.5 text-muted-foreground" />
                            {getAmbulanceLabel(request.assignedAmbulance)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-2 truncate text-sm">
                            <Hospital className="size-3.5 text-muted-foreground" />
                            {getHospitalLabel(request.assignedHospital)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-2 text-sm">
                            <CalendarClock className="size-3.5 text-muted-foreground" />
                            {formatDate(request.createdAt)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu
                            side="top"
                            trigger={
                              <span className="inline-flex size-8 items-center justify-center rounded-lg border bg-background transition hover:bg-muted">
                                <MoreHorizontal className="size-4" />
                              </span>
                            }
                          >
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedRequest(request);
                                setDialogMode("view");
                              }}
                            >
                              <Eye className="size-4" />
                              View details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openTrackDialog(request)}
                            >
                              <Navigation className="size-4" />
                              Track request
                            </DropdownMenuItem>
                            {canCancel(request) ? (
                              <DropdownMenuItem
                                disabled={isMutating}
                                onClick={() => openCancelDialog(request)}
                              >
                                <Ban className="size-4" />
                                Cancel
                              </DropdownMenuItem>
                            ) : null}
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </CardContent>
        </Card>
        ) : null}
      </div>

      <PatientDialog
        cancelReason={cancelReason}
        isMutating={isMutating}
        mode={dialogMode}
        onCancelReasonChange={setCancelReason}
        onClose={closeDialog}
        onSubmitCancel={handleCancelRequest}
        request={selectedRequestQuery.data ?? selectedRequest}
        requestError={selectedRequestQuery.error}
        requestIsError={selectedRequestQuery.isError}
        requestIsLoading={selectedRequestQuery.isLoading}
      />
    </main>
  );
}


function SummaryCard({
  Icon,
  label,
  value,
}: {
  Icon: typeof ClipboardList;
  label: string;
  value: number;
}) {
  return (
    <Card className="border-blue-100/80 bg-white/90 shadow-lg shadow-blue-950/5">
      <CardContent className="flex items-center justify-between gap-4 p-5">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
        </div>
        <div className="flex size-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function OverviewActionCard({
  description,
  href,
  Icon,
  title,
}: {
  description: string;
  href: string;
  Icon: typeof ClipboardList;
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

function PatientDialog({
  cancelReason,
  isMutating,
  mode,
  onCancelReasonChange,
  onClose,
  onSubmitCancel,
  request,
  requestError,
  requestIsError,
  requestIsLoading,
}: {
  cancelReason: string;
  isMutating: boolean;
  mode: DialogMode | null;
  onCancelReasonChange: (value: string) => void;
  onClose: () => void;
  onSubmitCancel: (event: FormEvent<HTMLFormElement>) => void;
  request: EmergencyRequest | null;
  requestError: unknown;
  requestIsError: boolean;
  requestIsLoading: boolean;
}) {
  if (!mode || !request) {
    return null;
  }

  return (
    <Dialog open={!!mode} onOpenChange={(open) => !open && onClose()}>
      <DialogClose onClick={onClose} />
      <DialogHeader>
        <div className="flex items-start gap-3 pr-10">
          <div className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <ClipboardList className="size-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">
              {mode === "cancel"
                ? "Cancel request"
                : mode === "track"
                  ? "Track request"
                  : "Request details"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatDate(request.createdAt)}
            </p>
          </div>
        </div>
      </DialogHeader>
      <DialogContent className="space-y-5">
        {(mode === "view" || mode === "track") && requestIsLoading ? (
          <div className="space-y-3">
            <div className="h-10 rounded bg-muted" />
            <div className="h-10 rounded bg-muted" />
            <div className="h-10 rounded bg-muted" />
          </div>
        ) : null}

        {(mode === "view" || mode === "track") && requestIsError ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="font-medium text-amber-900">
              Could not refresh request details
            </p>
            <p className="mt-1 text-sm text-amber-800">
              {getFriendlyApiErrorMessage(requestError)}
            </p>
          </div>
        ) : null}

        {mode === "view" && !requestIsLoading ? (
          <RequestDetails request={request} />
        ) : null}

        {mode === "track" && !requestIsLoading ? (
          <div className="space-y-5">
            <RequestDetails request={request} />
            <TripMap trip={request} />
          </div>
        ) : null}

        {mode === "cancel" ? (
          <form className="space-y-4" onSubmit={onSubmitCancel}>
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              Cancel this emergency request? Assigned ambulances will be
              released.
            </div>
            <Field label="Reason">
              <textarea
                className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition placeholder:text-muted-foreground focus-visible:border-blue-500 focus-visible:ring-3 focus-visible:ring-blue-500/20"
                onChange={(event) => onCancelReasonChange(event.target.value)}
                placeholder="Optional cancellation reason"
                value={cancelReason}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button
                disabled={isMutating}
                onClick={onClose}
                type="button"
                variant="outline"
              >
                Keep request
              </Button>
              <Button disabled={isMutating} type="submit" variant="destructive">
                Cancel request
              </Button>
            </div>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function RequestDetails({ request }: { request: EmergencyRequest }) {
  const lifecycle = [
    { label: "Assigned", value: request.assignedAt },
    { label: "Reached Patient", value: request.reachedPatientAt },
    { label: "Transport Started", value: request.transportStartedAt },
    { label: "Reached Hospital", value: request.reachedHospitalAt },
    { label: "Completed", value: request.completedAt },
    { label: "Cancelled", value: request.cancelledAt },
  ].filter((item) => item.value);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Detail label="Patient" value={request.patientName} />
        <Detail label="Phone" value={request.patientPhone} />
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Status</p>
          <Badge className={`mt-1 ${getStatusClass(request.status)}`}>
            {formatStatus(request.status)}
          </Badge>
        </div>
        <Detail label="Pickup Location" value={formatLocation(request)} />
        <Detail
          label="Ambulance"
          value={getAmbulanceLabel(request.assignedAmbulance)}
        />
        <Detail
          label="Hospital"
          value={getHospitalLabel(request.assignedHospital)}
        />
        <Detail label="Created" value={formatDate(request.createdAt)} />
        <Detail label="Updated" value={formatDate(request.updatedAt)} />
        <Detail label="Notes" value={request.notes?.trim() || "No notes"} />
        {request.cancellationReason?.trim() ? (
          <Detail
            label="Cancellation Reason"
            value={request.cancellationReason}
          />
        ) : null}
      </div>

      {lifecycle.length > 0 ? (
        <div className="rounded-xl border p-4">
          <p className="text-sm font-semibold">Lifecycle</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {lifecycle.map((item) => (
              <Detail
                key={item.label}
                label={item.label}
                value={formatDate(item.value)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}
