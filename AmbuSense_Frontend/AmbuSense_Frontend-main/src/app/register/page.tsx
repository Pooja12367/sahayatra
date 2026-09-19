"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/lib/api";
import { getRoleHomePath } from "@/lib/auth-redirect";
import { useSignup } from "@/hooks/use-auth";

const registerSchema = z.object({
  role: z.enum(["patient", "driver"]),
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Enter a valid email address"),
  phone: z.string().min(1, "Phone is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const signup = useSignup();
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: "patient",
      fullName: "",
      email: "",
      phone: "",
      password: "",
    },
  });

  async function onSubmit(values: RegisterFormValues) {
    try {
      const response = await signup.mutateAsync(values);

      toast.success(
        values.role === "driver"
          ? "Driver account created"
          : "Patient account created",
      );
      router.replace(
        response?.user ? getRoleHomePath(response.user.role) : "/login",
      );
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  }

  const selectedRole = form.watch("role");
  const isDriverSignup = selectedRole === "driver";

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.12),transparent_34%),linear-gradient(135deg,#ffffff_0%,#f4f6f9_48%,#eef3fb_100%)] px-4 py-10">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl items-center justify-center">
        <div className="grid w-full items-center gap-8 lg:grid-cols-[420px_1fr]">
          <Card className="border-blue-100/80 bg-white/90 shadow-xl shadow-blue-950/5 backdrop-blur">
            <CardHeader className="text-center">
              <div className="mx-auto flex h-24 w-56 items-center justify-center rounded-xl bg-white px-3 shadow-inner ring-1 ring-blue-100">
                <Image
                  alt="AmbuSense logo"
                  className="h-full w-full object-contain"
                  height={120}
                  priority
                  src="/ambu-logo-cropped.png"
                  width={260}
                />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  Create your account
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose how you will use AmbuSense.
                </p>
              </div>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                onSubmit={form.handleSubmit(onSubmit)}
              >
                <div className="space-y-2">
                  <Label>Register as</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className={`rounded-lg border px-3 py-3 text-left text-sm transition ${
                        selectedRole === "patient"
                          ? "border-blue-500 bg-blue-50 text-blue-950 ring-3 ring-blue-500/15"
                          : "border-border bg-white text-muted-foreground hover:bg-muted/50"
                      }`}
                      onClick={() => form.setValue("role", "patient")}
                    >
                      <span className="block font-medium">Patient</span>
                      <span className="mt-1 block text-xs">
                        Request ambulance support
                      </span>
                    </button>
                    <button
                      type="button"
                      className={`rounded-lg border px-3 py-3 text-left text-sm transition ${
                        selectedRole === "driver"
                          ? "border-blue-500 bg-blue-50 text-blue-950 ring-3 ring-blue-500/15"
                          : "border-border bg-white text-muted-foreground hover:bg-muted/50"
                      }`}
                      onClick={() => form.setValue("role", "driver")}
                    >
                      <span className="block font-medium">Driver</span>
                      <span className="mt-1 block text-xs">
                        Apply for verification
                      </span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input
                    id="fullName"
                    autoComplete="name"
                    placeholder="Sita Tamang"
                    aria-invalid={!!form.formState.errors.fullName}
                    {...form.register("fullName")}
                  />
                  {form.formState.errors.fullName ? (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.fullName.message}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="patient@example.com"
                    aria-invalid={!!form.formState.errors.email}
                    {...form.register("email")}
                  />
                  {form.formState.errors.email ? (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.email.message}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="+9779800000001"
                    aria-invalid={!!form.formState.errors.phone}
                    {...form.register("phone")}
                  />
                  {form.formState.errors.phone ? (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.phone.message}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Create a strong password"
                    aria-invalid={!!form.formState.errors.password}
                    {...form.register("password")}
                  />
                  {form.formState.errors.password ? (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.password.message}
                    </p>
                  ) : null}
                </div>

                <Button
                  className={`h-11 w-full text-white ${
                    isDriverSignup
                      ? "bg-blue-600 hover:bg-blue-700"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                  type="submit"
                  disabled={signup.isPending}
                  size="lg"
                >
                  {signup.isPending ? "Creating account..." : "Create account"}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link
                  className="font-medium text-blue-700 underline-offset-4 hover:underline"
                  href="/login"
                >
                  Sign in
                </Link>
              </p>
            </CardContent>
          </Card>

          <div className="hidden space-y-6 lg:block">
            <div className="inline-flex rounded-full border border-blue-200 bg-white/70 px-3 py-1 text-sm font-medium text-blue-700 shadow-sm">
              Public signup for patients and drivers
            </div>
            <div className="space-y-4">
              <h2 className="max-w-xl text-4xl font-semibold tracking-tight text-slate-950">
                Join the care network from the right starting point.
              </h2>
              <p className="max-w-lg text-base leading-7 text-slate-600">
                Patients can request support. Drivers can create a profile now
                and complete document verification before taking trips.
              </p>
            </div>
            <div className="rounded-xl border border-blue-100 bg-white/70 p-5 shadow-sm">
              <p className="font-medium text-slate-900">What comes next</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Driver accounts still need admin verification before operational
                access. Patient accounts can continue into request tools.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
