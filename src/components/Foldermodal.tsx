import React from 'react';
import { X, Trash2, Calendar, Image as ImageIcon } from 'lucide-react';
import '../styles/FolderModal.css';

interface FolderModalProps {
  folderName: string;
  photoCount?: number;
  createdAt?: string;
  onClose: () => void;
}

export default function FolderModal({ folderName, photoCount = 0, createdAt = "2026.02.19", onClose }: FolderModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="folder-setting-modal" onClick={(e) => e.stopPropagation()}>
        
        {/* 상단 제목 영역 */}
        <div className="shared-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <h2 className="shared-modal-title" style={{ fontSize: '24px', fontWeight: '700' }}>폴더 설정</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}><X size={24} /></button>
        </div>
        
        {/* 1. 폴더 이름 섹션 (기존 input-group 유지) */}
        <div className="modal-section">
          <div className="input-group">
            <span className="label-text">폴더 이름 |</span>
            <input type="text" defaultValue={folderName} className="modal-input" />
            <button className="confirm-btn">변경</button>
          </div>
        </div>

        {/* 2. 폴더 정보 섹션 (멤버 리스트 대신 배치) */}
        <div className="member-list-container" style={{ gap: '10px' }}>
          <span className="label-text" style={{ fontSize: '18px', marginBottom: '5px' }}>폴더 정보</span>
          
          <div className="member-item">
            <div className="member-info">
              <div className="member-avatar" style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', padding: '8px', color: 'white' }}><ImageIcon size={18} /></div>
              <div className="member-details">
                <span className="member-name">보관된 사진</span>
                <span className="member-email">{photoCount}장</span>
              </div>
            </div>
          </div>

          <div className="member-item">
            <div className="member-info">
              <div className="member-avatar" style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', padding: '8px', color: 'white' }}><Calendar size={18} /></div>
              <div className="member-details">
                <span className="member-name">생성일</span>
                <span className="member-email">{createdAt}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 하단 버튼 섹션: 삭제와 확인 */}
        <div style={{ display: 'flex', gap: '15px', marginTop: '40px' }}>
          <button className="member-item" style={{ flex: 1, justifyContent: 'center', border: '1px solid #ff4d4f', color: '#ff4d4f', cursor: 'pointer' }}>
            <Trash2 size={16} style={{ marginRight: '8px' }} /> 폴더 삭제
          </button>
          <button className="modal-final-confirm" style={{ flex: 2, marginTop: 0, background: '#003366', color: 'white', borderRadius: '15px' }} onClick={onClose}>
            설정 완료
          </button>
        </div>

      </div>
    </div>
  );
}