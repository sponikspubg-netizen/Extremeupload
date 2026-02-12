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

    // --- File Handling Logic ---
    browseBtn.addEventListener('click', () => fileInput.click());

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

    function handleFiles(files) {
        const newFiles = Array.from(files).map(file => ({
            file: file,
            id: Math.random().toString(36).substr(2, 9)
        }));

        filesArray = [...filesArray, ...newFiles];
        newFiles.forEach(item => renderFileItem(item));

        if (filesArray.length > 0) {
            actionsBar.classList.remove('hidden');
            actionsBar.classList.add('flex');
        }
    }

    function renderFileItem(item) {
        const file = item.file;
        const id = item.id;
        const div = document.createElement('div');
        div.className = 'file-item';
        div.id = `file-${id}`;
        div.innerHTML = `
            <i data-lucide="file" class="text-accent"></i>
            <div class="flex-1">
                <div class="flex justify-between items-center">
                    <span class="font-bold truncate max-w-[200px]">${file.name}</span>
                    <span class="text-sm text-gray-400 font-mono" id="status-${id}">${(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                </div>
                <!-- Link Container Placeholder -->
                <div id="link-container-${id}" class="hidden mt-2"></div>
                
                <div class="progress-bar" id="progress-bar-container-${id}">
                    <div class="progress-fill" id="progress-${id}"></div>
                </div>
            </div>
            <button class="remove-btn text-gray-500 hover:text-accent transition-colors" data-id="${id}">
                <i data-lucide="x-circle"></i>
            </button>
        `;

        fileList.appendChild(div);
        lucide.createIcons();

        div.querySelector('.remove-btn').addEventListener('click', () => {
            div.classList.add('animate-fade-out');
            setTimeout(() => {
                div.remove();
                filesArray = filesArray.filter(f => f.id !== id);
                if (filesArray.length === 0) {
                    actionsBar.classList.add('hidden');
                    actionsBar.classList.remove('flex');
                }
            }, 300);
        });
    }

    // --- GitHub Upload Logic ---
    uploadAllBtn.addEventListener('click', async () => {
        if (!config.token || !config.repo) {
            alert('Please configure GitHub Settings first!');
            settingsBtn.click();
            return;
        }

        uploadAllBtn.disabled = true;
        uploadAllBtn.innerHTML = '<span class="flex items-center gap-2">Uploading to GitHub...</span>';

        for (const item of filesArray) {
            const id = item.id;
            const file = item.file;
            const statusEl = document.getElementById(`status-${id}`);
            const progressEl = document.getElementById(`progress-${id}`);
            const progressBarContainer = document.getElementById(`progress-bar-container-${id}`);
            const linkContainer = document.getElementById(`link-container-${id}`);

            try {
                const fileData = await uploadToGitHub(file, progressEl);

                // Update UI with Link
                const shareUrl = `${window.location.origin}${window.location.pathname}?v=${fileData.fullName}`;
                if (statusEl) statusEl.innerHTML = `<span class="text-green-400">Uploaded!</span>`;

                if (progressBarContainer) progressBarContainer.style.display = 'none';
                if (linkContainer) {
                    linkContainer.classList.remove('hidden');
                    linkContainer.className = 'mt-2 flex gap-2 animate-fade-in';
                    linkContainer.innerHTML = `
                        <input type="text" value="${shareUrl}" class="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-gray-300 outline-none" readonly>
                        <button class="copy-link-btn bg-accent text-white px-3 py-1 rounded-lg text-xs font-bold hover:bg-accent-hover transition-colors">
                            Copy
                        </button>
                        <a href="${shareUrl}" target="_blank" class="bg-white/10 text-white px-3 py-1 rounded-lg text-xs font-bold hover:bg-white/20 transition-colors">
                            Open
                        </a>
                    `;

                    // Activate Copy Button
                    const copyBtn = linkContainer.querySelector('.copy-link-btn');
                    if (copyBtn) {
                        copyBtn.addEventListener('click', (e) => {
                            navigator.clipboard.writeText(shareUrl);
                            e.target.textContent = 'Copied!';
                            setTimeout(() => e.target.textContent = 'Copy', 2000);
                        });
                    }
                }

            } catch (err) {
                console.error(err);
                if (statusEl) statusEl.innerHTML = `<span class="text-red-500">Error</span>`;
                alert(`Error uploading ${file.name}: ${err.message}`);
            }
        }

        uploadAllBtn.innerHTML = 'All Files Processed ✅';
        setTimeout(() => {
            uploadAllBtn.disabled = false;
            uploadAllBtn.innerHTML = 'Upload Everything';
        }, 3000);
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
