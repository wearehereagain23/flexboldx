(() => {
    // Local scope variables (prevents redeclaration errors)
    const DATA_API_URL = "https://broker-chi-five.vercel.app/api/data";
    const KYC_API_URL = "https://broker-chi-five.vercel.app/api/kyc/submit-kyc";
    const HARDCODED_SIGNATURE = "flexboldx";

    document.addEventListener("DOMContentLoaded", async () => {
        // Top Stats DOM Elements
        const topBalanceEl = document.getElementById("top-user-balance");
        const topNameEl = document.getElementById("top-user-name");
        const topCountryEl = document.getElementById("top-user-country");

        // Header / Sidebar Name elements
        const headerNameEl = document.getElementById("weuss_header");
        const sidebarNameEl = document.getElementById("weuss");
        const sidebarCountryEl = document.getElementById("country");

        // Container UI Sections
        const introContainer = document.getElementById("kycIntroContainer");
        const formContainer = document.getElementById("kycFormContainer");
        const pendingContainer = document.getElementById("kycPendingContainer");
        const approvedContainer = document.getElementById("kycApprovedContainer");

        const startKycBtn = document.getElementById("startKycBtn");
        const kycForm = document.getElementById("kycForm");

        // Token check matching index.js authentication flow
        const token = localStorage.getItem("user_token");
        if (!token) {
            window.location.href = "../login/index.html";
            return;
        }

        let userUuid = localStorage.getItem("user_uuid") || "";

        // Step Controls
        let currentStep = 1;
        const totalSteps = 3;
        const stepItems = document.querySelectorAll(".step-item");
        const formSteps = document.querySelectorAll(".form-step");
        const nextBtns = document.querySelectorAll(".next-step-btn");
        const prevBtns = document.querySelectorAll(".prev-step-btn");

        // File Preview Mapping
        const fileInputs = [
            { inputId: "idFrontFile", previewId: "idFrontPreview", infoId: "idFrontInfo" },
            { inputId: "idBackFile", previewId: "idBackPreview", infoId: "idBackInfo" },
            { inputId: "selfieFile", previewId: "selfiePreview", infoId: "selfieInfo" }
        ];

        // Helper: Convert File to Base64
        const fileToBase64 = (file) => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = (error) => reject(error);
        });

        // Render corresponding UI view state
        function renderStateView(kycStatus) {
            introContainer?.classList.add("hidden");
            formContainer?.classList.add("hidden");
            pendingContainer?.classList.add("hidden");
            approvedContainer?.classList.add("hidden");

            const normalizedStatus = String(kycStatus || "no").toLowerCase().trim();

            if (normalizedStatus === "approved" || normalizedStatus === "verified" || normalizedStatus === "yes") {
                approvedContainer?.classList.remove("hidden");
            } else if (normalizedStatus === "pending") {
                pendingContainer?.classList.remove("hidden");
            } else {
                // 'no' or unverified state
                introContainer?.classList.remove("hidden");
            }
        }

        // Fetch user details using index.js workflow
        async function loadUserData() {
            try {
                const response = await fetch(DATA_API_URL, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        token: token,
                        signature: HARDCODED_SIGNATURE
                    })
                });

                const result = await response.json();

                if (result.success && result.user) {
                    const user = result.user;

                    if (user.uuid) {
                        userUuid = user.uuid;
                        localStorage.setItem("user_uuid", user.uuid);
                    }

                    // Format account balance display
                    const currency = user.currency || "$";
                    const numBal = parseFloat(user.accountBalance || 0);
                    const formattedBalance = `${currency}${numBal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

                    // Populating top metric boxes
                    if (topBalanceEl) topBalanceEl.textContent = formattedBalance;
                    if (topNameEl) topNameEl.textContent = user.fullName || user.username || "N/A";
                    if (topCountryEl) topCountryEl.textContent = user.country || "N/A";

                    // Populate Header & Sidebar user info
                    if (headerNameEl) headerNameEl.textContent = user.username;
                    if (sidebarNameEl) sidebarNameEl.textContent = user.username;
                    if (sidebarCountryEl) sidebarCountryEl.textContent = user.country || "United States";

                    // Render KYC UI State based on database value
                    renderStateView(user.kycStatus || user.kyc);
                } else {
                    renderStateView("no");
                }
            } catch (error) {
                console.error("Failed to fetch user KYC info:", error);
                renderStateView("no");
            }
        }

        // Initial Load
        await loadUserData();

        // Start KYC Flow Trigger
        startKycBtn?.addEventListener("click", () => {
            introContainer?.classList.add("hidden");
            formContainer?.classList.remove("hidden");
            updateStepView(1);
        });

        // Step View Switcher
        function updateStepView(targetStep) {
            stepItems.forEach((item, idx) => {
                const stepNum = idx + 1;
                item.classList.remove("active", "completed");

                if (stepNum === targetStep) {
                    item.classList.add("active");
                } else if (stepNum < targetStep) {
                    item.classList.add("completed");
                }
            });

            formSteps.forEach(stepPanel => {
                stepPanel.classList.remove("active");
                if (stepPanel.classList.contains(`step-${targetStep}`)) {
                    stepPanel.classList.add("active");
                }
            });

            currentStep = targetStep;
        }

        // Step Input Field Validator
        function validateStep(step) {
            const activeStepPanel = document.querySelector(`.form-step.step-${step}`);
            if (!activeStepPanel) return true;

            const inputs = activeStepPanel.querySelectorAll("input[required], select[required]");
            let isValid = true;

            inputs.forEach(input => {
                if (input.type === "file") {
                    if (!input.files || input.files.length === 0) {
                        isValid = false;
                        const parentWrapper = input.closest(".file-upload-wrapper");
                        if (parentWrapper) parentWrapper.style.borderColor = "var(--color-danger)";
                    } else {
                        const parentWrapper = input.closest(".file-upload-wrapper");
                        if (parentWrapper) parentWrapper.style.borderColor = "var(--border-color)";
                    }
                } else if (!input.value.trim()) {
                    isValid = false;
                    input.style.borderColor = "var(--color-danger)";
                } else {
                    input.style.borderColor = "var(--border-color)";
                }
            });

            if (!isValid) {
                Swal.fire({
                    icon: "warning",
                    title: "Incomplete Fields",
                    text: "Please complete all required fields and upload requested documents before proceeding.",
                    confirmButtonColor: "var(--color-primary)"
                });
            }

            return isValid;
        }

        // Next / Previous Buttons Navigation
        nextBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                if (validateStep(currentStep)) {
                    if (currentStep < totalSteps) {
                        updateStepView(currentStep + 1);
                    }
                }
            });
        });

        prevBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                if (currentStep > 1) {
                    updateStepView(currentStep - 1);
                }
            });
        });

        // File Preview Handlers
        fileInputs.forEach(({ inputId, previewId, infoId }) => {
            const inputEl = document.getElementById(inputId);
            const previewEl = document.getElementById(previewId);
            const infoEl = document.getElementById(infoId);

            if (inputEl) {
                inputEl.addEventListener("change", (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            previewEl.src = e.target.result;
                            previewEl.classList.remove("hidden");
                            if (infoEl) infoEl.style.display = "none";
                        };
                        reader.readAsDataURL(file);
                    }
                });
            }
        });

        // Submit KYC Form Handler
        kycForm?.addEventListener("submit", async (e) => {
            e.preventDefault();

            if (!validateStep(3)) return;

            Swal.fire({
                title: "Submitting Identity Verification...",
                text: "Uploading your data and documents securely.",
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            try {
                const frontFile = document.getElementById("idFrontFile").files[0];
                const backFile = document.getElementById("idBackFile").files[0];
                const selfieFile = document.getElementById("selfieFile").files[0];

                const [img1Base64, img2Base64, img3Base64] = await Promise.all([
                    fileToBase64(frontFile),
                    fileToBase64(backFile),
                    fileToBase64(selfieFile)
                ]);

                const payload = {
                    uuid: userUuid,
                    signature: HARDCODED_SIGNATURE,
                    token: token,
                    age: document.getElementById("userAge").value.trim(),
                    gender: document.getElementById("userGender").value,
                    employment_status: document.getElementById("employmentStatus").value,
                    phone_number: document.getElementById("userPhone").value.trim(),
                    city: document.getElementById("userCity").value.trim(),
                    address: document.getElementById("userAddress").value.trim(),
                    image_1: img1Base64,
                    image_2: img2Base64,
                    image_3: img3Base64
                };

                const response = await fetch(KYC_API_URL, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify(payload)
                });

                const result = await response.json();

                if (result.success) {
                    Swal.fire({
                        icon: "success",
                        title: "Submission Received!",
                        text: "Your KYC details and images were uploaded successfully and are now pending review.",
                        confirmButtonColor: "var(--color-primary)"
                    }).then(() => {
                        renderStateView("pending");
                    });
                } else {
                    Swal.fire({
                        icon: "error",
                        title: "Submission Failed",
                        text: result.message || "An error occurred while submitting your KYC details.",
                        confirmButtonColor: "var(--color-primary)"
                    });
                }
            } catch (err) {
                console.error("KYC Submission error:", err);
                Swal.fire({
                    icon: "error",
                    title: "Network Error",
                    text: "Unable to complete request. Please check your network connection.",
                    confirmButtonColor: "var(--color-primary)"
                });
            }
        });
    });
})();