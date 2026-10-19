// Хранилище данных
let currentUser = null;
let currentFolder = null;
let isLoginMode = true;
let currentSection = "files";

// Инициализация при загрузке
window.onload = function () {
  const savedUser = localStorage.getItem("currentUser");
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    showDisk();
  }
};

// Переключение между входом и регистрацией
document.getElementById("toggleAuthBtn").onclick = function () {
  isLoginMode = !isLoginMode;
  document.getElementById("authTitle").textContent = isLoginMode
    ? "Вход в аккаунт"
    : "Создать аккаунт";
  document.getElementById("authBtn").textContent = isLoginMode
    ? "Войти"
    : "Зарегистрироваться";
  this.textContent = isLoginMode ? "Создать аккаунт" : "Уже есть аккаунт";
  document.getElementById("nameGroup").style.display = isLoginMode
    ? "none"
    : "block";
  document.getElementById("errorMessage").classList.add("hidden");
};

// Обработка формы авторизации
document.getElementById("authForm").onsubmit = function (e) {
  e.preventDefault();

  const email = document.getElementById("emailInput").value;
  const password = document.getElementById("passwordInput").value;
  const name = document.getElementById("nameInput").value;

  if (isLoginMode) {
    const users = JSON.parse(localStorage.getItem("users") || "[]");
    const user = users.find(
      (u) => u.email === email && u.password === password,
    );

    if (user) {
      currentUser = user;
      localStorage.setItem("currentUser", JSON.stringify(user));
      showDisk();
    } else {
      showError("Неверный email или пароль");
    }
  } else {
    if (!name) {
      showError("Введите имя");
      return;
    }

    const users = JSON.parse(localStorage.getItem("users") || "[]");

    if (users.find((u) => u.email === email)) {
      showError("Email уже зарегистрирован");
      return;
    }

    const newUser = {
      id: Date.now(),
      email,
      password,
      name,
      folders: [],
      files: [],
    };

    users.push(newUser);
    localStorage.setItem("users", JSON.stringify(users));

    currentUser = newUser;
    localStorage.setItem("currentUser", JSON.stringify(newUser));
    showDisk();
  }
};

function showError(message) {
  const errorDiv = document.getElementById("errorMessage");
  errorDiv.textContent = message;
  errorDiv.classList.remove("hidden");
}

function showDisk() {
  document.getElementById("authPage").style.display = "none";
  document.getElementById("diskPage").style.display = "flex";
  document.getElementById("userName").textContent =
    `Привет, ${currentUser.name}`;
  loadContent();
  updateStorageInfo();
}

function logout() {
  localStorage.removeItem("currentUser");
  currentUser = null;
  currentFolder = null;
  document.getElementById("authPage").style.display = "flex";
  document.getElementById("diskPage").style.display = "none";
  document.getElementById("emailInput").value = "";
  document.getElementById("passwordInput").value = "";
  document.getElementById("nameInput").value = "";
}

function switchSection(section, element) {
  currentSection = section;

  // Убираем активный класс у всех
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.remove("active");
  });

  // Добавляем активный класс выбранному
  element.classList.add("active");

  // Обновляем путь
  const pathNames = {
    recent: "Последние",
    files: "Мой диск",
    photos: "Фото",
    albums: "Альбомы",
    shared: "Общий доступ",
    family: "Семья",
    downloads: "Загрузки",
    trash: "Корзина",
    history: "История",
    storage: "Управление местом",
  };

  document.getElementById("currentPath").textContent =
    pathNames[section] || "Мой диск";

  // Загружаем контент в зависимости от раздела
  if (section === "files") {
    currentFolder = null;
    loadContent();
  } else if (section === "trash") {
    showTrash();
  } else {
    showSectionPlaceholder(section);
  }
}

function showSectionPlaceholder(section) {
  const emptyState = document.getElementById("emptyState");
  const foldersSection = document.getElementById("foldersSection");
  const filesSection = document.getElementById("filesSection");

  emptyState.classList.remove("hidden");
  foldersSection.classList.add("hidden");
  filesSection.classList.add("hidden");

  const titles = {
    recent: "Последние файлы",
    photos: "Фотографии",
    albums: "Альбомы",
    shared: "Общий доступ",
    family: "Семейный доступ",
    downloads: "Загрузки",
    history: "История действий",
    storage: "Управление хранилищем",
  };

  emptyState.querySelector("h3").textContent = titles[section] || "Раздел";
  emptyState.querySelector("p").textContent =
    "Этот раздел находится в разработке";
}

function showTrash() {
  const emptyState = document.getElementById("emptyState");
  const foldersSection = document.getElementById("foldersSection");
  const filesSection = document.getElementById("filesSection");

  emptyState.classList.remove("hidden");
  foldersSection.classList.add("hidden");
  filesSection.classList.add("hidden");

  emptyState.querySelector("h3").textContent = "Корзина пуста";
  emptyState.querySelector("p").textContent =
    "Удаленные файлы будут отображаться здесь";
}

function loadContent() {
  const users = JSON.parse(localStorage.getItem("users") || "[]");
  const user = users.find((u) => u.id === currentUser.id);

  if (!user) return;

  const folders = currentFolder
    ? user.folders.filter((f) => f.parentId === currentFolder)
    : user.folders.filter((f) => !f.parentId);

  const files = user.files.filter((f) => f.folderId === currentFolder);

  const emptyState = document.getElementById("emptyState");
  const foldersSection = document.getElementById("foldersSection");
  const filesSection = document.getElementById("filesSection");

  if (folders.length === 0 && files.length === 0) {
    emptyState.classList.remove("hidden");
    foldersSection.classList.add("hidden");
    filesSection.classList.add("hidden");
  } else {
    emptyState.classList.add("hidden");

    if (folders.length > 0) {
      foldersSection.classList.remove("hidden");
      renderFolders(folders);
    } else {
      foldersSection.classList.add("hidden");
    }

    if (files.length > 0) {
      filesSection.classList.remove("hidden");
      renderFiles(files);
    } else {
      filesSection.classList.add("hidden");
    }
  }

  updateStorageInfo();
}

function updateStorageInfo() {
  const users = JSON.parse(localStorage.getItem("users") || "[]");
  const user = users.find((u) => u.id === currentUser.id);

  if (!user) return;

  let totalSize = 0;
  user.files.forEach((file) => {
    totalSize += file.size;
  });

  const totalGB = 5 * 1024 * 1024 * 1024; // 5 ГБ в байтах
  const percentage = (totalSize / totalGB) * 100;

  const storageBarFill = document.querySelector(".storage-bar-fill");
  const storageText = document.querySelector(".storage-text");

  if (storageBarFill) {
    storageBarFill.style.width = percentage + "%";
  }

  if (storageText) {
    const sizeMB = (totalSize / (1024 * 1024)).toFixed(1);
    storageText.textContent = `Занято ${sizeMB} МБ из 5 ГБ`;
  }
}

function renderFolders(folders) {
  const grid = document.getElementById("foldersGrid");
  grid.innerHTML = folders
    .map(
      (folder) => `
        <div class="folder-item" ondblclick="openFolder(${folder.id})">
            <div class="folder-icon">📁</div>
            <div class="folder-name">${folder.name}</div>
        </div>
    `,
    )
    .join("");
}

function renderFiles(files) {
  const list = document.getElementById("filesList");
  list.innerHTML = files
    .map(
      (file) => `
        <div class="file-item">
            <div class="file-icon">${getFileIcon(file.type)}</div>
            <div class="file-info">
                <div class="file-name">${file.name}</div>
                <div class="file-size">${formatSize(file.size)}</div>
            </div>
            <div class="file-actions">
                <button class="action-btn download" onclick="downloadFile(${file.id})">Скачать</button>
                <button class="action-btn share" onclick="shareFile(${file.id})">Поделиться</button>
                <button class="action-btn delete" onclick="deleteFile(${file.id})">Удалить</button>
            </div>
        </div>
    `,
    )
    .join("");
}

function getFileIcon(type) {
  if (type.startsWith("image/")) return "🖼️";
  if (type.startsWith("video/")) return "🎬";
  if (type.startsWith("audio/")) return "🎵";
  if (type.includes("pdf")) return "📕";
  if (type.includes("zip") || type.includes("rar")) return "📦";
  return "📄";
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + " Б";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " КБ";
  return (bytes / (1024 * 1024)).toFixed(1) + " МБ";
}

function showCreateFolderModal() {
  document.getElementById("folderModal").style.display = "flex";
  document.getElementById("folderNameInput").value = "";
  document.getElementById("folderNameInput").focus();
}

function closeFolderModal() {
  document.getElementById("folderModal").style.display = "none";
}

function createFolder() {
  const name = document.getElementById("folderNameInput").value.trim();
  if (!name) {
    alert("Введите название папки");
    return;
  }

  const users = JSON.parse(localStorage.getItem("users") || "[]");
  const user = users.find((u) => u.id === currentUser.id);

  user.folders.push({
    id: Date.now(),
    name,
    parentId: currentFolder,
  });

  localStorage.setItem("users", JSON.stringify(users));
  currentUser = user;
  localStorage.setItem("currentUser", JSON.stringify(user));

  closeFolderModal();
  loadContent();
}

function openFolder(folderId) {
  currentFolder = folderId;
  loadContent();
}

function uploadFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    const users = JSON.parse(localStorage.getItem("users") || "[]");
    const user = users.find((u) => u.id === currentUser.id);

    user.files.push({
      id: Date.now(),
      name: file.name,
      size: file.size,
      type: file.type,
      folderId: currentFolder,
      data: e.target.result,
    });

    localStorage.setItem("users", JSON.stringify(users));
    currentUser = user;
    localStorage.setItem("currentUser", JSON.stringify(user));

    loadContent();
  };
  reader.readAsDataURL(file);
  event.target.value = "";
}

function downloadFile(fileId) {
  const users = JSON.parse(localStorage.getItem("users") || "[]");
  const user = users.find((u) => u.id === currentUser.id);
  const file = user.files.find((f) => f.id === fileId);

  if (file) {
    const link = document.createElement("a");
    link.href = file.data;
    link.download = file.name;
    link.click();
  }
}

function shareFile(fileId) {
  const link = `http://localhost/shared/${fileId}`;
  navigator.clipboard
    .writeText(link)
    .then(() => {
      alert("Ссылка скопирована: " + link);
    })
    .catch(() => {
      prompt("Скопируйте ссылку:", link);
    });
}

function deleteFile(fileId) {
  if (!confirm("Удалить файл?")) return;

  const users = JSON.parse(localStorage.getItem("users") || "[]");
  const user = users.find((u) => u.id === currentUser.id);
  user.files = user.files.filter((f) => f.id !== fileId);

  localStorage.setItem("users", JSON.stringify(users));
  currentUser = user;
  localStorage.setItem("currentUser", JSON.stringify(user));

  loadContent();
}

// Закрытие модального окна при клике вне его
window.onclick = function (event) {
  const modal = document.getElementById("folderModal");
  if (event.target === modal) {
    closeFolderModal();
  }
};

// Enter в поле названия папки
document.getElementById("folderNameInput").onkeypress = function (e) {
  if (e.key === "Enter") {
    createFolder();
  }
};
