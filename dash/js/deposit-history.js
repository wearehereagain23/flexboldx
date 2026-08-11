/**
 * Deposit History Frontend Controller
 */

(() => {
    const HISTORY_API_URL = window.HISTORY_API_URL || "https://broker-chi-five.vercel.app/api/fund-wallet-history";
    const HARDCODED_SIGNATURE = window.HARDCODED_SIGNATURE || "flexboldx";

    let depositHistory = [];
    const itemsPerPage = 20;
    let currentPage = 1;

    document.addEventListener("DOMContentLoaded", async () => {
        const token = localStorage.getItem("user_token");

        if (!token) {
            window.location.href = "../login/index.html";
            return;
        }

        // DOM Elements
        const tableBody = document.getElementById("depositTableBody");
        const recordCounter = document.getElementById("recordCounter");
        const prevBtn = document.getElementById("prevBtn");
        const nextBtn = document.getElementById("nextBtn");
        const pageIndicator = document.getElementById("pageIndicator");

        // Metrics DOM Elements
        const userBalanceEl = document.getElementById("userBalance");
        const pendingDepositEl = document.getElementById("pendingDeposit");
        const totalDepositEl = document.getElementById("totalDeposit");

        // Modal Elements
        const txModalOverlay = document.getElementById("txModalOverlay");
        const closeModalBtn = document.getElementById("closeModalBtn");
        const saveReceiptBtn = document.getElementById("saveReceiptBtn");
        const receiptPreviewBox = document.getElementById("receiptPreviewBox");

        const modalTxId = document.getElementById("modalTxId");
        const modalName = document.getElementById("modalName");
        const modalAsset = document.getElementById("modalAsset");
        const modalAddress = document.getElementById("modalAddress");
        const modalAmount = document.getElementById("modalAmount");
        const modalDate = document.getElementById("modalDate");
        const modalStatus = document.getElementById("modalStatus");

        // -------------------------------------------------------------
        // 1. FETCH DEPOSIT HISTORY FROM BACKEND
        // -------------------------------------------------------------
        try {
            const response = await fetch(HISTORY_API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    signature: HARDCODED_SIGNATURE
                })
            });

            const result = await response.json();

            if (!result.success) {
                Swal.fire({
                    icon: "error",
                    title: "Session Expired",
                    text: result.error || "Please log in again."
                }).then(() => {
                    localStorage.removeItem("user_token");
                    window.location.href = "../login/index.html";
                });
                return;
            }

            // Hydrate Header Financial Metrics
            const currencySym = "$";
            if (userBalanceEl) userBalanceEl.textContent = `${currencySym}${formatCurrency(result.user.accountBalance)}`;
            if (pendingDepositEl) pendingDepositEl.textContent = `${currencySym}${formatCurrency(result.user.pendingdeposit)}`;
            if (totalDepositEl) totalDepositEl.textContent = `${currencySym}${formatCurrency(result.user.totaldeposit)}`;

            // Map and Save DB Records
            depositHistory = (result.deposits || []).map(tx => ({
                id: `TXN-${tx.id}`,
                name: tx.username || result.user.username || "N/A",
                currency: tx.asset_name || "Crypto",
                address: tx.address || "N/A",
                amount: parseFloat(tx.amount || 0),
                date: tx.date ? new Date(tx.date).toLocaleString() : (tx.created_at ? new Date(tx.created_at).toLocaleString() : "N/A"),
                status: (tx.status || "pending").toLowerCase(),
                proofUrl: tx.imageProf || ""
            }));

            renderTable(currentPage);

        } catch (err) {
            console.error("Error fetching deposit history:", err);
            Swal.fire("Error", "Could not load deposit history. Please refresh.", "error");
        }

        // -------------------------------------------------------------
        // 2. RENDER TABLE DATA ROWS
        // -------------------------------------------------------------
        function renderTable(page) {
            if (!tableBody) return;
            tableBody.innerHTML = "";

            if (depositHistory.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="8" style="text-align: center; padding: 30px; color: #94a3b8;">
                            No deposit history records found.
                        </td>
                    </tr>
                `;
                if (recordCounter) recordCounter.textContent = "Showing 0 entries";
                updatePaginationControls();
                return;
            }

            const startIndex = (page - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;
            const pageData = depositHistory.slice(startIndex, endIndex);

            if (recordCounter) {
                recordCounter.textContent = `Showing ${startIndex + 1} - ${Math.min(endIndex, depositHistory.length)} of ${depositHistory.length} entries`;
            }

            pageData.forEach(tx => {
                const row = document.createElement("tr");

                const shortAddress = tx.address !== "N/A" && tx.address.length > 10
                    ? `${tx.address.substring(0, 6)}...${tx.address.substring(tx.address.length - 4)}`
                    : tx.address;

                row.innerHTML = `
                    <td data-label="Transaction ID"><strong>${tx.id}</strong></td>
                    <td data-label="Username">${tx.name}</td>
                    <td data-label="Asset">${tx.currency}</td>
                    <td data-label="Address"><span class="break-all" title="${tx.address}">${shortAddress}</span></td>
                    <td data-label="Amount">$${formatCurrency(tx.amount)}</td>
                    <td data-label="Date">${tx.date}</td>
                    <td data-label="Status"><span class="status-pill status-${tx.status}">${tx.status}</span></td>
                    <td data-label="Action">
                        <button class="btn-primary action-view-btn" data-id="${tx.id}">
                            <i class="material-icons" style="font-size: 16px;">visibility</i> View
                        </button>
                    </td>
                `;

                tableBody.appendChild(row);
            });

            // Action listeners for receipt modal
            document.querySelectorAll(".action-view-btn").forEach(btn => {
                btn.addEventListener("click", (e) => {
                    const txId = e.currentTarget.getAttribute("data-id");
                    const selectedTx = depositHistory.find(item => item.id === txId);
                    if (selectedTx) openTransactionModal(selectedTx);
                });
            });

            updatePaginationControls();
        }

        // -------------------------------------------------------------
        // 3. PAGINATION CONTROLS LOGIC
        // -------------------------------------------------------------
        function updatePaginationControls() {
            const totalPages = Math.ceil(depositHistory.length / itemsPerPage) || 1;

            if (pageIndicator) pageIndicator.textContent = `Page ${currentPage} of ${totalPages}`;

            if (prevBtn) prevBtn.style.display = currentPage > 1 ? "inline-flex" : "none";
            if (nextBtn) nextBtn.style.display = currentPage < totalPages ? "inline-flex" : "none";
        }

        prevBtn?.addEventListener("click", () => {
            if (currentPage > 1) {
                currentPage--;
                renderTable(currentPage);
            }
        });

        nextBtn?.addEventListener("click", () => {
            const totalPages = Math.ceil(depositHistory.length / itemsPerPage);
            if (currentPage < totalPages) {
                currentPage++;
                renderTable(currentPage);
            }
        });

        // -------------------------------------------------------------
        // 4. TRANSACTION DETAILS MODAL
        // -------------------------------------------------------------
        function openTransactionModal(tx) {
            if (modalTxId) modalTxId.textContent = tx.id;
            if (modalName) modalName.textContent = tx.name;
            if (modalAsset) modalAsset.textContent = tx.currency;
            if (modalAddress) modalAddress.textContent = tx.address;
            if (modalAmount) modalAmount.textContent = `$${formatCurrency(tx.amount)}`;
            if (modalDate) modalDate.textContent = tx.date;

            if (modalStatus) {
                modalStatus.textContent = tx.status;
                modalStatus.className = `status-pill status-${tx.status}`;
            }

            txModalOverlay?.classList.add("active");
        }

        closeModalBtn?.addEventListener("click", () => {
            txModalOverlay?.classList.remove("active");
        });

        txModalOverlay?.addEventListener("click", (e) => {
            if (e.target === txModalOverlay) {
                txModalOverlay.classList.remove("active");
            }
        });

        // -------------------------------------------------------------
        // 5. SAVE RECEIPT AS IMAGE (html2canvas)
        // -------------------------------------------------------------
        saveReceiptBtn?.addEventListener("click", () => {
            if (!receiptPreviewBox) return;

            Swal.fire({
                title: "Generating Image...",
                text: "Preparing your transaction receipt image download.",
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            html2canvas(receiptPreviewBox, {
                scale: 2,
                backgroundColor: null
            }).then(canvas => {
                const link = document.createElement("a");
                link.download = `Receipt_${modalTxId?.textContent || "deposit"}.png`;
                link.href = canvas.toDataURL("image/png");
                link.click();

                Swal.fire({
                    icon: "success",
                    title: "Downloaded!",
                    text: "Transaction receipt image saved successfully.",
                    timer: 2000,
                    showConfirmButton: false
                });
            }).catch(err => {
                console.error("Failed to generate receipt image:", err);
                Swal.fire("Error", "Could not generate receipt image. Please try again.", "error");
            });
        });
    });

    /**
     * Helper to format numbers to currency format
     */
    function formatCurrency(val) {
        const num = parseFloat(val);
        if (isNaN(num)) return "0.00";
        return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
})();