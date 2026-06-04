import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { readdirSync, statSync } from 'fs';
import pool from '../database/db.ts';
import { setIO } from '../events.ts';
import path from 'path';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

setIO(io);

app.use(cors());
app.use(express.json());

app.get('/api/recordings', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM recordings ORDER BY date DESC');
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Database error' });
  }
});

function getFolderSizeBytes(folderPath: string): number {
  let total = 0;
  try {
    for (const entry of readdirSync(folderPath, { withFileTypes: true })) {
      const fullPath = path.join(folderPath, entry.name);
      total += entry.isDirectory() ? getFolderSizeBytes(fullPath) : statSync(fullPath).size;
    }
  } catch {}
  return total;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

app.get('/api/stats', async (_req, res) => {
  try {
    const [totalRecs]: any  = await pool.query('SELECT COUNT(*) as count FROM recordings');
    const [totalUsers]: any = await pool.query('SELECT COUNT(DISTINCT discord_id) as count FROM users');
    const sizeBytes = getFolderSizeBytes(process.env.STORAGE_PATH || './recordings');
    res.json({
      totalRecordings: totalRecs[0].count,
      totalUsers: totalUsers[0].count,
      storageUsed: formatBytes(sizeBytes),
    });
  } catch {
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/recordings/file/:filename', (req, res) => {
  const storagePath = process.env.STORAGE_PATH || './recordings';
  const filename = path.basename(req.params.filename);
  try {
    for (const day of readdirSync(storagePath)) {
      const dayPath = path.join(storagePath, day);
      for (const session of readdirSync(dayPath)) {
        const filePath = path.join(dayPath, session, filename);
        try {
          statSync(filePath);
          res.download(filePath);
          return;
        } catch {}
      }
    }
  } catch {}
  res.status(404).json({ error: 'File not found' });
});

io.on('connection', socket => {
  console.log('[ws] client conectado');
  socket.on('disconnect', () => console.log('[ws] client desconectado'));
});

const PORT = process.env.PORT || 3001;
export const startServer = () => {
  httpServer.listen(PORT, () => console.log(`🌐 Server na porta ${PORT}`));
};
