const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Tournament = sequelize.define('Tournament', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    tournamentStartDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
    },
    tournamentEndDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
    },
    matchStartDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
    },
    matchEndDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
    },
    regStartDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
    },
    regEndDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
    },
    auctionDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
    },
    status: {
        type: DataTypes.ENUM('UPCOMING', 'ACTIVE', 'COMPLETED'),
        defaultValue: 'UPCOMING',
    },
    logo: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    totalPlayers: {
        type: DataTypes.INTEGER,
        defaultValue: 100,
    },
    totalAmount: {
        type: DataTypes.FLOAT,
        defaultValue: 100000000, // 10 Cr default
    },
    playerReservedAmount: {
        type: DataTypes.FLOAT,
        defaultValue: 1000000,
    },
    baseAuctionPrice: {
        type: DataTypes.FLOAT,
        defaultValue: 500000,
    },
    format: {
        type: DataTypes.STRING,
        defaultValue: 'T20',
    },
    location: {
        type: DataTypes.STRING,
        defaultValue: 'Mumbai, India',
    },
    category: {
        type: DataTypes.STRING,
        defaultValue: 'T20 League',
    }
}, {
    timestamps: true,
});

module.exports = Tournament;
