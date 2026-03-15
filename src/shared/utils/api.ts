/**
 * Robust fetch utility with timeout and retry logic
 */

export interface FetchOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export const fetchWithRetry = async (url: string, options: FetchOptions = {}): Promise<Response> => {
  const { 
    timeout = 30000, 
    retries = 3, 
    retryDelay = 2000, 
    ...fetchOptions 
  } = options;

  let lastError: any;

  for (let i = 0; i <= retries; i++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      // If server error (5xx), we might want to retry
      if (response.status >= 500 && i < retries) {
        console.warn(`[API] Server error ${response.status} for ${url}. Retrying... (${retries - i} left)`);
        await new Promise(resolve => setTimeout(resolve, retryDelay * (i + 1)));
        continue;
      }

      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      lastError = error;

      if (error.name === 'AbortError') {
        console.warn(`[API] Request timed out for ${url}`);
      } else {
        console.warn(`[API] Fetch error for ${url}:`, error.message || error);
      }

      if (i < retries) {
        const delay = retryDelay * (i + 1);
        console.log(`[API] Retrying ${url} in ${delay}ms... (${retries - i} left)`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error(`Failed to fetch ${url} after ${retries} retries`);
};
