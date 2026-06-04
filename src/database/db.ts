import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'discord_recorder',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export const initDB = async () => {
  const connection = await pool.getConnection();
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        discord_id VARCHAR(255) PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        total_recordings INT DEFAULT 0
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS recordings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        duration INT NOT NULL,
        size BIGINT NOT NULL,
        participants TEXT NOT NULL,
        guild_id VARCHAR(255) NOT NULL,
        channel_id VARCHAR(255) NOT NULL
      )
    `);
    
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  } finally {
    connection.release();
  }
};

export default pool;
