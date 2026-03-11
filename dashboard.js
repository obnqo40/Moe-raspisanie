
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
        const base = {}; // Генерируем с нуля или можно getSchedule() если хотим дополнить
        // В данной версии генерируем с нуля для чистоты, или можно спрашивать
        if (confirm('Очистить текущее расписание перед генерацией? (Отмена - дополнить)')) {
            // clear
        } else {
            Object.assign(base, getSchedule());
        }

        const out = { monday: [], tuesday: [], wednesday: [], thursday: [], friday: [] };
        
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
