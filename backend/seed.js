const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const bcrypt = require('bcryptjs');
const { sequelize, User, Team, Player, Tournament } = require('./models');

async function seed() {
    try {
        await sequelize.sync({ force: true }); // Reset Database

        // 1. Create Tournament
        const tournament = await Tournament.create({
            name: 'Mega Cricket League 2026',
            tournamentStartDate: new Date(),
            tournamentEndDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
            regStartDate: new Date(),
            regEndDate: new Date(new Date().setDate(new Date().getDate() + 15)),
            auctionDate: new Date(new Date().setDate(new Date().getDate() + 20)),
            matchStartDate: new Date(new Date().setDate(new Date().getDate() + 30)),
            matchEndDate: new Date(new Date().setMonth(new Date().getMonth() + 2)),
            status: 'ACTIVE',
            totalPlayers: 200,
            totalAmount: 120000000, // 12 Cr
            playerReservedAmount: 2000000,
            baseAuctionPrice: 1000000
        });

        console.log('Tournament Created:', tournament.name);

        // 2. Create Teams
        const teamsData = [
            { name: 'Royal Challengers', code: 'RCB', budget: 100000000, remainingBudget: 100000000, tournamentId: tournament.id, coach: 'Andy Flower' },
            { name: 'Chennai Super Kings', code: 'CSK', budget: 100000000, remainingBudget: 100000000, tournamentId: tournament.id, coach: 'Stephen Fleming' },
            { name: 'Mumbai Indians', code: 'MI', budget: 100000000, remainingBudget: 100000000, tournamentId: tournament.id, coach: 'Mark Boucher' },
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

        console.log('Users Created');

        // 4. Create Players
        const playersData = [
            { name: 'Virat Kohli', role: 'Batsman', basePrice: 2000000, tournamentId: tournament.id, mobileNo: '9876543210', dob: '1988-11-05', gender: 'Male', tShirtSize: 'L', trouserSize: 'M' },
            { name: 'MS Dhoni', role: 'Wicketkeeper', basePrice: 1500000, tournamentId: tournament.id, mobileNo: '9876543211', dob: '1981-07-07', gender: 'Male', tShirtSize: 'L', trouserSize: 'L' },
            { name: 'Rohit Sharma', role: 'Batsman', basePrice: 2000000, tournamentId: tournament.id, mobileNo: '9876543212', dob: '1987-04-30', gender: 'Male', tShirtSize: 'XL', trouserSize: 'L' },
            { name: 'Jasprit Bumrah', role: 'Bowler', basePrice: 1800000, tournamentId: tournament.id, mobileNo: '9876543213', dob: '1993-12-06', gender: 'Male', tShirtSize: 'M', trouserSize: 'M' },
            { name: 'Hardik Pandya', role: 'All-Rounder', basePrice: 1800000, tournamentId: tournament.id, mobileNo: '9876543214', dob: '1993-10-11', gender: 'Male', tShirtSize: 'L', trouserSize: 'M' },
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
