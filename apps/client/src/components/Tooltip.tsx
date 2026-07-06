import React, { ReactNode } from 'react';
import styles from './Tooltip.module.css';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  return (
    <div className={styles.container}>
      {children}
      <div className={styles.tooltipWrap}>
        <div className={styles.tooltip}>{content}</div>
      </div>
    </div>
  );
}
