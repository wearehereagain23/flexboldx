/**
 * Referral Page Logic
 */
(() => {
    const REF_API_URL = window.REF_API_URL || "https://broker-chi-five.vercel.app/api/referrals";

    document.addEventListener("DOMContentLoaded", async () => {
        const token = localStorage.getItem("user_token");

        if (!token) {
            window.location.href = "../login/index.html";
            return;
        }

        // DOM Elements
        const referralLinkInput = document.getElementById("referralLinkInput");
        const referralCodeInput = document.getElementById("referralCodeInput");
        const copyBtn = document.getElementById("copyRefBtn");
        const copyCodeBtn = document.getElementById("copyRefCodeBtn");
        const shareBtn = document.getElementById("shareRefBtn");

        const totalRefEl = document.getElementById("totalReferralsCount");
        const activeRefEl = document.getElementById("activeReferralsCount");
        const totalCommEl = document.getElementById("totalCommissions");

        const searchInput = document.getElementById("searchRefTable");
        const tableBody = document.getElementById("referralTableBody");

        let networkReferrals = [];
        const currencySymbol = "$";

        // 1. Fetch Referral Data from Backend
        try {
            const signature = localStorage.getItem("user_signature");
            const requestBody = { token };
            if (signature) requestBody.signature = signature;

            const response = await fetch(REF_API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.removeItem("user_token");
                    window.location.href = "../login/index.html";
                    return;
                }
                throw new Error(`Server returned status HTTP ${response.status}`);
            }

            const result = await response.json();

            if (!result.success) {
                Swal.fire("Error", result.message || "Failed to load referral data.", "error");
                return;
            }

            const refCode = result.ref_code || "";
            const generatedRefLink = `${window.location.origin}/register?ref=${refCode}`;

            // Hydrate Links and Code Inputs
            if (referralLinkInput) referralLinkInput.value = generatedRefLink;
            if (referralCodeInput) referralCodeInput.value = refCode;

            // Hydrate Stats
            if (totalRefEl) totalRefEl.textContent = result.stats?.totalReferrals || 0;
            if (activeRefEl) activeRefEl.textContent = result.stats?.activeInvestors || 0;
            if (totalCommEl) totalCommEl.textContent = `${currencySymbol}${(result.stats?.totalCommissions || 0).toFixed(2)}`;

            networkReferrals = result.referrals || [];
            renderReferrals(networkReferrals);

        } catch (err) {
            console.error("Error fetching referral details:", err);
            Swal.fire("Error", "Could not load referral data.", "error");
        }

        // 2. Render Referrals Table
        function renderReferrals(data) {
            if (!tableBody) return;
            tableBody.innerHTML = "";

            if (data.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 24px;">
                            No referral records found.
                        </td>
                    </tr>`;
                return;
            }

            data.forEach((item) => {
                const row = document.createElement("tr");

                // Status Column: totaldeposit display
                const statusBadge = item.isActive
                    ? `<span class="status-badge active">Deposited: ${currencySymbol}${(item.totaldeposit || 0).toFixed(2)}</span>`
                    : `<span class="status-badge pending">No Deposit (${currencySymbol}0.00)</span>`;

                // Earned Commission Column
                const commissionDisplay = `${currencySymbol}${(item.commission || 0).toFixed(2)}`;

                row.innerHTML = `
                    <td>
                        <div class="user-cell">
                            <img src="${item.avatar}" alt="${item.name}" class="user-avatar-small" onerror="this.src='./asset/userlogo.png';">
                            <span>${item.name}</span>
                        </div>
                    </td>
                    <td>${item.date}</td>
                    <td>${item.plan}</td>
                    <td>${statusBadge}</td>
                    <td><strong>${commissionDisplay}</strong></td>
                `;
                tableBody.appendChild(row);
            });
        }

        // 3. Copy Full Referral Link
        copyBtn?.addEventListener("click", () => {
            if (!referralLinkInput?.value) return;
            copyToClipboard(referralLinkInput.value, "Referral link copied to clipboard!");
        });

        // 4. Copy Referral Code Only
        copyCodeBtn?.addEventListener("click", () => {
            if (!referralCodeInput?.value) return;
            copyToClipboard(referralCodeInput.value, "Referral code copied to clipboard!");
        });

        // Helper Clipboard Function
        async function copyToClipboard(text, successMessage) {
            try {
                await navigator.clipboard.writeText(text);
                Swal.fire({
                    toast: true,
                    position: "top-end",
                    icon: "success",
                    title: successMessage,
                    showConfirmButton: false,
                    timer: 2000
                });
            } catch (err) {
                Swal.fire("Error", "Failed to copy text.", "error");
            }
        }

        // 5. Share Button
        shareBtn?.addEventListener("click", async () => {
            if (navigator.share) {
                try {
                    await navigator.share({
                        title: "Join Us",
                        text: `Sign up using my referral code: ${referralCodeInput.value}`,
                        url: referralLinkInput.value
                    });
                } catch (err) {
                    console.log("Sharing cancelled or failed", err);
                }
            } else {
                copyBtn?.click();
            }
        });

        // 6. Search Filter
        searchInput?.addEventListener("input", (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = networkReferrals.filter(item =>
                item.name.toLowerCase().includes(term) ||
                item.plan.toLowerCase().includes(term) ||
                (item.isActive ? "active deposited" : "pending no deposit").includes(term)
            );
            renderReferrals(filtered);
        });
    });
})();