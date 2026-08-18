/**
 * Flexboldx Dashboard Logic Controller
 */

const DATA_API_URL = "https://broker-chi-five.vercel.app/api/data";
const HARDCODED_SIGNATURE = "flexboldx";
const DEFAULT_AVATAR = "./asset/userlogo.png";

document.addEventListener("DOMContentLoaded", async () => {
    // 1. Instantly activate body blur state
    document.body.classList.add("loading-active");
    const loaderOverlay = document.getElementById("pageLoader");

    const token = localStorage.getItem("user_token");
    const loginType = localStorage.getItem("login_type");

    // Redirect to login if unauthenticated OR logged in from chat
    if (!token || loginType === "from_chat") {
        clearUserSession();
        window.location.href = "../login/index.html";
        return;
    }

    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    try {
        const [response] = await Promise.all([
            fetch(DATA_API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    token: token,
                    signature: HARDCODED_SIGNATURE
                })
            }),
            delay(2000)
        ]);

        const result = await response.json();

        if (!result.success) {
            Swal.fire({
                icon: "error",
                title: "Session Expired",
                text: result.error || "Please log in again.",
            }).then(() => {
                clearUserSession();
                window.location.href = "../login/index.html";
            });
            return;
        }

        const user = result.user;
        const refs = result.referrals;

        // ACTIVE ACCOUNT ENFORCEMENT CHECK
        const isActiveAccount = user.active === true || user.active === "true" || user.active === "active";

        if (!isActiveAccount) {
            Swal.fire({
                icon: "warning",
                title: "Account Disabled",
                text: "Your account is currently inactive or restricted. Please contact support.",
                allowOutsideClick: false,
                confirmButtonText: "Ok"
            }).then(() => {
                clearUserSession();
                window.location.href = "../login/index.html";
            });
            return;
        }

        if (user.uuid) {
            localStorage.setItem("user_uuid", user.uuid);
        }

        const avatarSrc = user.profileImage && user.profileImage.trim() !== ""
            ? user.profileImage
            : DEFAULT_AVATAR;

        setElementSrc("pmler", avatarSrc);
        setElementSrc("pmler2", avatarSrc);
        setElementSrc("pmler3", avatarSrc);

        setElementText("weuss_header", user.username);
        setElementText("weuss", user.username);
        setElementText("weuss2", user.fullName);
        setElementText("country", user.country);

        let kycDisplay = "Not Verified";
        const kycRaw = String(user.kycStatus).toLowerCase().trim();

        if (kycRaw === "approved" || kycRaw === "verified" || kycRaw === "yes") {
            kycDisplay = "Verified";
        } else if (kycRaw === "pending") {
            kycDisplay = "Pending";
        } else {
            kycDisplay = "Not Verified";
        }

        const currencySym = "$";

        setElementText("xxpol", `${currencySym}${formatCurrency(user.accountBalance)}`);
        setElementText("totaldeposit", `${currencySym}${formatCurrency(user.totalDeposit)}`);
        setElementText("pendingdeposit", `${currencySym}${formatCurrency(user.pendingDeposit)}`);
        setElementText("totalwithdraw", `${currencySym}${formatCurrency(user.totalWithdrawal)}`);
        setElementText("pendingwithdraw", `${currencySym}${formatCurrency(user.pendingWithdrawal)}`);

        handleAccountPlanDisplay(user, currencySym);

        setElementText("active", user.accountStatus);
        setElementText("kycStatus", kycDisplay);
        setElementText("withdrawStatus", user.withdrawStatus === true ? 'Eligible' : 'Ineligible');

        setElementText("totalReferralsCount", refs.totalReferrals || 0);
        setElementText("activeReferralsCount", refs.activeInvestors || 0);
        setElementText("pendingCommissions", `${currencySym}${formatCurrency(refs.pendingCommissions || 0)}`);
        setElementText("totalCommissions", `${currencySym}${formatCurrency(refs.totalCommissions || 0)}`);

        const tradeProgressVal = Math.min(Math.max(parseInt(user.tradeProgress || 0, 10), 0), 100);
        setElementText("pp2", `${tradeProgressVal}%`);

        const progressBar = document.getElementById("customProgressBar");
        if (progressBar) {
            progressBar.style.width = `${tradeProgressVal}%`;
        }

    } catch (err) {
        console.error("Dashboard Loading Error:", err);
        Swal.fire("Connection Error", "Unable to load dashboard data. Please try again.", "error");
    } finally {
        document.body.classList.remove("loading-active");
        if (loaderOverlay) {
            loaderOverlay.classList.add("hidden");
        }
    }

    const logoutBtn = document.getElementById("out");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", (e) => {
            e.preventDefault();
            clearUserSession();
            window.location.href = "../login/index.html";
        });
    }
});

function clearUserSession() {
    localStorage.removeItem("user_token");
    localStorage.removeItem("user_session");
    localStorage.removeItem("user_data");
    localStorage.removeItem("user_uuid");
    localStorage.removeItem("login_type");
}

function handleAccountPlanDisplay(user, currencySym) {
    const planTitleEl = document.getElementById("plan-title");
    const planValueEl = document.getElementById("plan");

    const rawPlan = (user.plan || "").trim();
    const isNoPlan = !rawPlan || rawPlan.toLowerCase() === "no active plan";

    if (isNoPlan) {
        if (planTitleEl) planTitleEl.textContent = "ACCOUNT PLAN";
        if (planValueEl) planValueEl.textContent = "No Active Plan";
    } else {
        if (planTitleEl) {
            planTitleEl.textContent = `${rawPlan.toUpperCase()} PLAN PROFIT`;
        }

        const profitValue = user.plan_profit !== undefined && user.plan_profit !== null
            ? user.plan_profit
            : (user.profit || 0);

        if (planValueEl) {
            planValueEl.textContent = `${currencySym}${formatCurrency(profitValue)}`;
        }
    }
}

function setElementText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value !== undefined && value !== null ? value : "";
}

function setElementSrc(id, src) {
    const img = document.getElementById(id);
    if (img) {
        img.src = src;
        img.onerror = () => {
            img.src = DEFAULT_AVATAR;
        };
    }
}

function formatCurrency(val) {
    const num = parseFloat(val);
    if (isNaN(num)) return "0.00";
    return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}