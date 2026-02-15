import React, { useState } from 'react';
import { X, Edit3, Undo, Redo, Save } from 'lucide-react';
import '../styles/Chatbot.css';

export default function Chatbot({ isOpen, onClose, onOpen }: any) {
    const [activeTab, setActiveTab] = useState<'search' | 'edit'>('search');

    if (!isOpen) {
        return (
            <button className="chatbot-open-trigger" onClick={onOpen}>
                챗봇 열기
            </button>
        );
    }

    return (
        <aside className="chatbot-container">
            <div className="chatbot-window">
                {/* 상단 헤더 및 탭 섹션 */}
                <div className="chatbot-header">
                    <div className="tabs">
                        <button 
                            className={`tab ${activeTab === 'search' ? 'active' : ''}`} 
                            onClick={() => setActiveTab('search')}
                        >
                            검색
                        </button>
                        <button 
                            className={`tab edit ${activeTab === 'edit' ? 'active' : ''}`} 
                            onClick={() => setActiveTab('edit')}
                        >
                            편집
                        </button>
                    </div>
                    <button className="panel-close-btn" onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', marginBottom: '10px' }}>
                        <X size={20} />
                    </button>
                </div>

                {/* 메인 컨텐츠 섹션 */}
                <div className="chatbot-body">
                    {activeTab === 'search' ? (
                        <div className="chat-view">
                            <div className="msg-bot" style={{ background: '#f0f2f5', padding: '10px 15px', borderRadius: '15px', marginBottom: '10px', fontSize: '14px', width: 'fit-content' }}>
                                사진에 대한 설명을 적어주세요.
                            </div>
                            <div className="msg-user" style={{ background: '#8e9db7', color: 'white', padding: '10px 15px', borderRadius: '15px', marginLeft: 'auto', fontSize: '14px', width: 'fit-content' }}>
                                사진 설명
                            </div>
                        </div>
                    ) : (
                        <div className="edit-view">
                            <div className="edit-preview">
                                <div className="empty-preview" style={{ color: '#888', textAlign: 'center', paddingTop: '40px' }}>
                                    편집할 이미지를 선택해주세요.
                                </div>
                            </div>
                            <div className="edit-toolbar" style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
                                <button style={{ flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: '8px', background: 'white', cursor: 'pointer' }}><Undo size={16} /></button>
                                <button style={{ flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: '8px', background: 'white', cursor: 'pointer' }}><Redo size={16} /></button>
                                <button style={{ flex: 2, padding: '8px', border: '1px solid #ddd', borderRadius: '8px', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                                    <Edit3 size={14} /> 직접 편집
                                </button>
                            </div>
                            <button className="finalize-btn" style={{ width: '100%', padding: '12px', background: '#003366', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                <Save size={16} /> 저장 및 종료
                            </button>
                        </div>
                    )}
                </div>

                {/* 하단 입력 섹션 */}
                <div className="chatbot-footer">
                    <div className="input-pill">
                        <input type="text" placeholder="메시지를 입력하세요..." style={{ flex: 1, border: 'none', outline: 'none' }} />
                        <button className="pill-send-btn" style={{ background: 'none', border: 'none', color: '#003366', fontWeight: 'bold', cursor: 'pointer' }}>
                            전송
                        </button>
                    </div>
                </div>
            </div>
        </aside>
    );
}