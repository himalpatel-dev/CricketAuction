const { Player, Team, Bid, Tournament, sequelize } = require('../models');

const pickNextRandomPlayer = async (tournamentId, io) => {
    // Wait for 5 seconds to show SOLD/UNSOLD status before auto-starting next
    setTimeout(async () => {
        try {
            const tournament = await Tournament.findByPk(tournamentId);
            if (!tournament) return;

            const nextPlayer = await Player.findOne({
                where: { 
                    tournamentId, 
                    status: tournament.lastPoolMode || 'UPCOMING'
                },
                order: sequelize.random()
            });

            if (nextPlayer) {
                // BUG FIX: Check if an auction was already started manually 
                // while we were waiting
                if (tournament.currentPlayerId) {
                    console.log('Auction already in progress, skipping auto-pick.');
                    return;
                }

                // Update tournament to point to the current player without changing their status yet
                tournament.currentPlayerId = nextPlayer.id;
                await tournament.save();

                io.to(`tournament_${tournamentId}`).emit('auction_started', {
                    player: nextPlayer
                });
            }
        } catch (error) {
            console.error('Error auto-picking next player:', error);
        }
    }, 5000);
};

// Fetch current auction status for a tournament
exports.getAuctionState = async (req, res) => {
    const { tournamentId } = req.params;
    try {
        const tournament = await Tournament.findByPk(tournamentId);
        let currentPlayer = null;

        if (tournament && tournament.currentPlayerId) {
            currentPlayer = await Player.findByPk(tournament.currentPlayerId);
        }

        // Fallback or override: check if anyone is explicitly IN_AUCTION
        if (!currentPlayer) {
            currentPlayer = await Player.findOne({
                where: { status: 'IN_AUCTION', tournamentId },
            });
        }

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
    const { playerId, tournamentId, status } = req.body;
    try {
        const tournament = await Tournament.findByPk(tournamentId);
        if (!tournament) return res.status(404).json({ message: 'Tournament not found' });

        let player;
        if (playerId) {
            player = await Player.findByPk(playerId);
        } else {
            player = await Player.findOne({
                where: { tournamentId, status: status || 'UPCOMING' },
                order: sequelize.random()
            });
        }

        if (!player) return res.status(404).json({ message: 'No more upcoming players found' });

        // Ensure no other player is stuck 'IN_AUCTION' - move them back to UPCOMING
        await Player.update(
            { status: 'UPCOMING' },
            { where: { status: 'IN_AUCTION', tournamentId } }
        );

        // Track only current player ID, don't change status to IN_AUCTION yet
        tournament.currentPlayerId = player.id;
        // Correctly update lastPoolMode so auto-pick follows the same pool
        tournament.lastPoolMode = status || 'UPCOMING';
        await tournament.save();

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

        // Calculate MaxAllowedBid
        const tournament = await Tournament.findByPk(tournamentId);
        if (!tournament) return res.status(404).json({ message: 'Tournament not found' });

        const remainingSlots = tournament.playersPerTeam - (team.playersBought || 0);
        
        // Ensure team can afford remaining slots at base price
        const reserveAmount = (remainingSlots - 1) * tournament.minimumPlayerBasePrice;
        const maxAllowedBid = team.remainingBudget - reserveAmount;

        if (amount > maxAllowedBid) {
            return res.status(100).json({ 
                message: `Bid exceeds maximum allowed bid for this team. Max Allowed: ${maxAllowedBid}`,
                maxAllowedBid 
            });
        }

        const newBid = await Bid.create({
            playerId,
            teamId,
            amount
        });

        // Mark player as IN_AUCTION only when first bid is processed
        if (player.status !== 'IN_AUCTION') {
            player.status = 'IN_AUCTION';
            await player.save();
        }

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

        // Clear current player tracking
        const tournament = await Tournament.findByPk(tournamentId);
        if (tournament) {
            tournament.currentPlayerId = null;
            await tournament.save();
        }

        const team = finalBid.team;
        team.spentAmount += finalBid.amount;
        team.remainingBudget -= finalBid.amount;
        team.playersBought += 1;
        await team.save();

        req.io.to(`tournament_${tournamentId}`).emit('player_sold', {
            player,
            team,
            amount: finalBid.amount
        });

        res.json({ player, team });

        // Auto Pick Next Random Player
        pickNextRandomPlayer(tournamentId, req.io);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.markUnsold = async (req, res) => {
    const { tournamentId, playerId } = req.body;
    try {
        const player = await Player.findByPk(playerId);
        if (!player) return res.status(404).json({ message: 'Player not found' });

        if (player.status === 'SOLD' && player.soldTo) {
            const team = await Team.findByPk(player.soldTo);
            if (team) {
                team.spentAmount -= player.soldPrice;
                team.remainingBudget += player.soldPrice;
                team.playersBought -= 1;
                await team.save();
            }
        }

        player.status = 'UNSOLD';
        player.soldPrice = 0;
        player.soldTo = null;
        await player.save();

        // Clear current player tracking
        const tournament = await Tournament.findByPk(tournamentId);
        if (tournament) {
            tournament.currentPlayerId = null;
            await tournament.save();
        }

        req.io.to(`tournament_${tournamentId}`).emit('player_unsold', {
            player
        });

        res.json(player);

        // Auto Pick Next Random Player
        pickNextRandomPlayer(tournamentId, req.io);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getTeamRecentActivity = async (req, res) => {
    const { teamId } = req.params;
    try {
        // 1. Find all players this team has bid on
        const players = await Player.findAll({
            include: [
                {
                    model: Bid,
                    as: 'bids',
                    required: true,
                    where: { teamId: teamId }
                },
                {
                    model: Team,
                    as: 'owner_team'
                }
            ]
        });

        // 2. Map and enrich with lost/won status and competing teams
        const activity = await Promise.all(players.map(async (player) => {
            const allBids = await Bid.findAll({
                where: { playerId: player.id },
                include: [{ model: Team, as: 'team' }],
                order: [['amount', 'DESC']]
            });

            const teamBids = allBids.filter(b => b.teamId == teamId);
            const highestTeamBid = teamBids[0];
            const isWon = player.soldTo == teamId && player.status === 'SOLD';

            const competingTeams = [...new Set(allBids
                .filter(b => b.teamId != teamId)
                .map(b => b.team?.code || b.team?.name))]
                .filter(Boolean);

            return {
                id: player.id,
                name: player.name,
                role: player.role,
                status: isWon ? 'WON' : (player.status === 'SOLD' ? 'LOST' : player.status),
                bidAmount: highestTeamBid ? highestTeamBid.amount : 0,
                finalPrice: player.soldPrice,
                wonBy: isWon ? 'Won' : (player.owner_team?.code || player.owner_team?.name || 'N/A'),
                competingTeams: competingTeams,
                timestamp: highestTeamBid ? highestTeamBid.timestamp : player.updatedAt
            };
        }));

        // Sort by most recent activity
        activity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        console.log(`Activity for team ${teamId}:`, JSON.stringify(activity, null, 2));

        res.json(activity);
    } catch (error) {
        console.error("Error in getTeamRecentActivity:", error);
        res.status(500).json({ error: error.message });
    }
};
