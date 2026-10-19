// Хранилище данных
let currentUser = null;
let currentFolder = null;
let isLoginMode = true;
let currentSection = 'files';
let selectedTaskFile = null; // Выбранный файл для задания

// Инициализация при загрузке
window.onload = function() {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showDisk();
    }
};

// Переключение между входом и регистрацией
document.getElementById('toggleAuthBtn').onclick = function() {
    isLoginMode = !isLoginMode;
    document.getElementById('authTitle').textContent = isLoginMode ? 'Вход в аккаунт' : 'Создать аккаунт';
    document.getElementById('authBtn').textContent = isLoginMode ? 'Войти' : 'Зарегистрироваться';
    this.textContent = isLoginMode ? 'Создать аккаунт' : 'Уже есть аккаунт';
    document.getElementById('nameGroup').style.display = isLoginMode ? 'none' : 'block';
    document.getElementById('confirmPasswordGroup').style.display = isLoginMode ? 'none' : 'block';
    document.getElementById('errorMessage').classList.add('hidden');
};

// Обработка формы авторизации
document.getElementById('authForm').onsubmit = function(e) {
    e.preventDefault();
    
    const email = document.getElementById('emailInput').value.trim();
    const password = document.getElementById('passwordInput').value;
    const name = document.getElementById('nameInput').value.trim();
    const confirmPassword = document.getElementById('confirmPasswordInput').value;

    if (isLoginMode) {
        const users = JSON.parse(localStorage.getItem('users') || '[]');
        const user = users.find(u => u.email === email && u.password === password);
        
        if (user) {
            currentUser = user;
            localStorage.setItem('currentUser', JSON.stringify(user));
            showDisk();
        } else {
            showError('Неверный email или пароль');
        }
    } else {
        if (!name) {
            showError('Введите имя');
            return;
        }

        if (password !== confirmPassword) {
            showError('Пароли не совпадают');
            return;
        }

        if (password.length < 6) {
            showError('Пароль должен содержать минимум 6 символов');
            return;
        }

        const users = JSON.parse(localStorage.getItem('users') || '[]');
        
        if (users.find(u => u.email === email)) {
            showError('Email уже зарегистрирован');
            return;
        }

        const newUser = {
            id: Date.now(),
            email,
            password,
            name,
            folders: [],
            files: [],
            tasks: []
        };

        users.push(newUser);
        localStorage.setItem('users', JSON.stringify(users));
        
        currentUser = newUser;
        localStorage.setItem('currentUser', JSON.stringify(newUser));
        showDisk();
    }
};

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
}

function showDisk() {
    document.getElementById('authPage').style.display = 'none';
    document.getElementById('diskPage').style.display = 'flex';
    document.getElementById('userName').textContent = `Привет, ${currentUser.name}`;
    loadContent();
    updateStorageInfo();
    updateTasksBadge();
}

function logout() {
    localStorage.removeItem('currentUser');
    currentUser = null;
    currentFolder = null;
    currentSection = 'files';
    document.getElementById('authPage').style.display = 'flex';
    document.getElementById('diskPage').style.display = 'none';
    document.getElementById('emailInput').value = '';
    document.getElementById('passwordInput').value = '';
    document.getElementById('nameInput').value = '';
    document.getElementById('confirmPasswordInput').value = '';
}

function switchSection(section, element) {
    currentSection = section;
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    element.classList.add('active');
    
    const pathNames = {
        'recent': 'Последние',
        'files': 'Мой диск',
        'tasks': 'Задания',
        'photos': 'Фото',
        'albums': 'Альбомы',
        'shared': 'Общий доступ',
        'family': 'Семья',
        'downloads': 'Загрузки',
        'trash': 'Корзина',
        'history': 'История',
        'storage': 'Управление местом'
    };
    
    document.getElementById('currentPath').textContent = pathNames[section] || 'Мой диск';
    
    const mainToolbar = document.getElementById('mainToolbar');
    const tasksToolbar = document.getElementById('tasksToolbar');
    
    if (section === 'tasks') {
        mainToolbar.classList.add('hidden');
        tasksToolbar.classList.remove('hidden');
        loadTasks();
    } else {
        mainToolbar.classList.remove('hidden');
        tasksToolbar.classList.add('hidden');
    }
    
    if (section === 'files') {
        currentFolder = null;
        loadContent();
    } else if (section === 'trash') {
        showTrash();
    } else if (section !== 'tasks') {
        showSectionPlaceholder(section);
    }
}

function showSectionPlaceholder(section) {
    const emptyState = document.getElementById('emptyState');
    const foldersSection = document.getElementById('foldersSection');
    const filesSection = document.getElementById('filesSection');
    const tasksSection = document.getElementById('tasksSection');
    
    emptyState.classList.remove('hidden');
    foldersSection.classList.add('hidden');
    filesSection.classList.add('hidden');
    tasksSection.classList.add('hidden');
    
    const titles = {
        'recent': 'Последние файлы',
        'photos': 'Фотографии',
        'albums': 'Альбомы',
        'shared': 'Общий доступ',
        'family': 'Семейный доступ',
        'downloads': 'Загрузки',
        'history': 'История действий',
        'storage': 'Управление хранилищем'
    };
    
    emptyState.querySelector('h3').textContent = titles[section] || 'Раздел';
    emptyState.querySelector('p').textContent = 'Этот раздел находится в разработке';
}

function showTrash() {
    const emptyState = document.getElementById('emptyState');
    const foldersSection = document.getElementById('foldersSection');
    const filesSection = document.getElementById('filesSection');
    const tasksSection = document.getElementById('tasksSection');
    
    emptyState.classList.remove('hidden');
    foldersSection.classList.add('hidden');
    filesSection.classList.add('hidden');
    tasksSection.classList.add('hidden');
    
    emptyState.querySelector('h3').textContent = 'Корзина пуста';
    emptyState.querySelector('p').textContent = 'Удаленные файлы будут отображаться здесь';
}

function loadContent() {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find(u => u.id === currentUser.id);
    
    if (!user) return;

    const folders = currentFolder 
        ? user.folders.filter(f => f.parentId === currentFolder)
        : user.folders.filter(f => !f.parentId);
    
    const files = user.files.filter(f => f.folderId === currentFolder);

    const emptyState = document.getElementById('emptyState');
    const foldersSection = document.getElementById('foldersSection');
    const filesSection = document.getElementById('filesSection');
    const tasksSection = document.getElementById('tasksSection');

    tasksSection.classList.add('hidden');

    if (folders.length === 0 && files.length === 0) {
        emptyState.classList.remove('hidden');
        foldersSection.classList.add('hidden');
        filesSection.classList.add('hidden');
    } else {
        emptyState.classList.add('hidden');
        
        if (folders.length > 0) {
            foldersSection.classList.remove('hidden');
            renderFolders(folders);
        } else {
            foldersSection.classList.add('hidden');
        }

        if (files.length > 0) {
            filesSection.classList.remove('hidden');
            renderFiles(files);
        } else {
            filesSection.classList.add('hidden');
        }
    }
    
    updateStorageInfo();
}

function loadTasks() {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find(u => u.id === currentUser.id);
    
    if (!user) return;

    const tasks = user.tasks || [];
    
    const emptyState = document.getElementById('emptyState');
    const foldersSection = document.getElementById('foldersSection');
    const filesSection = document.getElementById('filesSection');
    const tasksSection = document.getElementById('tasksSection');

    emptyState.classList.add('hidden');
    foldersSection.classList.add('hidden');
    filesSection.classList.add('hidden');

    if (tasks.length === 0) {
        emptyState.classList.remove('hidden');
        tasksSection.classList.add('hidden');
        emptyState.querySelector('h3').textContent = 'Нет заданий';
        emptyState.querySelector('p').textContent = 'Преподаватель ещё не отправил вам задания';
    } else {
        tasksSection.classList.remove('hidden');
        renderTasks(tasks);
    }
}

function renderTasks(tasks) {
    const list = document.getElementById('tasksList');
    list.innerHTML = tasks.map(task => {
        let attachmentHtml = '';
        if (task.file) {
            attachmentHtml = `
                <div class="task-attachment">
                    <div class="task-attachment-icon">${getFileIcon(task.file.type)}</div>
                    <div class="task-attachment-info">
                        <div class="task-attachment-name">${task.file.name}</div>
                        <div class="task-attachment-size">${formatSize(task.file.size)}</div>
                    </div>
                    <button class="task-attachment-download" onclick="downloadTaskFile(${task.id})">
                        ⬇️ Скачать
                    </button>
                </div>
            `;
        }
        
        return `
            <div class="task-item">
                <div class="task-header">
                    <div class="task-title">📋 ${task.title}</div>
                    ${task.deadline ? `<div class="task-deadline">📅 Срок: ${formatDate(task.deadline)}</div>` : ''}
                </div>
                <div class="task-sender">От: ${task.senderName} (${task.senderEmail})</div>
                <div class="task-description">${task.description}</div>
                ${attachmentHtml}
                <div class="task-actions">
                    <button class="action-btn delete" onclick="deleteTask(${task.id})">Удалить</button>
                </div>
            </div>
        `;
    }).join('');
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function updateTasksBadge() {
    if (!currentUser) return;
    
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find(u => u.id === currentUser.id);
    
    if (!user) return;
    
    const tasks = user.tasks || [];
    const badge = document.getElementById('tasksBadge');
    
    if (tasks.length > 0) {
        badge.textContent = tasks.length;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

function updateStorageInfo() {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find(u => u.id === currentUser.id);
    
    if (!user) return;
    
    let totalSize = 0;
    user.files.forEach(file => {
        totalSize += file.size;
    });
    
    const totalGB = 5 * 1024 * 1024 * 1024;
    const percentage = (totalSize / totalGB) * 100;
    
    const storageBarFill = document.querySelector('.storage-bar-fill');
    const storageText = document.querySelector('.storage-text');
    
    if (storageBarFill) {
        storageBarFill.style.width = Math.max(percentage, 0.26) + '%';
    }
    
    if (storageText) {
        const sizeMB = (totalSize / (1024 * 1024)).toFixed(1);
        storageText.textContent = `Занято ${sizeMB} МБ из 5 ГБ`;
    }
}

function renderFolders(folders) {
    const grid = document.getElementById('foldersGrid');
    grid.innerHTML = folders.map(folder => `
        <div class="folder-item" ondblclick="openFolder(${folder.id})">
            <div class="folder-icon">📁</div>
            <div class="folder-name">${folder.name}</div>
        </div>
    `).join('');
}

function renderFiles(files) {
    const list = document.getElementById('filesList');
    list.innerHTML = files.map(file => `
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
    `).join('');
}

function getFileIcon(type) {
    if (!type) return '📄';
    if (type.startsWith('image/')) return '🖼️';
    if (type.startsWith('video/')) return '🎬';
    if (type.startsWith('audio/')) return '';
    if (type.includes('pdf')) return '📕';
    if (type.includes('word') || type.includes('document') || type.includes('msword')) return '📘';
    if (type.includes('zip') || type.includes('rar') || type.includes('archive')) return '';
    if (type.includes('text')) return '📝';
    return '📄';
}

function formatSize(bytes) {
    if (!bytes) return '0 Б';
    if (bytes < 1024) return bytes + ' Б';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
    return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
}

function showCreateFolderModal() {
    document.getElementById('folderModal').style.display = 'flex';
    document.getElementById('folderNameInput').value = '';
    document.getElementById('folderNameInput').focus();
}

function closeFolderModal() {
    document.getElementById('folderModal').style.display = 'none';
}

function createFolder() {
    const name = document.getElementById('folderNameInput').value.trim();
    if (!name) {
        alert('Введите название папки');
        return;
    }

    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find(u => u.id === currentUser.id);
    
    user.folders.push({
        id: Date.now(),
        name,
        parentId: currentFolder
    });

    localStorage.setItem('users', JSON.stringify(users));
    currentUser = user;
    localStorage.setItem('currentUser', JSON.stringify(user));
    
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
    reader.onload = function(e) {
        const users = JSON.parse(localStorage.getItem('users') || '[]');
        const user = users.find(u => u.id === currentUser.id);
        
        user.files.push({
            id: Date.now(),
            name: file.name,
            size: file.size,
            type: file.type,
            folderId: currentFolder,
            data: e.target.result
        });

        localStorage.setItem('users', JSON.stringify(users));
        currentUser = user;
        localStorage.setItem('currentUser', JSON.stringify(user));
        
        loadContent();
    };
    reader.readAsDataURL(file);
    event.target.value = '';
}

function downloadFile(fileId) {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find(u => u.id === currentUser.id);
    const file = user.files.find(f => f.id === fileId);
    
    if (file) {
        const link = document.createElement('a');
        link.href = file.data;
        link.download = file.name;
        link.click();
    }
}

function shareFile(fileId) {
    const link = `http://localhost/shared/${fileId}`;
    navigator.clipboard.writeText(link).then(() => {
        alert('Ссылка скопирована: ' + link);
    }).catch(() => {
        prompt('Скопируйте ссылку:', link);
    });
}

function deleteFile(fileId) {
    if (!confirm('Удалить файл?')) return;

    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find(u => u.id === currentUser.id);
    user.files = user.files.filter(f => f.id !== fileId);

    localStorage.setItem('users', JSON.stringify(users));
    currentUser = user;
    localStorage.setItem('currentUser', JSON.stringify(user));
    
    loadContent();
}

function deleteTask(taskId) {
    if (!confirm('Удалить задание?')) return;

    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find(u => u.id === currentUser.id);
    user.tasks = user.tasks.filter(t => t.id !== taskId);

    localStorage.setItem('users', JSON.stringify(users));
    currentUser = user;
    localStorage.setItem('currentUser', JSON.stringify(user));
    
    loadTasks();
    updateTasksBadge();
}

// ==================== ОТПРАВКА ЗАДАНИЙ С ФАЙЛОМ ====================

function showSendTaskModal() {
    document.getElementById('taskModal').style.display = 'flex';
    document.getElementById('taskRecipientEmail').value = '';
    document.getElementById('taskTitle').value = '';
    document.getElementById('taskDescription').value = '';
    document.getElementById('taskDeadline').value = '';
    selectedTaskFile = null;
    document.getElementById('fileUploadPlaceholder').style.display = 'block';
    document.getElementById('fileSelected').style.display = 'none';
    document.getElementById('taskFileInput').value = '';
    document.getElementById('taskRecipientEmail').focus();
}

function closeTaskModal() {
    document.getElementById('taskModal').style.display = 'none';
    selectedTaskFile = null;
}

function handleTaskFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Проверка размера (10 МБ)
    if (file.size > 10 * 1024 * 1024) {
        alert('Файл слишком большой! Максимальный размер: 10 МБ');
        event.target.value = '';
        return;
    }

    selectedTaskFile = file;
    
    // Показываем информацию о выбранном файле
    document.getElementById('fileUploadPlaceholder').style.display = 'none';
    document.getElementById('fileSelected').style.display = 'flex';
    document.getElementById('fileSelectedName').textContent = file.name;
    document.getElementById('fileSelectedSize').textContent = formatSize(file.size);
    document.getElementById('fileSelectedIcon').textContent = getFileIcon(file.type);
}

function removeTaskFile() {
    selectedTaskFile = null;
    document.getElementById('fileUploadPlaceholder').style.display = 'block';
    document.getElementById('fileSelected').style.display = 'none';
    document.getElementById('taskFileInput').value = '';
}

function sendTask() {
    const recipientEmail = document.getElementById('taskRecipientEmail').value.trim();
    const title = document.getElementById('taskTitle').value.trim();
    const description = document.getElementById('taskDescription').value.trim();
    const deadline = document.getElementById('taskDeadline').value;

    if (!recipientEmail) {
        alert('Введите email получателя');
        return;
    }

    if (!title) {
        alert('Введите название задания');
        return;
    }

    if (!description) {
        alert('Введите описание задания');
        return;
    }

    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const recipient = users.find(u => u.email === recipientEmail);

    if (!recipient) {
        alert('Пользователь с таким email не найден. Убедитесь, что получатель зарегистрирован в системе.');
        return;
    }

    if (!recipient.tasks) {
        recipient.tasks = [];
    }

    // Создаем объект задания
    const task = {
        id: Date.now(),
        title,
        description,
        deadline,
        senderEmail: currentUser.email,
        senderName: currentUser.name,
        createdAt: new Date().toISOString(),
        file: null
    };

    // Если файл выбран - читаем его и добавляем к заданию
    if (selectedTaskFile) {
        const reader = new FileReader();
        reader.onload = function(e) {
            task.file = {
                name: selectedTaskFile.name,
                size: selectedTaskFile.size,
                type: selectedTaskFile.type,
                data: e.target.result
            };

            recipient.tasks.push(task);
            localStorage.setItem('users', JSON.stringify(users));

            alert(`Задание "${title}" успешно отправлено пользователю ${recipient.name}!`);
            closeTaskModal();
        };
        reader.readAsDataURL(selectedTaskFile);
    } else {
        // Отправляем без файла
        recipient.tasks.push(task);
        localStorage.setItem('users', JSON.stringify(users));

        alert(`Задание "${title}" успешно отправлено пользователю ${recipient.name}!`);
        closeTaskModal();
    }
}

function downloadTaskFile(taskId) {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find(u => u.id === currentUser.id);
    const task = user.tasks.find(t => t.id === taskId);
    
    if (task && task.file) {
        const link = document.createElement('a');
        link.href = task.file.data;
        link.download = task.file.name;
        link.click();
    }
}

// Закрытие модальных окон при клике вне их
window.onclick = function(event) {
    const folderModal = document.getElementById('folderModal');
    const taskModal = document.getElementById('taskModal');
    if (event.target === folderModal) {
        closeFolderModal();
    }
    if (event.target === taskModal) {
        closeTaskModal();
    }
}

// Enter в поле названия папки
document.getElementById('folderNameInput').onkeypress = function(e) {
    if (e.key === 'Enter') {
        createFolder();
    }
}
