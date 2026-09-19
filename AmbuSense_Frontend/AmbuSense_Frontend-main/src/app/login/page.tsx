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
import { useLogin } from "@/hooks/use-auth";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const login = useLogin();
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: LoginFormValues) {
    try {
      const response = await login.mutateAsync({
        ...values,
        rememberMe: true,
      });
      toast.success("Welcome back");
      router.replace(getRoleHomePath(response.user.role));
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.12),transparent_32%),linear-gradient(135deg,#ffffff_0%,#f4f6f9_48%,#eef3fb_100%)] px-4 py-10">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl items-center justify-center">
        <div className="grid w-full items-center gap-8 lg:grid-cols-[1fr_420px]">
          <div className="hidden space-y-6 lg:block">
            <div className="inline-flex rounded-full border border-blue-200 bg-white/70 px-3 py-1 text-sm font-medium text-blue-700 shadow-sm">
              AmbuSense care network
            </div>
            <div className="space-y-4">
              <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-slate-950">
                Calm, connected emergency coordination.
              </h1>
              <p className="max-w-lg text-base leading-7 text-slate-600">
                Sign in to manage ambulance status, dispatch requests, or track
                care from the right workspace.
              </p>
            </div>
            <div className="grid max-w-md grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-blue-100 bg-white/70 p-4 shadow-sm">
                <p className="font-medium text-slate-900">Live access</p>
                <p className="mt-1 text-slate-500">Role-aware dashboards</p>
              </div>
              <div className="rounded-lg border border-blue-100 bg-white/70 p-4 shadow-sm">
                <p className="font-medium text-slate-900">Secure sessions</p>
                <p className="mt-1 text-slate-500">Cookie-based auth</p>
              </div>
            </div>
          </div>

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
                <h2 className="text-2xl font-semibold tracking-tight">
                  Welcome back
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Sign in to continue to AmbuSense.
                </p>
              </div>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                onSubmit={form.handleSubmit(onSubmit)}
              >
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
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
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Enter your password"
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
                  className="h-11 w-full bg-blue-600 text-white hover:bg-blue-700"
                  type="submit"
                  disabled={login.isPending}
                  size="lg"
                >
                  {login.isPending ? "Signing in..." : "Sign in"}
                </Button>
              </form>

              <div className="mt-4 text-center">
                <Link
                  className="text-sm font-medium text-blue-700 underline-offset-4 hover:underline"
                  href="/forgot-password"
                >
                  Forgot your password?
                </Link>
              </div>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                Need a patient account?{" "}
                <Link
                  className="font-medium text-blue-700 underline-offset-4 hover:underline"
                  href="/register"
                >
                  Register
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
