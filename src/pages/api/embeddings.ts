import type { NextApiRequest, NextApiResponse } from 'next';
import { findEmbeddingByMovieId } from '../../utils/embeddingSearch';

// Testing API for finding embeddings by movieId
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { movieIds } = req.body; // Expect an array of movie IDs in the request body

  if (!Array.isArray(movieIds) || movieIds.length === 0) {
    return res.status(400).json({ error: 'Movie IDs are required' });
  }

  try {
    console.log('Fetching embeddings for movies:', movieIds);
    
    const moviesWithEmbeddings = await Promise.all(movieIds.map(async (movieId: string) => {
      const embedding = await findEmbeddingByMovieId(movieId);
      return {
        movieId: movieId,
        title: embedding ? embedding.title : null,
        embedding: embedding ? embedding.embedding : null,
      };
    }));

    res.status(200).json(moviesWithEmbeddings);
  } catch (error) {
    console.error('Failed to fetch embeddings:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}