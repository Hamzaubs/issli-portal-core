// apps/api/src/services/BackupService.ts
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import util from 'util';
import archiver from 'archiver';

const execPromise = util.promisify(exec);

export const BackupService = {
  async performBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(__dirname, '../../backups');
    const tempDir = path.join(backupDir, `temp_${timestamp}`);
    const zipFilePath = path.join(backupDir, `ISSLI_PECHE_ERP_SYNC_${timestamp}.zip`);

    // 1. Ensure directories exist
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    // 2. Define Targets (Twin Silo Architecture matched to your .env)
    const targets = [
      { name: 'SILO_A_LEGAL', url: process.env.DATABASE_URL_LEGAL },
      { name: 'SILO_B_INTERNAL', url: process.env.DATABASE_URL_INTERNAL }
    ];

    console.log(`⏳ [BACKUP ENGINE] Initiating Synchronized Snapshot at ${timestamp}...`);

    // 3. Fire pg_dump SIMULTANEOUSLY for millisecond-perfect state matching
    const dumpPromises = targets.map(async (target) => {
      if (!target.url) {
        throw new Error(`🚨 CRITICAL: Missing Database URL for ${target.name} in .env`);
      }

      // 🛡️ FIX: Strip the '?schema=public' parameter that Prisma needs but pg_dump rejects
      const cleanUrl = target.url.split('?')[0];

      const filePath = path.join(tempDir, `${target.name}.sql`);
      
      // Command: pg_dump --dbname=URL --file=PATH
      const command = `pg_dump "${cleanUrl}" --clean --if-exists --file="${filePath}"`;
      
      await execPromise(command);
      console.log(`✅ [BACKUP ENGINE] Dumped ${target.name} successfully.`);
      return filePath;
    });

    await Promise.all(dumpPromises);

    // 4. Compress into a secure ZIP Archive
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipFilePath);
      const archive = archiver('zip', {
        zlib: { level: 9 } // Maximum compression
      });

      output.on('close', () => {
        console.log(`📦 [BACKUP ENGINE] Archive created: ${zipFilePath} (${archive.pointer()} bytes)`);
        // Clean up the temporary raw SQL files to save disk space
        fs.rmSync(tempDir, { recursive: true, force: true });
        resolve(zipFilePath);
      });

      archive.on('error', (err) => {
        console.error(`❌ [BACKUP ENGINE] Archiving failed:`, err);
        reject(err);
      });

      archive.pipe(output);
      archive.directory(tempDir, false);
      archive.finalize();
    });
  }
};