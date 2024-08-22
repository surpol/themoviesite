import { db } from '@vercel/postgres';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Papa from 'papaparse';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to parse CSV files
const parseCSV = async (filePath) => {
  const csvFile = fs.readFileSync(path.resolve(filePath), 'utf8');
  return new Promise((resolve, reject) => {
    Papa.parse(csvFile, {
      header: true,
      skipEmptyLines: true,
      delimiter: ',',
      complete: (results) => {
        if (results.errors.length) {
          reject(`Failed to parse CSV at ${filePath}: ${results.errors[0].message}`);
        } else {
          resolve(results.data);
        }
      },
    });
  });
};

// Function to insert data in batches with retry logic
const batchInsertWithRetry = async (promises, batchSize = 500, retries = 3) => {
  const batches = [];
  for (let i = 0; i < promises.length; i += batchSize) {
    const batch = promises.slice(i, i + batchSize);
    let attempt = 0;

    while (attempt < retries) {
      try {
        await Promise.all(batch);
        break; // Batch was successful, move to the next one
      } catch (error) {
        console.error(`Batch failed, attempt ${attempt + 1} of ${retries}:`, error);
        attempt += 1;
        if (attempt >= retries) {
          throw new Error(`Failed to process batch after ${retries} retries.`);
        }
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second before retrying
      }
    }
  }
};

// Seeding function for movies table
async function seedMovies(client) {
  // Create Movies table if it doesn't exist
  await client.sql`
    CREATE TABLE IF NOT EXISTS movies (
      movieId SERIAL PRIMARY KEY,
      imdbId VARCHAR(255),
      tmdbId VARCHAR(255),
      titleId VARCHAR(255),
      title VARCHAR(255),
      year INT,
      genres VARCHAR(255),
      createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
  console.log('Created "movies" table (if it didn\'t exist)');

  // Define the file paths
  const csvDir = path.join(__dirname, './ml-latest');

  // Read CSV data files
  const moviesData = await parseCSV(path.join(csvDir, 'movies.csv'));
  console.log(`Parsed ${moviesData.length} records from movies.csv`);

  // Seeding Movies table
  const moviePromises = moviesData.map((movie, index) => {
    if (!movie.movieId || !movie.title) {
      console.error(`Skipping movie at index ${index} due to missing movieId or title`);
      return Promise.resolve();
    }
    const year = movie.title.match(/\((\d{4})\)/)?.[1] || null;

    return client.sql`
      INSERT INTO movies (movieId, imdbId, tmdbId, titleId, title, year, genres)
      VALUES (${movie.movieId}, ${movie.imdbId}, ${movie.tmdbId}, ${movie.titleId}, ${movie.title}, ${year}, ${movie.genres})
      ON CONFLICT (movieId) DO UPDATE 
      SET 
        imdbId = EXCLUDED.imdbId,
        tmdbId = EXCLUDED.tmdbId,
        titleId = EXCLUDED.tmdbId,
        title = EXCLUDED.title, 
        year = EXCLUDED.year,
        genres = EXCLUDED.genres;    `;
  });

  // Insert movies in batches with retry logic
  await batchInsertWithRetry(moviePromises);

  console.log('Repopulated movies table');
}

// Main function
async function main() {
  const client = await db.connect();
  try {
    await seedMovies(client);
  } catch (error) {
    console.error('An error occurred while attempting to repopulate the movies table:', error);
  } finally {
    await client.end();
  }
}

// Run the main function
main().catch((err) => {
  console.error('An error occurred while attempting to seed the database:', err);
});
