const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    host: process.env.DB_HOST,
    database: 'postgres', // Connect to default 'postgres' db to create new db
});

async function createDatabase() {
    try {
        await client.connect();
        // Check if database exists
        const res = await client.query(`SELECT 1 FROM pg_database WHERE datname = '${process.env.DB_NAME}'`);
        if (res.rowCount === 0) {
            await client.query(`CREATE DATABASE "${process.env.DB_NAME}"`);
            console.log(`Database ${process.env.DB_NAME} created successfully.`);
        } else {
            console.log(`Database ${process.env.DB_NAME} already exists.`);
        }
    } catch (err) {
        console.error('Error creating database:', err);
    } finally {
        await client.end();
    }
}

createDatabase();
