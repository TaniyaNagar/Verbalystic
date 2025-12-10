console.log("report.js loaded");

const USER_ID = "c7c92dad-80b2-42ed-b1c1-beb25ec18d07";

async function loadLatestReport() {
    try {
        const res = await fetch(`http://127.0.0.1:8000/get-latest-report/${USER_ID}`);
        const data = await res.json();

        if (!res.ok) {
            alert(data.detail || "No report found");
            return;
        }
        console.log("Report Loaded");
        console.log("REPORT:", data);

        // TOP CARDS
        document.getElementById("avgWPM").innerText = data.avg_wpm ?? "0";
        document.getElementById("fillerWordCount").innerText = data.filler_word_count ?? "0";
        document.getElementById("pronScore").innerText = data.pronunciation_score ?? "0";
        document.getElementById("toneScore").innerText = data.tone_score ?? "0";

        // TRANSCRIPT
        document.getElementById("rawTranscript").innerText = data.transcript || "—";
        document.getElementById("improvedTranscript").innerText = data.summary_report || "—";

        // SCORES
        document.getElementById("clarityScore").innerText = data.clarity_score ?? "0";
        document.getElementById("fluencyScore").innerText = data.fluency_score ?? "0";
        document.getElementById("vocabScore").innerText = data.vocabulary_score ?? "0";

        // GRAMMAR TABLE
        const grammarTable = document.getElementById("grammarTable");
        grammarTable.innerHTML = "";

        if (data.grammar_report) {
            const issues = JSON.parse(data.grammar_report);

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

        // Recommendations
        document.getElementById("tipsContainer").innerHTML =
            `<p class="text-gray-700">${data.recommendations || "No recommendations"}</p>`;

    } catch (err) {
        console.error("Report load failed:", err);
    }
}

loadLatestReport();
