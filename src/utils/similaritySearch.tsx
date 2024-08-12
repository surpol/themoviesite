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

export async function findTopSimilarMovies(movieIds: string[], topN: number): Promise<SimilarMovie[]> {
  // Retrieve embeddings for all movie IDs
  const embeddings = await Promise.all(movieIds.map(id => findEmbeddingByMovieId(id)));
  console.log('FINISHED SEARCHING EMBEDDINGS');
  console.log(embeddings);
  const validEmbeddings = embeddings.filter((embedding): embedding is MovieEmbedding => embedding !== null);

  if (validEmbeddings.length === 0) {
    throw new Error('No valid embeddings found for the provided movie IDs.');
  }

  // Calculate the aggregated (average) embedding
  const aggregatedEmbedding = calculateAverageEmbedding(validEmbeddings.map(movie => movie.embedding));

  const similarMovies: { movie: MovieEmbedding; similarity: number }[] = [];

  // Stream through the JSON file to find and compare all movies
  await streamThroughEmbeddings((movie) => {
    if (!movieIds.includes(movie.movieId)) { // Exclude the original movies
      const similarity = cosineSimilarity(aggregatedEmbedding, movie.embedding);
      similarMovies.push({ movie, similarity });
    }
  });

  similarMovies.sort((a, b) => b.similarity - a.similarity);

  return similarMovies.slice(0, topN).map(sim => ({
    movieId: sim.movie.movieId,
    title: sim.movie.title,
    similarity: sim.similarity
  }));
}

// Function to calculate the average embedding vector
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

// Streaming function to go through all embeddings
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