import React, { useState } from 'react';
import { X, Edit3, Undo, Redo, Save, Send } from 'lucide-react';
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
                {/* 1. 상단 탭 헤더 */}
                <div className="chatbot-header">
                    <div className="tabs">
                        <button 
                            className={`tab-btn ${activeTab === 'search' ? 'active' : ''}`} 
                            onClick={() => setActiveTab('search')}
                        >
                            검색
                        </button>
                        <button 
                            className={`tab-btn edit ${activeTab === 'edit' ? 'active' : ''}`} 
                            onClick={() => setActiveTab('edit')}
                        >
                            편집
                        </button>
                    </div>
                    <button className="panel-close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                {/* 2. 메인 바디 */}
                <div className="chatbot-body">
                    {activeTab === 'search' ? (
                        <div className="chat-view scroll-hide">
                            <div className="msg-bubble-bot">
                                사진에 대한 설명을 적어주세요.
                            </div>
                            <div className="msg-bubble-user">
                                작년 여름 제주도 바다 사진 찾아줘
                            </div>
                        </div>
                    ) : (
                        <div className="edit-view">
                            <div className="edit-preview-area">
                                <p className="preview-placeholder">편집할 이미지를 선택해주세요.</p>
                            </div>
                            {/* 편집 툴바 */}
                            <div className="edit-toolbar">
                                <button className="tool-btn"><Undo size={16} /></button>
                                <button className="tool-btn"><Redo size={16} /></button>
                                <button className="tool-btn direct-edit">
                                    <Edit3 size={14} /> 직접 편집
                                </button>
                            </div>
                            <button className="save-finish-btn">
                                <Save size={16} /> 저장 및 종료
                            </button>
                        </div>
                    )}
                </div>

                {/* 3. 하단 입력창 */}
                <div className="chatbot-footer">
                    <div className="input-field-pill">
                        <input type="text" placeholder="메시지를 입력하세요..." className="chat-input" />
                        <button className="chat-send-btn">전송</button>
                    </div>
                </div>
            </div>
        </aside>
    );
}