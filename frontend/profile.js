console.log("profile.js loaded");

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
   Auth Check
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
   Load Profile
   ========================= */

async function loadProfile() {
    const user = await getAuthenticatedUser();
    if (!user) return;

    try {
        const res = await fetch(
            `http://127.0.0.1:8000/get-user/${user.id}`,
            {
                method: "GET",
                credentials: "include"
            }
        );

        if (!res.ok) {
            alert("Failed to load profile");
            return;
        }

        const data = await res.json();
        console.log("PROFILE DATA:", data);

        /* ===== Basic Info ===== */
        document.getElementById("profileName").innerText =
            data.name || "—";
        document.getElementById("profileEmail").innerText =
            data.email || "—";

        /* ===== Stats ===== */
        document.getElementById("dailyStreak").innerText =
            data.streak_count ?? 0;
        document.getElementById("totalSessions").innerText =
            data.total_sessions ?? 0;
        document.getElementById("weeklyConsistency").innerText =
            data.weekly_consistency ?? "0%";
        document.getElementById("speakingMinutes").innerText =
            data.speaking_minutes ?? 0;

        /* ===== Load Extras ===== */
        await loadRoadmap(user.id);
        await loadAchievements(user.id);

    } catch (err) {
        console.error("Error loading profile:", err);
        alert("Network error");
    }
}

/* =========================
   Load Roadmap
   ========================= */

async function loadRoadmap(userId) {
    try {
        const res = await fetch(
            `http://127.0.0.1:8000/get-roadmap/${userId}`,
            {
                method: "GET",
                credentials: "include"
            }
        );

        if (!res.ok) return;

        const roadmap = await res.json();

        document.getElementById("roadmapStage1").style.width =
            `${roadmap.stage1_progress ?? 0}%`;
        document.getElementById("roadmapStage2").style.width =
            `${roadmap.stage2_progress ?? 0}%`;
        document.getElementById("roadmapStage3").style.width =
            `${roadmap.stage3_progress ?? 0}%`;

    } catch (err) {
        console.error("Roadmap load error:", err);
    }
}

/* =========================
   Load Achievements
   ========================= */

async function loadAchievements(userId) {
    try {
        const res = await fetch(
            `http://127.0.0.1:8000/get-achievements/${userId}`,
            {
                method: "GET",
                credentials: "include"
            }
        );

        if (!res.ok) return;

        const achievements = await res.json();
        const container = document.getElementById("achievementsContainer");
        container.innerHTML = "";

        if (!achievements || achievements.length === 0) {
            container.innerHTML = `
                <p class="text-sm text-gray-500">No achievements yet</p>
            `;
            return;
        }

        achievements.forEach(a => {
            container.innerHTML += `
                <div class="flex flex-col items-center gap-2 rounded-md border p-4">
                    <span class="material-symbols-outlined text-3xl"
                          style="color:${a.color};">
                        ${a.icon}
                    </span>
                    <p class="text-sm font-medium text-center">
                        ${a.name}
                    </p>
                </div>
            `;
        });

    } catch (err) {
        console.error("Achievements load error:", err);
    }
}

/* =========================
   Init
   ========================= */

loadProfile();
