btn.addEventListener("click", async (e) => {
    e.preventDefault();
    console.log("Signup button clicked");

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    const confirmPassword = document.querySelector("input[placeholder='Confirm your password']").value.trim();

    if (!name || !email || !password) {
        alert("Enter name, email, and password");
        return;
    }

    if (password !== confirmPassword) {
        alert("Passwords do not match");
        return;
    }

    const payload = { name, email, password };

    try {
        console.log("Sending request...");
        const res = await fetch("http://127.0.0.1:8000/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        console.log("Response received");

        const data = await res.json();
        console.log("Backend Response:", data);

        if (res.ok) {
            alert("Signup success: " + data.user_id);
        } else {
            alert("Error: " + data.detail);
        }

    } catch (err) {
        console.error("Request failed:", err);
        alert("Could not reach backend.");
    }
});
