import type { NextApiRequest, NextApiResponse } from 'next';
import { findTopSimilarMovies } from '../../utils/similaritySearch';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('STARING...');
  const { movieIds } = req.body; // Expect an array of movie IDs in the request body

  if (!Array.isArray(movieIds) || movieIds.length === 0) {
    return res.status(400).json({ error: 'Movie IDs are required' });
  }

  try {
    const similarMovies = await findTopSimilarMovies(movieIds, 10); // Top 10 similar movies
    res.status(200).json(similarMovies);
  } catch (error) {
    console.error('Failed to find similar movies:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
