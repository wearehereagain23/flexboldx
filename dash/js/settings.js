document.addEventListener("DOMContentLoaded", () => {
    const API_BASE = window.API_BASE || "https://broker-chi-five.vercel.app/api";

    // Helper to get platform/tenant signature
    function getStoredSignature() {
        return localStorage.getItem("signature") ||
            localStorage.getItem("broker_signature") ||
            window.SIGNATURE ||
            "default";
    }

    function getStoredEmail() {
        let email = localStorage.getItem("email") ||
            localStorage.getItem("user_email") ||
            localStorage.getItem("userEmail");

        if (!email) {
            try {
                const sessionData = localStorage.getItem("user_session");
                if (sessionData) {
                    const parsed = JSON.parse(sessionData);
                    email = parsed.email;
                }
            } catch (e) { }
        }

        if (!email) {
            try {
                const userData = localStorage.getItem("user_data");
                if (userData) {
                    const parsed = JSON.parse(userData);
                    email = parsed.email;
                }
            } catch (e) { }
        }

        return email ? String(email).replace(/["']/g, '').trim().toLowerCase() : null;
    }

    function getStoredToken() {
        let token = localStorage.getItem("token") ||
            localStorage.getItem("user_token") ||
            localStorage.getItem("jwt_token");

        if (token) return token.replace(/["']/g, '');

        try {
            const sessionData = localStorage.getItem("user_session");
            if (sessionData) {
                const parsed = JSON.parse(sessionData);
                if (parsed.token) return parsed.token;
            }
        } catch (e) { }

        return null;
    }

    function clearUserSessionAndRedirect() {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = "../login/index.html";
    }

    const token = getStoredToken();

    // -------------------------------------------------------------
    // CHANGE PASSWORD FORM HANDLER
    // -------------------------------------------------------------
    const changePasswordForm = document.getElementById("changePasswordForm");
    changePasswordForm?.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (!token) {
            return Swal.fire("Session Expired", "Please log in again to perform this action.", "error");
        }

        const currentPassword = document.getElementById("currentPassword").value;
        const newPassword = document.getElementById("newPassword").value;
        const confirmPassword = document.getElementById("confirmPassword").value;

        if (newPassword !== confirmPassword) {
            return Swal.fire("Error", "New password and confirmation do not match.", "error");
        }

        Swal.showLoading();
        try {
            const res = await fetch(`${API_BASE}/password-pin-change`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    action: "change_password",
                    currentPassword,
                    newPassword
                })
            });

            const result = await res.json();
            if (result.success) {
                Swal.fire("Success", result.message, "success").then(() => changePasswordForm.reset());
            } else {
                Swal.fire("Error", result.error || "Failed to update password.", "error");
            }
        } catch (err) {
            Swal.fire("Error", "Network error updating password.", "error");
        }
    });

    // -------------------------------------------------------------
    // CHANGE PIN FORM HANDLER
    // -------------------------------------------------------------
    const changePinForm = document.getElementById("changePinForm");
    changePinForm?.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (!token) {
            return Swal.fire("Session Expired", "Please log in again to perform this action.", "error");
        }

        const currentPin = document.getElementById("currentPin").value;
        const newPin = document.getElementById("newPin").value;
        const confirmPin = document.getElementById("confirmPin").value;

        if (newPin !== confirmPin) {
            return Swal.fire("Error", "New PIN and confirmation do not match.", "error");
        }

        Swal.showLoading();
        try {
            const res = await fetch(`${API_BASE}/password-pin-change`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    action: "change_pin",
                    currentPin,
                    newPin
                })
            });

            const result = await res.json();
            if (result.success) {
                Swal.fire("Success", result.message, "success").then(() => changePinForm.reset());
            } else {
                Swal.fire("Error", result.error || "Failed to update PIN.", "error");
            }
        } catch (err) {
            Swal.fire("Error", "Network error updating PIN.", "error");
        }
    });

    // -------------------------------------------------------------
    // FORGOT PASSWORD FLOW
    // -------------------------------------------------------------
    const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");
    forgotPasswordBtn?.addEventListener("click", async (e) => {
        e.preventDefault();

        const activeEmail = getStoredEmail();
        const activeSignature = getStoredSignature();

        if (!activeEmail) {
            return Swal.fire("Error", "Email address not found in active session.", "error");
        }

        const confirmSend = await Swal.fire({
            title: "Reset Password",
            text: `Send security verification code to ${activeEmail}?`,
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Send Code",
            showLoaderOnConfirm: true,
            allowOutsideClick: false,
            allowEscapeKey: false,
            preConfirm: async () => {
                try {
                    const res = await fetch(`${API_BASE}/forgot-password`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            action: "send_otp",
                            email: activeEmail,
                            signature: activeSignature
                        })
                    });
                    const result = await res.json();
                    if (!result.success) {
                        Swal.showValidationMessage(result.error || "Failed to send security code.");
                        return false;
                    }
                    return true;
                } catch (err) {
                    Swal.showValidationMessage("Network error sending security code.");
                    return false;
                }
            }
        });

        if (confirmSend.isConfirmed) {
            openOtpVerificationModal(activeEmail, activeSignature);
        }
    });

    function openOtpVerificationModal(activeEmail, activeSignature) {
        let timerInterval;
        let countdown = 20;

        Swal.fire({
            title: "Security Verification",
            html: `
                <p style="font-size:13px; color:#94a3b8; margin-bottom:15px;">
                    Enter the code sent to <b style="color:#38bdf8;">${activeEmail}</b> along with your new password.
                </p>
                <div style="display:flex; flex-direction:column; gap:12px; text-align:left;">
                    <div>
                        <label style="font-size:12px; color:#cbd5e1; font-weight:600;">6-Digit OTP Code</label>
                        <input id="swal-otp" class="swal2-input" placeholder="123456" maxlength="6" 
                               style="text-align:center; letter-spacing:6px; font-weight:bold; font-size:20px; width:100%; margin:5px 0 0 0;">
                    </div>
                    <div>
                        <label style="font-size:12px; color:#cbd5e1; font-weight:600;">New Password</label>
                        <input id="swal-newpass" type="password" class="swal2-input" placeholder="Min. 8 characters" 
                               style="width:100%; margin:5px 0 0 0;">
                    </div>
                    <div>
                        <label style="font-size:12px; color:#cbd5e1; font-weight:600;">Confirm New Password</label>
                        <input id="swal-confirmpass" type="password" class="swal2-input" placeholder="Re-enter new password" 
                               style="width:100%; margin:5px 0 0 0;">
                    </div>
                    <div style="text-align:center; margin-top:8px;">
                        <button id="resend-settings-otp" type="button" disabled class="swal2-styled" 
                                style="background-color:#64748b; font-size:12px; padding:6px 14px; margin:0; cursor:not-allowed;">
                            Resend Code (<span id="settings-timer">20</span>s)
                        </button>
                    </div>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: "Update Password",
            showLoaderOnConfirm: true,
            allowOutsideClick: false,
            allowEscapeKey: false,
            didOpen: () => {
                const resendBtn = document.getElementById("resend-settings-otp");
                const timerSpan = document.getElementById("settings-timer");

                timerInterval = setInterval(() => {
                    countdown--;
                    if (timerSpan) timerSpan.textContent = countdown;

                    if (countdown <= 0) {
                        clearInterval(timerInterval);
                        if (resendBtn) {
                            resendBtn.disabled = false;
                            resendBtn.style.backgroundColor = "#38bdf8";
                            resendBtn.style.cursor = "pointer";
                            resendBtn.textContent = "Resend Code";
                        }
                    }
                }, 1000);

                resendBtn?.addEventListener("click", async () => {
                    resendBtn.disabled = true;
                    resendBtn.style.backgroundColor = "#64748b";
                    resendBtn.style.cursor = "not-allowed";
                    resendBtn.textContent = "Sending...";

                    try {
                        const res = await fetch(`${API_BASE}/forgot-password`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                action: "send_otp",
                                email: activeEmail,
                                signature: activeSignature
                            })
                        });
                        const result = await res.json();
                        if (result.success) {
                            countdown = 20;
                            resendBtn.innerHTML = 'Resend Code (<span id="settings-timer">20</span>s)';
                            clearInterval(timerInterval);
                            openOtpVerificationModal(activeEmail, activeSignature);
                        } else {
                            alert(result.error || "Failed to resend code.");
                            resendBtn.disabled = false;
                            resendBtn.textContent = "Resend Code";
                        }
                    } catch (err) {
                        alert("Network error resending code.");
                        resendBtn.disabled = false;
                        resendBtn.textContent = "Resend Code";
                    }
                });
            },
            willClose: () => {
                clearInterval(timerInterval);
            },
            preConfirm: async () => {
                const otp = document.getElementById("swal-otp")?.value.trim();
                const newPassword = document.getElementById("swal-newpass")?.value;
                const confirmPassword = document.getElementById("swal-confirmpass")?.value;

                if (!otp || otp.length !== 6 || isNaN(otp)) {
                    Swal.showValidationMessage("Please enter a valid 6-digit OTP.");
                    return false;
                }
                if (!newPassword || newPassword.length < 8) {
                    Swal.showValidationMessage("New password must be at least 8 characters long.");
                    return false;
                }
                if (newPassword !== confirmPassword) {
                    Swal.showValidationMessage("New passwords do not match.");
                    return false;
                }

                try {
                    const res = await fetch(`${API_BASE}/forgot-password`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            action: "reset_password",
                            email: activeEmail,
                            signature: activeSignature,
                            otp,
                            newPassword
                        })
                    });
                    const result = await res.json();

                    if (!result.success) {
                        Swal.showValidationMessage(result.error || "Password reset failed.");
                        return false;
                    }
                    return result;
                } catch (err) {
                    Swal.showValidationMessage("Server communication error.");
                    return false;
                }
            }
        }).then((result) => {
            if (result.isConfirmed && result.value?.success) {
                Swal.fire("Success!", "Your password has been updated successfully.", "success");
            }
        });
    }

    // -------------------------------------------------------------
    // LOGOUT HANDLER
    // -------------------------------------------------------------
    const logoutActionBtn = document.getElementById("logoutActionBtn");
    const sidebarLogoutBtn = document.getElementById("out");

    const performLogout = () => {
        Swal.fire({
            title: "Log Out",
            text: "Are you sure you want to log out of your session?",
            icon: "question",
            showCancelButton: true,
            confirmButtonColor: "#38bdf8",
            confirmButtonText: "Yes, Log Out"
        }).then((res) => {
            if (res.isConfirmed) {
                clearUserSessionAndRedirect();
            }
        });
    };

    logoutActionBtn?.addEventListener("click", performLogout);
    sidebarLogoutBtn?.addEventListener("click", performLogout);

    // -------------------------------------------------------------
    // DELETE ACCOUNT HANDLER
    // -------------------------------------------------------------
    const deleteAccountBtn = document.getElementById("deleteAccountBtn");

    deleteAccountBtn?.addEventListener("click", async () => {
        if (!token) {
            return Swal.fire("Session Expired", "Please log in again.", "error");
        }

        const confirmDelete = await Swal.fire({
            title: "Delete Account?",
            text: "This action is permanent and cannot be undone. You must withdraw all remaining balance first.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#ef4444",
            confirmButtonText: "Delete Account",
            showLoaderOnConfirm: true,
            allowOutsideClick: () => !Swal.isLoading(),
            preConfirm: async () => {
                try {
                    const res = await fetch(`${API_BASE}/delete-user`, {
                        method: "DELETE",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${token}`
                        }
                    });

                    const result = await res.json();
                    if (!result.success) {
                        Swal.showValidationMessage(result.error || "Failed to delete account.");
                        return false;
                    }
                    return result;
                } catch (err) {
                    Swal.showValidationMessage("Network error processing account deletion.");
                    return false;
                }
            }
        });

        if (confirmDelete.isConfirmed && confirmDelete.value?.success) {
            await Swal.fire("Deleted!", "Your account has been successfully removed.", "success");
            clearUserSessionAndRedirect();
        }
    });
});