const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Player = sequelize.define('Player', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    role: {
        type: DataTypes.ENUM('Batsman', 'Bowler', 'All-Rounder', 'Wicketkeeper'),
        allowNull: false,
    },
    basePrice: {
        type: DataTypes.FLOAT,
        allowNull: false,
    },
    image: {
        type: DataTypes.TEXT('long'),
        allowNull: true,
    },
    stats: {
        type: DataTypes.JSON, // Stores detailed stats (Runs, Wickets, AVG, SR)
        defaultValue: {},
    },
    status: {
        type: DataTypes.ENUM('UPCOMING', 'IN_AUCTION', 'SOLD', 'UNSOLD'),
        defaultValue: 'UPCOMING',
    },
    soldPrice: {
        type: DataTypes.FLOAT,
        defaultValue: 0,
    },
    soldTo: {
        type: DataTypes.INTEGER, // Team ID reference
        allowNull: true,
    },
    // New Fields
    mobileNo: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    dob: {
        type: DataTypes.DATEONLY,
        allowNull: true,
    },
    gender: {
        type: DataTypes.ENUM('Male', 'Female', 'Other'),
        allowNull: true,
    },
    tShirtSize: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    trouserSize: { // "pentsiize" as requested
        type: DataTypes.STRING,
        allowNull: true,
    },
    tournamentId: {
        type: DataTypes.INTEGER, // Associated Tournament
        allowNull: true,
    },
}, {
    timestamps: true,
    hooks: {
        beforeCreate: async (player) => {
            if (player.tournamentId) {
                const Tournament = sequelize.models.Tournament;
                const tournament = await Tournament.findByPk(player.tournamentId, { attributes: ['minimumPlayerBasePrice'] });
                if (tournament) player.basePrice = tournament.minimumPlayerBasePrice;
            }
        },
        beforeUpdate: async (player) => {
            if (player.changed('tournamentId') || player.changed('basePrice')) {
                const Tournament = sequelize.models.Tournament;
                const tournament = await Tournament.findByPk(player.tournamentId, { attributes: ['minimumPlayerBasePrice'] });
                if (tournament) player.basePrice = tournament.minimumPlayerBasePrice;
            }
        }
    }
});

module.exports = Player;
