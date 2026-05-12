const { Tournament, Team, Player, User, sequelize } = require('../models');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { saveBase64Image } = require('../utils/imageUpload');

exports.createTournament = async (req, res) => {
    try {
        const { playersPerTeam, minimumPlayerBasePrice, competitionFactor } = req.body;

        // Use provided values or defaults from model to calculate initial totalAmount (individual team budget)
        const pPT = playersPerTeam !== undefined ? parseInt(playersPerTeam) : 15;
        const mPBP = minimumPlayerBasePrice !== undefined ? parseFloat(minimumPlayerBasePrice) : 500000;
        const cF = competitionFactor !== undefined ? parseFloat(competitionFactor) : 5;

        if (req.body.totalAmount === undefined) {
            req.body.totalAmount = Math.round(pPT * mPBP * cF);
        }

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
        const hasBudgetChanges = playersPerTeam !== undefined || minimumPlayerBasePrice !== undefined || competitionFactor !== undefined;

        await sequelize.transaction(async (t) => {
            // Calculate new budget if any related params are changed
            if (hasBudgetChanges) {
                const pPT = parseInt(playersPerTeam !== undefined ? playersPerTeam : tournament.playersPerTeam) || 0;
                const mPBP = parseFloat(minimumPlayerBasePrice !== undefined ? minimumPlayerBasePrice : tournament.minimumPlayerBasePrice) || 0;
                const cF = parseFloat(competitionFactor !== undefined ? competitionFactor : tournament.competitionFactor) || 0;
                const newBudget = Math.round(pPT * mPBP * cF);
                
                // Set totalAmount in req.body so tournament.update picks it up
                req.body.totalAmount = newBudget;
            }

            await tournament.update(req.body, { transaction: t });

            if (hasBudgetChanges) {
                const newBudget = tournament.totalAmount;
                console.log(`[RECALC] Change detected. Recalculating with: ${tournament.playersPerTeam} * ${tournament.minimumPlayerBasePrice} * ${tournament.competitionFactor} = ${newBudget}`);

                if (newBudget > 0) {
                    const teams = await Team.findAll({ where: { tournamentId: tournament.id }, transaction: t });

                    for (const team of teams) {
                        team.budget = newBudget;
                        team.remainingBudget = newBudget - (team.spentAmount || 0);
                        await team.save({ transaction: t });
                    }

                    // If base price changed, update all upcoming players in this tournament
                    if (minimumPlayerBasePrice !== undefined) {
                        await Player.update(
                            { basePrice: parseFloat(minimumPlayerBasePrice) },
                            {
                                where: {
                                    tournamentId: tournament.id,
                                    status: 'UPCOMING'
                                },
                                transaction: t
                            }
                        );
                    }
                    console.log(`[RECALC] Successfully updated ${teams.length} teams.`);
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

        // Automatically create a user account for the team
        const defaultPassword = "Team" + (req.body.code || "123");
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);

        try {
            await User.create({
                username: (req.body.code || team.id).toString().toLowerCase(),
                password: hashedPassword,
                role: 'TEAM',
                teamId: team.id
            });
            console.log(`User account created for team ${team.name}: ${team.code}`);
        } catch (userError) {
            console.error("Could not create team user account:", userError);
            // We don't fail the team creation if user creation fails (e.g. duplicate username)
        }

        res.status(201).json({
            ...team.toJSON(),
            defaultPassword: defaultPassword // Send back so admin knows the initial password
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.addPlayer = async (req, res) => {
    try {
        const { id } = req.params;
        const { mobileNo } = req.body;

        // Validation: Prevent duplicate mobile number in the same tournament
        const existingPlayer = await Player.findOne({
            where: {
                mobileNo: mobileNo,
                tournamentId: id
            }
        });

        if (existingPlayer) {
            return res.status(400).json({ error: "A player with this mobile number is already registered for this tournament." });
        }

        if (req.body.image) {
            req.body.image = saveBase64Image(req.body.image, req.body.name);
        }

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

exports.registerPlayer = async (req, res) => {
    try {
        const { tournamentId, mobileNo } = req.body;
        if (!tournamentId) return res.status(400).json({ message: "Tournament ID required" });

        // Validation: Prevent duplicate mobile number in the same tournament
        const existingPlayer = await Player.findOne({
            where: {
                mobileNo: mobileNo,
                tournamentId: tournamentId
            }
        });

        if (existingPlayer) {
            return res.status(400).json({ message: "You are already registered for this tournament with this mobile number." });
        }

        if (req.body.image) {
            req.body.image = saveBase64Image(req.body.image, req.body.name);
        }

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

exports.checkExistingPlayer = async (req, res) => {
    try {
        const { mobileNo } = req.params;
        const player = await Player.findOne({
            where: { mobileNo },
            order: [['createdAt', 'DESC']],
            attributes: ['name', 'role', 'dob', 'gender', 'city', 'image', 'tShirtSize', 'trouserSize']
        });

        if (player) {
            res.json(player);
        } else {
            res.status(404).json({ message: 'No existing player found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getLatestPublicTournament = async (req, res) => {
    try {
        const tournament = await Tournament.findOne({
            order: [['createdAt', 'DESC']],
            attributes: ['id', 'name', 'minimumPlayerBasePrice', 'status', 'tournamentStartDate', 'tournamentEndDate', 'auctionDate', 'location', 'category', 'format', 'regEndDate'] // Public fields only
        });

        if (!tournament) {
            return res.status(404).json({ message: "No active tournament found" });
        }
        res.json(tournament);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getGlobalPlayers = async (req, res) => {
    try {
        const { search, role, city, excludeTournamentId } = req.query;
        let whereClause = {};

        if (search) {
            whereClause[Op.or] = [
                { name: { [Op.iLike]: `%${search}%` } },
                { mobileNo: { [Op.iLike]: `%${search}%` } }
            ];
        }
        if (role && role !== 'All') whereClause.role = role;
        if (city) whereClause.city = { [Op.iLike]: `%${city}%` };

        // Exclude players already in the specified tournament
        if (excludeTournamentId) {
            const existingPlayers = await Player.findAll({
                where: { tournamentId: excludeTournamentId },
                attributes: ['mobileNo'],
                raw: true
            });
            const existingMobiles = existingPlayers.map(p => p.mobileNo);
            if (existingMobiles.length > 0) {
                whereClause.mobileNo = {
                    ...(whereClause.mobileNo || {}),
                    [Op.notIn]: existingMobiles
                };
            }
        }

        // Get unique players based on mobileNo (latest entry)
        // Using grouping to get distinct mobile numbers
        const players = await Player.findAll({
            where: whereClause,
            attributes: [
                'mobileNo', 'name', 'role', 'dob', 'gender', 'city', 'image', 'tShirtSize', 'trouserSize',
                [sequelize.fn('MAX', sequelize.col('createdAt')), 'latestRegistration']
            ],
            group: ['mobileNo', 'name', 'role', 'dob', 'gender', 'city', 'image', 'tShirtSize', 'trouserSize'],
            order: [[sequelize.fn('MAX', sequelize.col('createdAt')), 'DESC']],
            limit: 100 // Limit results for performance
        });

        res.json(players);
    } catch (error) {
        console.error("Get Global Players Error:", error);
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
            attributes: ['id', 'name', 'minimumPlayerBasePrice', 'status', 'tournamentStartDate', 'tournamentEndDate', 'auctionDate', 'location', 'category', 'format', 'regEndDate']
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
                trouserSize: row['Trouser'] || row['trouser'] || null,
                city: row['City'] || row['city'] || null
            };
        }).filter(p => p.name);

        if (players.length === 0) {
            return res.status(400).json({ message: 'No valid players found in file' });
        }

        await Player.bulkCreate(players, { individualHooks: true });

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

        if (req.body.image) {
            req.body.image = saveBase64Image(req.body.image, req.body.name || player.name);
        }

        await player.update(req.body);
        res.json(player);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deletePlayer = async (req, res) => {
    try {
        const { playerId } = req.params;
        const player = await Player.findByPk(playerId);
        if (!player) {
            return res.status(404).json({ message: 'Player not found' });
        }

        await player.destroy();
        res.json({ message: 'Player removed successfully from tournament' });
    } catch (error) {
        console.error("Delete Player Error:", error);
        res.status(500).json({ error: error.message });
    }
};
