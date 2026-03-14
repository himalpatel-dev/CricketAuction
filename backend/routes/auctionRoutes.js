const express = require('express');
const router = express.Router();
const { getAuctionState, startPlayerAuction, sellPlayer, placeBid, markUnsold, getTeamRecentActivity } = require('../controllers/auctionController');

router.get('/state/:tournamentId', getAuctionState);
router.post('/start', startPlayerAuction);
router.post('/bid', placeBid);
router.post('/sell', sellPlayer);
router.post('/unsold', markUnsold);
router.get('/team-activity/:teamId', getTeamRecentActivity);

module.exports = router;
