import type { Nullable } from "./common";

export const hospitalStatuses = ["available", "busy", "offline"] as const;

export type HospitalStatus = (typeof hospitalStatuses)[number];

export type HospitalLocation = {
  type: "Point";
  coordinates: [number, number];
};

export type Hospital = {
  _id?: string;
  id?: string;
  name: string;
  phone: string;
  address: string;
  status: HospitalStatus;
  capacity: number;
  availableBeds: number;
  specialization?: string[];
  location?: Nullable<HospitalLocation>;
  createdAt?: string;
  updatedAt?: string;
};

export type HospitalFilters = {
  search?: string;
  status?: HospitalStatus;
  hasAvailableBeds?: boolean;
  page?: number;
  limit?: number;
};

export type PaginatedHospitalsResponse = {
  data: Hospital[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type HospitalFormPayload = {
  name: string;
  phone: string;
  address: string;
  status?: HospitalStatus;
  capacity: number;
  availableBeds: number;
  specialization?: string[];
  coordinates: [number, number];
};

export type UpdateHospitalPayload = Partial<HospitalFormPayload>;
