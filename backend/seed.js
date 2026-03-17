const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const bcrypt = require('bcryptjs');
const { sequelize, User, Team, Player, Tournament } = require('./models');

async function seed() {
    try {
        await sequelize.sync({ force: true }); // Reset Database

        // 1. Create Tournament with new budget fields
        const tournament = await Tournament.create({
            name: 'Premier Cricket Auction 2026',
            tournamentStartDate: new Date(),
            tournamentEndDate: new Date(new Date().setMonth(new Date().getMonth() + 2)),
            regStartDate: new Date(),
            regEndDate: new Date(new Date().setDate(new Date().getDate() + 15)),
            auctionDate: new Date(new Date().setDate(new Date().getDate() + 20)),
            matchStartDate: new Date(new Date().setDate(new Date().getDate() + 30)),
            matchEndDate: new Date(new Date().setMonth(new Date().getMonth() + 3)),
            status: 'ACTIVE',
            totalPlayers: 150,
            playersPerTeam: 11,
            minimumPlayerBasePrice: 200000,
            competitionFactor: 5,
            format: 'T20',
            category: 'Professional League',
            location: 'Mumbai, India'
        });

        console.log('Tournament Created:', tournament.name);

        // Budget calculation logic matches backend
        const pPT = tournament.playersPerTeam;
        const mPBP = tournament.minimumPlayerBasePrice;
        const cF = tournament.competitionFactor;
        const calculatedBudget = Math.round(pPT * mPBP * cF);
        
        console.log(`Per-Team Budget: ₹${calculatedBudget}`);

        // 2. Create Teams
        const teamsData = [
            { name: 'Royal Challengers', code: 'RCB', budget: calculatedBudget, remainingBudget: calculatedBudget, tournamentId: tournament.id, ownerName: 'Andy Flower' },
            { name: 'Chennai Super Kings', code: 'CSK', budget: calculatedBudget, remainingBudget: calculatedBudget, tournamentId: tournament.id, ownerName: 'Stephen Fleming' },
            { name: 'Mumbai Indians', code: 'MI', budget: calculatedBudget, remainingBudget: calculatedBudget, tournamentId: tournament.id, ownerName: 'Mark Boucher' },
            { name: 'Gujarat Titans', code: 'GT', budget: calculatedBudget, remainingBudget: calculatedBudget, tournamentId: tournament.id, ownerName: 'Ashish Nehra' },
            { name: 'Lucknow Super Giants', code: 'LSG', budget: calculatedBudget, remainingBudget: calculatedBudget, tournamentId: tournament.id, ownerName: 'Justin Langer' },
        ];

        const teams = await Team.bulkCreate(teamsData);
        console.log('Teams Created:', teams.length);

        // Update tournament totalAmount based on teams
        tournament.totalAmount = calculatedBudget * teams.length;
        await tournament.save();

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
                username: team.code.toLowerCase(), // rcb, csk, etc.
                password: teamPassword,
                role: 'TEAM',
                teamId: team.id
            });
        }

        // 4. Create Tournament Admin
        await User.create({
            username: 'tournament_admin',
            password: adminPassword,
            role: 'TOURNAMENT_ADMIN',
            tournamentId: tournament.id
        });

        // 5. Create Players with full details
        const playersData = [
            { name: 'Virat Kohli', role: 'Batsman', tournamentId: tournament.id, mobileNo: '9876543210', dob: '1988-11-05', gender: 'Male', tShirtSize: 'L', trouserSize: '32' },
            { name: 'MS Dhoni', role: 'Wicketkeeper', tournamentId: tournament.id, mobileNo: '9876543211', dob: '1981-07-07', gender: 'Male', tShirtSize: 'XL', trouserSize: '34' },
            { name: 'Rohit Sharma', role: 'Batsman', tournamentId: tournament.id, mobileNo: '9876543212', dob: '1987-04-30', gender: 'Male', tShirtSize: 'XL', trouserSize: '36' },
            { name: 'Jasprit Bumrah', role: 'Bowler', tournamentId: tournament.id, mobileNo: '9876543213', dob: '1993-12-06', gender: 'Male', tShirtSize: 'M', trouserSize: '30' },
            { name: 'Suryakumar Yadav', role: 'Batsman', tournamentId: tournament.id, mobileNo: '9876543214', dob: '1990-09-14', gender: 'Male', tShirtSize: 'M', trouserSize: '30' },
            { name: 'Rashid Khan', role: 'Bowler', tournamentId: tournament.id, mobileNo: '9876543215', dob: '1998-09-20', gender: 'Male', tShirtSize: 'S', trouserSize: '28' },
            { name: 'Hardik Pandya', role: 'All-Rounder', tournamentId: tournament.id, mobileNo: '9876543216', dob: '1993-10-11', gender: 'Male', tShirtSize: 'L', trouserSize: '32' },
            { name: 'Ravindra Jadeja', role: 'All-Rounder', tournamentId: tournament.id, mobileNo: '9876543217', dob: '1988-12-06', gender: 'Male', tShirtSize: 'M', trouserSize: '30' },
            { name: 'KL Rahul', role: 'Wicketkeeper', tournamentId: tournament.id, mobileNo: '9876543218', dob: '1992-04-18', gender: 'Male', tShirtSize: 'M', trouserSize: '32' },
            { name: 'Shubman Gill', role: 'Batsman', tournamentId: tournament.id, mobileNo: '9876543219', dob: '1999-09-08', gender: 'Male', tShirtSize: 'M', trouserSize: '30' },
            { name: 'Mohammed Shami', role: 'Bowler', tournamentId: tournament.id, mobileNo: '9876543220', dob: '1990-09-03', gender: 'Male', tShirtSize: 'L', trouserSize: '32' },
            { name: 'Rishabh Pant', role: 'Wicketkeeper', tournamentId: tournament.id, mobileNo: '9876543221', dob: '1997-10-04', gender: 'Male', tShirtSize: 'M', trouserSize: '32' },
            { name: 'Yuzvendra Chahal', role: 'Bowler', tournamentId: tournament.id, mobileNo: '9876543222', dob: '1990-07-23', gender: 'Male', tShirtSize: 'S', trouserSize: '28' },
            { name: 'Sanju Samson', role: 'Wicketkeeper', tournamentId: tournament.id, mobileNo: '9876543223', dob: '1994-11-11', gender: 'Male', tShirtSize: 'M', trouserSize: '32' },
            { name: 'Glenn Maxwell', role: 'All-Rounder', tournamentId: tournament.id, mobileNo: '9876543224', dob: '1988-10-14', gender: 'Male', tShirtSize: 'XL', trouserSize: '34' }
        ];

        const basePrice = tournament.minimumPlayerBasePrice;
        const enrichedPlayers = playersData.map(p => ({ ...p, basePrice }));

        await Player.bulkCreate(enrichedPlayers);
        console.log('Players Created:', enrichedPlayers.length);

        console.log('Database Seeded Successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Seeding Failed:', error);
        process.exit(1);
    }
}

seed();
