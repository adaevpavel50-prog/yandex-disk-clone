const DB_URL =
  "https://jsonblob.com/api/jsonBlob/01a158b7-d34a-79d1-9bf4-81e33768397f";
// =================================================================

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let currentUserData = null;
let currentView = "recent";
let selectedShareFile = null;

// ==================== АВТОРИЗАЦИЯ ====================

auth.onAuthStateChanged(async (user) => {
  if (user) {
    const userDoc = await db.collection("users").doc(user.uid).get();
    if (userDoc.exists) {
      currentUserData = userDoc.data();
      currentUser = { uid: user.uid, email: user.email, ...currentUserData };
      showDisk();
    }
  } else {
    currentUser = null;
    currentUserData = null;
    document.getElementById("authPage").style.display = "flex";
    document.getElementById("diskPage").classList.add("hidden");
  }
});

document.getElementById("toggleAuthBtn").onclick = function () {
  const isLogin = this.textContent === "Создать аккаунт";
  document.getElementById("authTitle").textContent = isLogin
    ? "Вход в аккаунт"
    : "Регистрация";
  document.getElementById("authBtn").textContent = isLogin
    ? "Войти"
    : "Зарегистрироваться";
  this.textContent = isLogin ? "Создать аккаунт" : "Уже есть аккаунт? Войти";
  document.getElementById("nameGroup").style.display = isLogin
    ? "none"
    : "block";
  document.getElementById("confirmPasswordGroup").style.display = isLogin
    ? "none"
    : "block";
  document.getElementById("errorMessage").classList.add("hidden");
};

document.getElementById("authForm").onsubmit = async function (e) {
  e.preventDefault();

  const email = document.getElementById("emailInput").value.trim();
  const password = document.getElementById("passwordInput").value;
  const name = document.getElementById("nameInput").value.trim();
  const confirmPassword = document.getElementById("confirmPasswordInput").value;
  const isLogin = document.getElementById("authBtn").textContent === "Войти";

  try {
    if (isLogin) {
      await auth.signInWithEmailAndPassword(email, password);
    } else {
      if (!name) {
        showError("Введите имя");
        return;
      }
      if (password !== confirmPassword) {
        showError("Пароли не совпадают");
        return;
      }
      if (password.length < 6) {
        showError("Пароль минимум 6 символов");
        return;
      }

      const userCredential = await auth.createUserWithEmailAndPassword(
        email,
        password,
      );
      const uid = userCredential.user.uid;

      // Создаем документ пользователя
      await db
        .collection("users")
        .doc(uid)
        .set({
          name: name,
          email: email,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          files: [],
          folders: [{ id: "folder_" + Date.now(), name: name, ownerId: uid }],
        });
    }
  } catch (error) {
    let message = "Ошибка";
    if (error.code === "auth/email-already-in-use")
      message = "Email уже зарегистрирован";
    else if (error.code === "auth/weak-password")
      message = "Пароль слишком слабый";
    else if (error.code === "auth/user-not-found")
      message = "Пользователь не найден";
    else if (error.code === "auth/wrong-password") message = "Неверный пароль";
    showError(message);
  }
};

function showError(message) {
  const errorDiv = document.getElementById("errorMessage");
  errorDiv.textContent = message;
  errorDiv.classList.remove("hidden");
}

function showDisk() {
  document.getElementById("authPage").style.display = "none";
  document.getElementById("diskPage").classList.remove("hidden");
  document.getElementById("userName").textContent = currentUserData.name;
  updateStorageInfo();
  loadCurrentView();
  updateSharedBadge();
}

async function logout() {
  await auth.signOut();
  document.getElementById("emailInput").value = "";
  document.getElementById("passwordInput").value = "";
  document.getElementById("nameInput").value = "";
  document.getElementById("confirmPasswordInput").value = "";
}

// ==================== НАВИГАЦИЯ ====================

function switchView(view, element) {
  currentView = view;

  document
    .querySelectorAll(".nav-item")
    .forEach((item) => item.classList.remove("active"));
  element.classList.add("active");

  const pathNames = {
    recent: "Последние",
    files: "Файлы",
    shared: "Общие файлы",
    trash: "Корзина",
  };

  document.getElementById("currentPath").textContent = pathNames[view];
  loadCurrentView();
}

async function loadCurrentView() {
  if (!currentUser) return;

  const userDoc = await db.collection("users").doc(currentUser.uid).get();
  if (!userDoc.exists) return;

  currentUserData = userDoc.data();

  const emptyState = document.getElementById("emptyState");
  const filesGrid = document.getElementById("filesGrid");
  filesGrid.innerHTML = "";

  if (currentView === "recent" || currentView === "files") {
    const allFiles = [];
    const folders = currentUserData.folders || [];

    folders.forEach((folder) => {
      if (folder.files) {
        folder.files.forEach((file) => {
          allFiles.push({ ...file, folderName: folder.name });
        });
      }
    });

    if (allFiles.length === 0) {
      emptyState.classList.remove("hidden");
      filesGrid.classList.add("hidden");
    } else {
      emptyState.classList.add("hidden");
      filesGrid.classList.remove("hidden");
      renderFiles(allFiles);
    }
  } else if (currentView === "shared") {
    // Загружаем файлы, отправленные этому пользователю
    const sharedSnapshot = await db
      .collection("sharedFiles")
      .where("recipientId", "==", currentUser.uid)
      .orderBy("uploadedAt", "desc")
      .get();

    const sharedFiles = [];
    sharedSnapshot.forEach((doc) => {
      sharedFiles.push({ id: doc.id, ...doc.data() });
    });

    if (sharedFiles.length === 0) {
      emptyState.classList.remove("hidden");
      filesGrid.classList.add("hidden");
      emptyState.querySelector("h3").textContent = "Нет общих файлов";
      emptyState.querySelector("p").textContent =
        "Другие пользователи ещё не отправляли вам файлы";
    } else {
      emptyState.classList.add("hidden");
      filesGrid.classList.remove("hidden");
      renderSharedFiles(sharedFiles);
    }
  } else if (currentView === "trash") {
    emptyState.classList.remove("hidden");
    filesGrid.classList.add("hidden");
    emptyState.querySelector("h3").textContent = "Корзина пуста";
    emptyState.querySelector("p").textContent =
      "Удаленные файлы будут отображаться здесь";
  }
}

function renderFiles(files) {
  const grid = document.getElementById("filesGrid");
  grid.innerHTML = files
    .map(
      (file) => `
        <div class="file-card">
            <div class="file-card-icon">${getFileIcon(file.type)}</div>
            <div class="file-card-name">${file.name}</div>
            <div class="file-card-meta">${formatSize(file.size)}</div>
            <div class="file-card-actions">
                <button class="action-btn download" onclick="downloadFile('${file.id}')">Скачать</button>
                <button class="action-btn delete" onclick="deleteFile('${file.id}')">Удалить</button>
            </div>
        </div>
    `,
    )
    .join("");
}

function renderSharedFiles(files) {
  const grid = document.getElementById("filesGrid");
  grid.innerHTML = files
    .map(
      (file) => `
        <div class="file-card">
            <div class="file-card-icon">${getFileIcon(file.type)}</div>
            <div class="file-card-name">${file.name}</div>
            <div class="file-card-meta">${formatSize(file.size)}</div>
            <div class="file-card-sender">От: ${file.senderName}</div>
            <div class="file-card-actions">
                <button class="action-btn download" onclick="downloadSharedFile('${file.id}')">Скачать</button>
                <button class="action-btn delete" onclick="deleteSharedFile('${file.id}')">Удалить</button>
            </div>
        </div>
    `,
    )
    .join("");
}

function getFileIcon(type) {
  if (!type) return "📄";
  if (type.startsWith("image/")) return "🖼️";
  if (type.startsWith("video/")) return "";
  if (type.startsWith("audio/")) return "🎵";
  if (type.includes("pdf")) return "📕";
  if (
    type.includes("word") ||
    type.includes("document") ||
    type.includes("msword")
  )
    return "📘";
  if (type.includes("zip") || type.includes("rar")) return "📦";
  return "📄";
}

function formatSize(bytes) {
  if (!bytes) return "0 Б";
  if (bytes < 1024) return bytes + " Б";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " КБ";
  return (bytes / (1024 * 1024)).toFixed(1) + " МБ";
}

function updateStorageInfo() {
  let totalSize = 0;
  const folders = currentUserData.folders || [];
  folders.forEach((folder) => {
    if (folder.files) {
      folder.files.forEach((file) => {
        totalSize += file.size || 0;
      });
    }
  });

  const totalGB = 5 * 1024 * 1024 * 1024;
  const percentage = (totalSize / totalGB) * 100;

  document.getElementById("storageBar").style.width =
    Math.max(percentage, 0.1) + "%";
  document.getElementById("storageText").textContent =
    `${(totalSize / (1024 * 1024)).toFixed(1)} МБ из 5 ГБ`;
}

async function updateSharedBadge() {
  if (!currentUser) return;

  const snapshot = await db
    .collection("sharedFiles")
    .where("recipientId", "==", currentUser.uid)
    .get();

  const count = snapshot.size;
  const badge = document.getElementById("sharedBadge");

  if (count > 0) {
    badge.textContent = count;
    badge.style.display = "flex";
  } else {
    badge.style.display = "none";
  }
}

// ==================== ЗАГРУЗКА ФАЙЛОВ ====================

async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    alert("Файл слишком большой! Максимум 5 МБ");
    event.target.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = async function (e) {
    const fileObj = {
      id: "file_" + Date.now(),
      name: file.name,
      size: file.size,
      type: file.type,
      data: e.target.result,
      uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    // Добавляем файл в первую папку пользователя (папку с его именем)
    const folders = currentUserData.folders || [];
    if (folders.length > 0) {
      if (!folders[0].files) folders[0].files = [];
      folders[0].files.push(fileObj);

      await db.collection("users").doc(currentUser.uid).update({
        folders: folders,
      });
    }

    loadCurrentView();
    updateStorageInfo();
  };
  reader.readAsDataURL(file);
  event.target.value = "";
}

function downloadFile(fileId) {
  const folders = currentUserData.folders || [];
  let file = null;

  folders.forEach((folder) => {
    if (folder.files) {
      const found = folder.files.find((f) => f.id === fileId);
      if (found) file = found;
    }
  });

  if (file && file.data) {
    const link = document.createElement("a");
    link.href = file.data;
    link.download = file.name;
    link.click();
  }
}

async function deleteFile(fileId) {
  if (!confirm("Удалить файл?")) return;

  const folders = currentUserData.folders || [];
  folders.forEach((folder) => {
    if (folder.files) {
      folder.files = folder.files.filter((f) => f.id !== fileId);
    }
  });

  await db
    .collection("users")
    .doc(currentUser.uid)
    .update({ folders: folders });
  loadCurrentView();
  updateStorageInfo();
}

// ==================== ОТПРАВКА ФАЙЛОВ ДРУГИМ ПОЛЬЗОВАТЕЛЯМ ====================

function showShareModal() {
  document.getElementById("shareModal").classList.add("active");
  document.getElementById("shareFileInput").value = "";
  selectedShareFile = null;
  document.getElementById("selectedFileInfo").classList.add("hidden");
}

function closeShareModal() {
  document.getElementById("shareModal").classList.remove("active");
  selectedShareFile = null;
}

function handleShareFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    alert("Файл слишком большой! Максимум 5 МБ");
    event.target.value = "";
    return;
  }

  selectedShareFile = file;
  document.getElementById("selectedFileInfo").classList.remove("hidden");
  document.getElementById("selectedFileName").textContent =
    `${file.name} (${formatSize(file.size)})`;
}

async function sendFileToOwner() {
  if (!selectedShareFile) {
    alert("Выберите файл");
    return;
  }

  // Находим владельца диска (первого зарегистрированного пользователя или конкретного)
  const usersSnapshot = await db.collection("users").limit(1).get();

  if (usersSnapshot.empty) {
    alert("В системе нет пользователей");
    return;
  }

  // Берем первого пользователя как "владельца" (или можно задать конкретный email)
  const ownerDoc = usersSnapshot.docs[0];
  const ownerId = ownerDoc.id;
  const ownerData = ownerDoc.data();

  const reader = new FileReader();
  reader.onload = async function (e) {
    const sharedFile = {
      name: selectedShareFile.name,
      size: selectedShareFile.size,
      type: selectedShareFile.type,
      data: e.target.result,
      senderId: currentUser.uid,
      senderName: currentUserData.name,
      senderEmail: currentUser.email,
      recipientId: ownerId,
      uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection("sharedFiles").add(sharedFile);

    alert(
      `Файл "${selectedShareFile.name}" отправлен пользователю ${ownerData.name}!`,
    );
    closeShareModal();
  };
  reader.readAsDataURL(selectedShareFile);
}

async function downloadSharedFile(fileId) {
  const doc = await db.collection("sharedFiles").doc(fileId).get();
  if (doc.exists && doc.data().data) {
    const file = doc.data();
    const link = document.createElement("a");
    link.href = file.data;
    link.download = file.name;
    link.click();
  }
}

async function deleteSharedFile(fileId) {
  if (!confirm("Удалить файл?")) return;
  await db.collection("sharedFiles").doc(fileId).delete();
  loadCurrentView();
  updateSharedBadge();
}

// ==================== СОЗДАНИЕ ПАПКИ ====================

function showCreateFolderModal() {
  document.getElementById("folderModal").classList.add("active");
  document.getElementById("folderNameInput").value = "";
  document.getElementById("folderNameInput").focus();
}

function closeFolderModal() {
  document.getElementById("folderModal").classList.remove("active");
}

async function createFolder() {
  const name = document.getElementById("folderNameInput").value.trim();
  if (!name) {
    alert("Введите название папки");
    return;
  }

  const newFolder = {
    id: "folder_" + Date.now(),
    name: name,
    ownerId: currentUser.uid,
    files: [],
  };

  const folders = currentUserData.folders || [];
  folders.push(newFolder);

  await db
    .collection("users")
    .doc(currentUser.uid)
    .update({ folders: folders });

  closeFolderModal();
  loadCurrentView();
}

// Закрытие модалок при клике вне их
window.onclick = function (event) {
  if (event.target.classList.contains("modal")) {
    event.target.classList.remove("active");
  }
};

document.getElementById("folderNameInput").onkeypress = function (e) {
  if (e.key === "Enter") createFolder();
};
