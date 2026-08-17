console.log("signup.js loaded");


const APP_CONFIG = window.VERBALYSTIC_CONFIG || {
  supabaseUrl: "https://lbacierqszcgokimijtg.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxiYWNpZXJxc3pjZ29raW1panRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0ODEyMTEsImV4cCI6MjA3OTA1NzIxMX0.roI92a8edtAlHGL78effXlQ3XRCwAF2lGpBkyX4SQIE"
};

window.supabaseClient = window.supabaseClient || window.supabase.createClient(
  APP_CONFIG.supabaseUrl,
  APP_CONFIG.supabaseAnonKey
);


const form = document.getElementById("signupForm");

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = form.elements["name"].value.trim();
    const email = form.elements["email"].value.trim().toLowerCase();
    const password = form.elements["password"].value.trim();
    const confirmPassword = form.elements["confirmPassword"].value.trim();

    if (!name || !email || !password || !confirmPassword) {
        alert("All fields are required");
        return;
    }

    if (password !== confirmPassword) {
        alert("Passwords do not match");
        return;
    }

    const { data, error } = await window.supabaseClient.auth.signUp({
        email,
        password,
        options: {
            data: {
            name: name
            }
        }
    });


    if (error) {
        alert(error.message);
        return;
}

    const user = data?.user || data?.session?.user;

    if (!user) {
        alert("Check your email for verification before logging in");
        return;
    }

    // INSERT INTO users table
    const { error: insertError } = await window.supabaseClient
        .from("users")
        .insert({
            id: user.id,
            email: user.email,
            name: name
            // Note: Storing plain passwords is NOT recommended in production. Use hashing instead.
        });

    if (insertError) {
        alert("User created but profile not saved");
        console.error(insertError);
        return;
    }

    alert("Signup successful!");
    window.location.href = "index.html";

});
