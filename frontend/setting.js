console.log("setting.js loaded");
const APP_CONFIG = window.VERBALYSTIC_CONFIG || {
  backendBaseUrl: "https://verbalystic-idto.onrender.com",
  supabaseUrl: "https://lbacierqszcgokimijtg.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxiYWNpZXJxc3pjZ29raW1panRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0ODEyMTEsImV4cCI6MjA3OTA1NzIxMX0.roI92a8edtAlHGL78effXlQ3XRCwAF2lGpBkyX4SQIE"
};
const BASE_URL = APP_CONFIG.backendBaseUrl;
/* =========================
   SUPABASE INIT
   ========================= */

window.supabaseClient = window.supabaseClient || window.supabase.createClient(
  APP_CONFIG.supabaseUrl,
  APP_CONFIG.supabaseAnonKey
);
/* =========================
   AUTH
   ========================= */
async function getAuthenticatedUser() {
  const { data } = await window.supabaseClient.auth.getSession();

  if (!data.session) {
    window.location.href = "login.html";
    return null;
  }
  try {
    await window.ensureBackendUserProfile();
  } catch (err) {
    console.error("Backend profile sync failed", err);
  }

  return data.session.user;
}

(async function init() {
  const { data } = await window.supabaseClient.auth.getSession();

  if (!data.session) {
    window.location.href = "login.html";
    return;
  }

  const user = data.session.user;

  await loadUserInfo(user); // ✅ SIDEBAR NAME
  await loadSettings();    // ✅ SETTINGS PANEL
})();

async function loadUserInfo(user) {
  try {
    const res = await window.authenticatedFetch(`${BASE_URL}/get-user/${user.id}`);
    if (!res.ok) return;

    const data = await res.json();

    const nameEl = document.getElementById("userName");
    if (nameEl) nameEl.innerText = data.name || "User";

  } catch (err) {
    console.error("Failed to load user info", err);
  }
}

/* =========================
   LOAD SETTINGS (FAST)
   ========================= */
async function loadSettings() {
  const emailEl = document.getElementById("settingEmail");
  const nameEl = document.getElementById("settingName");
  const nameE2 = document.getElementById("userName");
  // Default placeholders (instant UI)
  emailEl.innerText = "—";
  nameEl.innerText = "Loading...";

  // Get auth session
  const { data, error } = await window.supabaseClient.auth.getSession();

  if (error || !data.session) {
    window.location.href = "login.html";
    return;
  }

  const user = data.session.user;

  /* ===== EMAIL (always instant) ===== */
  emailEl.innerText = user.email || "—";

  /* ===== NAME (priority order) ===== */
  // 1️⃣ Metadata → instant
  if (user.user_metadata?.name) {
    nameEl.innerText = user.user_metadata.name;
    return;
  }

  // 2️⃣ Backend → background fetch (NON-BLOCKING)
  window.authenticatedFetch(`${BASE_URL}/get-user/${user.id}`)
    .then(res => res.ok ? res.json() : null)
    .then(data => {
      if (data?.name) {
        nameEl.innerText = data.name;
      } else {
        nameEl.innerText = "—";
      }
    })
    .catch(() => {
      nameEl.innerText = "—";
    });
}

/* =========================
   CHANGE PASSWORD
   ========================= */
document
  .getElementById("changePasswordBtn")
  ?.addEventListener("click", async () => {
    const newPassword = prompt("Enter your new password:");
    if (!newPassword) return;

    const { error } = await window.supabaseClient.auth.updateUser({
      password: newPassword
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Password updated successfully");
  });

/* =========================
   LOGOUT
   ========================= */
document
  .getElementById("logoutBtn")
  ?.addEventListener("click", async () => {
    await window.supabaseClient.auth.signOut();
    window.location.href = "login.html";
  });

/* =========================
   INIT
   ========================= */
loadSettings();
