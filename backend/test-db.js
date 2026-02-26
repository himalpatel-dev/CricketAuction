const { Tournament, Team, Player } = require('./models');
const { sequelize } = require('./models');

async function test() {
    try {
        const tournamentId = 1; // Assuming 1 is the tournament ID
        const tournament = await Tournament.findByPk(tournamentId, {
            include: [
                {
                    model: Team,
                    as: 'teams',
                    include: [{ model: Player, as: 'players' }]
                },
                { model: Player, as: 'players' }
            ]
        });

        if (!tournament) {
            console.log('Tournament not found');
            process.exit(0);
        }

        console.log('Tournament:', tournament.name);
        console.log('Teams count:', tournament.teams.length);

        tournament.teams.forEach(t => {
            console.log(`Team: ${t.name}, ID: ${t.id}, Budget: ${t.budget}, Remaining: ${t.remainingBudget}, Players count: ${t.players.length}`);
            t.players.forEach(p => {
                console.log(`  - Player: ${p.name}, Status: ${p.status}, SoldTo: ${p.soldTo}, SoldPrice: ${p.soldPrice}`);
            });
        });

        console.log('Global Players:', tournament.players.length);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

test();
