/**
 * CLAUDE.md tech stack: "i18n | react-i18next + expo-localization — English, Hindi,
 * Tamil" and §2.1 Rule 6: task cards need "a voice read-out in the operator's own
 * language (en/hi/ta)." Scoped to the Today screen (the task-card screen Rule 6 names
 * directly) plus its voice read-out — the assistant already had its own en/hi/ta
 * handling (lib/assistant/voice.ts, store/language.ts) before this file existed; this
 * extends the same three languages to the general UI instead of introducing a second
 * language mechanism.
 */

export const resources = {
  en: {
    translation: {
      today: {
        title: "Today's tasks",
        tasksScheduled_one: "{{count}} task scheduled today",
        tasksScheduled_other: "{{count}} tasks scheduled today",
        liveFromBackend: "live from backend",
        demoData: "demo data",
        reorderAnytime: "reorder anytime",
        inProgress: "In progress",
        upNext: "Up next",
      },
      task: {
        est: "Est.",
        minRange: "min (P50–P90)",
        reScoredOffline: "~Re-scored offline:",
        minApproximate: "min (approximate)",
        depth: "Depth",
        start: "Start task",
        pause: "Pause",
        complete: "Complete",
      },
      risk: {
        safe: "Low risk",
        caution: "Weather risk",
        danger: "High risk",
      },
      quickActions: {
        preStartChecklist: "Pre-start checklist",
        doneCount: "{{done}}/{{total}} done",
        endOfShiftLog: "End-of-shift log",
        autoFilled: "Auto-filled",
      },
      voice: {
        taskReadout: "{{title}}.{{depthText}} Estimated {{p50}} to {{p90}} minutes.{{hazardText}}",
        digDepth: " Dig depth {{depth}}.",
        knownHazards: " Known hazards: {{hazards}}.",
      },
    },
  },
  hi: {
    translation: {
      today: {
        title: "आज के कार्य",
        tasksScheduled_one: "आज {{count}} कार्य निर्धारित है",
        tasksScheduled_other: "आज {{count}} कार्य निर्धारित हैं",
        liveFromBackend: "बैकएंड से लाइव",
        demoData: "डेमो डेटा",
        reorderAnytime: "कभी भी पुनर्व्यवस्थित करें",
        inProgress: "प्रगति पर",
        upNext: "आगे क्या है",
      },
      task: {
        est: "अनुमान",
        minRange: "मिनट (P50–P90)",
        reScoredOffline: "~ऑफ़लाइन पुनः अनुमानित:",
        minApproximate: "मिनट (अनुमानित)",
        depth: "गहराई",
        start: "कार्य शुरू करें",
        pause: "रोकें",
        complete: "पूर्ण करें",
      },
      risk: {
        safe: "कम जोखिम",
        caution: "मौसम जोखिम",
        danger: "उच्च जोखिम",
      },
      quickActions: {
        preStartChecklist: "शुरुआत-पूर्व जांच सूची",
        doneCount: "{{done}}/{{total}} पूर्ण",
        endOfShiftLog: "शिफ्ट-समाप्ति लॉग",
        autoFilled: "स्वतः भरा गया",
      },
      voice: {
        taskReadout: "{{title}}.{{depthText}} अनुमानित समय {{p50}} से {{p90}} मिनट.{{hazardText}}",
        digDepth: " खुदाई की गहराई {{depth}}.",
        knownHazards: " ज्ञात खतरे: {{hazards}}.",
      },
    },
  },
  ta: {
    translation: {
      today: {
        title: "இன்றைய பணிகள்",
        tasksScheduled_one: "இன்று {{count}} பணி திட்டமிடப்பட்டுள்ளது",
        tasksScheduled_other: "இன்று {{count}} பணிகள் திட்டமிடப்பட்டுள்ளன",
        liveFromBackend: "பேக்எண்டிலிருந்து நேரடியாக",
        demoData: "டெமோ தரவு",
        reorderAnytime: "எப்போது வேண்டுமானாலும் மறுவரிசைப்படுத்தலாம்",
        inProgress: "நடந்து கொண்டிருக்கிறது",
        upNext: "அடுத்து என்ன",
      },
      task: {
        est: "மதிப்பீடு",
        minRange: "நிமிடம் (P50–P90)",
        reScoredOffline: "~ஆஃப்லைனில் மீண்டும் மதிப்பிடப்பட்டது:",
        minApproximate: "நிமிடம் (தோராயமானது)",
        depth: "ஆழம்",
        start: "பணியைத் தொடங்கு",
        pause: "இடைநிறுத்து",
        complete: "முடி",
      },
      risk: {
        safe: "குறைந்த ஆபத்து",
        caution: "வானிலை ஆபத்து",
        danger: "அதிக ஆபத்து",
      },
      quickActions: {
        preStartChecklist: "தொடங்குமுன் சரிபார்ப்புப் பட்டியல்",
        doneCount: "{{done}}/{{total}} முடிந்தது",
        endOfShiftLog: "ஷிப்ட் முடிவு பதிவு",
        autoFilled: "தானாக நிரப்பப்பட்டது",
      },
      voice: {
        taskReadout: "{{title}}.{{depthText}} மதிப்பிடப்பட்ட நேரம் {{p50}} முதல் {{p90}} நிமிடங்கள் வரை.{{hazardText}}",
        digDepth: " தோண்டும் ஆழம் {{depth}}.",
        knownHazards: " அறியப்பட்ட ஆபத்துகள்: {{hazards}}.",
      },
    },
  },
} as const;

export type SupportedLanguage = keyof typeof resources;
