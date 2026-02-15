import React from 'react';
import { X } from 'lucide-react';
import '../styles/Actionmodal.css';

export default function ActionModal({ config, onClose, onConfirm }: any) {
    return (
        <div className="modal-overlay">
            <div className="action-modal">
                <button className="modal-top-close" onClick={onClose}><X size={20} /></button>
                <div className="modal-content">
                    <h2 className="modal-message">{config.message}</h2>
                    <div className="modal-actions">
                        {config.type === 'delete_confirm' ? (
                            <>
                                <button className="action-confirm" onClick={onConfirm}>예</button>
                                <span className="divider">|</span>
                                <button className="action-cancel" onClick={onClose}>아니요</button>
                            </>
                        ) : (
                            <button className="action-confirm" onClick={onConfirm}>확인</button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}