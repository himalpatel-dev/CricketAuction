const { Tournament, Team, Player } = require('../models');

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
        await tournament.update(req.body);
        res.json(tournament);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.addTeam = async (req, res) => {
    try {
        const { id } = req.params;
        const teamData = { ...req.body, tournamentId: id };
        
        // Ensure remainingBudget is initialized with the total budget
        if (req.body.budget) {
            teamData.remainingBudget = req.body.budget;
        } else {
            teamData.remainingBudget = 10000000; // Match model default
        }

        const team = await Team.create(teamData);
        res.status(201).json(team);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.addPlayer = async (req, res) => {
    try {
        const { id } = req.params;
        const player = await Player.create({ ...req.body, tournamentId: id });
        res.status(201).json(player);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const { Op } = require('sequelize');

exports.registerPlayer = async (req, res) => {
    try {
        let tournamentId = req.body.tournamentId;
        let basePrice = 200000; // Default fallback

        if (tournamentId) {
            const tournament = await Tournament.findByPk(tournamentId);
            if (tournament) {
                basePrice = tournament.baseAuctionPrice;
            } else {
                return res.status(404).json({ message: "Selected tournament not found" });
            }
        } else {
            // Fallback to latest if no ID provided (legacy support)
            const latestTournament = await Tournament.findOne({
                order: [['createdAt', 'DESC']]
            });
            if (latestTournament) {
                tournamentId = latestTournament.id;
                basePrice = latestTournament.baseAuctionPrice;
            }
        }

        const player = await Player.create({
            ...req.body,
            tournamentId: tournamentId,
            basePrice: basePrice, // Ensure correct base price from tournament
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
            // Map excel columns to DB fields loosely matching names
            return {
                name: row['Name'] || row['name'] || row['Full Name'],
                role: row['Role'] || row['role'] || 'Batsman', // Default if missing
                mobileNo: row['Mobile'] || row['mobile'] || row['Mobile No'] || null,
                basePrice: tournament.baseAuctionPrice, // Enforce tournament base price
                tournamentId: id,
                status: 'UPCOMING',
                gender: row['Gender'] || row['gender'] || 'Male',
                dob: parseDate(row['DOB'] || row['dob']),
                tShirtSize: row['T-Shirt'] || row['tshirt'] || null,
                trouserSize: row['Trouser'] || row['trouser'] || null
            };
        }).filter(p => p.name); // Basic validation: must have name

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
                    attributes: ['id', 'name']
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
                totalSlots: 11, // Standard cricket
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
