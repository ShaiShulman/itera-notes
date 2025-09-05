"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";

interface SecureApiOptions {
  autoRefreshToken?: boolean;
  retryOnRateLimit?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

interface SecureApiError {
  type: string;
  message: string;
  statusCode: number;
  details?: Record<string, any>;
}

interface SecureApiState {
  csrfToken: string | null;
  isLoading: boolean;
  error: SecureApiError | null;
  lastRefresh: number;
}

/**
 * Secure API hook that handles CSRF tokens, authentication, and error handling
 */
export function useSecureApi(options: SecureApiOptions = {}) {
  const {
    autoRefreshToken = true,
    retryOnRateLimit = true,
    maxRetries = 3,
    retryDelay = 1000,
  } = options;

  const { data: session, status } = useSession();
  const [state, setState] = useState<SecureApiState>({
    csrfToken: null,
    isLoading: false,
    error: null,
    lastRefresh: 0,
  });

  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRefreshingRef = useRef(false);

  /**
   * Generate a new CSRF token via API call
   */
  const generateCSRFToken = useCallback(async (): Promise<string | null> => {
    if (!session?.user?.id || isRefreshingRef.current) {
      return null;
    }

    try {
      isRefreshingRef.current = true;
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Call API to generate CSRF token
      const response = await fetch('/api/csrf-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include session cookies
      });

      if (!response.ok) {
        throw new Error(`Failed to generate CSRF token: ${response.status}`);
      }

      const { token } = await response.json();

      setState(prev => ({
        ...prev,
        csrfToken: token,
        isLoading: false,
        lastRefresh: Date.now(),
      }));

      return token;
    } catch (tokenError) {
      console.error("CSRF token generation error:", tokenError);
      const errorObj: SecureApiError = {
        type: "TOKEN_GENERATION_ERROR",
        message: "Failed to generate CSRF token",
        statusCode: 500,
      };

      setState(prev => ({
        ...prev,
        error: errorObj,
        isLoading: false,
      }));

      return null;
    } finally {
      isRefreshingRef.current = false;
    }
  }, [session?.user?.id]);

  /**
   * Check if CSRF token needs refresh (expires in 30 minutes)
   */
  const needsTokenRefresh = useCallback((): boolean => {
    if (!state.csrfToken || !state.lastRefresh) return true;
    
    const tokenAge = Date.now() - state.lastRefresh;
    const maxAge = 25 * 60 * 1000; // Refresh 5 minutes before expiry
    
    return tokenAge > maxAge;
  }, [state.csrfToken, state.lastRefresh]);

  /**
   * Ensure we have a valid CSRF token
   */
  const ensureCSRFToken = useCallback(async (): Promise<string | null> => {
    if (state.csrfToken && !needsTokenRefresh()) {
      return state.csrfToken;
    }

    return await generateCSRFToken();
  }, [state.csrfToken, needsTokenRefresh, generateCSRFToken]);

  /**
   * Secure fetch wrapper with automatic CSRF token handling
   */
  const secureFetch = useCallback(async (
    url: string,
    options: RequestInit & { skipCSRF?: boolean } = {},
    retryCount = 0
  ): Promise<Response> => {
    console.log(`🔒 Making secure request to: ${url}`);
    
    // Ensure user is authenticated
    if (status === "loading") {
      throw new Error("Authentication status is still loading");
    }

    if (status === "unauthenticated") {
      throw new Error("User must be authenticated to make secure API calls");
    }

    console.log(`🔐 User authenticated: ${session?.user?.id}`);

    // Get CSRF token if needed
    let csrfToken: string | null = null;
    if (!options.skipCSRF) {
      console.log("🛡️ Getting CSRF token...");
      csrfToken = await ensureCSRFToken();
      console.log(`CSRF token obtained: ${csrfToken ? 'YES' : 'NO'}`);
      if (!csrfToken) {
        throw new Error("Failed to obtain CSRF token");
      }
    }

    // Prepare headers
    const headers = new Headers(options.headers);
    
    if (csrfToken) {
      headers.set("X-CSRF-Token", csrfToken);
      console.log("✅ CSRF token added to headers");
    }
    
    headers.set("Content-Type", "application/json");
    
    // Add origin/referer for additional security
    if (typeof window !== "undefined") {
      headers.set("X-Requested-With", "XMLHttpRequest");
      console.log(`🌐 Origin: ${window.location.origin}`);
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        // Ensure signal is passed through for cancellation
        signal: options.signal,
      });

      console.log(`📡 Response status: ${response.status}`);
      
      // Log error details for debugging
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Request failed:`, {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        });
        
        // Try to parse as JSON for structured error
        try {
          const errorData = JSON.parse(errorText);
          console.error("Structured error:", errorData);
        } catch {
          console.error("Raw error response:", errorText);
        }
      }

      // Handle rate limiting with retry
      if (response.status === 429 && retryOnRateLimit && retryCount < maxRetries) {
        console.warn(`Rate limited, retrying in ${retryDelay}ms (attempt ${retryCount + 1}/${maxRetries})`);
        
        return new Promise((resolve, reject) => {
          retryTimeoutRef.current = setTimeout(async () => {
            try {
              const retryResponse = await secureFetch(url, options, retryCount + 1);
              resolve(retryResponse);
            } catch (error) {
              reject(error);
            }
          }, retryDelay * Math.pow(2, retryCount)); // Exponential backoff
        });
      }

      // Handle CSRF token expiry
      if (response.status === 403 && !options.skipCSRF) {
        const errorData = await response.json().catch(() => ({}));
        
        if (errorData.error?.type === "CSRF_INVALID" && retryCount === 0) {
          console.warn("CSRF token invalid, refreshing token and retrying...");
          
          // Force token refresh
          await generateCSRFToken();
          return secureFetch(url, options, 1);
        }
      }

      return response;
      
    } catch (fetchError) {
      console.error("Secure fetch error:", fetchError);
      throw fetchError;
    }
  }, [status, ensureCSRFToken, retryOnRateLimit, maxRetries, retryDelay, generateCSRFToken]);

  /**
   * Convenience method for POST requests with JSON body
   */
  const securePost = useCallback(async (
    url: string,
    body: any,
    options: Omit<RequestInit, 'method' | 'body'> = {}
  ) => {
    return secureFetch(url, {
      ...options,
      method: "POST",
      body: JSON.stringify(body),
    });
  }, [secureFetch]);

  /**
   * Handle streaming responses with security and cancellation support
   */
  const secureStream = useCallback(async (
    url: string,
    body: any,
    onChunk: (chunk: string) => void,
    abortSignal?: AbortSignal,
    options: Omit<RequestInit, 'method' | 'body'> = {}
  ) => {
    // Pass abort signal to the request
    const requestOptions = abortSignal 
      ? { ...options, signal: abortSignal }
      : options;

    const response = await securePost(url, body, requestOptions);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (!response.body) {
      throw new Error("No response body available for streaming");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        // Check for cancellation before each read
        if (abortSignal?.aborted) {
          throw new Error("Operation was cancelled");
        }
        
        const { done, value } = await reader.read();
        
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        onChunk(chunk);
      }
    } finally {
      reader.releaseLock();
    }
  }, [securePost]);

  /**
   * Initialize CSRF token when session is available
   */
  useEffect(() => {
    if (status === "authenticated" && session?.user?.id && autoRefreshToken && !state.csrfToken) {
      generateCSRFToken();
    }
  }, [status, session?.user?.id, autoRefreshToken, state.csrfToken, generateCSRFToken]);

  /**
   * Cleanup retry timeouts
   */
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Reset error state
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  /**
   * Manually refresh CSRF token
   */
  const refreshToken = useCallback(async () => {
    return await generateCSRFToken();
  }, [generateCSRFToken]);

  return {
    // State
    csrfToken: state.csrfToken,
    isLoading: state.isLoading,
    error: state.error,
    isAuthenticated: status === "authenticated",
    
    // Methods
    secureFetch,
    securePost,
    secureStream,
    refreshToken,
    clearError,
    
    // Utilities
    needsTokenRefresh: needsTokenRefresh(),
  };
}