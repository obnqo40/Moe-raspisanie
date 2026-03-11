document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    document.getElementById('profile-name').value = user.name || '';
    document.getElementById('profile-email').value = user.email || '';

    document.getElementById('logout').addEventListener('click', () => {
        localStorage.removeItem('user');
        window.location.href = 'index.html';
    });

    const ghCard = document.getElementById('github-config-card');
    if (ghCard) ghCard.style.display = (user.role === 'teacher') ? 'block' : 'none';
    const apiCard = document.getElementById('api-config-card');
    if (apiCard) apiCard.style.display = (user.role === 'teacher') ? 'block' : 'none';
    const inviteCard = document.getElementById('invite-config-card');
    if (inviteCard) inviteCard.style.display = (user.role === 'teacher') ? 'block' : 'none';
    const ghOwner = document.getElementById('gh-owner');
    const ghRepo = document.getElementById('gh-repo');
    const ghBranch = document.getElementById('gh-branch');
    if (ghOwner) ghOwner.value = localStorage.getItem('githubOwner') || '';
    if (ghRepo) ghRepo.value = localStorage.getItem('githubRepo') || '';
    if (ghBranch) ghBranch.value = localStorage.getItem('githubBranch') || 'main';
    const ghForm = document.getElementById('github-config-form');
    if (ghForm) {
        ghForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (ghOwner) localStorage.setItem('githubOwner', ghOwner.value.trim());
            if (ghRepo) localStorage.setItem('githubRepo', ghRepo.value.trim());
            if (ghBranch) localStorage.setItem('githubBranch', ghBranch.value.trim() || 'main');
            alert('Настройки GitHub сохранены');
        });
    }
    const apiInput = document.getElementById('api-base');
    if (apiInput) apiInput.value = localStorage.getItem('apiBase') || '';
    const apiForm = document.getElementById('api-config-form');
    if (apiForm) {
        apiForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const v = apiInput ? apiInput.value.trim().replace(/\/$/, '') : '';
            if (v) localStorage.setItem('apiBase', v);
            alert('Настройки API сохранены');
        });
    }
    const apiTest = document.getElementById('api-test');
    if (apiTest) {
        apiTest.addEventListener('click', async () => {
            const base = typeof getApiBase === 'function' ? getApiBase() : (localStorage.getItem('apiBase') || '');
            if (!base) { alert('Введите адрес API'); return; }
            try {
                const headers = typeof apiHeaders === 'function' ? apiHeaders(false) : {};
                const r = await fetch(`${base}/users.json`, { headers });
                alert(r.ok ? 'Соединение установлено' : 'Не удалось подключиться');
            } catch (_) {
                alert('Ошибка соединения');
            }
        });
    }

    function renderInvites() {
        const body = document.getElementById('invite-list');
        if (!body) return;
        const list = (typeof getTeacherInvites === 'function') ? getTeacherInvites() : [];
        body.innerHTML = '';
        list.forEach(code => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${code}</td>`;
            body.appendChild(tr);
        });
    }

    const inviteForm = document.getElementById('invite-form');
    if (inviteForm) {
        inviteForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const input = document.getElementById('invite-code');
            const code = (input?.value || '').trim();
            if (!code) return;
            
            if (typeof addTeacherInvite === 'function') {
                if (addTeacherInvite(code)) {
                    alert('Код добавлен');
                } else {
                    alert('Код уже существует или некорректен');
                }
            }
            
            if (input) input.value = '';
            renderInvites();
        });
    }
    renderInvites();

    document.getElementById('profile-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('profile-name').value.trim();
        const email = document.getElementById('profile-email').value.trim();
        const password = document.getElementById('profile-password').value;
        const confirm = document.getElementById('profile-password-confirm').value;

        if (!name || !email) {
            alert('Заполните имя и email');
            return;
        }

        if ((password || confirm) && password !== confirm) {
            alert('Пароли не совпадают');
            return;
        }

        const users = JSON.parse(localStorage.getItem('users')) || [];
        const oldEmail = user.email || '';
        const existing = users.find(u => u.email && u.email.toLowerCase() === oldEmail.toLowerCase());
        const conflict = users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase() && u.email.toLowerCase() !== oldEmail.toLowerCase());
        if (conflict) {
            alert('Такой email уже зарегистрирован');
            return;
        }

        let newPassword;
        if (password) {
            if (typeof sha256 === 'function') {
                newPassword = await sha256(password);
            } else {
                alert('Ошибка: функция шифрования недоступна');
                return;
            }
        } else {
            newPassword = existing ? existing.password : user.password;
        }
        const updated = { name, email, password: newPassword, role: user.role };
        if (existing) {
            const idx = users.indexOf(existing);
            users[idx] = updated;
        } else {
            users.push(updated);
        }
        localStorage.setItem('users', JSON.stringify(users));
        if (typeof syncUsersToServer === 'function') {
            syncUsersToServer(users).then((ok) => {
                if (!ok) {
                    alert('Изменения сохранены локально. Синхронизация с сервером не выполнена.');
                }
            }).catch(() => {});
        }

        localStorage.setItem('user', JSON.stringify(updated));
        alert('Профиль обновлён');
    });
});
