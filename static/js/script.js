document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.querySelector("#login-form");
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const username = document.querySelector("#username").value;
            const password = document.querySelector("#password").value;
            try {
                const response = await fetch("/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username, password })
                });
                const data = await response.json();
                if (response.ok) {
                    localStorage.setItem("token", data.access_token);
                    window.location.href = "/chat";
                } else {
                    alert(data.detail);
                }
            } catch (error) {
                console.error("Login error:", error);
            }
        });
    }

    const registerForm = document.querySelector("#register-form");
    if (registerForm) {
        registerForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const username = document.querySelector("#reg-username").value;
            const password = document.querySelector("#reg-password").value;
            try {
                const response = await fetch("/register", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username, password })
                });
                const data = await response.json();
                if (response.ok) {
                    alert("Registration successful! Please log in.");
                    window.location.href = "/";
                } else {
                    alert(data.detail);
                }
            } catch (error) {
                console.error("Registration error:", error);
            }
        });
    }
});