// Domain Assignment Management
let allDomains = [];
let companies = [];
let domainAssignments = {}; // domain_name -> company_id
let selectedDomains = new Set();
let selectedCompany = null;

async function init() {
  await initAuth();
  await loadDomains();
  await loadCompanies();
  await loadAssignments();
  setupEventListeners();
}

/**
 * Load all domains from 20i
 */
async function loadDomains() {
  try {
    const authData = localStorage.getItem('sb-supabase-auth-token');
    const session = JSON.parse(authData);
    const token = session.access_token;

    const response = await fetch('/api/domains', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to load domains');
    }

    const data = await response.json();
    allDomains = data.domains || [];
    renderDomains();
    updateStats();
  } catch (error) {
    console.error('Error loading domains:', error);
    document.getElementById('domainList').innerHTML = '<p class="loading">Failed to load domains</p>';
  }
}

/**
 * Load all companies
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
    document.getElementById('companyList').innerHTML = '<p class="loading">Failed to load companies</p>';
  }
}

/**
 * Load existing domain assignments
 */
async function loadAssignments() {
  try {
    const authData = localStorage.getItem('sb-supabase-auth-token');
    const session = JSON.parse(authData);
    const token = session.access_token;

    const response = await fetch('/api/admin/domain-assignments', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      // Table might not exist yet, that's ok
      return;
    }

    const data = await response.json();
    domainAssignments = {};
    (data.assignments || []).forEach(a => {
      domainAssignments[a.domain_name] = a.company_id;
    });

    renderDomains();
    renderCompanies();
    updateStats();
  } catch (error) {
    console.error('Error loading assignments:', error);
  }
}

/**
 * Render domains list
 */
function renderDomains() {
  const searchTerm = document.getElementById('domainSearch').value.toLowerCase();
  const container = document.getElementById('domainList');

  const filteredDomains = allDomains.filter(d =>
    d.name.toLowerCase().includes(searchTerm)
  );

  if (filteredDomains.length === 0) {
    container.innerHTML = '<p class="loading">No domains found</p>';
    return;
  }

  container.innerHTML = filteredDomains.map(domain => {
    const isAssigned = domainAssignments[domain.name];
    const isSelected = selectedDomains.has(domain.name);
    const assignedCompany = isAssigned ? companies.find(c => c.id === isAssigned) : null;

    return `
      <div class="domain-item ${isSelected ? 'selected' : ''} ${isAssigned ? 'assigned' : ''}"
           data-domain="${domain.name}">
        <div>
          <strong>${domain.name}</strong>
          ${domain.hasHosting ? '<span class="domain-badge hosting">Hosting</span>' : '<span class="domain-badge">Domain Only</span>'}
          ${isAssigned ? `<div class="assignment-info">→ ${assignedCompany?.name || 'Unknown Company'}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  // Add click handlers
  container.querySelectorAll('.domain-item').forEach(item => {
    item.addEventListener('click', () => {
      const domainName = item.dataset.domain;
      if (selectedDomains.has(domainName)) {
        selectedDomains.delete(domainName);
      } else {
        selectedDomains.add(domainName);
      }
      renderDomains();
      updateButtons();
    });
  });
}

/**
 * Render companies list
 */
function renderCompanies() {
  const searchTerm = document.getElementById('companySearch').value.toLowerCase();
  const container = document.getElementById('companyList');

  const filteredCompanies = companies.filter(c =>
    c.name.toLowerCase().includes(searchTerm)
  );

  if (filteredCompanies.length === 0) {
    container.innerHTML = '<p class="loading">No companies found</p>';
    return;
  }

  container.innerHTML = filteredCompanies.map(company => {
    const isSelected = selectedCompany === company.id;
    const assignedDomains = Object.entries(domainAssignments)
      .filter(([_, companyId]) => companyId === company.id)
      .map(([domainName, _]) => domainName);

    return `
      <div class="company-item ${isSelected ? 'selected' : ''}"
           data-company-id="${company.id}">
        <div style="flex: 1;">
          <strong>${company.name}</strong>
          <div class="assignment-info">${assignedDomains.length} domains assigned</div>
          ${assignedDomains.length > 0 ? `
            <div class="company-domains">
              ${assignedDomains.slice(0, 10).map(d => `
                <div class="company-domain-item">
                  <span>${d}</span>
                  <span class="remove-domain" data-domain="${d}" data-company="${company.id}">✕</span>
                </div>
              `).join('')}
              ${assignedDomains.length > 10 ? `<div class="company-domain-item">... and ${assignedDomains.length - 10} more</div>` : ''}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  // Add click handlers for company selection
  container.querySelectorAll('.company-item').forEach(item => {
    item.addEventListener('click', (e) => {
      // Don't select if clicking remove button
      if (e.target.classList.contains('remove-domain')) return;

      const companyId = item.dataset.companyId;
      selectedCompany = selectedCompany === companyId ? null : companyId;
      renderCompanies();
      updateButtons();
    });
  });

  // Add click handlers for remove buttons
  container.querySelectorAll('.remove-domain').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const domainName = btn.dataset.domain;
      const companyId = btn.dataset.company;
      await removeDomainAssignment(domainName, companyId);
    });
  });
}

/**
 * Update statistics
 */
function updateStats() {
  document.getElementById('totalDomains').textContent = allDomains.length;
  document.getElementById('unassignedDomains').textContent =
    allDomains.filter(d => !domainAssignments[d.name]).length;
  document.getElementById('selectedDomains').textContent = selectedDomains.size;
}

/**
 * Update button states
 */
function updateButtons() {
  const assignBtn = document.getElementById('assignBtn');
  const removeAllBtn = document.getElementById('removeAllBtn');

  assignBtn.disabled = !(selectedDomains.size > 0 && selectedCompany);
  removeAllBtn.disabled = !selectedCompany;

  updateStats();
}

/**
 * Assign selected domains to selected company
 */
async function assignDomains() {
  if (!selectedCompany || selectedDomains.size === 0) return;

  try {
    const authData = localStorage.getItem('sb-supabase-auth-token');
    const session = JSON.parse(authData);
    const token = session.access_token;

    const assignments = Array.from(selectedDomains).map(domainName => ({
      domain_name: domainName,
      company_id: selectedCompany
    }));

    const response = await fetch('/api/admin/domain-assignments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ assignments })
    });

    if (!response.ok) {
      throw new Error('Failed to assign domains');
    }

    // Update local state
    selectedDomains.forEach(domainName => {
      domainAssignments[domainName] = selectedCompany;
    });

    selectedDomains.clear();
    renderDomains();
    renderCompanies();
    updateButtons();

    alert(`Successfully assigned ${assignments.length} domains`);
  } catch (error) {
    console.error('Error assigning domains:', error);
    alert('Failed to assign domains. Please try again.');
  }
}

/**
 * Remove single domain assignment
 */
async function removeDomainAssignment(domainName, companyId) {
  if (!confirm(`Remove ${domainName} from this company?`)) return;

  try {
    const authData = localStorage.getItem('sb-supabase-auth-token');
    const session = JSON.parse(authData);
    const token = session.access_token;

    const response = await fetch(`/api/admin/domain-assignments/${domainName}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to remove domain');
    }

    delete domainAssignments[domainName];
    renderDomains();
    renderCompanies();
    updateStats();
  } catch (error) {
    console.error('Error removing domain:', error);
    alert('Failed to remove domain. Please try again.');
  }
}

/**
 * Remove all domains from selected company
 */
async function removeAllDomains() {
  if (!selectedCompany) return;

  const company = companies.find(c => c.id === selectedCompany);
  const domainsToRemove = Object.entries(domainAssignments)
    .filter(([_, companyId]) => companyId === selectedCompany)
    .map(([domainName, _]) => domainName);

  if (domainsToRemove.length === 0) {
    alert('No domains assigned to this company');
    return;
  }

  if (!confirm(`Remove all ${domainsToRemove.length} domains from ${company.name}?`)) {
    return;
  }

  try {
    const authData = localStorage.getItem('sb-supabase-auth-token');
    const session = JSON.parse(authData);
    const token = session.access_token;

    const response = await fetch(`/api/admin/domain-assignments/company/${selectedCompany}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to remove domains');
    }

    domainsToRemove.forEach(domainName => {
      delete domainAssignments[domainName];
    });

    renderDomains();
    renderCompanies();
    updateStats();

    alert(`Successfully removed ${domainsToRemove.length} domains`);
  } catch (error) {
    console.error('Error removing domains:', error);
    alert('Failed to remove domains. Please try again.');
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  document.getElementById('domainSearch').addEventListener('input', renderDomains);
  document.getElementById('companySearch').addEventListener('input', renderCompanies);

  document.getElementById('assignBtn').addEventListener('click', assignDomains);
  document.getElementById('removeAllBtn').addEventListener('click', removeAllDomains);

  document.getElementById('selectAllDomains').addEventListener('click', () => {
    const searchTerm = document.getElementById('domainSearch').value.toLowerCase();
    const visibleDomains = allDomains
      .filter(d => d.name.toLowerCase().includes(searchTerm))
      .map(d => d.name);

    visibleDomains.forEach(d => selectedDomains.add(d));
    renderDomains();
    updateButtons();
  });

  document.getElementById('clearDomainSelection').addEventListener('click', () => {
    selectedDomains.clear();
    renderDomains();
    updateButtons();
  });
}

// Initialize on page load
init();
