const sequelize = require('../config/database');
const User = require('./User');
const Team = require('./Team');
const Player = require('./Player');
const Bid = require('./Bid');
const Tournament = require('./Tournament');

// Relationships

// Tournament - Team/Player
Tournament.hasMany(Team, { foreignKey: 'tournamentId', as: 'teams' });
Team.belongsTo(Tournament, { foreignKey: 'tournamentId', as: 'tournament' });

Tournament.hasMany(Player, { foreignKey: 'tournamentId', as: 'players' });
Player.belongsTo(Tournament, { foreignKey: 'tournamentId', as: 'tournament' });

// Team - User (Some users belong to a team)
Team.hasMany(User, { foreignKey: 'teamId', as: 'users' });
User.belongsTo(Team, { foreignKey: 'teamId', as: 'team' });

// Team - Player (Sold Players)
Team.hasMany(Player, { foreignKey: 'soldTo', as: 'players' });
Player.belongsTo(Team, { foreignKey: 'soldTo', as: 'owner_team' });

// Team - Captain (A team has one captain who is a player)
Team.belongsTo(Player, { foreignKey: 'captainId', as: 'captain' });
Player.hasOne(Team, { foreignKey: 'captainId', as: 'captainOf' });

// Bids
Team.hasMany(Bid, { foreignKey: 'teamId', as: 'bids' });
Bid.belongsTo(Team, { foreignKey: 'teamId', as: 'team' });

Player.hasMany(Bid, { foreignKey: 'playerId', as: 'bids' });
Bid.belongsTo(Player, { foreignKey: 'playerId', as: 'player' });

module.exports = {
    sequelize,
    User,
    Team,
    Player,
    Bid,
    Tournament,
};
