document.addEventListener('DOMContentLoaded', async () => {
    const userToken = localStorage.getItem("user_token");
    const userSignature = localStorage.getItem("user_signature") || "";

    const API_BASE_URL = window.location.origin.includes('5000')
        ? window.location.origin
        : 'https://broker-chi-five.vercel.app';

    if (!userToken) {
        Swal.fire({
            icon: 'warning',
            title: 'Session Expired',
            text: 'Please log in again to view investment plans.',
            confirmButtonText: 'Go to Login'
        }).then(() => {
            window.location.href = "../login/index.html";
        });
        return;
    }

    let currentUser = null;
    let adminData = {};
    let planConfigs = {};

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
    };

    // Helper: Verify PIN configuration
    function checkUserPinSetup() {
        if (!currentUser || !currentUser.pin || String(currentUser.pin).trim() === '') {
            Swal.fire({
                icon: 'warning',
                title: 'PIN Setup Required',
                text: 'You have not configured a Security PIN yet. Please visit your settings page to create one.',
                showCancelButton: true,
                confirmButtonText: 'Go to Settings',
                cancelButtonText: 'Cancel',
                confirmButtonColor: '#6366f1'
            }).then((result) => {
                if (result.isConfirmed) {
                    window.location.href = "./settings.html";
                }
            });
            return false;
        }
        return true;
    }

    async function loadInvestPageData() {
        try {
            const res = await fetch(`${API_BASE_URL}/api/invest_plan/get-invest-data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${userToken}`
                },
                body: JSON.stringify({
                    token: userToken,
                    signature: userSignature
                })
            });

            const text = await res.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (parseErr) {
                console.error('Server returned raw non-JSON body:', text);
                Swal.fire('Error', `Server raw error (HTTP ${res.status}). Verify backend URL: ${API_BASE_URL}`, 'error');
                return;
            }

            if (!data.status && !data.success) {
                Swal.fire({
                    icon: 'error',
                    title: 'Session Expired',
                    text: data.message || data.error || 'Please log in again.'
                }).then(() => {
                    localStorage.removeItem("user_token");
                    window.location.href = "../login/index.html";
                });
                return;
            }

            currentUser = data.user;
            adminData = data.admin || {};

            const headerName = document.getElementById('weuss_header');
            const sidebarName = document.getElementById('weuss');
            const sidebarCountry = document.getElementById('country');

            if (headerName) headerName.textContent = currentUser.username || currentUser.fullName || currentUser.full_name || '';
            if (sidebarName) sidebarName.textContent = currentUser.username || currentUser.fullName || currentUser.full_name || '';
            if (sidebarCountry) sidebarCountry.textContent = currentUser.country || '';

            // Update Progress Bar UI


            const progressVal = parseInt(currentUser.progress || 0, 10);

            const pp2El = document.getElementById('pp2');
            const barEl = document.getElementById('customProgressBar');
            if (pp2El) pp2El.textContent = `${progressVal}%`;
            if (barEl) barEl.style.width = `${progressVal}%`;
            planConfigs = {
                'Starter': {
                    min: Number(adminData.starter_min ?? 50),
                    max: Number(adminData.starter_max ?? 1000),
                    des: adminData.starter_des || 'Starter investment tier designed for new investors.'
                },
                'Mini': {
                    min: Number(adminData.mini_min ?? 1000),
                    max: Number(adminData.mini_max ?? 5000),
                    des: adminData.mini_des || 'Mini portfolio with essential features and enhanced ROI.'
                },
                'Silver': {
                    min: Number(adminData.sliver_min ?? 5000),
                    max: Number(adminData.sliver_max ?? 20000),
                    des: adminData.sliver_des || 'Silver portfolio offering higher yields and dedicated support.'
                },
                'Gold': {
                    min: Number(adminData.gold_min ?? 20000),
                    max: Number(adminData.gold_max ?? 50000),
                    des: adminData.gold_des || 'Gold Tier catering to institutional and high volume traders.'
                },
                'Platinum': {
                    min: Number(adminData.platinum_min ?? 50000),
                    max: Number(adminData.platinum_max ?? 100000),
                    des: adminData.platinum_des || 'Platinum VIP tier with maximum market access and priority concierge.'
                }
            };

            if (document.getElementById('starter_min')) document.getElementById('starter_min').textContent = formatCurrency(planConfigs.Starter.min);
            if (document.getElementById('starter_max')) document.getElementById('starter_max').textContent = formatCurrency(planConfigs.Starter.max);

            if (document.getElementById('mini_min')) document.getElementById('mini_min').textContent = formatCurrency(planConfigs.Mini.min);
            if (document.getElementById('mini_max')) document.getElementById('mini_max').textContent = formatCurrency(planConfigs.Mini.max);

            if (document.getElementById('sliver_min')) document.getElementById('sliver_min').textContent = formatCurrency(planConfigs.Silver.min);
            if (document.getElementById('sliver_max')) document.getElementById('sliver_max').textContent = formatCurrency(planConfigs.Silver.max);

            if (document.getElementById('gold_min')) document.getElementById('gold_min').textContent = formatCurrency(planConfigs.Gold.min);
            if (document.getElementById('gold_max')) document.getElementById('gold_max').textContent = formatCurrency(planConfigs.Gold.max);

            if (document.getElementById('platinum_min')) document.getElementById('platinum_min').textContent = formatCurrency(planConfigs.Platinum.min);
            if (document.getElementById('platinum_max')) document.getElementById('platinum_max').textContent = formatCurrency(planConfigs.Platinum.max);

            renderActivePlanCard();
            renderMigrationHistory(data.history || []);

        } catch (err) {
            console.error('Fetch Invest Data Error:', err);
        }
    }

    function renderActivePlanCard() {
        if (!currentUser || !currentUser.plan || currentUser.plan === 'No Active Plan') return;

        const currentPlanName = currentUser.plan;
        const targetCard = document.getElementById(`plan-card-${currentPlanName}`);

        if (targetCard) {
            targetCard.classList.add('current-active-plan');
            targetCard.style.border = '2px solid #10b981';
            targetCard.style.backgroundColor = 'rgba(16, 185, 129, 0.05)';

            const btn = targetCard.querySelector('.plan-btn');

            if (btn) {
                btn.outerHTML = `<button type="button" id="activePlanActionBtn" class="btn-primary" style="background:#10b981; opacity:1; width:100%; cursor:pointer; font-weight:600;">Active Plan</button>`;
            }

            const activeBtn = document.getElementById('activePlanActionBtn');
            if (activeBtn) {
                activeBtn.addEventListener('click', () => {
                    const planProfitVal = parseFloat(currentUser.plan_profit || 0);

                    Swal.fire({
                        title: `${currentPlanName} Plan Details`,
                        html: `
                            <div style="text-align: left; padding: 16px; background: rgba(16, 185, 129, 0.1); border-radius: 8px; margin-top: 10px;">
                                <div style="display:flex; justify-content:space-between; margin-bottom:12px; font-size:1rem;">
                                    <span style="color: var(--text-secondary);">Plan Profit:</span>
                                    <strong style="color:#10b981; font-size:1.1rem;">${formatCurrency(planProfitVal)}</strong>
                                </div>
                                <div style="display:flex; justify-content:space-between; font-size:1rem;">
                                    <span style="color: var(--text-secondary);">Status:</span>
                                    <strong style="color:#10b981;">Running</strong>
                                </div>
                            </div>
                        `,
                        showCancelButton: true,
                        showConfirmButton: planProfitVal > 0,
                        confirmButtonText: 'Move Profit to Account Balance',
                        confirmButtonColor: '#6366f1',
                        cancelButtonText: 'Close'
                    }).then((result) => {
                        if (result.isConfirmed) {
                            handleProfitClaim();
                        }
                    });
                });
            }
        }
    }

    async function handleProfitClaim() {
        const progressVal = parseInt(currentUser.progress || 0, 10);

        if (progressVal < 100) {
            Swal.fire({
                icon: 'warning',
                title: 'Progress Incomplete',
                html: `Trade progress is currently at <b>${progressVal}%</b>.<br>You can only move plan profit to your main account balance once trade progress reaches <b>100%</b>.`
            });
            return;
        }

        // Verify PIN setup exists
        if (!checkUserPinSetup()) return;

        Swal.fire({
            title: 'Enter Security PIN',
            text: `Enter your 4-digit PIN to transfer ${formatCurrency(currentUser.plan_profit)} to your account balance.`,
            input: 'password',
            inputAttributes: {
                maxlength: 4,
                autocapitalize: 'off',
                autocorrect: 'off',
                style: 'text-align: center; font-size: 24px; letter-spacing: 8px;'
            },
            showCancelButton: true,
            confirmButtonText: 'Transfer Now',
            showLoaderOnConfirm: true,
            preConfirm: async (pin) => {
                if (!pin) {
                    Swal.showValidationMessage('Security PIN is required.');
                    return false;
                }

                if (!/^\d{4}$/.test(pin.trim())) {
                    Swal.showValidationMessage('Security PIN must be exactly 4 digits.');
                    return false;
                }

                try {
                    const response = await fetch(`${API_BASE_URL}/api/invest_plan/claim-profit`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${userToken}`
                        },
                        body: JSON.stringify({
                            token: userToken,
                            signature: userSignature,
                            pin: pin.trim()
                        })
                    });

                    const resData = await response.json();

                    if (!response.ok || (!resData.status && !resData.success)) {
                        if (resData.code === 'NO_PIN_SETUP') {
                            checkUserPinSetup();
                            return false;
                        }
                        Swal.showValidationMessage(resData.message || resData.error || 'Failed to claim profit.');
                        return false;
                    }
                    return resData;
                } catch (err) {
                    Swal.showValidationMessage('Network connection error.');
                    return false;
                }
            }
        }).then((res) => {
            if (res.isConfirmed && res.value) {
                Swal.fire({
                    icon: 'success',
                    title: 'Transferred Successfully!',
                    text: res.value.message,
                    confirmButtonText: 'Done'
                }).then(() => {
                    window.location.reload();
                });
            }
        });
    }

    function renderMigrationHistory(records) {
        const tbody = document.getElementById('migrationHistoryBody');
        const counter = document.getElementById('recordCounter');

        if (counter) {
            counter.textContent = `Showing ${records ? records.length : 0} entries`;
        }

        if (!tbody) return;

        if (!records || records.length === 0) {
            tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 24px;">
                    No plan migration records found.
                </td>
            </tr>`;
            return;
        }

        const hasActivePlan = currentUser && currentUser.plan && currentUser.plan !== "No Active Plan";

        tbody.innerHTML = records.map((item, idx) => {
            let statusBadge = "";
            let planName = item.plan || '';

            if (item.plan === "Profit moved to balance") {
                statusBadge = `<span class="status-pill" style="background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600;"><i class="material-icons" style="font-size: 14px; vertical-align: middle; margin-right:2px;">cancel</i> Plan Closed</span>`;
            } else if (idx === 0 && hasActivePlan) {
                statusBadge = `<span class="status-pill status-completed"><i class="material-icons" style="font-size: 14px; vertical-align: middle;">check_circle</i> Active</span>`;
                if (!planName.toLowerCase().includes('plan')) planName += ' Plan';
            } else {
                statusBadge = `<span class="status-pill status-pending"><i class="material-icons" style="font-size: 14px; vertical-align: middle;">pause_circle</i> Inactive</span>`;
                if (!planName.toLowerCase().includes('plan')) planName += ' Plan';
            }

            return `
            <tr>
                <td data-label="#">#${idx + 1}</td>
                <td data-label="Migrated Plan">
                    <strong style="color: var(--color-primary); font-size: 0.95rem;">${planName}</strong>
                </td>
                <td data-label="Amount Invested">
                    <strong style="color: var(--color-success);">${formatCurrency(item.amount)}</strong>
                </td>
                <td data-label="Date & Time">${item.date || '-'}</td>
                <td data-label="Status">${statusBadge}</td>
            </tr>`;
        }).join('');
    }

    document.querySelectorAll('.plan-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const selectedPlan = e.currentTarget.getAttribute('data-plan');
            if (selectedPlan && planConfigs[selectedPlan]) {
                openInvestModal(selectedPlan);
            }
        });
    });

    function openInvestModal(initialPlan) {
        const userBal = parseFloat(currentUser.accountBalance || '0');

        const planOptionsHTML = Object.keys(planConfigs).map(plan => {
            const isSelected = plan === initialPlan ? 'selected' : '';
            return `<option value="${plan}" ${isSelected}>${plan} Plan</option>`;
        }).join('');

        Swal.fire({
            title: `Migrate Plan`,
            html: `
                <div style="background: rgba(99, 102, 241, 0.1); border-radius: 8px; padding: 12px; margin-bottom: 16px; text-align: left; font-size: 0.88rem;">
                    <div style="display: flex; justify-content: space-between;">
                        <span>Available Balance:</span>
                        <strong style="color: var(--color-success);">${formatCurrency(userBal)}</strong>
                    </div>
                </div>

                <div style="text-align: left;">
                    <div class="form-group" style="margin-bottom: 12px;">
                        <label style="display:block; font-size: 0.8rem; margin-bottom:4px; font-weight:600;">Select Plan</label>
                        <select id="swal-plan" class="form-control" style="width:100%; padding:10px; border-radius:6px; background:var(--bg-main); color:var(--text-primary); border:1px solid var(--border-color);">
                            ${planOptionsHTML}
                        </select>
                    </div>

                    <div id="swal-plan-des" style="background: rgba(99, 102, 241, 0.08); border-left: 3px solid #6366f1; padding: 10px; border-radius: 4px; font-size: 0.8rem; color: var(--text-primary); margin-bottom: 16px; min-height: 40px;">
                        ${planConfigs[initialPlan].des}
                    </div>

                    <div class="form-group" style="margin-bottom: 14px;">
                        <label style="display:block; font-size: 0.8rem; margin-bottom:4px; font-weight:600;">Investment Amount ($)</label>
                        <input type="number" id="swal-amount" class="form-control" style="width:100%; padding:10px; border-radius:6px; background:var(--bg-main); color:var(--text-primary); border:1px solid var(--border-color);" value="${planConfigs[initialPlan].min}" min="${planConfigs[initialPlan].min}">
                        <small id="swal-help-text" style="display: block; margin-top: 4px; color: var(--text-secondary); font-size: 0.78rem;">
                            Min: ${formatCurrency(planConfigs[initialPlan].min)} | Max: ${formatCurrency(planConfigs[initialPlan].max)}
                        </small>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Proceed to Confirm',
            cancelButtonText: 'Cancel',
            didOpen: () => {
                const planSelect = document.getElementById('swal-plan');
                const amountInput = document.getElementById('swal-amount');
                const helpText = document.getElementById('swal-help-text');
                const desBox = document.getElementById('swal-plan-des');

                planSelect.addEventListener('change', (e) => {
                    const newPlan = e.target.value;
                    const config = planConfigs[newPlan];

                    amountInput.min = config.min;
                    amountInput.value = config.min;
                    helpText.textContent = `Min: ${formatCurrency(config.min)} | Max: ${formatCurrency(config.max)}`;
                    desBox.textContent = config.des;
                });
            },
            preConfirm: () => {
                const selectedPlan = document.getElementById('swal-plan').value;
                const amount = parseFloat(document.getElementById('swal-amount').value);
                const config = planConfigs[selectedPlan];

                if (isNaN(amount) || amount < config.min || amount > config.max) {
                    Swal.showValidationMessage(`Amount for ${selectedPlan} Plan must be between ${formatCurrency(config.min)} and ${formatCurrency(config.max)}.`);
                    return false;
                }

                if (amount > userBal) {
                    Swal.showValidationMessage('Insufficient account balance. Please deposit funds first.');
                    return false;
                }

                return { selectedPlan, amount };
            }
        }).then((result) => {
            if (result.isConfirmed) {
                const { selectedPlan, amount } = result.value;

                if (!checkUserPinSetup()) return;

                promptPinAndMigrate(selectedPlan, amount);
            }
        });
    }

    function promptPinAndMigrate(selectedPlan, amount) {
        if (!checkUserPinSetup()) return;

        Swal.fire({
            title: 'Enter Security PIN',
            text: 'Enter your 4-digit Security PIN to authorize plan migration.',
            input: 'password',
            inputAttributes: {
                maxlength: 4,
                autocapitalize: 'off',
                autocorrect: 'off',
                style: 'text-align: center; font-size: 24px; letter-spacing: 8px;'
            },
            showCancelButton: true,
            confirmButtonText: 'Confirm Migration',
            showLoaderOnConfirm: true,
            preConfirm: async (pin) => {
                if (!pin) {
                    Swal.showValidationMessage('Security PIN is required.');
                    return false;
                }

                if (!/^\d{4}$/.test(pin.trim())) {
                    Swal.showValidationMessage('Security PIN must be exactly 4 digits.');
                    return false;
                }

                try {
                    const response = await fetch(`${API_BASE_URL}/api/invest_plan/migrate-plan`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${userToken}`
                        },
                        body: JSON.stringify({
                            token: userToken,
                            signature: userSignature,
                            selectedPlan,
                            amount,
                            pin: pin.trim()
                        })
                    });

                    const data = await response.json();
                    if (!response.ok || (!data.status && !data.success)) {
                        if (data.code === 'NO_PIN_SETUP') {
                            checkUserPinSetup();
                            return false;
                        }
                        Swal.showValidationMessage(data.message || data.error || 'Migration failed');
                        return false;
                    }

                    return data;
                } catch (err) {
                    Swal.showValidationMessage('Network error. Please try again.');
                    return false;
                }
            }
        }).then((res) => {
            if (res.isConfirmed && res.value) {
                Swal.fire({
                    icon: 'success',
                    title: 'Plan Activated!',
                    text: res.value.message || 'Plan migration successful!',
                    confirmButtonText: 'Done'
                }).then(() => {
                    window.location.reload();
                });
            }
        });
    }

    await loadInvestPageData();
});