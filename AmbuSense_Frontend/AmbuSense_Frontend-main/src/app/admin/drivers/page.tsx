"use client";

import {
  Ambulance,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  FileImage,
  Phone,
  ShieldCheck,
  Trash2,
  UserRound,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LocationDisplay } from "@/components/location/location-display";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useDeleteDriver,
  useDrivers,
  useVerifyDriver,
} from "@/hooks/use-drivers";
import { useEmergencyRequests } from "@/hooks/use-emergency-requests";
import { getFriendlyApiErrorMessage } from "@/lib/api";
import {
  acquireSocketConnection,
  releaseSocketConnection,
  socket,
} from "@/lib/socket";
import type { AdminDriver } from "@/types/drivers";
import type { EmergencyRequestStatus } from "@/types/emergency-requests";

const pageSizeOptions = [5, 10, 20] as const;

function resolveMediaUrl(url: string | null | undefined) {
  if (!url) {
    return null;
  }

  if (url.startsWith("http")) {
    return url;
  }

  const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL || "https://sahayatra-backend-fa4y.onrender.com/api"
  const origin = apiBaseUrl.replace(/\/api\/?$/, "");

  return `${origin}${url}`;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatDate(value: string | undefined) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function getDriverStatus(driver: AdminDriver) {
  if (driver.isVerified) {
    return {
      label: "Verified",
      className: "border-green-200 bg-green-50 text-green-700",
      Icon: CheckCircle2,
    };
  }

  if (driver.documentImageId && driver.verificationNote) {
    return {
      label: "Rejected",
      className: "border-red-200 bg-red-50 text-red-700",
      Icon: XCircle,
    };
  }

  if (driver.documentImageId) {
    return {
      label: "Pending",
      className: "border-amber-200 bg-amber-50 text-amber-700",
      Icon: Clock3,
    };
  }

  return {
    label: "Not Uploaded",
    className: "border-slate-200 bg-slate-50 text-slate-700",
    Icon: FileImage,
  };
}

function getAmbulanceStatusClass(status: string | undefined) {
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
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function formatStatusLabel(value: string | undefined) {
  if (!value) {
    return "Not assigned";
  }

  if (value === "available") {
    return "Online";
  }

  if (value === "offline") {
    return "Offline";
  }

  return value
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

export default function AdminDriversPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof pageSizeOptions)[number]>(
    10,
  );
  const filters = useMemo(
    () => ({
      page,
      limit: pageSize,
    }),
    [page, pageSize],
  );
  const { data, isLoading, isError, error } = useDrivers(filters);
  const verifyDriver = useVerifyDriver();
  const deleteDriver = useDeleteDriver();
  const [selectedDriver, setSelectedDriver] = useState<AdminDriver | null>(
    null,
  );
  const [driverToDelete, setDriverToDelete] = useState<AdminDriver | null>(
    null,
  );
  const drivers = data?.data ?? [];
  const pagination = data?.meta;
  const totalItems = pagination?.total ?? 0;
  const totalPages = pagination?.totalPages ?? 1;
  const pageStart = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, totalItems);

  useEffect(() => {
    const token = acquireSocketConnection();
    const invalidateDrivers = () => {
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
    };

    socket.on("ambulance.updated", invalidateDrivers);
    socket.on("ambulance.status.updated", invalidateDrivers);

    return () => {
      socket.off("ambulance.updated", invalidateDrivers);
      socket.off("ambulance.status.updated", invalidateDrivers);
      releaseSocketConnection(token);
    };
  }, [queryClient]);

  useEffect(() => {
    setPage(1);
  }, [pageSize]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  async function handleVerify(driverId: string, isVerified: boolean) {
    try {
      await verifyDriver.mutateAsync({
        driverId,
        payload: {
          isVerified,
          verificationNote: isVerified ? undefined : "Rejected by admin",
        },
      });
      toast.success(isVerified ? "Driver approved" : "Driver rejected");
    } catch (error) {
      toast.error(getFriendlyApiErrorMessage(error));
    }
  }

  async function handleDeleteDriver() {
    if (!driverToDelete) {
      return;
    }

    try {
      await deleteDriver.mutateAsync(driverToDelete.id);
      toast.success("Driver deleted successfully");
      setDriverToDelete(null);
      if (selectedDriver?.id === driverToDelete.id) {
        setSelectedDriver(null);
      }
    } catch (error) {
      toast.error(getFriendlyApiErrorMessage(error));
    }
  }

  if (isLoading) {
    return (
      <main className="space-y-6 p-4 sm:p-6">
        <Card>
          <CardContent className="space-y-3 p-6">
            <div className="h-4 w-48 rounded bg-muted" />
            <div className="h-10 rounded bg-muted" />
            <div className="h-10 rounded bg-muted" />
            <div className="h-10 rounded bg-muted" />
          </CardContent>
        </Card>
      </main>
    );
  }

  if (isError) {
    return (
      <main className="p-4 sm:p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <p className="font-medium text-red-800">
              Failed to load drivers
            </p>
            <p className="mt-1 text-sm text-red-700">
              {getFriendlyApiErrorMessage(error)}
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="space-y-6 p-4 sm:p-6">
      <section className="rounded-lg border border-blue-100/80 bg-white/90 p-6 shadow-xl shadow-blue-950/5 backdrop-blur">
        <Badge className="border-blue-200 bg-blue-50 text-blue-700">
          <ShieldCheck className="size-3.5" />
          Driver management
        </Badge>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
          Drivers
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Review driver documents, approve verified drivers, and track
          verification status from one table.
        </p>
      </section>

      <Card className="overflow-hidden bg-white/90">
        {drivers.length === 0 ? (
          <CardContent className="flex flex-col items-center justify-center p-10 text-center">
            <UserRound className="size-10 text-muted-foreground" />
            <h2 className="mt-4 text-lg font-semibold">No drivers found</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Public driver signups will appear here.
            </p>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Driver</TableHead>
                <TableHead>Assigned Ambulance</TableHead>
                <TableHead>Document Type</TableHead>
                <TableHead>Verification Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drivers.map((driver) => {
                const status = getDriverStatus(driver);
                const StatusIcon = status.Icon;

                return (
                  <TableRow key={driver.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>{getInitials(driver.user.fullName)}</Avatar>
                        <div>
                          <p className="font-medium">
                            {driver.user.fullName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {driver.user.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {driver.assignedAmbulance ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 font-medium">
                            <Ambulance className="size-4 text-blue-600" />
                            {driver.assignedAmbulance.ambulanceCode}
                          </div>
                          <Badge
                            className={getAmbulanceStatusClass(
                              driver.assignedAmbulance.status,
                            )}
                          >
                            {formatStatusLabel(
                              driver.assignedAmbulance.status,
                            )}
                          </Badge>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Ambulance className="size-4" />
                          Not assigned
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {driver.documentType ?? "Not uploaded"}
                    </TableCell>
                    <TableCell>
                      <Badge className={status.className}>
                        <StatusIcon className="size-3.5" />
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {formatDate(driver.updatedAt ?? driver.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1.5">
                        <Button
                          onClick={() => setSelectedDriver(driver)}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          <Eye className="size-3.5" />
                          View
                        </Button>
                        <Button
                          className="bg-blue-600 text-white hover:bg-blue-700"
                          disabled={
                            verifyDriver.isPending || !driver.documentImageId
                          }
                          onClick={() => handleVerify(driver.id, true)}
                          size="icon-sm"
                          title="Approve"
                          type="button"
                        >
                          <CheckCircle2 className="size-3.5" />
                        </Button>
                        <Button
                          disabled={verifyDriver.isPending}
                          onClick={() => handleVerify(driver.id, false)}
                          size="icon-sm"
                          title="Reject"
                          type="button"
                          variant="destructive"
                        >
                          <XCircle className="size-3.5" />
                        </Button>
                        <Button
                          disabled={deleteDriver.isPending}
                          onClick={() => setDriverToDelete(driver)}
                          size="icon-sm"
                          title="Delete driver"
                          type="button"
                          variant="destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            </Table>
            <div className="flex flex-col gap-3 border-t px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {pageStart}-{pageEnd} of {totalItems} drivers
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <select
                title="page"
                  className="h-8 rounded-lg border bg-white px-3 text-sm font-medium shadow-sm"
                  onChange={(event) =>
                    setPageSize(
                      Number(event.target.value) as (typeof pageSizeOptions)[number],
                    )
                  }
                  value={pageSize}
                >
                  {pageSizeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
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
        )}
      </Card>

      <DriverDetailsDialog
        driver={selectedDriver}
        isMutating={verifyDriver.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedDriver(null);
          }
        }}
        onVerify={handleVerify}
        onDelete={setDriverToDelete}
      />
      <DeleteDriverDialog
        driver={driverToDelete}
        isDeleting={deleteDriver.isPending}
        onConfirm={handleDeleteDriver}
        onOpenChange={(open) => {
          if (!open) {
            setDriverToDelete(null);
          }
        }}
      />
    </main>
  );
}

function DriverDetailsDialog({
  driver,
  isMutating,
  onOpenChange,
  onDelete,
  onVerify,
}: {
  driver: AdminDriver | null;
  isMutating: boolean;
  onDelete: (driver: AdminDriver) => void;
  onOpenChange: (open: boolean) => void;
  onVerify: (driverId: string, isVerified: boolean) => void;
}) {
  if (!driver) {
    return null;
  }

  const status = getDriverStatus(driver);
  const StatusIcon = status.Icon;
  const previewUrl = resolveMediaUrl(driver.documentImage?.url);

  return (
    <Dialog open={!!driver} onOpenChange={onOpenChange}>
      <DialogClose onClick={() => onOpenChange(false)} />
      <DialogHeader>
        <div className="flex items-start gap-3 pr-10">
          <Avatar>{getInitials(driver.user.fullName)}</Avatar>
          <div>
            <h2 className="text-xl font-semibold">{driver.user.fullName}</h2>
            <p className="text-sm text-muted-foreground">
              {driver.user.email} � {driver.user.phone}
            </p>
          </div>
        </div>
      </DialogHeader>
      <DialogContent className="space-y-5 max-h-[85vh] overflow-y-auto">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">
              Assigned Ambulance
            </p>
            <p className="mt-1 text-sm font-medium">
              {driver.assignedAmbulance?.ambulanceCode ?? "Not assigned"}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Document</p>
            <p className="mt-1 text-sm font-medium">
              {driver.documentType ?? "Not uploaded"}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Status</p>
            <Badge className={`mt-1 ${status.className}`}>
              <StatusIcon className="size-3.5" />
              {status.label}
            </Badge>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Date</p>
            <p className="mt-1 text-sm font-medium">
              {formatDate(driver.updatedAt ?? driver.createdAt)}
            </p>
          </div>
        </div>

        <div className="rounded-xl border bg-blue-50/40 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Ambulance className="size-5 text-blue-700" />
              <div>
                <p className="text-sm font-semibold">Assigned ambulance</p>
                <p className="text-xs text-muted-foreground">
                  Matched using the driver&apos;s phone number.
                </p>
              </div>
            </div>
            {driver.assignedAmbulance ? (
              <Badge
                className={getAmbulanceStatusClass(
                  driver.assignedAmbulance.status,
                )}
              >
                {formatStatusLabel(driver.assignedAmbulance.status)}
              </Badge>
            ) : null}
          </div>

          {driver.assignedAmbulance ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border bg-background p-3">
                <p className="text-xs text-muted-foreground">Ambulance code</p>
                <p className="mt-1 text-sm font-medium">
                  {driver.assignedAmbulance.ambulanceCode}
                </p>
              </div>
              <div className="rounded-lg border bg-background p-3">
                <p className="text-xs text-muted-foreground">
                  Ambulance driver
                </p>
                <p className="mt-1 text-sm font-medium">
                  {driver.assignedAmbulance.driverName}
                </p>
              </div>
              <div className="rounded-lg border bg-background p-3">
                <p className="text-xs text-muted-foreground">Ambulance phone</p>
                <p className="mt-1 flex items-center gap-2 text-sm font-medium">
                  <Phone className="size-3.5 text-muted-foreground" />
                  {driver.assignedAmbulance.phone}
                </p>
              </div>
              <div className="rounded-lg border bg-background p-3">
                <p className="text-xs text-muted-foreground">Active state</p>
                <p className="mt-1 text-sm font-medium">
                  {driver.assignedAmbulance.isActive ? "Active" : "Inactive"}
                </p>
              </div>
              {driver.assignedAmbulance.currentLocation ? (
                <div className="rounded-lg border bg-background p-3 sm:col-span-2">
                  <p className="text-xs text-muted-foreground">
                    Current location
                  </p>
                  <div className="mt-1 font-medium">
                    <LocationDisplay
                      coordinates={
                        driver.assignedAmbulance.currentLocation.coordinates
                      }
                      label="Ambulance location"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 rounded-lg border bg-background p-3 text-sm text-muted-foreground">
              No ambulance is currently linked to this driver. Add or update an
              ambulance with the same phone number to connect it.
            </div>
          )}
        </div>

        {previewUrl ? (
          <div className="overflow-hidden rounded-lg border bg-slate-50">
            <img
              alt={`${driver.user.fullName} verification document`}
              className="max-h-[420px] w-full object-contain"
              src={previewUrl}
            />
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
            <FileImage className="size-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">
                {driver.documentImageId
                  ? "Document uploaded"
                  : "No document uploaded"}
              </p>
              <p className="text-sm text-muted-foreground">
                Raw document IDs are hidden. Preview appears when media URL is
                available.
              </p>
            </div>
          </div>
        )}

        {driver.verificationNote ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {driver.verificationNote}
          </div>
        ) : null}

        <div className="space-y-3 pt-2">
          <h3 className="text-lg font-medium">Ride History</h3>
          {driver.assignedAmbulance ? (
            <DriverHistoryTable ambulanceId={driver.assignedAmbulance.id} />
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground bg-slate-50/50">
              No ambulance assigned. Ride history is tracked per ambulance.
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button
            className="bg-blue-600 text-white hover:bg-blue-700"
            disabled={isMutating || !driver.documentImageId}
            onClick={() => onVerify(driver.id, true)}
          >
            Approve
          </Button>
          <Button
            disabled={isMutating}
            onClick={() => onVerify(driver.id, false)}
            variant="destructive"
          >
            Reject
          </Button>
          <Button
            onClick={() => onDelete(driver)}
            type="button"
            variant="destructive"
          >
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDriverDialog({
  driver,
  isDeleting,
  onConfirm,
  onOpenChange,
}: {
  driver: AdminDriver | null;
  isDeleting: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  if (!driver) {
    return null;
  }

  return (
    <Dialog open={!!driver} onOpenChange={onOpenChange}>
      <DialogClose onClick={() => onOpenChange(false)} />
      <DialogHeader>
        <div className="flex items-start gap-3 pr-10">
          <div className="flex size-12 items-center justify-center rounded-xl bg-red-50 text-red-600">
            <Trash2 className="size-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Delete driver?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              This will remove {driver.user.fullName}&apos;s driver profile and
              user account.
            </p>
          </div>
        </div>
      </DialogHeader>
      <DialogContent>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          This action cannot be undone. Assigned ambulances are not deleted.
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button
            disabled={isDeleting}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={isDeleting}
            onClick={onConfirm}
            type="button"
            variant="destructive"
          >
            {isDeleting ? "Deleting..." : "Delete driver"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
    default:
      return "border-amber-200 bg-amber-50 text-amber-700";
  }
}

function DriverHistoryTable({ ambulanceId }: { ambulanceId: string }) {
  const { data: requests, isLoading } = useEmergencyRequests({ assignedAmbulance: ambulanceId });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground p-4">Loading history...</div>;
  }

  if (!requests || requests.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground bg-slate-50/50">
        No rides found for this driver's ambulance.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <Table>
        <TableHeader className="bg-slate-50/50">
          <TableRow>
            <TableHead className="w-[120px]">Date</TableHead>
            <TableHead>Patient</TableHead>
            <TableHead>Hospital</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map(req => (
            <TableRow key={req.id ?? req._id}>
              <TableCell className="text-xs text-muted-foreground">
                {formatDate(req.createdAt)}
              </TableCell>
              <TableCell>
                <div className="font-medium">{req.patientName}</div>
                <div className="text-xs text-muted-foreground">{req.patientPhone}</div>
              </TableCell>
              <TableCell className="text-sm">
                {req.assignedHospital?.name ?? "N/A"}
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
  );
}
