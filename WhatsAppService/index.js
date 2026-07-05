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

// Prevent Puppeteer "Execution context was destroyed" errors from crashing the app
process.on('unhandledRejection', (reason, promise) => {
    console.log('Unhandled Rejection (ignored to prevent crash):', reason);
});
process.on('uncaughtException', (err) => {
    console.log('Uncaught Exception (ignored to prevent crash):', err);
});

// Initialize WhatsApp Client with LocalAuth to persist session
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }
});

client.on('qr', (qr) => {
    // Generate and scan this code with your phone
    console.log('QR RECEIVED', qr);
    qrcode.generate(qr, { small: true });
    qrCodeData = qr;
});

client.on('ready', () => {
    console.log('Client is ready!');
    clientReady = true;
    qrCodeData = null; // Clear QR code as it's no longer needed
});

client.on('disconnected', (reason) => {
    console.log('Client was logged out', reason);
    clientReady = false;
});

client.initialize();

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
                if (!photoSrc.startsWith('data:image')) {
                    photoSrc = 'data:image/jpeg;base64,' + photoSrc;
                }
                
                html = html.replace('{{THEME}}', task.eventType)
                           .replace('{{PHOTO_BASE64}}', photoSrc)
                           .replace('{{EMPLOYEE_NAME}}', task.name)
                           .replace('{{EVENT_TYPE}}', task.eventType)
                           .replace('{{YEARS}}', task.years || '');
                           
                const browser = client.pupBrowser;
                const page = await browser.newPage();
                // Set viewport to match the poster size
                await page.setViewport({ width: 1080, height: 1080 });
                await page.setContent(html, { waitUntil: 'networkidle0' }); // Wait for fonts
                
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
    if (!clientReady) {
        return res.status(503).json({ error: 'WhatsApp client is not ready yet.' });
    }
    
    try {
        const chats = await client.getChats();
        const groups = chats
            .filter(chat => chat.isGroup)
            .map(chat => ({
                name: chat.name,
                id: chat.id._serialized
            }));
            
        res.json({ count: groups.length, groups: groups });
    } catch (error) {
        console.error('Failed to get groups:', error);
        res.status(500).json({ error: 'Failed to fetch groups' });
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
    if (qrCodeData) {
        return res.json({ status: 'qr_ready', qr: qrCodeData });
    }
    return res.json({ status: 'initializing' });
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
