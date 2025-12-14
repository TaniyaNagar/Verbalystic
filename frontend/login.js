console.log("Login.js loaded");

const form = document.getElementById("loginForm");

form.addEventListener("submit", async (e) => {
    e.preventDefault(); // stop native form submit

    const email = form.elements["email"].value.trim().toLowerCase();
    const password = form.elements["password"].value.trim();

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
            alert(data.detail || "Invalid credentials");
            return;
        }

        localStorage.setItem("user_id", data.user_id);
        localStorage.setItem("name", data.name);
        localStorage.setItem("email", data.email);
        localStorage.setItem("profile_image", data.profile_image || "");

        alert("Login successful!");
        window.location.href = "main.html";

    } catch (err) {
        console.error("Login error:", err);
        alert("Backend not reachable.");
    }
});
