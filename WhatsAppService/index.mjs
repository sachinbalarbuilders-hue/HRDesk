/**
 * HRDesk WhatsApp Microservice — v2.0 (Baileys)
 *
 * Replaced whatsapp-web.js (Puppeteer/Chrome) with @whiskeysockets/baileys (pure WebSocket).
 * Benefits:
 *   - No headless Chrome needed for WhatsApp connectivity (~250 MB RAM saved)
 *   - No "stuck initializing" — Baileys reconnects natively on disconnect/logout
 *   - Session credentials stored as JSON files; QR scan only needed once per device link
 *
 * HTTP API surface is identical to v1 — no C# changes required.
 *
 * Poster generation (birthday/anniversary images) still uses puppeteer-core + Chrome
 * but only for HTML-to-screenshot rendering, not for WhatsApp connectivity.
 */

import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';
import puppeteer from 'puppeteer-core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Suppress Baileys' verbose pino logger — only show warnings and errors
// ---------------------------------------------------------------------------
const logger = {
    level: 'silent',
    trace: () => {},
    debug: () => {},
    info:  () => {},
    warn:  (...a) => console.warn('[Baileys WARN]', ...a),
    error: (...a) => console.error('[Baileys ERR]', ...a),
    fatal: (...a) => console.error('[Baileys FATAL]', ...a),
    child: () => logger,
};

// ---------------------------------------------------------------------------
// Express setup
// ---------------------------------------------------------------------------
const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(cors());

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let sock            = null;
let clientReady     = false;
let qrCodeDataUrl   = null;   // base64 PNG data URL served to the browser
let isResetting     = false;
let reconnectTimer  = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const delay = (min, max) =>
    new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (max - min + 1) + min)));

/**
 * Format a phone number or existing JID into a Baileys-compatible JID.
 * Individuals: 919876543210@s.whatsapp.net
 * Groups:      120363xxxxxx@g.us  (passed through as-is)
 */
const toJid = (phone) => {
    if (phone.includes('@')) return phone;
    let clean = phone.replace(/[^0-9]/g, '');
    if (!clean.startsWith('91') && clean.length === 10) clean = '91' + clean;
    return clean + '@s.whatsapp.net';
};

// ---------------------------------------------------------------------------
// Poster generation — uses puppeteer-core + Chrome ONLY for HTML screenshots.
// This is completely separate from WhatsApp connectivity.
// ---------------------------------------------------------------------------
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const generatePosterBase64 = async (html) => {
    if (!fs.existsSync(CHROME_PATH)) {
        console.warn('[Poster] Chrome not found at expected path. Skipping poster generation.');
        return null;
    }
    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
        ],
    });
    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1080, height: 1080 });
        await page.setContent(html, { waitUntil: 'load' });
        const element = await page.$('#poster');
        if (!element) throw new Error('#poster element not found in template');
        const screenshotBase64 = await element.screenshot({ encoding: 'base64' });
        await page.close();
        return screenshotBase64;
    } finally {
        await browser.close();
    }
};

// ---------------------------------------------------------------------------
// WhatsApp — Session reset
// ---------------------------------------------------------------------------
const clearReconnectTimer = () => {
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
};

const resetSession = async () => {
    if (isResetting) return;
    isResetting = true;
    console.log('[WhatsApp] Resetting session...');

    clientReady   = false;
    qrCodeDataUrl = null;
    clearReconnectTimer();

    if (sock) {
        try {
            sock.ev.removeAllListeners();
            await sock.logout().catch(() => {});
        } catch (_) {}
        sock = null;
    }

    const authPath = path.join(__dirname, 'baileys_auth');
    for (let i = 0; i < 3; i++) {
        try {
            if (fs.existsSync(authPath)) {
                fs.rmSync(authPath, { recursive: true, force: true });
                console.log('[WhatsApp] Cleared baileys_auth directory.');
            }
            break;
        } catch (e) {
            console.error(`[WhatsApp] Attempt ${i + 1}: Failed to clear auth (${e.message}). Retrying...`);
            await delay(1000, 1000);
        }
    }

    isResetting = false;
    setTimeout(connectToWhatsApp, 1000);
};

// ---------------------------------------------------------------------------
// WhatsApp — Connect
// ---------------------------------------------------------------------------
const connectToWhatsApp = async () => {
    if (isResetting) return;

    try {
        const { state, saveCreds } = await useMultiFileAuthState(
            path.join(__dirname, 'baileys_auth')
        );
        const { version } = await fetchLatestBaileysVersion();
        console.log(`[WhatsApp] Connecting with WA version ${version.join('.')}`);

        sock = makeWASocket({
            version,
            auth: state,
            logger,
            printQRInTerminal: false,
            generateHighQualityLinkPreview: false,
            // Identifies as Chrome browser to WhatsApp servers
            browser: ['HRDesk', 'Chrome', '122.0.0.0'],
        });

        // Persist updated credentials whenever they change
        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
            // New QR code available — generate a base64 PNG data URL for the browser
            if (qr) {
                console.log('[WhatsApp] QR code ready — scan from the WhatsApp Config page.');
                qrCodeDataUrl = await QRCode.toDataURL(qr, {
                    errorCorrectionLevel: 'M',
                    scale: 8,
                    margin: 2,
                });
                clientReady = false;
            }

            if (connection === 'open') {
                console.log('[WhatsApp] Connected and ready!');
                clientReady   = true;
                qrCodeDataUrl = null;
                clearReconnectTimer();
            }

            if (connection === 'close') {
                const statusCode  = lastDisconnect?.error?.output?.statusCode;
                const loggedOut   = statusCode === DisconnectReason.loggedOut;
                console.log(`[WhatsApp] Connection closed. StatusCode: ${statusCode} | LoggedOut: ${loggedOut}`);

                clientReady   = false;
                qrCodeDataUrl = null;

                if (loggedOut) {
                    // User removed device from their phone — wipe credentials and get new QR
                    console.log('[WhatsApp] Device was unlinked from phone. Requesting fresh QR...');
                    await resetSession();
                } else {
                    // Transient error (network blip, server restart) — just reconnect
                    console.log('[WhatsApp] Reconnecting in 5 seconds...');
                    clearReconnectTimer();
                    reconnectTimer = setTimeout(connectToWhatsApp, 5000);
                }
            }
        });

    } catch (err) {
        console.error('[WhatsApp] Failed to connect:', err.message);
        if (!isResetting) {
            console.log('[WhatsApp] Retrying in 10 seconds...');
            clearReconnectTimer();
            reconnectTimer = setTimeout(connectToWhatsApp, 10000);
        }
    }
};

// Start WhatsApp connection on service boot
connectToWhatsApp();

// ---------------------------------------------------------------------------
// Rate-limited message queue
// ---------------------------------------------------------------------------
const messageQueue          = [];
let   isQueueProcessing     = false;
let   consecutiveMessagesSent = 0;

const processQueue = async () => {
    if (isQueueProcessing || messageQueue.length === 0) return;
    isQueueProcessing = true;

    while (messageQueue.length > 0) {
        if (!clientReady || !sock) {
            console.log('[Queue] Client not ready — pausing 10 seconds...');
            await delay(10000, 10000);
            continue;
        }

        // 10-minute break after every 25 messages to avoid spam detection
        if (consecutiveMessagesSent >= 25) {
            console.log('[Queue] Taking a 10-minute human-behaviour break...');
            await delay(600000, 600000);
            consecutiveMessagesSent = 0;
        }

        const task = messageQueue.shift();

        try {
            const jid = toJid(task.phone);
            console.log(`[Queue] Sending ${task.type} to ${jid}...`);

            // Simulate typing indicator for a more human-like experience
            try {
                await sock.sendPresenceUpdate('composing', jid);
                await delay(3000, 7000);
                await sock.sendPresenceUpdate('paused', jid);
            } catch (_) {
                // Presence update failures are non-fatal
            }

            if (task.type === 'text') {
                await sock.sendMessage(jid, { text: task.message });

            } else if (task.type === 'celebration') {
                // Generate a birthday/anniversary poster as an image
                const templateName = task.eventType === 'Anniversary'
                    ? 'anniversary_template.html'
                    : 'poster_template.html';

                let html = fs.readFileSync(path.join(__dirname, templateName), 'utf8');

                let photoSrc   = task.photoBase64 || '';
                let dynamicCss = '';

                if (!photoSrc || photoSrc.trim() === '') {
                    photoSrc   = '';
                    dynamicCss = `
                        .photo-container, .photo-frame { display: none !important; }
                        .left-content { width: 1080px !important; }
                        .text-happy { font-size: 180px !important; }
                        .text-birthday { font-size: 110px !important; margin-top: -20px !important; }
                        .text-message { font-size: 32px !important; max-width: 800px !important; line-height: 1.8 !important; }
                        .content { justify-content: center !important; padding-top: 0 !important; }
                        .headline { font-size: 100px !important; margin-bottom: 30px !important; }
                        .name { font-size: 55px !important; margin-top: 30px !important; }
                        .message { font-size: 26px !important; max-width: 800px !important; line-height: 1.8 !important; }
                        .footer { position: absolute !important; bottom: 30px !important; margin-top: 0 !important; }
                    `;
                } else if (!photoSrc.startsWith('data:image')) {
                    photoSrc = 'data:image/jpeg;base64,' + photoSrc;
                }

                html = html
                    .replace('{{THEME}}',         task.eventType)
                    .replace('{{PHOTO_BASE64}}',   photoSrc)
                    .replace('{{EMPLOYEE_NAME}}',  task.name)
                    .replace('{{EVENT_TYPE}}',     task.eventType)
                    .replace('{{YEARS}}',          task.years || '')
                    .replace('{{DYNAMIC_CSS}}',    dynamicCss);

                const screenshotBase64 = await generatePosterBase64(html);

                if (screenshotBase64) {
                    const msgOpts = { image: Buffer.from(screenshotBase64, 'base64'), mimetype: 'image/png' };
                    if (task.caption) msgOpts.caption = task.caption;
                    await sock.sendMessage(jid, msgOpts);
                } else {
                    // Fallback if Chrome isn't available — send as text
                    const fallbackText = task.caption || `🎉 Happy ${task.eventType}, ${task.name}! 🎂`;
                    await sock.sendMessage(jid, { text: fallbackText });
                    console.warn('[Queue] Poster generation failed — sent text fallback instead.');
                }

            } else if (task.type === 'document') {
                const msgOpts = {
                    document: Buffer.from(task.message, 'base64'),
                    mimetype:  task.mimetype,
                    fileName:  task.filename,
                };
                if (task.caption) msgOpts.caption = task.caption;
                await sock.sendMessage(jid, msgOpts);

            } else if (task.type === 'image') {
                const msgOpts = {
                    image:    Buffer.from(task.message, 'base64'),
                    mimetype: task.mimetype,
                };
                if (task.caption) msgOpts.caption = task.caption;
                await sock.sendMessage(jid, msgOpts);
            }

            console.log(`[Queue] ✓ Sent to ${jid}`);
            consecutiveMessagesSent++;

            if (messageQueue.length > 0) {
                console.log(`[Queue] Remaining: ${messageQueue.length}`);
            }

        } catch (err) {
            console.error(`[Queue] ✗ Failed to send to ${task.phone}:`, err.message);
        }
    }

    isQueueProcessing = false;
};

// ---------------------------------------------------------------------------
// API Endpoints — identical surface to v1; C# code unchanged
// ---------------------------------------------------------------------------

/** GET /groups — list all WhatsApp groups the linked account is in */
app.get('/groups', async (req, res) => {
    if (!clientReady || !sock) {
        return res.json({ count: 0, groups: [], error: 'WhatsApp client is not ready. Please wait.' });
    }
    try {
        const groupsObj = await sock.groupFetchAllParticipating();
        const groups = Object.entries(groupsObj).map(([id, meta]) => ({
            id,
            name: meta.subject || 'Unnamed Group',
        }));
        console.log(`[GET /groups] Found ${groups.length} groups.`);
        return res.json({ count: groups.length, groups });
    } catch (err) {
        console.error('[GET /groups] Error:', err.message);
        return res.json({ count: 0, groups: [], error: err.message });
    }
});

/** GET /status — quick ready check + queue length */
app.get('/status', (req, res) => {
    res.json({ ready: clientReady, queueLength: messageQueue.length });
});

/**
 * GET /qr — status + QR code data URL.
 * Response shape is identical to v1.
 * qr field is now a base64 PNG data URL (e.g. "data:image/png;base64,...")
 * instead of a raw QR string — the browser renders it with a simple <img> tag.
 */
app.get('/qr', (req, res) => {
    if (clientReady) {
        return res.json({ status: 'connected' });
    }
    if (qrCodeDataUrl) {
        return res.json({ status: 'qr_ready', qr: qrCodeDataUrl });
    }
    return res.json({ status: 'initializing' });
});

/** POST /reset — wipe credentials and reconnect with fresh QR */
app.post('/reset', (req, res) => {
    res.json({ success: true, message: 'Session reset initiated.' });
    resetSession();
});

/** POST /send — add a message to the rate-limited queue */
app.post('/send', (req, res) => {
    const {
        phone, message, type = 'text',
        filename, mimetype, caption,
        name, eventType, photoBase64, years,
    } = req.body;

    if (!phone || (!message && type !== 'celebration')) {
        return res.status(400).json({ error: 'phone and message are required' });
    }

    messageQueue.push({ phone, message, type, filename, mimetype, caption, name, eventType, photoBase64, years });
    processQueue();

    res.json({ success: true, message: 'Message added to rate-limited queue', queuePosition: messageQueue.length });
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`[Server] HRDesk WhatsApp Service v2.0 (Baileys) running on port ${PORT}`);
    console.log(`[Server] No Chrome required for WhatsApp connectivity.`);
    console.log(`[Server] QR code will appear on the WhatsApp Config page within ~10 seconds.`);
});
