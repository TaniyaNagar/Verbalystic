console.log("setting.js loaded");

/* =========================
   Supabase Initialization
   ========================= */

const SUPABASE_URL = "https://YOUR_PROJECT_ID.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_PUBLIC_ANON_KEY";

const supabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

/* =========================
   Auth Check
   ========================= */

async function getAuthenticatedUser() {
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
        console.warn("User not authenticated");
        window.location.href = "login.html";
        return null;
    }

    return data.user;
}

/* =========================
   Load User Settings
   ========================= */

async function loadSettings() {
    const user = await getAuthenticatedUser();
    if (!user) return;

    try {
        const res = await fetch(
            `http://127.0.0.1:8000/get-user/${user.id}`,
            {
                method: "GET",
                credentials: "include"
            }
        );

        if (!res.ok) {
            const err = await res.text();
            console.error("Failed to load settings:", err);
            alert("Unable to load user settings");
            return;
        }

        const data = await res.json();
        console.log("SETTINGS DATA:", data);

        document.getElementById("settingName").innerText =
            data.name || "—";
        document.getElementById("settingEmail").innerText =
            data.email || "—";

    } catch (error) {
        console.error("Error loading settings:", error);
        alert("Network error");
    }
}

/* =========================
   Change Password
   ========================= */

document
    .getElementById("changePasswordBtn")
    .addEventListener("click", async () => {

        const oldPw = prompt("Enter your current password:");
        if (!oldPw) return;

        const newPw = prompt("Enter your new password:");
        if (!newPw) return;

        const user = await getAuthenticatedUser();
        if (!user) return;

        try {
            const res = await fetch(
                "http://127.0.0.1:8000/change-password",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({
                        user_id: user.id,
                        old_password: oldPw,
                        new_password: newPw
                    })
                }
            );

            const data = await res.json();

            if (!res.ok) {
                alert(data.detail || "Password change failed");
                return;
            }

            alert("Password changed successfully!");

        } catch (err) {
            console.error("Password change error:", err);
            alert("Network error");
        }
    });

/* =========================
   Logout
   ========================= */

document
    .getElementById("logoutBtn")
    .addEventListener("click", async () => {
        await supabase.auth.signOut();
        window.location.href = "login.html";
    });

/* =========================
   Init
   ========================= */

loadSettings();
