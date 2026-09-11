import React, { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Coins, Mail, Lock } from "lucide-react";
import { useApp } from "../context/AppContext";

export default function Login() {
  const { login, t, lang } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    // Browser autofill (and some password managers) can fill inputs
    // visually without firing React's onChange — which leaves email/password
    // state stuck at "" even though the fields look filled. Reading directly
    // from the form at submit time avoids that mismatch entirely.
    const formData = new FormData(formRef.current);
    const finalEmail = (formData.get("email") || email || "").trim();
    const finalPassword = formData.get("password") || password || "";

    if (!finalEmail || !finalPassword) {
      setError(lang === "ko" ? "이메일과 비밀번호를 모두 입력해주세요." : "Please enter both your email and password.");
      return;
    }

    setSubmitting(true);
    const result = await login(finalEmail, finalPassword);
    setSubmitting(false);
    if (!result.ok) { setError(t(result.error)); return; }
    navigate("/app/dashboard");
  }

  return (
    <div className="auth-screen">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="auth-card">
        <div className="auth-brand">
          <Coins size={28} color="#16A34A" />
          <span>Moneo 2.0</span>
        </div>
        <p className="auth-tagline">{t("tagline")}</p>

        <h1 className="auth-title">{t("welcomeBack")}</h1>

        <form ref={formRef} onSubmit={handleSubmit}>
          <div className="input-group">
            <Mail size={16} className="input-icon" />
            <input name="email" type="email" placeholder={t("email")} value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="input-group">
            <Lock size={16} className="input-icon" />
            <input name="password" type="password" placeholder={t("password")} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <div className="form-error">{error}</div>}
          <button type="submit" className="btn-primary btn-block" disabled={submitting}>
            {submitting ? (lang === "ko" ? "로그인 중..." : "Logging in...") : t("login")}
          </button>
        </form>

        <p className="auth-switch">
          {t("dontHaveAccount")} <Link to="/register">{t("createAccount")}</Link>
        </p>
      </motion.div>
    </div>
  );
}
