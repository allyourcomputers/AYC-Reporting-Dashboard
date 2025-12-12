// Shared authentication utilities
let supabaseClient = null;
let currentSession = null;

// Initialize Supabase client
async function initAuth() {
    try {
        const response = await fetch('/api/config');
        const config = await response.json();

        supabaseClient = supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);

        // Check authentication status
        const { data: { session } } = await supabaseClient.auth.getSession();

        if (!session) {
            // Not authenticated, redirect to login
            window.location.href = '/login';
            return false;
        }

        currentSession = session;

        // Listen for auth state changes
        supabaseClient.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT' || !session) {
                window.location.href = '/login';
            } else {
                currentSession = session;
            }
        });

        return true;
    } catch (error) {
        console.error('Failed to initialize authentication:', error);
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
    const token = getAccessToken();

    if (!token) {
        throw new Error('No authentication token available');
    }

    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    const response = await fetch(url, {
        ...options,
        headers
    });

    if (response.status === 401) {
        // Token expired or invalid, redirect to login
        await logout();
        return;
    }

    return response;
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
