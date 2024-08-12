"use client";

import React, { useState, useCallback } from "react";
import Select from 'react-select';
import debounce from 'lodash.debounce';

interface MovieOption {
  value: string;
  label: string;
}

export default function Home() {
  const [movies, setMovies] = useState<MovieOption[]>([]);
  const [similarMovies, setSimilarMovies] = useState<MovieOption[]>([]);

  // Function to fetch movies based on the search term
  const fetchMovies = async (query: string) => {
    if (!query) {
      setMovies([]);
      return;
    }
    try {
      const response = await fetch(`/api/movies?query=${encodeURIComponent(query)}`);
      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
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
    try {
      const response = await fetch(`/api/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ movieIds: movies.map(movie => movie.value) })
      });

      const data = await response.json();

      setSimilarMovies(
        data.map((movie: { movieId: string; title: string; similarity: number }) => ({
          value: movie.movieId,
          label: `${movie.title} (Similarity: ${movie.similarity.toFixed(2)})`,
        }))
      );
    } catch (error) {
      console.error('Error fetching similar movies:', error);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-100">
      <div className="w-full max-w-2xl text-center">
        <h1 className="text-5xl font-bold mb-10 text-gray-800">The Movie Site</h1>
        <div className="relative w-full">
          <Select
            onInputChange={(inputValue, { action }) => {
              if (action === 'input-change') {
                debouncedFetchMovies(inputValue);
              }
            }}
            options={movies}
            placeholder="Enter Movie Titles"
            className="w-full text-lg border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:border-blue-500 text-gray-800"
            classNamePrefix="select"
          />
        </div>

        {/* Display search results */}
        {movies.length > 0 && (
          <div className="mt-5">
            {/* Button to fetch embeddings */}
            <button
              onClick={fetchSimilarMovies}
              className="mt-5 px-4 py-2 bg-blue-500 text-white font-bold rounded-lg"
            >
              Find Similar Movies
            </button>
          </div>
        )}

        {/* Display similar movies based on embeddings */}
        {similarMovies.length > 0 && (
          <div className="mt-10">
            <h2 className="text-2xl font-bold text-gray-800">Similar Movies:</h2>
            <ul className="list-disc list-inside">
              {similarMovies.map((movie) => (
                <li key={movie.value}>{movie.label}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
