console.log("Login.js loaded");

// Select form inputs
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");

loginBtn.addEventListener("click", async (event) => {
    event.preventDefault(); // prevent form reload

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
        alert("Please enter email and password");
        return;
    }

    try {
        const response = await fetch("http://127.0.0.1:8000/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        console.log("LOGIN RESPONSE:", data);

        if (!response.ok) {
            alert("Login failed: " + data.detail);
            return;
        }

        // Save user_id in localStorage for use in all pages
        localStorage.setItem("user_id", data.user_id);

        alert("Login successful!");

        // Redirect to main page
        window.location.href = "main.html";

    } catch (error) {
        console.error("Login error:", error);
        alert("Something went wrong.");
    }
});
