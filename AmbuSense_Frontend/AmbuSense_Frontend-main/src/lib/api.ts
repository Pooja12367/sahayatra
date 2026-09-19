import axios from "axios";
import type { ApiErrorResponse } from "@/types/common";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4008/api",
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
    return (
      error.response?.data?.message ??
      error.response?.data?.error ??
      error.message
    );
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
