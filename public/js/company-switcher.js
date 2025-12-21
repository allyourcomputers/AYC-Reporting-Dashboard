// Company Switcher Component
// Manages company selection, user profile display, and impersonation

let userProfile = null;

/**
 * Load and display user profile with company switcher
 */
async function loadUserProfile() {
  try {
    // Get Supabase session from localStorage
    const authData = localStorage.getItem('sb-supabase-auth-token');
    if (!authData) {
      window.location.href = '/login';
      return;
    }

    // Parse the auth data and extract access token
    const session = JSON.parse(authData);
    const token = session.access_token;

    if (!token) {
      window.location.href = '/login';
      return;
    }

    const config = await (await fetch('/api/config')).json();
    const supabaseUrl = config.supabaseUrl;
    const supabaseAnonKey = config.supabaseAnonKey;

    // Fetch user profile
    const response = await fetch('/api/profile', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('sb-supabase-auth-token');
        window.location.href = '/login';
        return;
      }
      throw new Error('Failed to load user profile');
    }

    userProfile = await response.json();
    renderCompanySwitcher();
    updateAdminNavigation();
  } catch (error) {
    console.error('Error loading user profile:', error);
  }
}

/**
 * Render the company switcher UI
 */
function renderCompanySwitcher() {
  const container = document.getElementById('companySwitcher');
  if (!container) return;

  let html = '';

  // Impersonation Banner (shown prominently at top when impersonating)
  if (userProfile.isImpersonating && userProfile.impersonatedUser) {
    html += `
      <div class="impersonation-banner active">
        <div class="impersonation-content">
          <span class="impersonation-icon">👤</span>
          <span class="impersonation-text">
            Viewing as: <strong>${userProfile.impersonatedUser.fullName}</strong>
            (${userProfile.impersonatedUser.email})
          </span>
          <button class="btn-stop-impersonation" onclick="stopImpersonation()">
            Stop Impersonation
          </button>
        </div>
      </div>
    `;
  }

  // Company Switcher and User Info
  html += '<div class="user-info-bar">';

  // Super Admin Badge
  if (userProfile.role === 'super_admin') {
    html += '<span class="badge badge-super-admin">Super Admin</span>';
  }

  // Company Switcher (if user has companies)
  if (userProfile.companies && userProfile.companies.length > 0) {
    if (userProfile.companies.length === 1) {
      // Single company - just show name
      html += `
        <div class="company-display">
          <span class="company-icon">🏢</span>
          <span class="company-name">${userProfile.companies[0].name}</span>
        </div>
      `;
    } else {
      // Multiple companies - show dropdown
      html += `
        <div class="company-switcher">
          <label for="companySelect" class="company-label">
            <span class="company-icon">🏢</span>
            Company:
          </label>
          <select id="companySelect" class="company-select" onchange="switchCompany(this.value)">
            ${userProfile.companies.map(company => `
              <option value="${company.id}" ${company.id === userProfile.activeCompanyId ? 'selected' : ''}>
                ${company.name}
              </option>
            `).join('')}
          </select>
        </div>
      `;
    }
  } else if (userProfile.role !== 'super_admin') {
    // Customer user with no companies assigned
    html += `
      <div class="company-display warning">
        <span>⚠️ No company assigned. Contact administrator.</span>
      </div>
    `;
  }

  // User name and logout
  html += `
    <div class="user-actions">
      <span class="user-name">${userProfile.fullName}</span>
      <button class="btn-logout" onclick="logout()">Logout</button>
    </div>
  `;

  html += '</div>';

  container.innerHTML = html;
}

/**
 * Switch to a different company
 */
async function switchCompany(companyId) {
  try {
    const authData = localStorage.getItem('sb-supabase-auth-token');
    const session = JSON.parse(authData);
    const token = session.access_token;

    const response = await fetch('/api/profile/switch-company', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ companyId })
    });

    if (!response.ok) {
      throw new Error('Failed to switch company');
    }

    // Reload page to refresh all data with new company context
    window.location.reload();
  } catch (error) {
    console.error('Error switching company:', error);
    alert('Failed to switch company. Please try again.');
  }
}

/**
 * Stop impersonating and return to admin view
 */
async function stopImpersonation() {
  try {
    const authData = localStorage.getItem('sb-supabase-auth-token');
    const session = JSON.parse(authData);
    const token = session.access_token;

    const response = await fetch('/api/profile/stop-impersonation', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to stop impersonation');
    }

    // Reload page to return to admin view
    window.location.reload();
  } catch (error) {
    console.error('Error stopping impersonation:', error);
    alert('Failed to stop impersonation. Please try again.');
  }
}

/**
 * Update admin navigation visibility based on user role
 */
function updateAdminNavigation() {
  const adminNavSection = document.getElementById('adminNavSection');
  const adminUsersLink = document.getElementById('adminUsersLink');
  const adminCompaniesLink = document.getElementById('adminCompaniesLink');

  // Show admin navigation only for super admins (even when impersonating, so they can get back)
  const showAdminNav = userProfile && userProfile.role === 'super_admin';

  if (adminNavSection) adminNavSection.style.display = showAdminNav ? 'block' : 'none';
  if (adminUsersLink) adminUsersLink.style.display = showAdminNav ? 'block' : 'none';
  if (adminCompaniesLink) adminCompaniesLink.style.display = showAdminNav ? 'block' : 'none';
}

/**
 * Logout user
 */
function logout() {
  localStorage.removeItem('sb-supabase-auth-token');
  window.location.href = '/login';
}

// Auto-load profile when script loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadUserProfile);
} else {
  loadUserProfile();
}
