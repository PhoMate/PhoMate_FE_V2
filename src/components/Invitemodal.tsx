import React from 'react';
import { X } from 'lucide-react';
import '../styles/Notification.css';

export default function InviteModal({ albumName, onClose, onAccept, onReject }: any) {
    return (
        <div className="modal-overlay">
            <div className="invite-modal">
                <button className="modal-top-close" onClick={onClose}><X size={20} /></button>
                <div className="invite-modal-content">
                    <h2>{albumName} 에<br/>초대되었습니다.</h2>
                    <div className="invite-actions">
                        <button onClick={onAccept}>수락</button>
                        <span className="divider">|</span>
                        <button onClick={onReject}>거절</button>
                    </div>
                </div>
            </div>
        </div>
    );
}