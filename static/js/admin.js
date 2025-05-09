const token = localStorage.getItem('token');
if (!token) {
  alert('Please login as admin first');
  window.location.href = '/';
  throw new Error('No token found, redirecting to login');
}

// Helper function
function formatDateInput(date) {
  const pad = n => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
}

// Main DOM-dependent code
window.addEventListener('DOMContentLoaded', () => {
  // Elements
  const btnUsers = document.getElementById('btn-users');
  const btnGroups = document.getElementById('btn-groups');
  const btnOnline = document.getElementById('btn-online');

  const sectionUsers = document.getElementById('section-users');
  const sectionGroups = document.getElementById('section-groups');
  const sectionOnline = document.getElementById('section-online');
  const startInput = document.getElementById('start-date');
  const endInput = document.getElementById('end-date');

  if (!startInput || !endInput) {
    console.error('Date inputs not found in DOM');
    return;
  }

  // Tab switching function
  function showSection(section) {
    [btnUsers, btnGroups, btnOnline].forEach(b => b.classList.remove('active'));
    [sectionUsers, sectionGroups, sectionOnline].forEach(s => s.classList.remove('active'));

    if (section === 'users') {
      btnUsers.classList.add('active');
      sectionUsers.classList.add('active');
      fetchUsers();
      fetchChatCount();
    } else if (section === 'groups') {
      btnGroups.classList.add('active');
      sectionGroups.classList.add('active');
      fetchGroups();
    }  else if (section === 'online') {
        btnOnline.classList.add('active');
        sectionOnline.classList.add('active');
      
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
      
        const todayStr = formatDateInput(today);
        const yesterdayStr = formatDateInput(yesterday);
      
        startInput.value = yesterdayStr;
        endInput.value = todayStr;
      
        document.getElementById('online-count').textContent = '';
        document.querySelector('#online-users-table tbody').innerHTML = '';
        document.getElementById('online-users-table').style.display = 'none';
      
        // Уберите reset(), чтобы не сбрасывать даты
        // document.getElementById('online-form').reset();
      
        fetchOnlineUsers(yesterdayStr, todayStr);
      }
  }

  btnUsers.addEventListener('click', () => showSection('users'));
  btnGroups.addEventListener('click', () => showSection('groups'));
  btnOnline.addEventListener('click', () => showSection('online'));


  [startInput, endInput].forEach(input => {
    input.addEventListener('change', () => {
      const start = startInput.value;
      const end = endInput.value;
      if (!start || !end) return;
      if (start > end) {
        alert('Start date must be before end date');
        return;
      }
      fetchOnlineUsers(start, end);
    });
  });

  // Initialize with users tab
  showSection('users');

  // Fetch users
  async function fetchUsers() {
    const res = await fetch('/admin/users', {
      headers: { Authorization: 'Bearer ' + token }
    });
    if (!res.ok) {
      alert('Error fetching users');
      return;
    }
    const users = await res.json();
    const tbody = document.querySelector('#users-table tbody');
    tbody.innerHTML = '';
    users.forEach(user => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${user.id}</td>
      <td class="username-cell" style="cursor:pointer; text-decoration:underline;">${user.username}</td>
      <td><button class="delete-btn" data-id="${user.id}">Delete</button></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.username-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      const userId = cell.parentElement.querySelector('td:first-child').textContent;
      showUserStats(userId);
    });
  });


    tbody.querySelectorAll('button.delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete user ' + btn.dataset.id + '?')) return;
        const res = await fetch('/admin/users/' + btn.dataset.id, {
          method: 'DELETE',
          headers: { Authorization: 'Bearer ' + token }
        });
        if (res.ok) {
          alert('User deleted');
          fetchUsers();
        } else {
          alert('Failed to delete user');
        }
      });
    });
  }

  // Fetch groups
  async function fetchGroups() {
    const res = await fetch('/admin/groups', {
      headers: { Authorization: 'Bearer ' + token }
    });
    if (!res.ok) {
      alert('Error fetching groups');
      return;
    }
    const groups = await res.json();
    const tbody = document.querySelector('#groups-table tbody');
    tbody.innerHTML = '';
    groups.forEach(group => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${group.id}</td>
        <td>${group.name}</td>
        <td><button class="delete-btn" data-id="${group.id}">Delete</button></td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('button.delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete group ' + btn.dataset.id + '?')) return;
        const res = await fetch('/admin/groups/' + btn.dataset.id, {
          method: 'DELETE',
          headers: { Authorization: 'Bearer ' + token }
        });
        if (res.ok) {
          alert('Group deleted');
          fetchGroups();
        } else {
          alert('Failed to delete group');
        }
      });
    });
  }

  // Fetch online users
  async function fetchOnlineUsers(start, end) {
    const res = await fetch(`/admin/online?start=${start}&end=${end}`, {
      headers: { Authorization: 'Bearer ' + token }
    });
    if (!res.ok) {
      alert('Failed to fetch online count');
      return;
    }
    const data = await res.json();
    document.getElementById('online-count').textContent = `Users online: ${data.online_count}`;
    const onlineTable = document.getElementById('online-users-table');
    onlineTable.style.display = 'table';
    const tbody = onlineTable.querySelector('tbody');
    tbody.innerHTML = '';
    data.online_users.forEach(user => {
      const lastActiveDate = new Date(user.last_active);
      const formattedLastActive = lastActiveDate.toLocaleString();
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${user.id}</td>
        <td>${user.username}</td>
        <td>${formattedLastActive}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Fetch chat count
  async function fetchChatCount() {
    try {
      const res = await fetch('/admin/count_chats', {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (!res.ok) throw new Error('Failed to fetch chat count');
      const data = await res.json();
      document.getElementById('chat-count').textContent = `Total chats: ${data.count}`;
    } catch (e) {
      document.getElementById('chat-count').textContent = 'Error loading chat count';
      console.error(e);
    }
  }
});
async function showUserStats(userId) {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/user/${userId}/stats`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch user stats');
        const data = await res.json();

        // Создаем модальное окно (если еще нет)
        let modal = document.getElementById('user-stats-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'user-stats-modal';

            modal.innerHTML = `
            <div id="user-stats-modal">
            <button id="close-user-stats">&times;</button>
            <div class="modal-header">
              <img id="user-stats-avatar" src="" alt="Avatar">
              <h3 id="user-stats-username"></h3>
            </div>
            <div class="user-stats-info">
            <div class="info-block">
              <strong>Contacts:</strong> <span id="user-stats-contacts"></span>
            </div>
            <div class="info-block">
              <strong>Groups:</strong> <span id="user-stats-groups"></span>
            </div>
            <div class="info-block">
              <strong>Messages sent:</strong> <span id="user-stats-messages"></span>
            </div>
          </div>
            </div>
          `;

            document.body.appendChild(modal);

            document.getElementById('close-user-stats').addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }

        // Заполняем данные
        modal.querySelector('#user-stats-avatar').src = data.avatar;
        modal.querySelector('#user-stats-username').textContent = data.username;
        modal.querySelector('#user-stats-contacts').textContent = data.contacts_count;
        modal.querySelector('#user-stats-groups').textContent = data.groups_count;
        modal.querySelector('#user-stats-messages').textContent = data.messages_count;

        modal.style.display = 'block';

    } catch (e) {
        console.error(e);
        alert('Не удалось загрузить статистику пользователя');
    }
}