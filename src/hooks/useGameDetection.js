import { useEffect, useRef } from 'react';
import { detectRunningGame, isTauriEnvironment } from '../utils/windowManager';

/**
 * Periodically detects running games/activities on Windows via Tauri
 * and automatically updates the user's presence/profile status.
 */
export function useGameDetection({ currentGame, updateProfile, enabled = true }) {
  const currentGameRef = useRef(currentGame);
  useEffect(() => {
    currentGameRef.current = currentGame;
  }, [currentGame]);

  const updateProfileRef = useRef(updateProfile);
  useEffect(() => {
    updateProfileRef.current = updateProfile;
  }, [updateProfile]);

  useEffect(() => {
    if (!enabled || !isTauriEnvironment()) return;

    let isMounted = true;

    const checkGame = async () => {
      try {
        const detectedGame = await detectRunningGame();
        if (!isMounted) return;

        const current = (currentGameRef.current || '').trim();
        const detected = (detectedGame || '').trim();

        // If detected game differs from current profile game, update presence
        if (detected !== current) {
          await updateProfileRef.current?.({
            game: detected,
          });
        }
      } catch (err) {
        console.warn('Automatic game detection error:', err);
      }
    };

    // Run first check after 3 seconds
    const initialTimer = setTimeout(checkGame, 3000);

    // Poll every 12 seconds
    const interval = setInterval(checkGame, 12000);

    return () => {
      isMounted = false;
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [enabled]);
}
