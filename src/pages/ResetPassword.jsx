import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, Eye, EyeOff, KeyRound, AlertTriangle } from "lucide-react";
import { useApp } from "../context/AppContext";
import Logo from "../components/Logo";
import heroImage from "../assets/seoul-night.jpg";

// Shown when the user opens the "reset your password" email link.
// Supabase has already signed them in with a temporary recovery session;
// here they choose the new password.
export default function ResetPassword() {
  const { user, authLoading, updatePassword, finishRecovery, showToast, t, lang } = useApp();
  const navigate = useNavigate();
  const L = (en, ko) => (lang === "ko" ? ko : en);
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    const result = await updatePassword(String(fd.get("password") || ""), String(fd.get("confirm") || ""));
    setSaving(false);
    if (!result.ok) { setError(t(result.error)); return; }
    showToast(L("Password updated.", "비밀번호가 변경됐어요."));
    navigate("/app/dashboard", { replace: true });
  }

  function backToLogin() {
    finishRecovery();
    navigate("/login", { replace: true });
  }

  const expired = !authLoading && !user;

  return (
    <div className="mo-landing">
      <section className="mo-hero mo-hero-center">
        <img className="mo-hero-bg" src={heroImage} alt="" />
        <div className="mo-hero-scrim" />
        <motion.div className="mo-auth-card" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="mo-auth-brand"><Logo size={32} textSize={24} /></div>
          {authLoading ? (
            <p className="mo-auth-sub" style={{ textAlign: "center" }}>{L("Checking your link…", "링크를 확인하는 중…")}</p>
          ) : expired ? (
            <div className="mo-auth-sent">
              <div className="mo-sent-icon warn"><AlertTriangle size={26} /></div>
              <h2 className="mo-auth-title">{L("This link has expired", "링크가 만료됐어요")}</h2>
              <p className="mo-auth-sub">{L("Reset links work once, for one hour, in the browser where you asked for them. Request a new one.", "재설정 링크는 요청한 브라우저에서 1시간 동안 한 번만 쓸 수 있어요. 새 링크를 요청해주세요.")}</p>
              <button type="button" className="mo-btn-gradient" onClick={backToLogin}>{L("Back to log in", "로그인으로 돌아가기")}</button>
            </div>
          ) : (
            <>
              <div className="mo-sent-icon"><KeyRound size={26} /></div>
              <h2 className="mo-auth-title">{L("Set a new password", "새 비밀번호 설정")}</h2>
              <p className="mo-auth-sub">{L(`For ${user.email}`, `${user.email} 계정`)}</p>
              <form className="mo-auth-form" onSubmit={handleSubmit} noValidate>
                <label className="mo-field">
                  <Lock size={16} />
                  <input name="password" type={showPw ? "text" : "password"} autoComplete="new-password" placeholder={L("New password", "새 비밀번호")} aria-label={L("New password", "새 비밀번호")} />
                  <button type="button" className="mo-eye" onClick={() => setShowPw((v) => !v)} aria-label={L("Show password", "비밀번호 보기")}>
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </label>
                <label className="mo-field">
                  <Lock size={16} />
                  <input name="confirm" type={showPw ? "text" : "password"} autoComplete="new-password" placeholder={t("confirmPassword")} aria-label={t("confirmPassword")} />
                </label>
                <p className="mo-hint">{t("passwordHint")}</p>
                {error && <div className="mo-error" role="alert">{error}</div>}
                <button type="submit" className="mo-btn-gradient" disabled={saving}>{saving ? "…" : L("Save new password", "새 비밀번호 저장")}</button>
              </form>
              <button type="button" className="mo-link-btn center" onClick={backToLogin}>{t("cancel")}</button>
            </>
          )}
        </motion.div>
      </section>
    </div>
  );
}
