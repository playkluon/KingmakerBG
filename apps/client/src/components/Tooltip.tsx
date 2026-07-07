import React, { ReactNode } from 'react';
import styles from './Tooltip.module.css';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Tooltip({ content, children, className, style }: TooltipProps) {
  return (
    <div className={`${styles.container} ${className || ''}`} style={style}>
      {children}
      <div className={styles.tooltipWrap}>
        <div className={styles.tooltip}>{content}</div>
      </div>
    </div>
  );
}
