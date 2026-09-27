"use client";

import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Eye,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
  XCircle,
} from "lucide-react";
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";
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
import {
  getUserId,
  useCreateStaffUser,
  useDeleteUser,
  useUpdateUserStatus,
  useUsers,
} from "@/hooks/use-users";
import { getFriendlyApiErrorMessage } from "@/lib/api";
import {
  staffUserRoles,
  userRoles,
  type AdminUser,
  type StaffUserPayload,
  type StaffUserRole,
  type UserRole,
} from "@/types/users";

type DialogMode = "view" | "create" | "delete" | null;

type StaffFormState = StaffUserPayload;

const emptyForm: StaffFormState = {
  fullName: "",
  email: "",
  phone: "",
  password: "",
  role: "dispatcher",
};

const pageSizeOptions = [5, 10, 20] as const;

function getRoleClass(role: UserRole) {
  switch (role) {
    case "admin":
      return "border-red-200 bg-red-50 text-red-700";
    case "dispatcher":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "driver":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "patient":
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function formatRole(role: UserRole) {
  return role[0].toUpperCase() + role.slice(1);
}

function formatDate(value: string | undefined | null) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function parseStaffForm(form: StaffFormState): StaffUserPayload {
  if (!form.fullName.trim()) {
    throw new Error("Full name is required");
  }

  if (!form.email.trim()) {
    throw new Error("Email is required");
  }

  if (!form.phone.trim()) {
    throw new Error("Phone is required");
  }

  if (form.password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  return {
    fullName: form.fullName.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
    password: form.password,
    role: form.role,
  };
}

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<"all" | UserRole>("all");
  const [active, setActive] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof pageSizeOptions)[number]>(
    10,
  );
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [form, setForm] = useState<StaffFormState>(emptyForm);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  const filters = useMemo(
    () => ({
      search: search.trim() || undefined,
      role: role === "all" ? undefined : role,
      isActive:
        active === "all" ? undefined : active === "active" ? true : false,
      page,
      limit: pageSize,
    }),
    [active, page, pageSize, role, search],
  );

  const usersQuery = useUsers(filters);
  const createStaff = useCreateStaffUser();
  const updateStatus = useUpdateUserStatus();
  const deleteUser = useDeleteUser();
  const users = usersQuery.data?.data ?? [];
  const pagination = usersQuery.data?.meta;
  const totalItems = pagination?.total ?? 0;
  const totalPages = pagination?.totalPages ?? 1;
  const pageStart = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, totalItems);
  const isMutating =
    createStaff.isPending || updateStatus.isPending || deleteUser.isPending;

  useEffect(() => {
    setPage(1);
  }, [active, pageSize, role, search]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  function openCreateDialog() {
    setSelectedUser(null);
    setForm(emptyForm);
    setDialogMode("create");
  }

  function openViewDialog(user: AdminUser) {
    setSelectedUser(user);
    setDialogMode("view");
  }

  function openDeleteDialog(user: AdminUser) {
    setSelectedUser(user);
    setDialogMode("delete");
  }

  function closeDialog() {
    setDialogMode(null);
    setSelectedUser(null);
    setForm(emptyForm);
  }

  async function handleCreateStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await createStaff.mutateAsync(parseStaffForm(form));
      setForm(emptyForm);
      closeDialog();
      toast.success("Staff user created successfully");
    } catch (error) {
      toast.error(getFriendlyApiErrorMessage(error));
    }
  }

  async function handleStatusChange(user: AdminUser, isActive: boolean) {
    try {
      await updateStatus.mutateAsync({
        userId: getUserId(user),
        payload: { isActive },
      });
      toast.success(isActive ? "User activated" : "User deactivated");
    } catch (error) {
      toast.error(getFriendlyApiErrorMessage(error));
    }
  }

  async function handleDelete() {
    if (!selectedUser) {
      return;
    }

    try {
      await deleteUser.mutateAsync(getUserId(selectedUser));
      toast.success("User deleted");
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
            <Users className="size-3.5" />
            User management
          </Badge>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            Users
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Manage staff and patient accounts, activation state, and role
            visibility from one admin table.
          </p>
        </div>
        <Button
          className="bg-blue-600 text-white hover:bg-blue-700"
          onClick={openCreateDialog}
          type="button"
        >
          <Plus className="size-4" />
          Create staff user
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
                  placeholder="Search name, email, or phone"
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
                  role === "all"
                    ? "bg-slate-900 text-white hover:bg-slate-800"
                    : "bg-white"
                }
                onClick={() => setRole("all")}
                size="sm"
                style={{ minWidth: "110px" }}
                type="button"
                variant={role === "all" ? "default" : "outline"}
              >
                All roles
              </Button>
              {userRoles.map((item) => (
                <Button
                  className={role === item ? getRoleClass(item) : "bg-white"}
                  key={item}
                  onClick={() => setRole(item)}
                  size="sm"
                  style={{ minWidth: "110px" }}
                  type="button"
                  variant={role === item ? "default" : "outline"}
                >
                  {formatRole(item)}
                </Button>
              ))}
            </div>
          </div>

          {usersQuery.isLoading ? (
            <div className="space-y-3">
              <div className="h-10 rounded bg-muted" />
              <div className="h-10 rounded bg-muted" />
              <div className="h-10 rounded bg-muted" />
            </div>
          ) : null}

          {usersQuery.isError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="font-medium text-red-800">Failed to load users</p>
              <p className="mt-1 text-sm text-red-700">
                {getFriendlyApiErrorMessage(usersQuery.error)}
              </p>
            </div>
          ) : null}

          {!usersQuery.isLoading && !usersQuery.isError && users.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border p-10 text-center">
              <Users className="size-10 text-muted-foreground" />
              <h2 className="mt-4 text-lg font-semibold">No users found</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Create a staff user or adjust the filters.
              </p>
            </div>
          ) : null}

          {users.length > 0 ? (
            <div className="overflow-x-auto">
              <Table className="min-w-[900px] table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[280px]">User</TableHead>
                    <TableHead className="w-[140px]">Role</TableHead>
                    <TableHead className="w-[140px]">Active Status</TableHead>
                    <TableHead className="w-[160px]">Created Date</TableHead>
                    <TableHead className="w-[90px] text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={getUserId(user)}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                            <UserRound className="size-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {user.fullName}
                            </p>
                            <p className="flex items-center gap-1 truncate text-sm text-muted-foreground">
                              <Mail className="size-3.5" />
                              {user.email}
                            </p>
                            <p className="flex items-center gap-1 truncate text-sm text-muted-foreground">
                              <Phone className="size-3.5" />
                              {user.phone}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getRoleClass(user.role)}>
                          {formatRole(user.role)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            user.isActive
                              ? "border-blue-200 bg-blue-50 text-blue-700"
                              : "border-slate-200 bg-slate-50 text-slate-700"
                          }
                        >
                          {user.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(user.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu
                          trigger={
                            <span className="inline-flex size-8 items-center justify-center rounded-lg border bg-background transition hover:bg-muted">
                              <MoreHorizontal className="size-4" />
                            </span>
                          }
                        >
                          <DropdownMenuItem onClick={() => openViewDialog(user)}>
                            <Eye className="size-4" />
                            View details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={isMutating}
                            onClick={() => handleStatusChange(user, !user.isActive)}
                          >
                            {user.isActive ? (
                              <XCircle className="size-4" />
                            ) : (
                              <CheckCircle2 className="size-4" />
                            )}
                            {user.isActive ? "Deactivate" : "Activate"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={isMutating}
                            onClick={() => openDeleteDialog(user)}
                          >
                            <Trash2 className="size-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex flex-col gap-3 border-t px-1 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {pageStart}-{pageEnd} of {totalItems} users
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

      <UserDialog
        form={form}
        isMutating={isMutating}
        mode={dialogMode}
        onClose={closeDialog}
        onDelete={handleDelete}
        onFormChange={setForm}
        onSubmit={handleCreateStaff}
        user={selectedUser}
      />
    </main>
  );
}

function UserDialog({
  form,
  isMutating,
  mode,
  onClose,
  onDelete,
  onFormChange,
  onSubmit,
  user,
}: {
  form: StaffFormState;
  isMutating: boolean;
  mode: DialogMode;
  onClose: () => void;
  onDelete: () => void;
  onFormChange: (form: StaffFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  user: AdminUser | null;
}) {
  if (!mode) {
    return null;
  }

  const title =
    mode === "create"
      ? "Create staff user"
      : mode === "delete"
        ? "Delete user"
        : "User details";

  return (
    <Dialog open={!!mode} onOpenChange={(open) => !open && onClose()}>
      <DialogClose onClick={onClose} />
      <DialogHeader>
        <div className="flex items-start gap-3 pr-10">
          <div className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {user?.email ?? "Staff users can be admins, dispatchers, or drivers."}
            </p>
          </div>
        </div>
      </DialogHeader>
      <DialogContent className="space-y-5">
        {mode === "view" && user ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Detail label="Full Name" value={user.fullName} />
              <Detail label="Email" value={user.email} />
              <Detail label="Phone" value={user.phone} />
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Role</p>
                <Badge className={`mt-1 ${getRoleClass(user.role)}`}>
                  {formatRole(user.role)}
                </Badge>
              </div>
              <Detail
                label="Active Status"
                value={user.isActive ? "Active" : "Inactive"}
              />
              <Detail label="Created" value={formatDate(user.createdAt)} />
              <Detail
                label="Last Login"
                value={formatDate(user.lastLoginAt)}
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={onClose} type="button" variant="outline">
                Close
              </Button>
            </div>
          </div>
        ) : null}

        {mode === "create" ? (
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full Name">
                <Input
                  onChange={(event) =>
                    onFormChange({ ...form, fullName: event.target.value })
                  }
                  value={form.fullName}
                />
              </Field>
              <Field label="Email">
                <Input
                  onChange={(event) =>
                    onFormChange({ ...form, email: event.target.value })
                  }
                  type="email"
                  value={form.email}
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
              <Field label="Role">
                <select
                title="Staff-role"
                  className="h-8 w-full rounded-lg border bg-background px-3 text-sm disabled:opacity-60"
                  onChange={(event) =>
                    onFormChange({
                      ...form,
                      role: event.target.value as StaffUserRole,
                    })
                  }
                  value={form.role}
                >
                  {staffUserRoles.map((role) => (
                    <option key={role} value={role}>
                      {formatRole(role)}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="sm:col-span-2">
                <Field label="Password">
                  <Input
                    minLength={8}
                    onChange={(event) =>
                      onFormChange({ ...form, password: event.target.value })
                    }
                    type="password"
                    value={form.password}
                  />
                </Field>
              </div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
              Patient accounts are intentionally excluded from this admin staff
              form.
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
                Create staff user
              </Button>
            </div>
          </form>
        ) : null}

        {mode === "delete" && user ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              Delete {user.fullName}? Are you sure you want to delete the user?
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
