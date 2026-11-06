# ⚡ FlashDrop — True Device-to-Device P2P File Exchange

**FlashDrop** is an ultra-fast, zero-bloat, direct peer-to-peer file exchange system. It allows phones (Android / iOS) and computers (Windows / Mac / Linux) to exchange movies, photos, and files directly **without uploading to any cloud server**.

---

## 🔒 True Peer-to-Peer (WebRTC Direct)

| Legacy Cloud Transfer | FlashDrop True P2P |
| :--- | :--- |
| ❌ Uploads 2GB movie to cloud server | ✅ **0 bytes uploaded to any server** |
| ❌ Consumes double internet data | ✅ **Uses local Wi-Fi radio directly** |
| ❌ Limited by cloud storage quota | ✅ **No file size limit** (any movie/photo size) |
| ❌ Privacy risk (files stored on servers) | ✅ **100% Private direct device stream** |

---

## 🚀 How It Works

1. **Local Radar Discovery:** When you open FlashDrop on two devices (on the same Wi-Fi, hotspot, or room), they appear instantly on each other's radar.
2. **Direct WebRTC DataChannel:** When you tap a device to send a movie, the file streams directly from Device A's Wi-Fi antenna to Device B's Wi-Fi antenna.
3. **Instant Auto-Save:** The receiving device saves the file directly as chunks arrive.


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
