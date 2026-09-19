import type { UserRole } from "@/types/auth";

const roleHomePaths: Record<UserRole, string> = {
  admin: "/admin",
  dispatcher: "/dispatcher",
  driver: "/driver",
  patient: "/patient",
};

export function getRoleHomePath(role: UserRole) {
  return roleHomePaths[role];
}
