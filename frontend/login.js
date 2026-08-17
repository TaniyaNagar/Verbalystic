console.log("login.js loaded");


const APP_CONFIG = window.VERBALYSTIC_CONFIG || {
  supabaseUrl: "https://lbacierqszcgokimijtg.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxiYWNpZXJxc3pjZ29raW1panRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0ODEyMTEsImV4cCI6MjA3OTA1NzIxMX0.roI92a8edtAlHGL78effXlQ3XRCwAF2lGpBkyX4SQIE"
};

window.supabaseClient = window.supabaseClient || window.supabase.createClient(
  APP_CONFIG.supabaseUrl,
  APP_CONFIG.supabaseAnonKey
);


const form = document.getElementById("loginForm");

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = form.elements["email"].value.trim().toLowerCase();
    const password = form.elements["password"].value.trim();

    if (!email || !password) {
        alert("Email and password required");
        return;
    }

    const { data, error } = await window.supabaseClient.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        alert(error.message);
        return;
    }

    console.log("Logged in:", data.user);

    // Supabase session is now active
    window.location.href = "index.html";
});
