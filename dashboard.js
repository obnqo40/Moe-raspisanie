// Проверка авторизации
let currentUser;
let currentFilter = { text: '', class: 'all' };
let db;
let scheduleCache = {};
function isTeacher() { return (currentUser?.role === 'teacher'); }

function initDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('moe_raspisanie', 1);
        req.onupgradeneeded = () => {
            const d = req.result;
            if (!d.objectStoreNames.contains('teachers')) {
                const s = d.createObjectStore('teachers', { keyPath: 'key' });
                s.createIndex('fullName', 'fullName', { unique: false });
                s.createIndex('subject', 'subject', { unique: false });
                s.createIndex('room', 'room', { unique: false });
                s.createIndex('name_subject_room', 'key', { unique: true });
            }
            if (!d.objectStoreNames.contains('schedules')) {
                const s2 = d.createObjectStore('schedules', { keyPath: 'id' });
                s2.createIndex('user', 'user', { unique: false });
                s2.createIndex('day', 'day', { unique: false });
                s2.createIndex('class', 'class', { unique: false });
            }
        };
        req.onsuccess = () => { db = req.result; resolve(db); };
        req.onerror = () => reject(req.error);
    });
}

function ensureDB() { return db ? Promise.resolve(db) : initDB(); }
function normalize(s) { return String(s || '').trim(); }
function makeTeacherKey(fullName, subject, room) { return [normalize(fullName).toLowerCase(), normalize(subject).toLowerCase(), normalize(room).toLowerCase()].join('|'); }
async function loadScheduleCacheFromDB() {
    const d = await ensureDB();
    const tx = d.transaction('schedules', 'readonly');
    const store = tx.objectStore('schedules');
    return new Promise((res) => {
        const out = { monday: [], tuesday: [], wednesday: [], thursday: [], friday: [] };
        const idx = store.index('user');
        const rq = idx.openCursor(IDBKeyRange.only('global'));
        rq.onsuccess = () => {
            const c = rq.result;
            if (c) {
                const v = c.value;
                if (out[v.day]) {
                    out[v.day].push({ id: v.id, time: v.time || '', subject: v.subject || '', teacher: v.teacher || '', class: v.class || '', room: v.room || '' });
                }
                c.continue();
            } else {
                Object.keys(out).forEach(k => { out[k] = out[k].sort((a,b) => (a.time||'').localeCompare(b.time||'')); });
                scheduleCache = out;
                res(out);
            }
        };
    });
}
async function upsertTeacher(fullName, subject, room) {
    const d = await ensureDB();
    const key = makeTeacherKey(fullName, subject, room);
    const tx = d.transaction('teachers', 'readwrite');
    const store = tx.objectStore('teachers');
    await new Promise((res, rej) => { const r = store.put({ key, fullName: normalize(fullName), subject: normalize(subject), room: normalize(room) }); r.onsuccess = () => res(); r.onerror = () => rej(r.error); });
}
async function listTeachers() {
    const d = await ensureDB();
    const tx = d.transaction('teachers', 'readonly');
    const store = tx.objectStore('teachers');
    return new Promise((res) => {
        const out = [];
        const rq = store.openCursor();
        rq.onsuccess = () => {
            const c = rq.result;
            if (c) { out.push(c.value); c.continue(); } else { res(out); }
        };
    });
}
async function deleteTeacher(key) {
    const d = await ensureDB();
    const tx = d.transaction('teachers', 'readwrite');
    const store = tx.objectStore('teachers');
    await new Promise((res, rej) => { const r = store.delete(key); r.onsuccess = () => res(); r.onerror = () => rej(r.error); });
}
async function deleteTeacherByFullName(fullName) {
    const d = await ensureDB();
    const tx = d.transaction('teachers', 'readwrite');
    const store = tx.objectStore('teachers');
    const idx = store.index('fullName');
    const target = normalize(fullName);
    await new Promise((res) => {
        const rq = idx.openCursor(IDBKeyRange.only(target));
        rq.onsuccess = () => {
            const c = rq.result;
            if (c) { c.delete(); c.continue(); } else { res(); }
        };
    });
}
function renderCatalog() {
    listTeachers().then(list => {
        const body = document.getElementById('catalog-body');
        if (!body) return;
        body.replaceChildren();
        const map = new Map();
        list.forEach(t => {
            const key = normalize(t.fullName).toLowerCase();
            if (!key) return;
            let entry = map.get(key);
            if (!entry) {
                entry = { fullName: t.fullName, subjects: new Set(), rooms: new Set() };
                map.set(key, entry);
            }
            if (t.subject) entry.subjects.add(t.subject);
            if (t.room) entry.rooms.add(t.room);
        });
        Array.from(map.values()).sort((a,b) => a.fullName.localeCompare(b.fullName)).forEach(item => {
            const tr = document.createElement('tr');
            const subjects = Array.from(item.subjects).join(', ');
            const rooms = Array.from(item.rooms).join(', ');
            const firstSubject = Array.from(item.subjects)[0] || '';
            const firstRoom = Array.from(item.rooms)[0] || '';

            [item.fullName, subjects, rooms].forEach(value => {
                const td = document.createElement('td');
                td.textContent = value;
                tr.appendChild(td);
            });

            const actions = document.createElement('td');
            actions.style.display = 'flex';
            actions.style.gap = '8px';

            const deleteButton = document.createElement('button');
            deleteButton.type = 'button';
            deleteButton.className = 'delete-lesson';
            deleteButton.title = 'Удалить';
            const trashIcon = document.createElement('i');
            trashIcon.className = 'fas fa-trash';
            deleteButton.appendChild(trashIcon);
            deleteButton.addEventListener('click', async () => {
                await deleteTeacherByFullName(item.fullName);
                renderCatalog();
            });

            const editButton = document.createElement('button');
            editButton.type = 'button';
            editButton.className = 'delete-lesson';
            editButton.title = 'Изменить';
            const editIcon = document.createElement('i');
            editIcon.className = 'fas fa-pen';
            editButton.appendChild(editIcon);
            editButton.addEventListener('click', () => {
                startEditCatalog(item.fullName, firstSubject, firstRoom);
            });

            actions.append(deleteButton, editButton);
            tr.appendChild(actions);
            body.appendChild(tr);
        });
    });
}
function saveCatalogEntry(e) {
    e.preventDefault();
    const fullName = document.getElementById('teacher-fullname').value;
    const subject = document.getElementById('teacher-subject').value;
    const room = document.getElementById('teacher-room').value;
    const key = document.getElementById('teacher-key')?.value || '';
    const proceed = async () => {
        await upsertTeacher(fullName, subject, room);
        renderCatalog();
        showToast('Сохранено в справочник');
        const k = document.getElementById('teacher-key'); if (k) k.value = '';
    };
    if (key && key.trim() && key.trim().toLowerCase() !== fullName.trim().toLowerCase()) {
        deleteTeacherByFullName(key).then(proceed);
    } else if (key && key.trim()) {
        deleteTeacherByFullName(key).then(proceed);
    } else {
        proceed();
    }
    e.target.reset();
}

function populateFormSuggestions() {
    listTeachers().then(list => {
        const tList = document.getElementById('teacher-list');
        const sList = document.getElementById('subject-list');
        const rList = document.getElementById('room-list');
        if (!tList || !sList || !rList) return;
        tList.replaceChildren();
        sList.replaceChildren();
        rList.replaceChildren();
        const subjects = new Set();
        const rooms = new Set();
        const names = new Set();
        list.forEach(t => {
            const n = normalize(t.fullName);
            if (n && !names.has(n.toLowerCase())) {
                const opt = document.createElement('option');
                opt.value = n;
                tList.appendChild(opt);
                names.add(n.toLowerCase());
            }
            if (t.subject) subjects.add(t.subject);
            if (t.room) rooms.add(t.room);
        });
        Array.from(subjects).sort().forEach(sub => { const o = document.createElement('option'); o.value = sub; sList.appendChild(o); });
        Array.from(rooms).sort().forEach(r => { const o = document.createElement('option'); o.value = r; rList.appendChild(o); });
    });
}

async function autofillFromTeacher() {
    const name = (document.getElementById('lesson-teacher')?.value || '').trim();
    if (!name) return;
    const list = await listTeachers();
    const match = list.find(t => t.fullName.toLowerCase() === name.toLowerCase());
    if (match) {
        const subjEl = document.getElementById('lesson-subject');
        const roomEl = document.getElementById('lesson-room');
        if (subjEl && !subjEl.value) subjEl.value = match.subject || '';
        if (roomEl && !roomEl.value) roomEl.value = match.room || '';
    }
}
async function putScheduleRecord(lesson, day) {
    const d = await ensureDB();
    const tx = d.transaction('schedules', 'readwrite');
    const store = tx.objectStore('schedules');
    const rec = { id: lesson.id, user: 'global', day, time: lesson.time || '', subject: lesson.subject || '', teacher: lesson.teacher || '', class: lesson.class || '', room: lesson.room || '' };
    await new Promise((res, rej) => { const r = store.put(rec); r.onsuccess = () => res(); r.onerror = () => rej(r.error); });
}
async function deleteScheduleRecord(id) {
    const d = await ensureDB();
    const tx = d.transaction('schedules', 'readwrite');
    const store = tx.objectStore('schedules');
    await new Promise((res, rej) => { const r = store.delete(id); r.onsuccess = () => res(); r.onerror = () => rej(r.error); });
}
async function clearUserScheduleRecords() {
    const d = await ensureDB();
    const tx = d.transaction('schedules', 'readwrite');
    const store = tx.objectStore('schedules');
    const idx = store.index('user');
    const user = 'global';
    await new Promise((res) => { const rq = idx.openCursor(IDBKeyRange.only(user)); rq.onsuccess = () => { const cursor = rq.result; if (cursor) { cursor.delete(); cursor.continue(); } else { res(); } }; });
}
async function syncScheduleToDB(schedule) {
    await clearUserScheduleRecords();
    const allowedDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    for (const day of allowedDays) {
        const list = (schedule[day] || []);
        for (const l of list) {
            await upsertTeacher(l.teacher || '', l.subject || '', l.room || '');
            await putScheduleRecord(l, day);
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    currentUser = user;
    try {
        await initDB();
        await loadScheduleCacheFromDB();
    } catch (e) {
        console.error('Ошибка инициализации базы данных:', e);
        showToast('Ошибка: локальная база данных недоступна. Некоторые функции могут не работать.');
    }

    document.getElementById('user-name').textContent = user.name;
    loadSchedule();

    document.getElementById('logout').addEventListener('click', logout);
    document.getElementById('add-lesson').addEventListener('click', showLessonModal);
    document.querySelector('.lesson-close').addEventListener('click', hideLessonModal);
    document.getElementById('lesson-form').addEventListener('submit', saveLesson);
    document.getElementById('rearrange-open').addEventListener('click', showRearrangeModal);
    document.querySelector('.rearrange-close').addEventListener('click', hideRearrangeModal);
    document.getElementById('apply-rearrange').addEventListener('click', applyRearrange);

    document.getElementById('print-schedule').addEventListener('click', () => window.print());
    document.getElementById('clear-schedule').addEventListener('click', clearSchedule);
    
    const filterText = document.getElementById('filter-text');
if (filterText) filterText.addEventListener('input', (e) => { currentFilter.text = e.target.value.trim().toLowerCase(); loadSchedule(); });
    const filterClass = document.getElementById('filter-class');
    if (filterClass) filterClass.addEventListener('change', (e) => { currentFilter.class = e.target.value; loadSchedule(); });

    document.getElementById('export-excel').addEventListener('click', exportScheduleExcel);
const importExcelBtn = document.getElementById('import-excel');
const importExcelFile = document.getElementById('import-excel-file');
importExcelBtn.addEventListener('click', () => importExcelFile.click());
importExcelFile.addEventListener('change', handleImportExcelFile);
    const autoBtn = document.getElementById('auto-generate');
    if (autoBtn) autoBtn.addEventListener('click', autoGenerateSchedule);
    const subBtn = document.getElementById('subscribe-notifications');
    if (subBtn) subBtn.addEventListener('click', requestNotifications);

    populateFormSuggestions();
    const lt = document.getElementById('lesson-teacher');
    if (lt) { lt.addEventListener('change', autofillFromTeacher); lt.addEventListener('blur', autofillFromTeacher); }

    const openCatalog = document.getElementById('open-catalog');
    const catalogModal = document.getElementById('catalog-modal');
    const catalogClose = document.querySelector('.catalog-close');
    const catalogForm = document.getElementById('catalog-form');
    if (openCatalog) openCatalog.addEventListener('click', () => { catalogModal.style.display = 'flex'; document.body.style.overflow = 'hidden'; renderCatalog(); });
    if (catalogClose) catalogClose.addEventListener('click', () => { catalogModal.style.display = 'none'; document.body.style.overflow = 'auto'; });
    if (catalogForm) catalogForm.addEventListener('submit', saveCatalogEntry);

    const role = currentUser?.role || 'student';
    if (role !== 'teacher') {
        ['rearrange-open','open-catalog','add-lesson','clear-schedule','export-excel','import-excel','auto-generate'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    }

    window.addEventListener('click', (e) => {
        const modal = document.getElementById('lesson-modal');
        if (e.target === modal) hideLessonModal();
        const rearrangeModal = document.getElementById('rearrange-modal');
        if (e.target === rearrangeModal) hideRearrangeModal();
        const catalogModal = document.getElementById('catalog-modal');
        if (e.target === catalogModal) { catalogModal.style.display = 'none'; document.body.style.overflow = 'auto'; }
    });
});

function getSchedule() {
    return scheduleCache || {};
}

function setSchedule(schedule) {
    scheduleCache = schedule || {};
    syncScheduleToDB(scheduleCache);
    tryNotifyScheduleChanged(scheduleCache);
}

// Выход из аккаунта
function logout() {
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}

// Показать модальное окно для добавления урока
function showLessonModal() {
    if (!isTeacher()) { showToast('Выберите демо-роль «Учитель» для этой функции'); return; }
    document.getElementById('lesson-modal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    populateFormSuggestions();
}

// Скрыть модальное окно
function hideLessonModal() {
    document.getElementById('lesson-modal').style.display = 'none';
    document.body.style.overflow = 'auto';
    document.getElementById('lesson-form').reset();
    document.getElementById('lesson-id').value = '';
    document.getElementById('lesson-original-day').value = '';
}

// Сохранить урок
function saveLesson(e) {
    e.preventDefault();
    if (!isTeacher()) { showToast('Выберите демо-роль «Учитель» для этой функции'); return; }

    const subject = document.getElementById('lesson-subject').value;
    const teacher = document.getElementById('lesson-teacher').value;
    const cls = document.getElementById('lesson-class').value;
    const day = document.getElementById('lesson-day').value;
    const time = document.getElementById('lesson-time').value;
    const room = document.getElementById('lesson-room').value;
    const idField = document.getElementById('lesson-id').value;
    const originalDayField = document.getElementById('lesson-original-day').value;

    const lesson = {
        id: idField ? Number(idField) : Date.now(),
        subject,
        teacher,
        class: cls,
        time,
        room
    };

    const schedule = getSchedule();
    const conflictMsg = hasConflict(day, lesson, idField ? Number(idField) : null);
    if (conflictMsg) {
        showToast(`Конфликт: ${conflictMsg}`);
        return;
    }
    if (idField) {
        const oldDay = originalDayField || day;
        schedule[oldDay] = (schedule[oldDay] || []).filter(l => l.id !== Number(idField));
        if (!schedule[day]) schedule[day] = [];
        schedule[day].push(lesson);
        setSchedule(schedule);
        upsertTeacher(teacher, subject, room);
        putScheduleRecord(lesson, day);
        loadSchedule();
        hideLessonModal();
        showToast('Урок обновлён');
        return;
    }
    if (!schedule[day]) schedule[day] = [];
    schedule[day].push(lesson);
    setSchedule(schedule);
    upsertTeacher(teacher, subject, room);
    putScheduleRecord(lesson, day);

    // Обновить отображение
    loadSchedule();
    hideLessonModal();
    showToast('Урок добавлен');
}

// Загрузить расписание
function loadSchedule() {
    const schedule = getSchedule();
    const allowedDays = ['monday','tuesday','wednesday','thursday','friday'];

    // Очистить все дни
    document.querySelectorAll('.lessons-list').forEach(list => {
        list.replaceChildren();
    });

    

    // Загрузить уроки для каждого дня
    allowedDays.forEach(day => {
        let lessons = (schedule[day] || []).slice().sort((a, b) => (a.time || '').localeCompare(b.time || ''));
        if (currentFilter.text) {
            const t = currentFilter.text;
            lessons = lessons.filter(l => (
                (l.subject || '').toLowerCase().includes(t) ||
                (l.teacher || '').toLowerCase().includes(t) ||
                (l.class || '').toLowerCase().includes(t) ||
                (l.room || '').toLowerCase().includes(t)
            ));
        }
        if (currentFilter.class && currentFilter.class !== 'all') {
            lessons = lessons.filter(l => {
                const lc = String(l.class || '').toLowerCase();
                const fc = String(currentFilter.class).toLowerCase();
                return lc === fc || lc.startsWith(fc);
            });
        }
        lessons = groupLessonsForDisplay(lessons);
        const dayElement = document.getElementById(`${day}-lessons`);
        const dayNames = { monday: 'Понедельник', tuesday: 'Вторник', wednesday: 'Среда', thursday: 'Четверг', friday: 'Пятница' };
        const h = dayElement?.parentElement?.querySelector('h3');
        if (h) {
            h.textContent = dayNames[day] || '';
        }
        lessons.forEach(lesson => {
            const lessonElement = createLessonElement(lesson, day);
            dayElement.appendChild(lessonElement);
        });
    });
}

function groupLessonsForDisplay(list) {
    const map = new Map();
    const join = (a, b) => {
        const set = new Set();
        String(a || '').split('/').map(s => s.trim()).filter(Boolean).forEach(x => set.add(x));
        String(b || '').split('/').map(s => s.trim()).filter(Boolean).forEach(x => set.add(x));
        return Array.from(set).join(' / ');
    };
    const normGrade = (cls) => {
        const m = String(cls || '').trim().match(/^(\d{1,2})/);
        return m ? m[1] : String(cls || '').trim().toLowerCase();
    };
    const normSubject = (s) => normalizeSubjectName(String(s || '').trim()).toLowerCase();
    list.forEach(l => {
        const timeKey = String(l.time || '').trim();
        const gradeKey = normGrade(l.class);
        const subjKey = normSubject(l.subject);
        const key = [timeKey, gradeKey, subjKey].join('|');
        if (!map.has(key)) {
            const base = Object.assign({}, l);
            base._combined = false;
            map.set(key, base);
        } else {
            const m = map.get(key);
            m.class = join(m.class, l.class);
            m.room = join(m.room, l.room);
            m.subject = join(m.subject, l.subject);
            m.teacher = join(m.teacher, l.teacher);
            m._combined = true;
        }
    });
    const arr = Array.from(map.values());
    arr.sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
    return arr;
}

function appendIconAndText(element, iconClass, value) {
    const icon = document.createElement('i');
    icon.className = iconClass;
    element.append(icon, document.createTextNode(String(value ?? '')));
}

function createLessonTag(className, iconClass, value) {
    const tag = document.createElement('span');
    tag.className = className;
    appendIconAndText(tag, iconClass, value);
    return tag;
}

// Создать элемент урока без интерполяции импортированных данных в HTML.
function createLessonElement(lesson, day) {
    const div = document.createElement('div');
    div.className = 'lesson-item';

    const info = document.createElement('div');
    info.className = 'lesson-info';

    const header = document.createElement('div');
    header.className = 'lesson-header';
    const subject = document.createElement('h4');
    subject.textContent = String(lesson.subject ?? '');
    const time = document.createElement('span');
    time.className = 'time-badge';
    time.title = BELL_TIMES[String(lesson.time ?? '').trim()] || '';
    appendIconAndText(time, 'fas fa-clock', lesson.time);
    header.append(subject, time);

    const meta = document.createElement('div');
    meta.className = 'lesson-meta';
    if (lesson.teacher) {
        meta.appendChild(createLessonTag('meta-item', 'fas fa-chalkboard-teacher', lesson.teacher));
    }
    if (lesson.room) {
        meta.appendChild(createLessonTag('meta-item', 'fas fa-door-open', lesson.room));
    }

    const chips = document.createElement('div');
    chips.className = 'chips';
    if (lesson._combined) {
        chips.appendChild(createLessonTag('chip', 'fas fa-layer-group', 'подгруппы'));
    }
    if (lesson.teacher) {
        chips.appendChild(createLessonTag('chip', 'fas fa-chalkboard-teacher', lesson.teacher));
    }
    if (lesson.class) {
        chips.appendChild(createLessonTag('chip', 'fas fa-users', lesson.class));
    }
    if (lesson.room) {
        chips.appendChild(createLessonTag('chip', 'fas fa-map-marker-alt', lesson.room));
    }

    info.append(header, meta, chips);

    const actions = document.createElement('div');
    if (currentUser?.role === 'teacher') {
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'delete-lesson';
        deleteButton.title = 'Удалить';
        const deleteIcon = document.createElement('i');
        deleteIcon.className = 'fas fa-trash';
        deleteButton.appendChild(deleteIcon);
        deleteButton.addEventListener('click', () => deleteLesson(lesson.id, day));

        const editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.className = 'delete-lesson';
        editButton.title = 'Изменить';
        const editIcon = document.createElement('i');
        editIcon.className = 'fas fa-pen';
        editButton.appendChild(editIcon);
        editButton.addEventListener('click', () => openEditLesson(lesson.id, day));

        actions.append(deleteButton, editButton);
    }

    div.append(info, actions);
    return div;
}

function startEditCatalog(fullName, subject, room) {
    const m = document.getElementById('catalog-modal');
    if (m) { m.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
    const f = document.getElementById('catalog-form');
    const k = document.getElementById('teacher-key');
    if (k) k.value = fullName || '';
    const nf = document.getElementById('teacher-fullname');
    const ns = document.getElementById('teacher-subject');
    const nr = document.getElementById('teacher-room');
    if (nf) nf.value = fullName || '';
    if (ns) ns.value = subject || '';
    if (nr) nr.value = room || '';
}
window.startEditCatalog = startEditCatalog;

// Удалить урок
function deleteLesson(id, day) {
    if (!isTeacher()) { showToast('Выберите демо-роль «Учитель» для этой функции'); return; }
    if (!confirm('Удалить этот урок?')) return;
    const schedule = getSchedule();
    schedule[day] = schedule[day].filter(lesson => lesson.id !== id);
    setSchedule(schedule);
    deleteScheduleRecord(id);
    loadSchedule();
    showToast('Урок удалён');
}


function showRearrangeModal() {
    populateTeacherSelect();
    document.getElementById('rearrange-modal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function hideRearrangeModal() {
    document.getElementById('rearrange-modal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

function populateTeacherSelect() {
    const schedule = getSchedule();
    const set = new Set();
    Object.values(schedule).forEach(list => {
        (list || []).forEach(lesson => {
            if (lesson.teacher) set.add(lesson.teacher);
        });
    });
    const select = document.getElementById('absent-teacher-select');
    select.replaceChildren();
    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = '— Выберите из списка —';
    select.appendChild(emptyOption);
    Array.from(set).sort().forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        select.appendChild(opt);
    });
}

function applyRearrange() {
    if (!isTeacher()) { showToast('Выберите демо-роль «Учитель» для этой функции'); return; }
    const select = document.getElementById('absent-teacher-select');
    const input = document.getElementById('absent-teacher-input');
    const daySel = document.getElementById('rearrange-day');
    const teacher = (input.value || select.value || '').trim();
    if (!teacher) {
        alert('Укажите отсутствующего учителя');
        return;
    }
    const day = daySel.value;
    const schedule = getSchedule();
    const allowedDays = ['monday','tuesday','wednesday','thursday','friday'];
    const targets = day === 'all' ? allowedDays : [day];
    targets.forEach(d => {
        const lessons = (schedule[d] || []);
        const present = [];
        const absent = [];
        lessons.forEach(lesson => {
            if (lesson.teacher && lesson.teacher.toLowerCase() === teacher.toLowerCase()) {
                absent.push(lesson);
            } else {
                present.push(lesson);
            }
        });
        schedule[d] = present.concat(absent);
    });
    setSchedule(schedule);
    loadSchedule();
    hideRearrangeModal();
    showToast('Расписание переставлено');
}

 

function exportScheduleExcel() {
    if (!isTeacher()) { showToast('Выберите демо-роль «Учитель» для этой функции'); return; }
    if (typeof XLSX === 'undefined') { showToast('Библиотека XLSX не загружена'); return; }
    const schedule = getSchedule();
    const wb = XLSX.utils.book_new();
    const dayOrder = ['monday','tuesday','wednesday','thursday','friday'];
    const dayNames = { monday: 'Понедельник', tuesday: 'Вторник', wednesday: 'Среда', thursday: 'Четверг', friday: 'Пятница' };
    const maxSlots = 8;

    // агрегировать данные по учителям
    const teacherMap = new Map();
    dayOrder.forEach(day => {
        (schedule[day] || []).forEach(l => {
            const t = (l.teacher || '').trim();
            if (!t) return;
            if (!teacherMap.has(t)) teacherMap.set(t, { subjects: new Set(), rooms: new Set(), cells: {} });
            const row = teacherMap.get(t);
            if (l.subject) row.subjects.add(l.subject);
            if (l.room) row.rooms.add(l.room);
            const slot = /^\d+$/.test(String(l.time || '').trim()) ? parseInt(String(l.time).trim(), 10) : NaN;
            if (!Number.isNaN(slot) && slot >= 1 && slot <= maxSlots) {
                const key = `${day}:${slot}`;
                if (!row.cells[key]) row.cells[key] = [];
                const cellText = (l.class || '').trim();
                if (cellText) row.cells[key].push(cellText);
            }
        });
    });

    // построить двурядный заголовок как в матрице
    const headerTop = ['№', 'ФИО', 'предмет', 'каб'];
    const headerBottom = ['', '', '', ''];
    const merges = [];
    let col = headerTop.length; // 4
    dayOrder.forEach(day => {
        const startCol = col;
        headerTop.push(dayNames[day]);
        headerBottom.push('1');
        for (let i = 2; i <= maxSlots; i++) {
            headerTop.push('');
            headerBottom.push(String(i));
        }
        const endCol = startCol + maxSlots - 1;
        merges.push({ s: { r: 0, c: startCol }, e: { r: 0, c: endCol } }); // объединение заголовка дня
        col = endCol + 1;
    });

    // строки с данными
    const aoa = [headerTop, headerBottom];
    let idx = 1;
    Array.from(teacherMap.entries()).sort((a,b) => a[0].localeCompare(b[0], 'ru')).forEach(([teacher, info]) => {
        const subjects = Array.from(info.subjects).join(', ');
        const room = Array.from(info.rooms)[0] || '';
        const row = [idx, teacher, subjects, room];
        dayOrder.forEach(day => {
            for (let i = 1; i <= maxSlots; i++) {
                const key = `${day}:${i}`;
                const val = (info.cells[key] || []).join(', ');
                row.push(val);
            }
        });
        aoa.push(row);
        idx++;
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!merges'] = merges;
    ws['!freeze'] = { xSplit: 4, ySplit: 2 };
    ws['!cols'] = [{ wch: 4 }, { wch: 22 }, { wch: 18 }, { wch: 6 }].concat(Array(dayOrder.length * maxSlots).fill({ wch: 6 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Занятость');
    const fname = `Расписание-${(currentUser?.email || 'user').replace(/[^a-z0-9]/gi,'_')}.xlsx`;
    XLSX.writeFile(wb, fname);
    showToast('Экспортировано в Excel (матрица по учителям)');
}

function handleImportExcelFile(e) {
    if (!isTeacher()) { showToast('Выберите демо-роль «Учитель» для этой функции'); return; }
    const file = e.target.files[0];
    if (!file) return;
    if (typeof XLSX === 'undefined') { showToast('Библиотека XLSX не загружена'); return; }
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const wb = XLSX.read(reader.result, { type: 'binary' });
            const mapRusToKey = { 'понедельник': 'monday', 'вторник': 'tuesday', 'среда': 'wednesday', 'четверг': 'thursday', 'пятница': 'friday' };
            const mapEngToKey = { 'monday': 'monday', 'tuesday': 'tuesday', 'wednesday': 'wednesday', 'thursday': 'thursday', 'friday': 'friday' };
            const dayNamesRus = { monday: 'Понедельник', tuesday: 'Вторник', wednesday: 'Среда', thursday: 'Четверг', friday: 'Пятница' };
            const dayNamesEng = { monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday' };
            const dayOrder = ['monday','tuesday','wednesday','thursday','friday'];
            const maxSlots = 8;
            const normalizeDay = (val) => {
                const s = String(val || '').trim().toLowerCase();
                return mapRusToKey[s] || mapEngToKey[s] || '';
            };
            const shortDayToKey = (s) => {
                const raw = String(s || '').trim().toLowerCase();
                const v = raw.replace(/\./g, '');
                const map = { 'пн': 'monday', 'вт': 'tuesday', 'ср': 'wednesday', 'чт': 'thursday', 'пт': 'friday', 'mon': 'monday', 'tue': 'tuesday', 'wed': 'wednesday', 'thu': 'thursday', 'fri': 'friday' };
                return map[v] || normalizeDay(raw) || '';
            };
            const slotKeyMatches = (k, i) => {
                const t = String(k || '').toLowerCase().trim();
                if (t === String(i)) return true;
                if (new RegExp('^' + i + '\\s*(урок|\\.)?$','i').test(t)) return true;
                if (new RegExp('^урок\\s*' + i + '$','i').test(t)) return true;
                return false;
            };
            const getSlotValue = (row, i) => {
                const keys = Object.keys(row || {});
                const key = keys.find(k => slotKeyMatches(k, i));
                return key ? row[key] : row[String(i)];
            };
            let out = {};
            const firstSheetName = wb.SheetNames[0];
            const firstWS = wb.Sheets[firstSheetName];
            const aoa = XLSX.utils.sheet_to_json(firstWS, { header: 1, defval: '' });
            const dayMapUpper = { 'ПОНЕДЕЛЬНИК': 'monday', 'ВТОРНИК': 'tuesday', 'СРЕДА': 'wednesday', 'ЧЕТВЕРГ': 'thursday', 'ПЯТНИЦА': 'friday' };
            let headerTop = -1, headerBottom = -1, colFio = -1, colSubj = -1, colRoom = -1, blocks = [];
            for (let i = 0; i < Math.min(aoa.length - 1, 60); i++) {
                const A = aoa[i] || [];
                const B = aoa[i + 1] || [];
                const up = (v) => String(v || '').trim().toUpperCase();
                colFio = A.findIndex(x => /ФИО/i.test(String(x)));
                colSubj = A.findIndex(x => /^предм/i.test(String(x)));
                colRoom = A.findIndex(x => /^каб/i.test(String(x)));
                const tmp = [];
                for (let j = 0; j < A.length; j++) {
                    const dk = dayMapUpper[up(A[j])];
                    if (!dk) continue;
                    let ok = true;
                    for (let s = 0; s < maxSlots; s++) {
                        if (String(B[j + s] || '').trim() !== String(s + 1)) { ok = false; break; }
                    }
                    if (ok) tmp.push({ key: dk, start: j });
                }
                if (colFio >= 0 && tmp.length >= 3) { headerTop = i; headerBottom = i + 1; blocks = tmp; break; }
            }
            if (blocks.length > 0) {
                const outA = { monday: [], tuesday: [], wednesday: [], thursday: [], friday: [] };
                let ctxT = '', ctxS = '', ctxR = '';
                for (let r = headerBottom + 1; r < aoa.length; r++) {
                    const row = aoa[r] || [];
                    const t = String(row[colFio] || '').trim();
                    const s = String(row[colSubj] || '').trim();
                    const rm = String(row[colRoom] || '').trim();
                    if (t) ctxT = t;
                    if (s) ctxS = s;
                    if (rm) ctxR = rm;
                    if (!ctxT && !ctxS && !ctxR) continue;
                    for (const b of blocks) {
                        for (let i = 1; i <= maxSlots; i++) {
                            const val = row[b.start + (i - 1)];
                            const cell = String(val || '').trim();
                            if (!cell) continue;
                            const m = cell.match(/^\s*(\d{1,2})([A-Za-zА-Яа-яЁё])?/);
                            if (!m) continue;
                            const g = m[1];
                            const letter = (m[2] || '').toLowerCase();
                            if (!(Number(g) >= 5 && Number(g) <= 11)) continue;
                            outA[b.key].push({
                                id: Date.now() + r + i + Math.floor(Math.random()*1000),
                                time: String(i),
                                subject: canonicalizeSubjectList(ctxS || ''),
                                teacher: ctxT || '',
                                class: String(g) + letter,
                                room: ctxR || ''
                            });
                        }
                    }
                }
                if (Object.values(outA).some(arr => (arr || []).length > 0)) out = outA;
            }
            // 1) Попытка: импорт матрицы (ФИО, Предмет, Каб + Понедельник 1..8, ...)
            const firstRows = XLSX.utils.sheet_to_json(firstWS, { defval: '' });
            const keysLower = (obj) => Object.keys(obj || {}).map(k => k.toLowerCase());
            const isMatrix = firstRows.length > 0 && firstRows.some(r => {
                const ks = keysLower(r);
                const hasFio = ks.includes('фио') || ks.includes('teacher') || ks.includes('преподаватель');
                const hasAnyDaySlot = dayNamesRus.monday && (ks.includes(`${dayNamesRus.monday.toLowerCase()} 1`) || ks.includes(`${dayNamesEng.monday.toLowerCase()} 1`.toLowerCase()));
                return hasFio && hasAnyDaySlot;
            });
            if (isMatrix) {
                const matrixOut = {};
                firstRows.forEach((r, rowIdx) => {
                    const teacher = r['ФИО'] || r['Преподаватель'] || r['Teacher'] || '';
                    const subj = canonicalizeSubjectList(r['Предмет'] || r['Subject'] || '');
                    const room = r['Каб'] || r['Кабинет'] || r['Room'] || '';
                    dayOrder.forEach(day => {
                        for (let i = 1; i <= maxSlots; i++) {
                            const val = r[`${dayNamesRus[day]} ${i}`] || r[`${dayNamesEng[day]} ${i}`] || '';
                            const cls = String(val || '').trim();
                            if (cls) {
                                if (!matrixOut[day]) matrixOut[day] = [];
                                matrixOut[day].push({
                                    id: Date.now() + rowIdx + i + Math.floor(Math.random()*1000),
                                    time: String(i),
                                    subject: subj || '',
                                    teacher: teacher || '',
                                    class: cls,
                                    room: room || ''
                                });
                            }
                        }
                    });
                });
                if (Object.keys(matrixOut).length > 0) {
                    out = matrixOut;
                }
            }
            // 2) Попытка: импорт из одной таблицы с колонкой "День"/"Day"
            const hasDayColumn = Object.keys(firstRows[0] || {}).includes('День') || Object.keys(firstRows[0] || {}).includes('Day') || firstRows.some(r => ('День' in r) || ('Day' in r));
            if (hasDayColumn && Object.keys(out).length === 0) {
                const tableOut = {};
                firstRows.forEach((r, idx) => {
                    const key = normalizeDay(r['День'] || r['Day']);
                    if (!key) return;
                    const item = {
                        id: Date.now() + idx + Math.floor(Math.random()*1000),
                        time: r['Время'] || r['Time'] || '',
                        subject: canonicalizeSubjectList(r['Предмет'] || r['Subject'] || ''),
                        teacher: r['Преподаватель'] || r['Teacher'] || '',
                        class: r['Класс'] || r['Class'] || '',
                        room: r['Аудитория'] || r['Room'] || ''
                    };
                    if (item.subject || item.time || item.teacher || item.class || item.room) {
                        if (!tableOut[key]) tableOut[key] = [];
                        tableOut[key].push(item);
                    }
                });
                if (Object.keys(tableOut).length > 0) {
                    out = tableOut;
                }
            }
            // 2.1) Матрица по учителям с колонкой "День" и слотами "1..8" (формат Расписание.xls)
            if (Object.keys(out).length === 0 && firstRows.length > 0) {
                const hasFio = Object.keys(firstRows[0]).some(k => ['ФИО','Преподаватель','Teacher'].includes(k));
                const hasDay = Object.keys(firstRows[0]).includes('День');
                const hasSlots = [1,2,3,4,5,6,7,8].some(n => firstRows.some(r => Object.keys(r).some(k => slotKeyMatches(k, n))));
                if (hasFio && hasDay && hasSlots) {
                    const matrixOut2 = { monday: [], tuesday: [], wednesday: [], thursday: [], friday: [] };
                    let ctxTeacher = '';
                    let ctxSubject = '';
                    let ctxRoom = '';
                    let ctxDayKey = '';
                    firstRows.forEach((r, idx) => {
                        const t = r['ФИО'] || r['Преподаватель'] || r['Teacher'] || '';
                        const subj = canonicalizeSubjectList(r['Предмет'] || r['Subject'] || '');
                        const room = r['Каб'] || r['Кабинет'] || r['Room'] || '';
                        if (String(t).trim()) ctxTeacher = String(t).trim();
                        if (String(subj).trim()) ctxSubject = String(subj).trim();
                        if (String(room).trim()) ctxRoom = String(room).trim();
                        if (String(r['День'] || '').trim()) ctxDayKey = shortDayToKey(r['День']);
                        if (!ctxDayKey) return;
                        for (let i = 1; i <= maxSlots; i++) {
                            const val = getSlotValue(r, i);
                            const cell = String(val || '').trim();
                            if (!cell) continue;
                            const match = cell.match(/^\s*(\d{1,2})([A-Za-zА-Яа-яЁё])?/);
                            if (!match) continue; // не класс, а служебная метка
                            const grade = match[1];
                            const letter = (match[2] || '').toLowerCase();
                            if (!(Number(grade) >= 5 && Number(grade) <= 11)) continue;
                            matrixOut2[ctxDayKey].push({
                                id: Date.now() + idx + i + Math.floor(Math.random()*1000),
                                time: String(i),
                                subject: canonicalizeSubjectList(ctxSubject || ''),
                                teacher: ctxTeacher || '',
                                class: String(grade) + String(letter),
                                room: ctxRoom || ''
                            });
                        }
                    });
                    if (Object.values(matrixOut2).some(arr => (arr||[]).length > 0)) {
                        out = matrixOut2;
                    }
                }
            }
            // 3) Если таблица не обнаружена, используем формат "лист на каждый день"
            if (Object.keys(out).length === 0) {
                wb.SheetNames.forEach(name => {
                    const key = normalizeDay(name);
                    if (!key) return;
                    const ws = wb.Sheets[name];
                    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
                    out[key] = rows.map((r, idx) => ({
                        id: Date.now() + idx + Math.floor(Math.random()*1000),
                        time: r['Время'] || r['Time'] || '',
                        subject: canonicalizeSubjectList(r['Предмет'] || r['Subject'] || ''),
                        teacher: r['Преподаватель'] || r['Teacher'] || '',
                        class: r['Класс'] || r['Class'] || '',
                        room: r['Аудитория'] || r['Room'] || ''
                    })).filter(x => x.subject || x.time || x.teacher || x.class || x.room);
                });
            }
            const totalCount = Object.values(out || {}).reduce((s, arr) => s + ((arr || []).length), 0);
            if (totalCount === 0) {
                showToast('В файле не найдено уроков');
                return;
            }
            setSchedule(out);
            loadSchedule();
            showToast(`Импортировано: ${totalCount}`);
        } catch (err) {
            showToast('Ошибка импорта Excel');
        }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
}

 

function clearSchedule() {
    if (!isTeacher()) { showToast('Выберите демо-роль «Учитель» для этой функции'); return; }
    if (!confirm('Очистить всё расписание?')) return;
    setSchedule({});
    clearUserScheduleRecords();
    loadSchedule();
    showToast('Расписание очищено');
}

 

function openEditLesson(id, day) {
    if (!isTeacher()) { showToast('Выберите демо-роль «Учитель» для этой функции'); return; }
    const schedule = getSchedule();
    const lessons = schedule[day] || [];
    const l = lessons.find(x => x.id === id);
    if (!l) return;
    document.getElementById('lesson-subject').value = l.subject || '';
    document.getElementById('lesson-teacher').value = l.teacher || '';
    document.getElementById('lesson-class').value = l.class || '';
    document.getElementById('lesson-day').value = day;
    document.getElementById('lesson-time').value = l.time || '';
    document.getElementById('lesson-room').value = l.room || '';
    document.getElementById('lesson-id').value = String(id);
    document.getElementById('lesson-original-day').value = day;
    showLessonModal();
}

function showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;
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

function hasConflict(day, lesson, excludeId) {
    const schedule = getSchedule();
    const list = schedule[day] || [];
    if (!lesson.time) return '';
    const sameTime = list.filter(l => l.id !== excludeId && l.time === lesson.time);
    if (sameTime.length === 0) return '';
    const roomConflict = lesson.room && sameTime.find(l => l.room && l.room === lesson.room);
    const classConflict = lesson.class && sameTime.find(l => l.class && l.class === lesson.class);
    if (roomConflict) return `аудитория ${lesson.room} занята (${roomConflict.subject})`;
    if (classConflict) return `класс/группа ${lesson.class} занята (${classConflict.subject})`;
    return '';
}

const WEEKLY_GRID = {
    "5": { "Русский язык": 5, "Литература": 3, "Английский язык": 3, "Математика": 6, "История": 3, "География": 1, "Биология": 2, "Изобразительное искусство": 1, "Музыка": 1, "Технология": 2, "Физическая культура": 2 },
    "6": { "Русский язык": 6, "Литература": 3, "Английский язык": 3, "Математика": 6, "История": 3, "География": 1, "Биология": 2, "Музыка": 1, "Технология": 2, "Физическая культура": 2 },
    "7": { "Русский язык": 4, "Литература": 2, "Английский язык": 3, "Алгебра": 4, "Геометрия": 2, "Вероятность и статистика": 1, "Информатика": 1, "История": 3, "Обществознание": 1, "География": 2, "Физика": 2, "Биология": 2, "Изобразительное искусство": 1, "Музыка": 1, "Технология": 2, "Физическая культура": 2 },
    "8": { "Русский язык": 4, "Литература": 2, "Английский язык": 3, "Алгебра": 3, "Геометрия": 2, "Вероятность и статистика": 1, "Информатика": 1, "История": 3, "Обществознание": 1, "География": 2, "Физика": 2, "Химия": 2, "Биология": 2, "Музыка": 1, "Технология": 2, "Физическая культура": 2, "ОБЗР": 1 },
    "9": { "Русский язык": 3, "Литература": 3, "Английский язык": 3, "Алгебра": 3, "Геометрия": 2, "Вероятность и статистика": 1, "Информатика": 2, "История": 2, "Обществознание": 1, "География": 2, "Физика": 3, "Химия": 3, "Биология": 2, "Технология": 1, "Физическая культура": 2, "ОБЗР": 1 },
    "10": { "Русский язык": 2, "Литература": 3, "Английский язык": 3, "Алгебра и начала математического анализа": 4, "Геометрия": 3, "Вероятность и статистика": 1, "Информатика": 1, "Физика": 2, "Химия": 1, "Биология": 1, "История": 2, "Обществознание": 4, "География": 1, "ОБЗР": 1, "Физическая культура": 2, "Индивидуальный проект": 1, "Графический дизайн": 1, "Теория и практика написания сочинения": 1 },
    "11": { "Русский язык": 2, "Литература": 3, "Английский язык": 3, "Алгебра и начала математического анализа": 4, "Геометрия": 3, "Вероятность и статистика": 1, "Информатика": 1, "Физика": 2, "Химия": 1, "Биология": 1, "История": 2, "Обществознание": 4, "География": 1, "ОБЗР": 1, "Физическая культура": 2, "Графический дизайн": 1, "Теория и практика написания сочинения": 2 }
};

const BELL_TIMES = {
    '1': '08:15–09:00',
    '2': '09:10–09:55',
    '3': '10:10–10:55',
    '4': '11:05–11:50',
    '5': '12:05–12:50',
    '6': '13:05–13:50',
    '7': '14:00–14:45'
};

function normalizeSubjectName(s) {
    const map = {
        "английский": "Английский язык",
        "англ": "Английский язык",
        "иностранный язык": "Английский язык",
        "математика": "Математика",
        "алг": "Алгебра",
        "геом": "Геометрия",
        "вер": "Вероятность и статистика",
        "вер-ть": "Вероятность и статистика",
        "вероятн": "Вероятность и статистика",
        "стат": "Вероятность и статистика",
        "рус": "Русский язык",
        "литер": "Литература",
        "инф": "Информатика",
        "ист": "История",
        "общ": "Обществознание",
        "геогр": "География",
        "физ": "Физика",
        "хим": "Химия",
        "биол": "Биология",
        "изо": "Изобразительное искусство",
        "муз": "Музыка",
        "труд": "Технология",
        "обзр": "ОБЗР",
        "обж": "ОБЗР",
        "ф-ра": "Физическая культура",
        "физра": "Физическая культура",
        "фк": "Физическая культура"
    };
    const k = String(s||'').toLowerCase().trim();
    for (const key in map) { if (k.includes(key)) return map[key]; }
    return s;
}

function canonicalizeSubjectList(subj) {
    const raw = String(subj || '').trim();
    if (!raw) return '';
    const parts = raw.split(/[;,/]+/).map(p => p.trim()).filter(Boolean);
    if (parts.length === 0) return '';
    const mapped = parts.map(p => normalizeSubjectName(p)).filter(Boolean);
    const uniq = Array.from(new Set(mapped));
    if (uniq.length === 1) return uniq[0];
    return uniq.join(', ');
}

async function getTeachersBySubject(subject) {
    const list = await listTeachers();
    const norm = normalizeSubjectName(subject);
    const out = list.filter(t => normalizeSubjectName(t.subject).toLowerCase() === norm.toLowerCase());
    return out;
}

async function pickTeacherFor(subject) {
    const arr = await getTeachersBySubject(subject);
    if (arr.length > 0) return arr[0];
    return { fullName: '', subject: subject, room: '' };
}

function daySlots() { return ['monday','tuesday','wednesday','thursday','friday']; }

function canPlace(schedule, day, slot, cls, teacherName, room) {
    const list = schedule[day] || [];
    const slotStr = String(slot);
    const same = list.filter(l => String(l.time||'') === slotStr);
    if (same.find(l => l.class && String(l.class).trim() === String(cls).trim())) return false;
    if (teacherName && same.find(l => l.teacher && l.teacher === teacherName)) return false;
    if (room && same.find(l => l.room && l.room === room)) return false;
    return true;
}

function computeOrderForSubjects(subjMap) {
    const priority = ['Русский язык','Алгебра и начала математического анализа','Алгебра','Геометрия','Математика','Английский язык','Физика','Химия','Информатика','История','Обществознание','Биология','География','Литература','Физическая культура','ОБЗР','Музыка','Изобразительное искусство','Технология','Вероятность и статистика','Индивидуальный проект','Графический дизайн','Теория и практика написания сочинения'];
    const entries = Object.entries(subjMap);
    entries.sort((a,b) => {
        const pa = Math.min(priority.indexOf(a[0]), 999);
        const pb = Math.min(priority.indexOf(b[0]), 999);
        if (pa !== pb) return pa - pb;
        return b[1] - a[1];
    });
    return entries.map(x => x[0]);
}

async function autoGenerateSchedule() {
    if (!isTeacher()) { showToast('Выберите демо-роль «Учитель» для этой функции'); return; }
    const t0 = performance.now();
    const clsFilter = document.getElementById('filter-class')?.value || 'all';
    const base = getSchedule();
    const out = { monday: [], tuesday: [], wednesday: [], thursday: [], friday: [] };
    const classes = clsFilter === 'all' ? ['5','6','7','8','9','10','11'] : [String(clsFilter)];
    for (const cls of classes) {
        const plan = WEEKLY_GRID[cls];
        if (!plan) continue;
        const order = computeOrderForSubjects(plan);
        for (const subj of order) {
            let hours = plan[subj] || 0;
            while (hours > 0) {
                let placed = false;
                const teacher = await pickTeacherFor(subj);
                const room = teacher.room || '';
                for (const day of daySlots()) {
                    for (let slot = 1; slot <= 8; slot++) {
                        if (!canPlace(out, day, slot, cls, teacher.fullName || '', room)) continue;
                        if (!canPlace(base, day, slot, cls, teacher.fullName || '', room)) {
                            continue;
                        }
                        const lesson = { id: Date.now() + Math.floor(Math.random()*1000000), time: String(slot), subject: subj, teacher: teacher.fullName || '', class: cls, room: room };
                        if (!out[day]) out[day] = [];
                        out[day].push(lesson);
                        placed = true;
                        break;
                    }
                    if (placed) break;
                }
                if (!placed) break;
                hours--;
            }
        }
    }
    const merged = { monday: [], tuesday: [], wednesday: [], thursday: [], friday: [] };
    for (const d of daySlots()) {
        const both = [].concat(base[d] || [], out[d] || []);
        merged[d] = both.sort((a,b) => String(a.time||'').localeCompare(String(b.time||'')));
    }
    setSchedule(merged);
    loadSchedule();
    const t1 = performance.now();
    recordMetric('auto-generate', Math.round(t1 - t0), Object.values(out).reduce((s,arr)=>s+(arr||[]).length,0));
    showToast('Автоформирование выполнено');
}

function requestNotifications() {
    try {
        if (!('Notification' in window)) { showToast('Уведомления не поддерживаются'); return; }
        Notification.requestPermission().then((p) => {
            if (p === 'granted') showToast('Уведомления включены');
            else showToast('Уведомления отключены');
        });
    } catch(_) { showToast('Ошибка разрешений уведомлений'); }
}

let broadcast;
try { broadcast = new BroadcastChannel('schedule-updates'); } catch(_) { broadcast = null; }

function tryNotifyScheduleChanged(schedule) {
    try {
        if (broadcast) broadcast.postMessage({ type: 'schedule-changed', at: Date.now() });
        if (currentUser?.role === 'student' && 'Notification' in window && Notification.permission === 'granted') {
            const total = Object.values(schedule || {}).reduce((s, arr)=>s+(arr||[]).length,0);
            new Notification('Расписание обновлено', { body: `Всего занятий: ${total}` });
        }
        const arr = JSON.parse(localStorage.getItem('notifications') || '[]');
        arr.push({ type: 'schedule-changed', at: Date.now() });
        localStorage.setItem('notifications', JSON.stringify(arr));
    } catch(_) {}
}

function recordMetric(action, ms, count) {
    try {
        const arr = JSON.parse(localStorage.getItem('metrics') || '[]');
        arr.push({ action, ms, count, at: Date.now() });
        localStorage.setItem('metrics', JSON.stringify(arr));
    } catch(_) {}
}
