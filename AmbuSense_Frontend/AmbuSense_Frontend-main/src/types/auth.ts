import type { Nullable } from "./common";

export type UserRole = "admin" | "dispatcher" | "driver" | "patient";

export type AuthUser = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: Nullable<string>;
};

export type AuthProfile = {
  id: string;
  user: string;
  documentType?: Nullable<string>;
  documentImageId?: Nullable<string>;
  isVerified?: boolean;
  verificationNote?: Nullable<string>;
};

export type AuthMeResponse = {
  user: AuthUser;
  profile: Nullable<AuthProfile>;
};

export type UploadedMedia = {
  id: string;
  originalName: string;
  fileName: string;
  mimeType: string;
  size: number;
  path: string;
  url: string;
  uploadedBy: string;
};

export type DriverDocumentUploadResponse = {
  media: UploadedMedia;
  driverProfile: AuthProfile;
};

export type LoginPayload = {
  email: string;
  password: string;
  rememberMe?: boolean;
};

export type SignupPayload = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  role: "patient" | "driver";
};

export type ForgotPasswordPayload = {
  email: string;
  redirectTo?: string;
};

export type ResetPasswordPayload = {
  token: string;
  newPassword: string;
};
