/**
 * Deposit & Wallet Funding Controller
 */

(() => {
    const FUND_API_URL = window.FUND_API_URL || "http://localhost:5000/api/fund-wallet";
    const HARDCODED_SIGNATURE = window.HARDCODED_SIGNATURE || "flexboldx";

    document.addEventListener("DOMContentLoaded", async () => {
        const token = localStorage.getItem("user_token");

        if (!token) {
            window.location.href = "../login/index.html";
            return;
        }

        // DOM Elements
        const userBalanceEl = document.getElementById("userBalance");
        const pendingDepositEl = document.getElementById("pendingDeposit");
        const totalDepositEl = document.getElementById("totalDeposit");

        const cryptoSelect = document.getElementById("cryptoSelect");
        const paymentAddressBox = document.getElementById("paymentAddressBox");
        const walletAddressInput = document.getElementById("walletAddressInput");
        const cryptoQrImg = document.getElementById("cryptoQrImg");
        const cryptoNetworkBadge = document.getElementById("cryptoNetworkBadge");
        const copyAddressBtn = document.getElementById("copyAddressBtn");

        const depositAmountInput = document.getElementById("depositAmount");
        const cryptoConversionDisplay = document.getElementById("cryptoConversionDisplay");
        const convertedCryptoAmount = document.getElementById("convertedCryptoAmount");
        const convertedCryptoSymbol = document.getElementById("convertedCryptoSymbol");

        const proofFileInput = document.getElementById("proofFileInput");
        const fileNameDisplay = document.getElementById("fileNameDisplay");
        const depositForm = document.getElementById("depositForm");

        let availableAssets = [];
        let debounceTimer = null;
        const coinIdCache = {}; // Cache coin IDs dynamically resolved from CoinGecko

        // Helper to extract clean ticker symbol from DB asset_name (e.g. "LTH" or "Bitcoin (BTC)")
        function extractSymbol(assetName) {
            if (!assetName) return "CRYPTO";
            const match = assetName.match(/\(([^)]+)\)/);
            if (match) return match[1].trim().toUpperCase();
            return assetName.split(" ")[0].trim().toUpperCase();
        }

        // Dynamic CoinGecko ID resolver
        async function resolveCoinGeckoId(assetName) {
            const symbol = extractSymbol(assetName).toLowerCase();

            // Check in-memory cache first
            if (coinIdCache[symbol]) {
                return coinIdCache[symbol];
            }

            try {
                // Search CoinGecko API dynamically for the asset matching DB symbol
                const searchRes = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(symbol)}`);
                const searchData = await searchRes.json();

                if (searchData && searchData.coins && searchData.coins.length > 0) {
                    // Find exact symbol match or fallback to first search result
                    const exactMatch = searchData.coins.find(c => c.symbol.toLowerCase() === symbol);
                    const matchedId = exactMatch ? exactMatch.id : searchData.coins[0].id;
                    coinIdCache[symbol] = matchedId;
                    return matchedId;
                }
            } catch (err) {
                console.warn("Failed to search CoinGecko ID dynamically:", err);
            }

            // Fallback to raw symbol lowercase
            return symbol;
        }

        // -------------------------------------------------------------
        // 1. FETCH INITIAL BALANCE & GATEWAY ASSETS FOR SIGNATURE
        // -------------------------------------------------------------
        try {
            const response = await fetch(FUND_API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    action: "get_deposit_data",
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

            // Populate metrics in USD
            if (userBalanceEl) userBalanceEl.textContent = `$${formatCurrency(result.user.accountBalance)}`;
            if (pendingDepositEl) pendingDepositEl.textContent = `$${formatCurrency(result.user.pendingdeposit)}`;
            if (totalDepositEl) totalDepositEl.textContent = `$${formatCurrency(result.user.totaldeposit)}`;

            // Hydrate asset dropdown dynamically from DB response
            availableAssets = result.assets || [];
            if (cryptoSelect) {
                cryptoSelect.innerHTML = `<option value="" disabled selected>-- Select Payment Gateway Asset --</option>`;

                if (availableAssets.length === 0) {
                    const opt = document.createElement("option");
                    opt.disabled = true;
                    opt.textContent = "No payment gateways available";
                    cryptoSelect.appendChild(opt);
                } else {
                    availableAssets.forEach(asset => {
                        const opt = document.createElement("option");
                        opt.value = asset.id;
                        opt.textContent = asset.asset_name;
                        cryptoSelect.appendChild(opt);
                    });
                }
            }

        } catch (err) {
            console.error("Error loading deposit details:", err);
            Swal.fire("Error", "Could not load deposit gateways. Please refresh.", "error");
        }

        // -------------------------------------------------------------
        // 2. DROPDOWN SELECTION LOGIC
        // -------------------------------------------------------------
        cryptoSelect?.addEventListener("change", (e) => {
            const selectedAssetId = e.target.value;
            const selectedAsset = availableAssets.find(a => String(a.id) === String(selectedAssetId));

            if (selectedAsset) {
                walletAddressInput.value = selectedAsset.asset_address || "";
                cryptoNetworkBadge.textContent = selectedAsset.asset_name;
                cryptoQrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(selectedAsset.asset_address)}`;
                paymentAddressBox.classList.remove("hidden");
            } else {
                paymentAddressBox.classList.add("hidden");
            }

            triggerRealtimeConversion();
        });

        // -------------------------------------------------------------
        // 3. REALTIME CRYPTO CONVERSION FETCH (DYNAMIC DB ASSET)
        // -------------------------------------------------------------
        depositAmountInput?.addEventListener("input", () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                triggerRealtimeConversion();
            }, 600);
        });

        async function triggerRealtimeConversion() {
            const amountUsd = parseFloat(depositAmountInput.value);
            const selectedAssetId = cryptoSelect.value;
            const selectedAsset = availableAssets.find(a => String(a.id) === String(selectedAssetId));

            if (!amountUsd || amountUsd <= 0 || !selectedAsset) {
                if (cryptoConversionDisplay) cryptoConversionDisplay.style.display = "none";
                return;
            }

            const symbol = extractSymbol(selectedAsset.asset_name);

            if (convertedCryptoSymbol) convertedCryptoSymbol.textContent = symbol;
            if (convertedCryptoAmount) convertedCryptoAmount.textContent = "Calculating...";
            if (cryptoConversionDisplay) cryptoConversionDisplay.style.display = "block";

            try {
                // Dynamically resolve CoinGecko API ID for the selected DB asset
                const coinId = await resolveCoinGeckoId(selectedAsset.asset_name);

                const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`);
                const data = await res.json();

                if (data[coinId] && data[coinId].usd) {
                    const priceInUsd = data[coinId].usd;
                    const cryptoVal = (amountUsd / priceInUsd).toFixed(8);
                    if (convertedCryptoAmount) convertedCryptoAmount.textContent = cryptoVal;
                } else {
                    if (convertedCryptoAmount) convertedCryptoAmount.textContent = "Rate unavailable";
                }
            } catch (err) {
                console.warn("Could not fetch crypto rate:", err);
                if (convertedCryptoAmount) convertedCryptoAmount.textContent = "Rate unavailable";
            }
        }

        // -------------------------------------------------------------
        // 4. COPY ADDRESS & FILE ATTACHMENT LOGIC
        // -------------------------------------------------------------
        copyAddressBtn?.addEventListener("click", () => {
            if (!walletAddressInput.value) return;

            navigator.clipboard.writeText(walletAddressInput.value).then(() => {
                Swal.fire({
                    icon: "success",
                    title: "Address Copied!",
                    text: "Wallet address copied to clipboard.",
                    timer: 1800,
                    showConfirmButton: false
                });
            });
        });

        proofFileInput?.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (file) {
                fileNameDisplay.textContent = `Attached: ${file.name}`;
                fileNameDisplay.style.color = "var(--color-success, #10b981)";
            } else {
                fileNameDisplay.textContent = "Click or drag & drop payment proof image here";
                fileNameDisplay.style.color = "var(--text-secondary, #94a3b8)";
            }
        });

        // -------------------------------------------------------------
        // 5. DEPOSIT FORM SUBMISSION
        // -------------------------------------------------------------
        depositForm?.addEventListener("submit", async (e) => {
            e.preventDefault();

            const selectedAssetId = cryptoSelect.value;
            const selectedAsset = availableAssets.find(a => String(a.id) === String(selectedAssetId));
            const amount = depositAmountInput.value;
            const proofFile = proofFileInput.files[0];

            if (!selectedAsset) {
                Swal.fire({ icon: "warning", title: "Select Asset", text: "Please select a valid payment gateway asset." });
                return;
            }

            if (!amount || parseFloat(amount) <= 0) {
                Swal.fire({ icon: "warning", title: "Invalid Amount", text: "Please enter a valid deposit amount." });
                return;
            }

            if (!proofFile) {
                Swal.fire({ icon: "warning", title: "Proof Required", text: "Please upload payment receipt or screenshot proof." });
                return;
            }

            Swal.fire({
                title: "Submitting Deposit...",
                text: "Uploading proof and logging your transaction.",
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            try {
                const base64File = await fileToBase64(proofFile);

                const payload = {
                    action: "submit_deposit",
                    signature: HARDCODED_SIGNATURE,
                    asset_name: selectedAsset.asset_name,
                    address: selectedAsset.asset_address,
                    amount: amount,
                    imageBase64: base64File,
                    fileName: proofFile.name,
                    fileType: proofFile.type
                };

                const response = await fetch(FUND_API_URL, {
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
                        title: "Deposit Submitted!",
                        text: "Your deposit request has been submitted successfully and is currently under review.",
                        confirmButtonText: "Done"
                    }).then(() => {
                        depositForm.reset();
                        paymentAddressBox.classList.add("hidden");
                        if (cryptoConversionDisplay) cryptoConversionDisplay.style.display = "none";
                        fileNameDisplay.textContent = "Click or drag & drop payment proof image here";
                        fileNameDisplay.style.color = "var(--text-secondary, #94a3b8)";
                        window.location.reload();
                    });
                } else {
                    Swal.fire({ icon: "error", title: "Submission Failed", text: result.error || "Could not log deposit request." });
                }

            } catch (error) {
                console.error("Submission Error:", error);
                Swal.fire("Error", "An unexpected error occurred while processing your deposit.", "error");
            }
        });
    });

    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }

    function formatCurrency(val) {
        const num = parseFloat(val);
        if (isNaN(num)) return "0.00";
        return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
})();