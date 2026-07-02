import type {
  ApiErrorBody,
  AuthResponse,
  CreateTableRequest,
  LoginRequest,
  OkResponse,
  ReservationDTO,
  TableDTO,
  TokenPair,
  UpdateReservationStatusRequest,
  UpdateTableRequest,
  UserDTO,
} from '@pubster/shared';
import { API_BASE_URL } from './config';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from './tokens';

/**
 * Typed client for the Pubster backend (docs/BACKEND.md §API surface).
 *
 * Behaviour:
 * - Attaches `Authorization: Bearer <access>` to authenticated requests.
 * - On a `401` it transparently rotates tokens via `POST /auth/refresh`
 *   (single-flight — concurrent 401s share one refresh) and retries once.
 * - If refresh fails the session is cleared and the registered
 *   session-expired handler fires (the app redirects to `/login`).
 * - Non-2xx responses are thrown as {@link ApiError} carrying the backend's
 *   `{ error: { code, message } }` envelope.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// --- Session-expired notification -------------------------------------------

type SessionExpiredHandler = () => void;
let sessionExpiredHandler: SessionExpiredHandler | null = null;

/** Register a callback fired when the session can no longer be refreshed. */
export function setSessionExpiredHandler(handler: SessionExpiredHandler | null): void {
  sessionExpiredHandler = handler;
}

// --- Single-flight refresh ---------------------------------------------------

let refreshInFlight: Promise<string | null> | null = null;

async function performRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    clearTokens();
    return null;
  }

  const tokens = (await res.json()) as TokenPair;
  setTokens(tokens);
  return tokens.accessToken;
}

function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = performRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

// --- Core request ------------------------------------------------------------

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** When `false`, no auth header is attached and 401 is not retried. */
  auth?: boolean;
}

async function toApiError(res: Response): Promise<ApiError> {
  let code = 'HTTP_ERROR';
  let message = `Request failed with status ${res.status}`;
  let details: unknown;
  try {
    const body = (await res.json()) as ApiErrorBody;
    if (body?.error) {
      code = body.error.code ?? code;
      message = body.error.message ?? message;
      details = body.error.details;
    }
  } catch {
    // Non-JSON error body — keep the generic message.
  }
  return new ApiError(res.status, code, message, details);
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = options;

  const send = (token: string | null): Promise<Response> => {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let res = await send(auth ? getAccessToken() : null);

  if (res.status === 401 && auth) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      res = await send(newToken);
    }
    if (res.status === 401) {
      clearTokens();
      sessionExpiredHandler?.();
      throw await toApiError(res);
    }
  }

  if (!res.ok) {
    throw await toApiError(res);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

// --- Typed endpoints ---------------------------------------------------------

export const api = {
  // Auth
  login: (body: LoginRequest) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body, auth: false }),
  logout: (refreshToken: string) =>
    request<OkResponse>('/auth/logout', { method: 'POST', body: { refreshToken }, auth: false }),
  me: () => request<UserDTO>('/auth/me'),

  // Tables (staff/manager, pub-scoped)
  listTables: (pubId: string) => request<TableDTO[]>(`/pubs/${pubId}/tables`),
  createTables: (pubId: string, body: CreateTableRequest) =>
    request<TableDTO[]>(`/pubs/${pubId}/tables`, { method: 'POST', body }),
  updateTable: (tableId: string, body: UpdateTableRequest) =>
    request<TableDTO>(`/tables/${tableId}`, { method: 'PATCH', body }),
  deleteTable: (tableId: string) => request<void>(`/tables/${tableId}`, { method: 'DELETE' }),

  // Reservations (staff/manager, pub-scoped)
  listPubReservations: (pubId: string, date: string) =>
    request<ReservationDTO[]>(`/pubs/${pubId}/reservations?date=${encodeURIComponent(date)}`),
  setReservationStatus: (reservationId: string, body: UpdateReservationStatusRequest) =>
    request<ReservationDTO>(`/reservations/${reservationId}/status`, { method: 'POST', body }),
};
