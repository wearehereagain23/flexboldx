let activeChatSessionUserUuid = null;
let currentChatPaginationPage = 1;
const chatMaxLimitPerPage = 20;
let isChatInfiniteScrollLoading = false;
let absoluteHasOlderDatabaseMessages = true;

// Retrieve user JWT token from localStorage keys saved by login.js
function getUserToken() {
    let token = localStorage.getItem("user_token");

    if (!token) {
        try {
            const session = JSON.parse(localStorage.getItem("user_session") || "{}");
            token = session.token || null;
        } catch (e) { }
    }

    if (!token || token === "null" || token === "undefined") {
        console.warn("⚠️ No valid user authentication token found in localStorage.");
        return null;
    }

    return token;
}

// Retrieve user UUID from localStorage saved by login.js
function getUserUuidFromStorage() {
    try {
        const session = JSON.parse(localStorage.getItem("user_session") || "{}");
        if (session.uuid) return session.uuid;

        const userData = JSON.parse(localStorage.getItem("user_data") || "{}");
        if (userData.uuid) return userData.uuid;
    } catch (e) { }
    return null;
}

export function setupSecureChatChannel(userUuid) {
    // Use passed UUID or fallback to user_session / user_data in localStorage
    activeChatSessionUserUuid = userUuid || getUserUuidFromStorage();
    currentChatPaginationPage = 1;
    absoluteHasOlderDatabaseMessages = true;
    isChatInfiniteScrollLoading = false;

    const textInput = document.getElementById("chat-terminal-text-field");
    const sendBtn = document.getElementById("chat-send-message-btn");
    const attachBtn = document.getElementById("chat-attachment-trigger-btn");
    const hiddenFile = document.getElementById("chat-image-attachment-input");
    const feedElementContainer = document.getElementById("chat-message-feed");

    if (!activeChatSessionUserUuid) {
        console.error("🔒 Cannot initialize chat: User UUID is missing from session.");
        return;
    }

    // Baseline Cache Hydration
    const localizedCacheKey = `user_chat_history_${activeChatSessionUserUuid}`;
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
                    <span>Initializing secure support channel...</span>
                </div>`;
            if (window.lucide) lucide.createIcons();
        }
    }

    fetchSecureConversationStreams(true);

    if (feedElementContainer) {
        feedElementContainer.onscroll = async (e) => {
            // Isolate scroll events to prevent document body scrolling
            if (e) e.stopPropagation();

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

            const attachmentPlaceholderText = "Shared a file document update.";
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
            <span>Messages are end-to-end encrypted with support staff.</span>
        </div>`;

    messagesArray.forEach(msg => {
        const container = document.createElement("div");

        // User Side View Perspective:
        // Messages sent by user ('user') -> outgoing (Right side)
        // Messages sent by support ('admin') -> incoming (Left side)
        const isUserMsg = msg.sender_role === "user";
        const alignmentClass = isUserMsg ? "outgoing" : "incoming";

        container.className = `msg-bubble ${alignmentClass}`;
        if (msg.isSending) container.classList.add("msg-bubble-is-sending");
        if (msg.isFailed) container.classList.add("msg-bubble-execution-failed");
        if (msg.id) container.setAttribute("data-msg-node-id", msg.id);

        let attachmentContentHTML = "";
        if (msg.attachment_url) {
            attachmentContentHTML = `<img src="${msg.attachment_url}" style="max-width:100%; border-radius:6px; margin-bottom:4px; display:block;" alt="Attachment">`;
        }

        let statusIndicatorMessage = "";
        if (msg.isSending) statusIndicatorMessage = ` <small class="text-sending-indicator">⏱️ Sending...</small>`;
        if (msg.isFailed) statusIndicatorMessage = ` <small class="text-failed-indicator">🔴 Failed to Send</small>`;

        const timeString = msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : "--:--";

        // Render message content without admin edit/delete controls
        container.innerHTML = `
            ${attachmentContentHTML}
            <p id="msg-body-text-${msg.id}">${escapeHTML(msg.message_body || '')}</p>
            <span class="msg-timestamp">${timeString}${statusIndicatorMessage}</span>
        `;
        feed.appendChild(container);
    });

    if (window.lucide) lucide.createIcons();

    if (preserveScrollPosition) {
        feed.scrollTop = feed.scrollHeight - previousScrollHeight;
    } else {
        feed.scrollTop = feed.scrollHeight;
    }
}

async function fetchSecureConversationStreams(isInitialLoad = false) {
    const userToken = getUserToken();
    if (!activeChatSessionUserUuid) return;
    if (!userToken) {
        console.error("🔒 Cannot fetch chat stream: Missing User Bearer Token.");
        return;
    }

    try {
        const r = await fetch(`https://broker-chi-five.vercel.app/api/admin-chat?uuid=${activeChatSessionUserUuid}&page=1&limit=${chatMaxLimitPerPage}`, {
            method: "GET",
            headers: { "Authorization": `Bearer ${userToken}` }
        });

        if (r.status === 401) {
            console.error("🔴 Server responded with 401 Unauthorized. Session expired or invalid token.");
            return;
        }

        const payload = await r.json();
        const incomingServerChats = payload.chats || [];

        absoluteHasOlderDatabaseMessages = payload.hasMore;

        const localizedCacheKey = `user_chat_history_${activeChatSessionUserUuid}`;
        localStorage.setItem(localizedCacheKey, JSON.stringify(incomingServerChats));

        renderChatMessageFeedFromCacheArray(incomingServerChats, !isInitialLoad);

    } catch (err) {
        console.error("Chat feed sync error:", err);
    }
}

async function fetchOlderHistoricalChatLogs() {
    if (isChatInfiniteScrollLoading || !absoluteHasOlderDatabaseMessages) return;

    isChatInfiniteScrollLoading = true;
    const userToken = getUserToken();
    if (!userToken) {
        isChatInfiniteScrollLoading = false;
        return;
    }

    const nextPage = currentChatPaginationPage + 1;

    try {
        const response = await fetch(`https://broker-chi-five.vercel.app/api/admin-chat?uuid=${activeChatSessionUserUuid}&page=${nextPage}&limit=${chatMaxLimitPerPage}`, {
            method: "GET",
            headers: { "Authorization": `Bearer ${userToken}` }
        });

        if (response.status === 401) return;

        const payload = await response.json();
        const olderHistoricalChats = payload.chats || [];

        if (olderHistoricalChats.length > 0) {
            currentChatPaginationPage = nextPage;
            absoluteHasOlderDatabaseMessages = payload.hasMore;

            const localizedCacheKey = `user_chat_history_${activeChatSessionUserUuid}`;
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
        console.error("Error running historical chat log fetch:", err);
    } finally {
        isChatInfiniteScrollLoading = false;
    }
}

function injectOptimisticChatBubbleNode(textString, objectAssetUrl, targetTempId) {
    const localizedCacheKey = `user_chat_history_${activeChatSessionUserUuid}`;
    let historicalCachedArray = [];

    const localCacheString = localStorage.getItem(localizedCacheKey);
    if (localCacheString) {
        try { historicalCachedArray = JSON.parse(localCacheString); } catch (e) { }
    }

    const optimisticFakeRow = {
        id: targetTempId,
        sender_role: "user",
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
    const localizedCacheKey = `user_chat_history_${activeChatSessionUserUuid}`;
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
    const userToken = getUserToken();
    const temporaryMessageId = replacementTargetTempId || `temp_msg_${Date.now()}`;

    if (!userToken) {
        markOptimisticBubbleExecutionStateAsDropped(temporaryMessageId);
        return;
    }

    if (!replacementTargetTempId) {
        injectOptimisticChatBubbleNode(text, fileUrl, temporaryMessageId);
    }

    try {
        const response = await fetch("https://broker-chi-five.vercel.app/api/admin-chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${userToken}`
            },
            body: JSON.stringify({
                user_uuid: activeChatSessionUserUuid,
                message_body: text,
                attachment_url: fileUrl,
                sender_role: "user"
            })
        });

        if (!response.ok) throw new Error("Server storage drop exception.");

        const resultData = await response.json();

        if (resultData.success && resultData.message) {
            const localizedCacheKey = `user_chat_history_${activeChatSessionUserUuid}`;
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
                    console.error("Cache processing failure:", e);
                }
            }
        }

        currentChatPaginationPage = 1;
        await fetchSecureConversationStreams(true);

    } catch (err) {
        console.error("Transmission fault recorded:", err);
        markOptimisticBubbleExecutionStateAsDropped(temporaryMessageId);
    }
}

async function clearFileAssetStorageUpload(file) {
    const userToken = getUserToken();
    if (!userToken) return null;

    const formData = new FormData();
    formData.append("avatar", file);

    try {
        const response = await fetch("https://broker-chi-five.vercel.app/api/avatar", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${userToken}`,
                "X-Action": "chat",
                "X-User-UUID": activeChatSessionUserUuid
            },
            body: formData
        });
        const data = await response.json();
        return data.success ? data.imageUrl : null;
    } catch (err) {
        console.error("File asset transport error:", err);
        return null;
    }
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g,
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}