const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Team = sequelize.define('Team', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    code: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    budget: {
        type: DataTypes.FLOAT,
        defaultValue: 10000000, // Default 10Cr
    },
    remainingBudget: {
        type: DataTypes.FLOAT,
        defaultValue: 10000000,
    },
    logoUrl: {
        type: DataTypes.TEXT('long'),
        allowNull: true,
    },
    ownerName: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    captainId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'Players',
            key: 'id'
        }
    },
    tournamentId: {
        type: DataTypes.INTEGER, // Associated Tournament
        allowNull: true,
    },
}, {
    timestamps: true,
    indexes: [
        {
            unique: true,
            fields: ['code', 'tournamentId'] // Unique per tournament
        },
        {
            fields: ['captainId']
        }
    ]
});

module.exports = Team;
