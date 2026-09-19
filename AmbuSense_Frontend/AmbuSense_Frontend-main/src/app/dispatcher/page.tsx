"use client";

import {
  Ambulance,
  Ban,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Eye,
  Hospital,
  MoreHorizontal,
  Phone,
  RadioTower,
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
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { LocationDisplay } from "@/components/location/location-display";
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
import { getAmbulanceId, useAmbulances } from "@/hooks/use-ambulances";
import {
  getEmergencyRequestId,
  useCancelEmergencyRequest,
  useDispatchEmergencyRequest,
  useEmergencyRequests,
  useUpdateEmergencyRequestStatus,
} from "@/hooks/use-emergency-requests";
import { getHospitalId, useHospitals } from "@/hooks/use-hospitals";
import { getFriendlyApiErrorMessage } from "@/lib/api";
import {
  acquireSocketConnection,
  releaseSocketConnection,
  socket,
} from "@/lib/socket";
import type { Ambulance as AmbulanceType } from "@/types/ambulances";
import type {
  DispatchTechnique,
  EmergencyRequest,
  EmergencyRequestStatus,
} from "@/types/emergency-requests";
import type { Hospital as HospitalType } from "@/types/hospitals";

type DialogMode = "view" | "dispatch" | "cancel";

type DispatchFormState = {
  technique: DispatchTechnique;
  ambulanceId: string;
  hospitalId: string;
  notes: string;
};

const emptyDispatchForm: DispatchFormState = {
  technique: "system-auto",
  ambulanceId: "",
  hospitalId: "",
  notes: "",
};

const activeStatuses: EmergencyRequestStatus[] = [
  "assigned",
  "en-route",
  "at-patient",
  "transporting",
  "at-hospital",
];

const nextStatusByStatus: Partial<
  Record<EmergencyRequestStatus, EmergencyRequestStatus>
> = {
  assigned: "en-route",
  "en-route": "at-patient",
  "at-patient": "transporting",
  transporting: "at-hospital",
  "at-hospital": "completed",
};

function useDispatcherSocketInvalidation() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const token = acquireSocketConnection();

    const invalidateRequests = () => {
      queryClient.invalidateQueries({ queryKey: ["emergency-requests"] });
    };

    const invalidateOperationalData = () => {
      queryClient.invalidateQueries({ queryKey: ["emergency-requests"] });
      queryClient.invalidateQueries({ queryKey: ["ambulances"] });
      queryClient.invalidateQueries({ queryKey: ["hospitals"] });
    };

    socket.on("emergency.request.created", invalidateRequests);
    socket.on("emergency.request.updated", invalidateOperationalData);
    socket.on("emergency.request.dispatched", invalidateOperationalData);
    socket.on("emergency.request.cancelled", invalidateOperationalData);
    socket.on("emergency.request.deleted", invalidateOperationalData);

    return () => {
      socket.off("emergency.request.created", invalidateRequests);
      socket.off("emergency.request.updated", invalidateOperationalData);
      socket.off("emergency.request.dispatched", invalidateOperationalData);
      socket.off("emergency.request.cancelled", invalidateOperationalData);
      socket.off("emergency.request.deleted", invalidateOperationalData);
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

function getNextStatus(request: EmergencyRequest) {
  return nextStatusByStatus[request.status];
}

export default function DispatcherPage() {
  useDispatcherSocketInvalidation();

  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null);
  const [selectedRequest, setSelectedRequest] =
    useState<EmergencyRequest | null>(null);
  const [dispatchForm, setDispatchForm] =
    useState<DispatchFormState>(emptyDispatchForm);
  const [cancelReason, setCancelReason] = useState("");

  const requestsQuery = useEmergencyRequests();
  const ambulancesQuery = useAmbulances({
    status: "available",
    isActive: true,
    page: 1,
    limit: 100,
  });
  const hospitalsQuery = useHospitals({
    status: "available",
    hasAvailableBeds: true,
    page: 1,
    limit: 100,
  });
  const dispatchRequest = useDispatchEmergencyRequest();
  const updateStatus = useUpdateEmergencyRequestStatus();
  const cancelRequest = useCancelEmergencyRequest();
  const requests = useMemo(
    () =>
      [...(requestsQuery.data ?? [])].sort((first, second) => {
        const firstTime = first.createdAt
          ? new Date(first.createdAt).getTime()
          : 0;
        const secondTime = second.createdAt
          ? new Date(second.createdAt).getTime()
          : 0;

        return secondTime - firstTime;
      }),
    [requestsQuery.data],
  );
  const pendingRequests = requests.filter(
    (request) => request.status === "pending",
  );
  const activeRequests = requests.filter((request) =>
    activeStatuses.includes(request.status),
  );
  const availableAmbulances = ambulancesQuery.data?.data ?? [];
  const availableHospitals = hospitalsQuery.data?.data ?? [];
  const isMutating =
    dispatchRequest.isPending ||
    updateStatus.isPending ||
    cancelRequest.isPending;

  function openViewDialog(request: EmergencyRequest) {
    setSelectedRequest(request);
    setDialogMode("view");
  }

  function openDispatchDialog(request: EmergencyRequest) {
    setSelectedRequest(request);
    setDispatchForm(emptyDispatchForm);
    setDialogMode("dispatch");
  }

  function openCancelDialog(request: EmergencyRequest) {
    setSelectedRequest(request);
    setCancelReason("");
    setDialogMode("cancel");
  }

  function closeDialog() {
    setDialogMode(null);
    setSelectedRequest(null);
  }

  async function handleDispatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedRequest) {
      return;
    }

    const requiresHospital = dispatchForm.technique !== "system-auto";

    if (requiresHospital && !dispatchForm.hospitalId) {
      toast.error("Select a hospital for this dispatch technique");
      return;
    }

    try {
      await dispatchRequest.mutateAsync({
        requestId: getEmergencyRequestId(selectedRequest),
        payload: {
          hospitalAssignmentTechnique: dispatchForm.technique,
          ...(dispatchForm.ambulanceId
            ? { ambulanceId: dispatchForm.ambulanceId }
            : {}),
          ...(requiresHospital ? { hospitalId: dispatchForm.hospitalId } : {}),
          ...(dispatchForm.notes.trim()
            ? { notes: dispatchForm.notes.trim() }
            : {}),
        },
      });
      toast.success("Emergency request dispatched");
      closeDialog();
    } catch (error) {
      toast.error(getFriendlyApiErrorMessage(error));
    }
  }

  async function handleStatusUpdate(
    request: EmergencyRequest,
    nextStatus: EmergencyRequestStatus,
  ) {
    try {
      await updateStatus.mutateAsync({
        requestId: getEmergencyRequestId(request),
        payload: { status: nextStatus },
      });
      toast.success(`Request marked ${formatStatus(nextStatus)}`);
    } catch (error) {
      toast.error(getFriendlyApiErrorMessage(error));
    }
  }

  async function handleCancel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedRequest) {
      return;
    }

    try {
      await cancelRequest.mutateAsync({
        requestId: getEmergencyRequestId(selectedRequest),
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
          <RadioTower className="size-3.5" />
          Dispatcher operations
        </Badge>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
          Dispatcher Dashboard
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Monitor incoming requests, dispatch available ambulances, and advance
          active trips through the response lifecycle.
        </p>
      </section>

      <section
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        id="resources"
      >
        <SummaryCard
          Icon={ClipboardList}
          label="Pending Requests"
          value={pendingRequests.length}
        />
        <SummaryCard
          Icon={RadioTower}
          label="Active Requests"
          value={activeRequests.length}
        />
        <SummaryCard
          Icon={Ambulance}
          label="Available Ambulances"
          value={availableAmbulances.length}
        />
        <SummaryCard
          Icon={Hospital}
          label="Available Hospitals"
          value={availableHospitals.length}
        />
      </section>

      {requestsQuery.isLoading ? (
        <Card className="bg-white/90">
          <CardContent className="space-y-3 p-6">
            <div className="h-10 rounded bg-muted" />
            <div className="h-10 rounded bg-muted" />
            <div className="h-10 rounded bg-muted" />
          </CardContent>
        </Card>
      ) : null}

      {requestsQuery.isError ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <p className="font-medium text-red-800">
              Failed to load dispatcher queue
            </p>
            <p className="mt-1 text-sm text-red-700">
              {getFriendlyApiErrorMessage(requestsQuery.error)}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {!requestsQuery.isLoading && !requestsQuery.isError ? (
        <>
          <RequestTable
            isMutating={isMutating}
            kind="pending"
            onCancel={openCancelDialog}
            onDispatch={openDispatchDialog}
            onStatusUpdate={handleStatusUpdate}
            onView={openViewDialog}
            requests={pendingRequests}
            sectionId="queue"
            title="Pending Requests"
          />
          <RequestTable
            isMutating={isMutating}
            kind="active"
            onCancel={openCancelDialog}
            onDispatch={openDispatchDialog}
            onStatusUpdate={handleStatusUpdate}
            onView={openViewDialog}
            requests={activeRequests}
            title="Active Requests"
          />
        </>
      ) : null}

      <DispatcherDialog
        ambulances={availableAmbulances}
        cancelReason={cancelReason}
        dispatchForm={dispatchForm}
        hospitals={availableHospitals}
        isAmbulancesLoading={ambulancesQuery.isLoading}
        isHospitalsLoading={hospitalsQuery.isLoading}
        isMutating={isMutating}
        mode={dialogMode}
        onCancelReasonChange={setCancelReason}
        onClose={closeDialog}
        onDispatchFormChange={setDispatchForm}
        onSubmitCancel={handleCancel}
        onSubmitDispatch={handleDispatch}
        request={selectedRequest}
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

function RequestTable({
  isMutating,
  kind,
  onCancel,
  onDispatch,
  onStatusUpdate,
  onView,
  requests,
  sectionId,
  title,
}: {
  isMutating: boolean;
  kind: "pending" | "active";
  onCancel: (request: EmergencyRequest) => void;
  onDispatch: (request: EmergencyRequest) => void;
  onStatusUpdate: (
    request: EmergencyRequest,
    status: EmergencyRequestStatus,
  ) => void;
  onView: (request: EmergencyRequest) => void;
  requests: EmergencyRequest[];
  sectionId?: string;
  title: string;
}) {
  return (
    <Card className="w-full bg-white/90" id={sectionId}>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground">
              {kind === "pending"
                ? "Requests waiting for dispatch."
                : "Trips currently assigned or in progress."}
            </p>
          </div>
          <Badge className="border-blue-200 bg-blue-50 text-blue-700">
            {requests.length}
          </Badge>
        </div>

        {requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border p-10 text-center">
            <ClipboardList className="size-10 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No {kind} requests</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              New operational requests will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[980px] table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[240px]">Patient</TableHead>
                  <TableHead className="w-[135px]">Status</TableHead>
                  <TableHead className="w-[150px]">Ambulance</TableHead>
                  <TableHead className="w-[210px]">Hospital</TableHead>
                  <TableHead className="w-[170px]">Created</TableHead>
                  <TableHead className="w-[90px] text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => {
                  const nextStatus = getNextStatus(request);

                  return (
                    <TableRow key={getEmergencyRequestId(request)}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                            <UserRound className="size-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {request.patientName}
                            </p>
                            <p className="flex items-center gap-1 truncate text-sm text-muted-foreground">
                              <Phone className="size-3.5" />
                              {request.patientPhone}
                            </p>
                          </div>
                        </div>
                      </TableCell>
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
                          trigger={
                            <span className="inline-flex size-8 items-center justify-center rounded-lg border bg-background transition hover:bg-muted">
                              <MoreHorizontal className="size-4" />
                            </span>
                          }
                        >
                          {kind === "active" ? (
                            <DropdownMenuItem onClick={() => onView(request)}>
                              <Eye className="size-4" />
                              View details
                            </DropdownMenuItem>
                          ) : null}
                          {kind === "pending" ? (
                            <DropdownMenuItem
                              disabled={isMutating}
                              onClick={() => onDispatch(request)}
                            >
                              <RadioTower className="size-4" />
                              Dispatch
                            </DropdownMenuItem>
                          ) : null}
                          {nextStatus ? (
                            <DropdownMenuItem
                              disabled={isMutating}
                              onClick={() => onStatusUpdate(request, nextStatus)}
                            >
                              <CheckCircle2 className="size-4" />
                              Set {formatStatus(nextStatus)}
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem
                            disabled={isMutating}
                            onClick={() => onCancel(request)}
                          >
                            <Ban className="size-4" />
                            Cancel
                          </DropdownMenuItem>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DispatcherDialog({
  ambulances,
  cancelReason,
  dispatchForm,
  hospitals,
  isAmbulancesLoading,
  isHospitalsLoading,
  isMutating,
  mode,
  onCancelReasonChange,
  onClose,
  onDispatchFormChange,
  onSubmitCancel,
  onSubmitDispatch,
  request,
}: {
  ambulances: AmbulanceType[];
  cancelReason: string;
  dispatchForm: DispatchFormState;
  hospitals: HospitalType[];
  isAmbulancesLoading: boolean;
  isHospitalsLoading: boolean;
  isMutating: boolean;
  mode: DialogMode | null;
  onCancelReasonChange: (value: string) => void;
  onClose: () => void;
  onDispatchFormChange: (form: DispatchFormState) => void;
  onSubmitCancel: (event: FormEvent<HTMLFormElement>) => void;
  onSubmitDispatch: (event: FormEvent<HTMLFormElement>) => void;
  request: EmergencyRequest | null;
}) {
  if (!mode || !request) {
    return null;
  }

  const title =
    mode === "dispatch"
      ? "Dispatch request"
      : mode === "cancel"
        ? "Cancel request"
        : "Request details";
  const requiresHospital = dispatchForm.technique !== "system-auto";
  const canSubmitDispatch =
    !isMutating && (!requiresHospital || Boolean(dispatchForm.hospitalId));

  return (
    <Dialog open={!!mode} onOpenChange={(open) => !open && onClose()}>
      <DialogClose onClick={onClose} />
      <DialogHeader>
        <div className="flex items-start gap-3 pr-10">
          <div className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <RadioTower className="size-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {request.patientName} ({request.patientPhone})
            </p>
          </div>
        </div>
      </DialogHeader>
      <DialogContent className="space-y-5">
        {mode === "view" ? <RequestDetails request={request} /> : null}

        {mode === "dispatch" ? (
          <form className="space-y-4" onSubmit={onSubmitDispatch}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Dispatch Technique">
                <select
                title="Dispatch-Technique"
                  className="h-8 w-full rounded-lg border bg-background px-3 text-sm disabled:opacity-60"
                  onChange={(event) =>
                    onDispatchFormChange({
                      ...dispatchForm,
                      technique: event.target.value as DispatchTechnique,
                      hospitalId:
                        event.target.value === "system-auto"
                          ? ""
                          : dispatchForm.hospitalId,
                    })
                  }
                  value={dispatchForm.technique}
                >
                  <option value="system-auto">System Auto</option>
                  <option value="user-choice">User Choice</option>
                  <option value="admin-override">Admin Override</option>
                </select>
              </Field>
              <Field label="Ambulance">
                <select
                title="Ambulance"
                  className="h-8 w-full rounded-lg border bg-background px-3 text-sm disabled:opacity-60"
                  disabled={isAmbulancesLoading}
                  onChange={(event) =>
                    onDispatchFormChange({
                      ...dispatchForm,
                      ambulanceId: event.target.value,
                    })
                  }
                  value={dispatchForm.ambulanceId}
                >
                  <option value="">Nearest available</option>
                  {ambulances.map((ambulance) => (
                    <option
                      key={getAmbulanceId(ambulance)}
                      value={getAmbulanceId(ambulance)}
                    >
                      {ambulance.ambulanceCode} - {ambulance.driverName}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Hospital">
                <select
                title="Hospital"
                  className="h-8 w-full rounded-lg border bg-background px-3 text-sm disabled:opacity-60"
                  disabled={!requiresHospital || isHospitalsLoading}
                  onChange={(event) =>
                    onDispatchFormChange({
                      ...dispatchForm,
                      hospitalId: event.target.value,
                    })
                  }
                  value={dispatchForm.hospitalId}
                >
                  <option value="">
                    {requiresHospital ? "Select hospital" : "System selects"}
                  </option>
                  {hospitals.map((hospital) => (
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
                <Input
                  onChange={(event) =>
                    onDispatchFormChange({
                      ...dispatchForm,
                      notes: event.target.value,
                    })
                  }
                  placeholder="Optional dispatch note"
                  value={dispatchForm.notes}
                />
              </Field>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                disabled={isMutating}
                onClick={onClose}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                className="bg-blue-600 text-white hover:bg-blue-700"
                disabled={!canSubmitDispatch}
                type="submit"
              >
                Dispatch
              </Button>
            </div>
          </form>
        ) : null}

        {mode === "cancel" ? (
          <form className="space-y-4" onSubmit={onSubmitCancel}>
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              Cancel this emergency request? Assigned ambulances will be
              released.
            </div>
            <Field label="Reason">
              <Input
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
        <Detail
          label="Assignment Technique"
          value={formatStatus(request.hospitalAssignmentTechnique)}
        />
        <Detail label="Created" value={formatDate(request.createdAt)} />
      </div>
      <Detail label="Notes" value={request.notes?.trim() || "No notes"} />
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
