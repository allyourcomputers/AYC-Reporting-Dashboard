// Admin Companies Management
let companies = [];
let availableClients = [];
let availableNinjaOneOrgs = [];
let editingCompanyId = null;
let managingCompanyId = null;

async function init() {
  await initAuth();
  await loadCompanies();
  await loadAvailableClients();
  await loadAvailableNinjaOneOrgs();
}

/**
 * Load all companies from the API
 */
async function loadCompanies() {
  try {
    const authData = localStorage.getItem('sb-supabase-auth-token');
    const session = JSON.parse(authData);
    const token = session.access_token;

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
    renderCompanies();
  } catch (error) {
    console.error('Error loading companies:', error);
    document.getElementById('companiesGrid').innerHTML = '<p>Failed to load companies. Please try again.</p>';
  }
}

/**
 * Load available HaloPSA clients
 */
async function loadAvailableClients() {
  try {
    const authData = localStorage.getItem('sb-supabase-auth-token');
    const session = JSON.parse(authData);
    const token = session.access_token;

    const response = await fetch('/api/admin/companies/available-clients', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to load clients');
    }

    const data = await response.json();
    availableClients = data.clients;
  } catch (error) {
    console.error('Error loading clients:', error);
  }
}

/**
 * Load available NinjaOne organizations
 */
async function loadAvailableNinjaOneOrgs() {
  try {
    const authData = localStorage.getItem('sb-supabase-auth-token');
    const session = JSON.parse(authData);
    const token = session.access_token;

    const response = await fetch('/api/admin/companies/available-ninjaone-orgs', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to load NinjaOne organizations');
    }

    const data = await response.json();
    availableNinjaOneOrgs = data.organizations || [];
  } catch (error) {
    console.error('Error loading NinjaOne organizations:', error);
  }
}

/**
 * Render companies grid
 */
function renderCompanies() {
  const grid = document.getElementById('companiesGrid');

  if (companies.length === 0) {
    grid.innerHTML = '<p>No companies found. Create your first company to get started.</p>';
    return;
  }

  grid.innerHTML = companies.map(company => `
    <div class="company-card">
      <div class="company-card-header">
        <div class="company-card-title">${company.name}</div>
      </div>

      <div class="company-card-section">
        <div class="company-card-section-title">HaloPSA Clients (${company.haloPSAClients.length})</div>
        <div class="mapping-list">
          ${company.haloPSAClients.length > 0 ?
            company.haloPSAClients.map(client => `
              <div class="mapping-item">${client.name}</div>
            `).join('') :
            '<div class="mapping-empty">No HaloPSA clients assigned</div>'
          }
        </div>
      </div>

      <div class="company-card-section">
        <div class="company-card-section-title">NinjaOne Organizations (${company.ninjaOneOrgs.length})</div>
        <div class="mapping-list">
          ${company.ninjaOneOrgs.length > 0 ?
            company.ninjaOneOrgs.map(org => `
              <div class="mapping-item">${org.name}</div>
            `).join('') :
            '<div class="mapping-empty">No NinjaOne organizations assigned</div>'
          }
        </div>
      </div>

      <div class="company-card-actions">
        <button class="btn btn-primary" onclick="openEditCompanyModal('${company.id}')">
          Edit
        </button>
        <button class="btn btn-secondary" onclick="openHaloPSAModal('${company.id}')">
          HaloPSA
        </button>
        <button class="btn btn-secondary" onclick="openNinjaOneModal('${company.id}')">
          NinjaOne
        </button>
        <button class="btn btn-danger" onclick="deleteCompany('${company.id}', '${company.name}')">
          Delete
        </button>
      </div>
    </div>
  `).join('');
}

/**
 * Populate HaloPSA clients dropdown
 */
function populateHaloPSADropdown() {
  const select = document.getElementById('haloPSAClientSelect');

  if (availableClients.length === 0) {
    select.innerHTML = '<option value="">No HaloPSA clients available</option>';
    return;
  }

  // Filter out clients that are already mapped to companies
  const mappedClientIds = companies.flatMap(c => c.haloPSAClients.map(client => client.id));
  const unmappedClients = availableClients.filter(client => !mappedClientIds.includes(client.id));

  if (unmappedClients.length === 0) {
    select.innerHTML = '<option value="">All HaloPSA clients are already mapped to companies</option>';
    return;
  }

  select.innerHTML = '<option value="">-- Select a HaloPSA Client --</option>' +
    unmappedClients.map(client => `
      <option value="${client.id}" data-name="${client.name}">${client.name}</option>
    `).join('');
}

/**
 * Update company name when HaloPSA client is selected
 */
function updateCompanyNameFromClient() {
  const select = document.getElementById('haloPSAClientSelect');
  const selectedOption = select.options[select.selectedIndex];

  if (selectedOption.value) {
    const clientName = selectedOption.getAttribute('data-name');
    document.getElementById('companyName').value = clientName;
    document.getElementById('companyNameGroup').style.display = 'block';
  } else {
    document.getElementById('companyName').value = '';
    document.getElementById('companyNameGroup').style.display = 'none';
  }
}

/**
 * Open create company modal
 */
function openCreateCompanyModal() {
  editingCompanyId = null;
  document.getElementById('modalTitle').textContent = 'Create New Company from HaloPSA Client';

  // Show HaloPSA select, hide direct name input initially
  document.getElementById('haloPSASelectGroup').style.display = 'block';
  document.getElementById('companyNameGroup').style.display = 'none';

  // Populate HaloPSA clients dropdown
  populateHaloPSADropdown();

  document.getElementById('haloPSAClientSelect').value = '';
  document.getElementById('companyName').value = '';
  document.getElementById('companyLogoUrl').value = '';
  document.getElementById('companyModal').classList.add('active');
}

/**
 * Open edit company modal
 */
function openEditCompanyModal(companyId) {
  const company = companies.find(c => c.id === companyId);
  if (!company) return;

  editingCompanyId = companyId;
  document.getElementById('modalTitle').textContent = 'Edit Company';

  // Hide HaloPSA select for editing, show name input
  document.getElementById('haloPSASelectGroup').style.display = 'none';
  document.getElementById('companyNameGroup').style.display = 'block';

  document.getElementById('companyName').value = company.name;
  document.getElementById('companyLogoUrl').value = company.logoUrl || '';
  document.getElementById('companyModal').classList.add('active');
}

/**
 * Close company modal
 */
function closeCompanyModal() {
  document.getElementById('companyModal').classList.remove('active');
  editingCompanyId = null;
}

/**
 * Save company (create or update)
 */
async function saveCompany() {
  try {
    const name = document.getElementById('companyName').value.trim();
    const logoUrl = document.getElementById('companyLogoUrl').value.trim();
    const selectedClientId = document.getElementById('haloPSAClientSelect').value;

    if (!name) {
      alert('Please enter a company name');
      return;
    }

    // Get auth token
    const authData = localStorage.getItem('sb-supabase-auth-token');
    const session = JSON.parse(authData);
    const token = session.access_token;

    if (editingCompanyId) {
      // Update existing company
      const response = await fetch(`/api/admin/companies/${editingCompanyId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, logoUrl: logoUrl || null })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update company');
      }

      alert('Company updated successfully');
    } else {
      // Create new company
      if (!selectedClientId) {
        alert('Please select a HaloPSA client');
        return;
      }

      const response = await fetch('/api/admin/companies', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, logoUrl: logoUrl || null })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create company');
      }

      const result = await response.json();
      const newCompanyId = result.company.id;

      // Automatically map the selected HaloPSA client to this company
      const mapResponse = await fetch(`/api/admin/companies/${newCompanyId}/halopsa-clients`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ clientIds: [parseInt(selectedClientId)] })
      });

      if (!mapResponse.ok) {
        console.error('Failed to map HaloPSA client automatically');
        alert('Company created, but failed to map HaloPSA client. You can map it manually.');
      } else {
        alert('Company created and linked to HaloPSA client successfully!');
      }
    }

    closeCompanyModal();
    await loadCompanies();
  } catch (error) {
    console.error('Error saving company:', error);
    alert('Error: ' + error.message);
  }
}

/**
 * Delete company
 */
async function deleteCompany(companyId, companyName) {
  if (!confirm(`Are you sure you want to delete company "${companyName}"? This will remove all associated mappings. Users assigned to this company will need to be reassigned.`)) {
    return;
  }

  try {
    const authData = localStorage.getItem('sb-supabase-auth-token');
    const session = JSON.parse(authData);
    const token = session.access_token;

    const response = await fetch(`/api/admin/companies/${companyId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete company');
    }

    alert('Company deleted successfully');
    await loadCompanies();
  } catch (error) {
    console.error('Error deleting company:', error);
    alert('Error: ' + error.message);
  }
}

/**
 * Open HaloPSA mappings modal
 */
function openHaloPSAModal(companyId) {
  const company = companies.find(c => c.id === companyId);
  if (!company) return;

  managingCompanyId = companyId;
  document.getElementById('haloPSACompanyName').textContent = company.name;

  // Render checkboxes with current mappings selected
  const selectedClientIds = company.haloPSAClients.map(c => c.id);
  renderHaloPSACheckboxes(selectedClientIds);

  document.getElementById('haloPSAModal').classList.add('active');
}

/**
 * Close HaloPSA modal
 */
function closeHaloPSAModal() {
  document.getElementById('haloPSAModal').classList.remove('active');
  managingCompanyId = null;
}

/**
 * Render HaloPSA client checkboxes
 */
function renderHaloPSACheckboxes(selectedIds = []) {
  const container = document.getElementById('haloPSACheckboxes');

  if (availableClients.length === 0) {
    container.innerHTML = '<p>No HaloPSA clients available.</p>';
    return;
  }

  container.innerHTML = availableClients.map(client => `
    <div class="form-checkbox-item">
      <input
        type="checkbox"
        id="client-${client.id}"
        value="${client.id}"
        ${selectedIds.includes(client.id) ? 'checked' : ''}
      >
      <label for="client-${client.id}">${client.name}</label>
    </div>
  `).join('');
}

/**
 * Toggle select all clients
 */
function toggleSelectAllClients() {
  const checkboxes = document.querySelectorAll('#haloPSACheckboxes input[type="checkbox"]');
  const allChecked = Array.from(checkboxes).every(cb => cb.checked);

  checkboxes.forEach(cb => {
    cb.checked = !allChecked;
  });
}

/**
 * Get selected client IDs
 */
function getSelectedClientIds() {
  const checkboxes = document.querySelectorAll('#haloPSACheckboxes input[type="checkbox"]:checked');
  return Array.from(checkboxes).map(cb => parseInt(cb.value));
}

/**
 * Save HaloPSA mappings
 */
async function saveHaloPSAMappings() {
  try {
    const clientIds = getSelectedClientIds();
    const authData = localStorage.getItem('sb-supabase-auth-token');
    const session = JSON.parse(authData);
    const token = session.access_token;

    const response = await fetch(`/api/admin/companies/${managingCompanyId}/halopsa-clients`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ clientIds })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save mappings');
    }

    alert('HaloPSA client mappings saved successfully');
    closeHaloPSAModal();
    await loadCompanies();
  } catch (error) {
    console.error('Error saving HaloPSA mappings:', error);
    alert('Error: ' + error.message);
  }
}

/**
 * Open NinjaOne mappings modal
 */
function openNinjaOneModal(companyId) {
  const company = companies.find(c => c.id === companyId);
  if (!company) return;

  managingCompanyId = companyId;
  document.getElementById('ninjaOneCompanyName').textContent = company.name;

  // Render checkboxes with current mappings selected
  const selectedOrgIds = company.ninjaOneOrgs.map(org => org.id);
  renderNinjaOneCheckboxes(selectedOrgIds);

  document.getElementById('ninjaOneModal').classList.add('active');
}

/**
 * Close NinjaOne modal
 */
function closeNinjaOneModal() {
  document.getElementById('ninjaOneModal').classList.remove('active');
  managingCompanyId = null;
}

/**
 * Render NinjaOne organization checkboxes
 */
function renderNinjaOneCheckboxes(selectedIds = []) {
  const container = document.getElementById('ninjaOneCheckboxes');

  if (availableNinjaOneOrgs.length === 0) {
    container.innerHTML = '<p>No NinjaOne organizations available.</p>';
    return;
  }

  container.innerHTML = availableNinjaOneOrgs.map(org => `
    <div class="form-checkbox-item">
      <input
        type="checkbox"
        id="ninjaorg-${org.id}"
        value="${org.id}"
        data-name="${org.name}"
        ${selectedIds.includes(org.id) ? 'checked' : ''}
      >
      <label for="ninjaorg-${org.id}">${org.name}</label>
    </div>
  `).join('');
}

/**
 * Toggle select all NinjaOne orgs
 */
function toggleSelectAllNinjaOneOrgs() {
  const checkboxes = document.querySelectorAll('#ninjaOneCheckboxes input[type="checkbox"]');
  const allChecked = Array.from(checkboxes).every(cb => cb.checked);

  checkboxes.forEach(cb => {
    cb.checked = !allChecked;
  });
}

/**
 * Get selected NinjaOne organizations
 */
function getSelectedNinjaOneOrgs() {
  const checkboxes = document.querySelectorAll('#ninjaOneCheckboxes input[type="checkbox"]:checked');
  return Array.from(checkboxes).map(cb => ({
    id: parseInt(cb.value),
    name: cb.getAttribute('data-name')
  }));
}

/**
 * Save NinjaOne mappings
 */
async function saveNinjaOneMappings() {
  try {
    const organizations = getSelectedNinjaOneOrgs();
    const authData = localStorage.getItem('sb-supabase-auth-token');
    const session = JSON.parse(authData);
    const token = session.access_token;

    const response = await fetch(`/api/admin/companies/${managingCompanyId}/ninjaone-orgs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ organizations })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save mappings');
    }

    alert('NinjaOne organization mappings saved successfully');
    closeNinjaOneModal();
    await loadCompanies();
  } catch (error) {
    console.error('Error saving NinjaOne mappings:', error);
    alert('Error: ' + error.message);
  }
}

// Initialize on page load
init();
