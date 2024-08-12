"use client";

import React, { useState, useCallback } from "react";
import Select, { MultiValue } from 'react-select';
import debounce from 'lodash.debounce';

interface MovieOption {
  value: string;
  label: string;
}

export default function Home() {
  const [movies, setMovies] = useState<MovieOption[]>([]);
  const [selectedMovies, setSelectedMovies] = useState<MultiValue<MovieOption>>([]);
  const [similarMovies, setSimilarMovies] = useState<MovieOption[]>([]);
  const [missingMovies, setMissingMovies] = useState<MovieOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Function to fetch movies based on the search term
  const fetchMovies = async (query: string) => {
    if (!query) {
      setMovies([]);
      return;
    }
    try {
      const response = await fetch(`/api/movies?query=${encodeURIComponent(query)}`);
      if (!response.ok) {
        const errorData = await response.json();
        const errorMovieId = errorData.movieId; // Assuming the API returns the movieId that caused the error
        throw new Error(`Error with movieId "${errorMovieId}": There are no tags associated with this movie.`);
      }
      const data = await response.json();

      const movieOptions = data.map((movie: { movieId: string; title: string }) => ({
        value: movie.movieId,
        label: movie.title,
      }));

      setMovies(movieOptions);
    } catch (error) {
      console.error('Error fetching movies:', error);
    }
  };

  // Debounced function to limit API requests while typing
  const debouncedFetchMovies = useCallback(
    debounce((query: string) => {
      fetchMovies(query);
    }, 300),
    []
  );

// Function to fetch similar movies based on embeddings
const fetchSimilarMovies = async () => {
  setLoading(true);
  try {
    const movieIds = selectedMovies.map(movie => movie.value);

    const response = await fetch(`/api/similarity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ movieIds })
    });

    if (!response.ok) {
      const errorData = await response.json();
      setError(errorData.error || 'Failed to fetch similar movies. Try Again.');
      setLoading(false);
      return; // Exit early if there was an error
    }

    const data = await response.json();

    const { similarMovies, missingMovies } = data || {};

    if (!similarMovies) {
      throw new Error('Unexpected response structure');
    }

    if (missingMovies && missingMovies.length > 0) {
      const missingMoviesWithTitles = missingMovies.map((movieId: string) => {
        const matchedMovie = selectedMovies.find(movie => movie.value === movieId);
        return {
          value: movieId,
          label: matchedMovie ? matchedMovie.label : `Movie with ID ${movieId} not found`,
        };
      });

      setMissingMovies(missingMoviesWithTitles);
    }

    // Proceed with using similarMovies for similarity calculation
    setSimilarMovies(
      similarMovies.map((movie: { movieId: string; title: string; similarity: number }) => ({
        value: movie.movieId,
        label: `${movie.title} Similarity Rating: ${movie.similarity.toFixed(2)}`,
      }))
    );
  } catch (error) {
    console.error('Error fetching similar movies:', error);
    setError('An error occurred while fetching similar movies.');
  } finally {
    setLoading(false);
  }
};


return (
  <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-100">
    <div className="w-full max-w-2xl text-center">
      <h1 className="text-5xl font-bold mb-10 text-gray-800">The Movie Site</h1>
      <div className="relative w-full">
        <Select
          isMulti
          onInputChange={(inputValue, { action }) => {
            if (action === 'input-change') {
              debouncedFetchMovies(inputValue);
            }
          }}
          onChange={(selected) => setSelectedMovies(selected || [])}
          options={movies}
          placeholder="Enter Movie Titles"
          className="w-full text-lg border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:border-blue-500 text-gray-800"
          classNamePrefix="select"
          value={selectedMovies}
        />
      </div>

      {/* Display selected movie titles */}
      {selectedMovies.length > 0 && (
        <div className="mt-5">
          {/* Button to fetch embeddings */}
          <button
            onClick={fetchSimilarMovies}
            className="mt-5 px-4 py-2 bg-blue-500 text-white rounded-lg"
          >
            Find Similar Movies
          </button>
        </div>
      )}

      {loading && <p className="mt-5 text-gray-800">Loading...</p>}

      {/* Display error message */}
      {error && <p className="mt-5 text-red-600">{error}</p>}

      {/* Display similar movies based on embeddings */}
      {similarMovies.length > 0 && (
        <div className="mt-10 border-sky-500 rounded-md">
          <h2 className="mb-3 text-2xl font-bold text-gray-800">RESULTS:</h2>
          <ul className="list-disc list-inside">
            {similarMovies.map((movie) => (
              <li className="text-gray-800 text-center list-none" key={movie.value}>{movie.label}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Display missing movies */}
      {missingMovies.length > 0 && (
        <div className="mt-10 border-2 border-sky-500 rounded-md">
          <h2 className="mb-3 text-2xl font-bold text-red-600"></h2>
          <ul className="list-disc list-inside">
            {missingMovies.map((movie) => (
              <li className="text-red-600 text-center list-none" key={movie.value}>{movie.label}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  </main>
);

}