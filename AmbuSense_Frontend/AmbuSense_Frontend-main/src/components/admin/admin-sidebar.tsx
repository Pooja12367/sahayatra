"use client";

import {
  Ambulance,
  Building2,
  ClipboardList,
  Gauge,
  LogOut,
  Menu,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useLogout, useMe } from "@/hooks/use-auth";
import { getFriendlyApiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: Gauge },
  { href: "/admin/ambulances", label: "Ambulances", icon: Ambulance },
  { href: "/admin/hospitals", label: "Hospitals", icon: Building2 },
  {
    href: "/admin/requests",
    label: "Emergency Requests",
    icon: ClipboardList,
  },
  {
    href: "/admin/drivers",
    label: "Drivers",
    icon: ShieldCheck,
  },
  { href: "/admin/users", label: "Users", icon: Users },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useLogout();
  const { data } = useMe();
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(
    () => typeof window !== "undefined" && window.innerWidth >= 1024,
  );

  async function handleLogout() {
    try {
      await logout.mutateAsync();
      toast.success("Logged out successfully");
      setIsLogoutOpen(false);
      router.replace("/login");
    } catch (error) {
      toast.error(getFriendlyApiErrorMessage(error));
    }
  }

  function collapseSidebarOnSmallScreen() {
    if (window.innerWidth < 1024) {
      setIsExpanded(false);
    }
  }

  return (
    <>
      {isExpanded ? (
        <button
          aria-label="Collapse sidebar overlay"
          className="fixed inset-0 z-30 bg-slate-950/20 backdrop-blur-[1px] lg:hidden"
          onClick={() => setIsExpanded(false)}
          type="button"
        />
      ) : null}
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 h-screen border-r border-blue-100/80 bg-white/75 backdrop-blur-xl transition-[width] duration-200 lg:sticky lg:top-0",
        isExpanded ? "w-72" : "w-20",
      )}
    >
      <div className="flex h-full flex-col bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.16),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(244,246,249,0.84)_48%,rgba(255,255,255,0.96)_100%)]">
        <div className="p-3 lg:p-5">
          <Button
            aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
            className="mb-3 w-full justify-center border-blue-100 bg-white text-blue-700 hover:bg-blue-50"
            onClick={() => setIsExpanded((current) => !current)}
            size="sm"
            type="button"
            variant="outline"
          >
            {isExpanded ? <X className="size-4" /> : <Menu className="size-4" />}
            <span className={cn(!isExpanded && "sr-only")}>
              {isExpanded ? "Collapse" : "Expand"}
            </span>
          </Button>
          <div className="rounded-lg border border-blue-100/80 bg-white/90 p-3 shadow-xl shadow-blue-950/5 backdrop-blur">
            <div className="space-y-2">
              <div
                className={cn(
                  "flex w-full items-center justify-center overflow-hidden rounded-lg bg-white px-2 ring-1 ring-blue-100",
                  isExpanded ? "h-24" : "h-12",
                  isExpanded ? "lg:h-32" : "lg:h-12",
                )}
              >
                <Image
                  alt="AmbuSense logo"
                  className="h-full w-full object-contain object-center"
                  height={180}
                  priority
                  src="/ambu-logo-cropped.png"
                  width={260}
                />
              </div>
              <p
                className={cn(
                  "text-sm font-semibold text-slate-700 lg:text-base",
                  !isExpanded && "hidden",
                )}
              >
                Admin Dashboard
              </p>
            </div>
          </div>
        </div>
        <Separator className="bg-blue-100/80" />
        <nav className="flex flex-col gap-2 overflow-y-auto p-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/admin" && pathname.startsWith(item.href));

            return (
              <Link
                className={cn(
                  "group flex min-w-0 items-center gap-2 rounded-lg border border-transparent px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:border-blue-100 hover:bg-white/75 hover:text-blue-800 hover:shadow-sm lg:gap-3",
                  !isExpanded && "justify-center",
                  isActive &&
                    "border-blue-200 bg-white/95 text-blue-800 shadow-md shadow-blue-950/5 hover:bg-white",
                )}
                href={item.href}
                key={item.href}
                onClick={collapseSidebarOnSmallScreen}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-white/80 text-slate-500 transition group-hover:border-blue-200 group-hover:bg-blue-50 group-hover:text-blue-700",
                    isActive &&
                      "border-blue-200 bg-blue-100 text-blue-700",
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <span
                  className={cn(
                    "truncate",
                    !isExpanded && "hidden",
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto p-3">
          <Separator className="mb-3 hidden bg-blue-100/80 lg:block" />
          <div
            className={cn(
              "mb-3 rounded-lg border border-blue-100/80 bg-white/90 px-3 py-2 shadow-sm backdrop-blur",
              !isExpanded && "hidden",
            )}
          >
            <div className="flex items-center gap-2">
              <UserRound className="size-4 text-blue-700" />
              <p className="truncate text-sm font-medium text-slate-900">
                {data?.user.fullName ?? "Administrator"}
              </p>
            </div>
            <p className="mt-1 truncate text-xs text-slate-500">
              {data?.user.email ?? "admin account"}
            </p>
          </div>
          <Button
            className={cn(
              "w-full border-red-100 bg-white text-red-600 hover:bg-red-50 hover:text-red-700",
              isExpanded ? "justify-start" : "justify-center",
            )}
            onClick={() => setIsLogoutOpen(true)}
            type="button"
            variant="outline"
          >
            <LogOut className="size-4" />
            <span className={cn(!isExpanded && "sr-only")}>
              Logout
            </span>
          </Button>
        </div>
      </div>
      <Dialog open={isLogoutOpen} onOpenChange={setIsLogoutOpen}>
        <DialogClose onClick={() => setIsLogoutOpen(false)} />
        <DialogHeader>
          <div className="flex items-start gap-3 pr-10">
            <div className="flex size-20 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <LogOut className="size-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Logout?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Are you sure you want to logout?
              </p>
            </div>
          </div>
        </DialogHeader>
        <DialogContent>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              disabled={logout.isPending}
              onClick={() => setIsLogoutOpen(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={logout.isPending}
              onClick={handleLogout}
              type="button"
              variant="destructive"
            >
              {logout.isPending ? "Logging out..." : "Yes, logout"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </aside>
    </>
  );
}
