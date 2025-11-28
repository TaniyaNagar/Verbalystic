console.log("report.js loaded");

// Get logged-in user ID
const USER_ID = localStorage.getItem("user_id");



async function loadLatestReport() {
    try {
        const res = await fetch(`http://127.0.0.1:8000/get-latest-report/${USER_ID}`);
        const data = await res.json();

        console.log("REPORT DATA:", data);

        if (!res.ok) {
            alert("No report found. Do a speaking session first.");
            return;
        }

        // Display scores
        document.getElementById("grammarScore").innerText = data.grammar_score ?? "—";
        document.getElementById("fluencyScore").innerText = data.fluency_score ?? "—";
        document.getElementById("clarityScore").innerText = data.clarity_score ?? "—";
        document.getElementById("vocabularyScore").innerText = data.vocabulary_score ?? "—";

        // Filler words
        document.getElementById("fillerWords").innerText = data.filler_words_detected ?? 0;

        // Grammar errors
        document.getElementById("grammarErrors").innerText = data.grammatical_errors ?? 0;

        // Transcript
        document.getElementById("transcriptContent").innerText = data.transcript || "No transcript available";

        // Improved transcript
        document.getElementById("improvedTranscript").innerText =
            data.summary_report || "No improved version available";

        // AI Recommendations
        document.getElementById("recommendations").innerText =
            data.recommendations || "No suggestions";

    } catch (error) {
        console.error("Error loading report:", error);
    }
}

loadLatestReport();
