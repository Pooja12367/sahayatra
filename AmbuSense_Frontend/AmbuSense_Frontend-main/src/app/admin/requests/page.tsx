"use client";

import {
  Ambulance,
  Ban,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  Hospital,
  MapPin,
  MoreHorizontal,
  Phone,
  RadioTower,
  Search,
  UserRound,
} from "lucide-react";
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { LocationDisplay } from "@/components/location/location-display";
import { TripMap } from "@/components/map/TripMap";
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
import type { Ambulance as AmbulanceType } from "@/types/ambulances";
import type {
  DispatchTechnique,
  EmergencyRequest,
  EmergencyRequestStatus,
} from "@/types/emergency-requests";
import { dispatchTechniques, emergencyRequestStatuses } from "@/types/emergency-requests";
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

const pageSizeOptions = [5, 10, 20] as const;
const activeTripStatuses: EmergencyRequestStatus[] = [
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
  if (!ambulance) {
    return "Not assigned";
  }

  return ambulance.ambulanceCode;
}

function getHospitalLabel(hospital: HospitalType | null | undefined) {
  if (!hospital) {
    return "Not assigned";
  }

  return hospital.name;
}

function canCancel(request: EmergencyRequest) {
  return request.status !== "completed" && request.status !== "cancelled";
}

function getNextStatus(request: EmergencyRequest) {
  if (request.status === "pending") {
    return undefined;
  }

  return nextStatusByStatus[request.status];
}

export default function AdminRequestsPage() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status");
  const initialTechnique = searchParams.get("technique");
  const showActiveTrips = searchParams.get("active") === "true";
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [status, setStatus] = useState<"all" | EmergencyRequestStatus>(
    emergencyRequestStatuses.includes(initialStatus as EmergencyRequestStatus)
      ? (initialStatus as EmergencyRequestStatus)
      : "all",
  );
  const [technique, setTechnique] = useState<"all" | DispatchTechnique>(
    dispatchTechniques.includes(initialTechnique as DispatchTechnique)
      ? (initialTechnique as DispatchTechnique)
      : "all",
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof pageSizeOptions)[number]>(
    10,
  );
  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null);
  const [selectedRequest, setSelectedRequest] =
    useState<EmergencyRequest | null>(null);
  const [dispatchForm, setDispatchForm] =
    useState<DispatchFormState>(emptyDispatchForm);
  const [cancelReason, setCancelReason] = useState("");

  const requestFilters = useMemo(
    () => ({
      search: search.trim() || undefined,
      status: showActiveTrips || status === "all" ? undefined : status,
      hospitalAssignmentTechnique:
        technique === "all" ? undefined : technique,
    }),
    [search, showActiveTrips, status, technique],
  );
  const requestsQuery = useEmergencyRequests(requestFilters);
  const dispatchRequest = useDispatchEmergencyRequest();
  const updateStatus = useUpdateEmergencyRequestStatus();
  const cancelRequest = useCancelEmergencyRequest();
  const ambulanceFilters = useMemo(
    () => ({ status: "available" as const, isActive: true, limit: 100 }),
    [],
  );
  const hospitalFilters = useMemo(
    () => ({
      status: "available" as const,
      hasAvailableBeds: true,
      page: 1,
      limit: 100,
    }),
    [],
  );
  const ambulancesQuery = useAmbulances(ambulanceFilters);
  const hospitalsQuery = useHospitals(hospitalFilters);
  const requests = useMemo(
    () =>
      [...(requestsQuery.data ?? [])]
        .filter((request) =>
          showActiveTrips ? activeTripStatuses.includes(request.status) : true,
        )
        .sort((first, second) => {
        const firstTime = first.createdAt
          ? new Date(first.createdAt).getTime()
          : 0;
        const secondTime = second.createdAt
          ? new Date(second.createdAt).getTime()
          : 0;

        return secondTime - firstTime;
      }),
    [requestsQuery.data, showActiveTrips],
  );
  const totalItems = requests.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const pageStart = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, totalItems);
  const paginatedRequests = requests.slice((page - 1) * pageSize, page * pageSize);
  const isMutating =
    dispatchRequest.isPending ||
    updateStatus.isPending ||
    cancelRequest.isPending;

  useEffect(() => {
    setPage(1);
  }, [pageSize, requestFilters]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

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
          <ClipboardList className="size-3.5" />
          Request management
        </Badge>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
          Emergency Requests
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Monitor emergency requests, dispatch available resources, and advance
          active trips through the response lifecycle.
        </p>
      </section>

      <Card className="w-full bg-white/90">
        <CardContent className="space-y-4 p-4">
          <div className="rounded-xl border bg-slate-50/70 p-3">
            <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_auto] lg:items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-10 border-blue-100 bg-white pl-9 shadow-sm"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search patient, phone, notes, or cancellation reason"
                  value={search}
                />
              </div>
              <DropdownMenu
                trigger={
                  <span className="inline-flex h-10 items-center gap-2 rounded-lg border bg-white px-3 text-sm font-medium shadow-sm transition hover:bg-muted">
                    {technique === "all"
                      ? "All techniques"
                      : formatStatus(technique)}
                    <ChevronRight className="size-3.5 rotate-90 text-muted-foreground" />
                  </span>
                }
              >
                <DropdownMenuItem
                  className={
                    technique === "all"
                      ? "bg-blue-50 text-blue-700"
                      : undefined
                  }
                  onClick={() => setTechnique("all")}
                >
                  {technique === "all" ? (
                    <CheckCircle2 className="size-4" />
                  ) : (
                    <span className="size-4" />
                  )}
                  All techniques
                </DropdownMenuItem>
                {dispatchTechniques.map((item) => (
                  <DropdownMenuItem
                    className={
                      technique === item
                        ? "bg-blue-50 text-blue-700"
                        : undefined
                    }
                    key={item}
                    onClick={() => setTechnique(item)}
                  >
                    {technique === item ? (
                      <CheckCircle2 className="size-4" />
                    ) : (
                      <span className="size-4" />
                    )}
                    {formatStatus(item)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenu>
            </div>

            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              <Button
                className={
                  status === "all"
                    ? "bg-slate-900 text-white hover:bg-slate-800"
                    : "bg-white"
                }
                onClick={() => setStatus("all")}
                size="sm"
                style={{ minWidth: "110px" }}
                type="button"
                variant={status === "all" ? "default" : "outline"}
              >
                All statuses
              </Button>
              {emergencyRequestStatuses.map((item) => (
                <Button
                  className={status === item ? getStatusClass(item) : "bg-white"}
                  key={item}
                  onClick={() => setStatus(item)}
                  size="sm"
                  style={{ minWidth: "110px" }}
                  type="button"
                  variant={status === item ? "default" : "outline"}
                >
                  {formatStatus(item)}
                </Button>
              ))}
            </div>
          </div>

          {requestsQuery.isLoading ? (
            <div className="space-y-3">
              <div className="h-10 rounded bg-muted" />
              <div className="h-10 rounded bg-muted" />
              <div className="h-10 rounded bg-muted" />
              <div className="h-10 rounded bg-muted" />
            </div>
          ) : null}

          {requestsQuery.isError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="font-medium text-red-800">
                Failed to load emergency requests
              </p>
              <p className="mt-1 text-sm text-red-700">
                {getFriendlyApiErrorMessage(requestsQuery.error)}
              </p>
            </div>
          ) : null}

          {!requestsQuery.isLoading &&
          !requestsQuery.isError &&
          requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border p-10 text-center">
              <ClipboardList className="size-10 text-muted-foreground" />
              <h2 className="mt-4 text-lg font-semibold">
                No emergency requests found
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                New patient requests will appear here, or adjust the filters.
              </p>
            </div>
          ) : null}

          {requests.length > 0 ? (
            <div className="overflow-x-auto">
              <Table className="min-w-[980px] table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[220px]">Patient</TableHead>
                    <TableHead className="w-[145px]">Status</TableHead>
                    <TableHead className="w-[150px]">Ambulance</TableHead>
                    <TableHead className="w-[210px]">Hospital</TableHead>
                    <TableHead className="w-[170px]">Date</TableHead>
                    <TableHead className="w-[90px] text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRequests.map((request) => {
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
                            <DropdownMenuItem
                              onClick={() => openViewDialog(request)}
                            >
                              <Eye className="size-4" />
                              View details
                            </DropdownMenuItem>
                            {request.status === "pending" ? (
                              <DropdownMenuItem
                                disabled={isMutating}
                                onClick={() => openDispatchDialog(request)}
                              >
                                <RadioTower className="size-4" />
                                Dispatch
                              </DropdownMenuItem>
                            ) : null}
                            {nextStatus ? (
                              <DropdownMenuItem
                                disabled={isMutating}
                                onClick={() =>
                                  handleStatusUpdate(request, nextStatus)
                                }
                              >
                                <CheckCircle2 className="size-4" />
                                Set {formatStatus(nextStatus)}
                              </DropdownMenuItem>
                            ) : null}
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
                    );
                  })}
                </TableBody>
              </Table>
              <div className="flex flex-col gap-3 border-t px-1 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {pageStart}-{pageEnd} of {totalItems} requests
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <DropdownMenu
                    side="top"
                    trigger={
                      <span className="inline-flex h-8 items-center gap-2 rounded-lg border bg-white px-3 text-sm font-medium shadow-sm transition hover:bg-muted">
                        {pageSize}
                        <ChevronRight className="size-3.5 rotate-90 text-muted-foreground" />
                      </span>
                    }
                  >
                    {pageSizeOptions.map((option) => (
                      <DropdownMenuItem
                        className={
                          pageSize === option
                            ? "bg-blue-50 text-blue-700"
                            : undefined
                        }
                        key={option}
                        onClick={() => setPageSize(option)}
                      >
                        {pageSize === option ? (
                          <CheckCircle2 className="size-4" />
                        ) : (
                          <span className="size-4" />
                        )}
                        {option}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenu>
                  <Button
                    disabled={page <= 1}
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <ChevronLeft className="size-4" />
                    Previous
                  </Button>
                  <span className="rounded-lg border bg-white px-3 py-1 text-sm font-medium">
                    {page} / {totalPages}
                  </span>
                  <Button
                    disabled={page >= totalPages}
                    onClick={() =>
                      setPage((value) => Math.min(totalPages, value + 1))
                    }
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Next
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <RequestDialog
        ambulances={ambulancesQuery.data?.data ?? []}
        cancelReason={cancelReason}
        dispatchForm={dispatchForm}
        hospitals={hospitalsQuery.data?.data ?? []}
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

function RequestDialog({
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
  const canSubmitDispatch = !isMutating && (!requiresHospital || dispatchForm.hospitalId);

  return (
    <Dialog open={!!mode} onOpenChange={(open) => !open && onClose()}>
      <DialogClose onClick={onClose} />
      <DialogHeader>
        <div className="flex items-start gap-3 pr-10">
          <div className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <ClipboardList className="size-5" />
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
                title="Ambulance-Loading"
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
                  title="Hospital-Loading"
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
            <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
              System Auto lets the backend select the hospital and rejects a
              hospital value. User Choice and Admin Override require a hospital.
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
  const lifecycle = [
    { label: "Created", value: request.createdAt },
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
        <Detail
          label="Assignment Technique"
          value={formatStatus(request.hospitalAssignmentTechnique)}
        />
        <Detail label="Created" value={formatDate(request.createdAt)} />
      </div>

      <div className="rounded-xl border bg-blue-50/40 p-4">
        <div className="flex items-center gap-2">
          <MapPin className="size-5 text-blue-700" />
          <div>
            <p className="text-sm font-semibold">Response details</p>
            <p className="text-xs text-muted-foreground">
              Dispatch and trip metadata for this emergency request.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Detail
            label="Notes"
            value={request.notes?.trim() || "No notes provided"}
          />
          <Detail
            label="Cancellation Reason"
            value={
              request.cancellationReason?.trim() || "No cancellation reason"
            }
          />
        </div>
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
      
      {/* Real-time map view of the emergency request */}
      <div className="mt-6">
        <TripMap trip={request} />
      </div>
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
