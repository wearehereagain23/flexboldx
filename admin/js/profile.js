import { currentlySelectedAccountObj } from "./list.js";

let activeUserObject = null;

export async function syncUserProfileFormFields(userObject) {
    if (!userObject) return;
    activeUserObject = userObject;

    // Set header labels
    const fullNameHeader = document.getElementById("profile-summary-fullname");
    const emailHeader = document.getElementById("profile-summary-email-sub");
    if (fullNameHeader) fullNameHeader.textContent = userObject.full_name || userObject.username || "N/A";
    if (emailHeader) emailHeader.textContent = userObject.email || "N/A";

    const profileForm = document.getElementById("profileForm");
    if (!profileForm) return;

    const currencySymbol = "$";

    // Immediate initial sync for Plan Profit from active user object
    const planProfitEl = document.getElementById("summary_plan_profit");
    if (planProfitEl) {
        const initialProfit = parseFloat(userObject.plan_profit || 0);
        planProfitEl.textContent = `${currencySymbol}${initialProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    }

    // Populate Editable Form Fields
    if (profileForm.accountBalance) profileForm.accountBalance.value = userObject.accountBalance ?? "0";

    // User Details
    if (profileForm.full_name) profileForm.full_name.value = userObject.full_name || "";
    if (profileForm.username) profileForm.username.value = userObject.username || "";
    if (profileForm.email) profileForm.email.value = userObject.email || "";
    if (profileForm.password) profileForm.password.value = userObject.password || "";
    if (profileForm.country) profileForm.country.value = userObject.country || "";
    if (profileForm.kyc_city) profileForm.kyc_city.value = userObject.kyc_city || "";

    // System Settings Controls
    if (profileForm.progress) profileForm.progress.value = userObject.progress ?? "0";
    if (profileForm.active) profileForm.active.value = String(userObject.active ?? true);
    if (profileForm.withdrawStatus) profileForm.withdrawStatus.value = String(userObject.withdrawStatus ?? false);
    if (profileForm.ref_code) profileForm.ref_code.value = userObject.ref_code || "";
    if (profileForm.plan) profileForm.plan.value = userObject.plan || "";
    if (profileForm.pin) profileForm.pin.value = userObject.pin || "";

    // Fetch live sum metrics outside of the user database row
    await fetchAndRenderCalculatedLedgerTotals(userObject.uuid, currencySymbol, userObject.plan_profit);
}

async function fetchAndRenderCalculatedLedgerTotals(uuid, currencySymbol = "$", fallbackPlanProfit = 0) {
    if (!uuid) return;

    const totalDepEl = document.getElementById("summary_totaldeposit");
    const pendingDepEl = document.getElementById("summary_pendingdeposit");
    const totalWithEl = document.getElementById("summary_totalwithdraw");
    const pendingWithEl = document.getElementById("summary_pendingwithdraw");
    const planProfitEl = document.getElementById("summary_plan_profit");

    try {
        const adminToken = localStorage.getItem("admin_session_token");
        const res = await fetch(`https://broker-chi-five.vercel.app/api/admin-update-user?uuid=${uuid}`, {
            method: "GET",
            headers: { "Authorization": `Bearer ${adminToken}` }
        });

        const data = await res.json();
        if (res.ok && data.success) {
            const { totaldeposit, pendingdeposit, totalwithdraw, pendingwithdraw, plan_profit } = data.summary;

            if (totalDepEl) totalDepEl.textContent = `${currencySymbol}${(totaldeposit || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
            if (pendingDepEl) pendingDepEl.textContent = `${currencySymbol}${(pendingdeposit || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
            if (totalWithEl) totalWithEl.textContent = `${currencySymbol}${(totalwithdraw || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
            if (pendingWithEl) pendingWithEl.textContent = `${currencySymbol}${(pendingwithdraw || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

            if (planProfitEl) {
                const profitVal = plan_profit !== undefined ? plan_profit : fallbackPlanProfit;
                planProfitEl.textContent = `${currencySymbol}${parseFloat(profitVal || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
            }
        } else {
            console.error("Ledger calculation fetch error:", data.error);
        }
    } catch (err) {
        console.error("Failed to load user ledger summary calculations:", err);
    }
}

// Form Submission Event Execution
document.getElementById("profileForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const selectedUser = activeUserObject || currentlySelectedAccountObj;
    if (!selectedUser) {
        return Swal.fire("Warning", "No active account profile loaded.", "warning");
    }

    const form = e.target;
    const adminToken = localStorage.getItem("admin_session_token");

    // Clean payload using only fields existing in `public.users`
    const payload = {
        id: selectedUser.id,
        uuid: selectedUser.uuid,
        accountBalance: form.accountBalance ? form.accountBalance.value : selectedUser.accountBalance,
        full_name: form.full_name ? form.full_name.value : selectedUser.full_name,
        username: form.username ? form.username.value : selectedUser.username,
        email: form.email ? form.email.value : selectedUser.email,
        password: form.password ? form.password.value : selectedUser.password,
        country: form.country ? form.country.value : selectedUser.country,
        kyc_city: form.kyc_city ? form.kyc_city.value : selectedUser.kyc_city,
        progress: form.progress ? form.progress.value : selectedUser.progress,
        active: form.active ? form.active.value === "true" : selectedUser.active,
        withdrawStatus: form.withdrawStatus ? form.withdrawStatus.value === "true" : selectedUser.withdrawStatus,
        ref_code: form.ref_code ? form.ref_code.value : selectedUser.ref_code,
        plan: form.plan ? form.plan.value : selectedUser.plan,
        pin: form.pin && form.pin.value ? parseInt(form.pin.value) : selectedUser.pin
    };

    const spinnerModal = document.getElementById("spinnerModal");
    if (spinnerModal) spinnerModal.style.display = "flex";

    try {
        const response = await fetch("https://broker-chi-five.vercel.app/api/admin-update-user", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${adminToken}`
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.error || "Failed to update profile via backend endpoint.");
        }

        updateLocalCacheRecord(result.user || payload);

        Swal.fire({
            icon: "success",
            title: "Profile Saved",
            text: "User profile record was modified successfully.",
            background: "#0f172a",
            color: "#ffffff"
        });

    } catch (err) {
        console.error("❌ Profile update error:", err);
        Swal.fire({
            icon: "error",
            title: "Update Failed",
            text: err.message,
            background: "#0f172a",
            color: "#ffffff"
        });
    } finally {
        if (spinnerModal) spinnerModal.style.display = "none";
    }
});

function updateLocalCacheRecord(updatedUser) {
    const rawCache = localStorage.getItem("admin_users_directory_cache");
    if (!rawCache) return;

    try {
        let registryList = JSON.parse(rawCache);
        const index = registryList.findIndex(u => u.id === updatedUser.id || u.uuid === updatedUser.uuid);

        if (index !== -1) {
            registryList[index] = { ...registryList[index], ...updatedUser };
            localStorage.setItem("admin_users_directory_cache", JSON.stringify(registryList));
            window.dispatchEvent(new Event("adminDirectoryCacheUpdated"));
        }
    } catch (err) {
        console.warn("⚠️ Cache update exception:", err);
    }
}