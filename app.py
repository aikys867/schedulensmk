from flask import Flask, render_template, request, jsonify, session, redirect, url_for
import sqlite3
import hashlib

app = Flask(__name__)
app.secret_key = "super-secret-key-change-in-production"
DB = "database.db"

# ---------- Работа с БД ----------
def db():
    """Открыть соединение с БД"""
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row  # чтобы получать dict-подобные строки
    return conn


def init_db():
    """Создать таблицы, если их нет"""
    conn = db()
    c = conn.cursor()

    c.execute("""CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        speciality TEXT,
        course INTEGER
    )""")

    c.execute("""CREATE TABLE IF NOT EXISTS teachers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        short_name TEXT,
        color TEXT
    )""")

    c.execute("""CREATE TABLE IF NOT EXISTS subjects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        short_name TEXT,
        teacher_id INTEGER
    )""")

    c.execute("""CREATE TABLE IF NOT EXISTS lessons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER,
        teacher_id INTEGER,
        subject_id INTEGER,
        day TEXT,
        week1 INTEGER,
        week2 INTEGER,
        room TEXT,
        lesson_type TEXT
    )""")

    c.execute("""CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'admin')""")

    # Создаём админа по умолчанию, если нет ни одного пользователя
    if c.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0:
        default_pass = hashlib.sha256("admin123".encode()).hexdigest()
        c.execute("INSERT INTO users (username, password_hash, role) VALUES (?,?,?)",
                  ("admin", default_pass, "admin"))

    conn.commit()
    conn.close()


# ---------- Главная страница ----------
@app.route("/")
def index():
    return render_template("index.html")


# ---------- API: Группы ----------
@app.route("/api/groups", methods=["GET", "POST"])
def groups():
    conn = db()
    if request.method == "POST":
        d = request.json
        conn.execute("INSERT INTO groups (name, speciality, course) VALUES (?,?,?)",
                     (d["name"], d.get("speciality", ""), d.get("course", 1)))
        conn.commit()
        conn.close()
        return jsonify({"ok": True})
    rows = conn.execute("SELECT * FROM groups").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


# ---------- API: Преподаватели ----------
@app.route("/api/teachers", methods=["GET", "POST"])
def teachers():
    conn = db()
    if request.method == "POST":
        d = request.json
        conn.execute("INSERT INTO teachers (name, short_name, color) VALUES (?,?,?)",
                     (d["name"], d.get("short_name", ""), d.get("color", "#3b82f6")))
        conn.commit()
        conn.close()
        return jsonify({"ok": True})
    rows = conn.execute("SELECT * FROM teachers").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


# ---------- API: Дисциплины ----------
@app.route("/api/subjects", methods=["GET", "POST"])
def subjects():
    conn = db()
    if request.method == "POST":
        d = request.json
        conn.execute("INSERT INTO subjects (name, short_name, teacher_id) VALUES (?,?,?)",
                     (d["name"], d.get("short_name", ""), d.get("teacher_id")))
        conn.commit()
        conn.close()
        return jsonify({"ok": True})
    rows = conn.execute("SELECT * FROM subjects").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


# ---------- API: Занятия ----------
@app.route("/api/lessons", methods=["GET", "POST"])
def lessons():
    conn = db()
    if request.method == "POST":
        d = request.json
        conn.execute("""INSERT INTO lessons
            (group_id, teacher_id, subject_id, day, week1, week2, room, lesson_type)
            VALUES (?,?,?,?,?,?,?,?)""",
            (d["group_id"], d["teacher_id"], d["subject_id"],
             d["day"], d["week1"], d["week2"], d.get("room", ""), d.get("lesson_type", "Лекция")))
        conn.commit()
        conn.close()
        return jsonify({"ok": True})

    rows = conn.execute("SELECT * FROM lessons").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/lessons/<int:lid>", methods=["DELETE", "PUT"])
def lesson_one(lid):
    conn = db()
    if request.method == "DELETE":
        conn.execute("DELETE FROM lessons WHERE id=?", (lid,))
    else:
        d = request.json
        conn.execute("""UPDATE lessons SET group_id=?, teacher_id=?, subject_id=?,
                       day=?, week1=?, week2=?, room=?, lesson_type=? WHERE id=?""",
                     (d["group_id"], d["teacher_id"], d["subject_id"], d["day"],
                      d["week1"], d["week2"], d.get("room", ""),
                      d.get("lesson_type", "Лекция"), lid))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})

# ---------- Авторизация ----------
@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")
        password_hash = hashlib.sha256(password.encode()).hexdigest()

        conn = db()
        user = conn.execute("SELECT * FROM users WHERE username=? AND password_hash=?",
                            (username, password_hash)).fetchone()
        conn.close()

        if user:
            session["user_id"] = user["id"]
            session["username"] = user["username"]
            return redirect("/")
        else:
            return render_template("login.html", error="Неверный логин или пароль")

    return render_template("login.html")


@app.route("/logout")
def logout():
    session.clear()
    return redirect("/login")


# ---------- Проверка авторизации ----------
@app.before_request
def require_login():
    # Пропускаем страницу логина, статику и выход
    if request.path in ("/login", "/logout"):
        return
    if request.path.startswith("/static/"):
        return
    if "user_id" not in session:
        return redirect("/login")

# ---------- Запуск ----------

# ---------- Экспорт / Импорт JSON ----------
@app.route("/api/export", methods=["GET"])
def export_json():
    conn = db()
    data = {
        "groups":    [dict(r) for r in conn.execute("SELECT * FROM groups").fetchall()],
        "teachers":  [dict(r) for r in conn.execute("SELECT * FROM teachers").fetchall()],
        "subjects":  [dict(r) for r in conn.execute("SELECT * FROM subjects").fetchall()],
        "lessons":   [dict(r) for r in conn.execute("SELECT * FROM lessons").fetchall()],
    }
    conn.close()
    return jsonify(data)


@app.route("/api/import", methods=["POST"])
def import_json():
    d = request.json
    conn = db()
    conn.execute("DELETE FROM lessons")
    conn.execute("DELETE FROM subjects")
    conn.execute("DELETE FROM teachers")
    conn.execute("DELETE FROM groups")
    for g in d.get("groups", []):
        conn.execute("INSERT INTO groups (id, name, speciality, course) VALUES (?,?,?,?)",
                     (g["id"], g["name"], g.get("speciality", ""), g.get("course", 1)))
    for t in d.get("teachers", []):
        conn.execute("INSERT INTO teachers (id, name, short_name, color) VALUES (?,?,?,?)",
                     (t["id"], t["name"], t.get("short_name", ""), t.get("color", "#3b82f6")))
    for s in d.get("subjects", []):
        conn.execute("INSERT INTO subjects (id, name, short_name, teacher_id) VALUES (?,?,?,?)",
                     (s["id"], s["name"], s.get("short_name", ""), s.get("teacher_id")))
    for l in d.get("lessons", []):
        conn.execute("""INSERT INTO lessons
            (id, group_id, teacher_id, subject_id, day, week1, week2, room, lesson_type)
            VALUES (?,?,?,?,?,?,?,?,?)""",
            (l["id"], l["group_id"], l["teacher_id"], l["subject_id"], l["day"],
             l["week1"], l["week2"], l.get("room", ""), l.get("lesson_type", "Лекция")))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


# ---------- Удаление в справочниках ----------
@app.route("/api/groups/<int:gid>", methods=["DELETE"])
def delete_group(gid):
    conn = db()
    conn.execute("DELETE FROM lessons WHERE group_id=?", (gid,))
    conn.execute("DELETE FROM groups WHERE id=?", (gid,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/teachers/<int:tid>", methods=["DELETE"])
def delete_teacher(tid):
    conn = db()
    conn.execute("DELETE FROM lessons WHERE teacher_id=?", (tid,))
    conn.execute("DELETE FROM subjects WHERE teacher_id=?", (tid,))
    conn.execute("DELETE FROM teachers WHERE id=?", (tid,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/subjects/<int:sid>", methods=["DELETE"])
def delete_subject(sid):
    conn = db()
    conn.execute("DELETE FROM lessons WHERE subject_id=?", (sid,))
    conn.execute("DELETE FROM subjects WHERE id=?", (sid,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


if __name__ == "__main__":
    init_db()
    app.run(debug=True)