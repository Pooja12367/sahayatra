import type { Nullable } from "./common";

export const userRoles = ["admin", "dispatcher", "driver", "patient"] as const;
export const staffUserRoles = ["admin", "dispatcher", "driver"] as const;

export type UserRole = (typeof userRoles)[number];
export type StaffUserRole = (typeof staffUserRoles)[number];

export type AdminUser = {
  _id?: string;
  id?: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt?: Nullable<string>;
  createdAt?: string;
  updatedAt?: string;
};

export type StaffUserPayload = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  role: StaffUserRole;
};

export type UserFilters = {
  search?: string;
  role?: UserRole;
  isActive?: boolean;
  page?: number;
  limit?: number;
};

export type PaginatedUsersResponse = {
  data: AdminUser[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type UpdateUserStatusPayload = {
  isActive: boolean;
};

export type CreateStaffUserResponse = {
  user: AdminUser;
  profile?: Nullable<unknown>;
};
