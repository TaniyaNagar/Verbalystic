console.log("profile.js loaded");

// Get user ID from localStorage
const USER_ID = localStorage.getItem("user_id");


// Fetch and display user profile
async function loadProfile() {
    try {
        const res = await fetch(`http://127.0.0.1:8000/get-user/${USER_ID}`);
        const data = await res.json();

        console.log("PROFILE DATA:", data);

        if (!res.ok) {
            alert("Failed to load profile.");
            return;
        }

        // Display basic info
        document.getElementById("profileName").innerText = data.name;
        document.getElementById("profileEmail").innerText = data.email;

        // Stats (if available)
        document.getElementById("dailyStreak").innerText = data.streak_count || 0;
        document.getElementById("totalSessions").innerText = data.total_sessions || 0;
        document.getElementById("weeklyConsistency").innerText = data.weekly_consistency || "0%";
        document.getElementById("speakingMinutes").innerText = data.speaking_minutes || 0;

        // Load roadmap
        loadRoadmap();
        // Load achievements
        loadAchievements();

    } catch (err) {
        console.error("Error loading profile:", err);
    }
}

async function loadRoadmap() {
    try {
        const res = await fetch(`http://127.0.0.1:8000/get-roadmap/${USER_ID}`);
        const roadmap = await res.json();

        if (res.ok && roadmap) {
            document.getElementById("roadmapStage1").style.width = roadmap.stage1_progress + "%";
            document.getElementById("roadmapStage2").style.width = roadmap.stage2_progress + "%";
            document.getElementById("roadmapStage3").style.width = roadmap.stage3_progress + "%";
        }
    } catch (err) {
        console.error("Roadmap load error:", err);
    }
}

async function loadAchievements() {
    try {
        const res = await fetch(`http://127.0.0.1:8000/get-achievements/${USER_ID}`);
        const achievements = await res.json();

        if (res.ok && achievements.length > 0) {
            const container = document.getElementById("achievementsContainer");
            container.innerHTML = "";

            achievements.forEach(a => {
                const card = `
                    <div class="flex flex-col items-center gap-2 rounded-md border p-4">
                        <span class="material-symbols-outlined text-3xl" style="color: ${a.color};">${a.icon}</span>
                        <p class="text-sm font-medium text-center">${a.name}</p>
                    </div>`;
                container.innerHTML += card;
            });
        }
    } catch (err) {
        console.error("Achievements load error:", err);
    }
}

// Run everything
loadProfile();
