import React, { useEffect, useState, useRef } from 'react';
import { GameState } from '@kingmakers/engine';
import { candidateDialogues } from '../../lib/candidateDialogues';
import { candidateName, candidateById } from '../../lib/cards';
import styles from './CandidatePresentation.module.css';

interface CandidatePresentationProps {
  state: GameState;
  onComplete: () => void;
}

export function CandidatePresentation({ state, onComplete }: CandidatePresentationProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const candidates = state.round.candidatesRevealed;

  useEffect(() => {
    if (candidates.length === 0) {
      onComplete();
      return;
    }

    const playAudio = async () => {
      const candidateId = candidates[currentIndex];
      const audioUrl = `/audio/candidates/${candidateId}.mp3`;
      
      try {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        
        setIsPlaying(true);
        
        audio.onended = () => {
          setIsPlaying(false);
          handleNext();
        };

        audio.onerror = () => {
          console.warn(`Audio not found for ${candidateId}, skipping to next after 3 seconds.`);
          setTimeout(() => {
            if (audioRef.current === audio) {
              setIsPlaying(false);
              handleNext();
            }
          }, 3000); // 3초 대기 후 다음으로 넘어감
        };

        await audio.play();
      } catch (err) {
        console.warn('Failed to play audio:', err);
        // Autoplay blocked or file missing
        setTimeout(() => {
          setIsPlaying(false);
          handleNext();
        }, 3000);
      }
    };

    playAudio();

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [currentIndex, candidates]);

  const handleNext = () => {
    if (currentIndex < candidates.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      onComplete();
    }
  };

  const skipAll = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    onComplete();
  };

  if (candidates.length === 0 || currentIndex >= candidates.length) return null;

  const currentCandidateId = candidates[currentIndex];
  const card = candidateById.get(currentCandidateId);
  const dialogue = candidateDialogues[currentCandidateId] || `${candidateName(currentCandidateId)}입니다. 잘 부탁드립니다!`;

  return (
    <div className={styles.overlay}>
      <div className={styles.topBar}>
        <h2 className={styles.title}>후보자 어필 타임</h2>
        <button className={styles.skipButton} onClick={skipAll}>
          SKIP ⏩
        </button>
      </div>

      <div className={styles.spotlightContainer}>
        <div className={`${styles.presentationCard} ${styles.popIn}`}>
          <div className={styles.portraitWrapper}>
            <img 
              src={`/images/candidates/${currentCandidateId}.png`} 
              alt={candidateName(currentCandidateId)} 
              className={styles.portrait}
              onError={(e) => {
                // 이미지가 없을 경우 기본 배경이나 아이콘으로 대체
                (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" fill="%23333"><rect width="200" height="200"/></svg>';
              }}
            />
          </div>
          <div className={styles.cardInfo}>
            <div className={styles.cardName}>{card?.name ?? currentCandidateId}</div>
            <div className={styles.cardDesc}>{card?.description}</div>
          </div>
        </div>

        <div className={`${styles.speechBubble} ${styles.slideUp}`}>
          <p>{dialogue}</p>
          <div className={styles.playingIndicator}>
            {isPlaying ? '🔊 재생 중...' : '⏳ 대기 중...'}
          </div>
        </div>
      </div>
      
      <div className={styles.progressDots}>
        {candidates.map((id, idx) => (
          <div 
            key={id} 
            className={`${styles.dot} ${idx === currentIndex ? styles.dotActive : ''} ${idx < currentIndex ? styles.dotDone : ''}`} 
          />
        ))}
      </div>
    </div>
  );
}
