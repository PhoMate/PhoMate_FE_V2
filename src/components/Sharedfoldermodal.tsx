import React, { useState } from 'react';
import { X, Crown, Link, UserPlus, Trash2, Check, Copy } from 'lucide-react';
import '../styles/SharedFolderModal.css';

interface SharedFolderModalProps {
  folderName: string;
  onClose: () => void;
}

export default function SharedFolderModal({ folderName, onClose }: SharedFolderModalProps) {
  const [isCopied, setIsCopied] = useState(false);
  
  const members = [
    { id: 1, name: '황태운', email: 'twoon0402@gmail.com', role: 'owner' },
    { id: 2, name: '김나연', email: 'twoon040@gmail.com', role: 'viewer' },
  ];

  const handleCopyLink = () => {
    const link = "https://phomate.com/share/a1b2c3d4";
    navigator.clipboard.writeText(link);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="shared-modal-card" onClick={(e) => e.stopPropagation()}>
        
        {/* 헤더 섹션: 이름 수정 및 닫기 버튼 */}
        <div className="modal-header">
          <div className="title-area">
            <h2 className="modal-title">공유 폴더 설정</h2>
            <button className="text-link-btn">이름 수정</button>
          </div>
          <button className="close-icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        {/* 1. 멤버 초대 섹션 */}
        <div className="section-container">
          <label className="section-label">새 멤버 초대</label>
          <div className="invite-input-row">
            <input type="email" className="modern-input" placeholder="초대할 이메일 주소 입력" />
            <select className="role-dropdown">
              <option value="viewer">보기 전용</option>
              <option value="editor">편집 가능</option>
            </select>
            <button className="icon-action-btn primary"><UserPlus size={18} /></button>
          </div>
        </div>

        {/* 2. 링크 공유 섹션 (image_cad15d.png 스타일 재현) */}
        <div className="section-container">
          <label className="section-label">링크로 초대하기</label>
          <div className="link-copy-container">
            <div className="link-icon"><Link size={16} /></div>
            <input type="text" readOnly value="https://phomate.com/share/a1b2c3d4" className="link-input-readonly" />
            <button className={`copy-btn ${isCopied ? 'success' : ''}`} onClick={handleCopyLink}>
              {isCopied ? <Check size={16} /> : "복사"}
            </button>
          </div>
        </div>

        {/* 3. 참여 멤버 리스트 */}
        <div className="member-list-area">
          <label className="section-label">참여 중인 멤버 ({members.length})</label>
          <div className="member-scroll-box">
            {members.map((member) => (
              <div key={member.id} className="member-item-card">
                <div className="member-info">
                  <div className="member-avatar">{member.name[0]}</div>
                  <div className="member-text">
                    <div className="name-box">
                      <span className="name">{member.name}</span>
                      {member.role === 'owner' && <Crown size={12} className="crown-icon" />}
                    </div>
                    <span className="email">{member.email}</span>
                  </div>
                </div>
                
                <div className="member-actions">
                  {member.role === 'owner' ? (
                    <span className="owner-tag">방장</span>
                  ) : (
                    <div className="control-group">
                      {/* 1. 보기전용/편집가능 커스텀 버튼 */}
                      <div className="select-wrapper">
                        <select className="member-role-select">
                          <option value="viewer">보기 전용</option>
                          <option value="editor">편집 가능</option>
                        </select>
                      </div>
                      
                      {/* 2. 깔끔한 아이콘 기반 휴지통 버튼 */}
                      <button className="delete-member-btn" title="멤버 제외">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
              
        {/* 하단 푸터 버튼 */}
        <div className="modal-footer">
          <button className="quit-btn">폴더 나가기</button>
          <button className="save-btn" onClick={onClose}>설정 완료</button>
        </div>
      </div>
    </div>
  );
}