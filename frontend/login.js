console.log("Login.js loaded");

// Get elements
const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");

// Main login handler
loginBtn.addEventListener("click", async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
        alert("Please enter both email and password.");
        return;
    }

    try {
        const response = await fetch("http://127.0.0.1:8000/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json();
        console.log("LOGIN RESPONSE:", data);

        if (!response.ok) {
            alert("Login failed: " + (data.detail || "Invalid credentials"));
            return;
        }

        // Save important user data
        localStorage.setItem("user_id", data.user_id);
        localStorage.setItem("name", data.name);
        localStorage.setItem("email", data.email);
        localStorage.setItem("profile_image", data.profile_image || "");

        alert("Login successful!");

        // Redirect user to dashboard/home
        window.location.href = "main.html";

    } catch (err) {
        console.error("Login error:", err);
        alert("Unable to connect to server. Check if backend is running.");
    }
});
