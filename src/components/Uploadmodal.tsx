import React from 'react';
import { X, UploadCloud } from 'lucide-react';
import '../styles/UploadModal.css';

export default function UploadModal({ onClose, onStart }: any) {
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="upload-modal" onClick={(e) => e.stopPropagation()}>
                <button className="modal-top-close" onClick={onClose}><X size={20} /></button>
                <div className="upload-modal-content">
                    <UploadCloud size={48} color="#003366" />
                    <h2>새로운 사진 업로드</h2>
                    <p>기기에 있는 사진을 선택하거나 드래그하세요.</p>
                    <div className="upload-dropzone">
                        <input type="file" id="file-input" hidden />
                        <label htmlFor="file-input" className="file-label">파일 선택</label>
                    </div>
                    <button className="upload-start-btn" onClick={onStart}>업로드 시작</button>
                </div>
            </div>
        </div>
    );
}