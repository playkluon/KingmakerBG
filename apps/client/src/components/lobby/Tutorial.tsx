// 기반 스킬: skills/ux-feedback/SKILL.md
// 로비 전용 단계별 튜토리얼 — 처음 온 사람은 순서대로 훑고, 익숙한 사람은 건너뛰기로 바로 준비 완료로 넘어간다.
// 완료/건너뛰기 결과는 LobbyScreen이 서버(room:tutorialDone)에 기록해, 방 전체가 끝나야 게임을 시작할 수 있다.
import { useState } from 'react';
import board from '../board/board.module.css';
import styles from './Tutorial.module.css';

interface Step {
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    title: '당신은 후보가 아니라 브로커입니다',
    body:
      '킹메이커스에서 당신은 선거에 나가지 않습니다. 후보를 후원하고, 유권자를 관리하고, 정책을 움직여서 승점(VP)을 가장 많이 모으는 사람이 이깁니다.',
  },
  {
    title: '경매 — 후보를 후원한다',
    body:
      '라운드마다 후보 몇 명이 공개됩니다. 다른 사람 몰래 후보에게 자금을 나눠 입찰하세요. 가장 많이 낸 사람이 그 후보의 주요 후원자, 다음이 공동 후원자가 되어 당선 시 가장 큰 점수를 받습니다.',
  },
  {
    title: '공약 선택',
    body: '주요 후원자는 후보에게 제시된 공약 3장 중 하나를 고릅니다. 공약은 정책 방향을 움직이고, 유권자의 표심에도 영향을 줍니다.',
  },
  {
    title: '캠페인 액션',
    body:
      '차례가 돌아가며 유권자 접촉·광고·모금·정책 압박 같은 액션을 2번 할 수 있습니다. 내가 통제하는 유권자는 언제든 무료로 원하는 후보에게 배정할 수 있습니다.',
  },
  {
    title: '단일화와 비밀 밀약',
    body:
      '출마한 후보의 주요 후원자는 다른 후보에게 사퇴를 제안(단일화)할 수 있습니다. 다른 참가자와 몰래 밀약을 맺을 수도 있는데, 배신하면 평판이 깎이고 상대가 보상을 받습니다.',
  },
  {
    title: '투표와 점수',
    body:
      '캠페인이 끝나면 자동으로 표가 집계되고 당선자가 정해집니다. 당선 후원, 공약 실행, 비밀 의제 달성 등으로 승점(VP)을 얻고, 라운드를 모두 마쳤을 때 VP가 가장 많은 사람이 승리합니다.',
  },
];

interface TutorialProps {
  /** 완료(마지막 단계 완주) 또는 건너뛰기 모두 이 콜백으로 끝난다 — 호출자는 서버에 tutorialDone=true를 기록한다 */
  onDone: () => void;
}

/** 로비에서 아직 튜토리얼을 마치지 않은 내 자리에 뜨는 인터랙티브 가이드 */
export function Tutorial({ onDone }: TutorialProps) {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;
  const current = STEPS[step]!;

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h2 className={board.sectionTitle}>처음이신가요? 30초 안내</h2>
        <button className={board.buttonGhost} onClick={onDone}>
          건너뛰기
        </button>
      </div>

      <div className={styles.progress}>
        {STEPS.map((s, i) => (
          <span key={s.title} className={i === step ? `${styles.dot} ${styles.dotOn}` : styles.dot} />
        ))}
      </div>

      <h3 className={styles.stepTitle}>{current.title}</h3>
      <p className={styles.stepBody}>{current.body}</p>

      <div className={styles.nav}>
        <button className={board.buttonGhost} disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          이전
        </button>
        <span className={styles.stepCount}>
          {step + 1} / {STEPS.length}
        </span>
        {isLast ? (
          <button className={board.button} onClick={onDone}>
            시작할 준비 완료!
          </button>
        ) : (
          <button className={board.button} onClick={() => setStep((s) => s + 1)}>
            다음
          </button>
        )}
      </div>
    </div>
  );
}
