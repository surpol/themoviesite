import { MongoClient, Document } from 'mongodb';
import { cosineSimilarity } from './similarityUtils';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGODB_URI || "";
console.log("MONGODB_URI: " + uri);

let client: MongoClient | null = null;

// Function to connect to MongoDB
async function connectToDatabase() {
  if (!client) {
    try {
      client = new MongoClient(uri);
      await client.connect();
      console.log("Connected to MongoDB");
    } catch (error) {
      console.error("Error connecting to MongoDB", error);
      throw new Error("Failed to connect to the database");
    }
  }
  return client.db('Movies').collection<MovieEmbedding>('vectors');
}

interface MovieEmbedding {
  movieId: string;
  title: string;
  embedding: number[];
}

// Function to find top similar movies with batching
export async function findTopSimilarMovies(movieIds: string[], topN: number) {
  const collection = await connectToDatabase();

  // Fetch embeddings for the provided movie IDs
  const embeddings = await Promise.all(
    movieIds.map(id => collection.findOne({ movieId: id }))
  );

  // Filter out null embeddings
  const validEmbeddings = embeddings.filter((embedding): embedding is any => embedding !== null);
  const missingMovies = movieIds.filter((_, index) => embeddings[index] === null);

  if (validEmbeddings.length === 0) {
    console.log('No valid embeddings found for the provided movie IDs.');
    throw new Error('No valid embeddings found for the provided movie IDs.');
  }

  // Calculate the average embedding for the selected movies
  const aggregatedEmbedding = calculateAverageEmbedding(validEmbeddings.map(movie => movie.embedding));

  // Use a Set to avoid duplicates
  const seenMovies = new Set<string>();

  // Array to store similar movies
  const similarMovies: { movie: MovieEmbedding; similarity: number }[] = [];

  // Define batch size for pagination
  const batchSize = 1000;
  let cursor = collection.find({ embedding: { $exists: true } }).batchSize(batchSize);

  // Process all the movies in the collection
  while (await cursor.hasNext()) {
    const batch = await cursor.next();
    if (batch && isMovieEmbedding(batch) && !movieIds.includes(batch.movieId)) {
      // Avoid duplicate movies
      if (!seenMovies.has(batch.movieId)) {
        seenMovies.add(batch.movieId);
        const similarity = cosineSimilarity(aggregatedEmbedding, batch.embedding);
        similarMovies.push({ movie: batch, similarity });
      }
    }
  }

  // Sort similar movies by similarity score in descending order
  similarMovies.sort((a, b) => b.similarity - a.similarity);

  // Ensure that we only return the top N movies
  return {
    similarMovies: similarMovies.slice(0, topN).map(sim => ({
      movieId: sim.movie.movieId,
      title: sim.movie.title,
      similarity: sim.similarity
    })),
    missingMovies
  };
}

// Type guard function to ensure the document is a MovieEmbedding
function isMovieEmbedding(movie: Document): movie is MovieEmbedding {
  return (
    typeof movie.movieId === 'string' &&
    typeof movie.title === 'string' &&
    Array.isArray(movie.embedding)
  );
}

// Function to calculate the average embedding
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
