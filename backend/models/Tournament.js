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
        get() {
            const rawValue = this.getDataValue('status');
            const now = new Date();
            now.setHours(0, 0, 0, 0); // Normalized today

            const start = this.getDataValue('tournamentStartDate');
            const end = this.getDataValue('tournamentEndDate');

            if (!start) return rawValue;

            try {
                const startDate = new Date(start);
                startDate.setHours(0, 0, 0, 0);

                // If end date exists, check if it's completed
                if (end) {
                    const endDate = new Date(end);
                    endDate.setHours(0, 0, 0, 0);
                    if (now > endDate) return 'COMPLETED';
                }

                // If already marked COMPLETED manually, keep it
                if (rawValue === 'COMPLETED') return 'COMPLETED';

                // Check for Upcoming vs Active
                if (startDate > now) return 'UPCOMING';
                return 'ACTIVE';
            } catch (err) {
                return rawValue;
            }
        }
    },
    logo: {
        type: DataTypes.TEXT('long'),
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
