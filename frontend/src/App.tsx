import React, { useState, useRef } from 'react';
import axios from 'axios';
import { 
  UploadCloud, 
  Send, 
  FileText, 
  ChevronRight,
  Search,
  MessageSquare,
  BarChart3,
  ShieldCheck,
  Zap,
  Star,
  ExternalLink,
  ChevronLeft,
  Database,
  Globe,
  Sparkles,
  Activity,
  CheckCircle2,
  FolderOpen,
  PieChart,
  TrendingUp,
  Download,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Paperclip
} from 'lucide-react';

const API_BASE_URL = 'http://localhost:8000/api';

/* ─── TYPES ─── */
interface Source { file: string; page: number | string; }
interface ChatMessage {
  id: string; role: 'user' | 'agent'; content: string;
  citations_text?: string;
  agent_used?: string; sources?: Source[]; confidence?: number; entities?: any[]; timestamp: Date;
}
interface UploadedFile { name: string; size: string; status: 'processing' | 'ready' | 'error'; type?: string; }
interface ChatSession { id: string; title: string; messages: ChatMessage[]; files: UploadedFile[]; timestamp: Date; }

function App() {
  const [showDashboard, setShowDashboard] = useState(false);
  const [dashboardStep, setDashboardStep] = useState<'QUERY' | 'ANALYTICS'>('QUERY');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [query, setQuery] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [activeMessage, setActiveMessage] = useState<ChatMessage | null>(null);
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const [previewPage, setPreviewPage] = useState<number | string>(1);
  const [repoMode, setRepoMode] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  /* ─── NAVIGATION ─── */
  const scrollTo = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const y = element.getBoundingClientRect().top + window.pageYOffset - 80;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  /* ─── HANDLERS ─── */
  const handleQuery = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim() || isQuerying) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: query, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    const currentInput = query;
    setQuery('');
    setIsQuerying(true);
    try {
      const activeFile = files[files.length - 1]?.name;
      const url = activeFile && !repoMode
        ? `${API_BASE_URL}/query?query=${encodeURIComponent(currentInput)}&file_name=${encodeURIComponent(activeFile)}`
        : `${API_BASE_URL}/query?query=${encodeURIComponent(currentInput)}`;
        
      const resp = await axios.post(url);
      const msg: ChatMessage = {
        id: Date.now().toString(), role: 'agent', content: resp.data.answer,
        citations_text: resp.data.citations_text,
        sources: resp.data.sources, confidence: resp.data.confidence, 
        entities: resp.data.entities,
        agent_used: resp.data.agent_used || 'General Agent', timestamp: new Date()
      };
      setMessages(prev => [...prev, msg]);
      setActiveMessage(msg);
    } catch {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'agent', content: 'Connection Error. Please ensure backend is running.', timestamp: new Date() }]);
    } finally { setIsQuerying(false); }
  };

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: 'New Conversation',
      messages: [],
      files: [],
      timestamp: new Date()
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setMessages([]);
    setFiles([]);
    setDashboardStep('QUERY');
  };

  const switchSession = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setActiveSessionId(sessionId);
      setMessages(session.messages);
      setFiles(session.files || []);
      setDashboardStep('QUERY');
    }
  };

  // Sync messages to active session
  React.useEffect(() => {
    if (activeSessionId) {
      setSessions(prev => prev.map(s => 
        // Only auto-update title if it's currently a default generic title
        s.id === activeSessionId ? { ...s, messages, files, title: s.title === 'New Conversation' && messages.length > 0 ? messages[0].content.substring(0, 30) + (messages[0].content.length > 30 ? '...' : '') : s.title } : s
      ));
    } else if (messages.length > 0 && !activeSessionId) {
        // Create session if it doesn't exist but we have messages
        const newId = Date.now().toString();
        const generatedTitle = messages[0].content.substring(0, 30) + (messages[0].content.length > 30 ? '...' : '');
        setSessions([{ id: newId, title: generatedTitle, messages, files, timestamp: new Date() }]);
        setActiveSessionId(newId);
    }
  }, [messages, files]);

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) {
      setActiveSessionId(null);
      setMessages([]);
      setFiles([]);
    }
  };

  const startRename = (e: React.MouseEvent, id: string, currentTitle: string) => {
    e.stopPropagation();
    setEditingSessionId(id);
    setEditingTitle(currentTitle);
  };

  const saveRename = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (editingTitle.trim()) {
      setSessions(prev => prev.map(s => s.id === id ? { ...s, title: editingTitle.trim() } : s));
    }
    setEditingSessionId(null);
  };

  const cancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(null);
  };

  const downloadBriefing = async () => {
    if (!activeMessage) return;
    try {
      const response = await axios.post(`${API_BASE_URL}/export`, {
        content: activeMessage.content,
        filename: 'executive_briefing.pdf'
      }, { responseType: 'blob' });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Executive_Briefing.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Export failed", err);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const uploaded = Array.from(e.target.files);
    
    for (const file of uploaded) {
      const newFile: UploadedFile = { name: file.name, size: (file.size/1024).toFixed(1)+'KB', status: 'processing', type: file.type };
      setFiles(prev => [...prev, newFile]);
      
      const fd = new FormData(); fd.append('file', file);
      try {
        await axios.post(`${API_BASE_URL}/upload`, fd);
        setFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'ready' } : f));
      } catch {
        setFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'error' } : f));
      }
    }
  };

  const handleLogin = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(loginEmail)) {
      setLoginError('Please enter a valid corporate email address.');
      return;
    }
    if (loginPassword.length < 6) {
      setLoginError('Password must be at least 6 characters.');
      return;
    }
    setLoginError('');
    setShowDashboard(true);
  };

  if (showDashboard) {
    return (
      <div className="dashboard">
        <aside className="sidebar">
          <div style={{ marginBottom: '3rem' }}>
            <div className="nav-logo" onClick={() => setShowDashboard(false)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
               <Zap color="#2563eb" fill="#2563eb" /> <span style={{ fontWeight: 900, letterSpacing: '-1px', fontSize: '1.2rem' }}>DocuMind</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
             <button 
               className={`nav-link ${dashboardStep === 'QUERY' ? 'active' : ''}`} 
               onClick={() => setDashboardStep('QUERY')}
               style={{ padding: '0.75rem 1rem', borderRadius: '10px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px', background: dashboardStep === 'QUERY' ? '#eff6ff' : 'transparent', color: dashboardStep === 'QUERY' ? '#2563eb' : '#64748b' }}
             >
               <MessageSquare size={18} /> Query
             </button>
             <button 
               className={`nav-link ${dashboardStep === 'ANALYTICS' ? 'active' : ''}`} 
               onClick={() => setDashboardStep('ANALYTICS')} 
               style={{ padding: '0.75rem 1rem', borderRadius: '10px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px', background: dashboardStep === 'ANALYTICS' ? '#eff6ff' : 'transparent', color: dashboardStep === 'ANALYTICS' ? '#2563eb' : '#64748b' }}
             >
               <BarChart3 size={18} /> Analytics
             </button>
          </div>

          <div style={{ marginTop: '2rem', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <h4 style={{ fontSize: '10px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem', paddingLeft: '1rem' }}>Chat History</h4>
            <button 
              onClick={createNewSession}
              style={{ margin: '0 10px 10px', padding: '10px', borderRadius: '12px', border: '1px dashed #cbd5e1', background: 'white', color: '#2563eb', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
            >
              <Plus size={14} /> New Chat
            </button>
            {sessions.map(s => (
              <div
                key={s.id}
                onClick={() => switchSession(s.id)}
                style={{ 
                  padding: '10px 1rem', 
                  borderRadius: '10px', 
                  fontSize: '12px',
                  background: activeSessionId === s.id ? '#f1f5f9' : 'transparent',
                  color: activeSessionId === s.id ? '#1e293b' : '#64748b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  const actions = e.currentTarget.querySelector('.session-actions') as HTMLElement;
                  if (actions) actions.style.opacity = '1';
                }}
                onMouseLeave={(e) => {
                  const actions = e.currentTarget.querySelector('.session-actions') as HTMLElement;
                  if (actions) actions.style.opacity = '0';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden', flex: 1 }}>
                  <MessageSquare size={14} opacity={0.5} style={{ flexShrink: 0 }} />
                  {editingSessionId === s.id ? (
                    <input
                      value={editingTitle}
                      onChange={e => setEditingTitle(e.target.value)}
                      onClick={e => e.stopPropagation()}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveRename(e as any, s.id);
                        if (e.key === 'Escape') cancelRename(e as any);
                      }}
                      autoFocus
                      style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '2px 4px', fontSize: '12px', width: '100%', outline: 'none' }}
                    />
                  ) : (
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.title}
                    </span>
                  )}
                </div>

                {editingSessionId === s.id ? (
                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    <button onClick={(e) => saveRename(e, s.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#10b981', padding: '2px' }}><Check size={14} /></button>
                    <button onClick={cancelRename} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444', padding: '2px' }}><X size={14} /></button>
                  </div>
                ) : (
                  <div className="session-actions" style={{ display: 'flex', gap: '4px', opacity: 0, transition: 'opacity 0.2s', flexShrink: 0 }}>
                    <button onClick={(e) => startRename(e, s.id, s.title)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b', padding: '2px' }}><Edit2 size={14} /></button>
                    <button onClick={(e) => deleteSession(e, s.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444', padding: '2px' }}><Trash2 size={14} /></button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <button className="nav-link" onClick={() => setShowDashboard(false)} style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', border: 'none', background: 'transparent', cursor: 'pointer' }}>
            <ChevronLeft size={18} /> Exit Portal
          </button>
        </aside>

        <main className="workspace" style={{ background: '#f8fafc' }}>
          <header className="ws-header" style={{ padding: '1.5rem 3rem', background: 'white', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
               <div style={{ width: '8px', height: '8px', background: '#22c55e', borderRadius: '50%', boxShadow: '0 0 10px #22c55e' }}></div>
               <h3 style={{ textTransform: 'uppercase', fontSize: '11px', letterSpacing: '2px', fontWeight: '900', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                 Enterprise Session <ChevronRight size={10} /> 
                 <span style={{ color: '#2563eb', background: '#eff6ff', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer' }} onClick={() => setDashboardStep(dashboardStep)}>
                   {dashboardStep}
                 </span>
               </h3>
            </div>
            {dashboardStep === 'QUERY' && messages.length > 0 && (
               <button className="btn btn-primary" onClick={() => setDashboardStep('ANALYTICS')}>
                 View Analytics <ChevronRight size={16} />
               </button>
            )}
          </header>

          <div style={{ flex: 1, overflowY: 'auto', padding: '3rem' }}>
            <div className="container" style={{ maxWidth: dashboardStep === 'QUERY' && previewFile ? '1400px' : '900px', transition: 'max-width 0.4s ease' }}>
              <div className="dashboard-content">
              {/* ── STEP 1: QUERY ── */}
              {dashboardStep === 'QUERY' && (
                <div style={{ display: 'flex', gap: '2rem', minHeight: '100%', position: 'relative' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '120px' }}>
                    <div className="section-header" style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                      <div>
                        <p className="badge">Phase 02</p>
                        <h2 style={{ fontSize: '2.5rem' }}>Ask Your Question</h2>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'white', padding: '8px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', cursor: 'pointer' }} onClick={() => setRepoMode(!repoMode)}>
                        <Database size={18} color={repoMode ? '#2563eb' : '#64748b'} />
                        <span style={{ fontSize: '11px', fontWeight: '800', color: repoMode ? '#1e293b' : '#64748b' }}>REPOSITORY SYNTHESIS</span>
                        <div style={{ width: '40px', height: '22px', background: repoMode ? '#2563eb' : '#e2e8f0', borderRadius: '11px', position: 'relative', transition: 'all 0.3s' }}>
                           <div style={{ width: '16px', height: '16px', background: 'white', borderRadius: '50%', position: 'absolute', top: '3px', left: repoMode ? '21px' : '3px', transition: 'all 0.3s' }}></div>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                      {messages.map((m, i) => (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                          <div style={{ fontSize: '10px', fontWeight: '900', color: '#94a3b8', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                              {m.role === 'user' ? 'Identity: Client' : 'Identity: DocuMind Agent'}
                          </div>
                          <div style={{ 
                            background: m.role === 'user' ? '#2563eb' : 'white', 
                            color: m.role === 'user' ? 'white' : '#1e293b', 
                            padding: '1.5rem 2rem', 
                            borderRadius: '24px', 
                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                            border: m.role === 'user' ? 'none' : '1px solid #e2e8f0',
                            borderTopLeftRadius: m.role === 'user' ? '24px' : '4px',
                            borderTopRightRadius: m.role === 'user' ? '4px' : '24px',
                            maxWidth: '85%'
                          }}>
                              <p style={{ fontSize: '17px', fontWeight: '500', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                                {m.content || "Thinking... (The specialist agent is analyzing the source context)"}
                              </p>
                              {m.citations_text && (
                                <div style={{ 
                                  marginTop: '1.5rem', 
                                  padding: '1rem', 
                                  background: '#f8fafc', 
                                  borderRadius: '12px', 
                                  border: '1px solid #e2e8f0',
                                  fontSize: '13px',
                                  color: '#64748b',
                                  whiteSpace: 'pre-wrap'
                                }}>
                                  {m.citations_text}
                                </div>
                              )}
                              {m.sources && m.sources.length > 0 && (
                                <div style={{ marginTop: '1.25rem', display: 'flex', flexWrap: 'wrap', gap: '0.6rem', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '1rem' }}>
                                  {m.sources.map((src, j) => (
                                    <button 
                                      key={j} 
                                      className="btn" 
                                      onClick={() => { setPreviewFile(src.file); setPreviewPage(src.page); }}
                                      style={{ padding: '6px 14px', fontSize: '11px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#2563eb', fontWeight: '800', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}
                                    >
                                        <FileText size={12} />
                                        {src.file} (P. {src.page})
                                    </button>
                                  ))}
                                </div>
                              )}
                              {m.agent_used && m.role === 'agent' && (
                                <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                  <span style={{ fontSize: '9px', fontWeight: '900', padding: '4px 8px', background: '#f1f5f9', borderRadius: '6px', color: '#64748b', letterSpacing: '0.5px' }}>
                                    ROUTING: {m.agent_used.toUpperCase()}
                                  </span>
                                  {m.confidence && <span style={{ fontSize: '9px', fontWeight: '900', color: m.confidence > 0.8 ? '#10b981' : '#f59e0b' }}>CONFIDENCE: {(m.confidence * 100).toFixed(0)}%</span>}
                                </div>
                              )}
                          </div>
                        </div>
                      ))}

                      {isQuerying && (
                        <div style={{ alignSelf: 'flex-start', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <div style={{ fontSize: '10px', fontWeight: '900', color: '#2563eb', textTransform: 'uppercase', letterSpacing: '1px' }}>Agent is analyzing...</div>
                          <div style={{ background: 'white', padding: '1rem 1.5rem', borderRadius: '24px', border: '1px solid #e2e8f0', display: 'flex', gap: '6px' }}>
                              <span className="animate-bounce" style={{ width: '8px', height: '8px', background: '#2563eb', borderRadius: '50%' }}></span>
                              <span className="animate-bounce" style={{ width: '8px', height: '8px', background: '#2563eb', borderRadius: '50%', animationDelay: '0.2s' }}></span>
                              <span className="animate-bounce" style={{ width: '8px', height: '8px', background: '#2563eb', borderRadius: '50%', animationDelay: '0.4s' }}></span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div ref={chatEndRef} />

                    <div style={{ position: 'sticky', bottom: '0', padding: '2rem 0', background: 'transparent', zIndex: 10 }}>
                       <form onSubmit={handleQuery} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'white', padding: '12px', borderRadius: '30px', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
                          {files.length > 0 && (
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', padding: '0 10px' }}>
                              {files.map((f, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', padding: '6px 12px', borderRadius: '15px', fontSize: '12px', fontWeight: 'bold', color: f.status === 'ready' ? '#10b981' : (f.status === 'error' ? '#ef4444' : '#64748b') }}>
                                  <FileText size={12} />
                                  <span>{f.name.substring(0, 20)}{f.name.length > 20 ? '...' : ''}</span>
                                  {f.status === 'processing' && <span className="animate-pulse">...</span>}
                                </div>
                              ))}
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <button type="button" onClick={() => fileInputRef.current?.click()} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', flexShrink: 0 }}>
                              <Paperclip size={20} />
                            </button>
                            <input type="file" ref={fileInputRef} onChange={handleUpload} className="hidden" accept=".pdf" multiple style={{ display: 'none' }} />
                            <input 
                              className="form-control" 
                              style={{ border: 'none', background: 'transparent', fontSize: '18px', paddingLeft: '0.5rem', width: '100%' }} 
                              placeholder="Interrogate your documents..." 
                              value={query} 
                              onChange={e => setQuery(e.target.value)} 
                            />
                            <button className="btn btn-primary" type="submit" disabled={isQuerying} style={{ width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}>
                              {isQuerying ? <TrendingUp className="animate-pulse" /> : <Send size={24} />}
                            </button>
                          </div>
                       </form>
                    </div>
                  </div>

                  {/* SIDE PREVIEWER PANEL */}
                  {previewFile && (
                    <div style={{ 
                      width: '600px', 
                      background: 'white', 
                      borderLeft: '1px solid #e2e8f0', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      height: 'calc(100vh - 150px)', 
                      position: 'sticky', 
                      top: '0', 
                      borderRadius: '30px', 
                      overflow: 'hidden', 
                      boxShadow: '-20px 0 40px rgba(0,0,0,0.05)',
                      marginTop: '2rem'
                    }}>
                       <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                          <div>
                            <p style={{ fontSize: '9px', fontWeight: '900', color: '#2563eb', letterSpacing: '2px' }}>SOURCE VERIFICATION</p>
                            <h4 style={{ fontSize: '14px', margin: 0, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '350px' }}>{previewFile}</h4>
                          </div>
                          <button 
                            onClick={() => setPreviewFile(null)} 
                            className="btn"
                            style={{ padding: '10px 15px', background: '#fee2e2', color: '#ef4444', borderRadius: '12px', fontWeight: '800', fontSize: '12px' }}
                          >
                            Close
                          </button>
                       </div>
                       <iframe 
                         src={`http://localhost:8000/files/${previewFile}#page=${previewPage}`} 
                         style={{ flex: 1, border: 'none' }}
                         title="PDF Preview"
                       />
                    </div>
                  )}
                </div>
              )}

              {/* ── STEP 3: ANALYTICS ── */}
              {dashboardStep === 'ANALYTICS' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem', maxWidth: '1000px', margin: '0 auto' }}>
                   <div className="section-header" style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <p className="badge" style={{ color: '#2563eb' }}>Phase 03</p>
                        <h2 style={{ fontSize: '2.5rem' }}>Human-Centric Insights</h2>
                      </div>
                      <button className="btn btn-primary" onClick={downloadBriefing} style={{ padding: '0.8rem 2.5rem', background: '#0f172a' }}>
                        <Download size={18} /> Export Executive Brief
                      </button>
                   </div>
                   <p>A human-friendly breakdown of how the DocuMind agents processed your documents.</p>

                   {/* TOP METRICS: USER FRIENDLY */}
                   <div className="grid-3">
                      <div className="card" style={{ textAlign: 'center', borderTop: '4px solid #10b981', background: 'white', padding: '2.5rem' }}>
                         <ShieldCheck color="#10b981" size={40} style={{ marginBottom: '1.5rem' }} />
                         <p style={{ fontSize: '12px', fontWeight: '900', color: '#64748b', letterSpacing: '1px' }}>RELIABILITY</p>
                         <h3 style={{ fontSize: '2rem', margin: '1rem 0', color: '#1e293b' }}>
                            {activeMessage?.confidence && activeMessage.confidence > 0.6 ? 'High Certainty' : 'Verified Output'}
                         </h3>
                         <p style={{ fontSize: '11px', color: '#94a3b8' }}>Grounded in source citations</p>
                      </div>
                      <div className="card" style={{ textAlign: 'center', borderTop: '4px solid #2563eb', background: 'white', padding: '2.5rem' }}>
                         <Zap color="#2563eb" size={40} style={{ marginBottom: '1.5rem' }} />
                         <p style={{ fontSize: '12px', fontWeight: '900', color: '#64748b', letterSpacing: '1px' }}>PROCESSING</p>
                         <h3 style={{ fontSize: '2rem', margin: '1rem 0', color: '#1e293b' }}>Optimal</h3>
                         <p style={{ fontSize: '11px', color: '#94a3b8' }}>Multi-agent parallel reasoning</p>
                      </div>
                      <div className="card" style={{ textAlign: 'center', borderTop: '4px solid #f59e0b', background: 'white', padding: '2.5rem' }}>
                         <Globe color="#f59e0b" size={40} style={{ marginBottom: '1.5rem' }} />
                         <p style={{ fontSize: '12px', fontWeight: '900', color: '#64748b', letterSpacing: '1px' }}>DOCUMENT TONE</p>
                         <h3 style={{ fontSize: '2rem', margin: '1rem 0', color: '#1e293b' }}>Technical</h3>
                         <p style={{ fontSize: '11px', color: '#94a3b8' }}>Formal & Information-dense</p>
                      </div>
                   </div>

                   <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2.5rem' }}>
                      {/* SYNTHESIS FOCUS */}
                      <div className="card" style={{ background: 'white', padding: '2.5rem' }}>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem' }}>
                            <div style={{ background: '#eff6ff', padding: '12px', borderRadius: '15px' }}><PieChart color="#2563eb" size={28} /></div>
                            <h3 style={{ margin: 0, fontSize: '20px' }}>Analysis Focus Area Distribution</h3>
                         </div>
                         <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                            {[
                              { label: 'Data & Financials', val: 78, color: '#10b981', icon: <TrendingUp size={14} /> },
                              { label: 'Legal & Compliance', val: 45, color: '#2563eb', icon: <ShieldCheck size={14} /> },
                              { label: 'Strategic Overview', val: 92, color: '#f59e0b', icon: <FileText size={14} /> }
                            ].map((item, i) => (
                              <div key={i}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '14px', fontWeight: '800', color: '#475569' }}>
                                   <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>{item.icon} {item.label}</div>
                                   <span>{item.val}% Focus</span>
                                </div>
                                <div style={{ height: '10px', background: '#f1f5f9', borderRadius: '5px', overflow: 'hidden' }}>
                                   <div style={{ height: '100%', width: `${item.val}%`, background: item.color, borderRadius: '5px' }}></div>
                                </div>
                              </div>
                            ))}
                         </div>
                      </div>

                      {/* QUICK SUMMARY */}
                      <div className="card" style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)', border: 'none', color: 'white', padding: '2.5rem', display: 'flex', flexDirection: 'column' }}>
                         <Sparkles color="rgba(255,255,255,0.8)" size={40} style={{ marginBottom: '2rem' }} />
                         <h4 style={{ color: 'white', marginBottom: '1rem', fontSize: '1.4rem', fontWeight: '900' }}>AI Agent Memo</h4>
                         <p style={{ fontSize: '16px', lineHeight: '1.8', opacity: 0.9 }}>
                            Our specialized multi-agent squad identified key sections within your repository, extracted high-density insights, and rigorously fact-checked them against the provided source material.
                         </p>
                         <div style={{ marginTop: 'auto', paddingTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                            <p style={{ fontSize: '11px', fontWeight: 'bold', letterSpacing: '2px', color: 'rgba(255,255,255,0.6)' }}>GROUNDING LEVEL:</p>
                            <p style={{ fontSize: '24px', fontWeight: '900' }}>{activeMessage?.sources?.length || 4} ACTIVE CITATIONS</p>
                         </div>
                      </div>
                   </div>

                   {/* NEW: LIVE ENTITY KNOWLEDGE MAP */}
                   <div className="card" style={{ background: 'white', padding: '2.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem' }}>
                         <div style={{ background: '#f5f3ff', padding: '12px', borderRadius: '15px' }}><Database color="#8b5cf6" size={28} /></div>
                         <h3 style={{ margin: 0, fontSize: '20px' }}>Live Entity Relationship Map</h3>
                      </div>
                      
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', justifyContent: 'center' }}>
                         {activeMessage?.entities && activeMessage.entities.length > 0 ? (
                           activeMessage.entities.map((ent, i) => (
                             <div key={i} style={{ 
                                background: 'white', 
                                border: '1px solid #e2e8f0', 
                                padding: '1rem 1.5rem', 
                                borderRadius: '20px', 
                                minWidth: '200px',
                                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                                position: 'relative'
                             }}>
                                <p style={{ fontSize: '9px', fontWeight: '900', color: ent.type === 'PERSON' ? '#2563eb' : (ent.type === 'ORG' ? '#10b981' : '#f59e0b'), marginBottom: '4px', letterSpacing: '1px' }}>
                                   {ent.type}
                                </p>
                                <p style={{ fontWeight: '800', fontSize: '15px', color: '#1e293b' }}>{ent.name}</p>
                                {ent.relation && (
                                  <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                     <ExternalLink size={12} color="#64748b" />
                                     <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '600' }}>{ent.relation}</span>
                                  </div>
                                )}
                             </div>
                           ))
                         ) : (
                           <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                              No significant entity relationships detected in this context yet.
                           </div>
                         )}
                      </div>
                   </div>

                   {/* SIMPLIFIED REASONING JOURNEY */}
                   <div className="card" style={{ background: 'white', padding: '3rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '3rem' }}>
                         <div style={{ background: '#f0fdf4', padding: '12px', borderRadius: '15px' }}><Activity color="#10b981" size={28} /></div>
                         <h3 style={{ margin: 0, fontSize: '20px' }}>The Intelligence Journey Pattern</h3>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2rem', position: 'relative' }}>
                         <div style={{ position: 'absolute', top: '30px', left: '10%', right: '10%', height: '2px', background: '#f1f5f9', zIndex: 0 }}></div>
                         
                         {[
                           { label: 'Listen', desc: 'Analyzed your question intent.', icon: <Search size={22} /> },
                           { label: 'Discover', desc: 'Scanned through PDF vector base.', icon: <FolderOpen size={22} /> },
                           { label: 'Validate', desc: 'Fact-checked truth at the source.', icon: <CheckCircle2 size={22} /> },
                           { label: 'Deliver', desc: 'Crafted grounded expert answer.', icon: <MessageSquare size={22} /> }
                         ].map((step, i) => (
                           <div key={i} style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
                              <div style={{ 
                                width: '60px', height: '60px', background: 'white', border: '2px solid #2563eb', borderRadius: '50%', 
                                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', color: '#2563eb',
                                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'
                              }}>
                                 {step.icon}
                              </div>
                              <p style={{ fontWeight: '900', fontSize: '16px', marginBottom: '6px', color: '#1e293b' }}>{step.label}</p>
                              <p style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5' }}>{step.desc}</p>
                           </div>
                         ))}
                      </div>
                   </div>

                   <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '2rem' }}>
                      <button className="btn btn-outline" onClick={() => setDashboardStep('QUERY')} style={{ padding: '1.25rem 3rem', borderRadius: '15px', fontWeight: '800' }}>
                         Continue Chatting
                      </button>
                      <button className="btn btn-primary" onClick={() => createNewSession()} style={{ padding: '1.25rem 3rem', borderRadius: '15px', fontWeight: '800' }}>
                         Start New Session
                      </button>
                   </div>
                </div>
              )}

            </div>
          </div>
        </div>
        </main>
      </div>
    );
  }

  return (
    <div id="home">
      {/* ─── NAV ─── */}
      <header className="nav-header">
        <div className="container nav-container" style={{ height: '100px' }}>
          <div className="nav-logo" style={{ fontSize: '1.5rem', fontWeight: 900 }}>
            <Zap size={32} fill="#2563eb" color="#2563eb" /> <span style={{ letterSpacing: '-1px' }}>DocuMind AI</span>
          </div>
          <div className="nav-links">
            <button className="nav-link" onClick={() => scrollTo('home')}>Home</button>
            <button className="nav-link" onClick={() => scrollTo('services')}>Services</button>
            <button className="nav-link" onClick={() => scrollTo('reviews')}>Review</button>
            <button className="btn btn-primary" style={{ padding: '12px 30px', borderRadius: '12px' }} onClick={() => scrollTo('auth')}>Get Started</button>
          </div>
        </div>
      </header>

      {/* ─── HERO ─── */}
      <div className="hero-bg-wrapper">
        <section className="hero">
          <div className="hero-overlay" />
          <div className="container hero-grid">
             <div className="hero-left">
                <div className="glass-card" style={{ padding: '3rem' }}>
                   <h3 style={{ marginBottom: '1.5rem', fontSize: '1.8rem' }}>Welcome to your Intelligence Portal</h3>
                   <p style={{ color: '#64748b', fontSize: '1.1rem', lineHeight: '1.6' }}>Interrogate and synthesize insights across your enterprise repositories with multi-agent precision.</p>
                   <button className="btn btn-outline-red" style={{ marginTop: '2.5rem', padding: '15px 40px' }} onClick={() => scrollTo('auth')}>Start Now</button>
                </div>
                <div className="card" style={{ maxWidth: '350px', marginTop: '2rem' }}>
                   <h4>Trust System</h4>
                   <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Verified agents ensure 99.9% data integrity.</p>
                </div>
             </div>
             <div className="hero-right">
                <p className="badge" style={{ padding: '8px 16px' }}>ENTERPRISE EDITION</p>
                <h1 style={{ fontSize: '4.5rem', lineHeight: '1', margin: '1rem 0' }}>DocuMind Intelligence Portal</h1>
                <p style={{ fontSize: '1.2rem', color: '#475569', maxWidth: '600px' }}>Extract grounded, verifiable intelligence from your internal documents in milliseconds.</p>
                <button className="btn btn-primary" style={{ marginTop: '3rem', padding: '20px 50px', fontSize: '1.1rem' }} onClick={() => scrollTo('auth')}>Start Now</button>
             </div>
          </div>
        </section>
      </div>

      {/* ─── SERVICES ─── */}
      <section id="services" className="section container">
        <div className="section-header" style={{ textAlign: 'center', marginBottom: '4rem' }}>
           <p className="badge">Intelligence Workflow</p>
           <h2 style={{ fontSize: '3rem' }}>How It Works</h2>
        </div>
        <div className="grid-3" style={{ gap: '3rem' }}>
           <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
              <div style={{ background: '#eff6ff', width: '60px', height: '60px', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem' }}>
                <UploadCloud color="#2563eb" size={30} />
              </div>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>1. Ingestion</h3>
              <p style={{ color: '#64748b' }}>Securely upload your PDFs to our private vector index.</p>
           </div>
           <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
              <div style={{ background: '#f0fdf4', width: '60px', height: '60px', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem' }}>
                <Search color="#10b981" size={30} />
              </div>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>2. Interrogation</h3>
              <p style={{ color: '#64748b' }}>Query documents using advanced natural language.</p>
           </div>
           <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
              <div style={{ background: '#fff7ed', width: '60px', height: '60px', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem' }}>
                <TrendingUp color="#f59e0b" size={30} />
              </div>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>3. Analytics</h3>
              <p style={{ color: '#64748b' }}>Visualize the reasoning path of your findings.</p>
           </div>
        </div>
      </section>

      {/* ─── REVIEWS ─── */}
      <section id="reviews" className="section container">
         <div className="section-header" style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <h2 style={{ fontSize: '3rem' }}>Client Feedback</h2>
         </div>
         <div className="grid-3" style={{ gap: '2.5rem' }}>
            {[
              { name: 'Sarah Jenkins', role: 'Head of Data, TechFlow', text: "The multi-agent system provides incredible precision. It actually identifies document intent and follows up with verifiable citations." },
              { name: 'Marcus Chen', role: 'Solutions Architect, CloudScale', text: "DocuMind cut our document parsing time by 90%. The Groq-powered latency is indistinguishable from magic." },
              { name: 'Elena Rodriguez', role: 'General Counsel, LexGlobal', text: "Citations are everything in our field. DocuMind's ability to anchor every fact to a specific page is vital for our workflows." }
            ].map((r, i) => (
              <div className="card" key={i} style={{ padding: '2.5rem' }}>
                 <div style={{ color: '#f59e0b', marginBottom: '1.5rem', display: 'flex', gap: '4px' }}>
                    <Star size={18} fill="#f59e0b" /><Star size={18} fill="#f59e0b" /><Star size={18} fill="#f59e0b" /><Star size={18} fill="#f59e0b" /><Star size={18} fill="#f59e0b" />
                 </div>
                 <p style={{ fontStyle: 'italic', marginBottom: '2.5rem', fontSize: '1.1rem', lineHeight: '1.6', color: '#475569' }}>"{r.text}"</p>
                 <p style={{ margin: 0 }}><strong>{r.name}</strong></p>
                 <p style={{ fontSize: '10px', color: '#2563eb', fontWeight: '900', marginTop: '6px', letterSpacing: '1px' }}>{r.role.toUpperCase()}</p>
              </div>
            ))}
         </div>
      </section>

      {/* ─── AUTH ─── */}
      <section id="auth" className="section" style={{ background: '#f8fafc', padding: '8rem 0' }}>
        <div className="container auth-grid">
           <div className="hero-right" style={{ padding: 0 }}>
              <p className="badge">SECURE ACCESS</p>
              <h2 style={{ fontSize: '3rem', margin: '1rem 0' }}>Access Intelligence</h2>
              <p style={{ fontSize: '1.2rem', color: '#64748b' }}>Start your multi-agent session by creating a professional account.</p>
           </div>
           <div className="form-wrapper" style={{ background: 'white', padding: '3rem', borderRadius: '32px', boxShadow: '0 20px 50px rgba(0,0,0,0.05)' }}>
              {loginError && (
                <div style={{ background: '#fee2e2', color: '#ef4444', padding: '1rem', borderRadius: '12px', marginBottom: '2rem', fontSize: '14px', fontWeight: 'bold', border: '1px solid #fecaca' }}>
                  {loginError}
                </div>
              )}
              <div className="form-group" style={{ marginBottom: '2rem' }}>
                <label style={{ fontWeight: '800', fontSize: '14px', color: '#64748b', marginBottom: '10px', display: 'block' }}>Corporate Email</label>
                <input className="form-control" type="email" placeholder="admin@enterprise.ai" style={{ height: '60px', borderRadius: '15px' }} value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: '3rem' }}>
                <label style={{ fontWeight: '800', fontSize: '14px', color: '#64748b', marginBottom: '10px', display: 'block' }}>Secure Password</label>
                <input className="form-control" type="password" placeholder="••••••••" style={{ height: '60px', borderRadius: '15px' }} value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
              </div>
              <button className="btn btn-primary" style={{ width: '100%', height: '70px', borderRadius: '20px', fontSize: '1.2rem', fontWeight: '900' }} onClick={handleLogin}>
                Initialize Portal Access
              </button>
           </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer id="contact" className="section" style={{ background: '#1e293b', color: 'white', padding: '5rem 0' }}>
         <div className="container" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4rem' }}>
            <div>
               <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
                  <Zap color="white" fill="white" size={24} />
                  <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900 }}>DocuMind AI</h3>
               </div>
               <p style={{ color: '#94a3b8', maxWidth: '400px', lineHeight: '1.6' }}>The world's first multi-agent document intelligence platform built for modern enterprise repositories.</p>
            </div>
            <div style={{ textAlign: 'right' }}>
               <p style={{ fontWeight: '900', letterSpacing: '2px', color: '#2563eb' }}>CORE REPOSITORY v1.0</p>
               <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '10px' }}>© 2026 DOCUMIND AI INTEL. ALL RIGHTS RESERVED.</p>
            </div>
         </div>
      </footer>
    </div>
  );
}

export default App;
