const express = require('express');
const router = express.Router();
const { createTournament, getAllTournaments, getTournamentById, updateTournament, addTeam, addPlayer, updatePlayer, deletePlayer, registerPlayer, getLatestPublicTournament, getOpenTournaments, uploadPlayers, getDashboardRosters, checkExistingPlayer, getGlobalPlayers, getTournamentBranding, updateTournamentBranding, getTournamentLogins, resetTournamentLoginPassword } = require('../controllers/tournamentController');
const { register } = require('../controllers/authController');
const { authenticate, requireRole } = require('../middleware/auth');
const mainAdminOnly = [authenticate, requireRole('ADMIN')];
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

router.get('/global/players', getGlobalPlayers);

router.post('/', createTournament);
router.get('/', getAllTournaments);
// Public registration route
router.post('/register-player', registerPlayer);
router.get('/check-player/:mobileNo', checkExistingPlayer);
router.get('/latest-public', getLatestPublicTournament);
router.get('/open-tournaments', getOpenTournaments);
router.get('/dashboard/rosters', getDashboardRosters);

// Public: logo / banner / colors for the tournament's branded login page and live view
router.get('/:id/branding', getTournamentBranding);
router.put('/:id/branding', updateTournamentBranding);

// Main admin only: who can log in to this tournament, and resetting their passwords
router.get('/:id/logins', ...mainAdminOnly, getTournamentLogins);
router.post('/:id/logins/:userId/reset-password', ...mainAdminOnly, resetTournamentLoginPassword);

router.get('/:id', getTournamentById);
router.put('/:id', updateTournament);
router.post('/:id/teams', addTeam);
router.post('/:id/players', addPlayer);
router.put('/:id/players/:playerId', updatePlayer);
router.delete('/:id/players/:playerId', deletePlayer);
router.post('/:id/upload-players', upload.single('file'), uploadPlayers);

// Maybe a route to "register a team for a tournament"?
// The current `auth` `register` creates a user and optionally links to a team.
// But we need to create the Team first. Let's add that capability to tournamentController too or separate TeamController.
// For now, let's assume we create Teams separately or via seed.

module.exports = router;
