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
    startDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
    },
    endDate: {
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
    }
}, {
    timestamps: true,
});

module.exports = Tournament;
