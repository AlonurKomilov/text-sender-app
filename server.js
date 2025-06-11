// server.js - The backend for your text sender platform

// Import necessary packages
const express = require('express');
const twilio = require('twilio');
const path = require('path');

// --- CONFIGURATION ---
const accountSid = 'Write Twillio accountSid';
const authToken = 'Write Twillio authToken';
const twilioPhoneNumber = 'Write Twillio PhoneNumber';

const PORT = 3000;

// --- INITIALIZATION ---
const app = express();
const client = new twilio(accountSid, authToken);

// --- MIDDLEWARE ---
app.use(express.static(path.join(__dirname, 'public')));
// Increase the limit to handle larger contact lists
app.use(express.json({ limit: '10mb' }));


// --- HELPER FUNCTION FOR PERSONALIZATION ---
/**
 * Replaces placeholders like {name} in a message with data from a contact object.
 * @param {string} message - The message template.
 * @param {object} contact - The contact object with data (e.g., {name: 'John', company: 'TechCo'}).
 * @returns {string} The personalized message.
 */
const personalizeMessage = (message, contact) => {
    let personalizedMessage = message;
    for (const key in contact) {
        // The regex replaces all occurrences of {key}, case-insensitively
        const regex = new RegExp(`\\{${key}\\}`, 'gi');
        personalizedMessage = personalizedMessage.replace(regex, contact[key]);
    }
    return personalizedMessage;
};


// --- API ROUTES ---

// Endpoint for sending a SINGLE message
app.post('/send-message', (req, res) => {
    const { recipient, message } = req.body;

    if (!recipient || !message) {
        return res.status(400).json({ 
            success: false, 
            message: 'Recipient phone number and message are required.' 
        });
    }

    client.messages
        .create({
            body: message,
            from: twilioPhoneNumber,
            to: recipient,
        })
        .then(twilioMessage => {
            console.log('Single message sent! SID:', twilioMessage.sid);
            res.json({ 
                success: true, 
                message: 'Message sent successfully!' 
            });
        })
        .catch(error => {
            console.error('Twilio Error:', error.message);
            res.status(500).json({ 
                success: false, 
                message: `Failed to send message. ${error.message}`
            });
        });
});

// Advanced endpoint for sending and scheduling personalized bulk messages
app.post('/send-advanced-bulk', (req, res) => {
    const { contacts, message, scheduleTime } = req.body;

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0 || !message) {
        return res.status(400).json({
            success: false,
            message: 'A list of contacts and a message are required.'
        });
    }

    const sendMessages = () => {
        console.log(`Starting bulk send to ${contacts.length} contacts.`);
        const promises = contacts.map(contact => {
            const personalizedMsg = personalizeMessage(message, contact);
            return client.messages.create({
                body: personalizedMsg,
                from: twilioPhoneNumber,
                to: contact.phonenumber // Assumes contact object has a 'phonenumber' property
            });
        });

        Promise.allSettled(promises)
            .then(results => {
                const successCount = results.filter(r => r.status === 'fulfilled').length;
                const failureCount = results.length - successCount;
                console.log(`Bulk send complete. Success: ${successCount}, Failed: ${failureCount}`);
            });
    };

    if (scheduleTime) {
        const scheduleDate = new Date(scheduleTime);
        const now = new Date();
        const delay = scheduleDate.getTime() - now.getTime();

        if (delay > 0) {
            console.log(`Message scheduled for ${scheduleDate}. Will be sent in ${delay / 1000} seconds.`);
            setTimeout(sendMessages, delay);
            return res.json({
                success: true,
                message: `Message campaign successfully scheduled for ${scheduleDate.toLocaleString()}`
            });
        }
    }
    
    sendMessages();
    res.json({
        success: true,
        message: 'Bulk message campaign is being sent now!'
    });
});


// --- START THE SERVER ---
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log('Open this URL in your browser to see your dashboard.');
});
