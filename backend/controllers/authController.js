const bcrypt = require('bcryptjs');
const { User, Team } = require('../models');
const { generateToken } = require('../utils/jwt');

exports.register = async (req, res) => {
    try {
        const { username, password, role, teamId, tournamentId } = req.body;

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

        // If tournament admin, verify tournament exists (optional deeper check could go here)

        const newUser = await User.create({
            username,
            password: hashedPassword,
            role,
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
