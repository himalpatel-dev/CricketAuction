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
    socket.on('join_tournament', (tournamentId) => {
        socket.join(`tournament_${tournamentId}`);
        console.log(`Socket ${socket.id} joined tournament_${tournamentId}`);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
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
