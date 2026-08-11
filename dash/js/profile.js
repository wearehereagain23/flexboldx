/**
 * Profile Page Logic
 */
document.addEventListener("DOMContentLoaded", async () => {
    const PROFILE_API_URL = window.PROFILE_API_URL || "https://broker-chi-five.vercel.app/api/profile";
    const token = localStorage.getItem("user_token");

    if (!token) {
        window.location.href = "../login/index.html";
        return;
    }

    // --- DOM Elements ---
    const avatarContainer = document.getElementById("avatarUploadContainer");
    const avatarImg = document.getElementById("profileDisplayImage");
    const headerAvatar = document.getElementById("pmler");
    const sidebarAvatar = document.getElementById("pmler2");
    const imageInput = document.getElementById("profileImageInput");

    const headerName = document.getElementById("profileDisplayName");
    const headerUsername = document.getElementById("profileDisplayUsername");

    const firstNameInput = document.getElementById("firstNameInput");
    const middleNameInput = document.getElementById("middleNameInput");
    const lastNameInput = document.getElementById("lastNameInput");
    const usernameInput = document.getElementById("usernameInput");
    const emailInput = document.getElementById("emailInput");
    const phoneInput = document.getElementById("phoneInput");
    const countryInput = document.getElementById("countryInput");
    const cityInput = document.getElementById("cityInput");
    const addressInput = document.getElementById("addressInput");

    const dobInput = document.getElementById("dobInput");
    const genderSelect = document.getElementById("genderSelect");
    const employmentSelect = document.getElementById("employmentSelect");

    const profileForm = document.getElementById("profileDetailsForm");

    const badgeContainer = document.getElementById("kycBadgeContainer");
    const badgeIcon = document.getElementById("kycBadgeIcon");
    const badgeText = document.getElementById("kycBadgeText");

    // Trigger file dialog on avatar container click
    avatarContainer?.addEventListener("click", () => {
        imageInput?.click();
    });

    // Helper: Set avatar src across all instance elements
    function setAvatarSrc(url) {
        if (!url) return;
        if (avatarImg) avatarImg.src = url;
        if (headerAvatar) headerAvatar.src = url;
        if (sidebarAvatar) sidebarAvatar.src = url;
    }

    // -------------------------------------------------------------
    // 1. FETCH PROFILE DATA (GET Request)
    // -------------------------------------------------------------
    try {
        const response = await fetch(`${PROFILE_API_URL}?action=get_profile`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem("user_token");
                window.location.href = "../login/index.html";
                return;
            }
            throw new Error(`HTTP Error ${response.status}`);
        }

        const result = await response.json();

        if (result.success && result.profile) {
            const user = result.profile;

            // Name Parser
            const nameParts = (user.full_name || "").trim().split(/\s+/);
            if (nameParts.length === 1) {
                if (firstNameInput) firstNameInput.value = nameParts[0] || "";
            } else if (nameParts.length === 2) {
                if (firstNameInput) firstNameInput.value = nameParts[0] || "";
                if (lastNameInput) lastNameInput.value = nameParts[1] || "";
            } else if (nameParts.length >= 3) {
                if (firstNameInput) firstNameInput.value = nameParts[0] || "";
                if (middleNameInput) middleNameInput.value = nameParts.slice(1, -1).join(" ");
                if (lastNameInput) lastNameInput.value = nameParts[nameParts.length - 1] || "";
            }

            // Form Fields
            if (usernameInput) usernameInput.value = user.username || "";
            if (emailInput) emailInput.value = user.email || "";
            if (phoneInput) phoneInput.value = user.kyc_phone_number || "";
            if (countryInput) countryInput.value = user.country || "";
            if (cityInput) cityInput.value = user.kyc_city || "";
            if (addressInput) addressInput.value = user.kyc_address || "";

            if (dobInput) dobInput.value = user.kyc_age || "";
            if (genderSelect) genderSelect.value = user.kyc_gender || "";
            if (employmentSelect) employmentSelect.value = user.kyc_employment_status || "";

            if (headerName) headerName.textContent = user.full_name || user.username || "User Account";
            if (headerUsername) headerUsername.textContent = `@${user.username || "user"}`;

            if (user.profileImage) {
                setAvatarSrc(user.profileImage);
            }

            // KYC Badge
            const kycStatus = (user.kyc || "no").toLowerCase();
            if (badgeContainer && badgeIcon && badgeText) {
                if (kycStatus === "approved" || kycStatus === "yes") {
                    badgeContainer.className = "badge-status-verified verified";
                    badgeIcon.textContent = "verified";
                    badgeText.textContent = "Account Verified";
                } else if (kycStatus === "pending") {
                    badgeContainer.className = "badge-status-verified pending";
                    badgeIcon.textContent = "hourglass_empty";
                    badgeText.textContent = "Verification Pending";
                } else {
                    badgeContainer.className = "badge-status-verified unverified";
                    badgeIcon.textContent = "gpp_bad";
                    badgeText.textContent = "Not Verified";
                }
            }
        } else {
            console.warn("Failed to retrieve profile:", result.message);
        }
    } catch (err) {
        console.error("Profile fetch error:", err);
        Swal.fire("Error", "Could not load profile details.", "error");
    }

    // -------------------------------------------------------------
    // 2. AUTOMATIC IMAGE UPLOAD ON FILE PICK
    // -------------------------------------------------------------
    imageInput?.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Instant Local Preview
        const reader = new FileReader();
        reader.onload = (evt) => {
            setAvatarSrc(evt.target.result);
        };
        reader.readAsDataURL(file);

        Swal.fire({
            title: "Uploading Avatar...",
            text: "Saving your profile picture...",
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        try {
            const imageBase64 = await fileToBase64(file);

            const payload = {
                action: "update_profile",
                imageBase64: imageBase64,
                fileName: file.name
            };

            const response = await fetch(PROFILE_API_URL, {
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
                    title: "Avatar Updated!",
                    toast: true,
                    position: "top-end",
                    showConfirmButton: false,
                    timer: 3000
                });

                if (result.profile && result.profile.profileImage) {
                    setAvatarSrc(result.profile.profileImage);
                }
            } else {
                Swal.fire("Error", result.message || "Failed to upload avatar.", "error");
            }
        } catch (err) {
            console.error("Image upload error:", err);
            Swal.fire("Error", "An error occurred while uploading your avatar.", "error");
        }
    });

    // -------------------------------------------------------------
    // 3. PROFILE DETAILS FORM SUBMIT HANDLER
    // -------------------------------------------------------------
    profileForm?.addEventListener("submit", async (e) => {
        e.preventDefault();

        Swal.fire({
            title: "Saving Details...",
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        try {
            const combinedFullName = [
                firstNameInput?.value?.trim() || "",
                middleNameInput?.value?.trim() || "",
                lastNameInput?.value?.trim() || ""
            ].filter(Boolean).join(" ");

            const payload = {
                action: "update_profile",
                full_name: combinedFullName,
                username: usernameInput?.value || "",
                email: emailInput?.value || "",
                kyc_phone_number: phoneInput?.value || "",
                country: countryInput?.value || "",
                kyc_city: cityInput?.value || "",
                kyc_address: addressInput?.value || "",
                kyc_age: dobInput?.value || "",
                kyc_gender: genderSelect?.value || "",
                kyc_employment_status: employmentSelect?.value || ""
            };

            const response = await fetch(PROFILE_API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.success) {
                Swal.fire("Success", "Profile details saved successfully!", "success");
            } else {
                Swal.fire("Error", result.message || "Failed to update profile details.", "error");
            }
        } catch (err) {
            console.error("Details update error:", err);
            Swal.fire("Error", "An error occurred while updating profile details.", "error");
        }
    });

    // Utility: Convert File Blob to Base64 String
    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = (err) => reject(err);
        });
    }
});