const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    role: {
        type: DataTypes.ENUM('ADMIN', 'TEAM', 'TOURNAMENT_ADMIN'),
        defaultValue: 'TEAM',
    },
    // If role is TEAM, this links to the Team table
    teamId: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    // If role is TOURNAMENT_ADMIN, this links to the Tournament table
    tournamentId: {
        type: DataTypes.INTEGER,
        allowNull: true,
    }
}, {
    timestamps: true,
});

module.exports = User;
