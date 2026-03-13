const express = require('express');
const router = express.Router();
const { createTournament, getAllTournaments, getTournamentById, updateTournament, addTeam, addPlayer, registerPlayer, getLatestPublicTournament, getOpenTournaments, uploadPlayers, getDashboardRosters } = require('../controllers/tournamentController');
const { register } = require('../controllers/authController');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

router.post('/', createTournament);
router.get('/', getAllTournaments);
// Public registration route
router.post('/register-player', registerPlayer);
router.get('/latest-public', getLatestPublicTournament);
router.get('/open-tournaments', getOpenTournaments);
router.get('/dashboard/rosters', getDashboardRosters);

router.get('/:id', getTournamentById);
router.put('/:id', updateTournament);
router.post('/:id/teams', addTeam);
router.post('/:id/players', addPlayer);
router.post('/:id/upload-players', upload.single('file'), uploadPlayers);

// Maybe a route to "register a team for a tournament"?
// The current `auth` `register` creates a user and optionally links to a team.
// But we need to create the Team first. Let's add that capability to tournamentController too or separate TeamController.
// For now, let's assume we create Teams separately or via seed.

module.exports = router;
