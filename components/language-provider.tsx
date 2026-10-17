// "use client";
// import { createContext, useContext, useEffect, useState } from "react";
// import { setFormatLocale } from "@/lib/format";

// type Lang = "ja" | "en";

// const dict = {
//   en: { search: "Search cars...", dashboard: "Dashboard", inventory: "Inventory",
//         sales: "Sales", payments: "Payments", reports: "Reports", addPayment: "Add Payment" },
//   ja: { search: "車両を検索...", dashboard: "ダッシュボード", inventory: "在庫",
//         sales: "販売", payments: "入金", reports: "レポート", addPayment: "入金を追加" },
// } as const;

// type Key = keyof typeof dict.en;
// const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: Key) => string }>(null!);

// export function LanguageProvider({ children }: { children: React.ReactNode }) {
//   const [lang, setLangState] = useState<Lang>("ja");
//   setFormatLocale(lang); // runs before children render, so dates and money follow

//   useEffect(() => {
//     const saved = localStorage.getItem("lang") as Lang | null;
//     if (saved === "en" || saved === "ja") setLangState(saved);
//   }, []);

//   useEffect(() => {
//     document.documentElement.lang = lang;
//   }, [lang]);

//   const setLang = (l: Lang) => {
//     localStorage.setItem("lang", l);
//     setLangState(l);
//   };

//   return (
//     <Ctx.Provider value={{ lang, setLang, t: (k) => dict[lang][k] }}>
//       {children}
//     </Ctx.Provider>
//   );
// }

// export const useLang = () => useContext(Ctx);