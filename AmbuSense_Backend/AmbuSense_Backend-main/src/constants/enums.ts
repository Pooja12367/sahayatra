export enum AmbulanceStatus {
  OFFLINE = 'offline',
  AVAILABLE = 'available',
  ASSIGNED = 'assigned',
  EN_ROUTE = 'en-route',
  AT_PATIENT = 'at-patient',
  TRANSPORTING = 'transporting',
  AT_HOSPITAL = 'at-hospital',
  COMPLETED = 'completed',
}

export enum EmergencyRequestStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  EN_ROUTE = 'en-route',
  AT_PATIENT = 'at-patient',
  TRANSPORTING = 'transporting',
  AT_HOSPITAL = 'at-hospital',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum HospitalAssignmentTechnique {
  USER_CHOICE = 'user-choice',
  SYSTEM_AUTO = 'system-auto',
  ADMIN_OVERRIDE = 'admin-override',
}

export enum UserRole {
  ADMIN = 'admin',
  DISPATCHER = 'dispatcher',
  DRIVER = 'driver',
  PATIENT = 'patient',
}
