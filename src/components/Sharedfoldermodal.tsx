import React, { useEffect, useState } from 'react';
import { X, Crown, Link, UserPlus, Trash2, Check } from 'lucide-react';
import ActionModal from './Actionmodal';
import '../styles/SharedFolderModal.css';

interface SharedFolderModalProps {
  mode?: 'create' | 'settings';
  folderName: string;
  onSave: (nextName: string) => void;
  onLeave?: () => void;
  onClose: () => void;
}

type Member = {
  id: number;
  name: string;
  email: string;
  role: 'owner' | 'viewer' | 'editor';
};

export default function SharedFolderModal({ mode = 'settings', folderName, onSave, onLeave, onClose }: SharedFolderModalProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [inputName, setInputName] = useState(folderName);
  const [kickTarget, setKickTarget] = useState<Member | null>(null);
  const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([
    { id: 1, name: '황태운', email: 'twoon0402@gmail.com', role: 'owner' },
    { id: 2, name: '김나연', email: 'twoon040@gmail.com', role: 'viewer' },
  ]);

  useEffect(() => {
    setInputName(folderName);
  }, [folderName, mode]);

  const handleCopyLink = () => {
    const link = "https://phomate.com/share/a1b2c3d4";
    navigator.clipboard.writeText(link);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleSave = () => {
    const trimmed = inputName.trim();
    if (!trimmed) return;
    onSave(trimmed);
    onClose();
  };

  const handleKickMember = (member: Member) => {
    setKickTarget(member);
  };

  const handleConfirmKickMember = () => {
    if (!kickTarget) return;
    setMembers((prev) => prev.filter((item) => item.id !== kickTarget.id));
    setKickTarget(null);
  };

  const handleLeaveFolder = () => {
    setIsLeaveConfirmOpen(true);
  };

  const handleConfirmLeaveFolder = () => {
    onLeave?.();
    setIsLeaveConfirmOpen(false);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="shared-modal-card" onClick={(e) => e.stopPropagation()}>
        
        {/* 헤더 섹션: 이름 수정 및 닫기 버튼 */}
        <div className="modal-header">
          <div className="title-area">
            <h2 className="modal-title">{mode === 'create' ? '공유 폴더 생성' : '공유 폴더 설정'}</h2>
            <button className="text-link-btn">{mode === 'create' ? '공유 보관함' : folderName}</button>
          </div>
          <button className="close-icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="section-container">
          <label className="section-label">공유 폴더 이름</label>
          <div className="invite-input-row">
            <input
              type="text"
              className="modern-input"
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              placeholder="공유 폴더 이름"
            />
          </div>
        </div>

        {mode === 'settings' && (
          <>
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
                          <div className="select-wrapper">
                            <select className="member-role-select">
                              <option value="viewer">보기 전용</option>
                              <option value="editor">편집 가능</option>
                            </select>
                          </div>
                          
                          <button className="delete-member-btn" title="멤버 제외" onClick={() => handleKickMember(member)}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
              
        {/* 하단 푸터 버튼 */}
        <div className="modal-footer">
          {mode === 'settings' && <button className="quit-btn" onClick={handleLeaveFolder}>폴더 나가기</button>}
          <button className="save-btn" onClick={handleSave}>{mode === 'create' ? '폴더 생성' : '설정 완료'}</button>
        </div>

        {kickTarget && (
          <ActionModal
            config={{
              type: 'delete_confirm',
              message: `${kickTarget.name}님을 공유 폴더에서\n내보내시겠습니까?`,
            }}
            onClose={() => setKickTarget(null)}
            onConfirm={handleConfirmKickMember}
          />
        )}

        {isLeaveConfirmOpen && (
          <ActionModal
            config={{
              type: 'delete_confirm',
              message: `'${folderName}' 에서 나가시겠습니까?\n나가면 다시 초대받아야 접근할 수 있습니다.`,
            }}
            onClose={() => setIsLeaveConfirmOpen(false)}
            onConfirm={handleConfirmLeaveFolder}
          />
        )}
      </div>
    </div>
  );
}