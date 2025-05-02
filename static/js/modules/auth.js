export function getToken() {
    return localStorage.getItem("token");
}

export function setToken(token) {
    localStorage.setItem("token", token);
}

export function removeToken() {
    localStorage.removeItem("token");
}

export function ensureAuthenticated() {
    const token = getToken();
    if (!token) {
        console.log("No token found, redirecting to login");
        window.location.href = "/";
        return null;
    }
    return token;
}

export function getAuthHeaders() {
    const token = getToken();
    return { "Authorization": `Bearer ${token}` };
}

export function getCurrentUserId() {
    const token = getToken();
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return parseInt(payload.user_id, 10);
    } catch {
        return null;
    }
}