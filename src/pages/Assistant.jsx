import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Send, Sparkles } from "lucide-react";
import { useApp } from "../context/AppContext";
import { getAssistantResponse } from "../services/assistantService";

const SUGGESTIONS_EN = ["Can I afford ₩500,000 right now?", "How much did I spend on food?", "What's my biggest expense?", "How much did I save?"];
const SUGGESTIONS_KO = ["지금 50만원 감당할 수 있어?", "이번 달 식비 얼마 썼어?", "가장 큰 지출이 뭐야?", "얼마나 저축했어?"];

export default function Assistant() {
  const { data, lang, assistantMode, t } = useApp();
  const [messages, setMessages] = useState([{ from: "ai", text: t("assistantGreeting") }]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, typing]);

  async function send(text) {
    const q = (text ?? input).trim();
    if (!q) return;
    setMessages((prev) => [...prev, { from: "user", text: q }]);
    setInput("");
    setTyping(true);
    const answer = await getAssistantResponse(q, data, lang, assistantMode);
    setTimeout(() => {
      setMessages((prev) => [...prev, { from: "ai", text: answer }]);
      setTyping(false);
    }, 450);
  }

  const suggestions = lang === "ko" ? SUGGESTIONS_KO : SUGGESTIONS_EN;

  return (
    <div className="page">
      <div className="page-header">
        <h1>{t("assistant")}</h1>
        <span className="mode-badge">{assistantMode === "demo" ? t("demoAssistant") : t("apiAssistant")}</span>
      </div>

      <div className="card chat-card">
        <div className="chat-messages">
          {messages.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={"chat-row " + (m.from === "user" ? "chat-row-user" : "")}>
              {m.from === "ai" && <div className="chat-avatar"><Sparkles size={14} color="white" /></div>}
              <div className={"chat-bubble " + (m.from === "user" ? "chat-bubble-user" : "chat-bubble-ai")}>{m.text}</div>
            </motion.div>
          ))}
          {typing && (
            <div className="chat-row">
              <div className="chat-avatar"><Sparkles size={14} color="white" /></div>
              <div className="chat-bubble chat-bubble-ai typing-dots"><span></span><span></span><span></span></div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {messages.length <= 1 && (
          <div className="suggestion-row">
            {suggestions.map((s) => (
              <button key={s} className="suggestion-chip" onClick={() => send(s)}>{s}</button>
            ))}
          </div>
        )}

        <div className="chat-input-row">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={t("assistantPlaceholder")}
          />
          <button onClick={() => send()} className="btn-primary chat-send"><Send size={16} /></button>
        </div>
      </div>
    </div>
  );
}
