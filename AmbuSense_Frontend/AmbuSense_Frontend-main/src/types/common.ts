export type Nullable<T> = T | null;

export type ApiErrorResponse = {
  message?: string;
  error?: string;
  statusCode?: number;
};
