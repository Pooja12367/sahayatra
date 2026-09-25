"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/lib/api";
import { getRoleHomePath } from "@/lib/auth-redirect";
import { useSignup } from "@/hooks/use-auth";

function normalizePhoneNumber(value: string) {
  const compact = value.replace(/[\s-]+/g, "").trim();

  if (!compact) {
    return "";
  }

  let digits = compact.replace(/\D/g, "");

  if (compact.startsWith("+977")) {
    digits = compact.slice(4).replace(/\D/g, "");
  } else if (compact.startsWith("977")) {
    digits = compact.slice(3).replace(/\D/g, "");
  }

  if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  if (!/^9\d{9}$/.test(digits) || /^(\d)\1{9}$/.test(digits)) {
    return "";
  }

  return `+977${digits}`;
}

const registerSchema = z.object({
  role: z.enum(["patient", "driver"], {
    message: "Please select a valid account type.",
  }),
  fullName: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters long.")
    .max(100, "Full name must not exceed 100 characters.")
    .refine((value) => /^(?=.*[\p{L}])[\p{L}\p{M}\s.'-]{2,100}$/u.test(value), {
      message:
        "Enter a valid full name with meaningful letters and no excessive symbols.",
    })
    .refine((value) => !/\s{2,}/.test(value), {
      message: "Avoid excessive repeated spaces in the full name.",
    }),
  email: z
    .string()
    .trim()
    .transform((value) => value.toLowerCase())
    .pipe(
      z.string().min(1, "Email is required.").max(254, "Email is too long.").email("Enter a valid email address."),
    ),
  phone: z
    .string()
    .trim()
    .transform((value) => normalizePhoneNumber(value))
    .pipe(
      z
        .string()
        .min(1, "Phone number is required.")
        .refine((value) => /^\+9779\d{9}$/.test(value), {
          message:
            "Enter a valid Nepal mobile number, for example +9779841234567.",
        }),
    ),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long.")
    .max(128, "Password must not exceed 128 characters.")
    .refine((value) => !/^\s|\s$/.test(value), {
      message: "Password must not start or end with whitespace.",
    })
    .refine((value) => /[A-Z]/.test(value), {
      message: "Password must include at least one uppercase letter.",
    })
    .refine((value) => /[a-z]/.test(value), {
      message: "Password must include at least one lowercase letter.",
    })
    .refine((value) => /\d/.test(value), {
      message: "Password must include at least one number.",
    })
    .refine((value) => /[^A-Za-z0-9]/.test(value), {
      message: "Password must include at least one special character.",
    }),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const signup = useSignup();
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    mode: "onSubmit",
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
  const [showPassword, setShowPassword] = React.useState(false);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.12),transparent_34%),linear-gradient(135deg,#ffffff_0%,#f4f6f9_48%,#eef3fb_100%)] px-4 py-10">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl items-center justify-center">
        <div className="grid w-full items-center gap-8 lg:grid-cols-[420px_1fr]">
          <Card className="border-blue-100/80 bg-white/90 shadow-xl shadow-blue-950/5 backdrop-blur">
            <CardHeader className="text-center">
              <div className="mx-auto flex h-24 w-56 items-center justify-center rounded-xl bg-white px-3 shadow-inner ring-1 ring-blue-100">
                <Image
                  alt="Sahayatra logo"
                  className="h-full w-full object-contain"
                  height={120}
                  priority
                  src="/sahayatra-crop.jpg"
                  width={260}
                />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  Create your account
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose how you will use Sahayatra.
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
                    aria-describedby={
                      form.formState.errors.fullName ? "fullName-error" : undefined
                    }
                    {...form.register("fullName")}
                  />
                  {form.formState.errors.fullName ? (
                    <p id="fullName-error" className="text-sm text-destructive">
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
                    aria-describedby={
                      form.formState.errors.email ? "email-error" : undefined
                    }
                    {...form.register("email")}
                  />
                  {form.formState.errors.email ? (
                    <p id="email-error" className="text-sm text-destructive">
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
                    aria-describedby={
                      form.formState.errors.phone ? "phone-error" : undefined
                    }
                    {...form.register("phone")}
                  />
                  {form.formState.errors.phone ? (
                    <p id="phone-error" className="text-sm text-destructive">
                      {form.formState.errors.phone.message}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Create a strong password"
                      aria-invalid={!!form.formState.errors.password}
                      aria-describedby={
                        form.formState.errors.password ? "password-error" : "password-hint"
                      }
                      {...form.register("password")}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-3 flex items-center text-xs font-medium text-blue-700"
                      onClick={() => setShowPassword((current) => !current)}
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  <ul
                    id="password-hint"
                    className="grid gap-1 text-xs text-slate-600"
                  >
                    <li>• Minimum 8 characters</li>
                    <li>• At least 1 uppercase, 1 lowercase, and 1 number</li>
                    <li>• At least 1 special character</li>
                    <li>• No leading or trailing whitespace</li>
                  </ul>
                  {form.formState.errors.password ? (
                    <p id="password-error" className="text-sm text-destructive">
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
