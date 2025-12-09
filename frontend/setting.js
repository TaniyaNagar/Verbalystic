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
document.getElementById("changePasswordBtn").addEventListener("click", async () => {
    const oldPw = prompt("Enter your current password:");
    if (!oldPw) return;

    const newPw = prompt("Enter your new password:");
    if (!newPw) return;

    const res = await fetch("http://127.0.0.1:8000/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            user_id: USER_ID,
            old_password: oldPw,
            new_password: newPw
        })
    });

    const data = await res.json();

    if (res.ok) {
        alert("Password changed successfully!");
    } else {
        alert("Error: " + data.detail);
    }
});


// Logout
document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "login.html";
});

loadSettings();
