// FlashDrop - True WebRTC Peer-to-Peer Direct File Exchange Engine
// 0 bytes of file data are uploaded to any server. Data flows directly device-to-device.

let myPeerId = localStorage.getItem('flashdrop_peer_id');
if (!myPeerId) {
  myPeerId = 'peer_' + Math.random().toString(36).substring(2, 9);
  localStorage.setItem('flashdrop_peer_id', myPeerId);
}

let myDeviceName = localStorage.getItem('flashdrop_device_name') || getDefaultDeviceName();
const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const deviceType = isMobile ? 'mobile' : 'desktop';

let nearbyPeers = [];
let selectedPeerId = null;
let peerConnections = new Map(); // targetPeerId -> RTCPeerConnection
let dataChannels = new Map(); // targetPeerId -> RTCDataChannel
let sseSource = null;

// File exchange state
let currentTransfer = null;
let incomingFile = null;
let receivedHistory = [];

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// DOM Elements
const heroSendBtn = document.getElementById('heroSendBtn');
const heroReceiveBtn = document.getElementById('heroReceiveBtn');
let pendingFilesToSend = [];

const splashScreen = document.getElementById('splashScreen');
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const dropzoneTitle = document.getElementById('dropzoneTitle');
const dropzoneSub = document.getElementById('dropzoneSub');
const peersContainer = document.getElementById('peersContainer');
const myDeviceNameEl = document.getElementById('myDeviceName');
const selfDeviceLabel = document.getElementById('selfDeviceLabel');
const renameDeviceBtn = document.getElementById('renameDeviceBtn');
const renameModal = document.getElementById('renameModal');
const closeRenameModal = document.getElementById('closeRenameModal');
const renameForm = document.getElementById('renameForm');
const deviceNameInput = document.getElementById('deviceNameInput');

// HUD
const transferHud = document.getElementById('transferHud');
const hudFileName = document.getElementById('hudFileName');
const hudFileSize = document.getElementById('hudFileSize');
const hudSpeed = document.getElementById('hudSpeed');
const hudProgressBar = document.getElementById('hudProgressBar');
const hudPercent = document.getElementById('hudPercent');
const hudEta = document.getElementById('hudEta');

// History & Modals
const historyList = document.getElementById('historyList');
const historyCount = document.getElementById('historyCount');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const qrBtn = document.getElementById('qrBtn');
const qrModal = document.getElementById('qrModal');
const closeQrModal = document.getElementById('closeQrModal');
const shareUrlInput = document.getElementById('shareUrlInput');
const copyUrlBtn = document.getElementById('copyUrlBtn');
const scanBtn = document.getElementById('scanBtn');
const scannerModal = document.getElementById('scannerModal');
const closeScannerModal = document.getElementById('closeScannerModal');
const cameraVideo = document.getElementById('cameraVideo');
const scannerStatus = document.getElementById('scannerStatus');

// Developer Portfolio Elements
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

// Developer Profile Defaults
let developerProfile = {
  name: "Arya",
  title: "Full Stack & Systems Developer",
  bio: "Creator of FlashDrop. Passionate about true peer-to-peer data exchange, WebRTC direct streaming, and high-performance cross-platform networking.",
  photoUrl: "https://github.com/arya30062003.png",
  skills: ["WebRTC P2P", "Direct Wi-Fi", "Node.js Core", "PWA", "Render Cloud"],
  github: "https://github.com/arya30062003",
  linkedin: "https://linkedin.com",
  website: "https://github.com/arya30062003",
  email: "developer@example.com"
};

function getDefaultDeviceName() {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return 'Android Device';
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Mac/i.test(ua)) return 'MacBook';
  if (/Windows/i.test(ua)) return 'Windows PC';
  return 'Desktop PC';
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileIcon(ext) {
  ext = (ext || '').toLowerCase();
  if (['.mp4', '.mkv', '.mov', '.avi', '.webm'].includes(ext)) return '🎬';
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext)) return '🖼️';
  if (['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a'].includes(ext)) return '🎵';
  if (['.zip', '.rar', '.7z', '.tar', '.gz', '.apk'].includes(ext)) return '📦';
  return '📄';
}

// ----------------------------------------------------
// 1. Splash Screen
// ----------------------------------------------------
function initSplashScreen() {
  const dismiss = () => {
    if (!splashScreen || splashScreen.classList.contains('fade-out')) return;
    splashScreen.classList.add('fade-out');
    setTimeout(() => { splashScreen.style.display = 'none'; }, 600);
  };
  setTimeout(dismiss, 1200);
  splashScreen.addEventListener('click', dismiss);
}

// ----------------------------------------------------
// 2. WebRTC P2P Signaling & Registration
// ----------------------------------------------------
async function registerP2P() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room') || 'local-wifi-room';

    await fetch('/api/p2p/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        peerId: myPeerId,
        name: myDeviceName,
        type: deviceType,
        roomId
      })
    });

    initSignalingEvents();
  } catch (err) {
    console.warn('Signaling error:', err);
  }
}

function initSignalingEvents() {
  if (sseSource) sseSource.close();
  sseSource = new EventSource(`/api/p2p/events?peerId=${encodeURIComponent(myPeerId)}`);

  sseSource.addEventListener('connected', () => {
    console.log('⚡ P2P Signaling connected as:', myPeerId);
  });

  sseSource.addEventListener('peers-updated', (e) => {
    const peers = JSON.parse(e.data);
    nearbyPeers = peers.filter(p => p.id !== myPeerId);
    renderNearbyPeers();

    // If we have pending files waiting for a receiver, send immediately
    if (pendingFilesToSend.length > 0 && nearbyPeers.length > 0) {
      const target = nearbyPeers[0].id;
      const files = [...pendingFilesToSend];
      pendingFilesToSend = [];
      qrModal.close();
      for (const f of files) {
        sendFileToPeer(target, f);
      }
    }

    // Check if URL specified auto-connect peer
    const urlParams = new URLSearchParams(window.location.search);
    const targetPeer = urlParams.get('peer');
    if (targetPeer && targetPeer !== myPeerId && !peerConnections.has(targetPeer)) {
      initiatePeerConnection(targetPeer);
    }
  });

  sseSource.addEventListener('p2p-signal', async (e) => {
    const { from, signal } = JSON.parse(e.data);
    handleIncomingSignal(from, signal);
  });

  sseSource.onerror = () => {
    setTimeout(registerP2P, 4000);
  };
}

async function sendSignal(toPeerId, signal) {
  try {
    await fetch('/api/p2p/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: myPeerId, to: toPeerId, signal })
    });
  } catch (e) {
    console.error('Signal send error:', e);
  }
}

// ----------------------------------------------------
// 3. WebRTC Direct Peer Connection Management
// ----------------------------------------------------
function getOrCreatePeerConnection(targetPeerId) {
  if (peerConnections.has(targetPeerId)) {
    return peerConnections.get(targetPeerId);
  }

  const pc = new RTCPeerConnection(RTC_CONFIG);

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      sendSignal(targetPeerId, { candidate: event.candidate });
    }
  };

  pc.ondatachannel = (event) => {
    setupDataChannel(targetPeerId, event.channel);
  };

  pc.onconnectionstatechange = () => {
    console.log(`P2P Connection State with ${targetPeerId}:`, pc.connectionState);
  };

  peerConnections.set(targetPeerId, pc);
  return pc;
}

async function initiatePeerConnection(targetPeerId) {
  const pc = getOrCreatePeerConnection(targetPeerId);

  // Sender creates the DataChannel
  const channel = pc.createDataChannel('flashdrop_p2p', { ordered: true });
  setupDataChannel(targetPeerId, channel);

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  sendSignal(targetPeerId, { offer });
}

async function handleIncomingSignal(fromPeerId, signal) {
  const pc = getOrCreatePeerConnection(fromPeerId);

  if (signal.offer) {
    await pc.setRemoteDescription(new RTCSessionDescription(signal.offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    sendSignal(fromPeerId, { answer });
  } else if (signal.answer) {
    await pc.setRemoteDescription(new RTCSessionDescription(signal.answer));
  } else if (signal.candidate) {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
    } catch (e) {
      console.warn('ICE candidate error:', e);
    }
  }
}

function setupDataChannel(targetPeerId, channel) {
  channel.binaryType = 'arraybuffer';
  dataChannels.set(targetPeerId, channel);

  channel.onopen = () => {
    console.log(`⚡ Direct WebRTC DataChannel OPEN with ${targetPeerId}!`);
    updatePeerCardStatus(targetPeerId, 'Connected (Direct)');
  };

  channel.onclose = () => {
    dataChannels.delete(targetPeerId);
    updatePeerCardStatus(targetPeerId, 'Ready');
  };

  channel.onmessage = (event) => {
    handleIncomingDataChannelMessage(targetPeerId, event.data);
  };
}

// ----------------------------------------------------
// 4. Direct P2P File Sending (Zero Server Upload)
// ----------------------------------------------------
async function sendFileToPeer(targetPeerId, file) {
  let channel = dataChannels.get(targetPeerId);
  if (!channel || channel.readyState !== 'open') {
    initiatePeerConnection(targetPeerId);
    // Wait for channel open
    await new Promise((resolve, reject) => {
      const check = setInterval(() => {
        channel = dataChannels.get(targetPeerId);
        if (channel && channel.readyState === 'open') {
          clearInterval(check);
          resolve();
        }
      }, 100);
      setTimeout(() => { clearInterval(check); reject(new Error('Connection timed out')); }, 6000);
    });
  }

  // Setup HUD
  hudFileName.textContent = file.name;
  hudFileSize.textContent = `0 B / ${formatBytes(file.size)} • Direct P2P`;
  hudProgressBar.style.width = '0%';
  hudPercent.textContent = '0%';
  hudSpeed.textContent = '0.0';
  hudEta.textContent = 'Starting direct Wi-Fi exchange...';
  transferHud.classList.remove('hidden');

  // 1. Send Header JSON
  channel.send(JSON.stringify({
    type: 'header',
    name: file.name,
    size: file.size,
    mime: file.type || 'application/octet-stream'
  }));

  // 2. Stream Binary Chunks with Backpressure
  const CHUNK_SIZE = 64 * 1024; // 64 KB chunks
  let offset = 0;
  let lastTime = Date.now();
  let lastBytes = 0;

  channel.bufferedAmountLowThreshold = 1024 * 1024; // 1 MB buffer threshold

  while (offset < file.size) {
    // Flow control: if buffer has > 4MB queued, wait for drain
    if (channel.bufferedAmount > 4 * 1024 * 1024) {
      await new Promise(resolve => {
        channel.onbufferedamountlow = () => {
          channel.onbufferedamountlow = null;
          resolve();
        };
      });
    }

    const chunk = await file.slice(offset, offset + CHUNK_SIZE).arrayBuffer();
    channel.send(chunk);
    offset += chunk.byteLength;

    // Update progress & speed
    const percent = Math.min(100, Math.round((offset / file.size) * 100));
    hudProgressBar.style.width = `${percent}%`;
    hudPercent.textContent = `${percent}%`;
    hudFileSize.textContent = `${formatBytes(offset)} / ${formatBytes(file.size)} • Direct P2P`;

    const now = Date.now();
    const elapsed = (now - lastTime) / 1000;
    if (elapsed >= 0.25) {
      const bytesDiff = offset - lastBytes;
      const mbps = ((bytesDiff / elapsed) / (1024 * 1024)).toFixed(1);
      hudSpeed.textContent = mbps;
      lastTime = now;
      lastBytes = offset;

      const remainingBytes = file.size - offset;
      const speedBytes = bytesDiff / elapsed;
      if (speedBytes > 0) {
        hudEta.textContent = `ETA: ${Math.round(remainingBytes / speedBytes)}s`;
      }
    }
  }

  // 3. Send Complete JSON
  channel.send(JSON.stringify({ type: 'complete' }));
  hudProgressBar.style.width = '100%';
  hudPercent.textContent = '100%';
  hudEta.textContent = 'Exchange Complete! (Direct P2P)';

  setTimeout(() => { transferHud.classList.add('hidden'); }, 3000);
}

// ----------------------------------------------------
// 5. Direct P2P File Receiving (Zero Server Download)
// ----------------------------------------------------
function handleIncomingDataChannelMessage(targetPeerId, data) {
  // Metadata or completion string
  if (typeof data === 'string') {
    try {
      const msg = JSON.parse(data);
      if (msg.type === 'header') {
        incomingFile = {
          name: msg.name,
          size: msg.size,
          mime: msg.mime,
          chunks: [],
          receivedBytes: 0,
          startTime: Date.now(),
          lastTime: Date.now(),
          lastBytes: 0
        };

        hudFileName.textContent = msg.name;
        hudFileSize.textContent = `0 B / ${formatBytes(msg.size)} • Receiving Direct P2P`;
        hudProgressBar.style.width = '0%';
        hudPercent.textContent = '0%';
        hudSpeed.textContent = '0.0';
        hudEta.textContent = 'Receiving direct stream...';
        transferHud.classList.remove('hidden');
      } else if (msg.type === 'complete' && incomingFile) {
        // Reconstruct blob and trigger direct download
        const blob = new Blob(incomingFile.chunks, { type: incomingFile.mime });
        const downloadUrl = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = incomingFile.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Haptic feedback
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

        hudProgressBar.style.width = '100%';
        hudPercent.textContent = '100%';
        hudEta.textContent = 'Saved to Device!';

        // Add to history
        receivedHistory.unshift({
          name: incomingFile.name,
          size: incomingFile.size,
          formattedSize: formatBytes(incomingFile.size),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          url: downloadUrl
        });
        renderHistory();

        incomingFile = null;
        setTimeout(() => { transferHud.classList.add('hidden'); }, 3000);
      }
    } catch (e) {}
    return;
  }

  // Binary chunk data
  if (incomingFile && data instanceof ArrayBuffer) {
    incomingFile.chunks.push(data);
    incomingFile.receivedBytes += data.byteLength;

    const percent = Math.min(100, Math.round((incomingFile.receivedBytes / incomingFile.size) * 100));
    hudProgressBar.style.width = `${percent}%`;
    hudPercent.textContent = `${percent}%`;
    hudFileSize.textContent = `${formatBytes(incomingFile.receivedBytes)} / ${formatBytes(incomingFile.size)} • Direct P2P`;

    const now = Date.now();
    const elapsed = (now - incomingFile.lastTime) / 1000;
    if (elapsed >= 0.25) {
      const bytesDiff = incomingFile.receivedBytes - incomingFile.lastBytes;
      const mbps = ((bytesDiff / elapsed) / (1024 * 1024)).toFixed(1);
      hudSpeed.textContent = mbps;
      incomingFile.lastTime = now;
      incomingFile.lastBytes = incomingFile.receivedBytes;

      const remainingBytes = incomingFile.size - incomingFile.receivedBytes;
      const speedBytes = bytesDiff / elapsed;
      if (speedBytes > 0) {
        hudEta.textContent = `ETA: ${Math.round(remainingBytes / speedBytes)}s`;
      }
    }
  }
}

// ----------------------------------------------------
// 6. UI: Radar & Nearby Peers
// ----------------------------------------------------
function renderNearbyPeers() {
  myDeviceNameEl.textContent = myDeviceName;
  selfDeviceLabel.textContent = `${myDeviceName} (You)`;

  if (nearbyPeers.length === 0) {
    peersContainer.innerHTML = `
      <div class="radar-searching">
        <div class="searching-spinner"></div>
        <p>Scanning for nearby devices...</p>
        <span>Open FlashDrop on another mobile phone or laptop connected to the same Wi-Fi / hotspot to exchange files directly!</span>
      </div>
    `;
    return;
  }

  peersContainer.innerHTML = nearbyPeers.map(peer => `
    <div class="peer-card ${selectedPeerId === peer.id ? 'active' : ''}" onclick="selectPeer('${peer.id}')">
      <div class="peer-icon">
        ${peer.type === 'mobile' 
          ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`
          : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="2" y1="20" x2="22" y2="20"/></svg>`
        }
      </div>
      <div class="peer-name" title="${escapeHtml(peer.name)}">${escapeHtml(peer.name)}</div>
      <button class="btn btn-sm btn-primary" style="margin-top:6px;pointer-events:none;">
        Send File ➔
      </button>
    </div>
  `).join('');
}

window.selectPeer = function(peerId) {
  selectedPeerId = peerId;
  const peer = nearbyPeers.find(p => p.id === peerId);
  if (peer) {
    dropzoneTitle.textContent = `Send to ${peer.name}`;
    dropzoneSub.textContent = `Choose movies, photos, or files to stream directly`;
    fileInput.click();
  }
};

function updatePeerCardStatus(peerId, statusText) {
  const el = document.getElementById(`peer-status-${peerId}`);
  if (el) el.textContent = statusText;
}

// ----------------------------------------------------
// 7. File Selection / Drag & Drop
// ----------------------------------------------------
if (heroSendBtn) {
  heroSendBtn.addEventListener('click', () => {
    fileInput.click();
  });
}

if (heroReceiveBtn) {
  heroReceiveBtn.addEventListener('click', () => {
    initQR();
    qrModal.showModal();
  });
}

fileInput.addEventListener('change', (e) => {
  handleSelectedFiles(e.target.files);
  fileInput.value = '';
});

dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('dragover');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  if (e.dataTransfer && e.dataTransfer.files) {
    handleSelectedFiles(e.dataTransfer.files);
  }
});

async function handleSelectedFiles(files) {
  if (!files || files.length === 0) return;

  // If no peer selected, auto-select first available peer
  if (!selectedPeerId && nearbyPeers.length > 0) {
    selectedPeerId = nearbyPeers[0].id;
  }

  // If no peer connected yet, queue files and pop up QR code to connect receiver
  if (!selectedPeerId) {
    pendingFilesToSend = Array.from(files);
    initQR();
    qrModal.showModal();
    const desc = qrModal.querySelector('.modal-desc');
    if (desc) {
      desc.innerHTML = `<strong>${files.length} file(s) selected!</strong><br>Scan this QR code with the receiving phone to start transferring immediately:`;
    }
    return;
  }

  for (let i = 0; i < files.length; i++) {
    await sendFileToPeer(selectedPeerId, files[i]);
  }
}

// ----------------------------------------------------
// 8. History Tab
// ----------------------------------------------------
function renderHistory() {
  historyCount.textContent = receivedHistory.length;
  if (receivedHistory.length === 0) {
    historyList.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M22 12h-6l-2 3h-4l-2-3H2"/>
          <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
        </svg>
        <p>No files exchanged yet</p>
        <span>Tap on a nearby device above to stream movies or photos directly!</span>
      </div>
    `;
    return;
  }

  historyList.innerHTML = receivedHistory.map(f => `
    <div class="file-item">
      <div class="file-info">
        <div class="file-icon">${getFileIcon(f.name.slice(f.name.lastIndexOf('.')))}</div>
        <div class="file-details">
          <div class="file-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</div>
          <div class="file-meta">${f.formattedSize} • Received at ${f.time}</div>
        </div>
      </div>
      <a href="${f.url}" download="${escapeHtml(f.name)}" class="btn btn-sm btn-primary">Save Again</a>
    </div>
  `).join('');
}

clearHistoryBtn.addEventListener('click', () => {
  receivedHistory = [];
  renderHistory();
});

// ----------------------------------------------------
// 9. QR Code & Pairing Modal
// ----------------------------------------------------
async function initQR() {
  const currentOrigin = window.location.origin;
  const pairUrl = `${currentOrigin}/?peer=${myPeerId}`;
  shareUrlInput.value = pairUrl;

  const qrWrapper = document.getElementById('qrCodeWrapper');
  if (window.FlashDropQR) {
    const qr = new FlashDropQR();
    qrWrapper.innerHTML = qr.toSVG(pairUrl);
  }
}

qrBtn.addEventListener('click', () => {
  initQR();
  qrModal.showModal();
});
closeQrModal.addEventListener('click', () => qrModal.close());
qrModal.addEventListener('click', (e) => { if (e.target === qrModal) qrModal.close(); });

copyUrlBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(shareUrlInput.value).then(() => {
    const orig = copyUrlBtn.textContent;
    copyUrlBtn.textContent = 'Copied!';
    setTimeout(() => { copyUrlBtn.textContent = orig; }, 2000);
  });
});

// Rename Device Modal
renameDeviceBtn.addEventListener('click', () => {
  deviceNameInput.value = myDeviceName;
  renameModal.showModal();
});
if (closeRenameModal) closeRenameModal.addEventListener('click', () => renameModal.close());
renameForm.addEventListener('submit', (e) => {
  e.preventDefault();
  myDeviceName = deviceNameInput.value.trim() || getDefaultDeviceName();
  localStorage.setItem('flashdrop_device_name', myDeviceName);
  renameModal.close();
  registerP2P();
});

// Camera Scanner
scanBtn.addEventListener('click', async () => {
  scannerModal.showModal();
  scannerStatus.textContent = 'Requesting camera access...';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    cameraVideo.srcObject = stream;
    await cameraVideo.play();
    scannerStatus.textContent = 'Point camera at QR code on another screen';

    const check = async () => {
      if (scannerModal.open && 'BarcodeDetector' in window) {
        try {
          const detector = new BarcodeDetector({ formats: ['qr_code'] });
          const barcodes = await detector.detect(cameraVideo);
          if (barcodes.length > 0) {
            const val = barcodes[0].rawValue;
            if (val.startsWith('http')) {
              stream.getTracks().forEach(t => t.stop());
              scannerModal.close();
              window.location.href = val;
              return;
            }
          }
        } catch (e) {}
        requestAnimationFrame(check);
      }
    };
    check();
  } catch (err) {
    scannerStatus.textContent = 'Camera error: ' + err.message;
  }
});
closeScannerModal.addEventListener('click', () => {
  if (cameraVideo.srcObject) {
    cameraVideo.srcObject.getTracks().forEach(t => t.stop());
  }
  scannerModal.close();
});

// ----------------------------------------------------
// 10. Developer Portfolio Profile Management
// ----------------------------------------------------
async function initDeveloperProfile() {
  const saved = localStorage.getItem('flashdrop_profile');
  if (saved) {
    try { developerProfile = { ...developerProfile, ...JSON.parse(saved) }; } catch (e) {}
  }
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
  if (navAvatar) navAvatar.src = developerProfile.photoUrl;
  if (navDevName) navDevName.textContent = developerProfile.name;
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
  if (fullAvatar) fullAvatar.src = developerProfile.photoUrl;
  if (fullProfileName) fullProfileName.textContent = developerProfile.name;
  if (fullProfileTitle) fullProfileTitle.textContent = developerProfile.title;
  if (fullProfileBio) fullProfileBio.textContent = developerProfile.bio;
  if (fullSkillsList) {
    fullSkillsList.innerHTML = (developerProfile.skills || [])
      .map(s => `<span class="skill-tag">⚡ ${escapeHtml(s)}</span>`)
      .join('');
  }
  if (linkGithub) linkGithub.href = developerProfile.github || 'https://github.com/arya30062003';
  if (linkLinkedin) linkLinkedin.href = developerProfile.linkedin || 'https://linkedin.com';
  if (linkWebsite) linkWebsite.href = developerProfile.website || window.location.origin;
  if (linkEmail) linkEmail.href = `mailto:${developerProfile.email || 'developer@example.com'}`;
}

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
  editProfileModal.showModal();
}

if (editProfileBtn) editProfileBtn.addEventListener('click', openEditProfileModal);
if (openFullEditBtn) openFullEditBtn.addEventListener('click', openEditProfileModal);
if (closeEditProfileModal) closeEditProfileModal.addEventListener('click', () => editProfileModal.close());
if (cancelEditProfileBtn) cancelEditProfileBtn.addEventListener('click', () => editProfileModal.close());

if (editProfileForm) {
  editProfileForm.addEventListener('submit', (e) => {
    e.preventDefault();
    developerProfile.name = document.getElementById('inputProfileName').value.trim();
    developerProfile.title = document.getElementById('inputProfileTitle').value.trim();
    developerProfile.bio = document.getElementById('inputProfileBio').value.trim();
    developerProfile.skills = document.getElementById('inputProfileSkills').value.split(',').map(s => s.trim()).filter(Boolean);
    developerProfile.github = document.getElementById('inputProfileGithub').value.trim();
    developerProfile.linkedin = document.getElementById('inputProfileLinkedin').value.trim();
    saveDeveloperProfile();
    editProfileModal.close();
  });
}

async function saveDeveloperProfile() {
  localStorage.setItem('flashdrop_profile', JSON.stringify(developerProfile));
  renderDeveloperProfile();
  try {
    await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(developerProfile)
    });
  } catch (e) {}
}

// ----------------------------------------------------
// 11. Tab Switching
// ----------------------------------------------------
function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

  const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  if (btn) btn.classList.add('active');

  if (tabId === 'exchange') {
    document.getElementById('tabExchange').classList.add('active');
  } else if (tabId === 'history') {
    document.getElementById('tabHistory').classList.add('active');
    renderHistory();
  } else if (tabId === 'portfolio') {
    document.getElementById('tabPortfolio').classList.add('active');
  }
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
});

if (navProfileBtn) navProfileBtn.addEventListener('click', () => switchTab('portfolio'));
if (viewPortfolioTabBtn) viewPortfolioTabBtn.addEventListener('click', () => switchTab('portfolio'));

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Startup
initSplashScreen();
initDeveloperProfile();
registerP2P();
initQR();
