export function initProfileImageActionsPipeline(account) {
    const triggerArea = document.getElementById("profile-avatar-action-trigger");
    const displayBubble = document.getElementById("profile-avatar-target-display");
    if (!triggerArea || !displayBubble) return;

    const initial = (account.firstname || "U").charAt(0).toUpperCase();

    const updateDisplay = (url) => {
        if (url && url.trim() !== "") {
            displayBubble.innerHTML = `<img src="${url.trim()}" alt="Profile">`;
            displayBubble.style.background = "transparent";
        } else {
            displayBubble.innerText = initial;
            displayBubble.style.background = "var(--bg-workspace-dark)";
        }
    };

    // Fallback support for both profileImage and image key names
    const activeImageSrc = account.profileImage;
    updateDisplay(activeImageSrc);

    triggerArea.onclick = () => {
        const currentSrc = account.profileImage;
        const hasImage = !!(currentSrc && currentSrc.trim() !== "");

        Swal.fire({
            title: 'Profile Avatar Control',
            text: 'Choose an administrative operation context action to update storage nodes:',
            icon: 'info',
            showCancelButton: true,
            confirmButtonText: hasImage ? 'View Photo' : 'Upload New Photo',
            denyButtonText: 'Upload New Photo',
            cancelButtonText: 'Close Panel',
            showDenyButton: hasImage,
            footer: hasImage ? `<button id="swal-destructive-image-purge-btn" class="swal2-styled swal2-deny" style="background-color: var(--status-blocked-red); padding: 6px 12px; font-size: 12px; border-radius: 4px;">Delete Profile Image Asset</button>` : '',
            didOpen: () => {
                const destructivePurgeBtn = document.getElementById("swal-destructive-image-purge-btn");
                if (destructivePurgeBtn) {
                    destructivePurgeBtn.onclick = () => {
                        Swal.close();
                        executeAvatarNetworkAction(account, null, "delete");
                    };
                }
            }
        }).then((result) => {
            if (result.isConfirmed && !hasImage) {
                triggerNativeFileUploaderSequence(account);
            } else if (result.isConfirmed && hasImage) {
                Swal.fire({
                    imageUrl: currentSrc,
                    imageAlt: 'Profile Visual Area',
                    background: '#0f172a',
                    confirmButtonText: 'Close',
                    confirmButtonColor: '#475569'
                });
            } else if (result.isDenied) {
                triggerNativeFileUploaderSequence(account);
            }
        });
    };
}

function triggerNativeFileUploaderSequence(account) {
    const standaloneInput = document.createElement("input");
    standaloneInput.type = "file";
    standaloneInput.accept = "image/*";
    standaloneInput.onchange = (e) => {
        if (e.target.files.length > 0) {
            executeAvatarNetworkAction(account, e.target.files[0], "upload");
        }
    };
    standaloneInput.click();
}


async function executeAvatarNetworkAction(account, fileObject, streamActionType) {
    const adminToken = localStorage.getItem("admin_session_token");
    const targetUrl = "https://broker-chi-five.vercel.app/api/avatar";

    const headers = {
        "Authorization": `Bearer ${adminToken}`,
        "X-User-UUID": account.uuid
    };
    let bodyPayload;

    let backupUrl = account.profileImage;
    let temporaryLocalUrl = null;

    if (streamActionType === "delete") {
        headers["X-Action"] = "delete";
        account.profileImage = null;
    } else {
        // FIX 1: Change "profile" to "avatar" so backend recognizes profile image mode
        headers["X-Action"] = "avatar";
        bodyPayload = new FormData();
        bodyPayload.append("avatar", fileObject);

        temporaryLocalUrl = URL.createObjectURL(fileObject);
        account.profileImage = temporaryLocalUrl;
    }

    updateLocalCacheRecordWithMutations(account);

    try {
        const response = await fetch(targetUrl, {
            method: "POST",
            headers: headers,
            body: bodyPayload
        });

        const data = await response.json();

        if (data.success) {
            const finalImage = data.imageUrl || null;
            account.profileImage = finalImage;

            // FIX 2: Pass full user object or ensure active defaults to true
            const dbSyncResponse = await fetch("https://broker-chi-five.vercel.app/api/admin-update-user", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${adminToken}`
                },
                body: JSON.stringify({
                    ...account,
                    id: account.id,
                    profileImage: finalImage,
                    active: account.active !== undefined ? account.active : true
                })
            });

            const dbSyncData = await dbSyncResponse.json();
            if (!dbSyncResponse.ok || !dbSyncData.success) {
                throw new Error(dbSyncData.error || "Failed to link storage location url onto account table row.");
            }

            updateLocalCacheRecordWithMutations(account);

            Swal.fire({
                icon: 'success',
                title: 'Synchronized',
                text: 'Profile image modified and saved permanently to server database table.',
                timer: 1500,
                showConfirmButton: false,
                background: '#0f172a',
                color: '#ffffff'
            });
        } else {
            throw new Error(data.error || "Execution dropped.");
        }
    } catch (err) {
        account.profileImage = backupUrl;
        updateLocalCacheRecordWithMutations(account);

        Swal.fire({
            icon: 'error',
            title: 'Process Refused',
            text: err.message,
            background: '#0f172a',
            color: '#ffffff'
        });
    } finally {
        if (temporaryLocalUrl) {
            URL.revokeObjectURL(temporaryLocalUrl);
        }
    }
}



function updateLocalCacheRecordWithMutations(modifiedAccount) {
    const localSavedCache = localStorage.getItem("admin_users_directory_cache");
    if (!localSavedCache) return;

    try {
        let registryList = JSON.parse(localSavedCache);
        const indexMatch = registryList.findIndex(u => u.id === modifiedAccount.id);

        if (indexMatch !== -1) {
            registryList[indexMatch] = modifiedAccount;
            localStorage.setItem("admin_users_directory_cache", JSON.stringify(registryList));
            window.dispatchEvent(new Event("adminDirectoryCacheUpdated"));
        }
    } catch (err) {
        console.error("Local tracking mirror injection exception:", err);
    }
}