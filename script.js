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

const GH_OWNER_DEFAULT = 'obnqo40';
const GH_REPO_DEFAULT = 'Moe-raspisanie';
const GH_BRANCH_DEFAULT = 'main';
const API_BASE_DEFAULT = '';
function ensureDefaultSyncConfig() {
    try {
        if (GH_OWNER_DEFAULT && !localStorage.getItem('githubOwner')) localStorage.setItem('githubOwner', GH_OWNER_DEFAULT);
        if (GH_REPO_DEFAULT && !localStorage.getItem('githubRepo')) localStorage.setItem('githubRepo', GH_REPO_DEFAULT);
        if (GH_BRANCH_DEFAULT && !localStorage.getItem('githubBranch')) localStorage.setItem('githubBranch', GH_BRANCH_DEFAULT);
        if (API_BASE_DEFAULT && !localStorage.getItem('apiBase')) localStorage.setItem('apiBase', API_BASE_DEFAULT.replace(/\/$/, ''));
    } catch(_) {}
}
ensureDefaultSyncConfig();

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
    loadUsersRemote().then(data => {
        if (!data) return;
        try {
            const local = JSON.parse(localStorage.getItem('users')) || [];
            const merged = mergeUsers(local, data);
            localStorage.setItem('users', JSON.stringify(merged));
        } catch(_) {}
    }).catch(() => {});
    
    if (currentUser && location.pathname.toLowerCase().endsWith('login.html')) {
        window.location.href = 'dashboard.html';
    }

    const roleRadios = document.querySelectorAll('input[name="registerRole"]');
    function updateTeacherCodeVisibility() {
        const g = document.getElementById('teacherCodeGroup');
        if (!g) return;
        const val = document.querySelector('input[name="registerRole"]:checked')?.value;
        g.style.display = val === 'teacher' ? 'block' : 'none';
    }
    roleRadios.forEach(r => r.addEventListener('change', updateTeacherCodeVisibility));
    updateTeacherCodeVisibility();

    const loginRoleRadios = document.querySelectorAll('input[name="loginRole"]');
    function updateLoginTeacherCodeVisibility() {
        const g = document.getElementById('loginTeacherCodeGroup');
        if (!g) return;
        const val = document.querySelector('input[name="loginRole"]:checked')?.value;
        g.style.display = val === 'teacher' ? 'block' : 'none';
    }
    loginRoleRadios.forEach(r => r.addEventListener('change', updateLoginTeacherCodeVisibility));
    updateLoginTeacherCodeVisibility();

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
    if (!crypto || !crypto.subtle) {
        // Fallback for non-secure contexts (e.g. local file without https)
        // Note: This is a very simple hash for demo purposes, not secure for production!
        // In real app, you should use HTTPS or a JS library for SHA-256
        let hash = 0;
        if (str.length === 0) return 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16).padStart(64, '0');
    }
    const enc = new TextEncoder().encode(str);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function getTeacherInvites() {
    try { return JSON.parse(localStorage.getItem('teacherInvites')) || []; } catch(_) { return []; }
}
function saveTeacherInvites(list) {
    localStorage.setItem('teacherInvites', JSON.stringify(list));
}
function addTeacherInvite(code) {
    const list = getTeacherInvites();
    const c = String(code || '').trim();
    if (!c) return false;
    const exists = list.some(x => String(x || '').trim().toUpperCase() === c.toUpperCase());
    if (!exists) { list.push(c); saveTeacherInvites(list); return true; }
    return false;
}
function consumeTeacherInvite(code) {
    const list = getTeacherInvites();
    const target = normalizeTeacherCode(code);
    const idx = list.findIndex(x => normalizeTeacherCode(x) === target);
    if (idx >= 0) { list.splice(idx, 1); saveTeacherInvites(list); return true; }
    return false;
}
const MASTER_TEACHER_CODE_HASH = '';

function normalizeTeacherCode(s) {
    const raw = String(s || '');
    const stripped = raw.replace(/[^\p{L}\p{N}]+/gu, '');
    const map = {
        'А':'A','В':'B','Е':'E','К':'K','М':'M','Н':'H','О':'O','Р':'P','С':'S','Т':'T','У':'Y','Х':'X',
        'а':'A','в':'B','е':'E','к':'K','м':'M','н':'H','о':'O','р':'P','с':'S','т':'T','у':'Y','х':'X',
        'Ш':'W','ш':'W','І':'I','і':'I'
    };
    let out = '';
    for (const ch of stripped) out += (map[ch] || ch);
    return out.toUpperCase();
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
        const codeEl = document.getElementById('loginTeacherCode');
        emailEl.classList.remove('input-error');
        passEl.classList.remove('input-error');
        if (codeEl) codeEl.classList.remove('input-error');
        const email = emailEl.value;
        const password = passEl.value;
        const selectedRole = document.querySelector('input[name="loginRole"]:checked')?.value || 'student';

        let users = JSON.parse(localStorage.getItem('users')) || [];
        try {
            const remote = await loadUsersRemote();
            if (remote) {
                users = mergeUsers(users, remote);
                localStorage.setItem('users', JSON.stringify(users));
            }
        } catch(_) {}
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
        ensureDefaultSyncConfig();
        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('registerConfirmPassword').value;

        if (password !== confirmPassword) {
            showToast('Пароли не совпадают');
            return;
        }

        let users = JSON.parse(localStorage.getItem('users')) || [];
        try {
            const remote = await loadUsersRemote();
            if (remote) {
                users = mergeUsers(users, remote);
            }
        } catch(_) {}
        if (users.some(u => u.email && u.email.toLowerCase() === email.toLowerCase())) {
            showToast('Email уже зарегистрирован');
            return;
        }
        const role = (document.querySelector('input[name="registerRole"]:checked')?.value) || 'student';
        if (role === 'teacher') {
            const codeEl = document.getElementById('registerTeacherCode');
            codeEl.classList.remove('input-error');
            const code = (codeEl.value || '').trim();
            
            // Проверка кода учителя через хеш
            const codeHash = await sha256(code);
            if (codeHash !== MASTER_TEACHER_CODE_HASH) {
                codeEl.classList.add('input-error');
                showToast('Неверный код учителя. Введите правильный пароль');
                return;
            }
        }
        const passwordHash = await sha256(password);
        const user = { name, email, password: passwordHash, role };
        users.push(user);
        localStorage.setItem('users', JSON.stringify(users));
        localStorage.setItem('user', JSON.stringify(user));
        const saved = await syncUsersToServer(users);
        if (!saved) {
            showToast('Регистрация локально. Синхронизация с сервером не выполнена');
        } else {
            showToast('Регистрация выполнена');
        }
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

 

function getApiBase() {
    try { return (localStorage.getItem('apiBase') || '').replace(/\/$/, ''); } catch(_) { return ''; }
}
function getApiToken() {
}
function apiHeaders(withJson) {
    const h = {};
    if (withJson) h['Content-Type'] = 'application/json';
    const t = getApiToken();
    return h;
}

function getGithubConfig() {
    const owner = localStorage.getItem('githubOwner') || '';
    const repo = localStorage.getItem('githubRepo') || '';
    const branch = localStorage.getItem('githubBranch') || 'main';
    return { owner, repo, branch, token };
}
function isGithubConfigured() {
    const c = getGithubConfig();
    return !!(c.owner && c.repo);
}
function isGithubReadConfigured() {
    return isGithubConfigured();
}
function isGithubWriteConfigured() {
    const c = getGithubConfig();
    return !!(c.owner && c.repo && c.token);
}
function ghApiHeaders(token) {
    const h = { 'Accept': 'application/vnd.github+json' };
    h['Content-Type'] = 'application/json';
    return h;
}
function toBase64(str) {
    try { return btoa(unescape(encodeURIComponent(str))); } catch(_) { return btoa(str); }
}
function fromBase64(b64) {
    try { return decodeURIComponent(escape(atob(b64))); } catch(_) { return atob(b64); }
}
async function fetchGithubFile(path) {
    const { owner, repo, branch, token } = getGithubConfig();
    if (!owner || !repo) return null;
    try {
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/${path}`;
        if (r.ok) {
            const txt = await r.text();
            try { return JSON.parse(txt); } catch(_) { return txt; }
        }
    } catch(_) {}
    try {
        const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`;
        const r = await fetch(url, { headers: ghApiHeaders(token) });
        if (!r.ok) return null;
        const data = await r.json();
        if (data && data.content) {
            const decoded = fromBase64(data.content);
            try { return JSON.parse(decoded); } catch(_) { return decoded; }
        }
    } catch(_) {}
    return null;
}
async function getGithubFileSha(path) {
    const { owner, repo, branch, token } = getGithubConfig();
    if (!owner || !repo) return '';
    try {
        const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`;
        const r = await fetch(url, { headers: ghApiHeaders(token) });
        if (!r.ok) return '';
        const data = await r.json();
        return data && data.sha ? data.sha : '';
    } catch(_) { return ''; }
}
async function putGithubFile(path, text, message) {
    const { owner, repo, branch, token } = getGithubConfig();
    if (!owner || !repo || !token) return false;
    const sha = await getGithubFileSha(path);
    const body = { message: message || `Update ${path}`, content: toBase64(text), branch };
    if (sha) body.sha = sha;
    try {
        const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
        const r = await fetch(url, { method: 'PUT', headers: ghApiHeaders(token), body: JSON.stringify(body) });
        return r.ok;
    } catch(_) { return false; }
}
async function syncUsersToGithub(users) {
    const text = JSON.stringify(users || [], null, 2);
    return await putGithubFile('users.json', text, 'Update users.json');
}
async function syncScheduleToGithub(schedule) {
    const text = JSON.stringify(schedule || {}, null, 2);
    return await putGithubFile('schedule.json', text, 'Update schedule.json');
}

function mergeUsers(localArr, remoteArr) {
    const map = new Map();
    (remoteArr || []).forEach(u => { const k = String(u.email || '').toLowerCase(); if (k) map.set(k, u); });
    (localArr || []).forEach(u => { const k = String(u.email || '').toLowerCase(); if (k && !map.has(k)) map.set(k, u); });
    return Array.from(map.values());
}

async function syncUsersToServer(users) {
    // Если запущен локально (file://), пропускаем синхронизацию
    if (window.location.protocol === 'file:') return false;

    try {
        if (typeof isGithubWriteConfigured === 'function' && isGithubWriteConfigured()) {
            const ok = await (typeof syncUsersToGithub === 'function' ? syncUsersToGithub(users) : false);
            if (ok) return true;
        }
    } catch(_) {}
    try {
        const base = (typeof getApiBase === 'function' ? getApiBase() : '') || '';
        const url = (base || '').replace(/\/$/, '');
        if (url) {
            const headers = typeof apiHeaders === 'function' ? apiHeaders(true) : { 'Content-Type': 'application/json' };
            const r = await fetch(`${url}/users`, { method: 'POST', headers, body: JSON.stringify(users) });
            if (r.ok) return true;
        }
    } catch(_) {}
    return false;
}

async function loadUsersRemote() {
    try {
        if (typeof isGithubReadConfigured === 'function' && isGithubReadConfigured() && typeof fetchGithubFile === 'function') {
            const gh = await fetchGithubFile('users.json');
            if (gh) return gh;
        }
    } catch(_) {}
    try {
        const base = (typeof getApiBase === 'function' ? getApiBase() : '') || '';
        const url = (base || '').replace(/\/$/, '');
        if (url) {
            const headers = typeof apiHeaders === 'function' ? apiHeaders(false) : {};
            const r2 = await fetch(`${url}/users.json`, { headers });
            if (r2.ok) return await r2.json();
        }
    } catch(_) {}
    try {
        const r = await fetch('users.json');
        return r.ok ? await r.json() : null;
    } catch(_) { return null; }
}

