document.addEventListener("DOMContentLoaded", async () => {
    const WITHDRAW_HISTORY_API = "https://broker-chi-five.vercel.app/api/withdrawal-history";
    const token = localStorage.getItem("user_token");

    if (!token) {
        window.location.href = "../login/index.html";
        return;
    }

    // Top Metric DOM Elements
    const userBalanceEl = document.getElementById("user-balance");
    const pendingWithdrawEl = document.getElementById("pending-withdraw");
    const totalWithdrawnEl = document.getElementById("total-withdrawn");

    // Table & Control DOM Elements
    const tableBody = document.getElementById("withdrawalTableBody");
    const recordCounter = document.getElementById("recordCounter");
    const filterTabs = document.querySelectorAll(".tab-btn");

    // Pagination Controls
    const prevBtn = document.getElementById("prevBtn");
    const nextBtn = document.getElementById("nextBtn");
    const pageIndicator = document.getElementById("pageIndicator");
    const paginationControls = document.getElementById("paginationControls");

    // Modal DOM Elements
    const modalOverlay = document.getElementById("txModalOverlay");
    const closeModalBtn = document.getElementById("closeModalBtn");
    const saveReceiptBtn = document.getElementById("saveReceiptBtn");

    const modalStatusBadgeIcon = document.getElementById("modalStatusBadgeIcon");
    const modalStatusTitle = document.getElementById("modalStatusTitle");
    const modalStatusSubtitle = document.getElementById("modalStatusSubtitle");

    const modalTxId = document.getElementById("modalTxId");
    const modalDate = document.getElementById("modalDate");
    const modalAmount = document.getElementById("modalAmount");
    const modalAmountInWords = document.getElementById("modalAmountInWords");
    const modalType = document.getElementById("modalType");
    const modalName = document.getElementById("modalName");
    const modalDetails = document.getElementById("modalDetails");
    const modalStatus = document.getElementById("modalStatus");
    const modalReference = document.getElementById("modalReference");
    const modalQrImg = document.getElementById("modalQrImg");

    let historyData = [];
    let currentFilter = "all";
    const activeCurrency = "$";
    let currentPage = 1;
    const itemsPerPage = 8;

    // Helper: Number to Words conversion
    function numberToWords(num) {
        if (num === 0) return "Zero US Dollars";
        const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
        const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

        function inWords(n) {
            if ((n = n.toString()).length > 9) return 'overflow';
            let n_array = ('000000000' + n).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
            if (!n_array) return '';
            let words = '';
            words += (n_array[1] != 0) ? (a[Number(n_array[1])] || b[n_array[1][0]] + ' ' + a[n_array[1][1]]) + 'Crore ' : '';
            words += (n_array[2] != 0) ? (a[Number(n_array[2])] || b[n_array[2][0]] + ' ' + a[n_array[2][1]]) + 'Lakh ' : '';
            words += (n_array[3] != 0) ? (a[Number(n_array[3])] || b[n_array[3][0]] + ' ' + a[n_array[3][1]]) + 'Thousand ' : '';
            words += (n_array[4] != 0) ? (a[Number(n_array[4])] || b[n_array[4][0]] + ' ' + a[n_array[4][1]]) + 'Hundred ' : '';
            words += (n_array[5] != 0) ? ((words != '') ? 'and ' : '') + (a[Number(n_array[5])] || b[n_array[5][0]] + ' ' + a[n_array[5][1]]) : '';
            return words;
        }

        const dollars = Math.floor(num);
        const cents = Math.round((num - dollars) * 100);
        let result = inWords(dollars) + "US Dollars";
        if (cents > 0) result += " and " + cents + "/100 Cents";
        return result;
    }

    // Helper: Currency Formatter
    function formatCurrency(val) {
        return parseFloat(val || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    // Helper: Date Formatter
    function formatDate(dateStr) {
        if (!dateStr) return "-";
        const date = new Date(dateStr);
        return isNaN(date.getTime()) ? dateStr : date.toLocaleString("en-US", {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // Helper: Normalize item structure from API data
    function normalizeWithdrawal(item) {
        const method = item.withdrawalMethod || item.method || item.type || "Withdrawal";
        let cryptoBank = item.pay_method || item.bank_name || method;
        let details = item.btc_address || item.acct_no || item.recipient_username || item.details || "-";

        if (item.bank_name && item.acct_no) {
            details = `${item.bank_name} - ${item.acct_no}`;
        }

        return {
            txId: String(item.id || item.txId || item.reference || "N/A"),
            rawId: item.id || item.txId,
            type: method,
            method: method,
            cryptoBank: cryptoBank,
            details: details,
            amount: parseFloat(item.amount || 0),
            date: formatDate(item.created_at || item.date),
            status: item.status || "Pending",
            acctName: item.acct_name || item.recipient_username || item.senderName || "Valued Customer"
        };
    }

    // 1. Load Data from Backend API
    async function fetchWithdrawalHistory() {
        try {
            const signature = localStorage.getItem("user_signature");

            const requestBody = { token };
            if (signature) requestBody.signature = signature;

            const response = await fetch(WITHDRAW_HISTORY_API, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.removeItem("user_token");
                    window.location.href = "../login/index.html";
                    return;
                }
                throw new Error(`Server returned HTTP ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                if (userBalanceEl) userBalanceEl.textContent = `${activeCurrency}${formatCurrency(result.accountBalance)}`;
                if (pendingWithdrawEl) pendingWithdrawEl.textContent = `${activeCurrency}${formatCurrency(result.pendingwithdraw || result.pendingWithdraw)}`;
                if (totalWithdrawnEl) totalWithdrawnEl.textContent = `${activeCurrency}${formatCurrency(result.totalwithdraw || result.totalWithdrawn)}`;

                const rawList = result.withdrawals || [];
                historyData = rawList.map(normalizeWithdrawal);
                renderTable();
            } else if (result.error && result.error.includes("Unauthorized")) {
                localStorage.removeItem("user_token");
                window.location.href = "../login/index.html";
            } else {
                console.error("Failed to load withdrawal history:", result.error);
            }
        } catch (err) {
            console.error("Error fetching withdrawal history:", err);
        }
    }

    // 2. Render Table Rows & Handle Pagination
    function renderTable() {
        if (!tableBody) return;
        tableBody.innerHTML = "";

        const filtered = currentFilter === "all"
            ? historyData
            : historyData.filter(item =>
                item.method.toLowerCase().includes(currentFilter.toLowerCase()) ||
                item.type.toLowerCase().includes(currentFilter.toLowerCase())
            );

        if (recordCounter) {
            recordCounter.textContent = `Showing ${filtered.length} entries`;
        }

        if (filtered.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; color: var(--text-secondary); padding: 24px;">
                        No withdrawal transactions found.
                    </td>
                </tr>
            `;
            updatePaginationControls(0);
            return;
        }

        const totalPages = Math.ceil(filtered.length / itemsPerPage);
        if (currentPage > totalPages) currentPage = totalPages;

        const startIndex = (currentPage - 1) * itemsPerPage;
        const pageItems = filtered.slice(startIndex, startIndex + itemsPerPage);

        pageItems.forEach(item => {
            const row = document.createElement("tr");
            const statusClass = (item.status || "Pending").toLowerCase();

            row.innerHTML = `
                <td data-label="Transaction ID"><strong>#${item.txId}</strong></td>
                <td data-label="Type">${item.type}</td>
                <td data-label="Details / Recipient" class="break-all">${item.cryptoBank}: ${item.details}</td>
                <td data-label="Amount ($)"><strong>${activeCurrency}${formatCurrency(item.amount)}</strong></td>
                <td data-label="Date">${item.date}</td>
                <td data-label="Status"><span class="status-pill ${statusClass}">${item.status}</span></td>
                <td data-label="Action">
                    <button type="button" class="btn-view-tx" data-id="${item.txId}">
                        <i class="material-icons">visibility</i> View
                    </button>
                </td>
            `;

            tableBody.appendChild(row);
        });

        attachViewEventListeners(filtered);
        updatePaginationControls(totalPages);
    }

    // 3. Attach Click Event to "View" Receipt Buttons
    function attachViewEventListeners(data) {
        document.querySelectorAll(".btn-view-tx").forEach(btn => {
            btn.addEventListener("click", () => {
                const txId = btn.getAttribute("data-id");
                const item = data.find(t => String(t.txId) === String(txId));

                if (item) {
                    modalTxId.textContent = `#${item.txId}`;
                    modalDate.textContent = item.date;
                    modalAmount.textContent = `${activeCurrency}${formatCurrency(item.amount)} USD`;
                    modalAmountInWords.textContent = numberToWords(item.amount);
                    modalType.textContent = `${item.method} (${item.cryptoBank})`;

                    modalName.textContent = item.acctName;
                    modalDetails.textContent = item.details;
                    modalReference.textContent = `REF-${item.txId}`;

                    const statusLower = (item.status || "pending").toLowerCase();
                    modalStatus.textContent = item.status.toUpperCase();
                    modalStatus.className = `receipt-status-pill status-${statusLower}`;

                    // Update Receipt Header Badges
                    if (statusLower === "completed" || statusLower === "approved") {
                        modalStatusBadgeIcon.className = "receipt-success-icon status-success";
                        modalStatusBadgeIcon.innerHTML = `<i class="material-icons">check</i>`;
                        modalStatusTitle.textContent = "PAYOUT SUCCESSFUL";
                        modalStatusSubtitle.textContent = "Your withdrawal request has been completed.";
                    } else if (statusLower === "pending") {
                        modalStatusBadgeIcon.className = "receipt-success-icon status-pending";
                        modalStatusBadgeIcon.innerHTML = `<i class="material-icons">hourglass_empty</i>`;
                        modalStatusTitle.textContent = "PAYOUT PENDING";
                        modalStatusSubtitle.textContent = "Your withdrawal request is currently under review.";
                    } else {
                        modalStatusBadgeIcon.className = "receipt-success-icon status-rejected";
                        modalStatusBadgeIcon.innerHTML = `<i class="material-icons">close</i>`;
                        modalStatusTitle.textContent = "PAYOUT FAILED";
                        modalStatusSubtitle.textContent = "This withdrawal request could not be completed.";
                    }

                    // QR Code Generator
                    modalQrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=Withdrawal-${item.txId}`;

                    modalOverlay.classList.add("active");
                }
            });
        });
    }

    // 4. Pagination Event Listeners
    function updatePaginationControls(totalPages) {
        if (!paginationControls) return;

        if (totalPages <= 1) {
            prevBtn.style.display = "none";
            nextBtn.style.display = "none";
            pageIndicator.style.display = "none";
            return;
        }

        prevBtn.style.display = currentPage > 1 ? "inline-flex" : "none";
        nextBtn.style.display = currentPage < totalPages ? "inline-flex" : "none";

        pageIndicator.style.display = "inline-block";
        pageIndicator.textContent = `Page ${currentPage} of ${totalPages}`;
    }

    prevBtn?.addEventListener("click", () => {
        if (currentPage > 1) {
            currentPage--;
            renderTable();
        }
    });

    nextBtn?.addEventListener("click", () => {
        currentPage++;
        renderTable();
    });

    // 5. Tab Filtering
    filterTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            filterTabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");

            currentFilter = tab.getAttribute("data-tab");
            currentPage = 1;
            renderTable();
        });
    });

    // 6. Close Modal Listeners
    closeModalBtn?.addEventListener("click", () => {
        modalOverlay.classList.remove("active");
    });

    modalOverlay?.addEventListener("click", (e) => {
        if (e.target === modalOverlay) {
            modalOverlay.classList.remove("active");
        }
    });

    // 7. Download Receipt Image Logic via html2canvas
    saveReceiptBtn?.addEventListener("click", () => {
        const previewArea = document.getElementById("receiptPreviewBox");
        if (!previewArea) return;

        html2canvas(previewArea, {
            scale: 2,
            backgroundColor: "#0d1322"
        }).then(canvas => {
            const link = document.createElement("a");
            link.download = `Withdrawal_Receipt_${modalTxId.textContent.replace('#', '')}.png`;
            link.href = canvas.toDataURL("image/png");
            link.click();
        });
    });

    // Initial Execution
    await fetchWithdrawalHistory();
});