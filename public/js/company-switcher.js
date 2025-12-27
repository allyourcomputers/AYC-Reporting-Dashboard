// Company Switcher Component
// Manages company selection, user profile display, and impersonation

let userProfile = null;

/**
 * Load cached logo immediately on page load to prevent flickering
 */
function loadCachedLogo() {
  const cachedLogoData = localStorage.getItem('company-logo-cache');
  if (cachedLogoData) {
    try {
      const { logoUrl, companyName } = JSON.parse(cachedLogoData);
      const logoImg = document.querySelector('.sidebar .logo img');
      if (logoImg && logoUrl) {
        logoImg.src = logoUrl;
        logoImg.alt = companyName || 'Company Logo';
      }
    } catch (error) {
      console.error('Error loading cached logo:', error);
    }
  }
}

/**
 * Cache the current company logo for instant loading on next page load
 */
function cacheCompanyLogo(logoUrl, companyName) {
  try {
    localStorage.setItem('company-logo-cache', JSON.stringify({
      logoUrl: logoUrl || '/images/logo.png',
      companyName: companyName || 'Company Dashboard'
    }));
  } catch (error) {
    console.error('Error caching logo:', error);
  }
}

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
        localStorage.removeItem('company-logo-cache');
        window.location.href = '/login';
        return;
      }
      throw new Error('Failed to load user profile');
    }

    userProfile = await response.json();
    renderCompanySwitcher();
    updateSidebar();
    updateAdminNavigation();
  } catch (error) {
    console.error('Error loading user profile:', error);
  }
}

/**
 * Render the company switcher UI (top banner - impersonation only)
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
          <button class="btn-stop-impersonation" data-action="stop-impersonation">
            Stop Impersonation
          </button>
        </div>
      </div>
    `;
  }

  container.innerHTML = html;

  // Attach event listener to the button using event delegation
  const stopButton = container.querySelector('.btn-stop-impersonation');
  if (stopButton) {
    stopButton.addEventListener('click', stopImpersonation);
  }
}

/**
 * Update the sidebar with user profile information
 */
function updateSidebar() {
  // Update company logo
  const logoImg = document.querySelector('.sidebar .logo img');
  if (logoImg) {
    const activeCompany = userProfile.companies?.find(c => c.id === userProfile.activeCompanyId);
    if (activeCompany && activeCompany.logoUrl) {
      logoImg.src = activeCompany.logoUrl;
      logoImg.alt = activeCompany.name;
      // Cache logo for next page load
      cacheCompanyLogo(activeCompany.logoUrl, activeCompany.name);
    } else {
      logoImg.src = '/images/logo.png';
      logoImg.alt = 'Company Dashboard';
      // Cache default logo
      cacheCompanyLogo('/images/logo.png', 'Company Dashboard');
    }
  }

  // Update user info section
  const userInfoElement = document.getElementById('userInfo');
  if (userInfoElement) {
    let userInfoHtml = '';

    // Super Admin Badge
    if (userProfile.role === 'super_admin') {
      userInfoHtml += '<div class="sidebar-badge">Super Admin</div>';
    }

    // User name
    userInfoHtml += `<div class="sidebar-user-name">${userProfile.fullName}</div>`;

    // Email
    const email = userProfile.isImpersonating && userProfile.impersonatedUser
      ? userProfile.impersonatedUser.email
      : userProfile.email;
    userInfoHtml += `<div class="sidebar-user-email">${email || ''}</div>`;

    // Company info
    if (userProfile.companies && userProfile.companies.length > 0) {
      const activeCompany = userProfile.companies.find(c => c.id === userProfile.activeCompanyId);

      if (userProfile.companies.length === 1) {
        // Single company - just show name
        userInfoHtml += `
          <div class="sidebar-company">
            <span class="sidebar-company-icon">🏢</span>
            <span class="sidebar-company-name">${userProfile.companies[0].name}</span>
          </div>
        `;
      } else {
        // Multiple companies - show dropdown
        userInfoHtml += `
          <div class="sidebar-company-select">
            <label for="sidebarCompanySelect" class="sidebar-company-label">
              <span class="sidebar-company-icon">🏢</span> Company:
            </label>
            <select id="sidebarCompanySelect" class="sidebar-company-dropdown" onchange="switchCompany(this.value)">
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
      userInfoHtml += `
        <div class="sidebar-company warning">
          <span>⚠️ No company assigned</span>
        </div>
      `;
    }

    userInfoElement.innerHTML = userInfoHtml;
  }
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
  localStorage.removeItem('company-logo-cache');
  window.location.href = '/login';
}

// Load cached logo immediately to prevent flickering
loadCachedLogo();

// Auto-load profile when script loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadUserProfile);
} else {
  loadUserProfile();
}
