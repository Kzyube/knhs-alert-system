const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const session = require('express-session');
const path = require('path');

const app = express();
const server = http.createServer(app);

// --- ALLOW MOBILE APP & LAPTOP CONNECTION (CORS) ---
const io = socketIo(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

// --- 1. SETUP ---
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: 'knhs_secret_key_2026',
    resave: true,
    saveUninitialized: true
}));

app.use(express.static(path.join(__dirname, 'public')));

// --- 2. STORAGE ---
let alertHistory = []; 

// --- 3. ROUTES ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.post('/auth', (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === 'knhs2026') {
        req.session.loggedin = true;
        res.redirect('/admin');
    } else {
        res.redirect('/login?error=true');
    }
});

app.get('/admin', (req, res) => {
    if (req.session.loggedin) {
        res.sendFile(path.join(__dirname, 'admin.html'));
    } else {
        res.redirect('/login');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// --- 4. SOCKET LOGIC ---
io.on('connection', (socket) => {
    console.log('A user connected: ' + socket.id);

    // Send history to Admin
    socket.emit('log-history', alertHistory);

    // Admin sends Alert
    socket.on('broadcast-alert', (data) => {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = { type: data.type, time: timestamp, message: data.message };

        alertHistory.unshift(logEntry);
        if(alertHistory.length > 50) alertHistory.pop();

        io.emit('receive-alert', data);
        io.emit('update-logs', logEntry);
    });

    // Student Updates
    socket.on('register-student', (studentId) => {
        console.log(`Student ${studentId} registered`);
        socket.join('students');
    });

    socket.on('student-status', (data) => {
        io.emit('admin-dashboard-update', data); 
    });

    socket.on('student-note', (data) => {
        io.emit('admin-note-receive', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// --- 5. START SERVER ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`✅ SERVER RUNNING on port ${PORT}`);
});s