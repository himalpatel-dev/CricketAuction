const { Player, Team, Bid, Tournament } = require('../models');

// Fetch current auction status for a tournament
exports.getAuctionState = async (req, res) => {
    const { tournamentId } = req.params;
    try {
        const currentPlayer = await Player.findOne({
            where: { status: 'IN_AUCTION', tournamentId },
        });

        let bids = [];
        let highestBidderTeam = null;

        if (currentPlayer) {
            bids = await Bid.findAll({
                where: { playerId: currentPlayer.id },
                order: [['amount', 'DESC']],
                limit: 10,
                include: [{ model: Team, as: 'team' }]
            });

            if (bids.length > 0) {
                highestBidderTeam = bids[0].team;
            }
        }

        res.json({
            player: currentPlayer,
            bids: bids,
            currentBid: bids.length > 0 ? bids[0].amount : (currentPlayer ? currentPlayer.basePrice : 0),
            highestBidderTeam: highestBidderTeam
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Admin: Start auction for a player
exports.startPlayerAuction = async (req, res) => {
    const { playerId, tournamentId } = req.body;
    try {
        await Player.update(
            { status: 'UNSOLD' },
            { where: { status: 'IN_AUCTION', tournamentId } }
        );

        const player = await Player.findByPk(playerId);
        if (!player) return res.status(404).json({ message: 'Player not found' });

        player.status = 'IN_AUCTION';
        await player.save();

        // Broadcast to tournament namespace
        req.io.to(`tournament_${tournamentId}`).emit('auction_started', {
            player: player
        });

        res.json(player);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Admin: Place a bid
exports.placeBid = async (req, res) => {
    const { tournamentId, playerId, amount, teamId } = req.body;
    try {
        const player = await Player.findByPk(playerId);
        if (!player) return res.status(404).json({ message: 'Player not found' });

        const team = await Team.findByPk(teamId);
        if (!team) return res.status(404).json({ message: 'Team not found' });

        const newBid = await Bid.create({
            playerId,
            teamId,
            amount
        });

        const bidWithTeam = await Bid.findByPk(newBid.id, {
            include: [{ model: Team, as: 'team' }]
        });

        req.io.to(`tournament_${tournamentId}`).emit('new_bid', {
            amount: amount,
            bid: bidWithTeam,
            team: team
        });

        res.json(bidWithTeam);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Admin: Mark player as SOLD
exports.sellPlayer = async (req, res) => {
    const { tournamentId, playerId } = req.body;
    try {
        const player = await Player.findByPk(playerId);

        // Final bid
        const finalBid = await Bid.findOne({
            where: { playerId },
            order: [['amount', 'DESC']],
            include: [{ model: Team, as: 'team' }]
        });

        if (!finalBid) return res.status(400).json({ message: 'No bids for this player' });

        player.status = 'SOLD';
        player.soldPrice = finalBid.amount;
        player.soldTo = finalBid.teamId;
        await player.save();

        const team = finalBid.team;
        team.remainingBudget -= finalBid.amount;
        await team.save();

        req.io.to(`tournament_${tournamentId}`).emit('player_sold', {
            player,
            team,
            amount: finalBid.amount
        });

        res.json({ player, team });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.markUnsold = async (req, res) => {
    const { tournamentId, playerId } = req.body;
    try {
        const player = await Player.findByPk(playerId);
        if (!player) return res.status(404).json({ message: 'Player not found' });

        player.status = 'UNSOLD';
        await player.save();

        req.io.to(`tournament_${tournamentId}`).emit('player_unsold', {
            player
        });

        res.json(player);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
