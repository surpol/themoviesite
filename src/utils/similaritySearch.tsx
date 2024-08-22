import { MongoClient, Document } from 'mongodb';
import { cosineSimilarity } from './similarityUtils';
import dotenv from 'dotenv';
dotenv.config();

const uri = process.env.MONGODB_URI || "";
console.log("MONGODB_URI: " + uri);

// Initialize the MongoDB client
let client: MongoClient | null = null;

// Function to get the database collection
async function connectToDatabase() {
  // Only connect once
  if (!client) {
    try {
      client = new MongoClient(uri, {
      });
      await client.connect();
      console.log("Connected to MongoDB");
    } catch (error) {
      console.error("Error connecting to MongoDB", error);
      throw new Error("Failed to connect to the database");
    }
  }

  // Return the collection reference
  return client.db('Movies').collection<MovieEmbedding>('vectors');
}

interface MovieEmbedding {
  movieId: string;
  title: string;
  embedding: number[];
}

export async function findTopSimilarMovies(movieIds: string[], topN: number) {
  const collection = await connectToDatabase();
  
  // Fetch embeddings for the provided movie IDs
  const embeddings = await Promise.all(movieIds.map(id => collection.findOne({ movieId: id })));

  // Filter out null embeddings
  const validEmbeddings = embeddings.filter((embedding): embedding is any => embedding !== null);
  const missingMovies = movieIds.filter((_, index) => embeddings[index] === null);

  if (validEmbeddings.length === 0) {
    throw new Error('No valid embeddings found for the provided movie IDs.');
  }

  // Calculate the average embedding for the selected movies
  const aggregatedEmbedding = calculateAverageEmbedding(validEmbeddings.map(movie => movie.embedding));

  // Array to store similar movies
  const similarMovies: { movie: MovieEmbedding; similarity: number }[] = [];

  // Fetch all movies from the collection in batches to prevent memory overload
  const cursor = collection.find({ embedding: { $exists: true } });

  for await (const movie of cursor) {
    if (isMovieEmbedding(movie) && !movieIds.includes(movie.movieId)) {
      const similarity = cosineSimilarity(aggregatedEmbedding, movie.embedding);
      similarMovies.push({ movie, similarity });
    }
  }

  // Sort similar movies by similarity score in descending order
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
