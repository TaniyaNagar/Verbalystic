console.log("report.js loaded");

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
   AUTH + USER LOAD
   ========================= */

async function getAuthenticatedUser() {
  const { data: sessionData } = await supabase.auth.getSession();

  if (!sessionData.session) {
    window.location.href = "login.html";
    return null;
  }

  return sessionData.session.user;
}

/* =========================
   LOAD USER NAME (SIDEBAR)
   ========================= */

async function loadUserInfo(user) {
  // Name from Supabase metadata
  if (user.user_metadata?.name) {
    document.getElementById("sidebarUserName").innerText =
      user.user_metadata.name;
    return;
  }

  // Fallback: backend DB
  try {
    const res = await fetch(
      `http://127.0.0.1:8000/get-user/${user.id}`
    );

    if (res.ok) {
      const data = await res.json();
      document.getElementById("sidebarUserName").innerText =
        data.name || "User";
    }
  } catch (err) {
    console.warn("User name fetch failed");
  }
}

/* =========================
   LOAD LATEST REPORT
   ========================= */

async function loadLatestReport(user) {
  try {
    const res = await fetch(
      `http://127.0.0.1:8000/get-latest-report/${user.id}`,
      { method: "GET" }
    );

    if (!res.ok) {
      if (res.status === 404) {
        alert("No report found for this user.");
      } else {
        alert("Failed to load report.");
      }
      return;
    }

    const data = await res.json();
    console.log("REPORT DATA:", data);

    /* ===== TOP CARDS ===== */
    document.getElementById("avgWPM").innerText =
      data.avg_wpm ?? "0";
    document.getElementById("fillerWordCount").innerText =
      data.filler_word_count ?? "0";
    document.getElementById("pronScore").innerText =
      data.pronunciation_score ?? "0";
    document.getElementById("toneScore").innerText =
      data.tone_score ?? "0";

    /* ===== TRANSCRIPTS ===== */
    document.getElementById("rawTranscript").innerText =
      data.transcript || "—";
    document.getElementById("improvedTranscript").innerText =
      data.summary_report || "—";

    /* ===== SCORES ===== */
    document.getElementById("clarityScore").innerText =
      data.clarity_score ?? "0";
    document.getElementById("fluencyScore").innerText =
      data.fluency_score ?? "0";
    document.getElementById("vocabScore").innerText =
      data.vocabulary_score ?? "0";

    /* ===== GRAMMAR TABLE ===== */
    const grammarTable = document.getElementById("grammarTable");
    grammarTable.innerHTML = "";

    let issues = [];
    if (data.grammar_report) {
      try {
        issues = JSON.parse(data.grammar_report);
      } catch {
        console.error("Invalid grammar_report JSON");
      }
    }

    if (!issues.length) {
      grammarTable.innerHTML = `
        <tr>
          <td colspan="3" class="p-3 text-center text-gray-500">
            No grammar issues found
          </td>
        </tr>`;
    } else {
      issues.forEach(issue => {
        grammarTable.innerHTML += `
          <tr>
            <td class="p-3">${issue.issue}</td>
            <td class="p-3">${issue.suggestion}</td>
            <td class="p-3">${issue.errorCount}</td>
          </tr>`;
      });
    }

    /* ===== RECOMMENDATIONS ===== */
    document.getElementById("tipsContainer").innerHTML = `
      <p class="text-gray-700">
        ${data.recommendations || "No recommendations available"}
      </p>`;
  } catch (err) {
    console.error("Report fetch failed:", err);
    alert("Backend not reachable");
  }
}

/* =========================
   LOGOUT
   ========================= */

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href = "login.html";
});

/* =========================
   INIT
   ========================= */

(async function init() {
  const user = await getAuthenticatedUser();
  if (!user) return;

  await loadUserInfo(user);
  await loadLatestReport(user);
})();
