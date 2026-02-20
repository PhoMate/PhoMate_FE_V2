import React from 'react';
import { X, Trash2, Calendar, Image as ImageIcon } from 'lucide-react';
import '../styles/FolderModal.css';

interface FolderModalProps {
  folderName: string;
  photoCount?: number;
  createdAt?: string;
  onClose: () => void;
}

export default function FolderModal({ folderName, photoCount = 0, createdAt = "2026.02.20", onClose }: FolderModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="shared-modal-card" onClick={(e) => e.stopPropagation()}>
        
        {/* 헤더 섹션 (공유 폴더와 동일한 구조) */}
        <div className="modal-header">
          <div className="title-area">
            <h2 className="modal-title">폴더 설정</h2>
            <p className="text-link-btn" style={{ fontSize: '11px', color: '#64748b', textDecoration: 'none' }}>개인 보관함</p>
          </div>
          <button className="close-icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        {/* 1. 폴더 이름 수정 섹션 */}
        <div className="section-container">
          <label className="section-label">폴더 이름</label>
          <div className="invite-input-row" >
            <input type="text" defaultValue={folderName} className="modern-input" />
            <button className="copy-btn" style={{ minWidth: '60px' }}>변경</button>
          </div>
        </div>

        {/* 2. 폴더 정보 섹션 (공유 링크 대신 배치) */}
        <div className="section-container">
          <label className="section-label">폴더 정보 요약</label>
          <div className="link-copy-container" style={{ padding: '12px 16px' }}>
            <div className="member-info" style={{ width: '100%', justifyContent: 'space-around' }}>
              <div className="info-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ImageIcon size={16} style={{ color: '#1e3a8a' }} />
                <span style={{ fontSize: '13px', fontWeight: '600' }}>사진 {photoCount}장</span>
              </div>
              <div style={{ width: '1px', height: '14px', background: '#e2e8f0' }} />
              <div className="info-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={16} style={{ color: '#1e3a8a' }} />
                <span style={{ fontSize: '13px', fontWeight: '600' }}>{createdAt} 생성</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. 관리 옵션 섹션 (멤버 리스트 대신 배치) */}
        <div className="member-list-area">
          <label className="section-label">폴더 관리</label>
          <div className="member-item-card" style={{ cursor: 'pointer', border: '1px solid #fee2e2' }}>
            <div className="member-info">
              <div className="member-avatar" style={{ background: '#fef2f2', color: '#ef4444' }}>
                <Trash2 size={16} />
              </div>
              <div className="member-text">
                <span className="name" style={{ color: '#e11d48' }}>폴더 삭제하기</span>
                <span className="email">삭제 시 복구가 불가능합니다.</span>
              </div>
            </div>
          </div>
        </div>

        {/* 하단 푸터 버튼 */}
        <div className="modal-footer">
          <button className="save-btn" style={{ flex: 1 }} onClick={onClose}>설정 완료</button>
        </div>
      </div>
    </div>
  );
}