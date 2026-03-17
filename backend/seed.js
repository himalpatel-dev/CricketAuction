const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const bcrypt = require('bcryptjs');
const { sequelize, User, Team, Player, Tournament } = require('./models');

async function seed() {
    try {
        await sequelize.sync({ force: true }); // Reset Database

        // 1. Create Tournament with new budget fields
        const tournament = await Tournament.create({
            name: 'Mega Cricket League 2026',
            tournamentStartDate: new Date(),
            tournamentEndDate: new Date(new Date().setMonth(new Date().getMonth() + 2)),
            regStartDate: new Date(),
            regEndDate: new Date(new Date().setDate(new Date().getDate() + 15)),
            auctionDate: new Date(new Date().setDate(new Date().getDate() + 20)),
            matchStartDate: new Date(new Date().setDate(new Date().getDate() + 30)),
            matchEndDate: new Date(new Date().setMonth(new Date().getMonth() + 3)),
            status: 'ACTIVE',
            totalPlayers: 200,
            playersPerTeam: 15,
            minimumPlayerBasePrice: 500000,
            competitionFactor: 1.5,
            format: 'T20',
            category: 'Franchise League'
        });

        console.log('Tournament Created:', tournament.name);

        // Budget calculation logic matches backend
        const calculatedBudget = tournament.playersPerTeam * tournament.minimumPlayerBasePrice * tournament.competitionFactor;
        console.log(`Initial Calculated Budget for Teams: ₹${calculatedBudget}`);

        // 2. Create Teams (Budget will be auto-calculated)
        const teamsData = [
            { 
                name: 'Royal Challengers', 
                code: 'RCB', 
                budget: calculatedBudget, 
                remainingBudget: calculatedBudget, 
                tournamentId: tournament.id, 
                ownerName: 'Andy Flower',
                spentAmount: 0,
                playersBought: 0
            },
            { 
                name: 'Chennai Super Kings', 
                code: 'CSK', 
                budget: calculatedBudget, 
                remainingBudget: calculatedBudget, 
                tournamentId: tournament.id, 
                ownerName: 'Stephen Fleming',
                spentAmount: 0,
                playersBought: 0
            },
            { 
                name: 'Mumbai Indians', 
                code: 'MI', 
                budget: calculatedBudget, 
                remainingBudget: calculatedBudget, 
                tournamentId: tournament.id, 
                ownerName: 'Mark Boucher',
                spentAmount: 0,
                playersBought: 0
            },
        ];

        const teams = await Team.bulkCreate(teamsData);
        console.log('Teams Created:', teams.length);

        // 3. Create Users (Admin & Team Owners)
        const adminPassword = await bcrypt.hash('admin123', 10);
        const teamPassword = await bcrypt.hash('team123', 10);

        await User.create({
            username: 'admin',
            password: adminPassword,
            role: 'ADMIN'
        });

        for (const team of teams) {
            await User.create({
                username: team.code.toLowerCase(), // rcb, csk, mi
                password: teamPassword,
                role: 'TEAM',
                teamId: team.id
            });
        }

        // 4. Create Tournament Admin
        const tournamentAdminPassword = await bcrypt.hash('admin123', 10);
        await User.create({
            username: 'tournament_admin',
            password: tournamentAdminPassword,
            role: 'TOURNAMENT_ADMIN',
            tournamentId: tournament.id
        });
        console.log('Tournament Admin Created: tournament_admin');

        // 5. Create Players
        const playersData = [
            { name: 'Virat Kohli', role: 'Batsman', basePrice: 500000, tournamentId: tournament.id, status: 'UPCOMING' },
            { name: 'MS Dhoni', role: 'Wicketkeeper', basePrice: 500000, tournamentId: tournament.id, status: 'UPCOMING' },
            { name: 'Rohit Sharma', role: 'Batsman', basePrice: 500000, tournamentId: tournament.id, status: 'UPCOMING' },
            { name: 'Jasprit Bumrah', role: 'Bowler', basePrice: 500000, tournamentId: tournament.id, status: 'UPCOMING' },
            { name: 'Hardik Pandya', role: 'All-Rounder', basePrice: 500000, tournamentId: tournament.id, status: 'UPCOMING' },
        ];

        await Player.bulkCreate(playersData);
        console.log('Players Created:', playersData.length);

        console.log('Database Seeded Successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Seeding Failed:', error);
        process.exit(1);
    }
}

seed();
