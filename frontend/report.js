console.log("report.js loaded");

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

async function getAuthenticatedUserId() {
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
        console.warn("User not authenticated");
        window.location.href = "login.html";
        return null;
    }

    return data.user.id; // ✅ real, verified user_id
}

/* =========================
   Load Latest Report
   ========================= */

async function loadLatestReport() {
    const USER_ID = await getAuthenticatedUserId();
    if (!USER_ID) return;

    try {
        const res = await fetch(
            `http://127.0.0.1:8000/get-latest-report/${USER_ID}`,
            {
                method: "GET",
                credentials: "include" // important for auth-based systems
            }
        );

        if (!res.ok) {
            const errText = await res.text();
            console.error("API error:", res.status, errText);

            if (res.status === 401 || res.status === 403) {
                alert("Session expired. Please login again.");
                await supabase.auth.signOut();
                window.location.href = "login.html";
            } else {
                alert("No report found");
            }
            return;
        }

        const data = await res.json();
        console.log("REPORT DATA:", data);

        /* ===== Top Cards ===== */
        document.getElementById("avgWPM").innerText =
            data.avg_wpm ?? "0";
        document.getElementById("fillerWordCount").innerText =
            data.filler_word_count ?? "0";
        document.getElementById("pronScore").innerText =
            data.pronunciation_score ?? "0";
        document.getElementById("toneScore").innerText =
            data.tone_score ?? "0";

        /* ===== Transcript ===== */
        document.getElementById("rawTranscript").innerText =
            data.transcript || "—";
        document.getElementById("improvedTranscript").innerText =
            data.summary_report || "—";

        /* ===== Scores ===== */
        document.getElementById("clarityScore").innerText =
            data.clarity_score ?? "0";
        document.getElementById("fluencyScore").innerText =
            data.fluency_score ?? "0";
        document.getElementById("vocabScore").innerText =
            data.vocabulary_score ?? "0";

        /* ===== Grammar Table ===== */
        const grammarTable = document.getElementById("grammarTable");
        grammarTable.innerHTML = "";

        if (data.grammar_report) {
            let issues = [];

            try {
                issues = JSON.parse(data.grammar_report);
            } catch (e) {
                console.error("Invalid grammar_report JSON", e);
            }

            if (issues.length === 0) {
                grammarTable.innerHTML = `
                    <tr>
                        <td colspan="3" class="p-3 text-center text-gray-500">
                            No grammar issues found
                        </td>
                    </tr>
                `;
            } else {
                issues.forEach(issue => {
                    grammarTable.innerHTML += `
                        <tr>
                            <td class="p-3">${issue.issue}</td>
                            <td class="p-3">${issue.suggestion}</td>
                            <td class="p-3">${issue.errorCount}</td>
                        </tr>
                    `;
                });
            }
        }

        /* ===== Recommendations ===== */
        document.getElementById("tipsContainer").innerHTML = `
            <p class="text-gray-700">
                ${data.recommendations || "No recommendations available"}
            </p>
        `;

    } catch (err) {
        console.error("Network error:", err);
        alert("Backend not reachable");
    }
}

/* =========================
   Logout
   ========================= */

async function logout() {
    await supabase.auth.signOut();
    window.location.href = "login.html";
}

/* =========================
   Init
   ========================= */

loadLatestReport();
