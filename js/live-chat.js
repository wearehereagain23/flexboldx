document.addEventListener('DOMContentLoaded', () => {
    const INACTIVITY_LIMIT_MS = 20 * 60 * 1000; // 20 minutes
    let inactivityTimer = null;

    // API Configuration
    const API_BASE = "https://broker-chi-five.vercel.app/api";
    const CHAT_LIMIT = 20;

    // Chat State Tracking
    let activeUserUuid = null;
    let currentChatPage = 1;
    let hasMoreHistory = true;
    let isFetchingHistory = false;

    // DOM Element References
    const elements = {
        triggerBubble: document.getElementById('live-chat-trigger-bubble'),
        toaster: document.getElementById('chat-toaster'),
        closeToasterBtn: document.getElementById('close-chat-toaster'),
        drawer: document.getElementById('chatDrawer'),
        overlay: document.getElementById('chatDrawerOverlay'),
        closeDrawerBtn: document.getElementById('closeChatDrawerBtn'),
        logoutBtn: document.getElementById('chatLogoutBtn'),
        feed: document.getElementById('chat-message-feed'),
        textField: document.getElementById('chat-terminal-text-field'),
        sendBtn: document.getElementById('chat-send-message-btn'),
        attachmentTriggerBtn: document.getElementById('chat-attachment-trigger-btn'),
        attachmentInput: document.getElementById('chat-image-attachment-input')
    };

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }

    // --- Authentication & Identity Resolution Helpers ---

    function getUserToken() {
        let token = localStorage.getItem("user_token");
        if (!token) {
            try {
                const session = JSON.parse(localStorage.getItem("user_session") || "{}");
                token = session.token || null;
            } catch (e) { }
        }
        if (!token) {
            try {
                const userData = JSON.parse(localStorage.getItem("user_data") || "{}");
                token = userData.token || null;
            } catch (e) { }
        }
        if (!token || token === "null" || token === "undefined") return null;
        return token;
    }

    function getLocalCachedUuid() {
        try {
            const session = JSON.parse(localStorage.getItem("user_session") || "{}");
            if (session.uuid) return session.uuid;

            const userData = JSON.parse(localStorage.getItem("user_data") || "{}");
            if (userData.uuid) return userData.uuid;
        } catch (e) { }
        return null;
    }

    async function fetchVerifiedUserUuid() {
        const token = getUserToken();
        if (!token) return null;

        const cachedUuid = getLocalCachedUuid();
        if (cachedUuid) {
            activeUserUuid = cachedUuid;
            return activeUserUuid;
        }

        try {
            const res = await fetch(`${API_BASE}/user-data`, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "X-Signature": "flexboldx"
                }
            });

            if (!res.ok) return null;

            const payload = await res.json();
            const userObj = payload.user || payload.data || payload;
            const verifiedUuid = userObj.uuid || userObj.id;

            if (verifiedUuid) {
                activeUserUuid = verifiedUuid;
                const session = JSON.parse(localStorage.getItem("user_session") || "{}");
                session.uuid = activeUserUuid;
                session.token = token;
                localStorage.setItem("user_session", JSON.stringify(session));

                return activeUserUuid;
            }
        } catch (err) {
            console.error("❌ [IDENTITY SYNC EXCEPTION]:", err);
        }

        return null;
    }

    // --- Inactivity Watcher Logic ---

    function resetInactivityTimer() {
        if (inactivityTimer) clearTimeout(inactivityTimer);
        if (getUserToken()) {
            localStorage.setItem('last_activity_time', Date.now().toString());
            inactivityTimer = setTimeout(clearUserSession, INACTIVITY_LIMIT_MS);
        }
    }

    function checkStoredInactivity() {
        const lastActivity = localStorage.getItem('last_activity_time');
        const token = getUserToken();
        if (lastActivity && token) {
            const elapsed = Date.now() - parseInt(lastActivity, 10);
            if (elapsed >= INACTIVITY_LIMIT_MS) {
                clearUserSession();
                return true;
            }
        }
        return false;
    }

    function clearUserSession() {
        if (inactivityTimer) clearTimeout(inactivityTimer);
        localStorage.removeItem('simulated_guest_user');
        localStorage.removeItem('user_session');
        localStorage.removeItem('user_data');
        localStorage.removeItem('user_token');
        localStorage.removeItem('user_uuid');
        localStorage.removeItem('login_type');
        localStorage.removeItem('last_activity_time');
        activeUserUuid = null;

        if (elements.logoutBtn) elements.logoutBtn.style.display = 'none';
        renderInitialView();
    }

    // --- Backend Authentication ---

    async function loginUser(email, password, submitBtn) {
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span>Logging in...</span>`;

        try {
            const res = await fetch(`${API_BASE}/login-user`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Signature': 'flexboldx'
                },
                body: JSON.stringify({
                    identifier: email,
                    password: password,
                    signature: 'flexboldx'
                })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || errData.message || 'Invalid email or password');
            }

            const data = await res.json();
            const userObj = data.user || data;
            const uuid = userObj.uuid || userObj.id;
            const token = data.token || userObj.token;

            if (!token) {
                throw new Error('Authentication token missing from response.');
            }

            const sessionPayload = {
                uuid: uuid,
                token: token,
                name: userObj.name || userObj.firstname || email.split('@')[0],
                email: email
            };

            // Set session data & explicitly set login_type as "from_chat"
            localStorage.setItem('user_session', JSON.stringify(sessionPayload));
            localStorage.setItem('user_data', JSON.stringify(sessionPayload));
            localStorage.setItem('user_token', token);
            localStorage.setItem('login_type', 'from_chat');

            activeUserUuid = uuid;
            resetInactivityTimer();

            enableChatInputs();
            initiateChatSession();
        } catch (err) {
            console.error('❌ [LOGIN EXCEPTION]:', err);
            alert(err.message || 'Unable to sign in. Please try again.');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    }

    // --- Core Chat Stream ---

    async function initiateChatSession() {
        const token = getUserToken();
        if (!token) {
            renderInitialView();
            return;
        }

        activeUserUuid = await fetchVerifiedUserUuid();
        if (!activeUserUuid) {
            renderInitialView();
            return;
        }

        if (elements.logoutBtn) elements.logoutBtn.style.display = 'inline-flex';

        currentChatPage = 1;
        hasMoreHistory = true;
        isFetchingHistory = false;

        fetchConversationFromDB(true);

        if (elements.feed) {
            elements.feed.onscroll = async (e) => {
                if (e) e.stopPropagation();
                if (elements.feed.scrollTop === 0 && !isFetchingHistory && hasMoreHistory) {
                    await fetchOlderHistoricalLogs();
                }
            };
        }
    }

    async function fetchConversationFromDB(isInitialLoad = false) {
        const token = getUserToken();
        if (!activeUserUuid) activeUserUuid = await fetchVerifiedUserUuid();

        if (!activeUserUuid || !token) return;

        try {
            const res = await fetch(`${API_BASE}/admin-chat?uuid=${activeUserUuid}&page=1&limit=${CHAT_LIMIT}`, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "X-Signature": "flexboldx"
                }
            });

            if (res.status === 401) {
                clearUserSession();
                return;
            }

            const payload = await res.json();
            const incomingChats = payload.chats || payload.messages || (Array.isArray(payload) ? payload : []);
            hasMoreHistory = payload.hasMore !== undefined ? payload.hasMore : false;

            renderChatMessageFeed(incomingChats, !isInitialLoad);
        } catch (err) {
            console.error("❌ [DB FETCH EXCEPTION]:", err);
        }
    }

    async function fetchOlderHistoricalLogs() {
        if (isFetchingHistory || !hasMoreHistory) return;

        isFetchingHistory = true;
        const token = getUserToken();
        if (!activeUserUuid) activeUserUuid = await fetchVerifiedUserUuid();

        if (!token || !activeUserUuid) {
            isFetchingHistory = false;
            return;
        }

        const nextPage = currentChatPage + 1;

        try {
            const res = await fetch(`${API_BASE}/admin-chat?uuid=${activeUserUuid}&page=${nextPage}&limit=${CHAT_LIMIT}`, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "X-Signature": "flexboldx"
                }
            });

            if (res.status === 401) return;

            const payload = await res.json();
            const olderChats = payload.chats || payload.messages || [];

            if (olderChats.length > 0) {
                currentChatPage = nextPage;
                hasMoreHistory = payload.hasMore !== undefined ? payload.hasMore : false;
                prependHistoricalChats(olderChats);
            } else {
                hasMoreHistory = false;
            }
        } catch (err) {
            console.error("❌ [HISTORICAL FETCH EXCEPTION]:", err);
        } finally {
            isFetchingHistory = false;
        }
    }

    async function dispatchMessagePayload(text, fileUrl, tempMsgId = null) {
        const token = getUserToken();
        if (!activeUserUuid) activeUserUuid = await fetchVerifiedUserUuid();
        const temporaryMessageId = tempMsgId || `temp_msg_${Date.now()}`;

        if (!token || !activeUserUuid) {
            markOptimisticBubbleFailed(temporaryMessageId);
            return;
        }

        if (!tempMsgId) {
            injectOptimisticChatBubble(text, fileUrl, temporaryMessageId);
        }

        try {
            const res = await fetch(`${API_BASE}/admin-chat`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                    "X-Signature": "flexboldx"
                },
                body: JSON.stringify({
                    user_uuid: activeUserUuid,
                    message_body: text,
                    attachment_url: fileUrl,
                    sender_role: "user"
                })
            });

            if (!res.ok) throw new Error("Failed to save message to database.");

            currentChatPage = 1;
            await fetchConversationFromDB(true);
        } catch (err) {
            console.error("❌ [SEND EXCEPTION]:", err);
            markOptimisticBubbleFailed(temporaryMessageId);
        }
    }

    async function uploadAttachment(file) {
        const token = getUserToken();
        if (!activeUserUuid) activeUserUuid = await fetchVerifiedUserUuid();
        if (!token || !activeUserUuid) return null;

        const formData = new FormData();
        formData.append("avatar", file);

        try {
            const res = await fetch(`${API_BASE}/avatar`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "X-Action": "chat",
                    "X-User-UUID": activeUserUuid,
                    "X-Signature": "flexboldx"
                },
                body: formData
            });
            const data = await res.json();
            return data.success ? data.imageUrl : null;
        } catch (err) {
            console.error("❌ [ATTACHMENT UPLOAD EXCEPTION]:", err);
            return null;
        }
    }

    // --- UI Rendering ---

    function createBubbleElement(msg) {
        const container = document.createElement("div");
        const isUserMsg = msg.sender_role === "user";

        // Attach base container class + sent/received modifier
        container.className = `lc-message-item ${isUserMsg ? 'sent' : 'received'}`;
        container.dataset.msgId = msg.id || '';

        const msgBubble = document.createElement("div");
        msgBubble.className = "lc-message-bubble";
        if (msg.isFailed) msgBubble.style.border = "1px solid red";
        if (msg.isSending) msgBubble.style.opacity = "0.7";

        let attachmentHTML = '';
        if (msg.attachment_url) {
            attachmentHTML = `<img src="${msg.attachment_url}" style="max-width:100%; border-radius:6px; margin-bottom:6px; display:block;" alt="Attachment">`;
        }

        let statusText = '';
        if (msg.isSending) statusText = ' <small style="font-size:10px; opacity:0.8;">⏱️ Sending...</small>';
        if (msg.isFailed) statusText = ' <small style="font-size:10px; color:red;">🔴 Failed</small>';

        const timeString = msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : "--:--";

        msgBubble.innerHTML = `
        ${attachmentHTML}
        <p style="margin:0; word-break: break-word;">${escapeHTML(msg.message_body || '')}</p>
        <div class="lc-message-time">
            ${timeString}${statusText}
        </div>
    `;

        container.appendChild(msgBubble);
        return container;
    }

    function renderChatMessageFeed(messagesArray, preserveScroll = false) {
        if (!elements.feed) return;
        const previousScrollHeight = elements.feed.scrollHeight;

        elements.feed.innerHTML = `
            <div style="text-align:center; padding:10px; font-size:12px; color:#888;">
                <span>🔒 Messages loaded directly from Database</span>
            </div>`;

        messagesArray.forEach(msg => {
            const bubbleNode = createBubbleElement(msg);
            elements.feed.appendChild(bubbleNode);
        });

        if (preserveScroll) {
            elements.feed.scrollTop = elements.feed.scrollHeight - previousScrollHeight;
        } else {
            elements.feed.scrollTop = elements.feed.scrollHeight;
        }
    }

    function prependHistoricalChats(olderMessagesArray) {
        if (!elements.feed) return;
        const previousScrollHeight = elements.feed.scrollHeight;

        const fragment = document.createDocumentFragment();
        olderMessagesArray.forEach(msg => {
            fragment.appendChild(createBubbleElement(msg));
        });

        if (elements.feed.children.length > 0) {
            elements.feed.insertBefore(fragment, elements.feed.children[1] || null);
        } else {
            elements.feed.appendChild(fragment);
        }

        elements.feed.scrollTop = elements.feed.scrollHeight - previousScrollHeight;
    }

    function injectOptimisticChatBubble(text, fileUrl, tempId) {
        const optimisticMsg = {
            id: tempId,
            sender_role: "user",
            message_body: text,
            attachment_url: fileUrl,
            created_at: new Date().toISOString(),
            isSending: true
        };

        const bubbleNode = createBubbleElement(optimisticMsg);
        elements.feed.appendChild(bubbleNode);
        elements.feed.scrollTop = elements.feed.scrollHeight;
    }

    function markOptimisticBubbleFailed(tempId) {
        const targetNode = elements.feed.querySelector(`[data-msg-id="${tempId}"]`);
        if (targetNode) {
            targetNode.style.border = "1px solid red";
            targetNode.style.opacity = "1";
        }
    }

    // --- UI Controls ---

    function toggleChatDrawer(show) {
        if (checkStoredInactivity()) return;

        let isChatOpen = show !== undefined ? show : !elements.drawer.classList.contains('active');

        if (isChatOpen) {
            elements.drawer.classList.add('active');
            elements.overlay.style.display = 'block';
            document.body.classList.add('lc-chat-open'); // Prevent background scroll
            if (elements.toaster) elements.toaster.style.display = 'none';
            renderInitialView();
            resetInactivityTimer();
        } else {
            elements.drawer.classList.remove('active');
            elements.overlay.style.display = 'none';
            document.body.classList.remove('lc-chat-open'); // Restore background scroll
        }
    }

    function renderInitialView() {
        if (!elements.feed) return;
        elements.feed.innerHTML = '';
        const token = getUserToken();

        if (!token) {
            if (elements.logoutBtn) elements.logoutBtn.style.display = 'none';
            elements.textField.disabled = true;
            elements.sendBtn.disabled = true;
            elements.attachmentTriggerBtn.disabled = true;

            const formContainer = document.createElement('div');
            formContainer.style.cssText = 'padding: 15px; background: #fff; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);';
            formContainer.innerHTML = `
                <h4 style="margin-bottom: 10px; color: #1f263f;">Welcome to Live Support</h4>
                <p style="font-size: 13px; color: #666; margin-bottom: 15px;">Please sign in to start chatting.</p>
                <input type="email" id="user-email" placeholder="Your Email" style="width: 100%; padding: 8px; margin-bottom: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
                <input type="password" id="user-password" placeholder="Your Password" style="width: 100%; padding: 8px; margin-bottom: 15px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
                <button id="user-login-btn" style="width: 100%; padding: 10px; background: #1f263f; color: #fff; border: none; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <span>Sign In</span>
                </button>
            `;

            elements.feed.appendChild(formContainer);

            const loginBtn = document.getElementById('user-login-btn');
            loginBtn.addEventListener('click', () => {
                const email = document.getElementById('user-email').value.trim();
                const password = document.getElementById('user-password').value.trim();

                if (!email || !password) {
                    alert('Please enter both email and password.');
                    return;
                }

                loginUser(email, password, loginBtn);
            });

        } else {
            if (elements.logoutBtn) elements.logoutBtn.style.display = 'inline-flex';
            enableChatInputs();
            resetInactivityTimer();
            initiateChatSession();
        }
    }

    function enableChatInputs() {
        elements.textField.disabled = false;
        elements.sendBtn.disabled = false;
        elements.attachmentTriggerBtn.disabled = false;
        elements.textField.focus();
    }

    async function handleSend() {
        if (checkStoredInactivity()) return;

        const text = elements.textField.value.trim();
        if (!text) return;

        if (!activeUserUuid) activeUserUuid = await fetchVerifiedUserUuid();
        if (!activeUserUuid) return;

        elements.textField.value = '';
        resetInactivityTimer();

        const temporaryMessageId = `temp_msg_${Date.now()}`;
        injectOptimisticChatBubble(text, null, temporaryMessageId);
        await dispatchMessagePayload(text, null, temporaryMessageId);
    }

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g,
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&#34;' }[tag] || tag)
        );
    }

    // --- Event Listeners ---

    if (elements.logoutBtn) {
        elements.logoutBtn.addEventListener('click', () => {
            clearUserSession();
        });
    }

    if (elements.closeToasterBtn) {
        elements.closeToasterBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (elements.toaster) elements.toaster.style.display = 'none';
        });
    }

    if (elements.triggerBubble) elements.triggerBubble.addEventListener('click', () => toggleChatDrawer(true));
    if (elements.closeDrawerBtn) elements.closeDrawerBtn.addEventListener('click', () => toggleChatDrawer(false));
    if (elements.overlay) elements.overlay.addEventListener('click', () => toggleChatDrawer(false));

    if (elements.sendBtn) elements.sendBtn.addEventListener('click', handleSend);
    if (elements.textField) {
        elements.textField.addEventListener('keydown', (e) => {
            resetInactivityTimer();
            // Send on Enter without Shift key, allow new line with Shift + Enter
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        });
    }

    if (elements.attachmentTriggerBtn) elements.attachmentTriggerBtn.addEventListener('click', () => elements.attachmentInput.click());
    if (elements.attachmentInput) {
        elements.attachmentInput.addEventListener('change', async (e) => {
            if (checkStoredInactivity()) return;

            if (e.target.files.length > 0) {
                const targetFile = e.target.files[0];
                const localObjectURL = URL.createObjectURL(targetFile);
                const temporaryMessageId = `temp_msg_${Date.now()}`;

                const attachmentPlaceholderText = "Shared a file document update.";
                injectOptimisticChatBubble(attachmentPlaceholderText, localObjectURL, temporaryMessageId);
                resetInactivityTimer();

                const uploadedUrl = await uploadAttachment(targetFile);

                if (uploadedUrl) {
                    URL.revokeObjectURL(localObjectURL);
                    await dispatchMessagePayload(attachmentPlaceholderText, uploadedUrl, temporaryMessageId);
                } else {
                    markOptimisticBubbleFailed(temporaryMessageId);
                }
            }
            e.target.value = '';
        });
    }

    checkStoredInactivity();
});