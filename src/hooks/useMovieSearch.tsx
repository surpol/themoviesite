import { useState, useEffect, useCallback } from "react";
import debounce from 'lodash.debounce';

interface MovieOption {
  value: string;
  label: string;
}

export const useMovieSearch = () => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [movieOptions, setMovieOptions] = useState<MovieOption[]>([]);

  const fetchMovies = async (query: string) => {
    if (!query) {
      setMovieOptions([]);
      return;
    }
    try {
      const response = await fetch(`/api/movies?query=${encodeURIComponent(query)}`);
      if (!response.ok) {
        throw new Error(`Error fetching movies: ${response.statusText}`);
      }
      const data = await response.json();
      const options = data.map((movie: { movieId: string; title: string }) => ({
        value: movie.movieId,
        label: movie.title,
      }));
      setMovieOptions(options);
    } catch (error) {
      console.error('Error fetching movies:', error);
    }
  };

  const debouncedFetchMovies = useCallback(debounce(fetchMovies, 300), []);

  useEffect(() => {
    debouncedFetchMovies(searchTerm);
  }, [searchTerm, debouncedFetchMovies]);

  return { searchTerm, setSearchTerm, movieOptions };
};
