let activeChatSessionUserUuid = null;
let activeChatSessionUserEmail = null;
let currentChatPaginationPage = 1;
const chatMaxLimitPerPage = 20;
let isChatInfiniteScrollLoading = false;
let absoluteHasOlderDatabaseMessages = true;

export function setupSecureChatChannel(userUuid, userEmail = null) {
    activeChatSessionUserUuid = userUuid;
    activeChatSessionUserEmail = userEmail;
    currentChatPaginationPage = 1;
    absoluteHasOlderDatabaseMessages = true;
    isChatInfiniteScrollLoading = false;

    const textInput = document.getElementById("chat-terminal-text-field");
    const sendBtn = document.getElementById("chat-send-message-btn");
    const attachBtn = document.getElementById("chat-attachment-trigger-btn");
    const hiddenFile = document.getElementById("chat-image-attachment-input");
    const feedElementContainer = document.getElementById("chat-message-feed");

    const deleteAllBtn = document.getElementById("chat-header-delete-all-btn");

    if (deleteAllBtn) deleteAllBtn.onclick = null;

    // Header Trigger: Delete All Chat Thread
    if (deleteAllBtn) {
        deleteAllBtn.onclick = async () => {
            if (!activeChatSessionUserUuid) return;

            const confirmPurge = await Swal.fire({
                title: "Purge Entire Chat Log?",
                text: "This action will permanently delete all chat messages for this user.",
                icon: "warning",
                showCancelButton: true,
                confirmButtonColor: "#ef4444",
                cancelButtonColor: "#64748b",
                confirmButtonText: "Yes, Delete All"
            });

            if (confirmPurge.isConfirmed) {
                const adminToken = localStorage.getItem("admin_session_token");
                try {
                    const r = await fetch(`https://broker-chi-five.vercel.app/api/admin-chat?purge_all=true&user_uuid=${activeChatSessionUserUuid}`, {
                        method: "DELETE",
                        headers: { "Authorization": `Bearer ${adminToken}` }
                    });
                    const resData = await r.json();

                    if (resData.success) {
                        const localizedCacheKey = `admin_chat_history_${activeChatSessionUserUuid}`;
                        localStorage.removeItem(localizedCacheKey);
                        renderChatMessageFeedFromCacheArray([], false);
                        Swal.fire("Purged!", "All messages cleared.", "success");
                    } else {
                        Swal.fire("Error", resData.error || "Failed to purge messages.", "error");
                    }
                } catch (err) {
                    Swal.fire("Error", "Server connection failure.", "error");
                }
            }
        };
    }

    // Baseline Cache Hydration
    const localizedCacheKey = `admin_chat_history_${activeChatSessionUserUuid}`;
    const historicalLocalMessages = localStorage.getItem(localizedCacheKey);

    if (historicalLocalMessages) {
        try {
            const cachedObjectArray = JSON.parse(historicalLocalMessages);
            renderChatMessageFeedFromCacheArray(cachedObjectArray, false);
        } catch (err) {
            console.warn("⚠️ Chat local cache parse error:", err);
        }
    } else {
        if (feedElementContainer) {
            feedElementContainer.innerHTML = `
                <div class="system-security-notice-bubble">
                    <i data-lucide="lock" class="inline-status-icon"></i>
                    <span>Initializing transaction secure conversation channel matrices...</span>
                </div>`;
            if (window.lucide) lucide.createIcons();
        }
    }

    fetchSecureConversationStreams(true);

    if (feedElementContainer) {
        feedElementContainer.onscroll = async () => {
            if (feedElementContainer.scrollTop === 0 && !isChatInfiniteScrollLoading && absoluteHasOlderDatabaseMessages) {
                await fetchOlderHistoricalChatLogs();
            }
        };
    }

    sendBtn.onclick = null;
    attachBtn.onclick = null;
    hiddenFile.onchange = null;

    sendBtn.onclick = async () => {
        const text = textInput.value.trim();
        if (!text) return;

        textInput.value = "";
        const temporaryMessageId = `temp_msg_${Date.now()}`;
        injectOptimisticChatBubbleNode(text, null, temporaryMessageId);
        await dispatchMessagePayload(text, null, temporaryMessageId);
    };

    attachBtn.onclick = () => hiddenFile.click();
    hiddenFile.onchange = async (e) => {
        if (e.target.files.length > 0) {
            const targetFile = e.target.files[0];
            const localOptimisticObjectURL = URL.createObjectURL(targetFile);
            const temporaryMessageId = `temp_msg_${Date.now()}`;

            const attachmentPlaceholderText = "Shared a secure file document update.";
            injectOptimisticChatBubbleNode(attachmentPlaceholderText, localOptimisticObjectURL, temporaryMessageId);
            const uploadedUrl = await clearFileAssetStorageUpload(targetFile);

            if (uploadedUrl) {
                URL.revokeObjectURL(localOptimisticObjectURL);
                await dispatchMessagePayload(attachmentPlaceholderText, uploadedUrl, temporaryMessageId);
            } else {
                markOptimisticBubbleExecutionStateAsDropped(temporaryMessageId);
            }
        }
    };
}

function renderChatMessageFeedFromCacheArray(messagesArray, preserveScrollPosition = false) {
    const feed = document.getElementById("chat-message-feed");
    if (!feed) return;

    const previousScrollHeight = feed.scrollHeight;

    feed.innerHTML = `
        <div class="system-security-notice-bubble">
            <i data-lucide="lock" class="inline-status-icon"></i>
            <span>Messages are synced over administrative ledger configurations.</span>
        </div>`;

    messagesArray.forEach(msg => {
        const container = document.createElement("div");
        const isAdmin = msg.sender_role === "admin_2";
        const alignmentClass = isAdmin ? "outgoing" : "incoming";

        container.className = `msg-bubble ${alignmentClass}`;
        if (msg.isSending) container.classList.add("msg-bubble-is-sending");
        if (msg.isFailed) container.classList.add("msg-bubble-execution-failed");
        if (msg.id) container.setAttribute("data-msg-node-id", msg.id);

        let attachmentContentHTML = "";
        if (msg.attachment_url) {
            attachmentContentHTML = `<img src="${msg.attachment_url}" style="max-width:100%; border-radius:6px; margin-bottom:4px; display:block;" alt="Media Asset">`;
        }

        let statusIndicatorMessage = "";
        if (msg.isSending) statusIndicatorMessage = ` <small class="text-sending-indicator">⏱️ Sending...</small>`;
        if (msg.isFailed) statusIndicatorMessage = ` <small class="text-failed-indicator">🔴 Failed to Sync</small>`;

        const timeString = msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : "--:--";

        let adminActionToolbarHTML = "";
        if (isAdmin && msg.id && !msg.isSending) {
            adminActionToolbarHTML = `
                <div class="msg-action-bar" style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 4px;">
                    <button type="button" class="btn-edit-msg" data-id="${msg.id}" style="background: none; border: none; color: #94a3b8; cursor: pointer; padding: 2px;" title="Edit Message">
                        <i data-lucide="edit-3" style="width: 14px; height: 14px;"></i>
                    </button>
                    <button type="button" class="btn-delete-msg" data-id="${msg.id}" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 2px;" title="Delete Message">
                        <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                    </button>
                </div>
            `;
        }

        container.innerHTML = `
            ${attachmentContentHTML}
            <p id="msg-body-text-${msg.id}">${escapeHTML(msg.message_body || '')}</p>
            <span class="msg-timestamp">${timeString}${statusIndicatorMessage}</span>
            ${adminActionToolbarHTML}
        `;
        feed.appendChild(container);
    });

    if (window.lucide) lucide.createIcons();

    feed.querySelectorAll(".btn-edit-msg").forEach(btn => {
        btn.onclick = async () => {
            const msgId = btn.getAttribute("data-id");
            const textElement = document.getElementById(`msg-body-text-${msgId}`);
            const currentText = textElement ? textElement.innerText : "";

            const { value: updatedText } = await Swal.fire({
                title: "Edit Message",
                input: "textarea",
                inputValue: currentText,
                showCancelButton: true,
                confirmButtonText: "Update",
                confirmButtonColor: "#3b82f6"
            });

            if (updatedText && updatedText.trim() !== currentText) {
                await executeUpdateSingleChatMessage(msgId, updatedText.trim());
            }
        };
    });

    feed.querySelectorAll(".btn-delete-msg").forEach(btn => {
        btn.onclick = async () => {
            const msgId = btn.getAttribute("data-id");
            const confirmDelete = await Swal.fire({
                title: "Delete message?",
                text: "This single message entry will be removed.",
                icon: "warning",
                showCancelButton: true,
                confirmButtonColor: "#ef4444",
                confirmButtonText: "Delete"
            });

            if (confirmDelete.isConfirmed) {
                await executeDeleteSingleChatMessage(msgId);
            }
        };
    });

    if (preserveScrollPosition) {
        feed.scrollTop = feed.scrollHeight - previousScrollHeight;
    } else {
        feed.scrollTop = feed.scrollHeight;
    }
}

async function executeUpdateSingleChatMessage(msgId, newText) {
    const adminToken = localStorage.getItem("admin_session_token");
    try {
        const response = await fetch("https://broker-chi-five.vercel.app/api/admin-chat", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${adminToken}`
            },
            body: JSON.stringify({ message_id: msgId, message_body: newText })
        });

        const resData = await response.json();
        if (resData.success) {
            const localizedCacheKey = `admin_chat_history_${activeChatSessionUserUuid}`;
            let messages = JSON.parse(localStorage.getItem(localizedCacheKey) || "[]");
            const idx = messages.findIndex(m => m.id == msgId);
            if (idx !== -1) {
                messages[idx].message_body = newText;
                localStorage.setItem(localizedCacheKey, JSON.stringify(messages));
                renderChatMessageFeedFromCacheArray(messages, true);
            }
        } else {
            Swal.fire("Error", resData.error || "Update failed.", "error");
        }
    } catch (err) {
        Swal.fire("Error", "Failed to update chat message.", "error");
    }
}

async function executeDeleteSingleChatMessage(msgId) {
    const adminToken = localStorage.getItem("admin_session_token");
    try {
        const response = await fetch(`https://broker-chi-five.vercel.app/api/admin-chat?message_id=${msgId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${adminToken}` }
        });

        const resData = await response.json();
        if (resData.success) {
            const localizedCacheKey = `admin_chat_history_${activeChatSessionUserUuid}`;
            let messages = JSON.parse(localStorage.getItem(localizedCacheKey) || "[]");
            messages = messages.filter(m => m.id != msgId);
            localStorage.setItem(localizedCacheKey, JSON.stringify(messages));
            renderChatMessageFeedFromCacheArray(messages, true);
        } else {
            Swal.fire("Error", resData.error || "Deletion failed.", "error");
        }
    } catch (err) {
        Swal.fire("Error", "Failed to delete chat message.", "error");
    }
}

async function fetchSecureConversationStreams(isInitialLoad = false) {
    const adminToken = localStorage.getItem("admin_session_token");
    if (!activeChatSessionUserUuid) return;

    try {
        const r = await fetch(`https://broker-chi-five.vercel.app/api/admin-chat?uuid=${activeChatSessionUserUuid}&page=1&limit=${chatMaxLimitPerPage}`, {
            method: "GET",
            headers: { "Authorization": `Bearer ${adminToken}` }
        });
        const payload = await r.json();
        const incomingServerChats = payload.chats || [];

        absoluteHasOlderDatabaseMessages = payload.hasMore;

        const localizedCacheKey = `admin_chat_history_${activeChatSessionUserUuid}`;
        localStorage.setItem(localizedCacheKey, JSON.stringify(incomingServerChats));

        renderChatMessageFeedFromCacheArray(incomingServerChats, !isInitialLoad);

    } catch (err) {
        console.error("Chat baseline feed sync drop error:", err);
    }
}

async function fetchOlderHistoricalChatLogs() {
    if (isChatInfiniteScrollLoading || !absoluteHasOlderDatabaseMessages) return;

    isChatInfiniteScrollLoading = true;
    const adminToken = localStorage.getItem("admin_session_token");
    const nextPage = currentChatPaginationPage + 1;

    try {
        const response = await fetch(`https://broker-chi-five.vercel.app/api/admin-chat?uuid=${activeChatSessionUserUuid}&page=${nextPage}&limit=${chatMaxLimitPerPage}`, {
            method: "GET",
            headers: { "Authorization": `Bearer ${adminToken}` }
        });

        const payload = await response.json();
        const olderHistoricalChats = payload.chats || [];

        if (olderHistoricalChats.length > 0) {
            currentChatPaginationPage = nextPage;
            absoluteHasOlderDatabaseMessages = payload.hasMore;

            const localizedCacheKey = `admin_chat_history_${activeChatSessionUserUuid}`;
            let activeUIArrayInstance = [];
            const localCacheString = localStorage.getItem(localizedCacheKey);
            if (localCacheString) {
                try { activeUIArrayInstance = JSON.parse(localCacheString); } catch (e) { }
            }

            const concatenatedTimelineMerge = olderHistoricalChats.concat(activeUIArrayInstance);
            renderChatMessageFeedFromCacheArray(concatenatedTimelineMerge, true);
        } else {
            absoluteHasOlderDatabaseMessages = false;
        }

    } catch (err) {
        console.error("Error running backward history paginator sync routines:", err);
    } finally {
        isChatInfiniteScrollLoading = false;
    }
}

function injectOptimisticChatBubbleNode(textString, objectAssetUrl, targetTempId) {
    const localizedCacheKey = `admin_chat_history_${activeChatSessionUserUuid}`;
    let historicalCachedArray = [];

    const localCacheString = localStorage.getItem(localizedCacheKey);
    if (localCacheString) {
        try { historicalCachedArray = JSON.parse(localCacheString); } catch (e) { }
    }

    const optimisticFakeRow = {
        id: targetTempId,
        sender_role: "admin_2",
        message_body: textString,
        attachment_url: objectAssetUrl,
        created_at: new Date().toISOString(),
        isSending: true
    };

    historicalCachedArray.push(optimisticFakeRow);

    if (historicalCachedArray.length > chatMaxLimitPerPage) {
        historicalCachedArray = historicalCachedArray.slice(-chatMaxLimitPerPage);
    }

    localStorage.setItem(localizedCacheKey, JSON.stringify(historicalCachedArray));
    renderChatMessageFeedFromCacheArray(historicalCachedArray, false);
}

function markOptimisticBubbleExecutionStateAsDropped(targetTempId) {
    const localizedCacheKey = `admin_chat_history_${activeChatSessionUserUuid}`;
    const localCacheString = localStorage.getItem(localizedCacheKey);
    if (!localCacheString) return;

    try {
        let messagesList = JSON.parse(localCacheString);
        const matchIndex = messagesList.findIndex(m => m.id === targetTempId);
        if (matchIndex !== -1) {
            messagesList[matchIndex].isSending = false;
            messagesList[matchIndex].isFailed = true;
            localStorage.setItem(localizedCacheKey, JSON.stringify(messagesList));
            renderChatMessageFeedFromCacheArray(messagesList, true);
        }
    } catch (e) { }
}

async function dispatchMessagePayload(text, fileUrl, replacementTargetTempId = null) {
    const adminToken = localStorage.getItem("admin_session_token");
    const temporaryMessageId = replacementTargetTempId || `temp_msg_${Date.now()}`;

    if (!replacementTargetTempId) {
        injectOptimisticChatBubbleNode(text, fileUrl, temporaryMessageId);
    }

    try {
        const response = await fetch("https://broker-chi-five.vercel.app/api/admin-chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${adminToken}`
            },
            body: JSON.stringify({
                user_uuid: activeChatSessionUserUuid,
                user_email: activeChatSessionUserEmail,
                recipient_email: activeChatSessionUserEmail,
                email: activeChatSessionUserEmail,
                message_body: text,
                attachment_url: fileUrl
            })
        });

        if (!response.ok) throw new Error("Server storage drop exception.");

        const resultData = await response.json();

        if (resultData.success && resultData.message) {
            const localizedCacheKey = `admin_chat_history_${activeChatSessionUserUuid}`;
            const localCacheString = localStorage.getItem(localizedCacheKey);

            if (localCacheString) {
                try {
                    let messagesList = JSON.parse(localCacheString);
                    const matchIndex = messagesList.findIndex(m => m.id === temporaryMessageId);

                    if (matchIndex !== -1) {
                        messagesList[matchIndex] = resultData.message;
                        messagesList[matchIndex].isSending = false;
                        messagesList[matchIndex].isFailed = false;

                        localStorage.setItem(localizedCacheKey, JSON.stringify(messagesList));
                        renderChatMessageFeedFromCacheArray(messagesList, false);
                        return;
                    }
                } catch (e) {
                    console.error("Cache processing stabilization failure:", e);
                }
            }
        }

        currentChatPaginationPage = 1;
        await fetchSecureConversationStreams(true);

    } catch (err) {
        console.error("Transmission fault instance recorded:", err);
        markOptimisticBubbleExecutionStateAsDropped(temporaryMessageId);
    }
}

async function clearFileAssetStorageUpload(file) {
    const adminToken = localStorage.getItem("admin_session_token");
    const formData = new FormData();
    formData.append("avatar", file);

    try {
        const response = await fetch("https://broker-chi-five.vercel.app/api/avatar", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${adminToken}`,
                "X-Action": "chat",
                "X-User-UUID": activeChatSessionUserUuid
            },
            body: formData
        });
        const data = await response.json();
        return data.success ? data.imageUrl : null;
    } catch (err) {
        console.error("File Asset critical transport drop:", err);
        return null;
    }
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g,
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}