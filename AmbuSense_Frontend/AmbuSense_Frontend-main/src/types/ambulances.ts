import type { Nullable } from "./common";

export const ambulanceStatuses = [
  "offline",
  "available",
  "assigned",
  "en-route",
  "at-patient",
  "transporting",
  "at-hospital",
  "completed",
] as const;

export type AmbulanceStatus = (typeof ambulanceStatuses)[number];

export type AmbulanceLocation = {
  type: "Point";
  coordinates: [number, number];
};

export type Ambulance = {
  _id?: string;
  id?: string;
  ambulanceCode: string;
  driverName: string;
  phone: string;
  status: AmbulanceStatus;
  currentLocation: AmbulanceLocation;
  locationName?: string;
  isActive: boolean;
  assignedAt?: Nullable<string>;
  reachedPatientAt?: Nullable<string>;
  transportStartedAt?: Nullable<string>;
  reachedHospitalAt?: Nullable<string>;
  completedAt?: Nullable<string>;
  createdAt?: string;
  updatedAt?: string;
};

export type AmbulanceFilters = {
  search?: string;
  status?: AmbulanceStatus;
  isActive?: boolean;
  page?: number;
  limit?: number;
};

export type PaginatedAmbulancesResponse = {
  data: Ambulance[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type AmbulanceFormPayload = {
  ambulanceCode: string;
  driverName: string;
  phone: string;
  status?: AmbulanceStatus;
  coordinates: [number, number];
  locationName: string;
  isActive?: boolean;
};

export type UpdateAmbulancePayload = Partial<
  Pick<
    AmbulanceFormPayload,
    "ambulanceCode" | "driverName" | "phone" | "coordinates" | "locationName"
  >
>;
