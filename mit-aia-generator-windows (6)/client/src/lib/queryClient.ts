import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorMessage = `${res.status}: ${res.statusText}`;
    
    try {
      const contentType = res.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const errorData = await res.json();
        errorMessage = `${res.status}: ${errorData.message || errorData.error || res.statusText}`;
      } else {
        const text = await res.text();
        if (text && text.length < 200 && !text.includes('<!DOCTYPE')) {
          errorMessage = `${res.status}: ${text}`;
        }
      }
    } catch (parseError) {
      console.error('Failed to parse error response:', parseError);
      // Keep the default error message
    }
    
    throw new Error(errorMessage);
  }
}

export const apiRequest = async (
  method: string,
  endpoint: string,
  data?: unknown
): Promise<Response> => {
  const config: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  };

  if (data) {
    config.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(endpoint, config);

    if (!response.ok) {
      // Try to get error details from response
      const contentType = response.headers.get('content-type');
      let errorMessage = `HTTP error! status: ${response.status}`;

      if (contentType?.includes('application/json')) {
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (jsonError) {
          console.error('Failed to parse JSON error response:', jsonError);
          errorMessage = `Server error (${response.status}): Unable to parse error details`;
        }
      } else if (contentType?.includes('text/html')) {
        // Handle HTML error responses (like 404 pages)
        errorMessage = `Server returned HTML instead of JSON. Endpoint ${endpoint} might not exist or server is not running properly.`;
      } else {
        try {
          const textResponse = await response.text();
          if (textResponse.length < 200) {
            errorMessage = textResponse || errorMessage;
          }
        } catch (textError) {
          console.error('Failed to parse text error response:', textError);
          errorMessage = `Server error (${response.status}): Unable to parse error details`;
        }
      }

      const error = new Error(errorMessage);
      (error as any).status = response.status;
      (error as any).response = response;
      throw error;
    }

    return response;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Unable to connect to server. Please check if the server is running.');
    }
    throw error;
  }
};

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    
    try {
      const contentType = res.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return await res.json();
      } else {
        throw new Error('Expected JSON response but received: ' + (contentType || 'unknown content type'));
      }
    } catch (jsonError) {
      console.error('Failed to parse JSON response:', jsonError);
      throw new Error('Invalid JSON response from server');
    }
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