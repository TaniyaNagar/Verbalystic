console.log("setting.js loaded");

/* =========================
   Supabase Initialization
   ========================= */

const SUPABASE_URL = "https://lbacierqszcgokimijtg.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxiYWNpZXJxc3pjZ29raW1panRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0ODEyMTEsImV4cCI6MjA3OTA1NzIxMX0.roI92a8edtAlHGL78effXlQ3XRCwAF2lGpBkyX4SQIE";

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

/* =========================
   AUTH + LOAD SETTINGS
   ========================= */

async function loadSettings() {
  // 1️⃣ Check session first
  const { data: sessionData } = await supabase.auth.getSession();

  if (!sessionData.session) {
    window.location.href = "login.html";
    return;
  }

  // 2️⃣ Get authenticated user
  const user = sessionData.session.user;
  console.log("AUTH USER:", user);

  // 3️⃣ Email (always from auth)
  document.getElementById("settingEmail").innerText =
    user.email || "—";

  // 4️⃣ Name (metadata → fallback backend)
  if (user.user_metadata?.name) {
    document.getElementById("settingName").innerText =
      user.user_metadata.name;
  } else {
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/get-user/${user.id}`
      );

      if (res.ok) {
        const data = await res.json();
        document.getElementById("settingName").innerText =
          data.name || "—";
      } else {
        document.getElementById("settingName").innerText = "—";
      }
    } catch (err) {
      console.warn("Backend name fetch failed");
      document.getElementById("settingName").innerText = "—";
    }
  }
}

/* =========================
   CHANGE PASSWORD
   ========================= */

document
  .getElementById("changePasswordBtn")
  .addEventListener("click", async () => {
    const newPassword = prompt("Enter your new password:");
    if (!newPassword) return;

    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Password updated successfully!");
  });

/* =========================
   LOGOUT
   ========================= */

document
  .getElementById("logoutBtn")
  .addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "login.html";
  });

/* =========================
   INIT
   ========================= */

loadSettings();
