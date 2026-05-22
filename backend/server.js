const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const dotenv = require('dotenv');
const { sequelize } = require('./models');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: '*', // Allow all for dev
        methods: ['GET', 'POST']
    }
});

// Pass io to auctionController for async/timer actions
const auctionController = require('./controllers/auctionController');
auctionController.setIo(io);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static('uploads'));

// Pass io to request
app.use((req, res, next) => {
    req.io = io;
    next();
});

// Routes
const authRoutes = require('./routes/authRoutes');
const auctionRoutes = require('./routes/auctionRoutes');
const tournamentRoutes = require('./routes/tournamentRoutes');
const teamRoutes = require('./routes/teamRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/auction', auctionRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/teams', teamRoutes);

// Socket Logic
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Join tournament room
    socket.on('join_tournament', (data) => {
        let tournamentId;
        let isAdmin = false;
        if (data && typeof data === 'object') {
            tournamentId = data.tournamentId;
            isAdmin = !!data.isAdmin;
        } else {
            tournamentId = data;
        }

        socket.tournamentId = tournamentId;
        socket.isAdmin = isAdmin;
        socket.join(`tournament_${tournamentId}`);
        console.log(`Socket ${socket.id} (Admin: ${isAdmin}) joined tournament_${tournamentId}`);

        if (isAdmin) {
            auctionController.resumeTimer(tournamentId);
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        if (socket.tournamentId && socket.isAdmin) {
            const roomName = `tournament_${socket.tournamentId}`;
            const roomSockets = io.sockets.adapter.rooms.get(roomName);
            let adminCount = 0;
            if (roomSockets) {
                for (const socketId of roomSockets) {
                    if (socketId === socket.id) continue;
                    const s = io.sockets.sockets.get(socketId);
                    if (s && s.isAdmin) {
                        adminCount++;
                    }
                }
            }
            if (adminCount === 0) {
                console.log(`No active admins left in room ${roomName}. Pausing timer.`);
                auctionController.pauseTimer(socket.tournamentId);
            }
        }
    });
});

// Pass io to request
app.use((req, res, next) => {
    req.io = io;
    next();
});

// Trigger Restart
const PORT = process.env.PORT || 5001;

// Sync Database & Start Server
sequelize.sync({ alter: true }) // use { force: true } to clear DB on restart
    .then(() => {
        console.log('Database synced');
        server.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    })
    .catch((err) => {
        console.error('Failed to sync database:', err);
    });
