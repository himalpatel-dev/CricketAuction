const { Tournament, Team, Player, User, sequelize } = require('../models');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { saveBase64Image } = require('../utils/imageUpload');
const { sendCredentialsEmail } = require('../utils/mailer');
const crypto = require('crypto');

exports.createTournament = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Tournament admin email is required.' });
        }

        const tournament = await Tournament.create(req.body);

        // Auto-generate tournament admin credentials
        const defaultPassword = "Admin" + crypto.randomBytes(3).toString('hex').toUpperCase(); // e.g. AdminA1B2C3
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);
        const username = `admin_${tournament.id}`;

        await User.create({
            username,
            password: hashedPassword,
            role: 'TOURNAMENT_ADMIN',
            email,
            mustChangePassword: true,
            tournamentId: tournament.id
        });

        // Send email notification
        try {
            await sendCredentialsEmail(email, tournament.name, 'Tournament Admin', username, defaultPassword);
        } catch (mailErr) {
            console.error('Failed to send tournament admin credentials email:', mailErr);
        }

        res.status(201).json({
            ...tournament.toJSON(),
            defaultAdminCredentials: {
                username,
                password: defaultPassword
            }
        });
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
                    include: [{
                        model: Player,
                        as: 'players',
                        where: { status: { [Op.ne]: 'WITHDRAWN' } },
                        required: false
                    }]
                },
                {
                    model: Player,
                    as: 'players',
                    where: { status: { [Op.ne]: 'WITHDRAWN' } },
                    required: false
                }
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
                    include: [{
                        model: Player,
                        as: 'players',
                        where: { status: { [Op.ne]: 'WITHDRAWN' } },
                        required: false
                    }]
                },
                {
                    model: Player,
                    as: 'players',
                    where: { status: { [Op.ne]: 'WITHDRAWN' } },
                    required: false
                }
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

        const { minimumPlayerBasePrice, totalAmount } = req.body;

        let updateData = { ...req.body };
        const isStatusOnlyUpdate = Object.keys(req.body).length === 1 && req.body.isrequestedtoedit !== undefined;
        if (tournament.isrequestedtoedit === 2 && (!isStatusOnlyUpdate || req.body.isrequestedtoedit === 0)) {
            updateData.isrequestedtoedit = 0;
            console.log(`[EDIT REQUEST] Resetting edit permission state to 0 as tournament details are saved.`);
        }

        await sequelize.transaction(async (t) => {
            await tournament.update(updateData, { transaction: t });

            // If budget (totalAmount) changed, update all teams
            if (totalAmount !== undefined) {
                const newBudget = parseFloat(totalAmount);
                const teams = await Team.findAll({ where: { tournamentId: tournament.id }, transaction: t });

                for (const team of teams) {
                    team.budget = newBudget;
                    team.remainingBudget = newBudget - (team.spentAmount || 0);
                    await team.save({ transaction: t });
                }
                console.log(`[BUDGET] Updated budget for ${teams.length} teams to: ${newBudget}`);
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
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Team owner email is required.' });
        }

        const tournament = await Tournament.findByPk(id);
        if (!tournament) return res.status(404).json({ message: 'Tournament not found' });

        const teamBudget = req.body.budget !== undefined
            ? parseFloat(req.body.budget)
            : (tournament.totalAmount || 0);

        const teamData = {
            ...req.body,
            tournamentId: id,
            budget: teamBudget,
            remainingBudget: teamBudget - (req.body.spentAmount || 0),
            spentAmount: req.body.spentAmount || 0,
            playersBought: req.body.playersBought || 0
        };

        const team = await Team.create(teamData);

        // Automatically create a user account for the team
        const defaultPassword = "Team" + (req.body.code || "123") + Math.floor(100 + Math.random() * 900); // e.g. TeamRCB472
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);
        const username = (req.body.code || team.id).toString().toLowerCase() + + Math.floor(100 + Math.random() * 900);

        try {
            await User.create({
                username,
                password: hashedPassword,
                role: 'TEAM',
                email,
                mustChangePassword: true,
                teamId: team.id
            });
            console.log(`User account created for team ${team.name}: ${team.code}`);

            // Send welcome credentials email
            try {
                await sendCredentialsEmail(email, team.ownerName || team.name, 'Team Owner', username, defaultPassword);
            } catch (mailErr) {
                console.error('Failed to send team owner credentials email:', mailErr);
            }
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
            if (existingPlayer.status === 'WITHDRAWN') {
                if (req.body.image && req.body.image !== existingPlayer.image) {
                    req.body.image = saveBase64Image(req.body.image, req.body.name || existingPlayer.name);
                }
                await existingPlayer.update({
                    ...req.body,
                    status: 'UPCOMING'
                });
                return res.status(200).json(existingPlayer);
            }
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
            if (existingPlayer.status === 'WITHDRAWN') {
                if (req.body.image && req.body.image !== existingPlayer.image) {
                    req.body.image = saveBase64Image(req.body.image, req.body.name || existingPlayer.name);
                }
                await existingPlayer.update({
                    ...req.body,
                    status: 'UPCOMING'
                });
                return res.status(200).json(existingPlayer);
            }
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
                where: {
                    tournamentId: excludeTournamentId,
                    status: { [Op.ne]: 'WITHDRAWN' }
                },
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

        player.status = 'WITHDRAWN';
        player.soldTo = null;
        player.soldPrice = 0;
        await player.save();

        res.json({ message: 'Player marked as withdrawn successfully' });
    } catch (error) {
        console.error("Delete Player Error:", error);
        res.status(500).json({ error: error.message });
    }
};
