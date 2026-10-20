// ================= НАСТРОЙКИ БАЗЫ ДАННЫХ =================
// Ваша ссылка на jsonblob (уже вставлена)
const DB_URL =
  "https://jsonblob.com/api/jsonBlob/01a158b7-d34a-79d1-9bf4-81e33768397f";

// Email и пароль владельца (преподавателя), который видит всё
const OWNER_EMAIL = "owner@disk.com";
const OWNER_PASSWORD = "owner123";
// =========================================================

let db = { users: [], folders: [] };
let currentUser = null;
let useLocalStorageFallback = false; // Включится автоматически, если jsonblob заблокирует запрос (CORS)

// --- РАБОТА С БАЗОЙ ДАННЫХ ---
async function loadDB() {
  if (useLocalStorageFallback) {
    const saved = localStorage.getItem("mockDiskDB");
    if (saved) db = JSON.parse(saved);
    return;
  }
  try {
    const response = await fetch(DB_URL);
    if (!response.ok) throw new Error("Network error");
    db = await response.json();
    // Инициализация структуры, если база пустая
    if (!db.users) db.users = [];
    if (!db.folders) db.folders = [];
  } catch (error) {
    console.warn(
      "Jsonblob заблокировал запрос (CORS). Переключаюсь на локальный режим демонстрации.",
      error,
    );
    useLocalStorageFallback = true;
    const saved = localStorage.getItem("mockDiskDB");
    if (saved) {
      db = JSON.parse(saved);
    } else {
      db = { users: [], folders: [] };
      // Создаем владельца по умолчанию для демонстрации
      createUserInDB("Преподаватель", OWNER_EMAIL, OWNER_PASSWORD, true);
    }
  }
}

async function saveDB() {
  if (useLocalStorageFallback) {
    localStorage.setItem("mockDiskDB", JSON.stringify(db));
    return;
  }
  try {
    await fetch(DB_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(db),
    });
  } catch (error) {
    console.error("Ошибка сохранения:", error);
    alert(
      "Не удалось сохранить данные в облако. Проверьте интернет или используйте локальный режим.",
    );
  }
}

// --- ЛОГИКА ПОЛЬЗОВАТЕЛЕЙ И ПАПОК ---
function createUserInDB(name, email, password, isOwner = false) {
  const userId = "user_" + Date.now();
  const newUser = { id: userId, name, email, password, isOwner };
  db.users.push(newUser);

  // АВТОМАТИЧЕСКОЕ СОЗДАНИЕ ПАПКИ С ИМЕНЕМ ПОЛЬЗОВАТЕЛЯ
  const newFolder = {
    id: "folder_" + Date.now(),
    name: name, // Имя папки = Имя пользователя
    ownerId: userId,
    ownerName: name,
    files: [],
  };
  db.folders.push(newFolder);
  return newUser;
}

// --- ИНТЕРФЕЙС И АВТОРИЗАЦИЯ ---
let isRegisterMode = false;

document.getElementById("toggleAuthBtn").addEventListener("click", () => {
  isRegisterMode = !isRegisterMode;
  document.getElementById("authTitle").textContent = isRegisterMode
    ? "Регистрация"
    : "Вход в систему";
  document.getElementById("authBtn").textContent = isRegisterMode
    ? "Зарегистрироваться"
    : "Войти";
  document.getElementById("toggleAuthBtn").textContent = isRegisterMode
    ? "Уже есть аккаунт? Войти"
    : "Нет аккаунта? Зарегистрироваться";
  document
    .getElementById("nameGroup")
    .classList.toggle("hidden", !isRegisterMode);
  document
    .getElementById("confirmPasswordGroup")
    .classList.toggle("hidden", !isRegisterMode);
  showMessage("");
});

document.getElementById("authForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  showMessage("Загрузка...", "success");
  await loadDB();

  const email = document
    .getElementById("emailInput")
    .value.trim()
    .toLowerCase();
  const password = document.getElementById("passwordInput").value;
  const name = document.getElementById("nameInput").value.trim();
  const confirmPassword = document.getElementById("confirmPasswordInput").value;

  if (isRegisterMode) {
    if (!name) return showMessage("Введите ваше имя", "error");
    if (password !== confirmPassword)
      return showMessage("Пароли не совпадают", "error");
    if (password.length < 4)
      return showMessage("Пароль минимум 4 символа", "error");
    if (db.users.find((u) => u.email === email))
      return showMessage("Этот email уже занят", "error");

    const newUser = createUserInDB(name, email, password, false);
    await saveDB();
    login(newUser);
  } else {
    // Проверка на владельца (преподавателя)
    if (email === OWNER_EMAIL && password === OWNER_PASSWORD) {
      let owner = db.users.find((u) => u.email === OWNER_EMAIL);
      if (!owner) {
        owner = createUserInDB(
          "Преподаватель",
          OWNER_EMAIL,
          OWNER_PASSWORD,
          true,
        );
        await saveDB();
      }
      login(owner);
      return;
    }

    const user = db.users.find(
      (u) => u.email === email && u.password === password,
    );
    if (user) {
      login(user);
    } else {
      showMessage("Неверный email или пароль", "error");
    }
  }
});

function login(user) {
  currentUser = user;
  localStorage.setItem("currentUser", JSON.stringify(user));
  document.getElementById("authScreen").classList.remove("active");
  document.getElementById("diskScreen").classList.add("active");

  document.getElementById("displayUserName").textContent = user.name;
  document.getElementById("displayUserEmail").textContent = user.email;

  // Настройка интерфейса в зависимости от роли
  if (user.isOwner) {
    document.getElementById("navAllFolders").classList.remove("hidden");
    document.getElementById("navMyFolder").classList.add("hidden");
    document.getElementById("uploadBtn").classList.add("hidden"); // Владелец только смотрит
    showAllFolders();
  } else {
    document.getElementById("navAllFolders").classList.add("hidden");
    document.getElementById("navMyFolder").classList.remove("hidden");
    document.getElementById("navMyFolder").classList.add("active");
    document.getElementById("uploadBtn").classList.remove("hidden");
    showMyFolder();
  }
}

function logout() {
  currentUser = null;
  localStorage.removeItem("currentUser");
  document.getElementById("diskScreen").classList.remove("active");
  document.getElementById("authScreen").classList.add("active");
  document.getElementById("authForm").reset();
  showMessage("");
}

// --- ОТОБРАЖЕНИЕ ДАННЫХ ---
async function showMyFolder() {
  await loadDB();
  document.getElementById("pageTitle").textContent =
    `Моя папка: ${currentUser.name}`;
  const myFolder = db.folders.find((f) => f.ownerId === currentUser.id);
  renderItems(myFolder ? myFolder.files : [], false);
}

async function showAllFolders() {
  await loadDB();
  document.getElementById("pageTitle").textContent =
    "Все папки пользователей (Режим Преподавателя)";
  renderFolders(db.folders);
}

function renderItems(files, showOwnerName) {
  const grid = document.getElementById("itemsGrid");
  const empty = document.getElementById("emptyState");
  grid.innerHTML = "";

  if (!files || files.length === 0) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  files.forEach((file) => {
    const card = document.createElement("div");
    card.className = "item-card";
    card.innerHTML = `
            <div class="item-icon">${getFileIcon(file.type)}</div>
            <div class="item-name">${file.name}</div>
            <div class="item-meta">${formatSize(file.size)}</div>
            ${showOwnerName ? `<div class="item-owner">Владелец: ${file.ownerName}</div>` : ""}
            <div class="item-actions">
                <button class="btn-small btn-download" onclick="downloadFile('${file.id}')">Скачать</button>
                ${!currentUser.isOwner ? `<button class="btn-small btn-delete" onclick="deleteFile('${file.id}')">Удалить</button>` : ""}
            </div>
        `;
    grid.appendChild(card);
  });
}

function renderFolders(folders) {
  const grid = document.getElementById("itemsGrid");
  const empty = document.getElementById("emptyState");
  grid.innerHTML = "";

  if (folders.length === 0) {
    empty.classList.remove("hidden");
    document.querySelector("#emptyState h3").textContent =
      "Нет зарегистрированных пользователей";
    return;
  }
  empty.classList.add("hidden");
  document.querySelector("#emptyState h3").textContent = "Папка пуста"; // сброс текста

  folders.forEach((folder) => {
    const card = document.createElement("div");
    card.className = "item-card";
    card.style.cursor = "pointer";
    card.onclick = (e) => {
      if (!e.target.closest("button")) viewFolderContents(folder);
    };

    card.innerHTML = `
            <div class="item-icon">📁</div>
            <div class="item-name">${folder.name}</div>
            <div class="item-meta">Файлов: ${folder.files ? folder.files.length : 0}</div>
            <div class="item-owner">Студент: ${folder.ownerName}</div>
            <div class="item-actions">
                <button class="btn-small btn-open" onclick="event.stopPropagation(); viewFolderContents(db.folders.find(f=>f.id==='${folder.id}'))">Открыть</button>
            </div>
        `;
    grid.appendChild(card);
  });
}

function viewFolderContents(folder) {
  document.getElementById("pageTitle").textContent =
    `Папка: ${folder.name} (Студент: ${folder.ownerName})`;
  const uploadBtn = document.getElementById("uploadBtn");
  const originalText = uploadBtn.textContent;
  uploadBtn.textContent = "← Назад ко всем папкам";
  uploadBtn.onclick = () => {
    uploadBtn.textContent = originalText;
    uploadBtn.onclick = () => document.getElementById("fileInput").click();
    showAllFolders();
  };

  renderItems(folder.files, true);
  window.currentViewFolder = folder;
}

// --- ЗАГРУЗКА И УПРАВЛЕНИЕ ФАЙЛАМИ ---
async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) {
    alert(
      "Файл слишком большой! Максимум 2 МБ (ограничение демо-режима для JSON).",
    );
    event.target.value = "";
    return;
  }

  showMessage("Загрузка файла...", "success");
  const reader = new FileReader();

  reader.onload = async (e) => {
    await loadDB();
    const myFolder = db.folders.find((f) => f.ownerId === currentUser.id);

    const newFile = {
      id: "file_" + Date.now(),
      name: file.name,
      size: file.size,
      type: file.type,
      data: e.target.result, // Base64 данные файла
      ownerName: currentUser.name,
      ownerId: currentUser.id,
    };

    myFolder.files.push(newFile);
    await saveDB();
    showMessage("Файл успешно загружен!", "success");
    showMyFolder();
    event.target.value = "";
  };

  reader.readAsDataURL(file);
}

window.downloadFile = function (fileId) {
  let file;
  if (window.currentViewFolder) {
    file = window.currentViewFolder.files.find((f) => f.id === fileId);
  } else {
    const myFolder = db.folders.find((f) => f.ownerId === currentUser.id);
    file = myFolder.files.find((f) => f.id === fileId);
  }

  if (file && file.data) {
    const a = document.createElement("a");
    a.href = file.data;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
};

window.deleteFile = async function (fileId) {
  if (!confirm("Удалить этот файл?")) return;
  await loadDB();
  const myFolder = db.folders.find((f) => f.ownerId === currentUser.id);
  myFolder.files = myFolder.files.filter((f) => f.id !== fileId);
  await saveDB();
  showMyFolder();
};

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
function getFileIcon(type) {
  if (!type) return "📄";
  if (type.includes("image")) return "🖼️";
  if (type.includes("pdf")) return "📕";
  if (type.includes("word") || type.includes("document")) return "📘";
  if (type.includes("excel") || type.includes("sheet")) return "📊";
  if (type.includes("zip") || type.includes("rar")) return "📦";
  return "📄";
}

function formatSize(bytes) {
  if (bytes === 0) return "0 Б";
  const k = 1024;
  const sizes = ["Б", "КБ", "МБ", "ГБ"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function showMessage(text, type = "") {
  const el = document.getElementById("authMessage");
  el.textContent = text;
  el.className =
    "message " +
    (type === "error" ? "error" : type === "success" ? "success" : "hidden");
  if (!text) el.classList.add("hidden");
}

// --- ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ ---
window.addEventListener("DOMContentLoaded", async () => {
  await loadDB();
  const savedUser = localStorage.getItem("currentUser");
  if (savedUser) {
    const user = JSON.parse(savedUser);
    const exists = db.users.find((u) => u.id === user.id);
    if (exists) {
      login(exists);
    } else {
      localStorage.removeItem("currentUser");
    }
  }
});
