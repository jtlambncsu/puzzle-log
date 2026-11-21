import { useEffect, useState } from 'react';
import type { Puzzle } from '@puzzle-log/shared';
import { usePuzzlesApi } from '../api/context';

export function PuzzleList() {
  const api = usePuzzlesApi();
  const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .list()
      .then((data) => {
        if (!cancelled) setPuzzles(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Something went wrong');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  if (loading) return <p>Loading puzzles…</p>;
  if (error) return <p role="alert">Error: {error}</p>;
  if (puzzles.length === 0) return <p>No puzzles yet. Time to start one!</p>;

  return (
    <ul className="puzzle-list">
      {puzzles.map((puzzle) => (
        <li key={puzzle.id}>
          <strong>{puzzle.title}</strong>
          {puzzle.pieceCount ? ` · ${puzzle.pieceCount} pieces` : null}
          {puzzle.brand ? ` · ${puzzle.brand}` : null}
        </li>
      ))}
    </ul>
  );
}
