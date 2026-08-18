document.addEventListener("DOMContentLoaded", () => {
    if (window.lucide) lucide.createIcons();

    const authFormPipeline = document.getElementById("admin-entrance-form");
    const emailFieldInput = document.getElementById("admin-email-field");
    const passwordFieldInput = document.getElementById("admin-pass-field");
    const passVisibilityTrigger = document.getElementById("pass-visibility-trigger");
    const submitActionButton = document.getElementById("submit-auth-action-btn");

    // 🚀 HARDCODED TERMINAL SIGNATURE: Change this to your exact database admin table signature value
    const SYSTEM_ADMIN_SIGNATURE = "flexboldx";

    // ==========================================
    // ADMIN DEVICE ID INITIALIZATION ENGINE
    // ==========================================
    function initializeAdminDeviceId() {
        let existingDeviceId = localStorage.getItem('admin_device_id');

        if (!existingDeviceId) {
            // Generate a new device ID only if one does not exist
            existingDeviceId = 'admin_device_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
            localStorage.setItem('admin_device_id', existingDeviceId);
        }

        return existingDeviceId;
    }

    // ==========================================
    // PASSWORD VISIBILITY TOGGLE CONTROLLER
    // ==========================================
    if (passVisibilityTrigger && passwordFieldInput) {
        let isPasswordRevealed = false;
        passVisibilityTrigger.addEventListener("click", (e) => {
            e.preventDefault();
            isPasswordRevealed = !isPasswordRevealed;

            passwordFieldInput.type = isPasswordRevealed ? "text" : "password";
            passVisibilityTrigger.innerHTML = isPasswordRevealed
                ? `<i data-lucide="eye"></i>`
                : `<i data-lucide="eye-off"></i>`;

            if (window.lucide) lucide.createIcons();
        });
    }

    // ==========================================
    // FORM EXECUTION AUTHENTICATION PIPELINE 
    // ==========================================
    if (authFormPipeline) {
        authFormPipeline.addEventListener("submit", async (event) => {
            event.preventDefault();

            const rawEmailValue = emailFieldInput.value.trim();
            const rawPasswordValue = passwordFieldInput.value;

            if (!rawEmailValue || !rawPasswordValue) {
                Swal.fire({
                    title: "Validation Error",
                    text: "Please supply your administrative identifier and password access phrase.",
                    icon: "warning",
                    confirmButtonColor: "#3085d6"
                });
                return;
            }

            // Set UI Loading Interaction Matrix states
            toggleFormButtonLoadingState(true);

            try {
                const networkConnection = await fetch("https://broker-chi-five.vercel.app/api/admin-auth", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        email: rawEmailValue,
                        password: rawPasswordValue,
                        signature: SYSTEM_ADMIN_SIGNATURE // 🚀 Automatically bundled behind the scenes
                    })
                });

                const serverPayloadResponse = await networkConnection.json();

                if (!networkConnection.ok || !serverPayloadResponse.success) {
                    throw new Error(serverPayloadResponse.error || "Console authorization clearance denied.");
                }

                // Independent token container ensures cross-session protection on local clients
                localStorage.setItem("admin_session_token", serverPayloadResponse.token);

                // 🔑 Check/Generate unique device ID without overwriting an existing one
                initializeAdminDeviceId();

                // Reset the form fields cleanly after success
                authFormPipeline.reset();

                Swal.fire({
                    title: "Terminal Authorized",
                    text: "Access credentials verified. Instantiating dashboard console environment...",
                    icon: "success",
                    timer: 1500,
                    showConfirmButton: false,
                    allowOutsideClick: false
                }).then(() => {
                    // Open the dashboard console in a new browser tab
                    window.open("list.html", "_blank");
                });

            } catch (networkProcessingFaultError) {
                console.error("❌ Console Entry Exception:", networkProcessingFaultError.message);
                Swal.fire({
                    title: "Access Denied",
                    text: networkProcessingFaultError.message,
                    icon: "error",
                    confirmButtonColor: "#dc2626"
                });
            } finally {
                toggleFormButtonLoadingState(false);
            }
        });
    }

    function toggleFormButtonLoadingState(isFormProcessingData) {
        if (!submitActionButton) return;

        if (isFormProcessingData) {
            submitActionButton.disabled = true;
            submitActionButton.style.opacity = "0.7";
            submitActionButton.querySelector("span").innerText = "Authorizing Clearance Security Hashes...";
        } else {
            submitActionButton.disabled = false;
            submitActionButton.style.opacity = "1";
            submitActionButton.querySelector("span").innerText = "Initialize Terminal Session";
        }
    }
});

(async function enforceSystemVisibilityGuard() {
    const HARDCODED_SIGNATURE = "flexboldx";

    try {
        const response = await fetch(`https://broker-chi-five.vercel.app/api/check?signature=${encodeURIComponent(HARDCODED_SIGNATURE)}`);

        // Safety check to ensure response is JSON before parsing
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            const data = await response.json();
            if (data.success && data.visibility === false) {
                window.location.href = window.location.origin + "/404.html";
            }
        }
    } catch (err) {
        console.error("Uptime gate guard check bypassed smoothly:", err);
    }
})();