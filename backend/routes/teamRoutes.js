const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const teamController = require('../controllers/teamController');

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

// Get players sold to a team
router.get('/:id/players', teamController.getTeamPlayers);

// Update team details including logo and captain
router.put('/:id', upload.single('logo'), teamController.updateTeam);

module.exports = router;
