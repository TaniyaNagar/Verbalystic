console.log("Signup JS file loaded successfully");
document.getElementById("signupForm").addEventListener("submit", async (e) => {
    console.log("Signup JS file loaded successfully");

    e.preventDefault();

    const form = new FormData(e.target);
    
    const name = form.get("name");
    const email = form.get("email");
    const password = form.get("password");
    const confirmPassword = form.get("confirmPassword");

    console.log("Name:", form.get("name"));
    console.log("Email:", form.get("email"));
    if (password !== confirmPassword) {
        alert("Passwords do not match.");
        return;
    }
    
    try {
        const response = await fetch("http://localhost:5000/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name,
                email,
                password
            })
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.message || "Registration failed");
            return;
        }

        alert("User registered successfully!");
        window.location.href = "login.html";

    } catch (error) {
        console.error(error);
        alert("Error connecting to server.");
    }
});
