"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import {
  Bed,
  Building2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Edit3,
  Eye,
  MoreHorizontal,
  Phone,
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
  getHospitalId,
  useCreateHospital,
  useDeleteHospital,
  useHospitals,
  useUpdateHospital,
} from "@/hooks/use-hospitals";
import { getFriendlyApiErrorMessage } from "@/lib/api";
import {
  hospitalStatuses,
  type Hospital,
  type HospitalStatus,
} from "@/types/hospitals";

type DialogMode = "view" | "create" | "edit" | "delete";
type Coordinates = [number, number];

type HospitalFormState = {
  name: string;
  phone: string;
  address: string;
  status: HospitalStatus;
  capacity: string;
  availableBeds: string;
  specialization: string;
  longitude: string;
  latitude: string;
};

const emptyForm: HospitalFormState = {
  name: "",
  phone: "",
  address: "",
  status: "available",
  capacity: "",
  availableBeds: "",
  specialization: "",
  longitude: "85.324",
  latitude: "27.7172",
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

function getStatusClass(status: HospitalStatus) {
  switch (status) {
    case "available":
      return "border-green-200 bg-green-50 text-green-700";
    case "busy":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "offline":
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function formatStatus(value: string) {
  return value[0].toUpperCase() + value.slice(1);
}

function formatLocation(hospital: Hospital) {
  const coordinates = hospital.location?.coordinates;
  return (
    <LocationDisplay
      address={hospital.address}
      coordinates={coordinates}
      label="Hospital location"
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

function getFormFromHospital(hospital: Hospital): HospitalFormState {
  const coordinates = hospital.location?.coordinates ?? [85.324, 27.7172];

  return {
    name: hospital.name,
    phone: hospital.phone,
    address: hospital.address,
    status: hospital.status,
    capacity: String(hospital.capacity),
    availableBeds: String(hospital.availableBeds),
    specialization: hospital.specialization?.join(", ") ?? "",
    longitude: String(coordinates[0]),
    latitude: String(coordinates[1]),
  };
}

function parseHospitalForm(form: HospitalFormState) {
  const capacity = Number(form.capacity);
  const availableBeds = Number(form.availableBeds);
  const longitude = Number(form.longitude);
  const latitude = Number(form.latitude);
  const specialization = form.specialization
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!form.name.trim()) {
    throw new Error("Hospital name is required");
  }

  if (!form.phone.trim()) {
    throw new Error("Phone is required");
  }

  if (!form.address.trim()) {
    throw new Error("Address is required");
  }

  if (!Number.isInteger(capacity) || capacity < 0) {
    throw new Error("Capacity must be a whole number greater than or equal to 0");
  }

  if (!Number.isInteger(availableBeds) || availableBeds < 0) {
    throw new Error("Available beds must be a whole number greater than or equal to 0");
  }

  if (availableBeds > capacity) {
    throw new Error("Available beds cannot exceed capacity");
  }

  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    throw new Error("Location must use valid longitude and latitude");
  }

  return {
    name: form.name.trim(),
    phone: form.phone.trim(),
    address: form.address.trim(),
    status: form.status,
    capacity,
    availableBeds,
    specialization,
    coordinates: [longitude, latitude] as [number, number],
  };
}

export default function AdminHospitalsPage() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status");
  const initialHasAvailableBeds = searchParams.get("hasAvailableBeds");
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [status, setStatus] = useState<"all" | HospitalStatus>(
    hospitalStatuses.includes(initialStatus as HospitalStatus)
      ? (initialStatus as HospitalStatus)
      : "all",
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof pageSizeOptions)[number]>(
    10,
  );
  const [expandedMapHospitalId, setExpandedMapHospitalId] = useState<
    string | null
  >(null);
  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null);
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(
    null,
  );
  const [form, setForm] = useState<HospitalFormState>(emptyForm);

  const filters = useMemo(
    () => ({
      search: search.trim() || undefined,
      status: status === "all" ? undefined : status,
      hasAvailableBeds:
        initialHasAvailableBeds === "true"
          ? true
          : initialHasAvailableBeds === "false"
            ? false
            : undefined,
      page,
      limit: pageSize,
    }),
    [initialHasAvailableBeds, page, pageSize, search, status],
  );

  const hospitalsQuery = useHospitals(filters);
  const createHospital = useCreateHospital();
  const updateHospital = useUpdateHospital();
  const deleteHospital = useDeleteHospital();
  const hospitals = hospitalsQuery.data?.data ?? [];
  const pagination = hospitalsQuery.data?.meta;
  const totalItems = pagination?.total ?? 0;
  const totalPages = pagination?.totalPages ?? 1;
  const pageStart = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, totalItems);
  const isMutating =
    createHospital.isPending ||
    updateHospital.isPending ||
    deleteHospital.isPending;

  useEffect(() => {
    setPage(1);
  }, [pageSize, search, status]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  function openCreateDialog() {
    setSelectedHospital(null);
    setForm(emptyForm);
    setDialogMode("create");
  }

  function openViewDialog(hospital: Hospital) {
    setSelectedHospital(hospital);
    setDialogMode("view");
  }

  function openEditDialog(hospital: Hospital) {
    setSelectedHospital(hospital);
    setForm(getFormFromHospital(hospital));
    setDialogMode("edit");
  }

  function openDeleteDialog(hospital: Hospital) {
    setSelectedHospital(hospital);
    setDialogMode("delete");
  }

  function closeDialog() {
    setDialogMode(null);
    setSelectedHospital(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const payload = parseHospitalForm(form);

      if (dialogMode === "create") {
        await createHospital.mutateAsync(payload);
        toast.success("Hospital created");
      }

      if (dialogMode === "edit" && selectedHospital) {
        await updateHospital.mutateAsync({
          hospitalId: getHospitalId(selectedHospital),
          payload,
        });
        toast.success("Hospital updated");
      }

      closeDialog();
    } catch (error) {
      toast.error(getFriendlyApiErrorMessage(error));
    }
  }

  async function handleDelete() {
    if (!selectedHospital) {
      return;
    }

    try {
      await deleteHospital.mutateAsync(getHospitalId(selectedHospital));
      toast.success("Hospital deleted");
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
            <Building2 className="size-3.5" />
            Hospital management
          </Badge>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            Hospitals
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Manage hospital capacity, availability, contact details, and
            dispatch coordinates.
          </p>
        </div>
        <Button
          className="bg-blue-600 text-white hover:bg-blue-700"
          onClick={openCreateDialog}
          type="button"
        >
          <Plus className="size-4" />
          Create hospital
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
                  placeholder="Search hospital, phone, address, or specialization"
                  value={search}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  className={
                    status === "all"
                      ? "bg-slate-900 text-white hover:bg-slate-800"
                      : "bg-white"
                  }
                  onClick={() => setStatus("all")}
                  size="sm"
                  type="button"
                  variant={status === "all" ? "default" : "outline"}
                >
                  All statuses
                </Button>
                {hospitalStatuses.map((item) => (
                  <Button
                    className={status === item ? getStatusClass(item) : "bg-white"}
                    key={item}
                    onClick={() => setStatus(item)}
                    size="sm"
                    type="button"
                    variant={status === item ? "default" : "outline"}
                  >
                    {formatStatus(item)}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {hospitalsQuery.isLoading ? (
            <div className="space-y-3">
              <div className="h-10 rounded bg-muted" />
              <div className="h-10 rounded bg-muted" />
              <div className="h-10 rounded bg-muted" />
            </div>
          ) : null}

          {hospitalsQuery.isError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="font-medium text-red-800">
                Failed to load hospitals
              </p>
              <p className="mt-1 text-sm text-red-700">
                {getFriendlyApiErrorMessage(hospitalsQuery.error)}
              </p>
            </div>
          ) : null}

          {!hospitalsQuery.isLoading &&
          !hospitalsQuery.isError &&
          hospitals.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border p-10 text-center">
              <Building2 className="size-10 text-muted-foreground" />
              <h2 className="mt-4 text-lg font-semibold">
                No hospitals found
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Create a hospital or adjust the filters.
              </p>
            </div>
          ) : null}

          {hospitals.length > 0 ? (
            <div className="overflow-x-auto">
              <Table className="min-w-[980px] table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[240px]">Hospital Name</TableHead>
                    <TableHead className="w-[160px]">Phone</TableHead>
                    <TableHead className="w-[130px]">Status</TableHead>
                    <TableHead className="w-[170px]">Available Beds</TableHead>
                    <TableHead className="w-[220px]">Location</TableHead>
                    <TableHead className="w-[90px] text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hospitals.map((hospital) => {
                    const hospitalId = getHospitalId(hospital);
                    const coordinates = hospital.location?.coordinates;
                    const hasCoordinates = isValidCoordinates(coordinates);
                    const mapIsOpen = expandedMapHospitalId === hospitalId;

                    return (
                    <Fragment key={hospitalId}>
                    <TableRow>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {hospital.name}
                          </p>
                          <p className="truncate text-sm text-muted-foreground">
                            {hospital.address}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-2 truncate text-sm">
                          <Phone className="size-3.5 text-muted-foreground" />
                          {hospital.phone}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`w-24 justify-center ${getStatusClass(
                            hospital.status,
                          )}`}
                        >
                          {formatStatus(hospital.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-2 text-sm">
                          <Bed className="size-3.5 text-muted-foreground" />
                          {hospital.availableBeds} / {hospital.capacity}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex min-w-0 items-center gap-2">
                          <LocationDisplay
                            address={hospital.address}
                            coordinates={coordinates}
                            label="Hospital location"
                            mapMode="none"
                            tone="muted"
                          />
                          {hasCoordinates ? (
                            <Button
                              className="h-7 shrink-0 px-2 text-xs"
                              onClick={() =>
                                setExpandedMapHospitalId((current) =>
                                  current === hospitalId ? null : hospitalId,
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
                            onClick={() => openViewDialog(hospital)}
                          >
                            <Eye className="size-4" />
                            View details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => openEditDialog(hospital)}
                          >
                            <Edit3 className="size-4" />
                            Edit hospital
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => openDeleteDialog(hospital)}
                          >
                            <Trash2 className="size-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    {hasCoordinates && mapIsOpen ? (
                      <TableRow>
                        <TableCell className="bg-muted/20 p-4" colSpan={6}>
                          <LocationPreviewMap coordinates={coordinates} iconType="hospital" />
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
                  Showing {pageStart}-{pageEnd} of {totalItems} hospitals
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

      <HospitalDialog
        form={form}
        hospital={selectedHospital}
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

function HospitalDialog({
  form,
  hospital,
  isMutating,
  mode,
  onClose,
  onDelete,
  onFormChange,
  onSubmit,
}: {
  form: HospitalFormState;
  hospital: Hospital | null;
  isMutating: boolean;
  mode: DialogMode | null;
  onClose: () => void;
  onDelete: () => void;
  onFormChange: (form: HospitalFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (!mode) {
    return null;
  }

  const title =
    mode === "create"
      ? "Create hospital"
      : mode === "edit"
        ? "Edit hospital"
        : mode === "delete"
          ? "Delete hospital"
          : "Hospital details";

  return (
    <Dialog open={!!mode} onOpenChange={(open) => !open && onClose()}>
      <DialogClose onClick={onClose} />
      <DialogHeader>
        <div className="flex items-start gap-3 pr-10">
          <div className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <Building2 className="size-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {hospital?.name ?? "Add a hospital to the dispatch network."}
            </p>
          </div>
        </div>
      </DialogHeader>
      <DialogContent className="space-y-5">
        {mode === "view" && hospital ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Detail label="Hospital Name" value={hospital.name} />
              <Detail label="Phone" value={hospital.phone} />
              <Detail label="Address" value={hospital.address} />
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge className={`mt-1 ${getStatusClass(hospital.status)}`}>
                  {formatStatus(hospital.status)}
                </Badge>
              </div>
              <Detail
                label="Available Beds / Capacity"
                value={`${hospital.availableBeds} / ${hospital.capacity}`}
              />
              <Detail label="Location" value={formatLocation(hospital)} />
            </div>
            <Detail
              label="Specialization"
              value={
                hospital.specialization?.length
                  ? hospital.specialization.join(", ")
                  : "Not specified"
              }
            />
          </div>
        ) : null}

        {mode === "create" || mode === "edit" ? (
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Hospital Name">
                <Input
                  onChange={(event) =>
                    onFormChange({ ...form, name: event.target.value })
                  }
                  value={form.name}
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
              <Field label="Address">
                <Input
                  onChange={(event) =>
                    onFormChange({ ...form, address: event.target.value })
                  }
                  value={form.address}
                />
              </Field>
              <Field label="Status">
                <select
                title="Hospital-Status"
                  className="h-8 w-full rounded-lg border bg-background px-3 text-sm disabled:opacity-60"
                  onChange={(event) =>
                    onFormChange({
                      ...form,
                      status: event.target.value as HospitalStatus,
                    })
                  }
                  value={form.status}
                >
                  {hospitalStatuses.map((item) => (
                    <option key={item} value={item}>
                      {formatStatus(item)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Capacity">
                <Input
                  min={0}
                  onChange={(event) =>
                    onFormChange({ ...form, capacity: event.target.value })
                  }
                  type="number"
                  value={form.capacity}
                />
              </Field>
              <Field label="Available Beds">
                <Input
                  min={0}
                  onChange={(event) =>
                    onFormChange({
                      ...form,
                      availableBeds: event.target.value,
                    })
                  }
                  type="number"
                  value={form.availableBeds}
                />
              </Field>
            </div>
            <LocationInput
              address={form.address}
              latitude={form.latitude}
              longitude={form.longitude}
              onCoordinatesChange={(coordinates) =>
                onFormChange({ ...form, ...coordinates })
              }
              onLatitudeChange={(latitude) => onFormChange({ ...form, latitude })}
              onLongitudeChange={(longitude) =>
                onFormChange({ ...form, longitude })
              }
              title="Hospital location"
              iconType="hospital"
            />
            <Field label="Specialization">
              <Input
                onChange={(event) =>
                  onFormChange({ ...form, specialization: event.target.value })
                }
                placeholder="Trauma, Emergency, Cardiology"
                value={form.specialization}
              />
            </Field>
            <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
              Coordinates are sent to the backend as [longitude, latitude].
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
                disabled={isMutating}
                type="submit"
              >
                {mode === "create" ? "Create" : "Save changes"}
              </Button>
            </div>
          </form>
        ) : null}

        {mode === "delete" && hospital ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              Delete {hospital.name}?
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
