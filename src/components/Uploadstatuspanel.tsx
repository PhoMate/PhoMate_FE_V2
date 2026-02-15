import React from 'react';
import '../styles/Notification.css';

export default function UploadStatusPanel({ progress }: { progress: number }) {
    return (
        <div className="noti-panel upload-status">
            <div className="noti-header">
                <span>업로드 중...</span>
                <span className="progress-percent">{progress}%</span>
            </div>
            <div className="noti-body">
                <div className="upload-progress-container">
                    <div className="upload-progress-fill" style={{ width: `${progress}%` }}></div>
                </div>
                <p className="upload-filename">photo_20240216.jpg</p>
            </div>
        </div>
    );
}