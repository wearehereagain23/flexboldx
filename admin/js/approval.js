/**
 * ADMIN CONSOLE - APPROVALS & PLAN MIGRATION MODULE
 */

export function syncApprovalFormFields(userObject) {
    if (!userObject) return;

    // 1. POPULATE KYC FORM FIELDS
    const kycStatus = (userObject.kyc || "no").toLowerCase();
    const kycSelect = document.getElementById("kyc") || document.getElementById("appr_kyc");
    if (kycSelect) kycSelect.value = kycStatus;

    setFieldValue("kyc_phone_number", userObject.kyc_phone_number || userObject.phone || "");
    setFieldValue("kyc_gender", userObject.kyc_gender || userObject.gender || "");
    setFieldValue("kyc_age", userObject.kyc_age || userObject.age || "");
    setFieldValue("kyc_employment_status", userObject.kyc_employment_status || userObject.employment_status || "");
    setFieldValue("kyc_address", userObject.kyc_address || userObject.address || "");

    // Populate extra KYC fields if present in DOM
    setFieldValue("appr_occupation", userObject.occupation || "");
    setFieldValue("appr_marital_status", userObject.marital_status || "");
    setFieldValue("appr_phone", userObject.kyc_phone_number || userObject.phone || "");
    setFieldValue("appr_zipcode", userObject.zipcode || "");
    setFieldValue("appr_address", userObject.kyc_address || userObject.address || "");
    setFieldValue("appr_kinname", userObject.kinname || "");
    setFieldValue("appr_kin_email", userObject.kin_email || "");

    // Maps to DB columns kyc_image_1, kyc_image_2, kyc_image_3
    renderKycImage("KYC Image 1", "kyc_img1_wrap", userObject.kyc_image_1 || userObject.KYC_image1 || userObject.kyc_img1);
    renderKycImage("KYC Image 2", "kyc_img2_wrap", userObject.kyc_image_2 || userObject.KYC_image2 || userObject.kyc_img2);
    renderKycImage("KYC Image 3", "kyc_img3_wrap", userObject.kyc_image_3 || userObject.KYC_image3 || userObject.kyc_img3);

    // 2. POPULATE PLAN MIGRATION FORM FIELDS
    const targetPlan = userObject.pm_plan || userObject.plan || "No Active Plan";
    const pmPlanSelect = document.getElementById("pm_plan");
    if (pmPlanSelect) {
        setSelectOptionByValueOrText("pm_plan", targetPlan);
    }

    setFieldValue("pm_amount", userObject.pm_amount || userObject.plan_profit || "");
    setFieldValue("pm_date", userObject.pm_date ? formatDateForInput(userObject.pm_date) : (userObject.created_at ? formatDateForInput(userObject.created_at) : ""));
    setFieldValue("pm_signature", userObject.pm_signature || userObject.signature || userObject.signature_key || "");

    // 3. ATTACH FORM SUBMISSION HANDLERS
    bindKycFormSubmit(userObject);
    bindPlanMigrationSubmit(userObject);
    bindCardFormSubmit(userObject);
    bindLoanFormSubmit(userObject);
}

// Helper to safely set values on HTML Input elements
function setFieldValue(elementId, value) {
    const elem = document.getElementById(elementId);
    if (elem) {
        elem.value = value;
    }
}

// Helper to format stored date string to YYYY-MM-DD format for HTML date inputs
function formatDateForInput(dateStr) {
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toISOString().split("T")[0];
    } catch {
        return dateStr;
    }
}

function renderKycImage(label, containerId, imageString) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!imageString || String(imageString).trim() === "") {
        container.innerHTML = `<small style="color:#64748b;">None uploaded</small>`;
        return;
    }

    const cleanStr = String(imageString).trim();
    const src = cleanStr.startsWith("data:image") || cleanStr.startsWith("http")
        ? cleanStr
        : `data:image/jpeg;base64,${cleanStr}`;

    container.innerHTML = `
        <a href="${src}" target="_blank" title="Click to view full image">
            <img src="${src}" style="width: 100%; max-height: 100px; object-fit: cover; border-radius: 4px; border: 1px solid #222d34; cursor: pointer;" alt="${label}">
        </a>
    `;
}

/**
 * Safely sets a <select> element's value by performing case-insensitive
 * and partial matching against option values and visible text.
 */
function setSelectOptionByValueOrText(selectId, targetValue) {
    const selectElem = document.getElementById(selectId);
    if (!selectElem || !targetValue) return;

    const normalizedTarget = String(targetValue).trim().toLowerCase();
    let matched = false;

    for (let i = 0; i < selectElem.options.length; i++) {
        const opt = selectElem.options[i];
        const optValue = opt.value.toLowerCase();
        const optText = opt.text.toLowerCase();

        if (
            optValue === normalizedTarget ||
            optText === normalizedTarget ||
            optValue.includes(normalizedTarget) ||
            normalizedTarget.includes(optValue)
        ) {
            selectElem.selectedIndex = i;
            matched = true;
            break;
        }
    }

    if (!matched && selectElem.options.length > 0) {
        selectElem.selectedIndex = 0;
    }
}

// --- SUBMIT HANDLERS ---

function bindKycFormSubmit(userObject) {
    const kycForm = document.getElementById("kycApprovalForm");
    if (!kycForm) return;

    kycForm.onsubmit = async (e) => {
        e.preventDefault();
        const payload = {
            kyc: document.getElementById("kyc")?.value || document.getElementById("appr_kyc")?.value || "no",
            kyc_phone_number: document.getElementById("kyc_phone_number")?.value.trim() || document.getElementById("appr_phone")?.value.trim() || "",
            kyc_gender: document.getElementById("kyc_gender")?.value.trim() || "",
            kyc_age: document.getElementById("kyc_age")?.value.trim() || "",
            kyc_employment_status: document.getElementById("kyc_employment_status")?.value.trim() || "",
            kyc_address: document.getElementById("kyc_address")?.value.trim() || document.getElementById("appr_address")?.value.trim() || "",
            occupation: document.getElementById("appr_occupation")?.value.trim() || "",
            marital_status: document.getElementById("appr_marital_status")?.value.trim() || "",
            zipcode: document.getElementById("appr_zipcode")?.value.trim() || "",
            kinname: document.getElementById("appr_kinname")?.value.trim() || "",
            kin_email: document.getElementById("appr_kin_email")?.value.trim() || ""
        };

        await submitApprovalSection(userObject.uuid, "kyc", payload, kycForm);
    };
}

function bindPlanMigrationSubmit(userObject) {
    const planForm = document.getElementById("planMigrationForm");
    if (!planForm) return;

    planForm.onsubmit = async (e) => {
        e.preventDefault();
        const payload = {
            pm_plan: document.getElementById("pm_plan")?.value || "",
            pm_amount: document.getElementById("pm_amount")?.value.trim() || "",
            pm_date: document.getElementById("pm_date")?.value || "",
            pm_signature: document.getElementById("pm_signature")?.value.trim() || ""
        };

        await submitApprovalSection(userObject.uuid, "plan", payload, planForm);
    };
}

function bindCardFormSubmit(userObject) {
    const cardForm = document.getElementById("cardApprovalForm");
    if (!cardForm) return;

    cardForm.onsubmit = async (e) => {
        e.preventDefault();
        const payload = {
            cards: document.getElementById("appr_cards")?.value || "",
            cardApproval: document.getElementById("appr_cardApproval")?.value || "",
            cardNumber: document.getElementById("appr_cardNumber")?.value.trim() || "",
            expireDate: document.getElementById("appr_expireDate")?.value.trim() || "",
            card_pin: document.getElementById("appr_card_pin")?.value.trim() || "",
            card_cvc: document.getElementById("appr_card_cvc")?.value.trim() || ""
        };

        await submitApprovalSection(userObject.uuid, "card", payload, cardForm);
    };
}

function bindLoanFormSubmit(userObject) {
    const loanForm = document.getElementById("loanApprovalForm");
    if (!loanForm) return;

    loanForm.onsubmit = async (e) => {
        e.preventDefault();
        const payload = {
            loanApprovalStatus: document.getElementById("appr_loanApprovalStatus")?.value || "",
            loanAmount: document.getElementById("appr_loanAmount")?.value.trim() || "",
            loanType: document.getElementById("appr_loanType")?.value.trim() || "",
            loan_duration: document.getElementById("appr_loan_duration")?.value.trim() || "",
            unsettledLoan: document.getElementById("appr_unsettledLoan")?.value?.trim() || "0"
        };

        await submitApprovalSection(userObject.uuid, "loan", payload, loanForm);
    };
}

async function submitApprovalSection(targetUserId, section, payload, formElement) {
    const adminToken = localStorage.getItem("admin_session_token");
    const submitBtn = formElement.querySelector("button[type='submit']");
    const originalText = submitBtn ? submitBtn.innerText : "Submit";

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = "Updating...";
    }

    try {
        const response = await fetch("https://broker-chi-five.vercel.app/api/admin-approval", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${adminToken}`
            },
            body: JSON.stringify({ targetUserId, section, payload })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.error || "Update operation failed.");
        }

        Swal.fire({
            title: "Updated Successfully",
            text: `${section.toUpperCase()} record updated successfully.`,
            icon: "success",
            confirmButtonColor: "#10b981",
            background: "#111b21",
            color: "#fff",
            timer: 1800,
            showConfirmButton: false
        });

    } catch (err) {
        Swal.fire({
            title: "Update Failed",
            text: err.message,
            icon: "error",
            confirmButtonColor: "#ef4444",
            background: "#111b21",
            color: "#fff"
        });
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = originalText;
        }
    }
}