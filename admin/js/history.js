let currentHistoryPage = 1;
const historyRowsLimitPerPage = 10;
let contextualUserUuidString = null;
let activeModule = "deposit";
let historicalCacheRowsIndex = [];
let activeSelectedRowData = null;

const MODULE_SCHEMAS = {
    deposit: {
        tableName: "deposit",
        label: "Deposits",
        formFields: [
            { id: "amount", label: "Amount", type: "text" },
            { id: "asset_name", label: "Asset Name", type: "text" },
            { id: "address", label: "Wallet Address", type: "text" },
            { id: "username", label: "Username", type: "text" },
            { id: "date", label: "Date", type: "date" },
            { id: "status", label: "Status", type: "select", options: ["pending", "approved", "failed"] }
        ]
    },
    withdraw: {
        tableName: "withdraw",
        label: "Withdrawals",
        formFields: [
            { id: "amount", label: "Amount", type: "text" },
            { id: "withdrawal_method", label: "Withdrawal Method", type: "text" },
            { id: "crypto_bank", label: "Crypto / Bank Name", type: "text" },
            { id: "address_account", label: "Address / Account No.", type: "text" },
            { id: "acct_name", label: "Account Name", type: "text" },
            { id: "swift", label: "SWIFT Code", type: "text" },
            { id: "recipient_username", label: "Recipient Username", type: "text" },
            { id: "date", label: "Date", type: "date" },
            { id: "status", label: "Status", type: "select", options: ["pending", "approved", "failed"] }
        ]
    },
    trade: {
        tableName: "trade",
        label: "Trades",
        formFields: [
            { id: "amount", label: "Amount", type: "text" },
            { id: "market", label: "Market / Pair", type: "select", options: ["Profit", "Bonus"] },
            { id: "date", label: "Date", type: "date" },
            { id: "status", label: "Status", type: "select", options: ["pending", "approved", "failed"] }
        ]
    }
};

export async function bindSystemLedgerHistoryStream(userUuid) {
    contextualUserUuidString = userUuid;
    currentHistoryPage = 1;

    setupHistoryTabSwitchers();
    setupModalEventListeners();

    renderDynamicFormFields(activeModule);
    await fetchAndRenderHistoryLogs();

    const historyAddForm = document.getElementById("historyAddForm");
    if (historyAddForm) {
        historyAddForm.onsubmit = async (e) => {
            e.preventDefault();
            await commitNewHistoryEntry();
        };
    }
}

function setupHistoryTabSwitchers() {
    const tabBtns = document.querySelectorAll(".history-tab-btn");
    tabBtns.forEach((btn) => {
        btn.onclick = () => {
            tabBtns.forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");

            const type = btn.getAttribute("data-history-type");
            switchActiveHistoryModule(type);
        };
    });
}

function switchActiveHistoryModule(moduleKey) {
    if (!MODULE_SCHEMAS[moduleKey]) return;
    activeModule = moduleKey;
    currentHistoryPage = 1;

    const tabBtns = document.querySelectorAll(".history-tab-btn");
    tabBtns.forEach((btn) => {
        if (btn.getAttribute("data-history-type") === moduleKey) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });

    renderTableHeader();
    renderDynamicFormFields(moduleKey);
    fetchAndRenderHistoryLogs();
}

function renderTableHeader() {
    const headerRow = document.getElementById("historyTableHeader");
    if (!headerRow) return;

    headerRow.innerHTML = "<th>ID</th><th>AMOUNT</th><th style='text-align: right;'>STATUS</th>";
}

async function fetchAndRenderHistoryLogs() {
    const adminToken = localStorage.getItem("admin_session_token");
    const tbody = document.getElementById("cvcx2");
    if (!contextualUserUuidString || !tbody) return;

    tbody.innerHTML = `<tr><td colspan="3" class="table-state-cell">Loading ${MODULE_SCHEMAS[activeModule]?.label}...</td></tr>`;

    try {
        const response = await fetch(`https://broker-chi-five.vercel.app/api/admin-history?uuid=${contextualUserUuidString}&table=${activeModule}&page=${currentHistoryPage}&limit=${historyRowsLimitPerPage}`, {
            method: "GET",
            headers: { "Authorization": `Bearer ${adminToken}` }
        });

        const data = await response.json();
        if (response.ok && data.success) {
            historicalCacheRowsIndex = data.logs || [];
            renderTableRows(historicalCacheRowsIndex);
        } else {
            tbody.innerHTML = `<tr><td colspan="3" class="table-state-cell error-text">${data.error || "Failed to load records."}</td></tr>`;
        }
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="3" class="table-state-cell error-text">Error: ${err.message}</td></tr>`;
    }
}

function renderTableRows(rows) {
    const tbody = document.getElementById("cvcx2");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (!rows || rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="table-state-cell">No records found.</td></tr>`;
        return;
    }

    rows.forEach((row) => {
        const tr = document.createElement("tr");
        tr.className = "clickable-row-item";

        const statusClass = (row.status || "pending").toLowerCase();
        const formattedAmount = `$${parseFloat(row.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

        tr.innerHTML = `
            <td><span class="row-id-tag">#${row.id}</span></td>
            <td class="row-amount-cell">${formattedAmount}</td>
            <td style="text-align: right;">
                <span class="badge-status-pill status-${statusClass}">${row.status || 'Pending'}</span>
            </td>
        `;

        tr.onclick = () => openRowInspectorModal(row);
        tbody.appendChild(tr);
    });
}

function openRowInspectorModal(rowData) {
    activeSelectedRowData = rowData;
    const overlay = document.getElementById("historyEditModalOverlay");
    const container = document.getElementById("historyModalDynamicFields");
    const titleEl = document.getElementById("historyEditModalTitle");
    const subTitleEl = document.getElementById("historyEditModalSubtitle");

    if (!overlay || !container) return;

    const schema = MODULE_SCHEMAS[activeModule];
    titleEl.textContent = `Inspect & Update ${schema.label}`;
    subTitleEl.textContent = `Record ID: #${rowData.id}`;

    container.innerHTML = "";

    schema.formFields.forEach((field) => {
        const val = rowData[field.id] !== undefined && rowData[field.id] !== null ? rowData[field.id] : "";
        const item = document.createElement("div");
        item.className = "form-group-item";

        if (field.type === "select") {
            const optionsHtml = field.options.map(opt => `<option value="${opt}" ${String(val).toLowerCase() === opt.toLowerCase() ? 'selected' : ''}>${opt.toUpperCase()}</option>`).join('');
            item.innerHTML = `
                <label class="form-label">${field.label}</label>
                <select id="modal_field_${field.id}" name="${field.id}" class="form-control">${optionsHtml}</select>
            `;
        } else {
            item.innerHTML = `
                <label class="form-label">${field.label}</label>
                <input type="${field.type || 'text'}" id="modal_field_${field.id}" name="${field.id}" class="form-control" value="${val}">
            `;
        }
        container.appendChild(item);
    });

    overlay.classList.add("modal-active-state");
    if (window.lucide) lucide.createIcons();
}

function closeRowInspectorModal() {
    const overlay = document.getElementById("historyEditModalOverlay");
    if (overlay) overlay.classList.remove("modal-active-state");
    activeSelectedRowData = null;
}

function setupModalEventListeners() {
    const closeBtn = document.getElementById("closeHistoryModalBtn");
    const cancelBtn = document.getElementById("cancelHistoryModalBtn");
    const form = document.getElementById("historyEditModalForm");
    const deleteBtn = document.getElementById("deleteHistoryModalBtn");

    if (closeBtn) closeBtn.onclick = closeRowInspectorModal;
    if (cancelBtn) cancelBtn.onclick = closeRowInspectorModal;

    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            await submitRowUpdate();
        };
    }

    if (deleteBtn) {
        deleteBtn.onclick = async () => {
            if (activeSelectedRowData) {
                await deleteHistoryRecord(activeSelectedRowData.id);
            }
        };
    }
}

async function submitRowUpdate() {
    if (!activeSelectedRowData) return;

    const adminToken = localStorage.getItem("admin_session_token");
    const dispatchEmailAlert = document.getElementById("hist_edit_dispatch_email").value === "true";
    const schema = MODULE_SCHEMAS[activeModule];

    const updatePayload = {
        dispatchEmailAlert: dispatchEmailAlert,
        uuid: contextualUserUuidString
    };

    schema.formFields.forEach((field) => {
        const input = document.getElementById(`modal_field_${field.id}`);
        if (input) updatePayload[field.id] = input.value;
    });

    try {
        const response = await fetch(`https://broker-chi-five.vercel.app/api/admin-history?id=${activeSelectedRowData.id}&table=${activeModule}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${adminToken}`
            },
            body: JSON.stringify(updatePayload)
        });

        const data = await response.json();
        if (response.ok && data.success) {
            Swal.fire("Record Updated", "Ledger row updated successfully.", "success");
            closeRowInspectorModal();
            await fetchAndRenderHistoryLogs();
        } else {
            throw new Error(data.error || "Update operation failed.");
        }
    } catch (err) {
        Swal.fire("Update Error", err.message, "error");
    }
}

async function deleteHistoryRecord(id) {
    const adminToken = localStorage.getItem("admin_session_token");

    // Close preview inspector modal immediately so SweetAlert dialog displays over clean UI
    closeRowInspectorModal();

    const confirm = await Swal.fire({
        title: "Delete Record?",
        text: `Permanently remove record #${id}?`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#ef4444",
        confirmButtonText: "Yes, Delete"
    });

    if (confirm.isConfirmed) {
        try {
            const response = await fetch(`https://broker-chi-five.vercel.app/api/admin-history?id=${id}&table=${activeModule}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${adminToken}` }
            });

            const data = await response.json();
            if (response.ok && data.success) {
                Swal.fire("Deleted", "Record purged successfully.", "success");
                await fetchAndRenderHistoryLogs();
            } else {
                throw new Error(data.error || "Deletion failed.");
            }
        } catch (err) {
            Swal.fire("Error", err.message, "error");
        }
    }
}

function renderDynamicFormFields(moduleKey) {
    const container = document.getElementById("dynamicHistFields");
    if (!container) return;

    container.innerHTML = "";
    const schema = MODULE_SCHEMAS[moduleKey];
    if (!schema || !schema.formFields) return;

    schema.formFields.forEach((field) => {
        if (field.id === "amount" || field.id === "date" || field.id === "status") return;
        const itemDiv = document.createElement("div");
        itemDiv.className = "form-group-item";

        if (field.type === "select") {
            const optionsHtml = (field.options || []).map(opt => `<option value="${opt}">${opt}</option>`).join('');
            itemDiv.innerHTML = `
                <label class="form-label">${field.label}</label>
                <select id="hist_dynamic_${field.id}" name="${field.id}" class="form-control">
                    ${optionsHtml}
                </select>
            `;
        } else {
            itemDiv.innerHTML = `
                <label class="form-label">${field.label}</label>
                <input type="${field.type || 'text'}" id="hist_dynamic_${field.id}" name="${field.id}" class="form-control">
            `;
        }
        container.appendChild(itemDiv);
    });
}

async function commitNewHistoryEntry() {
    const adminToken = localStorage.getItem("admin_session_token");
    const amount = document.getElementById("hist_amount").value;
    const date = document.getElementById("hist_date").value || new Date().toISOString().split("T")[0];
    const status = document.getElementById("hist_status").value;
    const dispatchEmailAlert = document.getElementById("hist_create_dispatch_email")?.value === "true";

    const payload = {
        table: activeModule,
        uuid: contextualUserUuidString,
        amount: amount,
        date: date,
        status: status,
        dispatchEmailAlert: dispatchEmailAlert
    };

    const schema = MODULE_SCHEMAS[activeModule];
    if (schema && schema.formFields) {
        schema.formFields.forEach((field) => {
            const input = document.getElementById(`hist_dynamic_${field.id}`);
            if (input) payload[field.id] = input.value;
        });
    }

    try {
        const response = await fetch("https://broker-chi-five.vercel.app/api/admin-history", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${adminToken}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (response.ok && data.success) {
            Swal.fire("Entry Created", `${schema.label} entry committed successfully.`, "success");
            const form = document.getElementById("historyAddForm");
            if (form) form.reset();
            renderDynamicFormFields(activeModule);
            await fetchAndRenderHistoryLogs();
        } else {
            throw new Error(data.error || "Commit failed.");
        }
    } catch (err) {
        Swal.fire("Commit Failed", err.message, "error");
    }
}