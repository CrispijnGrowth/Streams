import { QueryClient, QueryFunction } from "@tanstack/react-query";

const SESSION_KEY = "streams-session-id";

function getSessionHeaders(): HeadersInit {
  const sessionId = typeof window !== "undefined" ? localStorage.getItem(SESSION_KEY) : null;
  return sessionId ? { "x-session-id": sessionId } : {};
}

export interface ApiError extends Error {
  status: number;
  code?: string;
  message: string;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    let errorMessage = text;
    let errorCode: string | undefined;
    
    try {
      const json = JSON.parse(text);
      errorMessage = json.error || text;
      errorCode = json.code;
    } catch {
    }
    
    const error = new Error(errorMessage) as ApiError;
    error.status = res.status;
    error.code = errorCode;
    throw error;
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: HeadersInit = { ...getSessionHeaders() };
  if (data) {
    (headers as Record<string, string>)["Content-Type"] = "application/json";
  }
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
      headers: getSessionHeaders(),
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
