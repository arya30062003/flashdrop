# ⚡ FlashDrop — Extreme-Speed Local & Cloud File Transfer

**FlashDrop** is an ultra-fast, zero-bloat, peer-to-peer file transfer system engineered for seamless sharing between **mobile devices (Android / iOS)** and **laptops/PCs (Windows / Mac / Linux)**.

Features an **animated app splash screen**, a built-in **Creator Portfolio with profile photo customization**, and full support for **Render Cloud deployment**.

---

## 🚀 Key Features

- **⚡ Extreme Transfer Speeds:** Streams raw binary data using 1 MB chunks and `TCP_NODELAY` (no multipart/form-data overhead).
- **📱 Universal Compatibility:** Works on Android, iPhone, Windows, Mac, and Linux. No app store installation needed!
- **✨ Animated Splash Screen:** Smooth loading transition with electric glow and brand logo.
- **👨‍💻 Creator Portfolio on Home Screen:** Includes profile photo, title, bio, skill tags, and social links (customizable directly in the UI).
- **🌐 Dual Mode:** Works offline over local Wi-Fi / Hotspot or globally when deployed to **Render Cloud**.
- **📷 Instant QR Code Pairing:** Built-in offline SVG QR generator + in-browser camera QR code reader.
- **📲 Progressive Web App (PWA):** Installable as a standalone fullscreen app on mobile home screens.

---

## 🛠️ Local Quick Start (Laptop & Mobile)

### 1. Start the Server Locally
```powershell
cd C:\Users\Kewte\.gemini\antigravity\scratch\flashdrop
node server.js
```

### 2. Connect Your Mobile Device
1. Connect your phone and laptop to the **same Wi-Fi router** (or connect your laptop to your phone's mobile hotspot).
2. Point your phone camera at the **terminal QR Code** or open `http://localhost:5050` on your laptop.
3. Tap the link to open FlashDrop on your phone and start streaming files at full Wi-Fi speed.

---

## ☁️ Deploying to Render (Free Cloud Hosting)

Deploying FlashDrop to Render allows anyone on the internet to send and receive files from any device worldwide.

### Method 1: Deploy with Git & GitHub (Recommended)

1. **Initialize Git & Push to GitHub:**
   ```bash
   git remote add origin https://github.com/arya30062003/flashdrop.git
   git branch -M main
   git push -u origin main
   ```

2. **Deploy on Render:**
   - Log in to [render.com](https://render.com).
   - Click **New +** > **Web Service**.
   - Connect your GitHub repository `flashdrop`.
   - Render automatically detects `render.yaml` and configures everything:
     - **Runtime:** `Node`
     - **Build Command:** *(leave empty)*
     - **Start Command:** `node server.js`
     - **Plan:** `Free`
   - Click **Create Web Service**.

3. **Access Globally:**
   - Render will assign your app a public URL: `https://flashdrop.onrender.com`.
   - Open that URL on your phone or laptop. The QR code generator automatically switches to your public Render cloud URL!

---

## 👤 Customizing Your Developer Portfolio

You can customize your developer photo, name, title, bio, and social links in two ways:
1. **Directly in the App:** Click **"Edit Profile"** on the home screen or full portfolio tab, upload a new photo, and save.
2. **Edit Configuration:** Edit `developer_profile.json` or customize defaults in `server.js` and `app.js`.

---

## 📁 Storage
- Received files are stored in the `received_files/` folder.
- In local mode, files persist on your laptop's disk.
- In Render free tier, storage is ephemeral (standard for secure file-drop services). For permanent storage on Render, attach a persistent disk under **Disks** in your Render dashboard.
