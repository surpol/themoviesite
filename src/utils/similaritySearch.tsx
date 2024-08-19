import { MongoClient } from 'mongodb';
import { cosineSimilarity } from './similarityUtils';
import dotenv from 'dotenv';

dotenv.config();
const uri = process.env.MONGODB_URI || "";

let client: MongoClient;
async function connectToDatabase() {
  if (!client) {
    client = new MongoClient(uri);
    await client.connect();
  }
  return client.db('Movies').collection('vectors');
}

interface MovieEmbedding {
  movieId: string;
  title: string;
  embedding: number[];
}

export async function findTopSimilarMovies(movieIds: string[], topN: number) {
  const collection = await connectToDatabase();
  const embeddings = await Promise.all(movieIds.map(id => collection.findOne({ movieId: id })));

  const validEmbeddings = embeddings.filter((embedding): embedding is any => embedding !== null);
  const missingMovies = movieIds.filter((_, index) => embeddings[index] === null);

  if (validEmbeddings.length === 0) {
    throw new Error('No valid embeddings found for the provided movie IDs.');
  }

  const aggregatedEmbedding = calculateAverageEmbedding(validEmbeddings.map(movie => movie.embedding));

  const similarMovies: { movie: MovieEmbedding; similarity: number }[] = [];

  const allMovies = await collection.find().toArray();

  allMovies.forEach(movie => {
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
