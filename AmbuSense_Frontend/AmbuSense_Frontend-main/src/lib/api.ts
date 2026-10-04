import axios from "axios";
import type { ApiErrorResponse } from "@/types/common";

function getApiBaseUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (!configuredUrl) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "NEXT_PUBLIC_API_URL must be configured with the deployed backend API URL before building for production.",
      );
    }

    return "http://localhost:5002/api";
  }

  let apiUrl: URL;
  try {
    apiUrl = new URL(configuredUrl);
  } catch {
    throw new Error("NEXT_PUBLIC_API_URL must be a valid absolute URL.");
  }

  if (process.env.NODE_ENV === "production") {
    const hostname = apiUrl.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    const ipv4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    const octets = ipv4?.slice(1).map(Number);
    const isPrivateIPv4 =
      octets !== undefined &&
      (octets[0] === 0 ||
        octets[0] === 10 ||
        octets[0] === 127 ||
        (octets[0] === 169 && octets[1] === 254) ||
        (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
        (octets[0] === 192 && octets[1] === 168));
    const isLocalHostname =
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      hostname.endsWith(".lan") ||
      hostname.endsWith(".home") ||
      hostname.endsWith(".home.arpa") ||
      hostname.endsWith(".localdomain") ||
      hostname.endsWith(".test") ||
      !hostname.includes(".");

    const apiPath = apiUrl.pathname.replace(/\/+$/, "");
    if (
      apiUrl.protocol !== "https:" ||
      apiUrl.username ||
      apiUrl.password ||
      apiUrl.search ||
      apiUrl.hash ||
      isPrivateIPv4 ||
      isLocalHostname ||
      !apiPath.endsWith("/api")
    ) {
      throw new Error(
        "NEXT_PUBLIC_API_URL must be a public HTTPS backend API URL ending in /api in production; localhost and private network hosts are not allowed.",
      );
    }
  }

  return apiUrl.toString().replace(/\/$/, "");
}

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

export function isAuthExpiredError(error: unknown) {
  return (
    axios.isAxiosError(error) &&
    (error.response?.status === 401 || error.response?.status === 403)
  );
}

export function getApiErrorMessage(error: unknown) {
  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    const message =
      error.response?.data?.message ??
      error.response?.data?.error ??
      error.message;

    const normalized = String(message ?? '').toLowerCase();
    const status = error.response?.status;

    if (status === 401) {
      return "Your session has expired. Please sign in again.";
    }

    if (status === 403) {
      return "You do not have permission to perform this action.";
    }

    if (status === 409 || normalized.includes("already exists")) {
      if (normalized.includes("email")) {
        return "An account with this email already exists.";
      }

      if (normalized.includes("phone")) {
        return "An account with this phone number already exists.";
      }

      return "This account already exists.";
    }

    if (normalized.includes("validation")) {
      return "Please check the highlighted fields and try again.";
    }

    if (
      !message ||
      message === "Network Error" ||
      message.includes("status code") ||
      status === 500
    ) {
      return "Unable to connect to the server. Please try again.";
    }

    return message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong";
}

export function getFriendlyApiErrorMessage(error: unknown) {
  if (isAuthExpiredError(error)) {
    return "Your session has expired. Please sign in again.";
  }

  const message = getApiErrorMessage(error);

  if (
    !message ||
    message === "Network Error" ||
    message.includes("status code")
  ) {
    return "We could not complete that request. Please try again.";
  }

  return message;
}
