// Everything shown in the landing page's "About us" and "Contact us"
// sections lives here, so the team can update it without touching layout code.
//
// To add or change a link, edit the fields below. Empty strings are hidden.

export const TEAM = [
  {
    id: "deepak",
    name: "Deepak Pandey",
    initials: "DP",
    role: { en: "Project Lead · Full-Stack & AI", ko: "프로젝트 리더 · 풀스택 & AI" },
    bio: {
      en: "Leads the project and builds the core of Moneo: the backend server, the Gemini AI integration for receipt scanning and the assistant, and the secure Supabase database.",
      ko: "프로젝트를 이끌며 Moneo의 핵심을 개발했습니다: 백엔드 서버, 영수증 인식과 어시스턴트를 위한 Gemini AI 연동, 그리고 안전한 Supabase 데이터베이스.",
    },
    github: "DeepakPandey102", // ← add the GitHub username here, e.g. "deepak-pandey"
    phone: "01025071918",
    email: "",
    instagram: "d3epak07",
  },
  {
    id: "renuka",
    name: "Renuka Thapa Magar",
    initials: "RT",
    role: { en: "UI/UX Designer", ko: "UI/UX 디자이너" },
    bio: {
      en: "Designs how Moneo looks and feels — the visual identity, the landing page and the dashboard — so managing money feels clear and calm instead of stressful.",
      ko: "Moneo의 디자인을 담당합니다 — 비주얼 아이덴티티, 랜딩 페이지, 대시보드까지. 돈 관리가 스트레스가 아니라 명확하고 편안하게 느껴지도록 만듭니다.",
    },
    github: "",
    phone: "",
    email: "ggrenuca@gmail.com",
    instagram: "_ausnang",
  },
  {
    id: "rohit",
    name: "Rohit Rawal",
    initials: "RR",
    role: { en: "Frontend & Quality Assurance", ko: "프론트엔드 & 품질 관리" },
    bio: {
      en: "Builds and polishes app screens and tests every flow — sign-up, receipts, budgets and goals — to make sure Moneo works reliably on phones and laptops.",
      ko: "앱 화면을 구현·개선하고 회원가입, 영수증, 예산, 목표 등 모든 흐름을 테스트해 Moneo가 휴대폰과 노트북에서 안정적으로 동작하도록 합니다.",
    },
    github: "",
    phone: "",
    email: "rawaal1rohit@gmail.com",
    instagram: "__rawal_20",
  },
];

// "010-2507-1918" for display, "+821025071918" for tap-to-call links.
export function formatKoreanPhone(raw) {
  const d = String(raw || "").replace(/\D/g, "");
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return raw;
}
export function phoneHref(raw) {
  const d = String(raw || "").replace(/\D/g, "");
  return d.startsWith("0") ? `tel:+82${d.slice(1)}` : `tel:${d}`;
}
