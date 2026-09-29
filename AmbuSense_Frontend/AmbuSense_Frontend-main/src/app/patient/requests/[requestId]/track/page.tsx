"use client";

import { useParams } from "next/navigation";
import { RequestTrackingContent } from "@/components/patient/request-tracking-content";

export default function PatientRequestTrackingPage() {
  const params = useParams<{ requestId: string }>();

  return <RequestTrackingContent requestId={params.requestId} />;
}