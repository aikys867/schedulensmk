// ====== Глобальное состояние ======
let groups = [], teachers = [], subjects = [], lessons = [];
const DAYS = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];

const BELL_TIMES = {
    1: { normal: "9:00–10:35", monday: "10:00–11:35" },
    2: { normal: "10:45–12:20", monday: "11:45–13:20" },
    3: { normal: "13:05–14:40", monday: "14:05–15:40" },
    4: { normal: "14:50–16:25", monday: "15:50–17:25" }
};
const MONTHS = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря"
];
const WEEKDAYS = [
    "воскресенье", "понедельник", "вторник",
    "среда", "четверг", "пятница", "суббота"
];

// Дата начала учебного года — от неё считаем недели
const SEMESTER_START = new Date("2026-09-01");


async function loadAll() {
    groups   = await (await fetch("/api/groups")).json();
    teachers = await (await fetch("/api/teachers")).json();
    subjects = await (await fetch("/api/subjects")).json();
    lessons  = await (await fetch("/api/lessons")).json();
    renderTable();
    renderTeachers();
    fillSelects();
}

function renderTable() {
    const table = document.getElementById("schedule");
    let html = "";
    html += "<tr><th>День / Пара</th>";
    for (const g of groups) {
        html += `<th class="group-head">
            ${g.name}<small>${g.speciality || ""}</small>
            <button onclick="event.stopPropagation();deleteGroup(${g.id})" title="Удалить группу"
                    style="float:right;background:none;border:none;color:#dc2626;font-size:14px;cursor:pointer">✕</button>
        </th>`;
    }
    html += "</tr>";

    for (const day of DAYS) {
        html += `<tr><td class="day-cell" colspan="${groups.length + 1}">${day.toUpperCase()}</td></tr>`;
        for (let pair = 1; pair <= 4; pair++) {
		const times = BELL_TIMES[pair];
		const timeStr = day === "Понедельник" ? 		times.monday : times.normal;
		html += `<tr><td class="day-cell">${pair} пара<br><small class="pair-time">${timeStr}</small></td>`;
            for (const g of groups) {
                const l = lessons.find(x =>
                    x.group_id === g.id && x.day === day &&
                    (x.week1 === pair || x.week2 === pair)
                );
                if (l) {
                    html += `<td class="slot" data-group="${g.id}" data-day="${day}" data-pair="${pair}">
                        ${cardHTML(l)}</td>`;
                } else {
                    html += `<td class="slot empty" data-group="${g.id}" data-day="${day}" data-pair="${pair}"></td>`;
                }
            }
            html += "</tr>";
        }
    }
    table.innerHTML = html;

    document.querySelectorAll(".card").forEach(c => {
        c.draggable = true;
        c.addEventListener("dragstart", e => e.dataTransfer.setData("lessonId", c.dataset.id));
    });

    document.querySelectorAll("td.slot").forEach(cell => {
        cell.addEventListener("dragover", e => e.preventDefault());
        cell.addEventListener("drop", async e => {
            e.preventDefault();
            const lesson = lessons.find(l => l.id == e.dataTransfer.getData("lessonId"));
            if (!lesson) return;
            lesson.group_id = parseInt(cell.dataset.group);
            lesson.day = cell.dataset.day;
            const p = parseInt(cell.dataset.pair);
            if (lesson.week1 !== 0) lesson.week1 = p;
            if (lesson.week2 !== 0) lesson.week2 = p;
            await fetch(`/api/lessons/${lesson.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(lesson)
            });
            loadAll();
        });
    });
}

function cardHTML(l) {
    const t = teachers.find(x => x.id === l.teacher_id) || {};
    const s = subjects.find(x => x.id === l.subject_id) || {};
    return `<div class="card" data-id="${l.id}" style="background:${t.color || "#3b82f6"}"
                onclick="editLesson(${l.id})">
        <span class="code">${s.short_name || s.name || ""}</span>
        <div class="title">${s.name || ""}</div>
        <div class="teacher">${t.short_name || t.name || ""}</div>
        <div class="meta">1н: ${l.week1 || "—"} &nbsp; 2н: ${l.week2 || "—"}</div>
        <div class="room">${l.room || ""}</div>
    </div>`;
}

function renderTeachers() {
    const box = document.getElementById("teacherList");
    box.innerHTML = "";
    for (const t of teachers) {
        const div = document.createElement("div");
        div.className = "teacher-item";
        const subsHtml = subjects
            .filter(s => s.teacher_id === t.id)
            .map(s => `<span style="display:inline-block;margin-right:6px;margin-bottom:2px">
                ${s.name}
                <button onclick="event.stopPropagation();deleteSubject(${s.id})" title="Удалить дисциплину"
                        style="background:none;border:none;color:#dc2626;cursor:pointer;font-size:11px;padding:0">✕</button>
            </span>`)
            .join("");
        div.innerHTML = `
            <div class="teacher-dot" style="background:${t.color}">${t.short_name || t.name[0]}</div>
            <div style="flex:1">
                <div class="teacher-name">${t.name}</div>
                <div class="teacher-sub">${subsHtml}</div>
            </div>
            <button onclick="deleteTeacher(${t.id})" title="Удалить преподавателя"
                    style="background:none;border:none;color:#dc2626;font-size:16px;cursor:pointer">✕</button>`;
        box.appendChild(div);
    }
}

function fillSelects() {
    document.getElementById("mGroup").innerHTML   = groups.map(g => `<option value="${g.id}">${g.name}</option>`).join("");
    document.getElementById("mTeacher").innerHTML = teachers.map(t => `<option value="${t.id}">${t.name}</option>`).join("");
    fillSubjects();
    document.getElementById("filterGroup").innerHTML = `<option value="">Все группы</option>` +
        groups.map(g => `<option value="${g.id}">${g.name}</option>`).join("");
}

function fillSubjects() {
    const tid = parseInt(document.getElementById("mTeacher").value);
    const list = subjects.filter(s => s.teacher_id === tid);
    document.getElementById("mSubject").innerHTML = list.map(s => `<option value="${s.id}">${s.name}</option>`).join("");
}

function openAddLesson() {
    if (groups.length === 0 || teachers.length === 0) {
        alert("Сначала добавьте хотя бы одну группу и преподавателя!");
        return;
    }
    document.getElementById("modalTitle").textContent = "Добавление занятия";
    document.getElementById("mId").value = "";
    document.getElementById("mGroup").selectedIndex = 0;
    document.getElementById("mDay").selectedIndex = 0;
    document.getElementById("mTeacher").selectedIndex = 0;
    fillSubjects();
    document.getElementById("mW1").value = "0";
    document.getElementById("mW2").value = "0";
    document.getElementById("mRoom").value = "";
    document.getElementById("mType").selectedIndex = 0;
    const delBtn = document.getElementById("delBtn");
    if (delBtn) delBtn.remove();
    document.getElementById("modal").classList.add("open");
}

function closeModal() {
    document.getElementById("modal").classList.remove("open");
}

async function saveLesson() {
    const id = document.getElementById("mId").value;
    const data = {
        group_id:   parseInt(document.getElementById("mGroup").value),
        teacher_id: parseInt(document.getElementById("mTeacher").value),
        subject_id: parseInt(document.getElementById("mSubject").value),
        day:        document.getElementById("mDay").value,
        week1:      parseInt(document.getElementById("mW1").value),
        week2:      parseInt(document.getElementById("mW2").value),
        room:       document.getElementById("mRoom").value,
        lesson_type:document.getElementById("mType").value
    };
    if (!data.week1 && !data.week2) {
        alert("Укажите хотя бы одну неделю!");
        return;
    }
    const conflict = checkConflicts(data, id ? parseInt(id) : null);
    if (conflict) {
        alert("КОНФЛИКТ!\n\n" + conflict);
        return;
    }
    if (id) {
        await fetch(`/api/lessons/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
    } else {
        await fetch("/api/lessons", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
    }
    closeModal();
    loadAll();
}

function editLesson(id) {
    const lesson = lessons.find(l => l.id === id);
    if (!lesson) return;
    document.getElementById("modalTitle").textContent = "Редактирование занятия";
    document.getElementById("mId").value = lesson.id;
    document.getElementById("mGroup").value = lesson.group_id;
    document.getElementById("mDay").value = lesson.day;
    document.getElementById("mTeacher").value = lesson.teacher_id;
    fillSubjects();
    document.getElementById("mSubject").value = lesson.subject_id;
    document.getElementById("mW1").value = lesson.week1;
    document.getElementById("mW2").value = lesson.week2;
    document.getElementById("mRoom").value = lesson.room || "";
    document.getElementById("mType").value = lesson.lesson_type || "Лекция";

    const actions = document.querySelector(".modal-actions");
    let delBtn = document.getElementById("delBtn");
    if (!delBtn) {
        delBtn = document.createElement("button");
        delBtn.id = "delBtn";
        delBtn.textContent = "🗑 Удалить";
        delBtn.style.background = "#dc2626";
        delBtn.style.color = "#fff";
        delBtn.style.borderColor = "#dc2626";
        delBtn.onclick = async () => {
            if (!confirm("Удалить занятие?")) return;
            await fetch(`/api/lessons/${lesson.id}`, { method: "DELETE" });
            closeModal();
            loadAll();
        };
        actions.insertBefore(delBtn, actions.firstChild);
    }
    document.getElementById("modal").classList.add("open");
}

function checkConflicts(data, excludeId) {
    const pairsToCheck = [];
    if (data.week1 > 0) pairsToCheck.push(data.week1);
    if (data.week2 > 0) pairsToCheck.push(data.week2);

    for (const l of lessons) {
        if (l.id === excludeId) continue;
        if (l.day !== data.day) continue;
        for (const pair of pairsToCheck) {
            const sameWeek1 = (l.week1 === pair && data.week1 === pair);
            const sameWeek2 = (l.week2 === pair && data.week2 === pair);
            if (!sameWeek1 && !sameWeek2) continue;
            if (l.teacher_id === data.teacher_id) {
                const t = teachers.find(x => x.id === l.teacher_id);
                return `Преподаватель ${t ? t.name : ""} уже занят:\n${data.day}, ${pair} пара`;
            }
            if (l.group_id === data.group_id) {
                const g = groups.find(x => x.id === l.group_id);
                return `Группа ${g ? g.name : ""} уже имеет занятие:\n${data.day}, ${pair} пара`;
            }
        }
    }
    return null;
}

async function clearAll() {
    if (!confirm("Удалить ВСЕ занятия?")) return;
    for (const l of lessons) {
        await fetch(`/api/lessons/${l.id}`, { method: "DELETE" });
    }
    loadAll();
}

async function deleteLast() {
    if (lessons.length === 0) return;
    await fetch(`/api/lessons/${lessons[lessons.length - 1].id}`, { method: "DELETE" });
    loadAll();
}

async function deleteTeacher(id) {
    if (!confirm("Удалить преподавателя? Все его занятия тоже удалятся.")) return;
    await fetch(`/api/teachers/${id}`, { method: "DELETE" });
    loadAll();
}

async function deleteGroup(id) {
    if (!confirm("Удалить группу? Все её занятия тоже удалятся.")) return;
    await fetch(`/api/groups/${id}`, { method: "DELETE" });
    loadAll();
}

async function deleteSubject(id) {
    if (!confirm("Удалить дисциплину?")) return;
    await fetch(`/api/subjects/${id}`, { method: "DELETE" });
    loadAll();
}

async function openTeachers() {
    const name  = prompt("ФИО преподавателя:");
    if (!name) return;
    const short = prompt("Краткое обозначение (ИВ):", name.split(" ").map(w => w[0]).join(""));
    const color = prompt("Цвет (hex):", "#3b82f6");
    await fetch("/api/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, short_name: short, color })
    });
    loadAll();
}

async function openSubjects() {
    if (teachers.length === 0) { alert("Сначала добавьте преподавателя"); return; }
    const name  = prompt("Название дисциплины:");
    if (!name) return;
    const short = prompt("Сокращённое:", name.slice(0, 4).toUpperCase());
    const tid   = parseInt(prompt("ID преподавателя:\n" +
        teachers.map(t => `${t.id} — ${t.name}`).join("\n")));
    await fetch("/api/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, short_name: short, teacher_id: tid })
    });
    loadAll();
}

async function openGroups() {
    const name  = prompt("Название группы (П-21):");
    if (!name) return;
    const spec  = prompt("Специальность:", "Программирование");
    const course = parseInt(prompt("Курс:", "2"));
    await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, speciality: spec, course })
    });
    loadAll();
}

async function exportJSON() {
    const data = await (await fetch("/api/export")).json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "schedule_backup.json";
    a.click();
    URL.revokeObjectURL(url);
}

async function importJSON() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;
        const text = await file.text();
        try {
            const data = JSON.parse(text);
            await fetch("/api/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            alert("Импорт выполнен!");
            loadAll();
        } catch (e) {
            alert("Ошибка чтения файла: " + e.message);
        }
    };
    input.click();
}

// ====== Тёмная тема ======
function toggleTheme() {
    const isDark = document.body.classList.toggle("dark");
    document.getElementById("themeBtn").textContent = isDark ? "☀️" : "🌙";
    localStorage.setItem("theme", isDark ? "dark" : "light");
}

function applySavedTheme() {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
        document.body.classList.add("dark");
        document.getElementById("themeBtn").textContent = "☀️";
    }
}

// ====== Календарь / дата ======
function getCurrentDate() {
    const input = document.getElementById("datePicker");
    if (!input.value) return new Date();
    return new Date(input.value);
}

function getWeekNumber(date) {
    // Считаем количество недель от начала семестра
    const diffMs = date - SEMESTER_START;
    const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
    // 1-я неделя, если чётное, иначе 2-я (циклично 1-2-1-2)
    return (diffWeeks % 2 === 0) ? 1 : 2;
}

function updateDateLabel() {
    const d = getCurrentDate();
    const dayName = WEEKDAYS[d.getDay()];
    const monthName = MONTHS[d.getMonth()];
    const week = getWeekNumber(d);

    const label = document.getElementById("dateLabel");
    label.textContent = `Расписание на ${d.getDate()} ${monthName} ${d.getFullYear()} (${dayName}) — ${week}-я неделя`;
}

function onDateChange() {
    updateDateLabel();
}

function goToday() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    document.getElementById("datePicker").value = `${yyyy}-${mm}-${dd}`;
    updateDateLabel();
}

function initDatePicker() {
    // Если поле пустое — ставим сегодня
    const input = document.getElementById("datePicker");
    if (!input.value) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, "0");
        const dd = String(today.getDate()).padStart(2, "0");
        input.value = `${yyyy}-${mm}-${dd}`;
    }
    updateDateLabel();
}

applySavedTheme();
initDatePicker();
loadAll();