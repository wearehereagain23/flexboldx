// Dynamic Base API URL Detection
const API_BASE = "https://broker-chi-five.vercel.app/api";

const LOGIN_API_URL = `${API_BASE}/login-user`;
const FORGOT_API_URL = `${API_BASE}/forgot-password`;

document.addEventListener("DOMContentLoaded", () => {
    const APP_SIGNATURE = "flexboldx";
    const loginForm = document.getElementById("loginForm");
    const identifierInput = document.getElementById("identifier");
    const passwordInput = document.getElementById("password");
    const loginBtn = document.getElementById("loginBtn");
    const btnText = loginBtn?.querySelector(".btn-text");
    const btnSpinner = document.getElementById("btnSpinner");
    const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");

    // Password Toggle
    document.querySelectorAll(".password-toggle-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const targetId = btn.getAttribute("data-target");
            const input = document.getElementById(targetId);
            const icon = btn.querySelector("i");
            if (input.type === "password") {
                input.type = "text";
                icon.className = "ri-eye-line";
            } else {
                input.type = "password";
                icon.className = "ri-eye-off-line";
            }
        });
    });

    // LOGIN SUBMIT
    loginForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const identifier = identifierInput.value.trim();
        const password = passwordInput.value;

        if (!identifier || !password) {
            Swal.fire("Missing Information", "Please enter your username/email and password.", "warning");
            return;
        }

        setLoadingState(true);
        try {
            const response = await fetch(LOGIN_API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ signature: APP_SIGNATURE, identifier, password })
            });

            const result = await response.json();
            if (result.success) {
                localStorage.setItem("user_session", JSON.stringify({ token: result.token, uuid: result.user?.uuid, email: result.user?.email }));
                localStorage.setItem("user_token", result.token);
                localStorage.setItem("user_data", JSON.stringify(result.user));

                // Explicitly state full login from the official login page
                localStorage.setItem("login_type", "from_login_page");

                Swal.fire({
                    icon: "success",
                    title: "Welcome Back!",
                    text: "Login successful. Redirecting...",
                    timer: 1500,
                    showConfirmButton: false
                }).then(() => {
                    window.location.href = "../dash/index.html";
                });
            } else {
                Swal.fire("Login Failed", result.error || "Invalid credentials.", "error");
            }
        } catch (error) {
            Swal.fire("Connection Error", "Could not reach backend server.", "error");
        } finally {
            setLoadingState(false);
        }
    });

    // FORGOT PASSWORD FLOW
    forgotPasswordBtn?.addEventListener("click", async (e) => {
        e.preventDefault();
        promptEmailStep();
    });

    // Step 1: Request Email
    async function promptEmailStep() {
        const { value: email } = await Swal.fire({
            title: "Reset Password",
            input: "email",
            inputLabel: "Enter your registered email address",
            inputPlaceholder: "name@example.com",
            showCancelButton: true,
            confirmButtonText: "Send OTP Code",
            allowOutsideClick: false,
            allowEscapeKey: false,
            showLoaderOnConfirm: true,
            inputValidator: (val) => !val && "Please enter a valid email address!",
            preConfirm: async (emailVal) => {
                const cleanEmail = String(emailVal).replace(/["']/g, "").trim().toLowerCase();
                try {
                    const res = await fetch(FORGOT_API_URL, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "send_otp", email: cleanEmail, signature: APP_SIGNATURE })
                    });
                    const data = await res.json();
                    if (!data.success) {
                        Swal.showValidationMessage(data.error || "Failed to send code.");
                        return false;
                    }
                    return cleanEmail;
                } catch (err) {
                    Swal.showValidationMessage("Network error sending OTP code.");
                    return false;
                }
            }
        });

        if (email) {
            promptOtpStep(email);
        }
    }

    // Step 2: Validate OTP
    function promptOtpStep(email) {
        let timerInterval;
        let countdown = 20;

        Swal.fire({
            title: "Enter Verification Code",
            html: `
                <p style="font-size:13px; color:#64748b; margin-bottom:12px;">
                    Enter the code sent to <b style="color:#2563eb;">${email}</b>
                </p>
                <input id="swal-otp-input" class="swal2-input" placeholder="123456" maxlength="6" 
                       style="text-align:center; letter-spacing:6px; font-weight:bold; font-size:22px; width:80%; margin:10px auto;">
                <div style="margin-top:15px; font-size:13px;">
                    <button id="resend-otp-btn" type="button" disabled class="swal2-styled" 
                            style="background-color:#94a3b8; font-size:12px; padding:6px 16px; margin:0; cursor:not-allowed;">
                        Resend OTP (<span id="resend-timer">20</span>s)
                    </button>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: "Verify OTP",
            allowOutsideClick: false,
            allowEscapeKey: false,
            showLoaderOnConfirm: true,
            didOpen: () => {
                const resendBtn = document.getElementById("resend-otp-btn");
                const timerSpan = document.getElementById("resend-timer");

                timerInterval = setInterval(() => {
                    countdown--;
                    if (timerSpan) timerSpan.textContent = countdown;

                    if (countdown <= 0) {
                        clearInterval(timerInterval);
                        resendBtn.disabled = false;
                        resendBtn.style.backgroundColor = "#2563eb";
                        resendBtn.style.cursor = "pointer";
                        resendBtn.textContent = "Resend OTP";
                    }
                }, 1000);

                resendBtn.addEventListener("click", async () => {
                    resendBtn.disabled = true;
                    resendBtn.style.backgroundColor = "#94a3b8";
                    resendBtn.style.cursor = "not-allowed";
                    resendBtn.textContent = "Sending...";

                    try {
                        const res = await fetch(FORGOT_API_URL, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "send_otp", email, signature: APP_SIGNATURE })
                        });
                        const data = await res.json();
                        if (data.success) {
                            countdown = 20;
                            resendBtn.innerHTML = 'Resend OTP (<span id="resend-timer">20</span>s)';
                            clearInterval(timerInterval);
                            promptOtpStep(email);
                        } else {
                            alert(data.error || "Could not resend OTP.");
                            resendBtn.disabled = false;
                            resendBtn.textContent = "Resend OTP";
                        }
                    } catch (err) {
                        alert("Network error resending OTP.");
                        resendBtn.disabled = false;
                        resendBtn.textContent = "Resend OTP";
                    }
                });
            },
            willClose: () => {
                clearInterval(timerInterval);
            },
            preConfirm: async () => {
                const otp = document.getElementById("swal-otp-input").value.trim();
                if (!otp || otp.length !== 6 || isNaN(otp)) {
                    Swal.showValidationMessage("Please enter a valid 6-digit OTP code.");
                    return false;
                }

                try {
                    const res = await fetch(FORGOT_API_URL, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            action: "verify_otp",
                            email,
                            otp,
                            signature: APP_SIGNATURE
                        })
                    });
                    const data = await res.json();
                    if (!data.success) {
                        Swal.showValidationMessage(data.error || "Invalid verification code.");
                        return false;
                    }
                    return otp;
                } catch (err) {
                    Swal.showValidationMessage("Server communication error while verifying code.");
                    return false;
                }
            }
        }).then((result) => {
            if (result.isConfirmed && result.value) {
                promptPasswordStep(email, result.value);
            }
        });
    }

    // Step 3: Update Password
    async function promptPasswordStep(email, verifiedOtp) {
        const { value: isSuccess } = await Swal.fire({
            title: "Create New Password",
            html: `
                <div style="display:flex; flex-direction:column; gap:10px; text-align:left;">
                    <input id="swal-newpass" type="password" class="swal2-input" placeholder="New Password (min 6 chars)" style="margin:0; width:100%;">
                    <input id="swal-confirmpass" type="password" class="swal2-input" placeholder="Confirm New Password" style="margin:0; width:100%;">
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: "Update Password",
            allowOutsideClick: false,
            allowEscapeKey: false,
            showLoaderOnConfirm: true,
            preConfirm: async () => {
                const pass = document.getElementById("swal-newpass").value;
                const confirm = document.getElementById("swal-confirmpass").value;

                if (!pass || pass.length < 6) {
                    Swal.showValidationMessage("Password must be at least 6 characters.");
                    return false;
                }
                if (pass !== confirm) {
                    Swal.showValidationMessage("Passwords do not match.");
                    return false;
                }

                try {
                    const res = await fetch(FORGOT_API_URL, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            action: "reset_password",
                            email,
                            otp: verifiedOtp,
                            newPassword: pass,
                            signature: APP_SIGNATURE
                        })
                    });
                    const data = await res.json();
                    if (!data.success) {
                        Swal.showValidationMessage(data.error || "Password update failed.");
                        return false;
                    }
                    return true;
                } catch (err) {
                    Swal.showValidationMessage("Server communication fault.");
                    return false;
                }
            }
        });

        if (isSuccess) {
            Swal.fire("Password Reset Complete!", "You can now log in with your new password.", "success");
        }
    }

    function setLoadingState(isLoading) {
        if (!loginBtn) return;
        loginBtn.disabled = isLoading;
        if (btnText) btnText.style.display = isLoading ? "none" : "inline";
        if (btnSpinner) btnSpinner.style.display = isLoading ? "block" : "none";
    }
});