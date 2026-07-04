// 기반 스킬: skills/setup/SKILL.md
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './global.css';

// React 앱 진입점 — 루트 요소에 App을 마운트한다
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
