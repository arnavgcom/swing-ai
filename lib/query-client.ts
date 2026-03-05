import { fetch } from "expo/fetch";
import { QueryClient, QueryFunction } from "@tanstack/react-query";
import Constants from "expo-constants";

function normalizeBaseUrl(url: string): string {
  return url.endsWith("/") ? url : `${url}/`;
}

function dedupeUrls(urls: string[]): string[] {
  return Array.from(new Set(urls.filter(Boolean).map((u) => normalizeBaseUrl(u.trim()))));
}

function resolveHostFromExpoConstants(): string | null {
  const constantsHostUri =
    (Constants.expoConfig as any)?.hostUri ||
    (Constants as any)?.manifest2?.extra?.expoClient?.hostUri ||
    (Constants as any)?.manifest?.debuggerHost;

  if (!constantsHostUri) return null;

  const hostOnly = String(constantsHostUri)
    .replace(/^https?:\/\//i, "")
    .split("/")[0]
    .split(":")[0];

  return hostOnly || null;
}

export function getApiUrlCandidates(): string[] {
  const explicitApiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (explicitApiUrl) {
    return [normalizeBaseUrl(explicitApiUrl)];
  }

  const host = process.env.EXPO_PUBLIC_DOMAIN;
  if (host) {
    const hasProtocol = /^https?:\/\//i.test(host);
    const isLocalHost = /^(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?$/i.test(
      host.replace(/^https?:\/\//i, ""),
    );
    const defaultProtocol = isLocalHost ? "http" : "https";
    const url = new URL(hasProtocol ? host : `${defaultProtocol}://${host}`);
    return [normalizeBaseUrl(url.href)];
  }

  if (__DEV__) {
    const constantsHost = resolveHostFromExpoConstants();
    return dedupeUrls([
      constantsHost ? `http://${constantsHost}:5000/` : "",
      "http://10.0.2.2:5000/",
      "http://localhost:5000/",
      "http://127.0.0.1:5000/",
    ]);
  }

  throw new Error("EXPO_PUBLIC_API_URL or EXPO_PUBLIC_DOMAIN is not set");
}

/**
 * Gets the base URL for the Express API server (e.g., "http://localhost:3000")
 * @returns {string} The API base URL
 */
export function getApiUrl(): string {
  return getApiUrlCandidates()[0];
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  route: string,
  data?: unknown | undefined,
): Promise<Response> {
  const baseUrls = getApiUrlCandidates();
  let lastError: unknown = null;

  for (const baseUrl of baseUrls) {
    try {
      const url = new URL(route, baseUrl);
      const res = await fetch(url.toString(), {
        method,
        headers: data ? { "Content-Type": "application/json" } : {},
        body: data ? JSON.stringify(data) : undefined,
        credentials: "include",
      });

      await throwIfResNotOk(res);
      return res;
    } catch (error) {
      lastError = error;
    }
  }

  const detail =
    lastError instanceof Error && lastError.message
      ? ` Last error: ${lastError.message}`
      : "";

  throw new Error(
    `Could not connect to the server. Tried: ${baseUrls.join(", ")}. ` +
      `Ensure the backend is running on port 5000 or set EXPO_PUBLIC_API_URL.${detail}`,
  );
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const baseUrls = getApiUrlCandidates();
    let lastError: unknown = null;

    for (const baseUrl of baseUrls) {
      try {
        const url = new URL(queryKey.join("/") as string, baseUrl);
        const res = await fetch(url.toString(), {
          credentials: "include",
        });

        if (unauthorizedBehavior === "returnNull" && res.status === 401) {
          return null;
        }

        await throwIfResNotOk(res);
        return await res.json();
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError instanceof Error) {
      throw lastError;
    }
    throw new Error("Failed to query API");
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
