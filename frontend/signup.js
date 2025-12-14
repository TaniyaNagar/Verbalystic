// signup.js

console.log("Signup JS loaded");

const form = document.getElementById("signupForm");

form.addEventListener("submit", async (e) => {
    e.preventDefault(); // STOP native form submit (this fixes URL issue)

    console.log("Signup form submitted");

    const name = form.elements["name"].value.trim();
    const email = form.elements["email"].value.trim().toLowerCase();
    const password = form.elements["password"].value.trim();
    const confirmPassword = form.elements["confirmPassword"].value.trim();

    // Basic validation
    if (!name || !email || !password || !confirmPassword) {
        alert("All fields are required");
        return;
    }

    if (password !== confirmPassword) {
        alert("Passwords do not match");
        return;
    }

    const payload = { name, email, password };

    try {
        console.log("Sending signup request...", payload);

        const res = await fetch("http://127.0.0.1:8000/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        console.log("Backend response:", data);

        if (!res.ok) {
            alert(data.detail || "Signup failed");
            return;
        }

        alert("Signup successful!");
        // optional redirect
        window.location.href = "main.html";

    } catch (err) {
        console.error("Signup request failed:", err);
        alert("Server unreachable");
    }
});
