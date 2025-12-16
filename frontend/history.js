console.log("history.js loaded");

/* =========================
   Supabase Initialization
   ========================= */

const SUPABASE_URL = "https://lbacierqszcgokimijtg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxiYWNpZXJxc3pjZ29raW1panRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0ODEyMTEsImV4cCI6MjA3OTA1NzIxMX0.roI92a8edtAlHGL78effXlQ3XRCwAF2lGpBkyX4SQIE";

const supabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

/* =========================
   DOM Elements
   ========================= */

const historyList = document.getElementById("historyList");
const sidebarUserName = document.getElementById("sidebarUserName");
const sidebarUserImage = document.getElementById("sidebarUserImage");
const logoutBtn = document.getElementById("logoutBtn");

/* =========================
   Auth
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
   Basic User Display
   ========================= */

async function loadSidebarUser() {
    const user = await getAuthenticatedUser();
    if (!user) return;

    // name & image should ideally come from your DB, not auth metadata
    sidebarUserName.innerText =
        user.user_metadata?.name || user.email;

    const profileImage =
        user.user_metadata?.profile_image ||
        "https://via.placeholder.com/100";

    sidebarUserImage.style.backgroundImage = `url('${profileImage}')`;
}

/* =========================
   Logout
   ========================= */

logoutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "login.html";
});

/* =========================
   Fetch Session History
   ========================= */

async function loadHistory() {
    const user = await getAuthenticatedUser();
    if (!user) return;

    try {
        const res = await fetch(
            `http://localhost:5000/sessions/by-user/${user.id}`,
            {
                method: "GET",
                credentials: "include"
            }
        );

        if (!res.ok) {
            historyList.innerHTML = `
                <p class="text-gray-600 dark:text-gray-400">
                    Failed to load session history.
                </p>
            `;
            return;
        }

        const data = await res.json();

        if (!data.sessions || data.sessions.length === 0) {
            historyList.innerHTML = `
                <p class="text-gray-600 dark:text-gray-400">
                    No sessions recorded yet.
                </p>
            `;
            return;
        }

        historyList.innerHTML = "";

        data.sessions.forEach(session => {
            const card = document.createElement("div");
            card.className =
                "rounded-lg border bg-white dark:bg-gray-800 p-5 shadow flex justify-between items-center";

            card.innerHTML = `
                <div>
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                        ${new Date(session.session_at).toLocaleString()}
                    </p>
                    <p class="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Duration: ${session.duration_seconds ?? 0}s
                    </p>
                    <p class="text-sm text-gray-600 dark:text-gray-400">
                        WPM: ${session.avg_wpm ?? 0}
                    </p>
                </div>

                <div class="text-right">
                    <p class="font-semibold text-gray-900 dark:text-gray-100">
                        Pronunciation: ${session.pronunciation_score ?? 0}
                    </p>
                    <p class="font-semibold text-gray-900 dark:text-gray-100">
                        Tone: ${session.tone_score ?? 0}
                    </p>
                    <p class="font-semibold text-gray-900 dark:text-gray-100">
                        Grammar: ${session.grammar_score ?? 0}
                    </p>

                    <button
                        class="mt-2 px-4 py-1 bg-primary text-white rounded-lg text-sm"
                        onclick="viewReport('${session.id}')">
                        View Report
                    </button>
                </div>
            `;

            historyList.appendChild(card);
        });

    } catch (err) {
        console.error("History load error:", err);
        historyList.innerHTML = `
            <p class="text-gray-600 dark:text-gray-400">
                Network error while loading history.
            </p>
        `;
    }
}

/* =========================
   Redirect to Report Page
   ========================= */

function viewReport(sessionId) {
    // ❗ temporary — should be removed once report page uses route param
    window.location.href = `report.html?session_id=${sessionId}`;
}

/* =========================
   Init
   ========================= */

(async function init() {
    await loadSidebarUser();
    await loadHistory();
})();
