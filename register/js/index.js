/**
 * Flexboldx Registration Logic & API Integration
 */

const API_BASE_URL = "https://broker-chi-five.vercel.app/api/register-user";
const APP_SIGNATURE = "flexboldx";

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("registrationForm");

    // Inputs
    const fullNameInput = document.getElementById("fullName");
    const usernameInput = document.getElementById("username");
    const emailInput = document.getElementById("useremail");
    const countryInput = document.getElementById("country");
    const passwordInput = document.getElementById("password");
    const confirmPasswordInput = document.getElementById("con_password");
    const referralInput = document.getElementById("referralCode");
    const agreeTermsInput = document.getElementById("agreeTerms");

    // UI Elements
    const registerBtn = document.getElementById("registerbtn");
    const btnText = registerBtn.querySelector(".btn-text");
    const btnSpinner = document.getElementById("btnSpinner");
    const usernameError = document.getElementById("usernameError");

    // Extract referral code from URL if available (?ref=CODE or ?referral=CODE)
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref') || urlParams.get('referral');
    if (refCode) {
        referralInput.value = refCode.trim().toUpperCase();
    }

    // Username Format: Alphanumeric & underscores, 3-20 characters
    const usernameRegex = /^[a-z0-9_]{3,20}$/;

    // Password Rules Elements
    const ruleLen = document.getElementById("rule-len");
    const ruleLower = document.getElementById("rule-lower");
    const ruleUpper = document.getElementById("rule-upper");
    const ruleNum = document.getElementById("rule-num");

    // Real-time Username Formatting
    usernameInput.addEventListener("input", (e) => {
        let val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
        e.target.value = val;

        if (val.length > 0 && !usernameRegex.test(val)) {
            usernameError.textContent = "3-20 chars: lowercase, numbers & underscores only";
        } else {
            usernameError.textContent = "";
        }
    });

    // Password Rules Validation
    passwordInput.addEventListener("input", () => {
        const val = passwordInput.value;
        updateRule(ruleLen, val.length >= 8);
        updateRule(ruleLower, /[a-z]/.test(val));
        updateRule(ruleUpper, /[A-Z]/.test(val));
        updateRule(ruleNum, /[0-9]/.test(val));
    });

    function updateRule(element, isValid) {
        const icon = element.querySelector("i");
        if (isValid) {
            element.classList.add("valid");
            icon.className = "ri-checkbox-circle-fill";
        } else {
            element.classList.remove("valid");
            icon.className = "ri-close-circle-fill";
        }
    }

    // Toggle Password Visibility
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

    // Form Submission Handler
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        // Front-end Validations
        if (!usernameRegex.test(username)) {
            Swal.fire("Invalid Username", "Username must be 3-20 characters long using lowercase letters, numbers, or underscores.", "warning");
            return;
        }

        if (password !== confirmPassword) {
            Swal.fire("Password Mismatch", "Passwords do not match.", "warning");
            return;
        }

        if (!agreeTermsInput.checked) {
            Swal.fire("Terms & Conditions", "Please accept the Terms of Use to proceed.", "info");
            return;
        }

        setLoadingState(true);

        // Prepare registration payload with signature and optional referral code
        const payload = {
            signature: APP_SIGNATURE,
            fullName: fullNameInput.value.trim(),
            username: username,
            email: emailInput.value.trim(),
            country: countryInput.value,
            password: password,
            referralCode: referralInput.value.trim() || null
        };

        try {
            const response = await fetch(API_BASE_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.success) {
                const userData = result.user || {};

                // Persist session tokens and state locally
                const sessionObject = {
                    token: result.token,
                    uuid: userData.uuid || "",
                    email: userData.email || payload.email
                };

                localStorage.setItem("user_session", JSON.stringify(sessionObject));
                localStorage.setItem("user_token", result.token);
                localStorage.setItem("user_data", JSON.stringify(userData));

                Swal.fire({
                    icon: 'success',
                    title: 'Registration Successful!',
                    text: 'Redirecting to your dashboard...',
                    timer: 1800,
                    showConfirmButton: false
                }).then(() => {
                    window.location.href = "../dash/index.html";
                });
            } else {
                Swal.fire("Registration Failed", result.error || "Server registration error.", "error");
            }

        } catch (error) {
            console.error("API Connection Error:", error);
            Swal.fire("Connection Error", "Could not connect to registration service. Please ensure the backend is running.", "error");
        } finally {
            setLoadingState(false);
        }
    });

    function setLoadingState(isLoading) {
        if (isLoading) {
            registerBtn.disabled = true;
            btnText.style.display = "none";
            btnSpinner.style.display = "block";
        } else {
            registerBtn.disabled = false;
            btnText.style.display = "inline";
            btnSpinner.style.display = "none";
        }
    }
});