// --------------------------
// BASIC USER DISPLAY
// --------------------------
document.getElementById("sidebarUserName").innerText = localStorage.getItem("name");
document.getElementById("sidebarUserImage").style.backgroundImage =
    `url('${localStorage.getItem("profile_image") || "https://via.placeholder.com/100"}')`;

// Logout
document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "login.html";
});

// --------------------------
// FETCH SESSION HISTORY
// --------------------------
const historyList = document.getElementById("historyList");
const userId = localStorage.getItem("user_id");

async function loadHistory() {
    if (!userId) return;

    const res = await fetch(`http://localhost:5000/sessions/by-user/${userId}`);
    const data = await res.json();

    if (!data.sessions || data.sessions.length === 0) {
        historyList.innerHTML = `
            <p class="text-gray-600 dark:text-gray-400">No sessions recorded yet.</p>
        `;
        return;
    }

    historyList.innerHTML = "";

    data.sessions.forEach((session) => {
        const card = document.createElement("div");
        card.className =
            "rounded-lg border bg-white dark:bg-gray-800 p-5 shadow flex justify-between items-center";

        card.innerHTML = `
            <div>
                <p class="text-sm text-gray-500 dark:text-gray-400">${new Date(session.session_at).toLocaleString()}</p>
                <p class="text-lg font-semibold text-gray-900 dark:text-gray-100">Duration: ${session.duration_seconds || 0}s</p>
                <p class="text-sm text-gray-600 dark:text-gray-400">WPM: ${session.avg_wpm || 0}</p>
            </div>

            <div class="text-right">
                <p class="font-semibold text-gray-900 dark:text-gray-100">Pronunciation: ${session.pronunciation_score || 0}</p>
                <p class="font-semibold text-gray-900 dark:text-gray-100">Tone: ${session.tone_score || 0}</p>
                <p class="font-semibold text-gray-900 dark:text-gray-100">Grammar: ${session.grammar_score || 0}</p>

                <button class="mt-2 px-4 py-1 bg-primary text-white rounded-lg text-sm"
                    onclick="viewReport('${session.id}')">
                    View Report
                </button>
            </div>
        `;

        historyList.appendChild(card);
    });
}

// --------------------------
// REDIRECT TO REPORT PAGE
// --------------------------
function viewReport(sessionId) {
    localStorage.setItem("selected_session_id", sessionId);
    window.location.href = "report.html";
}

// LOAD HISTORY
loadHistory();
