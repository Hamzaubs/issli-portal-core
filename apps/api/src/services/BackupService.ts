import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import util from 'util';

const execPromise = util.promisify(exec);

export const BackupService = {
  async performBackup() {
    // 1. Define Backup Directory (apps/api/backups)
    const backupDir = path.join(__dirname, '../../backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // 2. Define Targets (Silo A & Silo B)
    // NOTE: Ensure your .env DATABASE_URLs are correct.
    const targets = [
      { name: 'LEGAL', url: process.env.DATABASE_URL_STOCK_A },
      { name: 'INTERNAL', url: process.env.DATABASE_URL_STOCK_B }
    ];

    const results = [];

    // 3. Execute pg_dump for each
    for (const target of targets) {
      if (!target.url) {
        results.push({ name: target.name, status: 'SKIPPED (No URL)' });
        continue;
      }

      const filename = `${target.name}_${timestamp}.sql`;
      const filePath = path.join(backupDir, filename);

      // Command: pg_dump --dbname=URL --file=PATH
      // We use --clean to ensure the restore overwrites old schemas
      const command = `pg_dump "${target.url}" --clean --if-exists --file="${filePath}"`;

      try {
        console.log(`⏳ Backing up ${target.name}...`);
        await execPromise(command);
        results.push({ name: target.name, status: 'SUCCESS', file: filename });
      } catch (error) {
        console.error(`❌ Backup failed for ${target.name}:`, error);
        results.push({ name: target.name, status: 'FAILED', error: error });
      }
    }

    return results;
  }
};