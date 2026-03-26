import React, { useEffect, useState } from 'react';
import { X, Trash2, Calendar, Image as ImageIcon, HardDrive, Sparkles, Loader2 } from 'lucide-react';
import ActionModal from './Actionmodal';
// 파일명을 chat.ts로 반영하여 수정했습니다.
import { previewAutoFolder, ChatFolderPreviewPhoto } from '../api/chat'; 
import '../styles/FolderModal.css';

interface FolderModalProps {
  mode?: 'create' | 'settings';
  chatSessionId?: number; // AI 기능을 위해 추가
  folderName: string;
  photoCount?: number;
  createdAt?: string;
  usedStorage?: string;
  // AI 생성 시 사진 ID 목록을 함께 넘길 수 있도록 수정
  onSave?: (name: string, photoIds?: number[]) => boolean | void | Promise<boolean | void>;
  onDelete?: () => void | Promise<void>;
  onClose: () => void;
}

export default function FolderModal({ 
  mode = 'settings', 
  chatSessionId,
  folderName, 
  photoCount = 0, 
  createdAt = "2026.02.20", 
  usedStorage = '0 MB', 
  onSave, 
  onDelete, 
  onClose 
}: FolderModalProps) {
  const [inputName, setInputName] = useState(folderName);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // --- AI 자동 생성 상태 변수 추가 ---
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiPhotos, setAiPhotos] = useState<ChatFolderPreviewPhoto[]>([]);
  const [isAiSuggested, setIsAiSuggested] = useState(false);

  useEffect(() => {
    setInputName(folderName);
  }, [folderName, mode]);

  // --- AI 분석 실행 함수 추가 ---
  const handleAiAnalysis = async () => {
    if (!chatSessionId || !inputName.trim()) return;
    
    setIsAiLoading(true);
    try {
      const response = await previewAutoFolder({
        chatSessionId,
        userText: inputName
      });
      setInputName(response.suggestedFolderName); // 추천 이름 적용
      setAiPhotos(response.photos);               // 사진 목록 저장
      setIsAiSuggested(true);                     // AI 모드 전환
    } catch (error) {
      console.error("AI 분석 실패:", error);
      alert("AI 사진 분석 중 오류가 발생했습니다.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSave = async () => {
    // AI 제안 사진이 있다면 해당 ID 목록을 전달
    const photoIds = aiPhotos.length > 0 ? aiPhotos.map(p => p.photoId) : undefined;
    const result = await Promise.resolve(onSave?.(inputName, photoIds));
    if (result === false) return;
    onClose();
  };

  const handleDelete = () => {
    setIsDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    await Promise.resolve(onDelete?.());
    setIsDeleteConfirmOpen(false);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="shared-modal-card" onClick={(e) => e.stopPropagation()}>
        
        <div className="modal-header">
          <div className="title-area">
            <h2 className="modal-title">
              {/* AI 모드일 때 제목 업데이트 */}
              {isAiSuggested ? (
                <><Sparkles size={18} style={{color: '#7c3aed', marginRight: '4px', display: 'inline'}} /> AI 폴더 생성</>
              ) : (
                mode === 'create' ? '폴더 생성' : `${folderName} 설정`
              )}
            </h2>
            <p className="text-link-btn" style={{ fontSize: '16px', color: '#64748b', textDecoration: 'none' }}>개인 보관함</p>
          </div>
          <button className="close-icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="section-container">
          <label className="section-label">{isAiSuggested ? "AI 추천 폴더 이름" : "폴더 이름"}</label>
          <div className="invite-input-row" >
            <input
              type="text"
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              className="modern-input"
              placeholder={mode === 'create' ? "예: 어제 찍은 강아지 사진 찾아줘" : "폴더 이름을 입력하세요"}
            />
            {/* 생성 모드이고 AI 분석 전이면 'AI 분석' 버튼 노출 */}
            {mode === 'create' && !isAiSuggested ? (
              <button 
                className="copy-btn" 
                style={{ minWidth: '85px', background: '#7c3aed', color: 'white' }} 
                onClick={handleAiAnalysis} 
                disabled={isAiLoading}
              >
                {isAiLoading ? <Loader2 size={16} className="animate-spin" /> : 'AI 분석'}
              </button>
            ) : (
              <button className="copy-btn" style={{ minWidth: '60px' }} onClick={handleSave}>
                {mode === 'create' ? '생성' : '변경'}
              </button>
            )}
          </div>
        </div>

        {/* --- AI가 분석한 사진 미리보기 영역 (추가) --- */}
        {isAiSuggested && aiPhotos.length > 0 && (
          <div className="section-container" style={{ marginTop: '16px' }}>
            <label className="section-label">분석된 사진 ({aiPhotos.length}장)</label>
            <div style={{ 
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', 
              maxHeight: '180px', overflowY: 'auto', padding: '12px', background: '#f8fafc', borderRadius: '12px' 
            }}>
              {aiPhotos.map(photo => (
                <img 
                  key={photo.photoId} 
                  src={photo.previewUrl} 
                  alt="preview" 
                  style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: '6px' }} 
                />
              ))}
            </div>
          </div>
        )}

        {mode === 'settings' && (
          <>
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
                  <div style={{ width: '1px', height: '14px', background: '#e2e8f0' }} />
                  <div className="info-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <HardDrive size={16} style={{ color: '#1e3a8a' }} />
                    <span style={{ fontSize: '13px', fontWeight: '600' }}>사진 용량 {usedStorage}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="member-list-area">
              <label className="section-label">폴더 관리</label>
              <div className="member-item-card folder-delete-card" style={{ cursor: 'pointer', border: '1px solid #fee2e2' }} onClick={handleDelete}>
                <div className="member-info">
                  <div className="member-avatar folder-delete-avatar" style={{ background: '#fef2f2', color: '#ef4444' }}>
                    <Trash2 size={16} />
                  </div>
                  <div className="member-text">
                    <span className="name" style={{ color: '#e11d48' }}>폴더 삭제하기</span>
                    <span className="email">삭제 시 복구가 불가능합니다.</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="modal-footer">
          <button 
            className="save-btn" 
            style={{ flex: 1, background: isAiSuggested ? '#7c3aed' : '' }} 
            onClick={handleSave}
          >
            {isAiSuggested ? '이 사진들로 폴더 생성' : mode === 'create' ? '폴더 생성' : '설정 완료'}
          </button>
        </div>

        {isDeleteConfirmOpen && (
          <ActionModal
            config={{
              type: 'delete_confirm',
              message: `'${folderName}' 폴더를 삭제하시겠습니까?\n삭제 후 복구할 수 없습니다.`,
            }}
            onClose={() => setIsDeleteConfirmOpen(false)}
            onConfirm={handleConfirmDelete}
          />
        )}
      </div>
    </div>
  );
}