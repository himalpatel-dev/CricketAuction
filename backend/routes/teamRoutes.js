const express = require('express');
const router = express.Router();
const { Team, Player } = require('../models');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for logo uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads/logos/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `team_${req.params.id}_${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ storage });

// Update team details including logo and captain
router.put('/:id', upload.single('logo'), async (req, res) => {
    try {
        const { id } = req.params;
        const team = await Team.findByPk(id);
        if (!team) return res.status(404).json({ message: 'Team not found' });

        const updateData = { ...req.body };

        if (req.file) {
            updateData.logoUrl = `http://127.0.0.1:5001/uploads/logos/${req.file.filename}`;
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
});

module.exports = router;
