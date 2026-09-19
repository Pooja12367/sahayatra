"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import {
  Ambulance as AmbulanceIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Eye,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import {
  Fragment,
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { LocationDisplay } from "@/components/location/location-display";
import { LocationInput } from "@/components/location/location-input";
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
import {
  getAmbulanceId,
  useAmbulances,
  useCreateAmbulance,
  useDeleteAmbulance,
  useUpdateAmbulance,
  useUpdateAmbulanceStatus,
} from "@/hooks/use-ambulances";
import { getFriendlyApiErrorMessage } from "@/lib/api";
import {
  ambulanceStatuses,
  type Ambulance,
  type AmbulanceFilters,
  type AmbulanceStatus,
} from "@/types/ambulances";

type DialogMode = "view" | "create" | "edit" | "delete";
type Coordinates = [number, number];

type AmbulanceFormState = {
  ambulanceCode: string;
  driverName: string;
  phone: string;
  status: AmbulanceStatus;
  longitude: string;
  latitude: string;
  isActive: boolean;
};

const emptyForm: AmbulanceFormState = {
  ambulanceCode: "",
  driverName: "",
  phone: "",
  status: "offline",
  longitude: "85.324",
  latitude: "27.7172",
  isActive: true,
};

const pageSizeOptions = [5, 10, 20] as const;

const LocationPreviewMap = dynamic(
  () => import("@/components/location/location-preview-map.client"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-72 items-center justify-center rounded-lg border bg-muted/30 text-sm text-muted-foreground sm:h-80">
        Loading map...
      </div>
    ),
  },
);

function getStatusClass(status: AmbulanceStatus) {
  switch (status) {
    case "available":
      return "border-green-200 bg-green-50 text-green-700";
    case "assigned":
    case "en-route":
    case "at-patient":
    case "transporting":
    case "at-hospital":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "completed":
      return "border-green-200 bg-green-50 text-green-700";
    case "offline":
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function formatStatus(value: string) {
  return value
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function formatLocation(ambulance: Ambulance) {
  const coordinates = ambulance.currentLocation?.coordinates;
  return (
    <LocationDisplay
      coordinates={coordinates}
      label="Ambulance location"
      mapMode="inline"
      tone="muted"
    />
  );
}

function isValidCoordinates(
  coordinates: Coordinates | null | undefined,
): coordinates is Coordinates {
  return (
    Array.isArray(coordinates) &&
    coordinates.length === 2 &&
    coordinates.every((coordinate) => Number.isFinite(coordinate))
  );
}

function getFormFromAmbulance(ambulance: Ambulance): AmbulanceFormState {
  const coordinates = ambulance.currentLocation?.coordinates ?? [85.324, 27.7172];

  return {
    ambulanceCode: ambulance.ambulanceCode,
    driverName: ambulance.driverName,
    phone: ambulance.phone,
    status: ambulance.status,
    longitude: String(coordinates[0]),
    latitude: String(coordinates[1]),
    isActive: ambulance.isActive,
  };
}

function parseForm(form: AmbulanceFormState) {
  const longitude = Number(form.longitude);
  const latitude = Number(form.latitude);

  if (!form.ambulanceCode.trim()) {
    throw new Error("Ambulance code is required");
  }

  if (!form.driverName.trim()) {
    throw new Error("Driver name is required");
  }

  if (!form.phone.trim()) {
    throw new Error("Phone is required");
  }

  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    throw new Error("Location must use valid longitude and latitude");
  }

  return {
    ambulanceCode: form.ambulanceCode.trim(),
    driverName: form.driverName.trim(),
    phone: form.phone.trim(),
    status: form.status,
    coordinates: [longitude, latitude] as [number, number],
    isActive: form.isActive,
  };
}

export default function AdminAmbulancesPage() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status");
  const initialActive = searchParams.get("active");
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [status, setStatus] = useState<"all" | AmbulanceStatus>(
    ambulanceStatuses.includes(initialStatus as AmbulanceStatus)
      ? (initialStatus as AmbulanceStatus)
      : "all",
  );
  const [active, setActive] = useState<"all" | "active" | "inactive">(
    initialActive === "active" || initialActive === "inactive"
      ? initialActive
      : "all",
  );
  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null);
  const [selectedAmbulance, setSelectedAmbulance] =
    useState<Ambulance | null>(null);
  const [form, setForm] = useState<AmbulanceFormState>(emptyForm);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof pageSizeOptions)[number]>(
    10,
  );
  const [expandedMapAmbulanceId, setExpandedMapAmbulanceId] = useState<
    string | null
  >(null);

  const filters = useMemo<AmbulanceFilters>(
    () => ({
      search: search.trim() || undefined,
      status: status === "all" ? undefined : status,
      isActive:
        active === "all" ? undefined : active === "active" ? true : false,
      page,
      limit: pageSize,
    }),
    [active, page, pageSize, search, status],
  );

  const ambulancesQuery = useAmbulances(filters);
  const createAmbulance = useCreateAmbulance();
  const updateAmbulance = useUpdateAmbulance();
  const updateStatus = useUpdateAmbulanceStatus();
  const deleteAmbulance = useDeleteAmbulance();
  const ambulances = ambulancesQuery.data?.data ?? [];
  const pagination = ambulancesQuery.data?.meta;
  const totalItems = pagination?.total ?? 0;
  const totalPages = pagination?.totalPages ?? 1;
  const pageStart = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, totalItems);
  const isMutating =
    createAmbulance.isPending ||
    updateAmbulance.isPending ||
    updateStatus.isPending ||
    deleteAmbulance.isPending;

  useEffect(() => {
    setPage(1);
  }, [active, pageSize, search, status]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  function openCreateDialog() {
    setSelectedAmbulance(null);
    setForm(emptyForm);
    setDialogMode("create");
  }

  function openViewDialog(ambulance: Ambulance) {
    setSelectedAmbulance(ambulance);
    setDialogMode("view");
  }

  function openEditDialog(ambulance: Ambulance) {
    setSelectedAmbulance(ambulance);
    setForm(getFormFromAmbulance(ambulance));
    setDialogMode("edit");
  }

  function openDeleteDialog(ambulance: Ambulance) {
    setSelectedAmbulance(ambulance);
    setDialogMode("delete");
  }

  function closeDialog() {
    setDialogMode(null);
    setSelectedAmbulance(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const payload = parseForm(form);

      if (dialogMode === "create") {
        await createAmbulance.mutateAsync(payload);
        toast.success("Ambulance created");
      }

      if (dialogMode === "edit" && selectedAmbulance) {
        await updateAmbulance.mutateAsync({
          ambulanceId: getAmbulanceId(selectedAmbulance),
          payload: {
            ambulanceCode: payload.ambulanceCode,
            driverName: payload.driverName,
            phone: payload.phone,
            coordinates: payload.coordinates,
          },
        });
        
        if (selectedAmbulance.status !== form.status) {
          await updateStatus.mutateAsync({
            ambulanceId: getAmbulanceId(selectedAmbulance),
            status: form.status,
          });
        }
        
        toast.success("Ambulance updated");
      }

      closeDialog();
    } catch (error) {
      toast.error(getFriendlyApiErrorMessage(error));
    }
  }

  async function handleStatusChange(
    ambulance: Ambulance,
    nextStatus: AmbulanceStatus,
  ) {
    try {
      await updateStatus.mutateAsync({
        ambulanceId: getAmbulanceId(ambulance),
        status: nextStatus,
      });
      toast.success("Ambulance status updated");
    } catch (error) {
      toast.error(getFriendlyApiErrorMessage(error));
    }
  }

  async function handleDelete() {
    if (!selectedAmbulance) {
      return;
    }

    try {
      await deleteAmbulance.mutateAsync(getAmbulanceId(selectedAmbulance));
      toast.success("Ambulance deleted");
      closeDialog();
    } catch (error) {
      toast.error(getFriendlyApiErrorMessage(error));
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <section className="flex w-full flex-col gap-4 rounded-lg border border-blue-100/80 bg-white/90 p-6 shadow-xl shadow-blue-950/5 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Badge className="border-blue-200 bg-blue-50 text-blue-700">
            <AmbulanceIcon className="size-3.5" />
            Fleet management
          </Badge>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            Ambulances
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Manage ambulance records, status, driver contact, and live location
            metadata.
          </p>
        </div>
        <Button
          className="bg-blue-600 text-white hover:bg-blue-700"
          onClick={openCreateDialog}
          type="button"
        >
          <Plus className="size-4" />
          Create ambulance
        </Button>
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
                  placeholder="Search ambulance code, driver, or phone"
                  value={search}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {(["all", "active", "inactive"] as const).map((item) => (
                  <Button
                    className={
                      active === item
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "bg-white"
                    }
                    key={item}
                    onClick={() => setActive(item)}
                    size="sm"
                    type="button"
                    variant={active === item ? "default" : "outline"}
                  >
                    {item === "all"
                      ? "All"
                      : item === "active"
                        ? "Active"
                        : "Inactive"}
                  </Button>
                ))}
              </div>
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
              {ambulanceStatuses.map((item) => (
                <Button
                  className={
                    status === item ? getStatusClass(item) : "bg-white"
                  }
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

          {ambulancesQuery.isLoading ? (
            <div className="space-y-3">
              <div className="h-10 rounded bg-muted" />
              <div className="h-10 rounded bg-muted" />
              <div className="h-10 rounded bg-muted" />
            </div>
          ) : null}

          {ambulancesQuery.isError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="font-medium text-red-800">
                Failed to load ambulances
              </p>
              <p className="mt-1 text-sm text-red-700">
                {getFriendlyApiErrorMessage(ambulancesQuery.error)}
              </p>
            </div>
          ) : null}

          {!ambulancesQuery.isLoading &&
          !ambulancesQuery.isError &&
          ambulances.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border p-10 text-center">
              <AmbulanceIcon className="size-10 text-muted-foreground" />
              <h2 className="mt-4 text-lg font-semibold">
                No ambulances found
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Create an ambulance or adjust the filters.
              </p>
            </div>
          ) : null}

          {ambulances.length > 0 ? (
            <div className="overflow-x-auto">
              <Table className="min-w-[980px] table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[150px]">Ambulance Code</TableHead>
                    <TableHead className="w-[180px]">Driver Name</TableHead>
                    <TableHead className="w-[160px]">Phone</TableHead>
                    <TableHead className="w-[150px]">Status</TableHead>
                    <TableHead className="w-[120px]">Active</TableHead>
                    <TableHead className="w-[220px]">Location</TableHead>
                    <TableHead className="w-[90px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ambulances.map((ambulance) => {
                    const ambulanceId = getAmbulanceId(ambulance);
                    const coordinates = ambulance.currentLocation?.coordinates;
                    const hasCoordinates = isValidCoordinates(coordinates);
                    const mapIsOpen = expandedMapAmbulanceId === ambulanceId;

                    return (
                    <Fragment key={ambulanceId}>
                      <TableRow>
                      <TableCell className="truncate font-medium">
                        {ambulance.ambulanceCode}
                      </TableCell>
                      <TableCell className="truncate">
                        {ambulance.driverName}
                      </TableCell>
                      <TableCell className="truncate">{ambulance.phone}</TableCell>
                      <TableCell>
                        <Badge
                          className={`w-28 justify-center ${getStatusClass(
                            ambulance.status,
                          )}`}
                        >
                          {formatStatus(ambulance.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            ambulance.isActive
                              ? "w-20 justify-center border-blue-200 bg-blue-50 text-blue-700"
                              : "w-20 justify-center border-slate-200 bg-slate-50 text-slate-700"
                          }
                        >
                          {ambulance.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex min-w-0 items-center gap-2">
                          <LocationDisplay
                            coordinates={coordinates}
                            label="Ambulance location"
                            mapMode="none"
                            tone="muted"
                          />
                          {hasCoordinates ? (
                            <Button
                              className="h-7 shrink-0 px-2 text-xs"
                              onClick={() =>
                                setExpandedMapAmbulanceId((current) =>
                                  current === ambulanceId ? null : ambulanceId,
                                )
                              }
                              type="button"
                              variant="ghost"
                            >
                              {mapIsOpen ? "Hide map" : "Map"}
                            </Button>
                          ) : null}
                        </div>
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
                            onClick={() => openViewDialog(ambulance)}
                          >
                            <Eye className="size-4" />
                            View details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => openEditDialog(ambulance)}
                          >
                            <Edit3 className="size-4" />
                            Edit ambulance
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => openDeleteDialog(ambulance)}
                          >
                            <Trash2 className="size-4" />
                            Delete
                          </DropdownMenuItem>
                          {ambulanceStatuses.map((nextStatus) => (
                            <DropdownMenuItem
                              disabled={
                                isMutating || nextStatus === ambulance.status
                              }
                              key={nextStatus}
                              onClick={() =>
                                handleStatusChange(ambulance, nextStatus)
                              }
                            >
                              <CheckCircle2 className="size-4" />
                              Set {formatStatus(nextStatus)}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    {hasCoordinates && mapIsOpen ? (
                      <TableRow>
                        <TableCell className="bg-muted/20 p-4" colSpan={7}>
                          <LocationPreviewMap coordinates={coordinates} iconType="ambulance" />
                        </TableCell>
                      </TableRow>
                    ) : null}
                    </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="flex flex-col gap-3 border-t px-1 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {pageStart}-{pageEnd} of {totalItems}{" "}
                  ambulances
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

      <AmbulanceDialog
        ambulance={selectedAmbulance}
        form={form}
        isMutating={isMutating}
        mode={dialogMode}
        onClose={closeDialog}
        onDelete={handleDelete}
        onFormChange={setForm}
        onSubmit={handleSubmit}
      />
    </main>
  );
}

function AmbulanceDialog({
  ambulance,
  form,
  isMutating,
  mode,
  onClose,
  onDelete,
  onFormChange,
  onSubmit,
}: {
  ambulance: Ambulance | null;
  form: AmbulanceFormState;
  isMutating: boolean;
  mode: DialogMode | null;
  onClose: () => void;
  onDelete: () => void;
  onFormChange: (form: AmbulanceFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (!mode) {
    return null;
  }

  const title =
    mode === "create"
      ? "Create ambulance"
      : mode === "edit"
        ? "Edit ambulance"
        : mode === "delete"
          ? "Delete ambulance"
          : "Ambulance details";

  return (
    <Dialog open={!!mode} onOpenChange={(open) => !open && onClose()}>
      <DialogClose onClick={onClose} />
      <DialogHeader>
        <div className="flex items-start gap-3 pr-10">
          <div className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <AmbulanceIcon className="size-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {ambulance?.ambulanceCode ??
                "Add a new ambulance to the active fleet."}
            </p>
          </div>
        </div>
      </DialogHeader>
      <DialogContent className="space-y-5">
        {mode === "view" && ambulance ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Detail label="Ambulance Code" value={ambulance.ambulanceCode} />
            <Detail label="Driver Name" value={ambulance.driverName} />
            <Detail label="Phone" value={ambulance.phone} />
            <Detail label="Location" value={formatLocation(ambulance)} />
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge className={`mt-1 w-28 justify-center ${getStatusClass(ambulance.status)}`}>
                {formatStatus(ambulance.status)}
              </Badge>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Active</p>
              <p className="mt-1 text-sm font-medium">
                {ambulance.isActive ? "Active" : "Inactive"}
              </p>
            </div>
          </div>
        ) : null}

        {(mode === "create" || mode === "edit") ? (
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Ambulance Code">
                <Input
                  onChange={(event) =>
                    onFormChange({ ...form, ambulanceCode: event.target.value })
                  }
                  value={form.ambulanceCode}
                />
              </Field>
              <Field label="Driver Name">
                <Input
                  onChange={(event) =>
                    onFormChange({ ...form, driverName: event.target.value })
                  }
                  value={form.driverName}
                />
              </Field>
              <Field label="Phone">
                <Input
                  onChange={(event) =>
                    onFormChange({ ...form, phone: event.target.value })
                  }
                  value={form.phone}
                />
              </Field>
              <Field label="Status">
                <select
                  title="Ambulance Status"
                  className="h-8 w-full rounded-lg border bg-background px-3 text-sm disabled:opacity-60"
                  onChange={(event) =>
                    onFormChange({
                      ...form,
                      status: event.target.value as AmbulanceStatus,
                    })
                  }
                  value={form.status}
                >
                  {ambulanceStatuses.map((item) => (
                    <option key={item} value={item}>
                      {formatStatus(item)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <LocationInput
              latitude={form.latitude}
              longitude={form.longitude}
              onCoordinatesChange={(coordinates) =>
                onFormChange({ ...form, ...coordinates })
              }
              onLatitudeChange={(latitude) => onFormChange({ ...form, latitude })}
              onLongitudeChange={(longitude) =>
                onFormChange({ ...form, longitude })
              }
              title="Ambulance location"
              iconType="ambulance"
            />
            {mode === "create" ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  checked={form.isActive}
                  onChange={(event) =>
                    onFormChange({ ...form, isActive: event.target.checked })
                  }
                  type="checkbox"
                />
                Active ambulance
              </label>
            ) : (
              <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                Active state is shown in the table. The current backend update
                endpoint does not expose active/inactive editing yet.
              </p>
            )}
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
                disabled={isMutating}
                type="submit"
              >
                {mode === "create" ? "Create" : "Save changes"}
              </Button>
            </div>
          </form>
        ) : null}

        {mode === "delete" && ambulance ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              Delete {ambulance.ambulanceCode}?
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
                disabled={isMutating}
                onClick={onDelete}
                type="button"
                variant="destructive"
              >
                Delete
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
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
