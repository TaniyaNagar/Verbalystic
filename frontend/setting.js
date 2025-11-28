console.log("setting.js loaded");

const USER_ID = localStorage.getItem("user_id");


async function loadSettings() {
    try {
        const res = await fetch(`http://127.0.0.1:8000/get-user/${USER_ID}`);
        const data = await res.json();

        console.log("SETTINGS DATA:", data);

        if (res.ok) {
            document.getElementById("settingName").innerText = data.name;
            document.getElementById("settingEmail").innerText = data.email;
        }

    } catch (error) {
        console.error("Error loading settings:", error);
    }
}

// Update name + email
document.getElementById("editSettingsBtn").addEventListener("click", async () => {
    const newName = prompt("Enter new name:");
    if (!newName) return;

    const newEmail = prompt("Enter new email:");
    if (!newEmail) return;

    try {
        const res = await fetch("http://127.0.0.1:8000/update-profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                user_id: USER_ID,
                name: newName,
                email: newEmail
            })
        });

        const data = await res.json();

        if (res.ok) {
            alert("Profile updated!");
            loadSettings();
        } else {
            alert("Update failed: " + data.detail);
        }
    } catch (error) {
        console.error("Error updating profile:", error);
    }
});

// Logout
document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "login.html";
});

loadSettings();
