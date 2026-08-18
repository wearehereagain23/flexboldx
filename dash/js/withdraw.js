document.addEventListener('DOMContentLoaded', async () => {
    const USER_DATA_API = "http://localhost:5000/api/data";
    const WITHDRAW_EXECUTE_API = "http://localhost:5000/api/withdrawal";
    const HARDCODED_SIGNATURE = "flexboldx";
    const token = localStorage.getItem("user_token");

    if (!token) {
        window.location.href = "../login/index.html";
        return;
    }

    const userBalanceEl = document.getElementById("user-balance");
    const pendingWithdrawEl = document.getElementById("pending-withdraw");
    const totalWithdrawnEl = document.getElementById("total-withdrawn");

    const methodSelect = document.getElementById('withdrawalMethod');
    const cryptoSection = document.getElementById('cryptofom');
    const bankSection = document.getElementById('banksection');
    const transferSection = document.getElementById('transfersection');

    const descIcon = document.getElementById('descIcon');
    const descText = document.getElementById('descText');
    const submitBtnText = document.getElementById('submitBtnText');
    const withdrawForm = document.getElementById('withdrawForm');

    let userHasPin;
    let userKycStatus;
    let userProgress;
    let userWithdrawStatus;
    let availableBalance;

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

    // Fetch Exact Metrics with Schema Extraction
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

            if (!response.ok || !result.success) {
                Swal.fire({ icon: 'error', title: 'Data Load Error', text: result.error || 'Server error' });
                return;
            }

            const userData = result.user || result.data || result;

            if (!userData || typeof userData !== 'object') {
                Swal.fire({ icon: 'error', title: 'Invalid Response', text: 'No user record returned from API.' });
                return;
            }

            // Extract Exact Column Keys
            availableBalance = parseFloat(userData.accountBalance || 0);
            userHasPin = Boolean(userData.pin);
            userKycStatus = userData.kyc;
            userProgress = userData.progress;
            userWithdrawStatus = userData.withdrawStatus;

            // Existence Check
            if (userKycStatus === undefined) {
                Swal.fire({ icon: 'error', title: 'Schema Error', text: "Field 'kyc' is missing from API user payload." });
                return;
            }
            if (userProgress === undefined) {
                Swal.fire({ icon: 'error', title: 'Schema Error', text: "Field 'progress' is missing from API user payload." });
                return;
            }
            if (userWithdrawStatus === undefined) {
                Swal.fire({ icon: 'error', title: 'Schema Error', text: "Field 'withdrawStatus' is missing from API user payload." });
                return;
            }

            if (userBalanceEl) userBalanceEl.textContent = `$${formatCurrency(availableBalance)}`;
            if (pendingWithdrawEl) pendingWithdrawEl.textContent = `$${formatCurrency(parseFloat(userData.pendingwithdraw || userData.pendingWithdrawal || 0))}`;
            if (totalWithdrawnEl) totalWithdrawnEl.textContent = `$${formatCurrency(parseFloat(userData.totalwithdrawn || userData.totalWithdrawal || 0))}`;

        } catch (err) {
            console.error("Error loading metrics:", err);
            Swal.fire({ icon: 'error', title: 'Network Error', text: 'Failed to fetch user data from server.' });
        }
    }

    await loadMetrics();

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
        } else if (selectedMethod === 'Crypto Transfer') {
            cryptoSection.classList.remove('hide');
        }
    }

    if (methodSelect) {
        methodSelect.addEventListener('change', (e) => updateMethodView(e.target.value));
        updateMethodView(methodSelect.value);
    }

    // Interactive 4-Digit PIN Input Prompt
    async function prompt4DigitPin() {
        const { value: pin } = await Swal.fire({
            title: 'Security Verification',
            html: `
                <p style="margin-bottom: 20px; font-size: 0.95em; color: #94a3b8;">
                    Enter your 4-digit security PIN to authorize this transaction.
                </p>
                <div id="swal-pin-container" style="display: flex; justify-content: center; gap: 12px; margin-bottom: 10px;">
                    <input type="password" maxlength="1" class="swal-pin-digit" pattern="[0-9]*" inputmode="numeric" />
                    <input type="password" maxlength="1" class="swal-pin-digit" pattern="[0-9]*" inputmode="numeric" />
                    <input type="password" maxlength="1" class="swal-pin-digit" pattern="[0-9]*" inputmode="numeric" />
                    <input type="password" maxlength="1" class="swal-pin-digit" pattern="[0-9]*" inputmode="numeric" />
                </div>
                <style>
                    .swal-pin-digit {
                        width: 50px;
                        height: 55px;
                        font-size: 24px;
                        text-align: center;
                        border-radius: 8px;
                        border: 2px solid #334155;
                        background-color: #0f172a;
                        color: #ffffff;
                        outline: none;
                        transition: all 0.2s ease;
                    }
                    .swal-pin-digit:focus {
                        border-color: #3b82f6;
                        box-shadow: 0 0 8px rgba(59, 130, 246, 0.4);
                    }
                </style>
            `,
            showCancelButton: true,
            confirmButtonText: 'Authorize Withdrawal',
            cancelButtonText: 'Cancel',
            focusConfirm: false,
            didOpen: () => {
                const container = document.getElementById('swal-pin-container');
                const inputs = Array.from(container.querySelectorAll('.swal-pin-digit'));

                inputs[0].focus();

                inputs.forEach((input, index) => {
                    input.addEventListener('input', (e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        e.target.value = val;

                        if (val && index < inputs.length - 1) {
                            inputs[index + 1].focus();
                        }
                    });

                    input.addEventListener('keydown', (e) => {
                        if (e.key === 'Backspace' && !e.target.value && index > 0) {
                            inputs[index - 1].focus();
                        }
                    });

                    input.addEventListener('paste', (e) => {
                        e.preventDefault();
                        const pastedData = (e.clipboardData || window.clipboardData).getData('text').trim();
                        if (/^\d{4}$/.test(pastedData)) {
                            pastedData.split('').forEach((char, i) => {
                                if (inputs[i]) inputs[i].value = char;
                            });
                            inputs[inputs.length - 1].focus();
                        }
                    });
                });
            },
            preConfirm: () => {
                const container = document.getElementById('swal-pin-container');
                const inputs = Array.from(container.querySelectorAll('.swal-pin-digit'));
                const fullPin = inputs.map(i => i.value).join('');

                if (fullPin.length !== 4 || !/^\d{4}$/.test(fullPin)) {
                    Swal.showValidationMessage('Please enter a valid 4-digit numeric PIN.');
                    return false;
                }

                return fullPin;
            }
        });

        return pin;
    }

    // Exact Eligibility Check
    if (withdrawForm) {
        withdrawForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const isKycApproved = userKycStatus === 'approved';
            const isProgressComplete = String(userProgress) === '100';
            const isWithdrawEnabled = userWithdrawStatus === true;

            if (!isKycApproved || !isProgressComplete || !isWithdrawEnabled) {
                let missingMessages = [];

                if (!isKycApproved) {
                    missingMessages.push(`KYC status is '${userKycStatus}' ('approved' required).`);
                }

                if (!isProgressComplete) {
                    missingMessages.push(`Trade progress is ${userProgress}% (100% required).`);
                }

                if (!isWithdrawEnabled) {
                    missingMessages.push("Withdrawal status is set to false (disabled).");
                }

                Swal.fire({
                    icon: 'error',
                    title: 'Withdrawal Ineligible',
                    html: `<p style="margin-bottom: 12px; font-weight: 600; color: #f87171;">Account does not meet withdrawal criteria:</p>
                           <ul style="text-align: left; font-size: 0.9em; line-height: 1.6; color: #cbd5e1;">
                               ${missingMessages.map(m => `<li>• ${m}</li>`).join('')}
                           </ul>`
                });
                return;
            }

            const selectedMethod = methodSelect.value;
            const amount = parseFloat(document.getElementById('amount').value);

            if (isNaN(amount) || amount <= 0) {
                Swal.fire({ icon: 'error', title: 'Invalid Amount', text: 'Please enter a valid amount.' });
                return;
            }

            if (amount > availableBalance) {
                Swal.fire({
                    icon: 'error',
                    title: 'Insufficient Balance',
                    text: `Requested amount ($${amount.toFixed(2)}) exceeds balance ($${availableBalance.toFixed(2)}).`
                });
                return;
            }

            if (!userHasPin) {
                Swal.fire({
                    icon: 'info',
                    title: 'Transaction PIN Required',
                    text: 'Please configure your security PIN in Settings to proceed.',
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

            if (selectedMethod === 'Internal Transfer') {
                const recipient_username = document.getElementById('recipient_username').value.trim();

                if (!recipient_username) {
                    Swal.fire({ icon: 'warning', title: 'Missing Username', text: 'Please enter recipient username.' });
                    return;
                }

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
                        Swal.fire({ icon: 'error', title: 'Recipient Error', text: verifyData.error });
                        return;
                    }

                    const confirmSend = await Swal.fire({
                        icon: 'warning',
                        title: 'Confirm Internal Transfer',
                        html: `Send <strong>$${amount.toFixed(2)}</strong> to <strong>${verifyData.fullName}</strong> (@${verifyData.username})?`,
                        showCancelButton: true,
                        confirmButtonText: 'Confirm Transfer',
                        cancelButtonText: 'Cancel'
                    });

                    if (!confirmSend.isConfirmed) return;

                    payload.recipient_username = verifyData.username;

                } catch (err) {
                    console.error("Recipient verification error:", err);
                    Swal.fire({ icon: 'error', title: 'Verification Error', text: 'Recipient verification failed.' });
                    return;
                }

            } else if (selectedMethod === 'Crypto Transfer') {
                const pay_method = document.getElementById('pay_method').value;
                const btc_address = document.getElementById('btc_address').value.trim();

                if (!pay_method) {
                    Swal.fire({ icon: 'warning', title: 'Missing Network', text: 'Select network.' });
                    return;
                }
                if (!btc_address) {
                    Swal.fire({ icon: 'warning', title: 'Missing Address', text: 'Enter wallet address.' });
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
                    Swal.fire({ icon: 'warning', title: 'Incomplete Details', text: 'Fill in required bank details.' });
                    return;
                }
                payload.bank_name = bank_name;
                payload.acct_no = acct_no;
                payload.acct_name = acct_name;
                payload.acct_swift = acct_swift;
            }

            const enteredPin = await prompt4DigitPin();

            if (!enteredPin) return;

            payload.pin = enteredPin;

            Swal.fire({
                title: 'Processing...',
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
                        title: 'Success',
                        text: result.message
                    });

                    withdrawForm.reset();
                    updateMethodView(methodSelect.value);
                    await loadMetrics();
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Failed',
                        text: result.error
                    });
                }
            } catch (err) {
                console.error("Submission Error:", err);
                Swal.fire("Connection Error", "Failed to connect to backend server.", "error");
            }
        });
    }

    function formatCurrency(val) {
        if (isNaN(val)) return "0.00";
        return val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
});