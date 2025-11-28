document.addEventListener("DOMContentLoaded", () => {

    const btn = document.querySelector("button.bg-primary");
    const nameInput = document.querySelector("input[placeholder='Enter your name']");
    const emailInput = document.querySelector("input[placeholder='Enter your email']");
    const passwordInput = document.querySelector("input[placeholder='Enter your password']");

    alert("inside js");

    btn.addEventListener("click", async (e) => {
        e.preventDefault();
        console.log("Signup button clicked");

        const name = nameInput.value.trim();
        const email = emailInput.value.trim();

        if (!name || !email) {
            alert("Enter name & email");
            return;
        }

        const payload = { name, email };

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
});
