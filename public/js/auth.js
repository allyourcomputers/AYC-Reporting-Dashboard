// Shared authentication utilities
let supabaseClient = null;
let currentSession = null;

// Enhanced error logging for debugging
function logError(context, error, additionalInfo = {}) {
    const errorDetails = {
        timestamp: new Date().toISOString(),
        context,
        error: {
            message: error.message,
            name: error.name,
            stack: error.stack
        },
        location: {
            href: window.location.href,
            origin: window.location.origin,
            pathname: window.location.pathname
        },
        ...additionalInfo
    };

    console.error('=== ERROR DETAILS ===');
    console.error(JSON.stringify(errorDetails, null, 2));
    console.error('====================');

    return errorDetails;
}

// Initialize Supabase client
async function initAuth() {
    console.log('=== INIT AUTH START ===');
    console.log('Current location:', window.location.href);
    console.log('Current origin:', window.location.origin);

    try {
        console.log('Attempting to fetch /api/config...');
        const configUrl = '/api/config';
        console.log('Full config URL:', new URL(configUrl, window.location.origin).href);

        const response = await fetch('/api/config');

        console.log('Fetch response received:', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            headers: {
                contentType: response.headers.get('content-type')
            }
        });

        if (!response.ok) {
            throw new Error(`Config fetch failed: ${response.status} ${response.statusText}`);
        }

        const config = await response.json();
        console.log('Config received:', {
            supabaseUrlSet: !!config.supabaseUrl,
            supabaseAnonKeySet: !!config.supabaseAnonKey,
            supabaseUrlPreview: config.supabaseUrl ? config.supabaseUrl.substring(0, 30) + '...' : 'NOT SET'
        });

        console.log('Creating Supabase client...');
        supabaseClient = supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
        console.log('Supabase client created successfully');

        // Check authentication status
        console.log('Checking authentication session...');
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();

        if (sessionError) {
            console.error('Session error:', sessionError);
            logError('getSession', sessionError);
        }

        console.log('Session check result:', {
            hasSession: !!session,
            user: session?.user?.email || 'none'
        });

        if (!session) {
            // Not authenticated, redirect to login
            console.log('No session found, redirecting to login...');
            window.location.href = '/login';
            return false;
        }

        currentSession = session;
        console.log('Authentication successful');

        // Listen for auth state changes
        supabaseClient.auth.onAuthStateChange((event, session) => {
            console.log('Auth state change:', { event, hasSession: !!session });
            if (event === 'SIGNED_OUT' || !session) {
                window.location.href = '/login';
            } else {
                currentSession = session;
            }
        });

        console.log('=== INIT AUTH COMPLETE ===');
        return true;
    } catch (error) {
        const errorInfo = logError('initAuth', error, {
            fetchUrl: '/api/config',
            browserInfo: {
                userAgent: navigator.userAgent,
                onLine: navigator.onLine
            }
        });

        // Show error to user in addition to logging
        alert(`Failed to initialize application:\n\n${error.message}\n\nCheck browser console for details.`);

        console.log('Redirecting to login due to error...');
        window.location.href = '/login';
        return false;
    }
}

// Get the current access token
function getAccessToken() {
    return currentSession?.access_token || null;
}

// Make an authenticated API request
async function authFetch(url, options = {}) {
    console.log('authFetch called:', { url, method: options.method || 'GET' });

    try {
        const token = getAccessToken();

        if (!token) {
            const error = new Error('No authentication token available');
            logError('authFetch - no token', error, { url, options });
            throw error;
        }

        const headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        console.log('Making authenticated request to:', url);
        const response = await fetch(url, {
            ...options,
            headers
        });

        console.log('authFetch response:', {
            url,
            status: response.status,
            statusText: response.statusText,
            ok: response.ok
        });

        if (response.status === 401) {
            console.log('Received 401 Unauthorized, logging out...');
            // Token expired or invalid, redirect to login
            await logout();
            return;
        }

        return response;
    } catch (error) {
        logError('authFetch', error, { url, options });
        throw error;
    }
}

// Logout function
async function logout() {
    if (supabaseClient) {
        await supabaseClient.auth.signOut();
    }
    window.location.href = '/login';
}

// Setup logout button if it exists
function setupLogoutButton() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await logout();
        });
    }
}

// Display user info if element exists
async function displayUserInfo() {
    const userInfoElement = document.getElementById('userInfo');
    if (userInfoElement && currentSession) {
        const email = currentSession.user?.email || 'User';
        userInfoElement.textContent = email;
    }
}
