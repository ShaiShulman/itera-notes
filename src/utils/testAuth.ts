/**
 * Test Authentication Utilities
 * 
 * Helper functions for managing test authentication in automated UI tests.
 * These functions interact with the test auth endpoint to create/cleanup test sessions.
 */

export interface TestUser {
  id: string;
  email: string;
  name: string;
}

export interface TestSession {
  sessionToken: string;
  expires: string;
}

export interface TestAuthResponse {
  success: boolean;
  user?: TestUser;
  session?: TestSession;
  message?: string;
  error?: string;
}

/**
 * Create a test authentication session
 * This bypasses normal OAuth flow and creates a test user with a valid session
 */
export async function createTestAuth(baseUrl?: string): Promise<TestAuthResponse> {
  const url = `${baseUrl || ''}/api/test/auth`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'create' }),
      credentials: 'include', // Important for cookies
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error('Failed to create test auth:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Clean up test authentication data
 * Removes test user, sessions, and clears cookies
 */
export async function cleanupTestAuth(baseUrl?: string): Promise<TestAuthResponse> {
  const url = `${baseUrl || ''}/api/test/auth`;
  
  try {
    const response = await fetch(url, {
      method: 'DELETE',
      credentials: 'include', // Important for cookies
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error('Failed to cleanup test auth:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check test authentication status
 * Useful for debugging and verifying test setup
 */
export async function getTestAuthStatus(baseUrl?: string): Promise<any> {
  const url = `${baseUrl || ''}/api/test/auth`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error('Failed to get test auth status:', error);
    return {
      testAuthEnabled: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Browser-specific test auth utilities
 * Use these in browser-based tests (Playwright, Cypress, etc.)
 */
export const browserTestAuth = {
  /**
   * Create test auth and wait for session to be established
   */
  async setup(page: any, baseUrl?: string) {
    const result = await createTestAuth(baseUrl);
    if (!result.success) {
      throw new Error(`Test auth setup failed: ${result.error}`);
    }
    
    // Wait a moment for session to be established
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return result;
  },

  /**
   * Clean up test auth
   */
  async teardown(page: any, baseUrl?: string) {
    const result = await cleanupTestAuth(baseUrl);
    if (!result.success) {
      console.warn(`Test auth cleanup warning: ${result.error}`);
    }
    
    return result;
  },

  /**
   * Verify user is authenticated by checking for session
   */
  async verifyAuth(page: any) {
    try {
      // This will depend on your specific test framework
      // For Playwright:
      const cookies = await page.context().cookies();
      const sessionCookie = cookies.find((c: any) => c.name === 'next-auth.session-token');
      return !!sessionCookie;
    } catch (error) {
      console.warn('Could not verify auth status:', error);
      return false;
    }
  },
};

// Export constants for use in tests
export const TEST_USER_CONFIG = {
  email: 'test@uitesting.local',
  name: 'UI Test User',
  id: 'test-user-id-for-ui-testing',
} as const;