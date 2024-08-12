import fs from 'fs';
import JSONStream from 'JSONStream';

interface MovieEmbedding {
  movieId: string;
  title: string;
  embedding: number[];
}

export async function findEmbeddingByMovieId(movieId: string): Promise<MovieEmbedding | null> {
  return new Promise((resolve, reject) => {
    const filePath = '/Users/suryapolina/Documents/GitHub/themoviesite/themoviesite/public/movie_embeddings.json';

    // Create a read stream for the file
    const stream = fs.createReadStream(filePath, { encoding: 'utf8' });

    // Use JSONStream to parse the JSON array
    const parser = JSONStream.parse('*'); // '*' means we're interested in all items in the array

    let found = false;

    stream.pipe(parser);

    parser.on('data', (movie: MovieEmbedding) => {
      if (String(movie.movieId) === String(movieId)) {
        found = true;
        console.log(`Match found for movieId: "${movie.movieId}"`);
        resolve(movie); // Resolve the promise with the found movie
        stream.destroy(); // Stop reading the file
      }
    });

    parser.on('end', () => {
      if (!found) {
        console.log(`No embedding found for movieId: "${movieId}"`);
        resolve(null); // Resolve with null if no match was found
      }
    });

    parser.on('error', (error) => {
      console.error('Error while parsing JSON:', error);
      reject(error); // Reject the promise on error
    });
  });
}
