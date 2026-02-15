import React from 'react';
import { X } from 'lucide-react';
import '../styles/Notification.css';

export default function NotificationPanel({ onClose, onItemClick }: any) {
    return (
        <div className="noti-panel">
            <div className="noti-header">
                <span>알림</span>
                <button onClick={onClose} className="noti-close-x"><X size={16} /></button>
            </div>
            <div className="noti-body">
                <div className="noti-item" onClick={onItemClick}>
                    <p>• 공유 앨범 3에 초대되었습니다</p>
                    <span className="noti-more">•••</span>
                </div>
            </div>
        </div>
    );
}