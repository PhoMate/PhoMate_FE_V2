import React, { useState } from 'react';
import { User, Bell, Upload } from 'lucide-react'; 
import '../styles/Navbar.css';

interface NavbarProps {
    onNotiClick?: () => void;   
    onUploadClick?: () => void; 
}

export default function Navbar({ onNotiClick, onUploadClick }: NavbarProps) {
    const [notificationCount, setNotificationCount] = useState(1);

    return (
        <nav className="navbar">
            <div className="nav-left">
                <div className="auth-links">
                    <span className="clickable" onClick={() => console.log('로그인')}>로그인</span>
                    <span className="divider">/</span>
                    <span className="clickable" onClick={() => console.log('회원가입')}>회원가입</span>
                </div>
            </div>
            
            <div className="nav-center">
                <h1 className="logo-text" onClick={() => window.location.href='/'}>
                    PHOMATE
                </h1>
            </div>

            <div className="nav-right">
                <div className="notification-wrapper" onClick={onNotiClick}>
                    <div className="bell-container">
                        <svg className="bell-svg" viewBox="0 0 24 24" fill="none" stroke="#003366" strokeWidth="2">
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                        </svg>
                        {notificationCount > 0 && (
                            <div className="noti-badge">{notificationCount}</div>
                        )}
                    </div>
                </div>
                
                <div className="upload-btn clickable" onClick={onUploadClick}>
                    <Upload size={18} className="upload-icon" />
                    <span>업로드</span>
                </div>
            </div>
        </nav>
    );
}