// Admin Users Management
let users = [];
let companies = [];
let editingUserId = null;

async function init() {
  await initAuth();
  await loadUsers();
  await loadCompanies();
}

/**
 * Load all users from the API
 */
async function loadUsers() {
  try {
    const token = localStorage.getItem('supabase.auth.token');

    const response = await fetch('/api/admin/users', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to load users');
    }

    const data = await response.json();
    users = data.users;
    renderUsers();
  } catch (error) {
    console.error('Error loading users:', error);
    document.getElementById('usersGrid').innerHTML = '<p>Failed to load users. Please try again.</p>';
  }
}

/**
 * Load all companies for the assignment checkboxes
 */
async function loadCompanies() {
  try {
    const token = localStorage.getItem('supabase.auth.token');

    const response = await fetch('/api/admin/companies', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to load companies');
    }

    const data = await response.json();
    companies = data.companies;
  } catch (error) {
    console.error('Error loading companies:', error);
  }
}

/**
 * Render users grid
 */
function renderUsers() {
  const grid = document.getElementById('usersGrid');

  if (users.length === 0) {
    grid.innerHTML = '<p>No users found. Create your first user to get started.</p>';
    return;
  }

  grid.innerHTML = users.map(user => `
    <div class="user-card">
      <div class="user-card-header">
        <div>
          <div class="user-card-title">${user.fullName}</div>
          <div class="user-card-email">${user.email}</div>
        </div>
        <span class="badge badge-${user.role === 'super_admin' ? 'super-admin' : 'customer'}">
          ${user.role === 'super_admin' ? 'Super Admin' : 'Customer'}
        </span>
      </div>

      <div class="user-card-info">
        <div class="user-card-info-row">
          <span class="user-card-info-label">User ID</span>
          <span class="user-card-info-value">${user.id.substring(0, 8)}...</span>
        </div>
        <div class="user-card-info-row">
          <span class="user-card-info-label">Created</span>
          <span class="user-card-info-value">${new Date(user.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      ${user.companies.length > 0 ? `
        <div class="user-card-companies">
          <div class="user-card-companies-label">Assigned Companies</div>
          <div class="company-tags">
            ${user.companies.map(company => `
              <span class="company-tag">${company.name}</span>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <div class="user-card-actions">
        ${user.role === 'customer' ? `
          <button class="btn btn-impersonate" onclick="impersonateUser('${user.id}')">
            Impersonate
          </button>
        ` : ''}
        <button class="btn btn-secondary" onclick="openEditUserModal('${user.id}')">
          Edit
        </button>
        <button class="btn btn-danger" onclick="deleteUser('${user.id}', '${user.fullName}')">
          Delete
        </button>
      </div>
    </div>
  `).join('');
}

/**
 * Open create user modal
 */
function openCreateUserModal() {
  editingUserId = null;
  document.getElementById('modalTitle').textContent = 'Create New User';
  document.getElementById('userEmail').value = '';
  document.getElementById('userEmail').disabled = false;
  document.getElementById('userPassword').value = '';
  document.getElementById('passwordGroup').style.display = 'block';
  document.getElementById('userFullName').value = '';
  document.getElementById('userRole').value = 'customer';

  renderCompanyCheckboxes([]);
  toggleCompanySection();

  document.getElementById('userModal').classList.add('active');
}

/**
 * Open edit user modal
 */
function openEditUserModal(userId) {
  const user = users.find(u => u.id === userId);
  if (!user) return;

  editingUserId = userId;
  document.getElementById('modalTitle').textContent = 'Edit User';
  document.getElementById('userEmail').value = user.email;
  document.getElementById('userEmail').disabled = true;
  document.getElementById('passwordGroup').style.display = 'none';
  document.getElementById('userFullName').value = user.fullName;
  document.getElementById('userRole').value = user.role;

  renderCompanyCheckboxes(user.companies.map(c => c.id));
  toggleCompanySection();

  document.getElementById('userModal').classList.add('active');
}

/**
 * Close user modal
 */
function closeUserModal() {
  document.getElementById('userModal').classList.remove('active');
  editingUserId = null;
}

/**
 * Render company checkboxes
 */
function renderCompanyCheckboxes(selectedIds = []) {
  const container = document.getElementById('companiesCheckboxes');

  if (companies.length === 0) {
    container.innerHTML = '<p>No companies available. Create a company first.</p>';
    return;
  }

  container.innerHTML = companies.map(company => `
    <div class="form-checkbox-item">
      <input
        type="checkbox"
        id="company-${company.id}"
        value="${company.id}"
        ${selectedIds.includes(company.id) ? 'checked' : ''}
      >
      <label for="company-${company.id}">${company.name}</label>
    </div>
  `).join('');
}

/**
 * Toggle company section visibility based on role
 */
function toggleCompanySection() {
  const role = document.getElementById('userRole').value;
  const companiesGroup = document.getElementById('companiesGroup');

  if (role === 'super_admin') {
    companiesGroup.style.display = 'none';
  } else {
    companiesGroup.style.display = 'block';
  }
}

/**
 * Get selected company IDs from checkboxes
 */
function getSelectedCompanyIds() {
  const checkboxes = document.querySelectorAll('#companiesCheckboxes input[type="checkbox"]:checked');
  return Array.from(checkboxes).map(cb => cb.value);
}

/**
 * Save user (create or update)
 */
async function saveUser() {
  try {
    const email = document.getElementById('userEmail').value.trim();
    const fullName = document.getElementById('userFullName').value.trim();
    const role = document.getElementById('userRole').value;
    const companyIds = role === 'customer' ? getSelectedCompanyIds() : [];

    // Validation
    if (!email || !fullName || !role) {
      alert('Please fill in all required fields');
      return;
    }

    if (role === 'customer' && companyIds.length === 0) {
      alert('Please assign at least one company to the customer user');
      return;
    }

    const token = localStorage.getItem('supabase.auth.token');

    if (editingUserId) {
      // Update existing user
      const response = await fetch(`/api/admin/users/${editingUserId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fullName, role, companyIds })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update user');
      }

      alert('User updated successfully');
    } else {
      // Create new user
      const password = document.getElementById('userPassword').value;

      if (!password || password.length < 8) {
        alert('Password must be at least 8 characters long');
        return;
      }

      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password, fullName, role, companyIds })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create user');
      }

      alert('User created successfully');
    }

    closeUserModal();
    await loadUsers();
  } catch (error) {
    console.error('Error saving user:', error);
    alert('Error: ' + error.message);
  }
}

/**
 * Delete user
 */
async function deleteUser(userId, userName) {
  if (!confirm(`Are you sure you want to delete user "${userName}"? This action cannot be undone.`)) {
    return;
  }

  try {
    const token = localStorage.getItem('supabase.auth.token');

    const response = await fetch(`/api/admin/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete user');
    }

    alert('User deleted successfully');
    await loadUsers();
  } catch (error) {
    console.error('Error deleting user:', error);
    alert('Error: ' + error.message);
  }
}

/**
 * Impersonate user
 */
async function impersonateUser(userId) {
  try {
    const token = localStorage.getItem('supabase.auth.token');

    const response = await fetch(`/api/profile/impersonate/${userId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to start impersonation');
    }

    // Redirect to dashboard to see the impersonated user's view
    window.location.href = '/';
  } catch (error) {
    console.error('Error starting impersonation:', error);
    alert('Error: ' + error.message);
  }
}

// Initialize on page load
init();
