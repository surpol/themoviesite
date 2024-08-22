import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@vercel/postgres'; // Import the Vercel Postgres client

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { query } = req.query;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query parameter is required' });
  }

  try {
    // Connect to the PostgreSQL database
    const client = await db.connect();

    // Fetch the movies matching the query from the PostgreSQL database
    const { rows: movies } = await client.sql`
      SELECT movieId, title FROM movies 
      WHERE title ILIKE ${'%' + query + '%'}
      LIMIT 10;
    `;

    // Release the client back to the pool
    client.release();

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
