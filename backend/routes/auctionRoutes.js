const express = require('express');
const router = express.Router();
const { getAuctionState, startPlayerAuction, sellPlayer, placeBid, markUnsold } = require('../controllers/auctionController');

router.get('/state/:tournamentId', getAuctionState);
router.post('/start', startPlayerAuction);
router.post('/bid', placeBid);
router.post('/sell', sellPlayer);
router.post('/unsold', markUnsold);

module.exports = router;
