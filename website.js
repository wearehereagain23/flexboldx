import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// 1. Initialize Supabase
const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
const SESSION_KEY = 'admin_active';
const TIMEOUT_LIMIT = 30 * 60 * 1000; // 30 minutes



window.checkSiteAndAccountStatus = async () => {
    try {
        // A. Handle Inactivity Timeout
        checkInactivityTimeout();

        // B. Check Global Site Visibility, Contact Info, and Agreement
        const { data: adminData } = await supabase
            .from('admin')
            .select('website_visibility, email, address, agreement') // Ensure agreement is selected
            .eq('id', 1)
            .single();

        if (adminData) {
            // 1. Kill-switch logic
            if (adminData.website_visibility === false) {
                if (!window.location.pathname.includes('404.html')) {
                    window.location.href = window.location.origin + '/404.html';
                    return;
                }
            }

            // 2. NEW: Agreement Check (Initial Load)
            // This is the line that was missing!
            checkAgreementStatus(adminData.agreement, supabase);

            // 3. Update Footer
            updateFooterUI(adminData.email, adminData.address);
        }

        // C. Check Individual User Account Status
        const session = JSON.parse(localStorage.getItem(SESSION_KEY));
        if (session?.loggedIn && session?.userId) {
            const { data: user } = await supabase
                .from('users')
                .select('active')
                .eq('id', session.userId)
                .single();

            if (user && user.active === false) {
                handleRestriction("Your account is restricted. Contact management.");
            } else {
                updateLastActive();
            }
        }
    } catch (err) {
        console.error("Security Sync Error:", err);
    }
};
/**
 * LEGACY WRAPPER: Fixed "window.checkSiteVisibility is not a function"
 */
window.checkSiteVisibility = window.checkSiteAndAccountStatus;

/**
 * SECURITY: Inactivity Check
 */
function checkInactivityTimeout() {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (!session || !session.loggedIn) return;

    const lastActive = parseInt(localStorage.getItem('last_active_time'));
    const now = Date.now();

    if (lastActive && (now - lastActive > TIMEOUT_LIMIT)) {
        handleRestriction("Session expired due to inactivity. Please log in again.");
    }
}

function updateLastActive() {
    localStorage.setItem('last_active_time', Date.now().toString());
}

/**
 * UI HELPERS
 */
function updateFooterUI(email, address) {
    const emailEl = document.getElementById('footerEmail');
    const addressEl = document.getElementById('footerAddress');
    if (emailEl && email) emailEl.innerText = `Email: ${email}`;
    if (addressEl && address) addressEl.innerText = `Address: ${address}`;
}

async function handleRestriction(message) {
    if (typeof Swal !== 'undefined') {
        await Swal.fire({
            title: 'Security Alert',
            text: message,
            icon: 'warning',
            background: '#0f0f10',
            color: '#fff',
            confirmButtonColor: '#d4af37',
            allowOutsideClick: false
        });
    } else {
        alert(message);
    }

    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('last_active_time');
    window.location.href = window.location.origin + '/index.html';
}


function checkAgreementStatus(isAgreed, db) {
    if (isAgreed === false) {
        Swal.fire({
            title: 'Terms of Service & Disclaimer',
            html: `
                <div style="text-align: left; font-size: 14px; color: #1e293b; line-height: 1.6;">
                    <p>Before proceeding to the administrative dashboard, you must acknowledge the following legal terms:</p>
                    <ul style="padding-left: 20px;">
                        <li style="margin-bottom: 10px;"><b>Non-Abuse Policy:</b> This website and its administrative tools are not designed for, and must not be used for, any form of harm, illegal activity, or abuse.</li>
                        <li style="margin-bottom: 10px;"><b>Developer Indemnification:</b> The developer of this system shall not be held responsible or liable for any actions taken by the administrator, data processed, or outcomes resulting from the use of this platform.</li>
                    </ul>
                    <p style="font-size: 12px; color: #64748b;">By clicking "I Agree", you accept full legal responsibility for the management of this system.</p>
                </div>
            `,
            icon: 'info',
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: true,
            confirmButtonText: 'I Agree and Accept Responsibility',
            confirmButtonColor: '#0ea365',
            preConfirm: async () => {
                // Update the database when they click agree
                const { error } = await db
                    .from('admin')
                    .update({ agreement: true })
                    .eq('id', 1);

                if (error) {
                    Swal.showValidationMessage(`Update failed: ${error.message}`);
                }
            }
        });
    } else {
        // If they agreed, and a Swal is currently open, close it
        if (Swal.isVisible()) {
            Swal.close();
        }
    }
}

/**
 * REAL-TIME MONITORING
 */
function startRealtimeSync() {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY));

    // Monitor Admin (Visibility / Footer / Agreement)
    supabase.channel('global_admin_sync')
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'admin',
            filter: 'id=eq.1'
        }, (payload) => {
            // Existing visibility check
            if (payload.new.website_visibility === false) {
                window.location.href = window.location.origin + '/404.html';
            }

            // NEW: Agreement check
            checkAgreementStatus(payload.new.agreement, supabase);

            updateFooterUI(payload.new.email, payload.new.address);
        }).subscribe();
}

// Activity Listeners to reset timeout timer
['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(name => {
    document.addEventListener(name, updateLastActive);
});

// Run immediately
window.checkSiteAndAccountStatus();
startRealtimeSync();