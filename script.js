const savedTheme = localStorage.getItem('theme');
const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
document.documentElement.setAttribute('data-theme', initialTheme);

const themeToggleBtn = document.getElementById('theme-toggle-btn');
if (themeToggleBtn) {
    themeToggleBtn.innerHTML = initialTheme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    themeToggleBtn.addEventListener('click', () => {
        const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        themeToggleBtn.innerHTML = next === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    });
}

const LEGACY_REMOTE_CONFIG_KEYS = [
    'githubOwner',
    'githubRepo',
    'githubBranch',
    'githubToken',
    'apiBase',
    'apiToken',
    'teacherInvites'
];

function clearLegacyRemoteConfig() {
    try {
        LEGACY_REMOTE_CONFIG_KEYS.forEach(key => localStorage.removeItem(key));
    } catch(_) {}
}
clearLegacyRemoteConfig();

// Мобильная навигация
const hamburger = document.querySelector('.hamburger');
const navMenu = document.getElementById('primary-menu');

hamburger.addEventListener('click', () => {
    const expanded = hamburger.getAttribute('aria-expanded') === 'true';
    const next = !expanded;
    hamburger.classList.toggle('active', next);
    navMenu.classList.toggle('active', next);
    hamburger.setAttribute('aria-expanded', String(next));
    hamburger.setAttribute('aria-label', next ? 'Закрыть меню' : 'Открыть меню');
});

hamburger.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        hamburger.click();
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && hamburger.getAttribute('aria-expanded') === 'true') {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
        hamburger.setAttribute('aria-expanded', 'false');
        hamburger.setAttribute('aria-label', 'Открыть меню');
    }
});

// Закрытие мобильного меню при клике на ссылку
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
        hamburger.setAttribute('aria-expanded', 'false');
        hamburger.setAttribute('aria-label', 'Открыть меню');
    });
});

const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
        }
    });
});

// Анимация счетчиков
function animateCounters() {
    const counters = document.querySelectorAll('.stat-number');

    counters.forEach(counter => {
        const target = parseInt(counter.getAttribute('data-count'));
        const duration = 2000;
        const step = target / (duration / 16);
        let current = 0;

        const timer = setInterval(() => {
            current += step;
            if (current >= target) {
                counter.textContent = target;
                clearInterval(timer);
            } else {
                counter.textContent = Math.floor(current);
            }
        }, 16);
    });
}

// Intersection Observer для анимаций
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('animated');

            // Запуск анимации счетчиков для статистики героя
            if (entry.target.classList.contains('hero-stats')) {
                animateCounters();
            }
        }
    });
}, observerOptions);

// Наблюдение за элементами для анимации
document.addEventListener('DOMContentLoaded', () => {
    const animatedElements = document.querySelectorAll('.animate-on-scroll');
    animatedElements.forEach(el => observer.observe(el));

    const heroStats = document.querySelector('.hero-stats');
    if (heroStats) observer.observe(heroStats);

    const currentUser = JSON.parse(localStorage.getItem('user'));
    const accountLink = Array.from(document.querySelectorAll('.nav-menu .nav-link')).find(a => a.textContent.trim() === 'Личный кабинет');
    if (accountLink) {
        accountLink.href = currentUser ? 'dashboard.html' : 'login.html';
    }
    if (currentUser && location.pathname.toLowerCase().endsWith('login.html')) {
        window.location.href = 'dashboard.html';
    }

    document.querySelectorAll('.password-toggle').forEach(btn => {
        const target = document.getElementById(btn.getAttribute('data-target'));
        if (!target) return;
        btn.addEventListener('click', () => {
            const isHidden = target.getAttribute('type') === 'password';
            target.setAttribute('type', isHidden ? 'text' : 'password');
            btn.innerHTML = isHidden ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
        });
    });
});

async function sha256(str) {
    const enc = new TextEncoder().encode(str);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Эффект прокрутки навигационной панели
window.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;
    if (window.scrollY > 100) {
        navbar.style.background = 'var(--glass-bg)';
        navbar.style.backdropFilter = 'blur(20px)';
    } else {
        navbar.style.background = 'var(--glass-bg)';
    }
}, { passive: true });

// Переключение форм аутентификации
const loginTab = document.getElementById('login-tab');
const registerTab = document.getElementById('register-tab');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');

if (loginTab && registerTab) {
    loginTab.addEventListener('click', () => {
        loginTab.classList.add('active');
        registerTab.classList.remove('active');
        loginForm.classList.add('active');
        registerForm.classList.remove('active');
        const target = document.getElementById('auth-forms');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(() => {
            const el = document.getElementById('loginEmail');
            if (el) el.focus();
        }, 400);
    });

    registerTab.addEventListener('click', () => {
        registerTab.classList.add('active');
        loginTab.classList.remove('active');
        registerForm.classList.add('active');
        loginForm.classList.remove('active');
        const target = document.getElementById('auth-forms');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(() => {
            const el = document.getElementById('registerName');
            if (el) el.focus();
        }, 400);
    });
}

// Обработка формы входа
const loginFormElement = document.getElementById('loginForm');
if (loginFormElement) {
    loginFormElement.addEventListener('submit', async (e) => {
        e.preventDefault();
        const emailEl = document.getElementById('loginEmail');
        const passEl = document.getElementById('loginPassword');
        emailEl.classList.remove('input-error');
        passEl.classList.remove('input-error');
        const email = emailEl.value;
        const password = passEl.value;
        const selectedRole = document.querySelector('input[name="loginRole"]:checked')?.value || 'student';

        const users = JSON.parse(localStorage.getItem('users')) || [];
        const inputHash = await sha256(password);
        const user = users.find(u => u.email && u.password && u.email.toLowerCase() === email.toLowerCase() && u.password === inputHash);
        if (!user) {
            emailEl.classList.add('input-error');
            passEl.classList.add('input-error');
            showToast('Неверный email или пароль');
            return;
        }
        if (selectedRole !== user.role) {
            showToast('Тип аккаунта не соответствует зарегистрированному');
            return;
        }
        localStorage.setItem('user', JSON.stringify(user));
        showToast('Вход выполнен');
        setTimeout(() => window.location.href = 'dashboard.html', 500);
    });
}

// Обработка формы регистрации
const registerFormElement = document.getElementById('registerForm');
if (registerFormElement) {
    registerFormElement.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('registerConfirmPassword').value;

        if (password !== confirmPassword) {
            showToast('Пароли не совпадают');
            return;
        }

        const users = JSON.parse(localStorage.getItem('users')) || [];
        if (users.some(u => u.email && u.email.toLowerCase() === email.toLowerCase())) {
            showToast('Email уже зарегистрирован');
            return;
        }
        const role = (document.querySelector('input[name="registerRole"]:checked')?.value) || 'student';
        const passwordHash = await sha256(password);
        const user = { name, email, password: passwordHash, role };
        users.push(user);
        localStorage.setItem('users', JSON.stringify(users));
        localStorage.setItem('user', JSON.stringify(user));
        showToast('Демо-профиль сохранён только в этом браузере');
        setTimeout(() => window.location.href = 'dashboard.html', 800);
    });
}

function setFieldError(el, msg) {
    if (!el) return;
    const group = el.closest('.form-group') || el.parentElement;
    let err = group?.querySelector('.field-error');
    if (!err && group) {
        err = document.createElement('div');
        err.className = 'field-error';
        group.appendChild(err);
    }
    err.textContent = msg || '';
    el.classList.toggle('input-error', !!msg);
    if (msg) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
}

function validateEmailField(el) {
    const v = String(el.value || '').trim();
    const ok = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
    setFieldError(el, ok ? '' : 'Неверный формат email');
    return ok;
}
function validatePasswordField(el) {
    const v = String(el.value || '');
    const hasLen = v.length >= 8;
    const hasLetter = /\p{L}/u.test(v);
    const hasDigit = /\p{N}/u.test(v);
    const ok = hasLen && hasLetter && hasDigit;
    setFieldError(el, ok ? '' : 'Пароль должен содержать буквы и цифры, ≥8 символов');
    return ok;
}
function validateConfirmPasswordField(passEl, confirmEl) {
    const ok = String(passEl.value || '') === String(confirmEl.value || '');
    setFieldError(confirmEl, ok ? '' : 'Пароли не совпадают');
    return ok;
}

document.addEventListener('DOMContentLoaded', () => {
    const emailReg = document.getElementById('registerEmail');
    const passReg = document.getElementById('registerPassword');
    const confirmReg = document.getElementById('registerConfirmPassword');
    if (emailReg) { emailReg.addEventListener('input', () => validateEmailField(emailReg)); }
    if (passReg) { passReg.addEventListener('input', () => validatePasswordField(passReg)); }
    if (confirmReg && passReg) { confirmReg.addEventListener('input', () => validateConfirmPasswordField(passReg, confirmReg)); }
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js').catch(() => {});
    });
}

// Инициализация
window.addEventListener('load', () => {
    // Анимация счетчиков при загрузке
    setTimeout(animateCounters, 1000);
});

function showToast(message) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(10px)';
        setTimeout(() => container.removeChild(el), 300);
    }, 2000);
}

function downloadJSON(filename, data) {
    try {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch(_) {}
}
