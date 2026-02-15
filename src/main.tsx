// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import Home from './pages/Home'
import './styles/global.css'

// 'root'라는 ID를 가진 요소를 찾습니다.
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('index.html에 root 엘리먼트가 없습니다.');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <Home />
  </React.StrictMode>,
)