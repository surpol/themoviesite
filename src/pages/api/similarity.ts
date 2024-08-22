import type { NextApiRequest, NextApiResponse } from 'next';
import { findTopSimilarMovies } from '../../utils/similaritySearch';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('STARTING...');
  const { movieIds } = req.body;

  if (!Array.isArray(movieIds) || movieIds.length === 0) {
    return res.status(400).json({ error: 'Movie IDs are required' });
  }

  try {
    const { similarMovies, missingMovies } = await findTopSimilarMovies(movieIds, 12);

    if (missingMovies.length > 0) {
      console.warn(`The following movie IDs were not found in the embeddings: ${missingMovies.join(', ')}`);
    }

    res.status(200).json({ similarMovies, missingMovies });
  } catch (error) {
    console.error('Failed to find similar movies:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
