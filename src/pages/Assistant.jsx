import React, { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
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

  // A question typed into the top search bar arrives as ?q=...
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    const q = params.get("q");
    if (!q) return;
    setParams({}, { replace: true });
    send(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  async function send(text) {
    const q = (text ?? input).trim();
    if (!q || typing) return; // no overlapping requests
    setMessages((prev) => [...prev, { from: "user", text: q }]);
    setInput("");
    setTyping(true);
    let answer;
    try {
      answer = await getAssistantResponse(q, data, lang, assistantMode);
    } catch (err) {
      console.error(err);
      answer = lang === "ko" ? "답변을 만들지 못했어요. 다시 시도해주세요." : "Something went wrong. Please try again.";
    }
    setTimeout(() => {
      setMessages((prev) => [...prev, { from: "ai", text: answer }]);
      setTyping(false);
    }, 450);
  }

  // Korean (and Japanese/Chinese) keyboards fire Enter once to finish
  // composing the last syllable and again for the real Enter — without the
  // isComposing check the message was sent twice, the second time with just
  // the leftover last character.
  function handleKeyDown(e) {
    if (e.key !== "Enter" || e.nativeEvent.isComposing || e.keyCode === 229) return;
    e.preventDefault();
    send();
  }

  const suggestions = lang === "ko" ? SUGGESTIONS_KO : SUGGESTIONS_EN;

  return (
    <div className="page">
      <div className="page-header">
        <h1>{t("assistant")}</h1>
        <span className="mode-badge">Moneo AI</span>
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
              <button key={s} className="suggestion-chip" onClick={() => send(s)} disabled={typing}>{s}</button>
            ))}
          </div>
        )}

        <div className="chat-input-row">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("assistantPlaceholder")}
          />
          <button onClick={() => send()} className="btn-primary chat-send" disabled={typing || !input.trim()}><Send size={16} /></button>
        </div>
      </div>
    </div>
  );
}
