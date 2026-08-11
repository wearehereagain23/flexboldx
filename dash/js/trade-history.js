document.addEventListener('DOMContentLoaded', async () => {
    const USER_DATA_API = "http://localhost:5000/api/data";
    const WITHDRAW_EXECUTE_API = "http://localhost:5000/api/withdrawal";
    const HARDCODED_SIGNATURE = "flexboldx";
    const token = localStorage.getItem("user_token");

    if (!token) {
        window.location.href = "../login/index.html";
        return;
    }

    // Top Metric DOM Elements
    const userBalanceEl = document.getElementById("user-balance");
    const pendingWithdrawEl = document.getElementById("pending-withdraw");
    const totalWithdrawnEl = document.getElementById("total-withdrawn");

    // Form DOM Elements
    const methodSelect = document.getElementById('withdrawalMethod');
    const cryptoSection = document.getElementById('cryptofom');
    const bankSection = document.getElementById('banksection');
    const transferSection = document.getElementById('transfersection');

    const descIcon = document.getElementById('descIcon');
    const descText = document.getElementById('descText');
    const submitBtnText = document.getElementById('submitBtnText');
    const withdrawForm = document.getElementById('withdrawForm');

    let userHasPin = false;
    let userKycStatus = "no";
    let userProgress = "0";
    let userWithdrawStatus = false;
    let availableBalance = 0;

    const methodDetails = {
        'Crypto Transfer': {
            icon: 'currency_bitcoin',
            text: 'Crypto withdrawal sends funds securely to an external cryptocurrency wallet address.',
            btnText: 'Apply for Crypto Withdrawal'
        },
        'Bank Transfer': {
            icon: 'account_balance',
            text: 'Bank withdrawal sends funds directly to your verified personal bank account.',
            btnText: 'Apply for Bank Payout'
        },
        'Internal Transfer': {
            icon: 'send',
            text: 'Internal transfer sends funds instantly to another user on the platform via username.',
            btnText: 'Execute Internal Transfer'
        }
    };

    // 1. Fetch User Eligibility & Balance Metrics
    async function loadMetrics() {
        try {
            const response = await fetch(USER_DATA_API, {
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

            if (response.ok && (result.success || result.user)) {
                const userData = result.user || result.data || result;
                availableBalance = parseFloat(userData.accountBalance || userData.account_balance || 0);
                userHasPin = Boolean(userData.pin);
                userKycStatus = String(userData.kyc || "no").toLowerCase();
                userProgress = String(userData.progress || "0").trim();
                userWithdrawStatus = userData.withdrawStatus === true || String(userData.withdrawStatus) === "true";

                const pendingWithdraw = parseFloat(userData.pendingwithdraw || userData.pendingWithdraw || 0);
                const totalWithdrawn = parseFloat(userData.totalwithdrawn || userData.totalWithdrawn || 0);

                if (userBalanceEl) userBalanceEl.textContent = `$${formatCurrency(availableBalance)}`;
                if (pendingWithdrawEl) pendingWithdrawEl.textContent = `$${formatCurrency(pendingWithdraw)}`;
                if (totalWithdrawnEl) totalWithdrawnEl.textContent = `$${formatCurrency(totalWithdrawn)}`;
            } else if (result.error && result.error.includes("Unauthorized")) {
                localStorage.removeItem("user_token");
                window.location.href = "../login/index.html";
            }
        } catch (err) {
            console.error("Error loading metrics:", err);
        }
    }

    await loadMetrics();

    // 2. Dynamic View Adjustments
    function updateMethodView(selectedMethod) {
        const details = methodDetails[selectedMethod];

        if (details) {
            descIcon.textContent = details.icon;
            descText.textContent = details.text;
            submitBtnText.textContent = details.btnText;
        }

        cryptoSection.classList.add('hide');
        bankSection.classList.add('hide');
        transferSection.classList.add('hide');

        if (selectedMethod === 'Bank Transfer') {
            bankSection.classList.remove('hide');
        } else if (selectedMethod === 'Internal Transfer') {
            transferSection.classList.remove('hide');
        } else {
            cryptoSection.classList.remove('hide');
        }
    }

    if (methodSelect) {
        methodSelect.addEventListener('change', (e) => updateMethodView(e.target.value));
        updateMethodView(methodSelect.value);
    }

    // 3. Process Form Submission
    if (withdrawForm) {
        withdrawForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // A. CHECK ELIGIBILITY (KYC, Progress, withdrawStatus)
            const isKycApproved = userKycStatus === 'approved';
            const isProgressComplete = userProgress === '100' || parseFloat(userProgress) === 100;
            const isWithdrawEnabled = userWithdrawStatus === true;

            if (!isKycApproved || !isProgressComplete || !isWithdrawEnabled) {
                let missingCriteria = [];
                if (!isKycApproved) missingCriteria.push("KYC must be approved");
                if (!isProgressComplete) missingCriteria.push("Trade progress must be 100%");
                if (!isWithdrawEnabled) missingCriteria.push("Withdrawal status must be enabled");

                Swal.fire({
                    icon: 'error',
                    title: 'Not Eligible to Withdraw',
                    html: `<p style="margin-bottom: 10px;">You are not yet eligible to initiate withdrawals or transfers.</p>
                           <ul style="text-align: left; font-size: 0.9em; color: #f87171;">
                               ${missingCriteria.map(c => `<li>• ${c}</li>`).join('')}
                           </ul>`
                });
                return;
            }

            const selectedMethod = methodSelect.value;
            const amount = parseFloat(document.getElementById('amount').value);

            if (isNaN(amount) || amount <= 0) {
                Swal.fire({ icon: 'error', title: 'Invalid Amount', text: 'Please enter an amount greater than $0.00.' });
                return;
            }

            if (amount > availableBalance) {
                Swal.fire({
                    icon: 'error',
                    title: 'Insufficient Balance',
                    text: `Your requested amount ($${amount.toFixed(2)}) exceeds your available balance ($${availableBalance.toFixed(2)}).`
                });
                return;
            }

            if (!userHasPin) {
                Swal.fire({
                    icon: 'info',
                    title: 'Transaction PIN Required',
                    text: 'You have not set a transaction PIN yet. Please configure your security PIN in Settings to proceed.',
                    confirmButtonText: 'Go to Settings',
                    showCancelButton: true
                }).then((res) => {
                    if (res.isConfirmed) {
                        window.location.href = './settings.html';
                    }
                });
                return;
            }

            let payload = {
                token: token,
                signature: HARDCODED_SIGNATURE,
                withdrawalMethod: selectedMethod,
                amount: amount
            };

            // B. FIELD VALIDATIONS & RECIPIENT VERIFICATION FOR INTERNAL TRANSFERS
            if (selectedMethod === 'Internal Transfer') {
                const recipient_username = document.getElementById('recipient_username').value.trim();

                if (!recipient_username) {
                    Swal.fire({ icon: 'warning', title: 'Missing Username', text: 'Please enter recipient username.' });
                    return;
                }

                // Verify recipient username via API
                Swal.fire({
                    title: 'Verifying Recipient...',
                    allowOutsideClick: false,
                    didOpen: () => Swal.showLoading()
                });

                try {
                    const verifyRes = await fetch(WITHDRAW_EXECUTE_API, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            token: token,
                            signature: HARDCODED_SIGNATURE,
                            action: "verify-recipient",
                            recipient_username: recipient_username
                        })
                    });

                    const verifyData = await verifyRes.json();

                    if (!verifyData.success) {
                        Swal.fire({ icon: 'error', title: 'Recipient Not Found', text: verifyData.error || 'User does not exist.' });
                        return;
                    }

                    // Confirm Transfer Warning Modal with Receiver's Full Name
                    const confirmSend = await Swal.fire({
                        icon: 'question',
                        title: 'Confirm Internal Transfer',
                        html: `Are you sure you want to transfer <strong>$${amount.toFixed(2)}</strong> to <strong>${verifyData.fullName}</strong> (@${verifyData.username})?`,
                        showCancelButton: true,
                        confirmButtonText: 'Yes, Proceed',
                        cancelButtonText: 'Cancel'
                    });

                    if (!confirmSend.isConfirmed) return;

                    payload.recipient_username = verifyData.username;

                } catch (err) {
                    console.error("Recipient verification error:", err);
                    Swal.fire({ icon: 'error', title: 'Verification Error', text: 'Unable to verify recipient username.' });
                    return;
                }

            } else if (selectedMethod === 'Crypto Transfer') {
                const pay_method = document.getElementById('pay_method').value;
                const btc_address = document.getElementById('btc_address').value.trim();

                if (!pay_method) {
                    Swal.fire({ icon: 'warning', title: 'Missing Network', text: 'Please select a crypto network.' });
                    return;
                }
                if (!btc_address) {
                    Swal.fire({ icon: 'warning', title: 'Missing Address', text: 'Please enter a recipient wallet address.' });
                    return;
                }
                payload.pay_method = pay_method;
                payload.btc_address = btc_address;

            } else if (selectedMethod === 'Bank Transfer') {
                const bank_name = document.getElementById('bank_name').value.trim();
                const acct_no = document.getElementById('acct_no').value.trim();
                const acct_name = document.getElementById('acct_name').value.trim();
                const acct_swift = document.getElementById('acct_swift').value.trim();

                if (!bank_name || !acct_no || !acct_name) {
                    Swal.fire({ icon: 'warning', title: 'Incomplete Details', text: 'Please fill in Bank Name, Account Number, and Account Name.' });
                    return;
                }
                payload.bank_name = bank_name;
                payload.acct_no = acct_no;
                payload.acct_name = acct_name;
                payload.acct_swift = acct_swift;
            }

            // C. PIN AUTHORIZATION PROMPT
            const { value: enteredPin } = await Swal.fire({
                title: 'Enter Transaction PIN',
                input: 'password',
                inputLabel: 'Security Verification',
                inputPlaceholder: 'Enter your 4-6 digit PIN',
                inputAttributes: {
                    maxlength: 6,
                    autocapitalize: 'off',
                    autocorrect: 'off'
                },
                showCancelButton: true,
                confirmButtonText: 'Authorize Action'
            });

            if (!enteredPin) return;

            payload.pin = enteredPin;

            Swal.fire({
                title: 'Processing Transaction...',
                text: 'Authorizing debit and executing transfer.',
                allowOutsideClick: false,
                didOpen: () => { Swal.showLoading(); }
            });

            try {
                const response = await fetch(WITHDRAW_EXECUTE_API, {
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
                        icon: 'success',
                        title: 'Transaction Successful',
                        text: result.message
                    });

                    withdrawForm.reset();
                    updateMethodView(methodSelect.value);
                    await loadMetrics();
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Transaction Failed',
                        text: result.error || 'Request could not be processed.'
                    });
                }
            } catch (err) {
                console.error("Submission Error:", err);
                Swal.fire("Connection Error", "Failed to connect to backend server.", "error");
            }
        });
    }

    function formatCurrency(val) {
        const num = parseFloat(val);
        if (isNaN(num)) return "0.00";
        return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
});