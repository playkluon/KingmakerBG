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
  const currentCandidateId = candidates[currentIndex];

  useEffect(() => {
    if (!currentCandidateId) {
      if (candidates.length === 0 || currentIndex >= candidates.length) {
        onComplete();
      }
      return;
    }

    let timeoutId: number | null = null;
    let handled = false;

    const proceedNext = () => {
      if (handled) return;
      handled = true;
      setIsPlaying(false);
      if (timeoutId) clearTimeout(timeoutId);
      handleNext();
    };

    // audio.play()가 onended·onerror 어느 쪽도 부르지 않고 무기한 대기 상태로 남는 경우
    // (네트워크가 응답 없이 걸리는 등) 대비한 무조건 발동 안전장치 — 이게 없으면 후보자 어필
    // 타임이 영구 정지되어 게임 전체가 멈춘 것처럼 보인다(SKIP 버튼을 모르면 복구 불가).
    const safetyTimeoutId = window.setTimeout(() => {
      console.warn(`Presentation stalled for ${currentCandidateId}, forcing advance.`);
      proceedNext();
    }, 8000);

    const playAudio = async () => {
      const audioUrl = `${import.meta.env.BASE_URL}audio/candidates/${currentCandidateId}.mp3`;

      try {
        if (audioRef.current) {
          audioRef.current.pause();
        }

        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        setIsPlaying(true);

        audio.onended = () => proceedNext();

        audio.onerror = () => {
          setIsPlaying(false);
          console.warn(`Audio not found for ${currentCandidateId}, reading time 3 seconds.`);
          timeoutId = setTimeout(proceedNext, 3000);
        };

        await audio.play();
      } catch (err) {
        setIsPlaying(false);
        console.warn('Failed to play audio:', err);
        timeoutId = setTimeout(proceedNext, 3000);
      }
    };

    playAudio();

    return () => {
      handled = true; // Prevent proceedNext from running after unmount
      clearTimeout(safetyTimeoutId);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [currentCandidateId]);

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

  const card = candidateById.get(currentCandidateId!);
  const dialogue = candidateDialogues[currentCandidateId as string] || `${candidateName(currentCandidateId!)}입니다. 잘 부탁드립니다!`;

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
              src={`${import.meta.env.BASE_URL}images/candidates/${currentCandidateId}.png`} 
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
            {isPlaying ? '🔊 음성 재생 중...' : '⏳ 대본 읽는 중 (자동으로 넘어갑니다)...'}
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
