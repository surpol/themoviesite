import { findEmbeddingByMovieId } from './embeddingSearch';
import { cosineSimilarity } from './similarityUtils';
import fs from 'fs';
import JSONStream from 'JSONStream';

interface MovieEmbedding {
  movieId: string;
  title: string;
  embedding: number[];
}

interface SimilarMovie {
  movieId: string;
  title: string;
  similarity: number;
}

export async function findTopSimilarMovies(movieIds: string[], topN: number): Promise<{ similarMovies: SimilarMovie[], missingMovies: string[] }> {
  const embeddings = await Promise.all(movieIds.map(id => findEmbeddingByMovieId(id)));

  const validEmbeddings = embeddings.filter((embedding): embedding is MovieEmbedding => embedding !== null);
  const missingMovies = movieIds.filter((_, index) => embeddings[index] === null);

  if (validEmbeddings.length === 0) {
    throw new Error('No valid embeddings found for the provided movie IDs.');
  }

  if (missingMovies.length > 0) {
    console.warn(`The following movie IDs were not found in the embeddings: ${missingMovies.join(', ')}`);
  }

  const aggregatedEmbedding = calculateAverageEmbedding(validEmbeddings.map(movie => movie.embedding));

  const similarMovies: { movie: MovieEmbedding; similarity: number }[] = [];

  await streamThroughEmbeddings((movie) => {
    if (!movieIds.includes(movie.movieId)) {
      const similarity = cosineSimilarity(aggregatedEmbedding, movie.embedding);
      similarMovies.push({ movie, similarity });
    }
  });

  similarMovies.sort((a, b) => b.similarity - a.similarity);

  return {
    similarMovies: similarMovies.slice(0, topN).map(sim => ({
      movieId: sim.movie.movieId,
      title: sim.movie.title,
      similarity: sim.similarity
    })),
    missingMovies
  };
}

function calculateAverageEmbedding(embeddings: number[][]): number[] {
  const numEmbeddings = embeddings.length;
  const embeddingLength = embeddings[0].length;

  const averageEmbedding = new Array(embeddingLength).fill(0);

  embeddings.forEach(embedding => {
    for (let i = 0; i < embeddingLength; i++) {
      averageEmbedding[i] += embedding[i];
    }
  });

  return averageEmbedding.map(value => value / numEmbeddings);
}

async function streamThroughEmbeddings(callback: (movie: MovieEmbedding) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const filePath = '/Users/suryapolina/Documents/GitHub/themoviesite/themoviesite/public/movie_embeddings.json'; // Adjust the path
    const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const parser = JSONStream.parse('*');

    stream.pipe(parser);

    parser.on('data', (movie: MovieEmbedding) => {
      callback(movie);
    });

    parser.on('end', resolve);

    parser.on('error', reject);
  });
}
