import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Globe, Bot, User, RotateCcw, Trash2, Info, Trophy, Wand2, RefreshCw, Server, LogOut } from "lucide-react";
import { useApp } from "../context/AppContext";
import AchievementCard, { ACHIEVEMENT_DEFS } from "../components/AchievementCard";
import { getBackendStatus } from "../services/assistantService";

function StatusDot({ up }) {
  return <span className={"status-dot " + (up ? "status-up" : "status-down")} />;
}

export default function Settings() {
  const { user, data, lang, setLanguage, assistantMode, setAssistantMode, generateSample, clearData, showToast, logout, t } = useApp();
  const [confirmAction, setConfirmAction] = useState(null); // null | "sample" | "clear" | "logout"
  const [status, setStatus] = useState({ backendUp: null, geminiConfigured: null });
  const [checking, setChecking] = useState(false);

  const checkStatus = useCallback(async () => {
    setChecking(true);
    const result = await getBackendStatus();
    setStatus(result);
    setChecking(false);
  }, []);

  useEffect(() => { checkStatus(); }, [checkStatus]);

  function handleConfirm() {
    if (confirmAction === "sample") {
      generateSample();
      showToast(lang === "ko" ? "샘플 데이터가 생성됐어요." : "Sample month generated.");
    } else if (confirmAction === "clear") {
      clearData();
      showToast(lang === "ko" ? "모든 데이터가 삭제됐어요." : "All data cleared.");
    } else if (confirmAction === "logout") {
      logout();
      return; // component is about to unmount — nothing left to reset
    }
    setConfirmAction(null);
  }

  const unlockedKeys = new Set(data.achievements.map((a) => a.key));

  return (
    <div className="page">
      <div className="page-header"><h1>{t("settings")}</h1></div>

      <div className="card">
        <div className="card-title-row"><span className="card-title"><User size={15} style={{ marginRight: 6, verticalAlign: -2 }} />{t("profile")}</span></div>
        <div className="settings-row">
          <span>{t("fullName")}</span><span className="settings-value">{user?.name}</span>
        </div>
        <div className="settings-row">
          <span>{t("email")}</span><span className="settings-value">{user?.email}</span>
        </div>
        {confirmAction === "logout" ? (
          <div className="logout-confirm-row">
            <span>{lang === "ko" ? "로그아웃 하시겠어요?" : "Log out of Moneo?"}</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-danger" onClick={handleConfirm}>{t("confirm")}</button>
              <button className="btn-secondary" onClick={() => setConfirmAction(null)}>{t("cancel")}</button>
            </div>
          </div>
        ) : (
          <button className="btn-danger-outline btn-block settings-logout-btn" onClick={() => setConfirmAction("logout")}>
            <LogOut size={15} /> {t("logout")}
          </button>
        )}
      </div>

      <div className="card">
        <div className="card-title-row"><span className="card-title"><Globe size={15} style={{ marginRight: 6, verticalAlign: -2 }} />{t("language")}</span></div>
        <div className="lang-toggle">
          <button className={lang === "en" ? "active" : ""} onClick={() => setLanguage("en")}>English</button>
          <button className={lang === "ko" ? "active" : ""} onClick={() => setLanguage("ko")}>한국어</button>
        </div>
      </div>

      <div className="card">
        <div className="card-title-row">
          <span className="card-title"><Bot size={15} style={{ marginRight: 6, verticalAlign: -2 }} />{t("assistantMode")}</span>
          <button className="icon-btn-ghost" onClick={checkStatus} title="Refresh status"><RefreshCw size={14} className={checking ? "spin" : ""} /></button>
        </div>
        <div className="radio-row">
          <label>
            <input type="radio" checked={assistantMode === "demo"} onChange={() => setAssistantMode("demo")} />
            {t("demoMode")}
          </label>
          <label>
            <input type="radio" checked={assistantMode === "api"} onChange={() => setAssistantMode("api")} />
            {t("apiMode")}
          </label>
        </div>

        <div className="status-grid">
          <div className="status-row">
            <span><Server size={14} style={{ marginRight: 6, verticalAlign: -2 }} />{lang === "ko" ? "백엔드" : "Backend"}</span>
            <span className="status-value">
              <StatusDot up={status.backendUp} />
              {status.backendUp === null ? (lang === "ko" ? "확인 중..." : "Checking...") : status.backendUp ? (lang === "ko" ? "연결됨" : "Connected") : (lang === "ko" ? "오프라인" : "Offline")}
            </span>
          </div>
          <div className="status-row">
            <span><Bot size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Moneo AI (Gemini)</span>
            <span className="status-value">
              <StatusDot up={status.geminiConfigured} />
              {status.geminiConfigured === null ? (lang === "ko" ? "확인 중..." : "Checking...") : status.geminiConfigured ? (lang === "ko" ? "사용 가능" : "Available") : (lang === "ko" ? "설정 필요" : "Not configured")}
            </span>
          </div>
        </div>

        {!status.backendUp && (
          <div className="hint-box">
            {lang === "ko"
              ? "백엔드가 꺼져 있어요. 터미널에서 backend 폴더로 이동해 npm run dev를 실행해주세요."
              : "The backend isn't running. Open a terminal, cd into the backend folder, and run npm run dev."}
          </div>
        )}
        {status.backendUp && !status.geminiConfigured && (
          <div className="hint-box">
            {lang === "ko"
              ? "백엔드는 실행 중이지만 Gemini API 키가 설정되지 않았어요. backend/.env를 확인해주세요."
              : "Backend is running, but no Gemini API key is configured. Check backend/.env."}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title-row"><span className="card-title"><Trophy size={15} style={{ marginRight: 6, verticalAlign: -2 }} />{t("achievements")}</span></div>
        <div className="achievements-grid">
          {Object.keys(ACHIEVEMENT_DEFS).map((key) => (
            <AchievementCard key={key} achievementKey={key} unlocked={unlockedKeys.has(key)} lang={lang} />
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title-row"><span className="card-title"><Info size={15} style={{ marginRight: 6, verticalAlign: -2 }} />{t("architectureTitle")}</span></div>
        <div className="arch-row">
          <div className="arch-box">
            <div className="arch-label">{t("architectureCurrent")}</div>
            <div className="arch-flow">React → Express (local) → Gemini API</div>
          </div>
          <div className="arch-box arch-box-muted">
            <div className="arch-label">{t("architectureFuture")}</div>
            <div className="arch-flow">React → Hosted Backend → Cloud Database → Gemini API → Moneo</div>
          </div>
        </div>
        <p className="arch-note">
          {lang === "ko"
            ? "이 로컬 데모는 내 컴퓨터에서 실행되는 백엔드를 사용해 Gemini API 키를 안전하게 보호해요. 온라인 배포를 위해서는 호스팅과 클라우드 데이터베이스가 추가로 필요합니다."
            : "This local demo uses a backend running on your own computer to keep the Gemini API key safe. Making Moneo available online would additionally need hosting and a cloud database."}
        </p>
      </div>

      <div className="card">
        <div className="card-title-row"><span className="card-title">{t("aboutMoneo")}</span></div>
        <p className="arch-note">{t("aboutText")}</p>
        <p className="disclaimer">{t("disclaimer")}</p>
      </div>

      <div className="card">
        <div className="card-title-row"><span className="card-title"><Wand2 size={15} style={{ marginRight: 6, verticalAlign: -2 }} />{t("demoTools")}</span></div>
        <p className="arch-note" style={{ marginBottom: 12 }}>{t("demoToolsDesc")}</p>
        {!confirmAction ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button className="btn-secondary" style={{ justifyContent: "flex-start" }} onClick={() => setConfirmAction("sample")}>
              <RotateCcw size={15} style={{ marginRight: 8 }} /> {t("generateSampleMonth")}
            </button>
            <button className="btn-danger-outline" onClick={() => setConfirmAction("clear")}>
              <Trash2 size={15} /> {t("clearAllData")}
            </button>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 13, marginBottom: 10 }}>
              {confirmAction === "sample" ? t("resetConfirm") : t("clearConfirm")}
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-danger" onClick={handleConfirm}>{t("confirm")}</button>
              <button className="btn-secondary" onClick={() => setConfirmAction(null)}>{t("cancel")}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
