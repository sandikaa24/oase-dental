export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  code?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export class ApiError extends Error {
  code: string;
  status: number;
  data?: unknown;

  constructor(message: string, code: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.data = data;
  }
}

let refreshPromise: Promise<boolean> | null = null;

async function executeTokenRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (res.ok) {
        const body: ApiResponse = await res.json().catch(() => ({ success: false }));
        return !!body.success;
      }
      return false;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function fetchApi<T = unknown>(
  input: string | URL,
  init?: RequestInit,
  isRetry = false
): Promise<ApiResponse<T>> {
  const url = typeof input === 'string' ? input : input.toString();

  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type') && !(init?.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const config: RequestInit = {
    ...init,
    headers,
    credentials: 'include',
  };

  const response = await fetch(url, config);

  if (response.status === 401 && !isRetry && !url.includes('/api/v1/auth/login') && !url.includes('/api/v1/auth/refresh')) {
    // Interceptor 401: Coba refresh token SEKALI
    const refreshed = await executeTokenRefresh();
    if (refreshed) {
      // Retry request asli
      return fetchApi<T>(input, init, true);
    }
  }

  let body: ApiResponse<T>;
  try {
    body = await response.json();
  } catch {
    body = {
      success: response.ok,
      message: response.statusText || 'Gagal memproses response server',
    };
  }

  if (!response.ok || body.success === false) {
    throw new ApiError(
      body.message || `Request failed with status ${response.status}`,
      body.code || 'UNKNOWN_ERROR',
      response.status,
      body.data
    );
  }

  return body;
}
