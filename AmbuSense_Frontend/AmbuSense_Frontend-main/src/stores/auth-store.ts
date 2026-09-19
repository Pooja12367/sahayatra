import { create } from "zustand";
import type {
  AuthMeResponse,
  AuthProfile,
  AuthUser,
  UserRole,
} from "@/types/auth";
import type { Nullable } from "@/types/common";

type AuthState = {
  user: Nullable<AuthUser>;
  role: Nullable<UserRole>;
  profile: Nullable<AuthProfile>;
  isAuthenticated: boolean;
  setAuth: (response: AuthMeResponse) => void;
  clearAuth: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  role: null,
  profile: null,
  isAuthenticated: false,
  setAuth: ({ user, profile }) =>
    set({
      user,
      role: user.role,
      profile,
      isAuthenticated: true,
    }),
  clearAuth: () =>
    set({
      user: null,
      role: null,
      profile: null,
      isAuthenticated: false,
    }),
}));
