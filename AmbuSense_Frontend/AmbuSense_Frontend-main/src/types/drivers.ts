import type { AuthUser, UploadedMedia } from "./auth";
import type { Nullable } from "./common";

export type DriverAmbulance = {
  id: string;
  ambulanceCode: string;
  driverName: string;
  phone: string;
  status: string;
  currentLocation?: {
    type: "Point";
    coordinates: [number, number];
  };
  isActive: boolean;
  assignedAt?: Nullable<string>;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminDriver = {
  id: string;
  user: AuthUser;
  documentType: Nullable<string>;
  documentImageId: Nullable<string>;
  documentImage: Nullable<UploadedMedia>;
  assignedAmbulance: Nullable<DriverAmbulance>;
  isVerified: boolean;
  verificationNote: Nullable<string>;
  createdAt?: string;
  updatedAt?: string;
};

export type VerifyDriverPayload = {
  isVerified: boolean;
  verificationNote?: string;
};

export type DriverFilters = {
  isVerified?: boolean;
  page?: number;
  limit?: number;
};

export type PaginatedDriversResponse = {
  data: AdminDriver[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};
