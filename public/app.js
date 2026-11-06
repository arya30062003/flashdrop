// FlashDrop Client Application Logic
// Splash screen, developer portfolio manager, ultra-fast streaming engine

let serverInfo = null;
let currentShareUrl = '';
let uploadQueue = [];
let isUploading = false;
let cameraStream = null;
let deferredPrompt = null;

// Developer Profile State
let developerProfile = {
  name: "Arya",
  title: "Full Stack & Systems Developer",
  bio: "Creator of FlashDrop. Passionate about high-speed P2P networking, distributed applications, and modern cross-platform engineering.",
  photoUrl: "https://github.com/arya30062003.png",
  skills: ["Node.js", "P2P Protocols", "PWA", "Real-Time Streaming", "Render Cloud"],
  github: "https://github.com/arya30062003",
  linkedin: "https://linkedin.com",
  website: "https://github.com/arya30062003",
  email: "developer@example.com"
};

// DOM Elements
const splashScreen = document.getElementById('splashScreen');
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const transferHud = document.getElementById('transferHud');
const hudFileName = document.getElementById('hudFileName');
const hudFileSize = document.getElementById('hudFileSize');
const hudSpeed = document.getElementById('hudSpeed');
const hudProgressBar = document.getElementById('hudProgressBar');
const hudPercent = document.getElementById('hudPercent');
const hudEta = document.getElementById('hudEta');
const queueCard = document.getElementById('queueCard');
const queueList = document.getElementById('queueList');
const queueStats = document.getElementById('queueStats');
const receivedList = document.getElementById('receivedList');
const receivedCount = document.getElementById('receivedCount');
const refreshFilesBtn = document.getElementById('refreshFilesBtn');
const qrBtn = document.getElementById('qrBtn');
const qrModal = document.getElementById('qrModal');
const closeQrModal = document.getElementById('closeQrModal');
const networkSelect = document.getElementById('networkSelect');
const shareUrlInput = document.getElementById('shareUrlInput');
const copyUrlBtn = document.getElementById('copyUrlBtn');
const scanBtn = document.getElementById('scanBtn');
const scannerModal = document.getElementById('scannerModal');
const closeScannerModal = document.getElementById('closeScannerModal');
const cameraVideo = document.getElementById('cameraVideo');
const scannerStatus = document.getElementById('scannerStatus');
const networkName = document.getElementById('networkName');
const pwaBanner = document.getElementById('pwaBanner');
const pwaInstallBtn = document.getElementById('pwaInstallBtn');
const pwaDismissBtn = document.getElementById('pwaDismissBtn');

// Developer Portfolio DOM Elements
const navProfileBtn = document.getElementById('navProfileBtn');
const navAvatar = document.getElementById('navAvatar');
const navDevName = document.getElementById('navDevName');
const spotlightAvatar = document.getElementById('spotlightAvatar');
const spotlightName = document.getElementById('spotlightName');
const spotlightRole = document.getElementById('spotlightRole');
const spotlightBio = document.getElementById('spotlightBio');
const spotlightSkills = document.getElementById('spotlightSkills');
const viewPortfolioTabBtn = document.getElementById('viewPortfolioTabBtn');
const editProfileBtn = document.getElementById('editProfileBtn');
const openFullEditBtn = document.getElementById('openFullEditBtn');
const fullAvatar = document.getElementById('fullAvatar');
const fullProfileName = document.getElementById('fullProfileName');
const fullProfileTitle = document.getElementById('fullProfileTitle');
const fullProfileBio = document.getElementById('fullProfileBio');
const fullSkillsList = document.getElementById('fullSkillsList');
const linkGithub = document.getElementById('linkGithub');
const linkLinkedin = document.getElementById('linkLinkedin');
const linkWebsite = document.getElementById('linkWebsite');
const linkEmail = document.getElementById('linkEmail');
const changePhotoBtn = document.getElementById('changePhotoBtn');
const avatarFileInput = document.getElementById('avatarFileInput');
const editProfileModal = document.getElementById('editProfileModal');
const closeEditProfileModal = document.getElementById('closeEditProfileModal');
const cancelEditProfileBtn = document.getElementById('cancelEditProfileBtn');
const editProfileForm = document.getElementById('editProfileForm');
const inputProfileName = document.getElementById('inputProfileName');
const inputProfileTitle = document.getElementById('inputProfileTitle');
const inputProfileBio = document.getElementById('inputProfileBio');
const inputProfileSkills = document.getElementById('inputProfileSkills');
const inputProfileGithub = document.getElementById('inputProfileGithub');
const inputProfileLinkedin = document.getElementById('inputProfileLinkedin');
const inputProfileWebsite = document.getElementById('inputProfileWebsite');
const inputProfileEmail = document.getElementById('inputProfileEmail');

// Helper: Format bytes
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Helper: Get file icon SVG based on extension
function getFileIcon(ext) {
  ext = (ext || '').toLowerCase();
  if (['.mp4', '.mkv', '.mov', '.avi', '.webm'].includes(ext)) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg>`;
  }
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext)) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
  }
  if (['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a'].includes(ext)) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;
  }
  if (['.zip', '.rar', '.7z', '.tar', '.gz', '.apk'].includes(ext)) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>`;
  }
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
}

// ----------------------------------------------------
// 1. Splash Screen Auto-Dismiss
// ----------------------------------------------------
function initSplashScreen() {
  const dismiss = () => {
    if (!splashScreen || splashScreen.classList.contains('fade-out')) return;
    splashScreen.classList.add('fade-out');
    setTimeout(() => {
      splashScreen.style.display = 'none';
    }, 600);
  };

  // Wait 1.2s for rich splash effect
  setTimeout(dismiss, 1200);
  splashScreen.addEventListener('click', dismiss);
}

// ----------------------------------------------------
// 2. Developer Portfolio Management
// ----------------------------------------------------
async function initDeveloperProfile() {
  // Check localStorage first for instant display
  const saved = localStorage.getItem('flashdrop_profile');
  if (saved) {
    try {
      developerProfile = { ...developerProfile, ...JSON.parse(saved) };
    } catch (e) {}
  }

  // Fetch latest from server
  try {
    const res = await fetch('/api/profile');
    if (res.ok) {
      const serverProfile = await res.json();
      developerProfile = { ...developerProfile, ...serverProfile };
    }
  } catch (e) {}

  renderDeveloperProfile();
}

function renderDeveloperProfile() {
  // Navbar
  if (navAvatar) navAvatar.src = developerProfile.photoUrl;
  if (navDevName) navDevName.textContent = developerProfile.name;

  // Home Spotlight
  if (spotlightAvatar) spotlightAvatar.src = developerProfile.photoUrl;
  if (spotlightName) spotlightName.textContent = developerProfile.name;
  if (spotlightRole) spotlightRole.textContent = developerProfile.title;
  if (spotlightBio) spotlightBio.textContent = developerProfile.bio;
  if (spotlightSkills) {
    spotlightSkills.innerHTML = (developerProfile.skills || [])
      .slice(0, 4)
      .map(s => `<span class="skill-pill">${escapeHtml(s)}</span>`)
      .join('');
  }

  // Full Portfolio Tab
  if (fullAvatar) fullAvatar.src = developerProfile.photoUrl;
  if (fullProfileName) fullProfileName.textContent = developerProfile.name;
  if (fullProfileTitle) fullProfileTitle.textContent = developerProfile.title;
  if (fullProfileBio) fullProfileBio.textContent = developerProfile.bio;
  if (fullSkillsList) {
    fullSkillsList.innerHTML = (developerProfile.skills || [])
      .map(s => `<span class="skill-tag">⚡ ${escapeHtml(s)}</span>`)
      .join('');
  }

  if (linkGithub) linkGithub.href = developerProfile.github || 'https://github.com';
  if (linkLinkedin) linkLinkedin.href = developerProfile.linkedin || 'https://linkedin.com';
  if (linkWebsite) linkWebsite.href = developerProfile.website || window.location.origin;
  if (linkEmail) linkEmail.href = `mailto:${developerProfile.email || 'developer@example.com'}`;
}

// Photo upload handler
if (changePhotoBtn && avatarFileInput) {
  changePhotoBtn.addEventListener('click', () => avatarFileInput.click());
  avatarFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      developerProfile.photoUrl = event.target.result;
      saveDeveloperProfile();
    };
    reader.readAsDataURL(file);
  });
}

function openEditProfileModal() {
  inputProfileName.value = developerProfile.name || '';
  inputProfileTitle.value = developerProfile.title || '';
  inputProfileBio.value = developerProfile.bio || '';
  inputProfileSkills.value = (developerProfile.skills || []).join(', ');
  inputProfileGithub.value = developerProfile.github || '';
  inputProfileLinkedin.value = developerProfile.linkedin || '';
  inputProfileWebsite.value = developerProfile.website || '';
  inputProfileEmail.value = developerProfile.email || '';
  editProfileModal.showModal();
}

function closeEditModal() {
  editProfileModal.close();
}

if (editProfileBtn) editProfileBtn.addEventListener('click', openEditProfileModal);
if (openFullEditBtn) openFullEditBtn.addEventListener('click', openEditProfileModal);
if (closeEditProfileModal) closeEditProfileModal.addEventListener('click', closeEditModal);
if (cancelEditProfileBtn) cancelEditProfileBtn.addEventListener('click', closeEditModal);

if (editProfileForm) {
  editProfileForm.addEventListener('submit', (e) => {
    e.preventDefault();
    developerProfile.name = inputProfileName.value.trim();
    developerProfile.title = inputProfileTitle.value.trim();
    developerProfile.bio = inputProfileBio.value.trim();
    developerProfile.skills = inputProfileSkills.value.split(',').map(s => s.trim()).filter(Boolean);
    developerProfile.github = inputProfileGithub.value.trim();
    developerProfile.linkedin = inputProfileLinkedin.value.trim();
    developerProfile.website = inputProfileWebsite.value.trim();
    developerProfile.email = inputProfileEmail.value.trim();

    saveDeveloperProfile();
    closeEditModal();
  });
}

async function saveDeveloperProfile() {
  localStorage.setItem('flashdrop_profile', JSON.stringify(developerProfile));
  renderDeveloperProfile();

  // Sync to server
  try {
    await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(developerProfile)
    });
  } catch (e) {}
}

// ----------------------------------------------------
// 3. Initialize Server Info & QR Code
// ----------------------------------------------------
async function initServerInfo() {
  try {
    const res = await fetch('/api/info');
    serverInfo = await res.json();
    
    // Set network label
    if (serverInfo.isRender) {
      networkName.textContent = 'Render Cloud';
    } else if (serverInfo.hostname) {
      networkName.textContent = serverInfo.hostname;
    }

    // Populate network dropdown
    networkSelect.innerHTML = '';
    const currentOrigin = window.location.origin;

    // Add Render cloud public URL if present
    if (serverInfo.externalUrl && serverInfo.isRender) {
      const opt = document.createElement('option');
      opt.value = serverInfo.externalUrl;
      opt.textContent = `🌐 Cloud Public (${serverInfo.externalUrl})`;
      opt.selected = true;
      networkSelect.appendChild(opt);
    }

    // Add local network interfaces
    (serverInfo.ips || []).forEach(({ interface: iface, ip }) => {
      const opt = document.createElement('option');
      opt.value = `http://${ip}:${serverInfo.port}`;
      opt.textContent = `${ip} (${iface})`;
      if (ip === window.location.hostname && !serverInfo.isRender) opt.selected = true;
      networkSelect.appendChild(opt);
    });

    if (networkSelect.options.length === 0) {
      const opt = document.createElement('option');
      opt.value = currentOrigin;
      opt.textContent = currentOrigin;
      networkSelect.appendChild(opt);
    }

    updateQRCode(networkSelect.value);
  } catch (err) {
    console.warn('Could not fetch /api/info:', err);
    updateQRCode(window.location.origin);
  }
}

function updateQRCode(url) {
  currentShareUrl = url;
  shareUrlInput.value = url;
  const qrWrapper = document.getElementById('qrCodeWrapper');
  if (window.FlashDropQR) {
    const qr = new FlashDropQR();
    qrWrapper.innerHTML = qr.toSVG(url);
  } else {
    qrWrapper.innerHTML = `<img src="/api/qr.svg?text=${encodeURIComponent(url)}" alt="QR Code" style="width:100%;height:100%;">`;
  }
}

networkSelect.addEventListener('change', (e) => {
  updateQRCode(e.target.value);
});

copyUrlBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(shareUrlInput.value).then(() => {
    const orig = copyUrlBtn.textContent;
    copyUrlBtn.textContent = 'Copied!';
    setTimeout(() => { copyUrlBtn.textContent = orig; }, 2000);
  });
});

// ----------------------------------------------------
// 4. Real-time Server-Sent Events (SSE)
// ----------------------------------------------------
function initSSE() {
  const eventSource = new EventSource('/api/events');

  eventSource.addEventListener('transfer-start', (e) => {
    const data = JSON.parse(e.data);
    hudFileName.textContent = data.filename;
    hudFileSize.textContent = `0 B / ${data.formattedSize}`;
    hudProgressBar.style.width = '0%';
    hudPercent.textContent = '0%';
    hudSpeed.textContent = '0.0';
    hudEta.textContent = 'Starting stream...';
    transferHud.classList.remove('hidden');
  });

  eventSource.addEventListener('transfer-progress', (e) => {
    const data = JSON.parse(e.data);
    hudProgressBar.style.width = `${data.percent}%`;
    hudPercent.textContent = `${data.percent}%`;
    hudSpeed.textContent = data.speedMBps.toFixed(1);

    if (data.totalSize > 0) {
      hudFileSize.textContent = `${formatBytes(data.bytesReceived)} / ${formatBytes(data.totalSize)}`;
      if (data.speedMBps > 0) {
        const remainingBytes = data.totalSize - data.bytesReceived;
        const etaSeconds = Math.round(remainingBytes / (data.speedMBps * 1024 * 1024));
        hudEta.textContent = etaSeconds > 0 ? `ETA: ${etaSeconds}s` : 'Finishing...';
      }
    }
  });

  eventSource.addEventListener('transfer-complete', (e) => {
    hudProgressBar.style.width = '100%';
    hudPercent.textContent = '100%';
    hudEta.textContent = 'Transfer Complete!';
    
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

    setTimeout(() => {
      if (!isUploading) transferHud.classList.add('hidden');
    }, 2500);

    fetchReceivedFiles();
  });

  eventSource.addEventListener('file-deleted', () => {
    fetchReceivedFiles();
  });

  eventSource.addEventListener('profile-updated', (e) => {
    const updated = JSON.parse(e.data);
    developerProfile = { ...developerProfile, ...updated };
    renderDeveloperProfile();
  });

  eventSource.onerror = () => {
    console.warn('SSE disconnected, retrying in 3s...');
  };
}

// ----------------------------------------------------
// 5. Ultra-Fast Binary Upload Engine
// ----------------------------------------------------
function handleFilesSelected(files) {
  if (!files || files.length === 0) return;
  for (let i = 0; i < files.length; i++) {
    uploadQueue.push(files[i]);
  }
  renderQueue();
  if (!isUploading) {
    processNextInQueue();
  }
}

function renderQueue() {
  if (uploadQueue.length === 0) {
    queueCard.classList.add('hidden');
    return;
  }
  queueCard.classList.remove('hidden');
  queueStats.textContent = `${uploadQueue.length} file(s) in queue`;
  
  queueList.innerHTML = uploadQueue.map((f, idx) => `
    <div class="file-item">
      <div class="file-info">
        <div class="file-icon">${getFileIcon(f.name.slice(f.name.lastIndexOf('.')))}</div>
        <div class="file-details">
          <div class="file-name">${escapeHtml(f.name)}</div>
          <div class="file-meta">${formatBytes(f.size)} ${idx === 0 && isUploading ? '• ⚡ Transferring...' : '• Queued'}</div>
        </div>
      </div>
    </div>
  `).join('');
}

async function processNextInQueue() {
  if (uploadQueue.length === 0) {
    isUploading = false;
    transferHud.classList.add('hidden');
    return;
  }

  isUploading = true;
  const file = uploadQueue[0];
  renderQueue();

  hudFileName.textContent = file.name;
  hudFileSize.textContent = `0 B / ${formatBytes(file.size)}`;
  hudProgressBar.style.width = '0%';
  hudPercent.textContent = '0%';
  hudSpeed.textContent = '0.0';
  hudEta.textContent = 'Connecting...';
  transferHud.classList.remove('hidden');

  let startTime = Date.now();
  let lastBytes = 0;
  let lastTime = startTime;

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/upload?filename=${encodeURIComponent(file.name)}&size=${file.size}`);
    
    xhr.setRequestHeader('x-filename', encodeURIComponent(file.name));
    xhr.setRequestHeader('x-file-size', file.size);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        hudProgressBar.style.width = `${percent}%`;
        hudPercent.textContent = `${percent}%`;
        hudFileSize.textContent = `${formatBytes(e.loaded)} / ${formatBytes(e.total)}`;

        const now = Date.now();
        const elapsedSec = (now - lastTime) / 1000;
        if (elapsedSec >= 0.25) {
          const bytesDiff = e.loaded - lastBytes;
          const mbps = ((bytesDiff / elapsedSec) / (1024 * 1024)).toFixed(1);
          hudSpeed.textContent = mbps;
          lastTime = now;
          lastBytes = e.loaded;

          const remainingBytes = e.total - e.loaded;
          const speedBytes = (bytesDiff / elapsedSec);
          if (speedBytes > 0) {
            const eta = Math.round(remainingBytes / speedBytes);
            hudEta.textContent = `ETA: ${eta}s`;
          }
        }
      }
    };

    xhr.onload = () => {
      uploadQueue.shift();
      renderQueue();
      if (xhr.status === 200) {
        hudProgressBar.style.width = '100%';
        hudPercent.textContent = '100%';
        hudEta.textContent = 'Finished!';
        fetchReceivedFiles();
      } else {
        alert('Upload failed: ' + xhr.responseText);
      }
      resolve();
      processNextInQueue();
    };

    xhr.onerror = () => {
      alert('Network error while transferring: ' + file.name);
      uploadQueue.shift();
      renderQueue();
      resolve();
      processNextInQueue();
    };

    xhr.send(file);
  });
}

// ----------------------------------------------------
// 6. Received Files Manager
// ----------------------------------------------------
async function fetchReceivedFiles() {
  try {
    const res = await fetch('/api/files');
    const files = await res.json();
    receivedCount.textContent = files.length;

    if (files.length === 0) {
      receivedList.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M22 12h-6l-2 3h-4l-2-3H2"/>
            <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
          </svg>
          <p>No files received yet</p>
          <span>Connect a phone or another laptop to start streaming files!</span>
        </div>
      `;
      return;
    }

    receivedList.innerHTML = files.map((file) => `
      <div class="file-item">
        <div class="file-info">
          <div class="file-icon">${getFileIcon(file.ext)}</div>
          <div class="file-details">
            <div class="file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
            <div class="file-meta">${file.formattedSize} • ${new Date(file.modified).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        </div>
        <div class="file-actions">
          <a href="${file.downloadUrl}" download="${escapeHtml(file.name)}" class="btn btn-sm btn-primary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download
          </a>
          <button onclick="deleteFile('${encodeURIComponent(file.name)}')" class="btn btn-sm btn-danger" title="Delete file">
            &times;
          </button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Error fetching files:', err);
  }
}

window.deleteFile = async function(encodedFilename) {
  if (!confirm('Delete this file?')) return;
  try {
    const res = await fetch(`/api/files/${encodedFilename}`, { method: 'DELETE' });
    if (res.ok) fetchReceivedFiles();
  } catch (e) {
    alert('Delete error: ' + e.message);
  }
};

refreshFilesBtn.addEventListener('click', fetchReceivedFiles);

// ----------------------------------------------------
// 7. Drag & Drop and File Picker Handlers
// ----------------------------------------------------
fileInput.addEventListener('change', (e) => {
  handleFilesSelected(e.target.files);
  fileInput.value = '';
});

dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('dragover');
});

dropzone.addEventListener('dragleave', () => {
  dropzone.classList.remove('dragover');
});

dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  if (e.dataTransfer && e.dataTransfer.files) {
    handleFilesSelected(e.dataTransfer.files);
  }
});

// ----------------------------------------------------
// 8. Tabs Switcher
// ----------------------------------------------------
function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

  const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  if (btn) btn.classList.add('active');

  if (tabId === 'send') {
    document.getElementById('tabSend').classList.add('active');
  } else if (tabId === 'received') {
    document.getElementById('tabReceived').classList.add('active');
    fetchReceivedFiles();
  } else if (tabId === 'portfolio') {
    document.getElementById('tabPortfolio').classList.add('active');
  }
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    switchTab(btn.getAttribute('data-tab'));
  });
});

if (navProfileBtn) {
  navProfileBtn.addEventListener('click', () => switchTab('portfolio'));
}
if (viewPortfolioTabBtn) {
  viewPortfolioTabBtn.addEventListener('click', () => switchTab('portfolio'));
}

// ----------------------------------------------------
// 9. Modals (QR Code & Camera Scanner)
// ----------------------------------------------------
qrBtn.addEventListener('click', () => qrModal.showModal());
closeQrModal.addEventListener('click', () => qrModal.close());
qrModal.addEventListener('click', (e) => { if (e.target === qrModal) qrModal.close(); });

scanBtn.addEventListener('click', startScanner);
closeScannerModal.addEventListener('click', stopScanner);
scannerModal.addEventListener('click', (e) => { if (e.target === scannerModal) stopScanner(); });

async function startScanner() {
  scannerModal.showModal();
  scannerStatus.textContent = 'Requesting camera access...';

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });
    cameraVideo.srcObject = cameraStream;
    await cameraVideo.play();
    scannerStatus.textContent = 'Point camera at QR code on another screen';
    scanFrame();
  } catch (err) {
    scannerStatus.textContent = 'Camera error: ' + err.message;
  }
}

function stopScanner() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
  scannerModal.close();
}

async function scanFrame() {
  if (!cameraStream || scannerModal.open === false) return;

  if ('BarcodeDetector' in window) {
    try {
      const detector = new BarcodeDetector({ formats: ['qr_code'] });
      const barcodes = await detector.detect(cameraVideo);
      if (barcodes.length > 0) {
        const rawUrl = barcodes[0].rawValue;
        if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
          stopScanner();
          if (navigator.vibrate) navigator.vibrate(100);
          window.location.href = rawUrl;
          return;
        }
      }
    } catch (e) {}
  }

  requestAnimationFrame(scanFrame);
}

// ----------------------------------------------------
// 10. PWA Service Worker & Install Prompt
// ----------------------------------------------------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.log('SW registration note:', err.message);
    });
  });
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  pwaBanner.classList.remove('hidden');
});

pwaInstallBtn.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  pwaBanner.classList.add('hidden');
});

pwaDismissBtn.addEventListener('click', () => {
  pwaBanner.classList.add('hidden');
});

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Initialize on page load
initSplashScreen();
initDeveloperProfile();
initServerInfo();
initSSE();
fetchReceivedFiles();
