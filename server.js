// FlashDrop - Ultra-Fast Peer-to-Peer Local Network File Transfer
// Clean-room, high-performance streaming architecture using native Node.js
// Optimized for both local Wi-Fi / Hotspot and Cloud deployment (Render)

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { EventEmitter } = require('events');

const PORT = process.env.PORT || 5050;
const STORAGE_DIR = path.join(__dirname, 'received_files');
const PUBLIC_DIR = path.join(__dirname, 'public');
const PROFILE_FILE = path.join(__dirname, 'developer_profile.json');

// Ensure storage directory exists
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

// Global event bus for real-time SSE broadcasts
const eventBus = new EventEmitter();
const sseClients = new Set();

// Standalone QR Code Generator
class QRGen {
  constructor() {
    this.GF = new Uint8Array(512);
    this.LOG = new Uint8Array(256);
    let x = 1;
    for (let i = 0; i < 255; i++) {
      this.GF[i] = x;
      this.GF[i + 255] = x;
      this.LOG[x] = i;
      x = (x << 1) ^ (x >= 128 ? 0x11d : 0);
    }
  }

  gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return this.GF[this.LOG[a] + this.LOG[b]];
  }

  rsGenPoly(n) {
    let poly = [1];
    for (let i = 0; i < n; i++) {
      let next = new Array(poly.length + 1).fill(0);
      for (let j = 0; j < poly.length; j++) {
        next[j] ^= this.gfMul(poly[j], this.GF[i]);
        next[j + 1] ^= poly[j];
      }
      poly = next;
    }
    return poly;
  }

  rsEncode(data, numEc) {
    const poly = this.rsGenPoly(numEc);
    const result = new Uint8Array(numEc);
    for (let i = 0; i < data.length; i++) {
      const coef = data[i] ^ result[0];
      for (let j = 0; j < numEc - 1; j++) {
        result[j] = result[j + 1] ^ this.gfMul(coef, poly[poly.length - 2 - j]);
      }
      result[numEc - 1] = this.gfMul(coef, poly[0]);
    }
    return result;
  }

  static VERSIONS = [
    null,
    { ver: 1, size: 21, totalCw: 26, ecCw: 7, dataCw: 19, align: [] },
    { ver: 2, size: 25, totalCw: 44, ecCw: 10, dataCw: 34, align: [6, 18] },
    { ver: 3, size: 29, totalCw: 70, ecCw: 15, dataCw: 55, align: [6, 22] },
    { ver: 4, size: 33, totalCw: 100, ecCw: 20, dataCw: 80, align: [6, 26] },
    { ver: 5, size: 37, totalCw: 134, ecCw: 26, dataCw: 108, align: [6, 30] }
  ];

  generate(text) {
    const utf8 = Buffer.from(text, 'utf8');
    let vInfo = null;
    for (let v = 1; v <= 5; v++) {
      if (utf8.length + 2 <= QRGen.VERSIONS[v].dataCw) {
        vInfo = QRGen.VERSIONS[v];
        break;
      }
    }
    if (!vInfo) vInfo = QRGen.VERSIONS[5];

    const bits = [];
    const pushBits = (val, len) => {
      for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
    };

    pushBits(4, 4); // Byte mode
    pushBits(utf8.length, 8);
    for (let b of utf8) pushBits(b, 8);
    const maxDataBits = vInfo.dataCw * 8;
    pushBits(0, Math.min(4, maxDataBits - bits.length));
    while (bits.length % 8 !== 0) bits.push(0);
    const pad = [0xEC, 0x11];
    let padIdx = 0;
    while (bits.length < maxDataBits) {
      pushBits(pad[padIdx % 2], 8);
      padIdx++;
    }

    const dataCw = new Uint8Array(vInfo.dataCw);
    for (let i = 0; i < vInfo.dataCw; i++) {
      let b = 0;
      for (let j = 0; j < 8; j++) b = (b << 1) | bits[i * 8 + j];
      dataCw[i] = b;
    }

    const ec = this.rsEncode(dataCw, vInfo.ecCw);
    const finalCw = new Uint8Array(vInfo.totalCw);
    finalCw.set(dataCw, 0);
    finalCw.set(ec, dataCw.length);

    const N = vInfo.size;
    const matrix = Array.from({ length: N }, () => new Int8Array(N).fill(-1));
    const isReserved = Array.from({ length: N }, () => new Uint8Array(N));
    const setReserved = (r, c, val) => {
      matrix[r][c] = val;
      isReserved[r][c] = 1;
    };

    const addFinder = (row, col) => {
      for (let r = -1; r <= 7; r++) {
        for (let c = -1; c <= 7; c++) {
          const nr = row + r, nc = col + c;
          if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
          if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
            setReserved(nr, nc, (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) ? 1 : 0);
          } else {
            setReserved(nr, nc, 0);
          }
        }
      }
    };
    addFinder(0, 0);
    addFinder(0, N - 7);
    addFinder(N - 7, 0);

    for (let i = 8; i < N - 8; i++) {
      setReserved(6, i, i % 2 === 0 ? 1 : 0);
      setReserved(i, 6, i % 2 === 0 ? 1 : 0);
    }

    if (vInfo.align.length > 0) {
      for (let ar of vInfo.align) {
        for (let ac of vInfo.align) {
          if (isReserved[ar][ac]) continue;
          for (let r = -2; r <= 2; r++) {
            for (let c = -2; c <= 2; c++) {
              setReserved(ar + r, ac + c, (Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0)) ? 1 : 0);
            }
          }
        }
      }
    }

    setReserved(4 * vInfo.ver + 9, 8, 1);
    for (let i = 0; i < 9; i++) {
      if (!isReserved[8][i]) setReserved(8, i, 0);
      if (!isReserved[i][8]) setReserved(i, 8, 0);
    }
    for (let i = 0; i < 8; i++) {
      if (!isReserved[8][N - 1 - i]) setReserved(8, N - 1 - i, 0);
      if (!isReserved[N - 1 - i][8]) setReserved(N - 1 - i, 8, 0);
    }

    const allBits = [];
    for (let b of finalCw) {
      for (let i = 7; i >= 0; i--) allBits.push((b >> i) & 1);
    }

    let bitIdx = 0;
    let up = true;
    for (let c = N - 1; c > 0; c -= 2) {
      if (c === 6) c--;
      const rows = up ? Array.from({ length: N }, (_, i) => N - 1 - i) : Array.from({ length: N }, (_, i) => i);
      for (let r of rows) {
        for (let dc = 0; dc < 2; dc++) {
          const col = c - dc;
          if (!isReserved[r][col]) {
            const bit = bitIdx < allBits.length ? allBits[bitIdx++] : 0;
            const mask = (r + col) % 2 === 0 ? 1 : 0;
            matrix[r][col] = bit ^ mask;
          }
        }
      }
      up = !up;
    }

    const fmtBits = [1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0];
    for (let i = 0; i < 6; i++) matrix[8][i] = fmtBits[i];
    matrix[8][7] = fmtBits[6];
    matrix[8][8] = fmtBits[7];
    matrix[7][8] = fmtBits[8];
    for (let i = 0; i < 6; i++) matrix[5 - i][8] = fmtBits[9 + i];
    for (let i = 0; i < 7; i++) matrix[N - 1 - i][8] = fmtBits[i];
    for (let i = 0; i < 8; i++) matrix[8][N - 8 + i] = fmtBits[7 + i];

    return { size: N, matrix };
  }

  toSVG(text, margin = 2) {
    const { size, matrix } = this.generate(text);
    const totalSize = size + margin * 2;
    let paths = '';
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (matrix[r][c] === 1) {
          paths += `M${c + margin},${r + margin}h1v1h-1z `;
        }
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" shape-rendering="crispEdges">
      <rect width="100%" height="100%" fill="#ffffff" rx="1.5" />
      <path d="${paths}" fill="#0f172a" />
    </svg>`;
  }

  toASCII(text) {
    const { size, matrix } = this.generate(text);
    let output = '  ' + '  '.repeat(size + 2) + '\n';
    for (let r = 0; r < size; r++) {
      let line = '    ';
      for (let c = 0; c < size; c++) {
        line += matrix[r][c] === 1 ? '██' : '  ';
      }
      output += line + '\n';
    }
    output += '  ' + '  '.repeat(size + 2);
    return output;
  }
}

const qrGen = new QRGen();

// Get local network IPs (Wi-Fi, Hotspot, Ethernet)
function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push({
          interface: name,
          ip: net.address
        });
      }
    }
  }
  return ips;
}

// Broadcast event to all SSE clients
function broadcastEvent(type, data) {
  const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch (e) {
      sseClients.delete(client);
    }
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getUniqueFilename(dir, originalName) {
  let name = path.basename(originalName).replace(/[^\w\s\.-]/gi, '_');
  let targetPath = path.join(dir, name);
  let counter = 1;
  const ext = path.extname(name);
  const base = path.basename(name, ext);

  while (fs.existsSync(targetPath)) {
    name = `${base}_${counter}${ext}`;
    targetPath = path.join(dir, name);
    counter++;
  }
  return { filename: name, fullPath: targetPath };
}

// Default Developer Portfolio Profile
const DEFAULT_PROFILE = {
  name: "Kewte",
  title: "Full Stack & Systems Developer",
  bio: "Creator of FlashDrop. Passionate about high-speed P2P networking, distributed applications, and modern cross-platform engineering.",
  photoUrl: "/icons/developer-avatar.svg",
  skills: ["Node.js", "P2P Protocols", "PWA", "Real-Time Streaming", "Cloud Deployment"],
  github: "https://github.com",
  linkedin: "https://linkedin.com",
  website: "https://render.com",
  email: "developer@example.com"
};

function getProfile() {
  try {
    if (fs.existsSync(PROFILE_FILE)) {
      return JSON.parse(fs.readFileSync(PROFILE_FILE, 'utf8'));
    }
  } catch (e) {}
  return DEFAULT_PROFILE;
}

function saveProfile(data) {
  try {
    fs.writeFileSync(PROFILE_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    return false;
  }
}

// MIME types lookup
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.pdf': 'application/pdf',
  '.apk': 'application/vnd.android.package-archive',
  '.zip': 'application/zip'
};

// Create High-Performance HTTP Server
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.socket) req.socket.setNoDelay(true);

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);

  // Detect Render / Cloud environment
  const isRender = Boolean(process.env.RENDER || process.env.RENDER_EXTERNAL_URL);
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`;
  const externalUrl = process.env.RENDER_EXTERNAL_URL || `${proto}://${host}`;

  // ----------------------------------------------------
  // 1. API: Server & Network Info
  // ----------------------------------------------------
  if (pathname === '/api/info' && req.method === 'GET') {
    const ips = getLocalIPs();
    const primaryIp = ips[0] ? ips[0].ip : '127.0.0.1';
    
    // In cloud/Render, prioritize external URL; locally, prioritize Wi-Fi IP
    const url = isRender ? externalUrl : `http://${primaryIp}:${PORT}`;

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      hostname: os.hostname(),
      platform: os.platform(),
      ips,
      primaryIp,
      port: PORT,
      isRender,
      externalUrl,
      url
    }));
    return;
  }

  // ----------------------------------------------------
  // 2. API: Developer Portfolio Profile
  // ----------------------------------------------------
  if (pathname === '/api/profile' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(getProfile()));
    return;
  }

  if (pathname === '/api/profile' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const update = JSON.parse(body);
        const current = getProfile();
        const merged = { ...current, ...update };
        saveProfile(merged);
        broadcastEvent('profile-updated', merged);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, profile: merged }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // ----------------------------------------------------
  // 3. API: Dynamic Offline QR Code (SVG)
  // ----------------------------------------------------
  if (pathname === '/api/qr.svg' && req.method === 'GET') {
    const defaultUrl = isRender ? externalUrl : `http://${getLocalIPs()[0]?.ip || '127.0.0.1'}:${PORT}`;
    const text = parsedUrl.searchParams.get('text') || defaultUrl;
    const svg = qrGen.toSVG(text);
    res.writeHead(200, {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400'
    });
    res.end(svg);
    return;
  }

  // ----------------------------------------------------
  // 4. API: High-Speed Upload Endpoint
  // ----------------------------------------------------
  if (pathname === '/api/upload' && req.method === 'POST') {
    const rawFilename = req.headers['x-filename'] || parsedUrl.searchParams.get('filename') || `file_${Date.now()}`;
    const cleanFilename = decodeURIComponent(rawFilename);
    const totalSize = parseInt(req.headers['x-file-size'] || parsedUrl.searchParams.get('size') || '0', 10);
    const transferId = req.headers['x-transfer-id'] || `t_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const { filename, fullPath } = getUniqueFilename(STORAGE_DIR, cleanFilename);
    const writeStream = fs.createWriteStream(fullPath, { highWaterMark: 1024 * 1024 });

    let bytesReceived = 0;
    let lastTime = Date.now();
    let lastBytes = 0;
    let currentSpeedMBps = 0;

    broadcastEvent('transfer-start', {
      transferId,
      filename,
      totalSize,
      formattedSize: formatBytes(totalSize)
    });

    req.on('data', (chunk) => {
      bytesReceived += chunk.length;
      const now = Date.now();
      const elapsed = (now - lastTime) / 1000;

      if (elapsed >= 0.25) {
        const bytesDiff = bytesReceived - lastBytes;
        currentSpeedMBps = parseFloat(((bytesDiff / elapsed) / (1024 * 1024)).toFixed(2));
        lastTime = now;
        lastBytes = bytesReceived;

        broadcastEvent('transfer-progress', {
          transferId,
          bytesReceived,
          totalSize,
          percent: totalSize > 0 ? Math.min(100, Math.round((bytesReceived / totalSize) * 100)) : 0,
          speedMBps: currentSpeedMBps
        });
      }
    });

    req.pipe(writeStream);

    writeStream.on('finish', () => {
      const stats = fs.statSync(fullPath);
      broadcastEvent('transfer-complete', {
        transferId,
        filename,
        size: stats.size,
        formattedSize: formatBytes(stats.size),
        downloadUrl: `/api/download/${encodeURIComponent(filename)}`
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        filename,
        size: stats.size,
        formattedSize: formatBytes(stats.size)
      }));
    });

    req.on('error', (err) => {
      console.error('Upload stream error:', err);
      try { fs.unlinkSync(fullPath); } catch (_) {}
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    });

    writeStream.on('error', (err) => {
      console.error('Write stream error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    });

    return;
  }

  // ----------------------------------------------------
  // 5. API: List Received Files
  // ----------------------------------------------------
  if (pathname === '/api/files' && req.method === 'GET') {
    fs.readdir(STORAGE_DIR, (err, files) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
        return;
      }

      const fileList = files
        .map(file => {
          try {
            const stats = fs.statSync(path.join(STORAGE_DIR, file));
            const ext = path.extname(file).toLowerCase();
            return {
              name: file,
              size: stats.size,
              formattedSize: formatBytes(stats.size),
              modified: stats.mtime,
              ext,
              downloadUrl: `/api/download/${encodeURIComponent(file)}`
            };
          } catch (e) {
            return null;
          }
        })
        .filter(Boolean)
        .sort((a, b) => b.modified - a.modified);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(fileList));
    });
    return;
  }

  // ----------------------------------------------------
  // 6. API: High-Speed Download (Supports Range / Resuming)
  // ----------------------------------------------------
  if (pathname.startsWith('/api/download/') && req.method === 'GET') {
    const filename = decodeURIComponent(pathname.replace('/api/download/', ''));
    const safePath = path.normalize(path.join(STORAGE_DIR, filename));

    if (!safePath.startsWith(STORAGE_DIR) || !fs.existsSync(safePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File Not Found');
      return;
    }

    const stat = fs.statSync(safePath);
    const fileSize = stat.size;
    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Cache-Control': 'no-cache'
      });

      const fileStream = fs.createReadStream(safePath, { start, end, highWaterMark: 1024 * 1024 });
      fileStream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache'
      });

      const fileStream = fs.createReadStream(safePath, { highWaterMark: 1024 * 1024 });
      fileStream.pipe(res);
    }
    return;
  }

  // ----------------------------------------------------
  // 7. API: Delete File
  // ----------------------------------------------------
  if (pathname.startsWith('/api/files/') && req.method === 'DELETE') {
    const filename = decodeURIComponent(pathname.replace('/api/files/', ''));
    const safePath = path.normalize(path.join(STORAGE_DIR, filename));

    if (!safePath.startsWith(STORAGE_DIR) || !fs.existsSync(safePath)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'File not found' }));
      return;
    }

    try {
      fs.unlinkSync(safePath);
      broadcastEvent('file-deleted', { filename });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, filename }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // ----------------------------------------------------
  // 8. API: Real-Time Server-Sent Events (SSE)
  // ----------------------------------------------------
  if (pathname === '/api/events' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive'
    });

    res.write('event: connected\ndata: {"status":"connected"}\n\n');
    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
    return;
  }

  // ----------------------------------------------------
  // 9. Static Web App & PWA Files
  // ----------------------------------------------------
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  const safeStaticPath = path.normalize(filePath);

  if (!safeStaticPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(safeStaticPath, (err, stats) => {
    if (err || !stats.isFile()) {
      const fallbackPath = path.join(PUBLIC_DIR, 'index.html');
      fs.readFile(fallbackPath, (readErr, content) => {
        if (readErr) {
          res.writeHead(404);
          res.end('Not Found');
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(content);
        }
      });
      return;
    }

    const ext = path.extname(safeStaticPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600'
    });

    fs.createReadStream(safeStaticPath).pipe(res);
  });
});

// Start Server
server.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIPs();
  const primaryIp = ips[0] ? ips[0].ip : '127.0.0.1';
  const accessUrl = process.env.RENDER_EXTERNAL_URL || `http://${primaryIp}:${PORT}`;

  console.log('\n=============================================================');
  console.log('   ⚡ FlashDrop - Ultra-Fast Local File Transfer (Running)  ');
  if (process.env.RENDER) {
    console.log('   🌐 Deployed on Render Cloud: ' + accessUrl);
  }
  console.log('=============================================================\n');
  console.log('  Local Laptop Access:  http://localhost:' + PORT);
  console.log('  Mobile / LAN Access:  ' + accessUrl);
  console.log('\n  Available Network Interfaces:');
  ips.forEach(({ interface: iface, ip }) => {
    console.log(`   - [${iface}] -> http://${ip}:${PORT}`);
  });
  console.log('\n  📱 SCAN QR CODE WITH MOBILE PHONE CAMERA TO CONNECT:\n');

  try {
    console.log(qrGen.toASCII(accessUrl));
  } catch (e) {
    console.log('  (QR ASCII display skipped: ' + e.message + ')');
  }

  console.log('\n  Ready! Connect phone to same Wi-Fi/Hotspot and open link.');
  console.log('  Transfers stream directly device-to-device at full Wi-Fi speed.\n');
});
