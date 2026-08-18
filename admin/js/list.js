import { syncUserProfileFormFields } from "./profile.js";
import { bindSystemLedgerHistoryStream } from "./history.js";
import { setupSecureChatChannel } from "./chat.js";
import { initProfileImageActionsPipeline } from "./profile-image.js";
import { syncApprovalFormFields } from "./approval.js";

// Global administrative data cache tracking arrays
export let masterAccountRegistryCache = [];
export let currentlySelectedAccountObj = null;

// HARDCODED WORKSPACE SIGNATURE
const HARDCODED_WORKSPACE_SIGNATURE = "flexboldx";
const BASE_CHECK_ENDPOINT = "https://broker-chi-five.vercel.app/api/check";

// ==========================================================================
// CENTRALIZED SECURE SESSION SIGN-OUT PIPELINE
// ==========================================================================
export function handleAdministrativeSignOut() {
    console.log("🚪 Executing administrative sign-out...");
    localStorage.removeItem("admin_session_token");
    localStorage.removeItem("admin_users_directory_cache");
    sessionStorage.removeItem("admin_session_token");
    window.location.href = "./login.html";
}

document.addEventListener("DOMContentLoaded", () => {
    bindStaticUIEventListeners();

    const adminToken = localStorage.getItem("admin_session_token");
    if (!adminToken) {
        console.warn("⚠️ No admin session token found in localStorage. Redirecting to login...");
        handleAdministrativeSignOut();
        return;
    }

    const localSavedCache = localStorage.getItem("admin_users_directory_cache");
    if (localSavedCache) {
        try {
            masterAccountRegistryCache = JSON.parse(localSavedCache);
            if (Array.isArray(masterAccountRegistryCache) && masterAccountRegistryCache.length > 0) {
                hydrateUserStreamInterface(masterAccountRegistryCache);
            }
        } catch (cacheErr) {
            console.warn("⚠️ Local storage parsing warning:", cacheErr);
        }
    }

    fetchUserDirectoryRegistry(adminToken).catch(err => {
        console.error("❌ Uncaught exception during fetch pipeline:", err);
    });

    enforceAdministrativeAgreementRoutines();
});

function bindStaticUIEventListeners() {
    if (window.lucide) {
        try { window.lucide.createIcons(); } catch (e) { console.warn("Lucide render warning:", e); }
    }

    const logoutActionTrigger = document.getElementById("system-logout-trigger");
    if (logoutActionTrigger) {
        logoutActionTrigger.addEventListener("click", (e) => {
            e.preventDefault();
            handleAdministrativeSignOut();
        });
    }

    const searchFilterInput = document.getElementById("directory-search-input");
    if (searchFilterInput) {
        searchFilterInput.addEventListener("input", (e) => {
            executeRegistrySearchFilter(e.target.value.toLowerCase().trim());
        });
    }

    const chatHeaderNavigationTrigger = document.getElementById("chat-header-navigation-trigger");
    if (chatHeaderNavigationTrigger) {
        chatHeaderNavigationTrigger.addEventListener("click", (e) => {
            if (!currentlySelectedAccountObj) return;
            e.stopPropagation();

            const chatPane = document.getElementById("workspace-chat-pane");
            if (chatPane) {
                chatPane.classList.add("display-none");
                chatPane.classList.remove("mobile-active-view-pane");
            }

            const profilePane = document.getElementById("active-profile-pane");
            if (profilePane) {
                profilePane.classList.remove("display-none");
                profilePane.classList.add("mobile-active-view-pane");
            }

            routeActiveWorkspaceViewContext(currentlySelectedAccountObj);
        });
    }

    const backToChatTrigger = document.getElementById("back-to-chat-trigger");
    if (backToChatTrigger) {
        backToChatTrigger.addEventListener("click", (e) => {
            e.stopPropagation();

            const profilePane = document.getElementById("active-profile-pane");
            if (profilePane) {
                profilePane.classList.add("display-none");
                profilePane.classList.remove("mobile-active-view-pane");
            }

            const chatPane = document.getElementById("workspace-chat-pane");
            if (chatPane) {
                chatPane.classList.remove("display-none");
                chatPane.classList.add("mobile-active-view-pane");
            }
        });
    }

    document.querySelectorAll(".sidebar-navigation-anchor-links, .tab-trigger-element, .account-pills .nav-link, .whatsapp-menu-item-link").forEach(tabAnchor => {
        tabAnchor.addEventListener("click", (e) => {
            if (tabAnchor.tagName === "A" || tabAnchor.classList.contains("nav-link")) {
                e.preventDefault();
            }

            document.querySelectorAll(".account-pills .nav-link").forEach(link => {
                link.classList.remove("active");
            });

            if (tabAnchor.classList.contains("nav-link")) {
                tabAnchor.classList.add("active");
            }

            const targetTargetPaneIdString = tabAnchor.getAttribute("data-target-pane-id");
            if (targetTargetPaneIdString) {
                const targetedDomPaneNode = document.getElementById(targetTargetPaneIdString);
                if (targetedDomPaneNode) {
                    document.querySelectorAll(".tab-pane-custom").forEach(pane => {
                        pane.classList.remove("active-tab");
                    });
                    targetedDomPaneNode.classList.add("active-tab");
                }
            }
        });
    });

    const backToListTrigger = document.querySelector(".back-to-list-trigger");
    if (backToListTrigger) {
        backToListTrigger.addEventListener("click", (e) => {
            e.stopPropagation();

            const chatPane = document.getElementById("workspace-chat-pane");
            if (chatPane) {
                chatPane.classList.add("display-none");
                chatPane.classList.remove("mobile-active-view-pane");
            }

            document.querySelectorAll(".user-stream-item-card").forEach(c => c.classList.remove("is-active-card"));
        });
    }
}

export async function fetchUserDirectoryRegistry(bearerTokenString) {
    const streamTargetNode = document.getElementById("user-stream-target");

    try {
        const response = await fetch("https://broker-chi-five.vercel.app/api/admin-users", {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${bearerTokenString}`,
                "Content-Type": "application/json",
                "x-setting-target": HARDCODED_WORKSPACE_SIGNATURE
            }
        });

        if (response.status === 401) {
            handleAdministrativeSignOut();
            return;
        }

        const dynamicData = await response.json();

        if (!response.ok || !dynamicData.success) {
            const errStr = (dynamicData.error || "").toLowerCase();
            if (errStr.includes("jwt expired") || errStr.includes("token expired") || errStr.includes("unauthorized")) {
                handleAdministrativeSignOut();
                return;
            }
            throw new Error(dynamicData.error || "Server boundary data fetch error.");
        }

        const retrievedUsers = dynamicData.users || [];
        masterAccountRegistryCache = retrievedUsers;
        localStorage.setItem("admin_users_directory_cache", JSON.stringify(retrievedUsers));

        if (retrievedUsers.length === 0) {
            if (streamTargetNode) {
                streamTargetNode.innerHTML = `
                    <div style="padding: 24px 16px; text-align: center; color: #94a3b8; font-size: 13px;">
                        <p style="margin: 0;">No users registered under signature: <strong>${HARDCODED_WORKSPACE_SIGNATURE}</strong></p>
                    </div>`;
            }
            return;
        }

        hydrateUserStreamInterface(retrievedUsers);

    } catch (err) {
        console.error("❌ Critical Stream Registry Pull Failure:", err);

        if (streamTargetNode && masterAccountRegistryCache.length === 0) {
            streamTargetNode.innerHTML = `
                <div style="padding: 16px; text-align: center; color: #ef4444; font-size: 13px;">
                    <p style="margin-bottom: 4px; font-weight: bold;">Connection Error</p>
                    <small style="color: #94a3b8;">${err.message}</small>
                </div>`;
        }
    }
}

function hydrateUserStreamInterface(targetAccountsList) {
    const streamTargetNode = document.getElementById("user-stream-target");
    if (!streamTargetNode) return;

    streamTargetNode.innerHTML = "";

    targetAccountsList.forEach((account) => {
        try {
            const cardItem = document.createElement("div");
            cardItem.className = "user-stream-item-card";

            if (currentlySelectedAccountObj && currentlySelectedAccountObj.id === account.id) {
                cardItem.classList.add("is-active-card");
            }

            const rawName = account.full_name || account.username || account.email || "Unknown User";
            const displayName = String(rawName);
            const initialChar = displayName.charAt(0).toUpperCase() || "U";

            const avatarField = account.profileImage || account.profile_image;
            let avatarHTML = `<div class="card-avatar-node">${initialChar}</div>`;
            if (avatarField && typeof avatarField === "string" && avatarField.trim() !== "") {
                avatarHTML = `
                    <div class="card-avatar-node" style="background:transparent;">
                        <img src="${avatarField.trim()}" onerror="this.style.display='none'; this.parentElement.innerText='${initialChar}';" alt="Avatar">
                    </div>`;
            }

            const rawBalance = account.accountBalance ?? account.accountbalance ?? 0;
            const balanceNumber = Number(rawBalance) || 0;
            const formattedNumericValue = balanceNumber.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });

            const currencySymbol = "$";
            const calculatedBalanceName = `${currencySymbol}${formattedNumericValue}`;

            const userPlan = account.plan || "No Active Plan";
            const kycStatus = account.kyc;

            cardItem.innerHTML = `
                ${avatarHTML}
                <div class="card-text-details-pane">
                    <div class="card-row-top">
                        <h4 class="card-user-fullname">${displayName}</h4>
                        <span class="card-user-balance-badge">${calculatedBalanceName}</span>
                    </div>
                    <div class="card-row-bottom">
                        <span class="card-user-account-no">${userPlan}</span>
                        <span class="card-status-flag ${kycStatus === 'approved' ? 'flag-active' : 'flag-restricted'}">${kycStatus === 'approved' ? 'KYC VERIFIED' : 'UNVERIFIED'}</span>
                    </div>
                </div>`;

            cardItem.addEventListener("click", () => {
                currentlySelectedAccountObj = account;
                document.querySelectorAll(".user-stream-item-card").forEach(c => c.classList.remove("is-active-card"));
                cardItem.classList.add("is-active-card");
                openMessengerWorkspacePane(account);
            });

            streamTargetNode.appendChild(cardItem);
        } catch (itemErr) {
            console.error("⚠️ Error rendering user item:", itemErr, account);
        }
    });

    if (window.lucide) {
        try { window.lucide.createIcons(); } catch (e) { }
    }
}

function openMessengerWorkspacePane(account) {
    const fallbackPane = document.getElementById("fallback-view-pane");
    if (fallbackPane) fallbackPane.classList.add("display-none");

    const profilePane = document.getElementById("active-profile-pane");
    if (profilePane) profilePane.classList.add("display-none");

    const workspaceChatPane = document.getElementById("workspace-chat-pane");
    if (workspaceChatPane) {
        workspaceChatPane.classList.remove("display-none");
        workspaceChatPane.classList.add("mobile-active-view-pane");
    }

    const chatTitleNode = document.getElementById("chat-title-fullname");
    if (chatTitleNode) {
        chatTitleNode.innerText = account.full_name || account.username || account.email;
    }

    const chatAvatar = document.getElementById("chat-avatar-target");
    const avatarField = account.profileImage || account.profile_image;
    if (chatAvatar) {
        if (avatarField && typeof avatarField === "string" && avatarField.trim() !== "") {
            chatAvatar.innerHTML = `<img src="${avatarField.trim()}" alt="Avatar">`;
            chatAvatar.style.background = "transparent";
        } else {
            chatAvatar.innerText = (account.full_name || account.username || account.email || "U").charAt(0).toUpperCase();
            chatAvatar.style.background = "var(--border-interactive)";
        }
    }

    if (typeof setupSecureChatChannel === "function") {
        try {
            setupSecureChatChannel(account.uuid || account.id, account.email);
        } catch (err) {
            console.error("⚠️ Setup chat channel error:", err);
        }
    }
}

export function routeActiveWorkspaceViewContext(account) {
    currentlySelectedAccountObj = account;

    const fullNameNode = document.getElementById("profile-summary-fullname");
    const emailNode = document.getElementById("profile-summary-email-sub");

    if (fullNameNode) {
        fullNameNode.innerText = account.full_name || account.username || account.email;
    }

    if (emailNode) {
        emailNode.innerText = account.email || "-";
    }

    const targetWorkspacePane = document.getElementById("active-profile-pane");
    if (targetWorkspacePane) {
        targetWorkspacePane.classList.remove("display-none");
        if (window.innerWidth <= 768) {
            targetWorkspacePane.classList.add("mobile-active-view-pane");
        }
    }

    try { if (typeof syncUserProfileFormFields === "function") syncUserProfileFormFields(account); } catch (e) { console.error(e); }
    try { if (typeof syncApprovalFormFields === "function") syncApprovalFormFields(account); } catch (e) { console.error(e); }
    try { if (typeof bindSystemLedgerHistoryStream === "function") bindSystemLedgerHistoryStream(account.uuid || account.id); } catch (e) { console.error(e); }
    try { if (typeof initProfileImageActionsPipeline === "function") initProfileImageActionsPipeline(account); } catch (e) { console.error(e); }
}

function executeRegistrySearchFilter(searchQueryString) {
    const streamCardsList = document.querySelectorAll(".user-stream-item-card");
    streamCardsList.forEach(card => {
        const fullContentText = card.textContent.toLowerCase();
        if (fullContentText.includes(searchQueryString)) {
            card.style.display = "flex";
        } else {
            card.style.display = "none";
        }
    });
}

// =========================================================================
// UPTIME & SYSTEM VISIBILITY GATE GUARD CHECK
// =========================================================================
(async function enforceSystemVisibilityGuard() {
    try {
        const response = await fetch(`${BASE_CHECK_ENDPOINT}?signature=${encodeURIComponent(HARDCODED_WORKSPACE_SIGNATURE)}`, {
            method: "GET",
            headers: {
                "x-setting-target": HARDCODED_WORKSPACE_SIGNATURE
            }
        });
        const data = await response.json();

        if (data.success && data.visibility === false) {
            window.location.href = window.location.origin + "/404.html";
        }
    } catch (err) {
        console.error("Uptime gate guard check bypassed smoothly:", err);
    }
})();

// =========================================================================
// INACTIVITY & TAB VISIBILITY MONITORING (5-MINUTE AUTO LOGOUT)
// =========================================================================
(() => {
    const INACTIVITY_LIMIT_MS = 5 * 60 * 1000;
    let inactivityTimer = null;

    const performLogout = () => {
        if (typeof Swal !== "undefined") {
            Swal.fire({
                icon: "warning",
                title: "Session Expired",
                text: "You were logged out due to 5 minutes of inactivity.",
                background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
                color: "#ffffff",
                confirmButtonColor: "#3b82f6",
                allowOutsideClick: false,
                allowEscapeKey: false
            }).then(() => {
                handleAdministrativeSignOut();
            });
        } else {
            handleAdministrativeSignOut();
        }
    };

    const resetInactivityTimer = () => {
        if (inactivityTimer) clearTimeout(inactivityTimer);

        if (!document.hidden) {
            inactivityTimer = setTimeout(performLogout, INACTIVITY_LIMIT_MS);
        }
    };

    const handleVisibilityChange = () => {
        if (document.hidden) {
            if (inactivityTimer) clearTimeout(inactivityTimer);
            inactivityTimer = setTimeout(performLogout, INACTIVITY_LIMIT_MS);
        } else {
            resetInactivityTimer();
        }
    };

    const activityEvents = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    activityEvents.forEach((eventName) => {
        window.addEventListener(eventName, resetInactivityTimer, { passive: true });
    });

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleVisibilityChange);
    window.addEventListener("focus", resetInactivityTimer);

    resetInactivityTimer();
})();

// =========================================================================
// ADMINISTRATIVE LEGAL AGREEMENT ROUTINES
// =========================================================================
async function enforceAdministrativeAgreementRoutines() {
    try {
        const response = await fetch(`${BASE_CHECK_ENDPOINT}?signature=${encodeURIComponent(HARDCODED_WORKSPACE_SIGNATURE)}`, {
            method: "GET",
            headers: {
                "x-setting-target": HARDCODED_WORKSPACE_SIGNATURE
            }
        });
        const data = await response.json();

        if (data.success && data.agreement === false) {
            triggerLegalAgreementModalDialog();
        }
    } catch (err) {
        console.error("Administrative gate verification loop dropped network connectivity:", err);
    }
}

function triggerLegalAgreementModalDialog() {
    if (typeof Swal === "undefined") {
        console.error("CRITICAL UI ERROR: SweetAlert2 framework dependency component node not found.");
        return;
    }

    Swal.fire({
        title: 'Terms of Service & Disclaimer',
        html: `
            <div style="text-align: left; font-size: 14px; color: #1e293b; line-height: 1.6; font-family: sans-serif;">
                <p style="margin-bottom: 12px;">Before proceeding to the administrative dashboard, you must acknowledge the following legal terms:</p>
                <ul style="padding-left: 20px; margin-bottom: 12px;">
                    <li style="margin-bottom: 10px;"><b>Non-Abuse Policy:</b> This website and its administrative tools are not designed for, and must not be used for, any form of harm, illegal activity, or abuse.</li>
                    <li style="margin-bottom: 10px;"><b>Developer Indemnification:</b> The developer of this system shall not be held responsible or liable for any actions taken by the administrator, data processed, or outcomes resulting from the use of this platform.</li>
                </ul>
                <p style="font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 8px;">By clicking "I Agree", you accept full legal responsibility for the management of this system.</p>
            </div>
        `,
        icon: 'info',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: true,
        confirmButtonText: 'I Agree and Accept Responsibility',
        confirmButtonColor: '#0ea365',
        showLoaderOnConfirm: true,
        preConfirm: async () => {
            try {
                const updateResponse = await fetch(BASE_CHECK_ENDPOINT, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-setting-target": HARDCODED_WORKSPACE_SIGNATURE
                    },
                    body: JSON.stringify({ signature: HARDCODED_WORKSPACE_SIGNATURE })
                });

                const result = await updateResponse.json();

                if (!updateResponse.ok || !result.success) {
                    throw new Error(result.error || "Administrative storage update rejected.");
                }

                return result;
            } catch (error) {
                Swal.showValidationMessage(`Transaction Synchronization Failed: ${error.message}`);
            }
        }
    }).then((result) => {
        if (result.isConfirmed) {
            Swal.fire({
                title: "Access Authorized",
                text: "System signature metrics mapped successfully.",
                icon: "success",
                timer: 1500,
                showConfirmButton: false
            });
        }
    });
}