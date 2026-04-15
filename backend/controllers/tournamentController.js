const { Tournament, Team, Player, sequelize } = require('../models');

exports.createTournament = async (req, res) => {
    try {
        const tournament = await Tournament.create(req.body);
        res.status(201).json(tournament);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getAllTournaments = async (req, res) => {
    try {
        const tournaments = await Tournament.findAll({
            include: [
                {
                    model: Team,
                    as: 'teams',
                    include: [{ model: Player, as: 'players' }]
                },
                { model: Player, as: 'players' }
            ]
        });
        res.json(tournaments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getTournamentById = async (req, res) => {
    try {
        const tournament = await Tournament.findByPk(req.params.id, {
            include: [
                {
                    model: Team,
                    as: 'teams',
                    include: [{ model: Player, as: 'players' }]
                },
                { model: Player, as: 'players' }
            ]
        });
        if (!tournament) return res.status(404).json({ message: 'Tournament not found' });
        res.json(tournament);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateTournament = async (req, res) => {
    try {
        const tournament = await Tournament.findByPk(req.params.id);
        if (!tournament) return res.status(404).json({ message: 'Tournament not found' });

        const { playersPerTeam, minimumPlayerBasePrice, competitionFactor } = req.body;

        await sequelize.transaction(async (t) => {
            await tournament.update(req.body, { transaction: t });

            // Reload inside transaction to ensure we have the absolute latest data from DB
            await tournament.reload({ transaction: t });

            // Check if any of the three key fields were provided in the request
            const hasBudgetChanges =
                playersPerTeam !== undefined ||
                minimumPlayerBasePrice !== undefined ||
                competitionFactor !== undefined;

            if (hasBudgetChanges) {
                console.log(`[RECALC] Change detected. Params: P:${playersPerTeam}, M:${minimumPlayerBasePrice}, C:${competitionFactor}`);
                const pPT = parseInt(tournament.playersPerTeam) || 0;
                const mPBP = parseFloat(tournament.minimumPlayerBasePrice) || 0;
                const cF = parseFloat(tournament.competitionFactor) || 0;

                const newBudget = Math.round(pPT * mPBP * cF);

                console.log(`[RECALC] Recalculating with: ${pPT} * ${mPBP} * ${cF} = ${newBudget}`);

                if (newBudget > 0) {
                    const teams = await Team.findAll({ where: { tournamentId: tournament.id }, transaction: t });

                    // Also update tournament totalAmount for display consistency
                    tournament.totalAmount = newBudget * teams.length;
                    await tournament.save({ transaction: t });

                    for (const team of teams) {
                        team.budget = newBudget;
                        team.remainingBudget = newBudget - (team.spentAmount || 0);
                        await team.save({ transaction: t });
                    }

                    // If base price changed, update all upcoming players in this tournament
                    if (minimumPlayerBasePrice !== undefined) {
                        await Player.update(
                            { basePrice: mPBP },
                            {
                                where: {
                                    tournamentId: tournament.id,
                                    status: 'UPCOMING' // Only update those not yet sold
                                },
                                transaction: t
                            }
                        );
                        console.log(`[RECALC] Updated basePrice for all upcoming players to ${mPBP}`);
                    }

                    console.log(`[RECALC] Successfully updated ${teams.length} teams.`);
                } else {
                    console.warn(`[RECALC] Budget calculated as 0 or NaN, skipping team updates.`);
                }
            }
        });

        // Final reload after transaction commit for the response
        await tournament.reload();

        res.json(tournament);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.addTeam = async (req, res) => {
    try {
        const { id } = req.params;
        const tournament = await Tournament.findByPk(id);
        if (!tournament) return res.status(404).json({ message: 'Tournament not found' });

        const calculatedBudget = tournament.playersPerTeam * tournament.minimumPlayerBasePrice * tournament.competitionFactor;

        const teamData = {
            ...req.body,
            tournamentId: id,
            budget: calculatedBudget,
            remainingBudget: calculatedBudget,
            spentAmount: 0,
            playersBought: 0
        };

        const team = await Team.create(teamData);
        res.status(201).json(team);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.addPlayer = async (req, res) => {
    try {
        const { id } = req.params;
        const player = await Player.create({
            ...req.body,
            tournamentId: id,
            status: 'UPCOMING'
        });
        res.status(201).json(player);
    } catch (error) {
        console.error('addPlayer Error:', error);
        res.status(500).json({ error: error.message });
    }
};

const { Op } = require('sequelize');

exports.registerPlayer = async (req, res) => {
    try {
        const tournamentId = req.body.tournamentId;
        if (!tournamentId) return res.status(400).json({ message: "Tournament ID required" });

        const player = await Player.create({
            ...req.body,
            tournamentId: tournamentId,
            status: 'UPCOMING'
        });

        res.status(201).json(player);
    } catch (error) {
        console.error("Register Player Error:", error);
        res.status(500).json({ message: "Registration failed", error: error.message });
    }
};

exports.getLatestPublicTournament = async (req, res) => {
    try {
        const tournament = await Tournament.findOne({
            order: [['createdAt', 'DESC']],
            attributes: ['id', 'name', 'baseAuctionPrice', 'status', 'tournamentStartDate'] // Public fields only
        });

        if (!tournament) {
            return res.status(404).json({ message: "No active tournament found" });
        }
        res.json(tournament);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getOpenTournaments = async (req, res) => {
    try {
        const tournaments = await Tournament.findAll({
            where: {
                status: {
                    [Op.or]: ['ACTIVE', 'UPCOMING']
                }
            },
            order: [['createdAt', 'DESC']],
            attributes: ['id', 'name', 'baseAuctionPrice', 'status', 'tournamentStartDate']
        });
        res.json(tournaments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const xlsx = require('xlsx');

exports.uploadPlayers = async (req, res) => {
    try {
        const { id } = req.params;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        // Fetch tournament for base price
        const tournament = await Tournament.findByPk(id);
        if (!tournament) {
            return res.status(404).json({ message: 'Tournament not found' });
        }

        let workbook;
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
            const csvData = file.buffer.toString('utf8');
            workbook = xlsx.read(csvData, { type: 'string' });
        } else {
            workbook = xlsx.read(file.buffer, { type: 'buffer' });
        }

        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet);

        const parseDate = (dateValue) => {
            if (!dateValue) return null;

            // Handle Excel serial date (number of days since 1900-01-01)
            if (typeof dateValue === 'number') {
                return new Date((dateValue - (25567 + 2)) * 86400 * 1000); // 25567 days from 1900 to 1970, +2 adjustment
            }

            // Handle string formats
            const date = new Date(dateValue);
            return isNaN(date.getTime()) ? null : date;
        };

        const players = data.map(row => {
            return {
                name: row['Name'] || row['name'] || row['Full Name'],
                role: row['Role'] || row['role'] || 'Batsman',
                mobileNo: row['Mobile'] || row['mobile'] || row['Mobile No'] || null,
                tournamentId: id,
                status: 'UPCOMING',
                gender: row['Gender'] || row['gender'] || 'Male',
                dob: parseDate(row['DOB'] || row['dob']),
                tShirtSize: row['T-Shirt'] || row['tshirt'] || null,
                trouserSize: row['Trouser'] || row['trouser'] || null
            };
        }).filter(p => p.name);

        if (players.length === 0) {
            return res.status(400).json({ message: 'No valid players found in file' });
        }

        await Player.bulkCreate(players);

        res.status(201).json({ message: `Successfully added ${players.length} players` });
    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.getDashboardRosters = async (req, res) => {
    try {
        const teams = await Team.findAll({
            include: [
                {
                    model: Player,
                    as: 'players',
                    where: { status: 'SOLD' },
                    required: false
                },
                {
                    model: Tournament,
                    as: 'tournament',
                    attributes: ['id', 'name', 'playersPerTeam']
                }
            ]
        });

        const rosters = teams.map(team => {
            const players = team.players || [];
            const roleCount = {
                BAT: 0,
                BWL: 0,
                AR: 0,
                WK: 0
            };

            players.forEach(p => {
                if (p.role === 'Batsman') roleCount.BAT++;
                else if (p.role === 'Bowler') roleCount.BWL++;
                else if (p.role === 'All-Rounder') roleCount.AR++;
                else if (p.role === 'Wicketkeeper') roleCount.WK++;
            });

            return {
                id: team.id,
                name: team.name,
                code: team.code,
                slotsFilled: players.length,
                totalSlots: team.tournament ? team.tournament.playersPerTeam : 15,
                roles: roleCount,
                tournamentName: team.tournament ? team.tournament.name : 'Unknown'
            };
        }).sort((a, b) => b.slotsFilled - a.slotsFilled);

        res.json(rosters);
    } catch (error) {
        console.error('getDashboardRosters Error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.updatePlayer = async (req, res) => {
    try {
        const { playerId } = req.params;
        const player = await Player.findByPk(playerId);
        if (!player) return res.status(404).json({ message: 'Player not found' });

        await player.update(req.body);
        res.json(player);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
