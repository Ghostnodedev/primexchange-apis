// This script will add the columns to the "login" table
import { db } from './libdb.js'; // Import the DB connection

async function migrate() {
  try {
    // Add "otp" column if it doesn't exist
    await db.execute(`ALTER TABLE login ADD COLUMN otp TEXT`);
    console.log('Added otp column');
  } catch (err) {
    if (err.message.includes('duplicate column name')) {
      console.log('otp column already exists');
    } else {
      console.error('Error adding otp column:', err);
    }
  }

  try {
    // Add "otp_expires_at" column if it doesn't exist
    await db.execute(`ALTER TABLE login ADD COLUMN otp_expires_at INTEGER`);
    console.log('Added otp_expires_at column');
  } catch (err) {
    if (err.message.includes('duplicate column name')) {
      console.log('otp_expires_at column already exists');
    } else {
      console.error('Error adding otp_expires_at column:', err);
    }
  }

  // End the process once done
  process.exit(0);
}

migrate(); // Run the migration
