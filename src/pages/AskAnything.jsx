import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import {
  Plus, Send, Trash2, Pencil, Check, X, Copy, RotateCcw,
  Sparkles, AlertCircle, Menu,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import * as chatService from "../services/chatService";

const STARTER_PROMPTS_EN = [
  "Explain a concept to me like I'm 5",
  "Help me write a short email",
  "Give me 3 ideas for a weekend project",
  "What's a good way to learn a new skill fast?",
];
const STARTER_PROMPTS_KO = [
  "어떤 개념을 쉽게 설명해줘",
  "짧은 이메일 작성 도와줘",
  "주말 프로젝트 아이디어 3개 줘",
  "새로운 기술을 빨리 배우는 방법 알려줘",
];

export default function AskAnything() {
  const { user, lang } = useApp();
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [typewriterId, setTypewriterId] = useState(null);
  const [typewriterText, setTypewriterText] = useState("");
  const messagesEndRef = useRef(null);
  const typewriterIntervalRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    chatService.listThreads(user.id)
      .then((list) => {
        setThreads(list);
        setLoadingThreads(false);
        if (list.length > 0) setActiveThreadId(list[0].id);
      })
      .catch((err) => { console.error(err); setLoadingThreads(false); });
  }, [user]);

  useEffect(() => {
    if (!activeThreadId) { setMessages([]); return; }
    setLoadingMessages(true);
    chatService.listMessages(activeThreadId)
      .then((msgs) => { setMessages(msgs); setLoadingMessages(false); })
      .catch((err) => { console.error(err); setLoadingMessages(false); });
  }, [activeThreadId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typewriterText]);

  useEffect(() => () => clearInterval(typewriterIntervalRef.current), []);

  function runTypewriter(messageId, fullText) {
    setTypewriterId(messageId);
    setTypewriterText("");
    let i = 0;
    clearInterval(typewriterIntervalRef.current);
    typewriterIntervalRef.current = setInterval(() => {
      i += Math.max(1, Math.floor(fullText.length / 120));
      setTypewriterText(fullText.slice(0, i));
      if (i >= fullText.length) {
        clearInterval(typewriterIntervalRef.current);
        setTypewriterId(null);
      }
    }, 18);
  }

  async function ensureThread() {
    if (activeThreadId) return activeThreadId;
    const thread = await chatService.createThread(user.id);
    setThreads((prev) => [thread, ...prev]);
    setActiveThreadId(thread.id);
    return thread.id;
  }

  async function handleNewThread() {
    if (!user) return;
    try {
      const thread = await chatService.createThread(user.id);
      setThreads((prev) => [thread, ...prev]);
      setActiveThreadId(thread.id);
      setMessages([]);
      setMobileSidebarOpen(false);
    } catch (err) { console.error(err); }
  }

  async function handleSend(overrideText) {
    const text = (typeof overrideText === "string" ? overrideText : input).trim();
    if (!text || sending) return;
    setError(null);
    setInput("");

    const threadId = await ensureThread();
    const isFirstMessage = messages.length === 0;

    const tempUserMsg = { id: "temp-" + Date.now(), role: "user", content: text, created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, tempUserMsg]);
    setSending(true);

    try {
      const reply = await chatService.sendMessage({ threadId, message: text, lang });
      const fresh = await chatService.listMessages(threadId);
      setMessages(fresh);
      runTypewriter(reply.id, reply.content);

      if (isFirstMessage) {
        chatService.generateTitleForThread({ threadId, firstMessage: text, lang }).then((title) => {
          if (title) setThreads((prev) => prev.map((th) => (th.id === threadId ? { ...th, title } : th)));
        });
      }
      setThreads((prev) => {
        const updated = prev.map((th) => (th.id === threadId ? { ...th, updated_at: new Date().toISOString() } : th));
        return [...updated].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
      });
    } catch (err) {
      console.error(err);
      setError({ message: chatService.friendlyChatError(err, lang), retryText: text });
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
    } finally {
      setSending(false);
    }
  }

  async function handleRegenerate(msg) {
    const idx = messages.findIndex((m) => m.id === msg.id);
    const userMsg = [...messages].slice(0, idx).reverse().find((m) => m.role === "user");
    if (!userMsg) return;

    setSending(true);
    setError(null);
    try {
      await chatService.deleteMessage(msg.id);
      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      const reply = await chatService.sendMessage({ threadId: activeThreadId, message: userMsg.content, lang, skipUserSave: true });
      const fresh = await chatService.listMessages(activeThreadId);
      setMessages(fresh);
      runTypewriter(reply.id, reply.content);
    } catch (err) {
      setError({ message: chatService.friendlyChatError(err, lang) });
    } finally {
      setSending(false);
    }
  }

  async function handleDeleteThread(threadId, e) {
    e.stopPropagation();
    if (!window.confirm(lang === "ko" ? "이 대화를 삭제할까요?" : "Delete this chat?")) return;
    try {
      await chatService.deleteThread(threadId);
      setThreads((prev) => prev.filter((t) => t.id !== threadId));
      if (activeThreadId === threadId) {
        setActiveThreadId(null);
        setMessages([]);
      }
    } catch (err) { console.error(err); }
  }

  function startRename(thread, e) {
    e.stopPropagation();
    setRenamingId(thread.id);
    setRenameValue(thread.title);
  }

  async function confirmRename(threadId) {
    const title = renameValue.trim() || "New Chat";
    setThreads((prev) => prev.map((t) => (t.id === threadId ? { ...t, title } : t)));
    setRenamingId(null);
    try { await chatService.renameThread(threadId, title); } catch (err) { console.error(err); }
  }

  function copyMessage(content) {
    navigator.clipboard?.writeText(content);
  }

  const starters = lang === "ko" ? STARTER_PROMPTS_KO : STARTER_PROMPTS_EN;

  return (
    <div className="ask-anything-page">
      <div className={"chat-thread-sidebar" + (mobileSidebarOpen ? " open" : "")}>
        <button className="btn-primary btn-block" onClick={handleNewThread} style={{ margin: "0 0 12px" }}>
          <Plus size={16} /> {lang === "ko" ? "새 대화" : "New Chat"}
        </button>
        <div className="chat-thread-list">
          {loadingThreads ? (
            <div className="chat-thread-empty">{lang === "ko" ? "불러오는 중..." : "Loading..."}</div>
          ) : threads.length === 0 ? (
            <div className="chat-thread-empty">{lang === "ko" ? "아직 대화가 없어요" : "No chats yet"}</div>
          ) : threads.map((thread) => (
            <div
              key={thread.id}
              className={"chat-thread-item" + (thread.id === activeThreadId ? " active" : "")}
              onClick={() => { setActiveThreadId(thread.id); setMobileSidebarOpen(false); }}
            >
              {renamingId === thread.id ? (
                <div className="chat-thread-rename" onClick={(e) => e.stopPropagation()}>
                  <input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") confirmRename(thread.id); if (e.key === "Escape") setRenamingId(null); }}
                  />
                  <button onClick={() => confirmRename(thread.id)}><Check size={13} /></button>
                  <button onClick={() => setRenamingId(null)}><X size={13} /></button>
                </div>
              ) : (
                <>
                  <span className="chat-thread-title">{thread.title}</span>
                  <div className="chat-thread-actions">
                    <button onClick={(e) => startRename(thread, e)}><Pencil size={13} /></button>
                    <button onClick={(e) => handleDeleteThread(thread.id, e)}><Trash2 size={13} /></button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="chat-main">
        <button className="chat-mobile-toggle" onClick={() => setMobileSidebarOpen((v) => !v)}>
          <Menu size={18} />
        </button>

        <div className="chat-messages">
          {messages.length === 0 && !loadingMessages ? (
            <div className="chat-empty-state">
              <Sparkles size={32} color="#16A34A" />
              <h2>{lang === "ko" ? "무엇이든 물어보세요" : "Ask Anything"}</h2>
              <p>{lang === "ko" ? "궁금한 걸 자유롭게 물어보세요 — 이 대화는 기억돼요." : "Ask about anything you're curious about — this conversation is remembered."}</p>
              <div className="chat-starter-grid">
                {starters.map((s) => (
                  <button key={s} className="chat-starter-chip" onClick={() => handleSend(s)}>{s}</button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={"chat-bubble-row " + msg.role}>
                <div className="chat-bubble">
                  <div className="chat-markdown">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                      {msg.id === typewriterId ? typewriterText : msg.content}
                    </ReactMarkdown>
                  </div>
                  {msg.role === "assistant" && msg.id !== typewriterId && (
                    <div className="chat-msg-actions">
                      <button onClick={() => copyMessage(msg.content)} title={lang === "ko" ? "복사" : "Copy"}><Copy size={13} /></button>
                      <button onClick={() => handleRegenerate(msg)} title={lang === "ko" ? "다시 생성" : "Regenerate"}><RotateCcw size={13} /></button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          {sending && (
            <div className="chat-bubble-row assistant">
              <div className="chat-bubble chat-thinking">
                <span className="chat-dot" /><span className="chat-dot" /><span className="chat-dot" />
              </div>
            </div>
          )}
          {error && (
            <div className="chat-error-row">
              <AlertCircle size={14} />
              <span>{error.message}</span>
              {error.retryText && <button onClick={() => handleSend(error.retryText)}>{lang === "ko" ? "다시 시도" : "Retry"}</button>}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form className="chat-input-row" onSubmit={(e) => { e.preventDefault(); handleSend(); }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={lang === "ko" ? "무엇이든 물어보세요..." : "Ask anything..."}
            disabled={sending}
          />
          <button type="submit" disabled={sending || !input.trim()}><Send size={16} /></button>
        </form>
      </div>
    </div>
  );
}
