console.log("report.js loaded");

/* =========================
   MOCK DATA
========================= */

const mockReport = {
  session: {
    transcript: "Myself Zaira today I practicing speaking about climate changes and it impact.",
    avg_wpm: 118,
    filler_word_count: 6,
    pronunciation_score: 82,
    tone_score: 74
  },
  analysis: {
    vocabulary_score: 78,
    fluency_score: 80,
    clarity_score: 76,
    grammar_report: null,
    summary_report: "My name is Zaira and Today I practiced speaking about climate change and its impact.",
    recommendations: "Pause instead of fillers and structure sentences better."
  }
};

const mockTrends = {
  labels: ["S1", "S2", "S3", "S4", "S5"],
  grammar: [60, 65, 70, 75, 80],
  flow: [90, 100, 110, 115, 120],
  fillers: [12, 10, 8, 7, 5]
};


/* =========================
   SUPABASE INIT
========================= */

const APP_CONFIG = window.VERBALYSTIC_CONFIG || {
  backendBaseUrl: "https://verbalystic-idto.onrender.com",
  supabaseUrl: "https://lbacierqszcgokimijtg.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxiYWNpZXJxc3pjZ29raW1panRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0ODEyMTEsImV4cCI6MjA3OTA1NzIxMX0.roI92a8edtAlHGL78effXlQ3XRCwAF2lGpBkyX4SQIE"
};

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


/* =========================
   USER INFO
========================= */

async function loadUserInfo(user) {
  try {
    const res = await window.authenticatedFetch(`${APP_CONFIG.backendBaseUrl}/get-user/${user.id}`);
    if (!res.ok) return;

    const data = await res.json();

    document.getElementById("userName").innerText =
      data.name || "User";

    document.getElementById("streakCount").innerText =
      `${data.streak_count || 0} Day Streak`;

  } catch (err) {
    console.error("User load error", err);
  }
}


/* =========================
   REPORT
========================= */

async function loadLatestReport(userId) {
  try {
    const res = await window.authenticatedFetch(
      `${APP_CONFIG.backendBaseUrl}/get-latest-report/${userId}`
    );

    if (!res.ok) {
      throw new Error("Latest report fetch failed");
    }

    const data = await res.json();

    let session = data?.session;
    let analysis = data?.analysis;

    // 🔥 EMPTY → MOCK
    if (!session || !session.transcript) {
      document.getElementById("rawTranscript").innerText =
        "No transcript is available yet.";
      document.getElementById("improvedTranscript").innerText =
        "Complete a speaking session to generate a report.";
      return;
    }

    /* ----- RAW TRANSCRIPT ----- */
    document.getElementById("rawTranscript").innerText =
      session.transcript || "—";

    /* ----- AI IMPROVED (with fallback) ----- */
    let improvedText = analysis?.summary_report;

    if (!improvedText || improvedText.trim() === "") {
      improvedText = "AI improved transcript is not ready yet.";
    }

    document.getElementById("improvedTranscript").innerText = improvedText;

    /* ----- GRAMMAR TABLE ----- */
    const grammarTable = document.getElementById("grammarTable");
    grammarTable.innerHTML = "";

    let issues = [];

    if (analysis?.grammar_report) {
      try {
        issues = JSON.parse(analysis.grammar_report);
      } catch {}
    }

    if (!issues.length) {
      grammarTable.innerHTML = `
        <tr>
          <td colspan="3" class="py-3 text-center text-gray-500">
            No grammar issues found
          </td>
        </tr>`;
    } else {
      issues.forEach(i => {
        const row = document.createElement("tr");
        row.className = "border-t";

        const issueCell = document.createElement("td");
        issueCell.textContent = i.issue || "";

        const suggestionCell = document.createElement("td");
        suggestionCell.textContent = i.suggestion || "";

        const countCell = document.createElement("td");
        countCell.textContent = i.errorCount ?? "";

        row.append(issueCell, suggestionCell, countCell);
        grammarTable.appendChild(row);
      });
    }

  } catch (err) {
    console.error("Report error", err);
    document.getElementById("rawTranscript").innerText =
      "Unable to load the latest report.";
    document.getElementById("improvedTranscript").innerText =
      "Please try again later.";
  }
}


/* =========================
   CHART
========================= */

async function loadPerformanceChart(userId) {
  const canvas = document.getElementById("performanceChart");
  if (!canvas) return;

  try {
    const res = await window.authenticatedFetch(
      `${APP_CONFIG.backendBaseUrl}/report/trends/${userId}`
    );

    if (!res.ok) {
      throw new Error("Performance trends fetch failed");
    }

    const data = await res.json();

    // 🔥 EMPTY → MOCK
    if (!data || !data.labels || data.labels.length === 0) {
      return;
    }

    new Chart(canvas, {
      type: "line",
      data: {
        labels: data.labels,
        datasets: [
          { label: "Grammar", data: data.grammar, borderColor: "#359EFF" },
          { label: "Flow", data: data.flow, borderColor: "#10b981" },
          { label: "Fillers", data: data.fillers, borderColor: "#f97316" }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    });

  } catch (err) {
    console.error("Chart error", err);
  }
}


/* =========================
   LOGOUT
========================= */

document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  await window.supabaseClient.auth.signOut();
  window.location.href = "login.html";
});


/* =========================
   INIT
========================= */

(async function init() {
  const user = await getAuthenticatedUser();
  if (!user) return;

  await loadUserInfo(user);
  await loadLatestReport(user.id);
  await loadPerformanceChart(user.id);
})();
