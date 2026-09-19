export type AmbulanceStatus =
  | "offline"
  | "available"
  | "assigned"
  | "en-route"
  | "at-patient"
  | "transporting"
  | "at-hospital"
  | "completed";

export type EmergencyRequestStatus =
  | "pending"
  | "assigned"
  | "en-route"
  | "at-patient"
  | "transporting"
  | "at-hospital"
  | "completed"
  | "cancelled";

export type DashboardSummary = {
  emergencyRequests: {
    total: number;
    active: number;
    byStatus: Record<EmergencyRequestStatus, number>;
  };
  ambulances: {
    total: number;
    active: number;
    byStatus: Record<AmbulanceStatus, number>;
  };
  hospitals: {
    total: number;
    available: number;
    withAvailableBeds: number;
  };
};
