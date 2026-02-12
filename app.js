document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('file-input');
    const browseBtn = document.getElementById('browse-btn');
    const fileList = document.getElementById('file-list');
    const actionsBar = document.getElementById('actions-bar');
    const uploadAllBtn = document.getElementById('upload-all-btn');

    // View Sections
    const uploadView = document.getElementById('upload-view');
    const myUploadsView = document.getElementById('my-uploads-view');
    const downloadView = document.getElementById('download-view');
    const welcomeText = document.getElementById('welcome-text');

    // Nav Buttons
    const homeBtn = document.getElementById('home-btn');
    const myUploadsBtn = document.getElementById('my-uploads-btn');
    const settingsBtn = document.getElementById('settings-btn');

    // History Elements
    const historyList = document.getElementById('uploads-history-list');

    // Settings Elements
    const settingsModal = document.getElementById('settings-modal');
    const closeSettings = document.getElementById('close-settings');
    const modalOverlay = document.getElementById('modal-overlay');
    const saveSettings = document.getElementById('save-settings');
    const ghTokenInput = document.getElementById('gh-token');
    const ghRepoInput = document.getElementById('gh-repo');

    let filesArray = [];
    let config = JSON.parse(localStorage.getItem('gh_config')) || { token: '', repo: '' };

    // Initialize inputs from localStorage
    ghTokenInput.value = config.token;
    ghRepoInput.value = config.repo;

    // --- View Routing ---
    const checkRoute = () => {
        const urlParams = new URLSearchParams(window.location.search);
        const fileParam = urlParams.get('v');

        if (fileParam) {
            showDownloadView(fileParam);
        } else {
            showUploadView();
        }
    };

    const showUploadView = () => {
        uploadView.classList.remove('hidden');
        myUploadsView.classList.add('hidden');
        downloadView.classList.add('hidden');
        welcomeText.classList.remove('hidden');
    };

    const showMyUploadsView = () => {
        uploadView.classList.add('hidden');
        myUploadsView.classList.remove('hidden');
        downloadView.classList.add('hidden');
        welcomeText.classList.add('hidden');
        renderHistory();
    };

    const showDownloadView = (fileName) => {
        uploadView.classList.add('hidden');
        myUploadsView.classList.add('hidden');
        downloadView.classList.remove('hidden');
        welcomeText.classList.add('hidden');

        const [timestamp, ...nameParts] = fileName.split('_');
        const originalName = nameParts.join('_');

        document.getElementById('download-filename').textContent = originalName;
        document.getElementById('download-filesize').textContent = "GitHub Hosted File";

        // Construct GitHub raw URL (assuming public or with token access via proxy - for now raw)
        // If config is available, we use it, otherwise we might need owner/repo from URL (advanced)
        if (config.repo) {
            const rawUrl = `https://raw.githubusercontent.com/${config.repo}/main/uploads/${fileName}`;
            document.getElementById('download-link').href = rawUrl;
        }
    };

    homeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.history.pushState({}, '', window.location.pathname);
        showUploadView();
    });

    myUploadsBtn.addEventListener('click', showMyUploadsView);

    // --- Settings Logic ---
    settingsBtn.addEventListener('click', () => {
        settingsModal.classList.replace('hidden', 'flex');
    });

    const closeModal = () => settingsModal.classList.replace('flex', 'hidden');
    closeSettings.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', closeModal);

    saveSettings.addEventListener('click', () => {
        config.token = ghTokenInput.value.trim();
        config.repo = ghRepoInput.value.trim();
        localStorage.setItem('gh_config', JSON.stringify(config));
        closeModal();
        alert('Configuration saved!');
    });

    // --- New Workupload-Style Logic ---

    // Select Files Box Click
    dropArea.addEventListener('click', (e) => {
        if (e.target !== fileInput) {
            fileInput.click();
        }
    });

    // Handle File Selection (Show List & Form)
    function handleFiles(files) {
        const newFiles = Array.from(files).map(file => ({
            file: file,
            id: Math.random().toString(36).substr(2, 9)
        }));

        filesArray = [...filesArray, ...newFiles];

        // Show Form if files exist
        if (filesArray.length > 0) {
            fileList.classList.remove('hidden');
            document.getElementById('upload-form').classList.remove('hidden');
        }

        // Render compact list items
        newFiles.forEach(item => {
            const div = document.createElement('div');
            div.className = 'file-item-compact';
            div.id = `file-${item.id}`;
            div.innerHTML = `
                <div class="flex-1">
                    <div class="flex justify-between">
                        <span class="font-bold">${item.file.name}</span>
                        <span class="text-muted">${(item.file.size / (1024 * 1024)).toFixed(2)} MB</span>
                    </div>
                    <div class="progress-bar" id="progress-bar-${item.id}" style="display:none;">
                        <div class="progress-fill" id="progress-${item.id}"></div>
                    </div>
                </div>
                <div class="ml-4 cursor-pointer text-muted hover:text-white" data-id="${item.id}">&times;</div>
            `;

            // Remove handler
            div.querySelector('.ml-4').addEventListener('click', (e) => {
                e.stopPropagation();
                filesArray = filesArray.filter(f => f.id !== item.id);
                div.remove();
                if (filesArray.length === 0) {
                    fileList.classList.add('hidden');
                    document.getElementById('upload-form').classList.add('hidden');
                }
            });

            fileList.appendChild(div);
        });
    }

    // "Save Now" Button Click
    const saveNowBtn = document.getElementById('save-now-btn');
    saveNowBtn.addEventListener('click', async () => {
        if (!config.token || !config.repo) {
            alert('Please configure GitHub Settings first!');
            settingsBtn.click();
            return;
        }

        if (filesArray.length === 0) return;

        saveNowBtn.disabled = true;
        saveNowBtn.innerHTML = 'Uploading...';

        // Upload first file (Workupload style implies single file focus often, but we support multi)
        // For the "Success View" demo, we'll focus on the LAST uploaded file to show the detailed success card.

        let lastUploadedFile = null;

        for (const item of filesArray) {
            const progressEl = document.getElementById(`progress-${item.id}`);
            const barContainer = document.getElementById(`progress-bar-${item.id}`);
            barContainer.style.display = 'block';

            try {
                const fileData = await uploadToGitHub(item.file, progressEl);
                lastUploadedFile = fileData;
            } catch (err) {
                console.error(err);
                alert(`Error uploading ${item.file.name}: ${err.message}`);
            }
        }

        saveNowBtn.innerHTML = 'Done!';

        if (lastUploadedFile) {
            showDownloadView(lastUploadedFile.fullName); // Show success view immediately
        }
    });

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.classList.add('drag-over'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.classList.remove('drag-over'), false);
    });

    dropArea.addEventListener('drop', (e) => {
        handleFiles(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });

    async function uploadToGitHub(file, progressElement) {
        // 1. Read file as Base64
        const base64Content = await fileToBase64(file);
        const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
        const path = `uploads/${fileName}`;

        // 2. Upload via GitHub API
        const url = `https://api.github.com/repos/${config.repo}/contents/${path}`;

        // Update progress to 10% (started)
        progressElement.style.width = '10%';

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${config.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: `Upload ${file.name} via Extremeupload`,
                content: base64Content.split(',')[1] // Remove data:xxx/xxx;base64,
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'GitHub API Error');
        }

        progressElement.style.width = '100%';
        progressElement.style.backgroundColor = '#10b981';

        // Save to History
        saveFileToHistory({
            name: file.name,
            fullName: fileName,
            size: (file.size / (1024 * 1024)).toFixed(2),
            timestamp: Date.now()
        });
    }

    function saveFileToHistory(fileData) {
        let history = JSON.parse(localStorage.getItem('upload_history')) || [];
        history.unshift(fileData); // Newest first
        localStorage.setItem('upload_history', JSON.stringify(history));
    }

    function renderHistory() {
        const history = JSON.parse(localStorage.getItem('upload_history')) || [];
        if (history.length === 0) return;

        historyList.innerHTML = '';
        history.forEach(file => {
            const item = document.createElement('div');
            item.className = 'glass-card p-6 flex flex-col sm:flex-row justify-between items-center gap-4 animate-slide-up';

            const shareUrl = `${window.location.origin}${window.location.pathname}?v=${file.fullName}`;

            item.innerHTML = `
                <div class="flex items-center gap-4">
                    <div class="bg-accent/10 p-3 rounded-lg">
                        <i data-lucide="file" class="text-accent"></i>
                    </div>
                    <div>
                        <h4 class="font-bold text-lg">${file.name}</h4>
                        <p class="text-sm text-gray-400">${file.size} MB • ${new Date(file.timestamp).toLocaleDateString()}</p>
                    </div>
                </div>
                <div class="flex gap-2 w-full sm:w-auto">
                    <button class="copy-btn flex-1 sm:flex-none glass px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent hover:text-white transition-all" data-url="${shareUrl}">
                        Copy link
                    </button>
                    <a href="${shareUrl}" class="flex-1 sm:flex-none glass px-4 py-2 rounded-xl text-sm font-medium hover:bg-white hover:text-dark transition-all text-center">
                        View
                    </a>
                </div>
            `;

            historyList.appendChild(item);

            item.querySelector('.copy-btn').addEventListener('click', (e) => {
                navigator.clipboard.writeText(shareUrl);
                const btn = e.target;
                const originalText = btn.textContent;
                btn.textContent = 'Copied!';
                btn.style.backgroundColor = '#10b981';
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.style.backgroundColor = '';
                }, 2000);
            });
        });
        lucide.createIcons();
    }

    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }

    // Initialize Routing
    checkRoute();
});
