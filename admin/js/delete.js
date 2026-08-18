import { currentlySelectedAccountObj } from "./list.js";

document.addEventListener("DOMContentLoaded", () => {
    const deleteBtn = document.getElementById("deleteUser");

    if (deleteBtn) {
        deleteBtn.onclick = async (e) => {
            e.preventDefault();

            // 1. Validation check to see if an active account is selected
            if (!currentlySelectedAccountObj || !currentlySelectedAccountObj.uuid) {
                Swal.fire({
                    title: "No Profile Target Selected",
                    text: "Please select an account workspace from the directory stream list before requesting an excision delete action.",
                    icon: "info",
                    background: "#0f172a",
                    color: "#ffffff"
                });
                return;
            }

            const adminToken = localStorage.getItem("admin_session_token");
            const clientUuid = currentlySelectedAccountObj.uuid;
            const accountFullName = `${currentlySelectedAccountObj.firstname} ${currentlySelectedAccountObj.lastname}`;

            // 2. Double-confirmation warning prompt layout
            const securityCheckConfirmation = await Swal.fire({
                title: "Delete Account?",
                text: `Warning! You are about to completely drop ${accountFullName}. This routine executes a cascading erasure of all historical settlement data logs, messaging channels, and account access profiles from database storage matrices. This loop cannot be undone.`,
                icon: "warning",
                showCancelButton: true,
                confirmButtonColor: "#ef4444",
                cancelButtonColor: "#475569",
                confirmButtonText: "Execute Delete Loop",
                cancelButtonText: "Abort",
                background: "#0f172a",
                color: "#ffffff"
            });

            if (securityCheckConfirmation.isConfirmed) {
                // Show instant loading layer block to user during network sequence execution
                Swal.fire({
                    title: "Dropping Context Nodes...",
                    html: "Executing database drop queries cross-referencing this footprint reference identifier key...",
                    background: "#0f172a",
                    color: "#ffffff",
                    didOpen: () => Swal.showLoading(),
                    allowOutsideClick: false
                });

                try {
                    // 3. Dispatch the DELETE network request directly onto the serverless endpoint
                    const response = await fetch(`https://broker-chi-five.vercel.app/api/admin-users?uuid=${clientUuid}`, {
                        method: "DELETE",
                        headers: {
                            "Authorization": `Bearer ${adminToken}`,
                            "Content-Type": "application/json"
                        }
                    });

                    const operationOutputResult = await response.json();

                    if (!response.ok || !operationOutputResult.success) {
                        throw new Error(operationOutputResult.error || "Database clearing routine denied.");
                    }

                    await Swal.fire({
                        icon: "success",
                        title: "Account Delete Clean",
                        text: "All tracking rows dropped cleanly across all data tables. Reloading console panel view vectors.",
                        background: "#0f172a",
                        color: "#ffffff",
                        timer: 2000,
                        showConfirmButton: false
                    });

                    // 4. Force reload browser cleanly to re-fetch the cleaned directory indexes
                    window.location.reload();

                } catch (err) {
                    Swal.fire({
                        icon: "error",
                        title: "Delete Execution Failed",
                        text: err.message,
                        background: "#0f172a",
                        color: "#ffffff"
                    });
                }
            }
        };
    }
});