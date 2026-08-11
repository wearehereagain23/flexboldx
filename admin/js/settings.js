const API_BASE_URL = 'http://localhost:5000/api';
const WS_URL = 'ws://localhost:5000';
const HARDCODED_WORKSPACE_SIGNATURE = 'flexboldx';

let wsClient = null;

// Standard session token getter matched with login.js and list.js
function getAuthToken() {
    return localStorage.getItem("admin_session_token") || "";
}

// Generate headers with Bearer token and signature header
function getAuthHeaders(extraHeaders = {}) {
    const token = getAuthToken();
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-setting-target': HARDCODED_WORKSPACE_SIGNATURE,
        ...extraHeaders
    };
}

// Redirect to login if token is missing or invalid
function handleAdministrativeSignOut() {
    console.warn("🚪 Executing administrative sign-out...");
    localStorage.removeItem("admin_session_token");
    localStorage.removeItem("admin_users_directory_cache");
    sessionStorage.removeItem("admin_session_token");
    window.location.href = "./login.html";
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('adminSettingsForm')) {
        const token = getAuthToken();
        if (!token) {
            console.warn('⚠️ No admin session token found in localStorage. Redirecting...');
            handleAdministrativeSignOut();
            return;
        }

        initSettingsModule();
        initWebSocketConnection();
    }
});

function initSettingsModule() {
    if (window.lucide) {
        try { window.lucide.createIcons(); } catch (e) { }
    }

    loadAdminSettings();
    loadAssetsList();

    document.getElementById('adminSettingsForm').addEventListener('submit', handleAdminSettingsSave);
    document.getElementById('addAssetForm').addEventListener('submit', handleAddAsset);
}

// Realtime WebSocket Listener
function initWebSocketConnection() {
    try {
        wsClient = new WebSocket(WS_URL);

        wsClient.onopen = () => {
            console.log('🟢 Connected to Settings Realtime WebSocket');
        };

        wsClient.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('⚡ Realtime Event Received:', data.type || data);

                loadAssetsList();
                loadAdminSettings();
            } catch (err) {
                console.error('Error parsing WS payload:', err);
            }
        };

        wsClient.onclose = () => {
            console.warn('🔴 WebSocket disconnected. Reconnecting in 3s...');
            setTimeout(initWebSocketConnection, 3000);
        };
    } catch (err) {
        console.warn('WebSocket client error:', err);
    }
}

// Fetch Admin Record (GET /api/admin-settings)
async function loadAdminSettings() {
    try {
        const res = await fetch(`${API_BASE_URL}/admin-settings`, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        if (res.status === 401) {
            handleAdministrativeSignOut();
            return;
        }

        const result = await res.json();

        if (result.success && result.data) {
            const data = result.data;
            const fields = [
                'address', 'bonus',
                'starter_min', 'starter_max', 'starter_des',
                'mini_min', 'mini_max', 'mini_des',
                'sliver_min', 'sliver_max', 'sliver_des',
                'gold_min', 'gold_max', 'gold_des',
                'platinum_min', 'platinum_max', 'platinum_des'
            ];

            fields.forEach(field => {
                const inputNode = document.getElementById(field);
                if (inputNode && data[field] !== undefined && data[field] !== null) {
                    inputNode.value = data[field];
                }
            });
        }
    } catch (err) {
        console.error('Failed to load admin settings:', err);
    }
}

// Save Admin Record (PUT /api/admin-settings)
async function handleAdminSettingsSave(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const payload = {};
    formData.forEach((value, key) => { payload[key] = value; });

    try {
        const res = await fetch(`${API_BASE_URL}/admin-settings`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        if (res.status === 401) {
            handleAdministrativeSignOut();
            return;
        }

        const result = await res.json();
        if (result.success) {
            Swal.fire('Success', result.message || 'Admin settings updated successfully.', 'success');
        } else {
            throw new Error(result.error);
        }
    } catch (err) {
        Swal.fire('Error', err.message || 'Failed to update settings', 'error');
    }
}

// Read Assets List (GET /api/assets)
async function loadAssetsList() {
    const listContainer = document.getElementById('assetsTodoList');
    if (!listContainer) return;

    try {
        const res = await fetch(`${API_BASE_URL}/assets`, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        if (res.status === 401) {
            handleAdministrativeSignOut();
            return;
        }

        const result = await res.json();
        if (result.success) {
            renderAssetsList(result.data || []);
        }
    } catch (err) {
        console.error('Failed to load assets:', err);
    }
}

function renderAssetsList(assets) {
    const listContainer = document.getElementById('assetsTodoList');
    listContainer.innerHTML = '';

    if (assets.length === 0) {
        listContainer.innerHTML = `<li class="empty-item">No crypto assets found. Add one above.</li>`;
        return;
    }

    assets.forEach(asset => {
        const li = document.createElement('li');
        li.className = 'todo-item';
        li.innerHTML = `
            <div class="todo-item-info">
                <input type="text" class="edit-asset-name" value="${asset.asset_name || ''}" id="asset-name-${asset.id}">
                <input type="text" class="edit-asset-address" value="${asset.asset_address || ''}" id="asset-addr-${asset.id}">
            </div>
            <div class="todo-item-actions">
                <button class="action-btn update-btn" title="Update Asset" data-id="${asset.id}">
                    <i data-lucide="check"></i>
                </button>
                <button class="action-btn delete-btn" title="Delete Asset" data-id="${asset.id}">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
        `;

        li.querySelector('.update-btn').addEventListener('click', () => handleUpdateAsset(asset.id));
        li.querySelector('.delete-btn').addEventListener('click', () => handleDeleteAsset(asset.id));

        listContainer.appendChild(li);
    });

    if (window.lucide) {
        try { window.lucide.createIcons(); } catch (e) { }
    }
}

// Add Asset (POST /api/assets)
async function handleAddAsset(e) {
    e.preventDefault();
    const nameInput = document.getElementById('new_asset_name');
    const addressInput = document.getElementById('new_asset_address');

    try {
        const res = await fetch(`${API_BASE_URL}/assets`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                asset_name: nameInput.value.trim(),
                asset_address: addressInput.value.trim()
            })
        });

        if (res.status === 401) {
            handleAdministrativeSignOut();
            return;
        }

        const result = await res.json();
        if (result.success) {
            nameInput.value = '';
            addressInput.value = '';
            loadAssetsList();
        } else {
            throw new Error(result.error);
        }
    } catch (err) {
        Swal.fire('Error', err.message || 'Failed to create asset', 'error');
    }
}

// Update Asset (PUT /api/assets)
async function handleUpdateAsset(id) {
    const nameVal = document.getElementById(`asset-name-${id}`).value.trim();
    const addrVal = document.getElementById(`asset-addr-${id}`).value.trim();

    try {
        const res = await fetch(`${API_BASE_URL}/assets`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                id: id,
                asset_name: nameVal,
                asset_address: addrVal
            })
        });

        if (res.status === 401) {
            handleAdministrativeSignOut();
            return;
        }

        const result = await res.json();
        if (result.success) {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: 'Asset updated',
                showConfirmButton: false,
                timer: 2000
            });
        } else {
            throw new Error(result.error);
        }
    } catch (err) {
        Swal.fire('Error', err.message || 'Failed to update asset', 'error');
    }
}

// Delete Asset (DELETE /api/assets)
async function handleDeleteAsset(id) {
    const confirm = await Swal.fire({
        title: 'Delete Asset?',
        text: 'This action cannot be undone.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Yes, delete'
    });

    if (!confirm.isConfirmed) return;

    try {
        const res = await fetch(`${API_BASE_URL}/assets`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
            body: JSON.stringify({ id: id })
        });

        if (res.status === 401) {
            handleAdministrativeSignOut();
            return;
        }

        const result = await res.json();
        if (result.success) {
            loadAssetsList();
        } else {
            throw new Error(result.error);
        }
    } catch (err) {
        Swal.fire('Error', err.message || 'Failed to delete asset', 'error');
    }
}