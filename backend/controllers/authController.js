const bcrypt = require('bcryptjs');
const { User, Team } = require('../models');
const { generateToken } = require('../utils/jwt');

exports.register = async (req, res) => {
    try {
        const { username, password, role, email, mustChangePassword, teamId, tournamentId } = req.body;

        // Check if user exists
        const existingUser = await User.findOne({ where: { username } });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // If team user, verify team exists
        if (role === 'TEAM' && teamId) {
            const team = await Team.findByPk(teamId);
            if (!team) return res.status(400).json({ message: 'Invalid Team ID' });
        }

        const newUser = await User.create({
            username,
            password: hashedPassword,
            role,
            email: email || null,
            mustChangePassword: mustChangePassword !== undefined ? mustChangePassword : true,
            teamId: role === 'TEAM' ? teamId : null,
            tournamentId: role === 'TOURNAMENT_ADMIN' ? tournamentId : null
        });

        res.status(201).json({ message: 'User registered successfully', userId: newUser.id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await User.findOne({ where: { username } });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // If mustChangePassword is true, return flag immediately so frontend knows to force update
        if (user.mustChangePassword) {
            const token = generateToken(user);
            return res.json({
                mustChangePassword: true,
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                    teamId: user.teamId,
                    tournamentId: user.tournamentId
                }
            });
        }

        const token = generateToken(user);

        // Fetch extra details if needed
        const userWithDetails = await User.findByPk(user.id, {
            include: [{ model: Team, as: 'team' }]
        });

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                teamId: user.teamId,
                team: userWithDetails.team,
                tournamentId: user.tournamentId // Send this back
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.changePassword = async (req, res) => {
    try {
        const { newPassword } = req.body;
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ message: 'New password must be at least 6 characters long' });
        }

        const user = await User.findByPk(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        user.mustChangePassword = false;
        await user.save();

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
