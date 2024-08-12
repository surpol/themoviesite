import type { NextApiRequest, NextApiResponse } from 'next';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { query } = req.query;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query parameter is required' });
  }

  try {
    // Open a connection to the database
    const db = await open({
      filename: '/Users/suryapolina/Documents/GitHub/themoviesite/themoviesite/src/movies.db',  // Replace with the correct path
      driver: sqlite3.Database,
    });

    // Fetch the movies matching the query from the database
    const movies = await db.all(
      `SELECT movieId, title FROM Movies WHERE title LIKE ? LIMIT 10`,
      [`%${query}%`]
    );

    if (movies.length === 0) {
      return res.status(404).json({ error: 'No movies found' });
    }

    // Return the movies without embeddings
    res.status(200).json(movies);
  } catch (error) {
    console.error('Database query failed:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
