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
        const updated = {
            name,
            email,
            password: newPassword,
            role: existing?.role || user.role || 'student'
        };
        if (existing) {
            const idx = users.indexOf(existing);
            users[idx] = updated;
        } else {
            users.push(updated);
        }
        localStorage.setItem('users', JSON.stringify(users));
        localStorage.setItem('user', JSON.stringify(updated));
        alert('Демо-профиль обновлён только в этом браузере');
    });
});
