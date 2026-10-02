import axios from "axios";
import type { ApiErrorResponse } from "@/types/common";

export const api = axios.create({
  baseURL:
    process.env.NEXT_PUBLIC_API_URL ??
    "https://sahayatra-backend-fa4y.onrender.com/api",
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
