const { Team, Player } = require('../models');

// Get players sold to a team
exports.getTeamPlayers = async (req, res) => {
    try {
        const { id } = req.params;
        const team = await Team.findByPk(id);
        if (!team) return res.status(404).json({ message: 'Team not found' });

        const players = await Player.findAll({
            where: { soldTo: id }
        });

        res.json(players);
    } catch (error) {
        console.error('Get Team Players Error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Update team details including logo and captain
exports.updateTeam = async (req, res) => {
    try {
        const { id } = req.params;
        const team = await Team.findByPk(id);
        if (!team) return res.status(404).json({ message: 'Team not found' });

        const updateData = { ...req.body };

        if (req.file) {
            // Store only the filename; the frontend will build the full URL using API_CONFIG
            updateData.logoUrl = req.file.filename;
        }

        await team.update(updateData);

        // Return enriched team info
        const updatedTeam = await Team.findByPk(id, {
            include: [{ model: Player, as: 'players' }]
        });

        res.json(updatedTeam);
    } catch (error) {
        console.error('Update Team Error:', error);
        res.status(500).json({ error: error.message });
    }
};
