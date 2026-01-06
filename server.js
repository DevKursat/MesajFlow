
const express = require('express');
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const port = process.env.PORT || 3000;

// 1. WhatsApp Worker'ı ayrı bir işlem olarak başlat
console.log('--- WHATSAPP WORKER BAŞLATILIYOR ---');
const worker = spawn('node', ['whatsapp-worker.js'], {
    stdio: 'inherit',
    env: { ...process.env }
});

worker.on('error', (err) => {
    console.error('Worker başlatılamadı:', err);
});

// 2. Statik Dosyaları Sun (React Build)
app.use(express.static(path.join(__dirname, 'dist')));

// 3. Tüm rotaları index.html'e yönlendir (SPA desteği)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
    console.log(`--- ADMIN PANEL ${port} PORTUNDA AKTIF ---`);
});
