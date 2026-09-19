import type { Ambulance } from "./ambulances";
import type { Nullable } from "./common";
import type { Hospital } from "./hospitals";

export const emergencyRequestStatuses = [
  "pending",
  "assigned",
  "en-route",
  "at-patient",
  "transporting",
  "at-hospital",
  "completed",
  "cancelled",
] as const;

export type EmergencyRequestStatus =
  (typeof emergencyRequestStatuses)[number];

export const dispatchTechniques = [
  "system-auto",
  "user-choice",
  "admin-override",
] as const;

export type DispatchTechnique = (typeof dispatchTechniques)[number];

export type EmergencyRequestLocation = {
  type: "Point";
  coordinates: [number, number];
};

export type EmergencyRequest = {
  _id?: string;
  id?: string;
  patient?: Nullable<string>;
  patientName: string;
  patientPhone: string;
  pickupLocation: EmergencyRequestLocation;
  assignedAmbulance?: Nullable<Ambulance>;
  assignedHospital?: Nullable<Hospital>;
  hospitalAssignmentTechnique?: Nullable<DispatchTechnique>;
  status: EmergencyRequestStatus;
  notes?: string;
  assignedAt?: Nullable<string>;
  reachedPatientAt?: Nullable<string>;
  transportStartedAt?: Nullable<string>;
  reachedHospitalAt?: Nullable<string>;
  completedAt?: Nullable<string>;
  cancelledAt?: Nullable<string>;
  cancellationReason?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type EmergencyRequestFilters = {
  search?: string;
  status?: EmergencyRequestStatus;
  assignedAmbulance?: string;
  assignedHospital?: string;
  hospitalAssignmentTechnique?: DispatchTechnique;
};

export type DispatchEmergencyRequestPayload = {
  hospitalAssignmentTechnique: DispatchTechnique;
  ambulanceId?: string;
  hospitalId?: string;
  notes?: string;
};

export type UpdateEmergencyRequestStatusPayload = {
  status: EmergencyRequestStatus;
};

export type CancelEmergencyRequestPayload = {
  reason?: string;
};

export type CreateEmergencyRequestPayload = {
  patientName: string;
  patientPhone: string;
  coordinates: [number, number];
  notes?: string;
  assignedHospital?: string;
};
