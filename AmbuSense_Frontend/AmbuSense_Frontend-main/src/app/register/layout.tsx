import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Register Patient Account",
  description: "Register a patient account on Sahayatra to request and track emergency ambulances.",
};

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
