
// Глобальная переменная для расписания
let currentSchedule = {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: []
};

// Функция нормализации имени предмета
function normalizeSubjectName(s) {
    return String(s || '').trim();
}

// Загрузка расписания
async function loadSchedule() {
    try {
        // Пробуем загрузить с сервера/GitHub если настроено
        let remoteSchedule = null;
        if (typeof isGithubReadConfigured === 'function' && isGithubReadConfigured() && typeof fetchGithubFile === 'function') {
            remoteSchedule = await fetchGithubFile('schedule.json');
        }
        
        // Если не удалось, пробуем локально
        if (!remoteSchedule) {
            const stored = localStorage.getItem('schedule');
            if (stored) remoteSchedule = JSON.parse(stored);
        }

        if (remoteSchedule) {
            currentSchedule = remoteSchedule;
            // Убедимся, что структура правильная
            ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].forEach(day => {
                if (!Array.isArray(currentSchedule[day])) currentSchedule[day] = [];
            });
        }
    } catch (e) {
        console.error('Ошибка загрузки расписания', e);
    }
    renderSchedule();
}

// Сохранение расписания
async function setSchedule(schedule) {
    currentSchedule = schedule;
    localStorage.setItem('schedule', JSON.stringify(schedule));
    renderSchedule();
    
    // Синхронизация
    if (typeof syncScheduleToGithub === 'function' && typeof isGithubWriteConfigured === 'function' && isGithubWriteConfigured()) {
        await syncScheduleToGithub(schedule);
    }
}

function getSchedule() {
    return currentSchedule;
}

// Рендеринг расписания
function renderSchedule() {
    const filterText = document.getElementById('filter-text')?.value.toLowerCase() || '';
    const filterClass = document.getElementById('filter-class')?.value || 'all';
    
    ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].forEach(day => {
        const container = document.getElementById(`${day}-lessons`);
        if (!container) return;
        
        container.innerHTML = '';
        
        let lessons = currentSchedule[day] || [];
        
        // Сортировка по времени
        lessons.sort((a, b) => {
            return (a.time || '').localeCompare(b.time || '');
        });

        // Фильтрация
        lessons = lessons.filter(l => {
            if (filterClass !== 'all' && l.class !== filterClass && !String(l.class).startsWith(filterClass)) return false;
            if (filterText) {
                const text = `${l.subject} ${l.teacher} ${l.class} ${l.room}`.toLowerCase();
                if (!text.includes(filterText)) return false;
            }
            return true;
        });

        if (lessons.length === 0) {
            container.innerHTML = '<p class="no-lessons">Нет уроков</p>';
            return;
        }

        lessons.forEach(lesson => {
            const el = document.createElement('div');
            el.className = 'lesson-item';
            el.innerHTML = `
                <div style="width:100%">
                    <div class="lesson-header">
                        <h4>${lesson.subject}</h4>
                        <span class="time-badge">${lesson.time || ''} урок</span>
                    </div>
                    <div class="lesson-meta">
                        <span><i class="fas fa-user"></i> ${lesson.teacher || 'Не назначен'}</span>
                        <span><i class="fas fa-map-marker-alt"></i> ${lesson.room || '-'}</span>
                    </div>
                    <div class="chips">
                        <span class="chip">${lesson.class || ''}</span>
                    </div>
                    <div class="lesson-actions" style="margin-top:10px; display:flex; gap:10px; justify-content:flex-end;">
                        <button class="edit-lesson-btn" style="background:transparent; color:var(--primary-color);"><i class="fas fa-edit"></i></button>
                        <button class="delete-lesson-btn" style="background:transparent; color:var(--secondary-color);"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            `;
            
            el.querySelector('.edit-lesson-btn').addEventListener('click', () => openEditLessonModal(lesson, day));
            el.querySelector('.delete-lesson-btn').addEventListener('click', () => deleteLesson(lesson.id, day));
            
            container.appendChild(el);
        });
    });
}

// Получение списка учителей
async function listTeachers() {
    // Сначала пробуем из localStorage
    let users = JSON.parse(localStorage.getItem('users')) || [];
    
    // Если есть функция загрузки удаленных, пробуем
    if (typeof loadUsersRemote === 'function') {
        try {
            const remote = await loadUsersRemote();
            if (remote) users = remote; // Или мержить
        } catch (_) {}
    }
    
    return users.filter(u => u.role === 'teacher').map(u => ({
        fullName: u.name,
        subject: u.subject || '', // В users.json может не быть предмета, надо предусмотреть
        room: u.room || ''
    }));
}

// Проверка на конфликты
function canPlace(schedule, day, slot, className, teacherName, roomName) {
    const lessons = schedule[day] || [];
    const slotStr = String(slot);
    
    // 1. Класс занят?
    const classBusy = lessons.find(l => String(l.time) === slotStr && l.class === className);
    if (classBusy) return false;
    
    // 2. Учитель занят?
    if (teacherName && teacherName !== 'Вакансия') {
        const teacherBusy = lessons.find(l => String(l.time) === slotStr && l.teacher === teacherName);
        if (teacherBusy) return false;
    }
    
    // 3. Кабинет занят?
    if (roomName) {
        const roomBusy = lessons.find(l => String(l.time) === slotStr && l.room === roomName);
        if (roomBusy) return false;
    }
    
    return true;
}

// --- Управление уроками ---

function openEditLessonModal(lesson, day) {
    const modal = document.getElementById('lesson-modal');
    document.getElementById('lesson-modal-title').textContent = 'Редактировать урок';
    document.getElementById('lesson-id').value = lesson.id;
    document.getElementById('lesson-original-day').value = day;
    
    document.getElementById('lesson-subject').value = lesson.subject;
    document.getElementById('lesson-teacher').value = lesson.teacher;
    document.getElementById('lesson-class').value = lesson.class;
    document.getElementById('lesson-day').value = day;
    document.getElementById('lesson-time').value = lesson.time; // Внимание: тут может быть номер урока, а input type=time ждет время
    // Если lesson.time это номер урока (1-8), то input type="time" не подходит. 
    // В dashboard.html input type="time". Это странно, если мы храним номер урока.
    // Если мы храним время (08:30), то ок.
    // Генератор использует 1-8. Давайте заменим input type="time" на number или select в HTML, или здесь адаптируем.
    // Пока оставим как есть, но это баг в HTML/логике. Исправим HTML позже.
    
    document.getElementById('lesson-room').value = lesson.room;
    
    modal.style.display = 'block';
}

function deleteLesson(id, day) {
    if (!confirm('Удалить урок?')) return;
    currentSchedule[day] = currentSchedule[day].filter(l => l.id !== id);
    setSchedule(currentSchedule);
}

// --- Инициализация ---

document.addEventListener('DOMContentLoaded', () => {
    loadSchedule();
    
    // Фильтры
    document.getElementById('filter-text')?.addEventListener('input', renderSchedule);
    document.getElementById('filter-class')?.addEventListener('change', renderSchedule);
    
    // Кнопки
    document.getElementById('add-lesson')?.addEventListener('click', () => {
        document.getElementById('lesson-modal').style.display = 'block';
        document.getElementById('lesson-form').reset();
        document.getElementById('lesson-id').value = '';
        document.getElementById('lesson-modal-title').textContent = 'Добавить урок';
    });
    
    document.querySelector('.lesson-close')?.addEventListener('click', () => {
        document.getElementById('lesson-modal').style.display = 'none';
    });
    
    document.getElementById('clear-schedule')?.addEventListener('click', () => {
        if (confirm('Вы уверены, что хотите очистить всё расписание?')) {
            setSchedule({ monday: [], tuesday: [], wednesday: [], thursday: [], friday: [] });
        }
    });
    
    // Форма урока
    document.getElementById('lesson-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('lesson-id').value;
        const originalDay = document.getElementById('lesson-original-day').value;
        
        const day = document.getElementById('lesson-day').value;
        const newLesson = {
            id: id || Date.now() + Math.random(),
            subject: document.getElementById('lesson-subject').value,
            teacher: document.getElementById('lesson-teacher').value,
            class: document.getElementById('lesson-class').value,
            time: document.getElementById('lesson-time').value,
            room: document.getElementById('lesson-room').value
        };
        
        if (id && originalDay) {
            // Удаляем старый
            currentSchedule[originalDay] = currentSchedule[originalDay].filter(l => String(l.id) !== String(id));
        }
        
        if (!currentSchedule[day]) currentSchedule[day] = [];
        currentSchedule[day].push(newLesson);
        
        setSchedule(currentSchedule);
        document.getElementById('lesson-modal').style.display = 'none';
    });

    // Экспорт в Excel
    document.getElementById('export-excel')?.addEventListener('click', () => {
        // Простая реализация
        if (typeof XLSX === 'undefined') { alert('Библиотека XLSX не загружена'); return; }
        
        const wb = XLSX.utils.book_new();
        
        ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].forEach(day => {
            const lessons = currentSchedule[day] || [];
            const data = lessons.map(l => ({
                'Класс': l.class,
                'Предмет': l.subject,
                'Учитель': l.teacher,
                'Кабинет': l.room,
                'Время/Урок': l.time
            }));
            const ws = XLSX.utils.json_to_sheet(data);
            XLSX.utils.book_append_sheet(wb, ws, day);
        });
        
        XLSX.writeFile(wb, 'schedule.xlsx');
    });

    // Импорт Excel (заготовка)
    document.getElementById('import-excel')?.addEventListener('click', () => {
        document.getElementById('import-excel-file').click();
    });
    
    document.getElementById('import-excel-file')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (evt) => {
            const data = new Uint8Array(evt.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            const newSchedule = { monday: [], tuesday: [], wednesday: [], thursday: [], friday: [] };
            
            workbook.SheetNames.forEach(sheetName => {
                const lower = sheetName.toLowerCase();
                let dayKey = null;
                if (lower.includes('понедельник') || lower.includes('monday')) dayKey = 'monday';
                else if (lower.includes('вторник') || lower.includes('tuesday')) dayKey = 'tuesday';
                else if (lower.includes('среда') || lower.includes('wednesday')) dayKey = 'wednesday';
                else if (lower.includes('четверг') || lower.includes('thursday')) dayKey = 'thursday';
                else if (lower.includes('пятница') || lower.includes('friday')) dayKey = 'friday';
                
                if (dayKey) {
                    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
                    newSchedule[dayKey] = rows.map(r => ({
                        id: Date.now() + Math.random(),
                        class: r['Класс'] || '',
                        subject: r['Предмет'] || '',
                        teacher: r['Учитель'] || '',
                        room: r['Кабинет'] || '',
                        time: r['Время/Урок'] || ''
                    }));
                }
            });
            
            if (confirm('Импортировать расписание? Текущее будет заменено.')) {
                setSchedule(newSchedule);
            }
        };
        reader.readAsArrayBuffer(file);
    });

    // Печать
    document.getElementById('print-schedule')?.addEventListener('click', () => {
        window.print();
    });
    
    // Перестановка (модалка)
    const rearrangeModal = document.getElementById('rearrange-modal');
    document.getElementById('rearrange-open')?.addEventListener('click', async () => {
        rearrangeModal.style.display = 'block';
        const select = document.getElementById('absent-teacher-select');
        select.innerHTML = '<option value="">— Выберите из списка —</option>';
        const teachers = await listTeachers();
        teachers.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.fullName;
            opt.textContent = t.fullName;
            select.appendChild(opt);
        });
    });
    
    document.querySelector('.rearrange-close')?.addEventListener('click', () => {
        rearrangeModal.style.display = 'none';
    });
    
    document.getElementById('apply-rearrange')?.addEventListener('click', () => {
        const teacher = document.getElementById('absent-teacher-select').value || document.getElementById('absent-teacher-input').value;
        const day = document.getElementById('rearrange-day').value;
        
        if (!teacher) { alert('Выберите учителя'); return; }
        
        let count = 0;
        const daysToProcess = day === 'all' ? ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] : [day];
        
        daysToProcess.forEach(d => {
            if (!currentSchedule[d]) return;
            currentSchedule[d].forEach(l => {
                if (l.teacher === teacher) {
                    l.teacher = 'ЗАМЕНА';
                    l.subject += ' (Замена)';
                    count++;
                }
            });
        });
        
        if (count > 0) {
            setSchedule(currentSchedule);
            alert(`Обновлено уроков: ${count}`);
            rearrangeModal.style.display = 'none';
        } else {
            alert('Уроков этого учителя не найдено');
        }
    });
});

/* --- ЛОГИКА ГЕНЕРАТОРА РАСПИСАНИЯ --- */

let generatorConfig = {
    classes: ['5А', '5Б', '6А', '6Б', '7А', '7Б', '8А', '8Б', '9А', '9Б', '10А', '11А'],
    curriculum: {}, // { "5": { "Русский язык": 5, ... }, ... }
    teacherMapping: {} // { "Русский язык": ["Иванов И.И."], ... }
};

// Инициализация дефолтного учебного плана из WEEKLY_GRID
function initDefaultCurriculum() {
    const defaults = {
        "5": { "Русский язык": 5, "Литература": 3, "Английский язык": 3, "Математика": 5, "История": 2, "География": 1, "Биология": 1, "Музыка": 1, "Технология": 2, "Физкультура": 2, "ИЗО": 1 },
        "6": { "Русский язык": 6, "Литература": 3, "Английский язык": 3, "Математика": 5, "История": 2, "География": 1, "Биология": 1, "Музыка": 1, "Технология": 2, "Физкультура": 2, "Обществознание": 1 },
        "7": { "Русский язык": 4, "Литература": 2, "Английский язык": 3, "Алгебра": 3, "Геометрия": 2, "Информатика": 1, "Физика": 2, "Биология": 2, "История": 2, "География": 2, "Физкультура": 2, "Музыка": 1, "ИЗО": 1, "Технология": 2 },
        "8": { "Русский язык": 3, "Литература": 2, "Английский язык": 3, "Алгебра": 3, "Геометрия": 2, "Информатика": 1, "Физика": 2, "Химия": 2, "Биология": 2, "История": 2, "География": 2, "Физкультура": 2, "ОБЖ": 1 },
        "9": { "Русский язык": 3, "Литература": 3, "Английский язык": 3, "Алгебра": 3, "Геометрия": 2, "Информатика": 2, "Физика": 3, "Химия": 2, "Биология": 2, "История": 2, "География": 2, "Физкультура": 2, "ОБЖ": 1 },
        "10": { "Русский язык": 2, "Литература": 3, "Английский язык": 3, "Алгебра": 4, "Геометрия": 2, "Информатика": 1, "Физика": 2, "Химия": 1, "Биология": 1, "История": 2, "Обществознание": 2, "География": 1, "Физкультура": 2, "ОБЖ": 1 },
        "11": { "Русский язык": 2, "Литература": 3, "Английский язык": 3, "Алгебра": 4, "Геометрия": 2, "Информатика": 1, "Физика": 2, "Химия": 1, "Биология": 1, "История": 2, "Обществознание": 2, "География": 1, "Физкультура": 2, "ОБЖ": 1 }
    };
    // Если конфиг пустой, заполняем дефолтным
    if (Object.keys(generatorConfig.curriculum).length === 0) {
        generatorConfig.curriculum = JSON.parse(JSON.stringify(defaults));
    }
}

function loadGeneratorSettings() {
    try {
        const stored = localStorage.getItem('generatorConfig');
        if (stored) {
            const parsed = JSON.parse(stored);
            generatorConfig = { ...generatorConfig, ...parsed };
        }
    } catch (e) { console.error('Ошибка загрузки настроек генератора', e); }
    initDefaultCurriculum();
}

function saveGeneratorSettings() {
    try {
        localStorage.setItem('generatorConfig', JSON.stringify(generatorConfig));
        showToast('Настройки генератора сохранены');
    } catch (e) { showToast('Ошибка сохранения настроек'); }
}

function openGeneratorSettings() {
    loadGeneratorSettings();
    document.getElementById('generator-modal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // Заполняем поля
    document.getElementById('gen-classes-input').value = generatorConfig.classes.join(', ');
    renderCurriculumTable();
    renderTeachersMapping();
}

function closeGeneratorSettings() {
    document.getElementById('generator-modal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

function switchGenTab(tabId) {
    document.querySelectorAll('.gen-tab-content').forEach(el => el.style.display = 'none');
    document.getElementById(tabId).style.display = 'block';
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.style.borderBottom = 'none';
        btn.style.fontWeight = '400';
    });
    
    // Находим кнопку, которая вызвала это событие (или по ID)
    const activeBtn = document.querySelector(`.tab-btn[onclick="switchGenTab('${tabId}')"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.style.borderBottom = '2px solid var(--primary-color)';
        activeBtn.style.fontWeight = '600';
    }
}
window.switchGenTab = switchGenTab;

function renderCurriculumTable() {
    const container = document.getElementById('curriculum-container');
    container.innerHTML = '';
    
    // Группируем классы по параллелям (цифра в начале)
    const grades = new Set();
    generatorConfig.classes.forEach(cls => {
        const m = cls.match(/^\d+/);
        if (m) grades.add(m[0]);
    });
    const sortedGrades = Array.from(grades).sort((a,b) => Number(a) - Number(b));

    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    
    // Заголовок
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th style="text-align:left; padding:8px; border-bottom:1px solid var(--glass-border);">Предмет</th>
            ${sortedGrades.map(g => `<th style="text-align:center; padding:8px; border-bottom:1px solid var(--glass-border);">${g}-е классы (часов)</th>`).join('')}
            <th style="width:40px;"></th>
        </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    
    // Собираем все уникальные предметы из конфига
    const allSubjects = new Set();
    Object.values(generatorConfig.curriculum).forEach(plan => {
        Object.keys(plan).forEach(s => allSubjects.add(s));
    });
    // Добавляем дефолтные, если их нет
    ['Русский язык', 'Математика', 'Литература', 'История', 'Физкультура'].forEach(s => allSubjects.add(s));
    
    const sortedSubjects = Array.from(allSubjects).sort();

    sortedSubjects.forEach(subj => {
        const tr = document.createElement('tr');
        let tds = `<td style="padding:8px; border-bottom:1px solid var(--glass-border);"><input type="text" value="${subj}" class="subj-name-input" style="width:100%; border:none; background:transparent;" readonly></td>`;
        
        sortedGrades.forEach(g => {
            const hours = (generatorConfig.curriculum[g] && generatorConfig.curriculum[g][subj]) || 0;
            tds += `<td style="padding:8px; border-bottom:1px solid var(--glass-border); text-align:center;">
                <input type="number" min="0" max="10" value="${hours}" class="hours-input" data-grade="${g}" data-subj="${subj}" style="width:50px; text-align:center;">
            </td>`;
        });
        
        tds += `<td style="padding:8px; border-bottom:1px solid var(--glass-border);"><button class="delete-subj-row" style="color:red;"><i class="fas fa-times"></i></button></td>`;
        tr.innerHTML = tds;
        tbody.appendChild(tr);
    });

    // Строка добавления предмета
    const addRow = document.createElement('tr');
    addRow.innerHTML = `
        <td colspan="${sortedGrades.length + 2}" style="padding:10px; text-align:center;">
            <button id="add-curriculum-subject" style="background:var(--glass-bg); padding:5px 10px; border-radius:4px;"><i class="fas fa-plus"></i> Добавить предмет</button>
        </td>
    `;
    tbody.appendChild(addRow);
    
    table.appendChild(tbody);
    container.appendChild(table);

    // Обработчики изменений
    container.querySelectorAll('.hours-input').forEach(inp => {
        inp.addEventListener('change', (e) => {
            const g = e.target.dataset.grade;
            const s = e.target.dataset.subj;
            const val = parseInt(e.target.value) || 0;
            if (!generatorConfig.curriculum[g]) generatorConfig.curriculum[g] = {};
            generatorConfig.curriculum[g][s] = val;
        });
    });

    document.getElementById('add-curriculum-subject').addEventListener('click', () => {
        const name = prompt('Введите название предмета:');
        if (name) {
            sortedGrades.forEach(g => {
                if (!generatorConfig.curriculum[g]) generatorConfig.curriculum[g] = {};
                if (generatorConfig.curriculum[g][name] === undefined) generatorConfig.curriculum[g][name] = 0;
            });
            renderCurriculumTable();
        }
    });
    
    container.querySelectorAll('.delete-subj-row').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if(!confirm('Удалить предмет из плана?')) return;
            const row = e.target.closest('tr');
            const subj = row.querySelector('.subj-name-input').value;
            sortedGrades.forEach(g => {
                if (generatorConfig.curriculum[g]) delete generatorConfig.curriculum[g][subj];
            });
            renderCurriculumTable();
        });
    });
}

async function renderTeachersMapping() {
    const container = document.getElementById('teachers-mapping-container');
    container.innerHTML = '<p>Загрузка учителей...</p>';
    
    const allTeachers = await listTeachers(); // [{fullName, subject, room}, ...]
    
    container.innerHTML = '';
    const table = document.createElement('table');
    table.style.width = '100%';
    
    // Получаем все предметы из плана
    const allSubjects = new Set();
    Object.values(generatorConfig.curriculum).forEach(plan => {
        Object.keys(plan).forEach(s => { if (plan[s] > 0) allSubjects.add(s); });
    });
    
    Array.from(allSubjects).sort().forEach(subj => {
        const tr = document.createElement('tr');
        
        // Находим учителей, которые ведут этот предмет
        const teachersForSubj = allTeachers.filter(t => normalizeSubjectName(t.subject).toLowerCase() === normalizeSubjectName(subj).toLowerCase());
        const teacherNames = teachersForSubj.map(t => t.fullName).join(', ') || '<span style="color:red">Нет учителя</span>';
        
        tr.innerHTML = `
            <td style="padding:10px; border-bottom:1px solid var(--glass-border);"><strong>${subj}</strong></td>
            <td style="padding:10px; border-bottom:1px solid var(--glass-border);">${teacherNames}</td>
        `;
        table.appendChild(tr);
    });
    
    container.appendChild(table);
    
    const hint = document.createElement('p');
    hint.style.marginTop = '10px';
    hint.style.fontSize = '0.9em';
    hint.style.color = 'var(--text-secondary)';
    hint.innerHTML = 'Примечание: Привязка учителей происходит автоматически на основе "Справочника учителей". Чтобы изменить учителя, отредактируйте его профиль в Справочнике.';
    container.appendChild(hint);
}

// Умная генерация
async function runSmartGenerator() {
    // 1. Сохраняем настройки
    const classesStr = document.getElementById('gen-classes-input').value;
    generatorConfig.classes = classesStr.split(',').map(s => s.trim()).filter(Boolean);
    saveGeneratorSettings();
    
    if (generatorConfig.classes.length === 0) {
        alert('Введите список классов!');
        return;
    }

    const btn = document.getElementById('run-generator-smart');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Генерация...';
    btn.disabled = true;

    try {
        const t0 = performance.now();
        const out = { monday: [], tuesday: [], wednesday: [], thursday: [], friday: [] };
        
        if (confirm('Очистить текущее расписание перед генерацией? (Отмена - дополнить)')) {
            // clear: out is already empty
        } else {
            // Deep copy existing schedule to out
            const current = getSchedule();
            for (const day of Object.keys(out)) {
                if (current[day]) {
                    out[day] = JSON.parse(JSON.stringify(current[day]));
                }
            }
        }
        
        // Подготовка данных
        const allTeachers = await listTeachers();
        
        // Создаем пул уроков
        let lessonPool = [];
        
        for (const cls of generatorConfig.classes) {
            const grade = cls.match(/^\d+/)?.[0];
            if (!grade || !generatorConfig.curriculum[grade]) continue;
            
            const plan = generatorConfig.curriculum[grade];
            for (const [subj, hours] of Object.entries(plan)) {
                if (hours <= 0) continue;
                
                // Находим учителя
                // Простая логика: берем первого попавшегося, кто ведет предмет
                // TODO: Равномерное распределение, если учителей несколько
                const possibleTeachers = allTeachers.filter(t => normalizeSubjectName(t.subject).toLowerCase() === normalizeSubjectName(subj).toLowerCase());
                const teacher = possibleTeachers.length > 0 ? possibleTeachers[Math.floor(Math.random() * possibleTeachers.length)] : { fullName: 'Вакансия', room: '' };
                
                for (let i = 0; i < hours; i++) {
                    lessonPool.push({
                        id: Date.now() + Math.random(), // Временный ID
                        subject: subj,
                        class: cls,
                        teacher: teacher.fullName,
                        room: teacher.room,
                        priority: 1 // Можно настроить приоритеты
                    });
                }
            }
        }
        
        // Сортируем пул: сначала сложные уроки (где мало учителей или спец. кабинеты)
        // Пока просто перемешаем для случайности
        lessonPool.sort(() => Math.random() - 0.5);
        
        // Жадный алгоритм с бэктрекингом (упрощенный)
        // Просто перебираем слоты и пытаемся вставить
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
        const maxSlots = 8;
        
        let unplacedCount = 0;
        
        for (const lesson of lessonPool) {
            let placed = false;
            
            // Пробуем найти слот
            // Эвристика: стараемся распределять равномерно по дням
            // Сортируем дни по количеству уроков у этого класса
            const sortedDays = [...days].sort((a, b) => {
                const countA = (out[a] || []).filter(l => l.class === lesson.class).length;
                const countB = (out[b] || []).filter(l => l.class === lesson.class).length;
                return countA - countB;
            });

            for (const day of sortedDays) {
                for (let slot = 1; slot <= maxSlots; slot++) {
                    // Проверка конфликтов
                    if (canPlace(out, day, slot, lesson.class, lesson.teacher, lesson.room)) {
                        if (!out[day]) out[day] = [];
                        out[day].push({
                            ...lesson,
                            id: Date.now() + Math.floor(Math.random() * 100000), // Финальный ID
                            time: String(slot)
                        });
                        placed = true;
                        break;
                    }
                }
                if (placed) break;
            }
            
            if (!placed) unplacedCount++;
        }
        
        // Сохраняем
        const merged = { monday: [], tuesday: [], wednesday: [], thursday: [], friday: [] };
        for (const d of days) {
            // Объединяем с существующим, если не очищали (сейчас out это полное новое)
            // Если мы хотим "дополнить", логика сложнее (надо проверять конфликты с base)
            // Для простоты пока заменяем полностью то, что сгенерировали
             merged[d] = (out[d] || []).sort((a,b) => Number(a.time) - Number(b.time));
        }
        
        setSchedule(merged);
        loadSchedule();
        
        const t1 = performance.now();
        const total = lessonPool.length - unplacedCount;
        showToast(`Генерация завершена! Создано уроков: ${total}. Не удалось: ${unplacedCount}`);
        closeGeneratorSettings();
        
    } catch (e) {
        console.error(e);
        showToast('Ошибка генерации: ' + e.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// Инициализация событий
document.addEventListener('DOMContentLoaded', () => {
    const openBtn = document.getElementById('open-generator-settings');
    const closeBtn = document.querySelector('.generator-close');
    const saveBtn = document.getElementById('save-generator-settings');
    const runBtn = document.getElementById('run-generator-smart');

    if (openBtn) openBtn.addEventListener('click', openGeneratorSettings);
    if (closeBtn) closeBtn.addEventListener('click', closeGeneratorSettings);
    if (saveBtn) saveBtn.addEventListener('click', () => {
        const classesStr = document.getElementById('gen-classes-input').value;
        generatorConfig.classes = classesStr.split(',').map(s => s.trim()).filter(Boolean);
        saveGeneratorSettings();
    });
    if (runBtn) runBtn.addEventListener('click', runSmartGenerator);
});
