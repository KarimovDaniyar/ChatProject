document.getElementById('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();
  
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
  
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: email, password })
    });
  
    const data = await res.json();
  
    if (data.success) {
      window.location.href = '/main'; // или куда ты хочешь перекинуть
    } else {
      alert(data.message || 'Неверный логин или пароль');
    }
  });
  