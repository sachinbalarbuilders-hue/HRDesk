const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(cors());

// State variables
let qrCodeData = null;
let clientReady = false;
let isAuthenticated = false;

const { execSync } = require('child_process');

let client = null;
let clientBrowserPid = null;

const killServiceChrome = () => {
    try {
        let pidToKill = null;
        if (client && client.pupBrowser && client.pupBrowser.process()) {
            pidToKill = client.pupBrowser.process().pid;
        } else if (clientBrowserPid) {
            pidToKill = clientBrowserPid;
        }

        if (pidToKill && process.platform === 'win32') {
            execSync(`taskkill /F /PID ${pidToKill} /T`, { stdio: 'ignore' });
            console.log(`Closed WhatsApp service Chrome PID ${pidToKill}`);
        }
    } catch (e) {
        // Ignored
    }
    clientBrowserPid = null;
};

const resetSession = async () => {
    if (isResetting) return;
    isResetting = true;

    console.log('Resetting WhatsApp session and clearing auth storage...');
    clientReady = false;
    isAuthenticated = false;
    qrCodeData = null;

    if (client) {
        try {
            killServiceChrome();
            await Promise.race([
                client.destroy().catch(e => console.log('Client destroy error (ignored):', e)),
                new Promise(resolve => setTimeout(resolve, 2000))
            ]);
        } catch (e) {
            console.log('Error destroying client:', e);
        }
    }
    client = null;

    killServiceChrome();
    await new Promise(resolve => setTimeout(resolve, 1000));

    const authPath = path.join(__dirname, '.wwebjs_auth');
    const cachePath = path.join(__dirname, '.wwebjs_cache');
    
    for (let i = 0; i < 3; i++) {
        try {
            if (fs.existsSync(authPath)) {
                fs.rmSync(authPath, { recursive: true, force: true });
                console.log('Cleared .wwebjs_auth directory.');
            }
            if (fs.existsSync(cachePath)) {
                fs.rmSync(cachePath, { recursive: true, force: true });
                console.log('Cleared .wwebjs_cache directory.');
            }
            break;
        } catch (e) {
            console.error(`Attempt ${i + 1}: Failed to remove auth/cache directory (${e.message}). Retrying...`);
            killServiceChrome();
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    isResetting = false;
    initClient();
};

function initClient() {
    client = new Client({
        authStrategy: new LocalAuth(),
        webVersionCache: {
            type: 'remote',
            remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1012248833-alpha.html'
        },
        puppeteer: {
            executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--user-data-dir=' + path.join(__dirname, '.chrome_profile')
            ],
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        }
    });

    client.on('qr', (qr) => {
        console.log('QR RECEIVED', qr);
        qrcode.generate(qr, { small: true });
        qrCodeData = qr;
        isAuthenticated = false;
    });

    client.on('authenticated', () => {
        console.log('AUTHENTICATED SUCCESSFULLY!');
        isAuthenticated = true;
        qrCodeData = null;
    });

    client.on('loading_screen', (percent, message) => {
        console.log('LOADING SCREEN:', percent, message);
    });

    client.on('change_state', state => {
        console.log('STATE CHANGE:', state);
    });

    client.on('ready', () => {
        console.log('Client is ready!');
        clientReady = true;
        isAuthenticated = true;
        qrCodeData = null;
    });

    client.on('auth_failure', (msg) => {
        console.error('AUTHENTICATION FAILURE:', msg);
        clientReady = false;
        qrCodeData = null;
        resetSession();
    });

    client.on('disconnected', (reason) => {
        console.log('Client was logged out:', reason);
        clientReady = false;
        qrCodeData = null;
        resetSession();
    });

    client.initialize().catch(err => {
        console.error('Initialization error:', err);
        clientReady = false;
    });
}

initClient();

// --- Rate Limited Message Queue ---
const messageQueue = [];
let isQueueProcessing = false;
let consecutiveMessagesSent = 0;

// Helper: Random delay between min and max ms
const delay = (min, max) => new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (max - min + 1) + min)));

const processQueue = async () => {
    if (isQueueProcessing || messageQueue.length === 0) return;
    isQueueProcessing = true;

    while (messageQueue.length > 0) {
        if (!clientReady) {
            console.log('Client not ready, pausing queue for 10 seconds...');
            await delay(10000, 10000);
            continue;
        }

        // 10-minute break after every 25 messages
        if (consecutiveMessagesSent >= 25) {
            console.log('Taking a 10-minute break to simulate human behavior...');
            await delay(600000, 600000); // 10 minutes
            consecutiveMessagesSent = 0;
        }

        const task = messageQueue.shift();
        try {
            let formattedNumber = task.phone;
            
            // If it's not already a group or formatted id, clean it up
            if (!formattedNumber.includes('@')) {
                let cleanPhone = formattedNumber.replace(/[^0-9]/g, '');
                if (!cleanPhone.startsWith('91') && cleanPhone.length === 10) {
                    cleanPhone = '91' + cleanPhone; // Assuming India by default, adapt as needed
                }
                formattedNumber = `${cleanPhone}@c.us`;
            }
            
            console.log(`Processing message for ${formattedNumber}...`);
            
            // Try to get chat to send typing indicator
            try {
                const chat = await client.getChatById(formattedNumber);
                await chat.sendStateTyping();
                
                // Simulate typing time (5-10 seconds)
                console.log(`Simulating typing for ${formattedNumber}...`);
                await delay(5000, 10000);
                await chat.clearState();
            } catch (err) {
                console.log('Could not send typing indicator (chat may not exist yet)');
            }

            if (task.type === 'text') {
                await client.sendMessage(formattedNumber, task.message);
            } else if (task.type === 'celebration') {
                // Dynamically generate poster using Puppeteer
                console.log(`Generating poster for ${task.name}...`);
                const templateName = task.eventType === 'Anniversary' ? 'anniversary_template.html' : 'poster_template.html';
                const templatePath = path.join(__dirname, templateName);
                let html = fs.readFileSync(templatePath, 'utf8');
                
                // Ensure photo base64 has data URI prefix
                let photoSrc = task.photoBase64;
                let dynamicCss = '';
                
                if (!photoSrc || photoSrc.trim() === '') {
                    // No photo provided, hide the photo container and center the text
                    photoSrc = '';
                    dynamicCss = `
                        .photo-container, .photo-frame { display: none !important; }
                        /* Poster Template */
                        .left-content { width: 1080px !important; }
                        .text-happy { font-size: 180px !important; }
                        .text-birthday { font-size: 110px !important; margin-top: -20px !important; }
                        .text-message { font-size: 32px !important; max-width: 800px !important; line-height: 1.8 !important; }
                        /* Anniversary Template */
                        .content { justify-content: center !important; padding-top: 0 !important; }
                        .headline { font-size: 100px !important; margin-bottom: 30px !important; }
                        .name { font-size: 55px !important; margin-top: 30px !important; }
                        .message { font-size: 26px !important; max-width: 800px !important; line-height: 1.8 !important; }
                        .footer { position: absolute !important; bottom: 30px !important; margin-top: 0 !important; }
                    `;
                } else if (!photoSrc.startsWith('data:image')) {
                    photoSrc = 'data:image/jpeg;base64,' + photoSrc;
                }
                
                html = html.replace('{{THEME}}', task.eventType)
                           .replace('{{PHOTO_BASE64}}', photoSrc)
                           .replace('{{EMPLOYEE_NAME}}', task.name)
                           .replace('{{EVENT_TYPE}}', task.eventType)
                           .replace('{{YEARS}}', task.years || '')
                           .replace('{{DYNAMIC_CSS}}', dynamicCss);
                           
                const browser = client.pupBrowser;
                const page = await browser.newPage();
                // Set viewport to match the poster size
                await page.setViewport({ width: 1080, height: 1080 });
                await page.setContent(html, { waitUntil: 'load' }); // Fast load since image is base64
                
                const element = await page.$('#poster');
                const screenshotBase64 = await element.screenshot({ encoding: 'base64' });
                await page.close();
                
                const media = new MessageMedia('image/png', screenshotBase64, 'celebration.png');
                const options = {};
                if (task.caption) options.caption = task.caption;
                
                await client.sendMessage(formattedNumber, media, options);
            } else if (task.type === 'document' || task.type === 'image') {
                // message is base64 string
                const media = new MessageMedia(task.mimetype, task.message, task.filename);
                const isDocument = task.type === 'document';
                
                const options = { sendMediaAsDocument: isDocument };
                if (task.caption) {
                    options.caption = task.caption;
                }
                
                await client.sendMessage(formattedNumber, media, options);
            }

            console.log(`Successfully sent message to ${formattedNumber}`);
            consecutiveMessagesSent++;

            // Removed delay for testing
            if (messageQueue.length > 0) {
                console.log(`Queue length: ${messageQueue.length}`);
            }

        } catch (error) {
            console.error(`Failed to send message to ${task.phone}:`, error);
        }
    }

    isQueueProcessing = false;
};

// --- API Endpoints ---

// Get Groups (Helper to find Group IDs)
app.get('/groups', async (req, res) => {
    if (!clientReady || !client) {
        return res.json({ count: 0, groups: [], error: 'WhatsApp client is not ready yet.' });
    }
    
    try {
        let groups = [];

        // Method 1: Instant direct evaluate from WhatsApp Web Store
        try {
            if (client.pupPage) {
                groups = await client.pupPage.evaluate(() => {
                    if (!window.Store || !window.Store.Chat) return [];
                    return window.Store.Chat.models
                        .filter(c => c && (c.isGroup || (c.id && c.id._serialized && c.id._serialized.endsWith('@g.us')) || (c.id && c.id.server === 'g.us')))
                        .map(c => {
                            const serializedId = c.id && c.id._serialized ? c.id._serialized : (typeof c.id === 'string' ? c.id : '');
                            const title = c.name || c.formattedTitle || c.title || (c.contact && c.contact.name) || 'Unnamed Group';
                            return { name: title, id: serializedId };
                        })
                        .filter(g => g.id && g.id.endsWith('@g.us'));
                });
            }
        } catch (e) {
            console.log('Direct store evaluation error (will try getChats fallback):', e.message);
        }

        // Method 2: Fallback to getChats if direct evaluate returned empty
        if (!groups || groups.length === 0) {
            const chats = await Promise.race([
                client.getChats(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('getChats timeout after 10s')), 10000))
            ]);

            groups = (chats || [])
                .filter(chat => chat && (chat.isGroup || (chat.id && chat.id._serialized && chat.id._serialized.endsWith('@g.us'))))
                .map(chat => ({
                    name: chat.name || chat.formattedTitle || 'Unnamed Group',
                    id: (chat.id && chat.id._serialized) ? chat.id._serialized : String(chat.id)
                }))
                .filter(g => g.id && g.id.endsWith('@g.us'));
        }

        res.json({ count: groups.length, groups: groups });
    } catch (error) {
        console.log('Failed or timed out fetching groups:', error.message);
        res.json({ count: 0, groups: [], error: error.message });
    }
});

// Get Status
app.get('/status', (req, res) => {
    res.json({ ready: clientReady, queueLength: messageQueue.length });
});

// Get QR Code
app.get('/qr', (req, res) => {
    if (clientReady) {
        return res.json({ status: 'connected' });
    }
    if (isAuthenticated) {
        return res.json({ status: 'authenticated' });
    }
    if (qrCodeData) {
        return res.json({ status: 'qr_ready', qr: qrCodeData });
    }
    return res.json({ status: 'initializing' });
});

// Reset Session / Unlink Device
app.post('/reset', (req, res) => {
    res.json({ success: true, message: 'Session reset initiated.' });
    resetSession();
});

// Send Message (adds to queue)
app.post('/send', (req, res) => {
    const { phone, message, type = 'text', filename, mimetype, caption, name, eventType, photoBase64, years } = req.body;
    
    // For celebrations, we might not have a message body immediately
    if (!phone || (!message && type !== 'celebration')) {
        return res.status(400).json({ error: 'phone and message are required' });
    }

    // Add to queue
    messageQueue.push({ phone, message, type, filename, mimetype, caption, name, eventType, photoBase64, years });
    
    // Start processing if not already running
    processQueue();

    res.json({ success: true, message: 'Message added to rate-limited queue', queuePosition: messageQueue.length });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`WhatsApp Microservice running on port ${PORT}`);
});
