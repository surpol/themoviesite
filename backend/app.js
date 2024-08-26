const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors()); // Enable CORS if your frontend and backend are hosted separately

// Initialize PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL, // Postgres connection string from Vercel environment
});

// Initialize MongoDB connection
const mongoUri = process.env.MONGODB_URI || "";
console.log('MongoDB URI:', mongoUri);
console.log('Postgres URI:', process.env.POSTGRES_URL);
let mongoClient;

async function connectToMongoDB() {
  if (!mongoClient) {
    mongoClient = new MongoClient(mongoUri);
    await mongoClient.connect();
    console.log('Connected to MongoDB');
  }
  return mongoClient.db('Movies').collection('vectors');
}

// Function to calculate the average embedding
function calculateAverageEmbedding(embeddings) {
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

// Movies API: Search for movies in the Postgres database
app.get('/api/movies', async (req, res) => {
  const { query } = req.query;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query parameter is required' });
  }

  try {
    const result = await pool.query(
      `
      SELECT movieId, title
      FROM movies 
      WHERE title ILIKE $1 
      ORDER BY 
        CASE 
          WHEN title ILIKE $2 THEN 1   -- Exact match comes first
          WHEN title ILIKE $3 THEN 2   -- Titles that start with the query come next
          ELSE 3                       -- Titles that contain the query come last
        END
      LIMIT 25;
      `,
      [`%${query}%`, `${query}`, `${query}%`]
    );    

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No movies found' });
    }

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error querying the Postgres database:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Similarity API: Find top similar movies using MongoDB Atlas Vector Search
app.post('/api/similar', async (req, res) => {
  const { movieIds } = req.body;

  if (!movieIds || !Array.isArray(movieIds)) {
    return res.status(400).json({ error: 'movieIds must be an array' });
  }

  try {
    const collection = await connectToMongoDB();

    // Fetch embeddings for the provided movie IDs
    const embeddings = await Promise.all(
      movieIds.map(id => collection.findOne({ movieId: id }))
    );

    const validEmbeddings = embeddings.filter((embedding) => embedding !== null);
    const missingMovies = movieIds.filter((_, index) => embeddings[index] === null);

    if (validEmbeddings.length === 0) {
      return res.status(400).json({ error: 'No valid embeddings found for the provided movie IDs.' });
    }

    // Calculate the average embedding of the selected movies
    const averageEmbedding = calculateAverageEmbedding(validEmbeddings.map(movie => movie.embedding));

    // MongoDB Atlas Vector Search Query
    const vectorSearchResult = await collection.aggregate([
      {
        $vectorSearch: {
          index: "vector_index",  // Your vector index name
          path: "embedding",      // The path to the vector field
          queryVector: averageEmbedding,  // The average embedding
          numCandidates: 100,     // Number of candidate vectors to compare
          limit: 15               // Limit the number of results
        }
      },
      {
        $project: {
          movieId: 1,
          _id: 0
        }
      }
    ]).toArray();

    const foundMovieIds = vectorSearchResult.map(result => result.movieId);

    // Query PostgreSQL to get the movie details for the returned movieIds
    const placeholders = foundMovieIds.map((_, idx) => `$${idx + 1}`).join(',');
    const movieDetailsQuery = `SELECT movieId, title, tmdbId, imdbId FROM movies WHERE movieId IN (${placeholders})`;

    const movieDetailsResult = await pool.query(movieDetailsQuery, foundMovieIds);

    // Return the similar movies along with the missing ones
    res.status(200).json({
      similarMovies: movieDetailsResult.rows, 
      missingMovies
    });
  } catch (error) {
    console.error('Failed to find similar movies using vector search:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// Graceful shutdown for MongoDB connection
async function disconnectFromMongoDB() {
  if (mongoClient) {
    await mongoClient.close();
    console.log('Disconnected from MongoDB');
  }
}

// Start the server
const PORT = process.env.PORT || 8080;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle server shutdown gracefully
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received.');
  await disconnectFromMongoDB();
  server.close(() => {
    console.log('Server closed');
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received.');
  await disconnectFromMongoDB();
  server.close(() => {
    console.log('Server closed');
  });
});
