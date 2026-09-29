"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCheck, Clock3, Frown, Globe2, History, Lightbulb, LockKeyhole, Meh, MessageCircle, MonitorPlay, RotateCcw, ShieldCheck, Smile, Sparkles, ThumbsUp, Wrench } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { emptyAnswers, highlights, type Answers } from "@/lib/survey";
import { getSettings, kioskId, saveFeedback, syncFeedback } from "@/lib/local-store";
import { languageCodes, languageNames, isLanguage, type Language } from "@/lib/languages";
import { translations, formatMessage } from "@/lib/i18n";
const faces = [Frown, Frown, Meh, Smile, Smile];
const featureIcons = [History, Lightbulb, Wrench, MonitorPlay, Sparkles, MessageCircle];

function Ratings({ value, onChange, name, labels, compact = false }: { value: number | null; onChange: (v: number) => void; name: string; labels: string[]; compact?: boolean }) {
  return <RadioGroup className={`rating-grid ${compact ? "compact" : ""}`} value={value ? String(value) : ""} onValueChange={v => onChange(Number(v))} aria-label={name}>
    {labels.map((label, index) => { const Face = faces[index]; return <label key={label} className={`rating-tile ${value === index + 1 ? "selected" : ""}`}><RadioGroupItem value={String(index + 1)} className="rating-radio" aria-label={`${name}: ${label}`} /><Face className={`face face-${index}`} strokeWidth={1.55} aria-hidden="true" /><span>{label}</span><span className="rating-check" aria-hidden="true"><Check size={12} /></span></label>; })}
  </RadioGroup>;
}
export default function Kiosk() {
  const [language, setLanguage] = useState<Language>("en");
  const t = translations[language];
  const [step, setStep] = useState(0), [answers, setAnswers] = useState<Answers>({ ...emptyAnswers });
  const [busy, setBusy] = useState(false), [error, setError] = useState(false);
  const [privacy, setPrivacy] = useState(false), [restart, setRestart] = useState(false), [idle, setIdle] = useState(false);
  const [countdown, setCountdown] = useState(30), [doneSeconds, setDoneSeconds] = useState(10), [offlineReady, setOfflineReady] = useState(false);
  const submissionId = useRef<string | null>(null), submissionLock = useRef(false), activity = useRef(Date.now()), titleRef = useRef<HTMLHeadingElement>(null);
  const reset = useCallback(() => { setLanguage("en"); setStep(0); setAnswers({ ...emptyAnswers }); setError(false); setIdle(false); setRestart(false); setDoneSeconds(10); submissionId.current = null; activity.current = Date.now(); }, []);
  useEffect(() => { document.documentElement.lang = language; document.title = t.pageTitle; return () => { document.documentElement.lang = "en"; }; }, [language, t.pageTitle]);
  const update = <K extends keyof Answers>(key: K, value: Answers[K]) => setAnswers(a => ({ ...a, [key]: value }));
  const go = (next: number) => { setError(false); setStep(next); activity.current = Date.now(); };
  useEffect(() => {
    const sync = () => { void syncFeedback().catch(() => {}); }; sync();
    const timer = setInterval(sync, 20000); window.addEventListener("online", sync);
    const ready = (event: MessageEvent) => { if (event.data?.type === "KIOSK_CACHED") setOfflineReady(true); };
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.addEventListener("message", ready);
      navigator.serviceWorker.register("/sw.js").then(() => navigator.serviceWorker.ready).then(reg => {
        const assets = [...document.querySelectorAll<HTMLScriptElement>("script[src]")].map(s => s.src).concat([...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].map(l => l.href));
        assets.push(...performance.getEntriesByType("resource").map(r => r.name).filter(u => /\.(js|css|woff2|ttf)(\?|$)/.test(u)));
        reg.active?.postMessage({ type: "CACHE_KIOSK", urls: assets });
      }).catch(() => {});
    }
    return () => { clearInterval(timer); window.removeEventListener("online", sync); navigator.serviceWorker?.removeEventListener("message", ready); };
  }, []);
  useEffect(() => { if (step > 0 && step < 4) titleRef.current?.focus({ preventScroll: true }); }, [step]);
  useEffect(() => {
    const touch = () => { if (!idle) activity.current = Date.now(); };
    window.addEventListener("pointerdown", touch); window.addEventListener("keydown", touch);
    const timer = setInterval(() => { if (step > 0 && step < 4 && !busy && !privacy && !restart) {
      const remaining = getSettings().idleSeconds + 30 - Math.floor((Date.now() - activity.current) / 1000);
      if (remaining <= 0) reset(); else if (remaining <= 30) { setIdle(true); setCountdown(remaining); }
    } }, 1000);
    return () => { clearInterval(timer); window.removeEventListener("pointerdown", touch); window.removeEventListener("keydown", touch); };
  }, [step, idle, busy, privacy, restart, reset]);
  useEffect(() => { if (step !== 4) return; const timer = setInterval(() => setDoneSeconds(s => s - 1), 1000); return () => clearInterval(timer); }, [step]);
  useEffect(() => { if (step === 4 && doneSeconds <= 0) reset(); }, [doneSeconds, step, reset]);
  useEffect(() => {
    const context = (document as unknown as { modelContext?: { registerTool: (tool: unknown, options: unknown) => Promise<void> } }).modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    void Promise.resolve(context.registerTool({ name: "start_toyota_feedback", title: "Start visitor feedback", description: "Record the visitor's chosen overall rating and open the next survey screen. Does not submit feedback.", inputSchema: { type: "object", properties: { overall: { type: "integer", minimum: 1, maximum: 5 } }, required: ["overall"], additionalProperties: false }, annotations: { readOnlyHint: false }, execute(input: unknown) { const v = input as { overall?: number }; if (!v || !Number.isInteger(v.overall) || v.overall! < 1 || v.overall! > 5) throw new Error("Choose an overall rating from 1 to 5."); setAnswers(a => ({ ...a, overall: v.overall! })); setStep(1); activity.current = Date.now(); return { screen: "The experience", overall: v.overall, submitted: false }; } }, { signal: controller.signal })).catch(() => {});
    return () => controller.abort();
  }, []);
  async function submit() {
    if (submissionLock.current) return; submissionLock.current = true; setBusy(true); setError(false);
    try {
      submissionId.current ??= crypto.randomUUID();
      await saveFeedback({ ...answers, other: answers.highlights.includes("Other") ? answers.other.trim() : "", comment: answers.comment.trim(), id: submissionId.current, kioskId: kioskId(), kioskName: getSettings().name, surveyVersion: 1, language, createdAt: new Date().toISOString() });
      if (navigator.storage?.persist) void navigator.storage.persist().catch(() => {});
      setDoneSeconds(10); go(4); void syncFeedback().catch(() => {});
    } catch { setError(true); }
    finally { submissionLock.current = false; setBusy(false); }
  }
  return <div className={`kiosk-shell step-${step}`} lang={language}>
    <header className="site-header"><a className="brand" href="/" aria-label={t.home} onClick={e => { e.preventDefault(); if(step > 0 && step < 4) setRestart(true); else reset(); }}><img className="toyota-logo" src="/toyota-logo.svg" alt="Toyota" /><span className="brand-divider" /><span className="brand-title">{t.brand}</span></a><div className="header-right"><span className="header-note">{t.headerNote}</span><div className="language"><Globe2 size={18} aria-hidden="true" /><RadioGroup className="language-options" aria-label={t.language} value={language} disabled={busy} onValueChange={value => { if (isLanguage(value)) { setLanguage(value); activity.current = Date.now(); } }}>{languageCodes.map(code => <label key={code} className={`language-option ${language === code ? "selected" : ""}`} lang={code}><RadioGroupItem value={code} className="rating-radio" aria-label={languageNames[code]} /><span>{languageNames[code]}</span></label>)}</RadioGroup></div></div></header>
    <main className={`kiosk-main ${step === 4 ? "is-complete" : ""}`}>
      <aside className="hero-panel"><img className="hero-photo" src="/toyota-supra.jpg" alt={t.heroAlt} /><div className="hero-shade" /><div className="hero-copy"><span className="eyebrow hero-eyebrow"><span />{t.heroEyebrow}</span><h2>{t.heroTitle}</h2><p>{t.heroIntro}</p></div><div className="hero-caption"><span>{t.heroCaption}<br /><strong>{t.heroCaptionStrong}</strong></span><span className="caption-rule" /></div></aside>
      <section className="survey-panel" aria-label={t.survey}>
        {step !== 4 && <div className="survey-top"><span className="time-badge"><Clock3 size={15} /> {t.minute}</span><span className="step-count">{String(step + 1).padStart(2,"0")} <span>/ 04</span></span></div>}
        <div className="survey-content" key={step}>
          {step === 0 && <><span className="eyebrow panel-eyebrow">{t.before}</span><h1>{t.welcomeTitle[0]}<br /><span>{t.welcomeTitle[1]}</span></h1><p className="intro">{t.welcomeIntro}</p><div className="question-block"><h2>{t.overallQuestion}</h2><p className="question-hint">{t.tapHint}</p><Ratings value={answers.overall} onChange={v => { update("overall", v); go(1); }} name={t.overall} labels={t.ratings} /></div><div className="welcome-assurance"><span><CheckCheck size={17} /> {t.quickTaps}</span><span><ShieldCheck size={16} /> {t.noDetails}</span></div>{answers.overall > 0 && <button className="back-button" onClick={() => go(1)}>{t.continueRating} <ArrowRight size={16}/></button>}</>}
          {step === 1 && <><span className="eyebrow panel-eyebrow">{t.stages[1]}</span><h1 ref={titleRef} tabIndex={-1} className="step-heading">{t.experienceTitle}</h1><p className="intro small-intro">{t.experienceIntro}</p><div className="question-block"><h2>{t.presentationQuestion}</h2><Ratings compact value={answers.presentation} onChange={v => update("presentation",v)} name={t.presentation} labels={t.ratings} /></div><div className="question-block learning"><h2>{t.informativeQuestion}</h2><RadioGroup aria-label={t.informativeQuestion} className="learning-grid" value={answers.informative ? String(answers.informative) : ""} onValueChange={v => update("informative", Number(v))}>{t.informative.map((label,i) => <label className={`choice-pill ${answers.informative === i+1 ? "selected" : ""}`} key={label}><RadioGroupItem value={String(i+1)} aria-label={label} /><span>{label}</span></label>)}</RadioGroup></div></>}
          {step === 2 && <><span className="eyebrow panel-eyebrow">{t.stages[2]}</span><h1 ref={titleRef} tabIndex={-1} className="step-heading">{t.highlightsTitle}</h1><p className="intro small-intro">{t.highlightsIntro}</p><div className="highlight-grid">{highlights.map((label,i) => { const Icon = featureIcons[i]; return <label key={label} className={`highlight-tile ${answers.highlights.includes(label) ? "selected" : ""}`}><Icon size={25} strokeWidth={1.5} /><span>{t.highlights[label]}</span><Checkbox checked={answers.highlights.includes(label)} onCheckedChange={checked => update("highlights", checked ? [...answers.highlights,label] : answers.highlights.filter(h => h !== label))} aria-label={t.highlights[label]} /></label>; })}</div>{answers.highlights.includes("Other") && <label className="field-label other-field">{t.otherQuestion} <span>{t.optional}</span><input maxLength={120} value={answers.other} onChange={e => update("other",e.target.value)} placeholder={t.otherPlaceholder} /></label>}</>}
          {step === 3 && <><span className="eyebrow panel-eyebrow">{t.stages[3]}</span><h1 ref={titleRef} tabIndex={-1} className="step-heading">{t.finalTitle}</h1><p className="intro small-intro">{t.finalIntro}</p><div className="question-block"><h2>{t.recommendQuestion}</h2><RadioGroup className="recommend-grid" aria-label={t.recommendQuestion} value={answers.recommendation || ""} onValueChange={v => update("recommendation",v as Answers["recommendation"])}>{[{v:"yes",label:t.recommendations[0],icon:ThumbsUp},{v:"maybe",label:t.recommendations[1],icon:Meh},{v:"no",label:t.recommendations[2],icon:MessageCircle}].map(({v,label,icon:Icon}) => <label key={v} className={`recommend-tile ${answers.recommendation === v ? "selected" : ""}`}><RadioGroupItem value={v} className="rating-radio" aria-label={label} /><Icon size={23} strokeWidth={1.5} /><span>{label}</span></label>)}</RadioGroup></div><label className="field-label comment-label">{t.commentQuestion}<span>{t.optional}</span><textarea rows={3} maxLength={500} value={answers.comment} onChange={e => update("comment",e.target.value)} placeholder={t.commentPlaceholder} /><span className="field-bottom"><span>{t.noPersonalDetails}</span><span>{answers.comment.length}/500</span></span></label></>}
          {step === 4 && <div className="thank-you"><div className="thank-icon"><Check size={40} strokeWidth={1.7} /></div><span className="eyebrow panel-eyebrow">{t.received}</span><h1>{t.thankTitle[0]}<br /><span>{t.thankTitle[1]}</span></h1><p className="intro">{t.thankIntro}</p><div className="thank-line" /><p className="thank-note">{t.thankNote}</p><button className="primary-button done-button" onClick={reset}>{t.done} <ArrowRight size={20}/></button><p className="reset-note">{formatMessage(t.resetIn, { seconds: doneSeconds })}</p></div>}
        </div>
        {error && <p className="error-message" role="alert">{t.saveError}</p>}
        {step > 0 && step < 4 && <div className="survey-actions"><button className="back-button" onClick={() => go(step - 1)} disabled={busy}><ArrowLeft size={18} /> {t.back}</button><span className="optional-note">{t.questionsOptional}</span><button className="primary-button" disabled={busy} onClick={() => step === 3 ? submit() : go(step+1)}>{busy ? t.saving : step === 3 ? t.submit : t.continue}<ArrowRight size={19} /></button></div>}
        {step !== 4 && <div className="journey-footer"><div className="journey-label"><span>{t.stages[step]}</span><span>{step === 0 ? t.journeyHint : formatMessage(t.step, { step: step + 1 })}</span></div><Progress value={(step + 1)*25} className="journey-progress" aria-label={formatMessage(t.step, { step: step + 1 })} /></div>}
      </section>
    </main>
    <footer className="site-footer"><span>{t.footer}</span><div><button onClick={() => setPrivacy(true)}><LockKeyhole size={12}/> {t.privacy}</button>{step > 0 && step < 4 && <button onClick={() => setRestart(true)}><RotateCcw size={12}/> {t.restart}</button>}<a href="/staff" className="staff-link">{t.staff}</a></div></footer>
    <Dialog open={privacy} onOpenChange={open => { setPrivacy(open); activity.current = Date.now(); }}><DialogContent className="kiosk-dialog" lang={language} showCloseButton={false}><DialogClose className="localized-dialog-close" aria-label={t.close}>×</DialogClose><ShieldCheck className="dialog-icon"/><DialogTitle>{t.privacyTitle}</DialogTitle><DialogDescription>{t.privacyDescription}</DialogDescription><p className="dialog-detail">{t.privacyDetail}</p><button className="primary-button" onClick={() => { setPrivacy(false); activity.current = Date.now(); }}>{t.gotIt} <Check size={18}/></button></DialogContent></Dialog>
    <Dialog open={restart} onOpenChange={open => { setRestart(open); activity.current = Date.now(); }}><DialogContent className="kiosk-dialog" lang={language} showCloseButton={false}><DialogClose className="localized-dialog-close" aria-label={t.close}>×</DialogClose><DialogTitle>{t.restartTitle}</DialogTitle><DialogDescription>{t.restartDescription}</DialogDescription><div className="dialog-actions"><button className="secondary-button" onClick={() => {setRestart(false); activity.current=Date.now();}}>{t.keepAnswering}</button><button className="primary-button" onClick={reset}>{t.restart}</button></div></DialogContent></Dialog>
    <Dialog open={idle} onOpenChange={open => { if (!open) { setIdle(false); activity.current=Date.now(); } }}><DialogContent className="kiosk-dialog" lang={language} showCloseButton={false}><Clock3 className="dialog-icon"/><DialogTitle>{t.idleTitle}</DialogTitle><DialogDescription>{formatMessage(t.idleDescription, { seconds: countdown })}</DialogDescription><button className="primary-button" onClick={() => { setIdle(false); activity.current=Date.now(); }}>{t.stillHere} <ArrowRight size={18}/></button><button className="back-button" onClick={reset}>{t.finishWithoutSubmitting}</button></DialogContent></Dialog>
    <span className="sr-only" data-offline-ready={offlineReady}>{offlineReady ? t.offlineReady : ""}</span>
  </div>;
}
