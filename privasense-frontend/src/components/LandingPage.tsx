import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router-dom";
import { Heart, ShieldCheck, UserRound, Users, Clock, Globe, ChevronDown } from "lucide-react";
import { useState, useEffect } from "react";
import { apiService } from "../services/apiService";

const translations = {
  English: {
    tagline: "Secure Healthcare Companion",
    heroTitle: "Reliable care for the ones who ",
    heroItalic: "raised us.",
    heroSub: "Choose your journey to start monitoring health tasks, sharing medical history, or coordinating care.",
    elderlyTitle: "Elderly Login",
    elderlyDesc: "Generate your unique code, manage your 14-day health plan, and share history securely.",
    elderlyAction: "Open Section",
    caregiverTitle: "Caregiver Login",
    caregiverDesc: "Enter a patient code to verify connection, setup your profile, and receive detailed reports.",
    caregiverAction: "Connect Now",
    trust: "Trust & Security",
    encryption: "End-to-end encrypted medical data sharing."
  },
  Hindi: {
    tagline: "सुरक्षित स्वास्थ्य साथी",
    heroTitle: "उनकी विश्वसनीय देखभाल जिन्होंने ",
    heroItalic: "हमें पाला है।",
    heroSub: "स्वास्थ्य कार्यों की निगरानी, चिकित्सा इतिहास साझा करने या देखभाल के समन्वय के लिए अपनी यात्रा चुनें।",
    elderlyTitle: "बुजुर्ग लॉगिन",
    elderlyDesc: "अपना अनूठा कोड जनरेट करें, अपनी 14-दिवसीय स्वास्थ्य योजना प्रबंधित करें और इतिहास सुरक्षित रूप से साझा करें।",
    elderlyAction: "अनुभाग खोलें",
    caregiverTitle: "देखभाल करने वाला लॉगिन",
    caregiverDesc: "कनेक्शन सत्यापित करने, अपनी प्रोफ़ाइल सेट करने और विस्तृत रिपोर्ट प्राप्त करने के लिए रोगी कोड दर्ज करें।",
    caregiverAction: "अभी जुड़ें",
    trust: "विश्वास और सुरक्षा",
    encryption: "एंड-टू-एंड एन्क्रिप्टेड चिकित्सा डेटा साझाकरण।"
  },
  Tamil: {
    tagline: "பாதுகாப்பான சுகாதார துணை",
    heroTitle: "நம்மை வளர்த்தவர்களுக்கு ",
    heroItalic: "நம்பகமான கவனிப்பு.",
    heroSub: "சுகாதாரப் பணிகளைக் கண்காணிக்க, மருத்துவ வரலாற்றைப் பகிர அல்லது கவனிப்பை ஒருங்கிணைக்க உங்கள் பயணத்தைத் தேர்வுசெய்க.",
    elderlyTitle: "வயதானவர் உள்நுழைவு",
    elderlyDesc: "உங்கள் தனிப்பட்ட குறியீட்டை உருவாக்கவும், உங்கள் 14 நாள் சுகாதாரத் திட்டத்தை நிர்வகிக்கவும் மற்றும் வரலாற்றைப் பாதுகாப்பாகப் பகிரவும்.",
    elderlyAction: "பிரிவைத் திற",
    caregiverTitle: "கவனிப்பாளர் உள்நுழைவு",
    caregiverDesc: "இணைப்பைச் சரிபார்க்க நோயாளியின் குறியீட்டை உள்ளிடவும், உங்கள் சுயவிவரத்தை அமைக்கவும் மற்றும் விரிவான அறிக்கைகளைப் பெறவும்.",
    caregiverAction: "இப்போது இணையுங்கள்",
    trust: "நம்பிக்கை மற்றும் பாதுகாப்பு",
    encryption: "முனை-முதல்-முனை மறையாக்கப்பட்ட மருத்துவ தரவுப் பகிர்வு."
  },
  Telugu: {
    tagline: "సురక్షితమైన ఆరోగ్య సహచరుడు",
    heroTitle: "మమ్మల్ని పెంచిన వారి కోసం ",
    heroItalic: "నమ్మకమైన సంరక్షణ.",
    heroSub: "ఆరోగ్య పనులను పర్యవేక్షించడానికి, వైద్య చరిత్రను పంచుకోవడానికి లేదా సంరక్షణను సమన్వయం చేయడానికి మీ ప్రయాణాన్ని ఎంచుకోండి.",
    elderlyTitle: "వయోవృద్ధుల లాగిన్",
    elderlyDesc: "మీ ప్రత్యేక కోడ్‌ని రూపొందించండి, మీ 14 రోజుల ఆరోగ్య ప్రణాళికను నిర్వహించండి మరియు చరిత్రను సురక్షితంగా పంచుకోండి.",
    elderlyAction: "విభాగాన్ని తెరువు",
    caregiverTitle: "సంరక్షకుని లాగిన్",
    caregiverDesc: "కనెక్షన్‌ని ధృవీకరించడానికి రోగి కోడ్ నమోదు చేయండి, మీ ప్రొఫైల్‌ను సెటప్ చేయండి మరియు వివరణాత్మక నివేదికలను పొందండి.",
    caregiverAction: "ఇప్పుడే కనెక్ట్ అవ్వండి",
    trust: "నమ్మకం & భద్రత",
    encryption: "ఎండ్-టు-ఎండ్ ఎన్‌క్రిప్టెడ్ వైద్య డేటా షేరింగ్."
  },
  Bengali: {
    tagline: "সুরক্ষিত স্বাস্থ্য সহযোগী",
    heroTitle: "যারা আমাদের বড় করেছেন তাদের জন্য ",
    heroItalic: "নির্ভরযোগ্য যত্ন।",
    heroSub: "স্বাস্থ্য কাজগুলি পর্যবেক্ষণ করতে, চিকিৎসার ইতিহাস ভাগ করতে বা যত্নের সমন্বয় করতে আপনার যাত্রা বেছে নিন।",
    elderlyTitle: "বয়স্কদের লগইন",
    elderlyDesc: "আপনার অনন্য কোড তৈরি করুন, আপনার ১৪ দিনের স্বাস্থ্য পরিকল্পনা পরিচালনা করুন এবং ইতিহাস সুরক্ষিতভাবে ভাগ করুন।",
    elderlyAction: "বিভাগ খুলুন",
    caregiverTitle: "কেয়ারগিভার লগইন",
    caregiverDesc: "সংযোগ যাচাই করতে রোগীর কোড লিখুন, আপনার প্রোফাইল সেট আপ করুন এবং বিস্তারিত রিপোর্ট পান।",
    caregiverAction: "এখনই যুক্ত হন",
    trust: "বিশ্বাস ও নিরাপত্তা",
    encryption: "এন্ড-টু-এন্ড এনক্রিপ্টেড চিকিৎসা ডাটা ভাগ করে নেওয়া।"
  },
  Kannada: {
    tagline: "ಸುರಕ್ಷಿತ ಆರೋಗ್ಯ ಸಹಚರ",
    heroTitle: "ನಮ್ಮನ್ನು ಬೆಳೆಸಿದವರಿಗಾಗಿ ",
    heroItalic: "ವಿಶ್ವಾಸಾರ್ಹ ಆರೈಕೆ.",
    heroSub: "ಆರೋಗ್ಯ ಕಾರ್ಯಗಳನ್ನು ಮೇಲ್ವಿಚಾರಣೆ ಮಾಡಲು, ವೈದ್ಯಕೀಯ ಇತಿಹಾಸವನ್ನು ಹಂಚಿಕೊಳ್ಳಲು ಅಥವಾ ಆರೈಕೆಯನ್ನು ಸಂಯೋಜಿಸಲು ನಿಮ್ಮ ಪ್ರಯಾಣವನ್ನು ಆರಿಸಿ.",
    elderlyTitle: "ವೃದ್ಧರ ಲಾಗಿನ್",
    elderlyDesc: "ನಿಮ್ಮ ಅನನ್ಯ ಕೋಡ್ ಅನ್ನು ರಚಿಸಿ, ನಿಮ್ಮ 14-ದಿನದ ಆರೋಗ್ಯ ಯೋಜನೆಯನ್ನು ನಿರ್ವಹಿಸಿ ಮತ್ತು ಇತಿಹಾಸವನ್ನು ಸುರಕ್ಷಿತವಾಗಿ ಹಂಚಿಕೊಳ್ಳಿ.",
    elderlyAction: "ವಿಭಾಗವನ್ನು ತೆರೆಯಿರಿ",
    caregiverTitle: "ಆರೈಕೆದಾರರ ಲಾಗಿನ್",
    caregiverDesc: "ಸಂಪರ್ಕವನ್ನು ಪರಿಶೀಲಿಸಲು ರೋಗಿಯ ಕೋಡ್ ನಮೂದಿಸಿ, ನಿಮ್ಮ ಪ್ರೊಫೈಲ್ ಹೊಂದಿಸಿ ಮತ್ತು ವರದಿಗಳನ್ನು ಪಡೆಯಿರಿ.",
    caregiverAction: "ಈಗಲೇ ಸಂಪರ್ಕಿಸಿ",
    trust: "ನಂಬಿಕೆ & ಭದ್ರತೆ",
    encryption: "ಎಂಡ್-ಟು-ಎಂಡ್ ಎನ್‌ಕ್ರಿಪ್ಟೆಡ್ ವೈದ್ಯಕೀಯ ಡೇಟಾ ಹಂಚಿಕೆ."
  }
};

type Language = "English" | "Hindi" | "Tamil" | "Telugu" | "Bengali" | "Kannada";

export const LandingPage = () => {
  const navigate = useNavigate();
  const [time, setTime] = useState("");
  const [language, setLanguage] = useState<Language>(() => {
    return (localStorage.getItem("appLanguage") as Language) || "English";
  });
  const [showLanguages, setShowLanguages] = useState(false);
  const [backendStatus, setBackendStatus] = useState<"connecting" | "online" | "offline">("connecting");

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const status = await apiService.healthCheck();
        if (status.status === "ok") setBackendStatus("online");
        else setBackendStatus("offline");
      } catch (e) {
        setBackendStatus("offline");
      }
    };
    checkBackend();
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-GB', { hour12: false }));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    localStorage.setItem("appLanguage", language);
  }, [language]);

  const t = translations[language];

  return (
    <div className="min-h-[100dvh] w-full overflow-hidden bg-[#F5F5F0] font-sans selection:bg-stone-200 text-stone-900 flex flex-col">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-stone-200/50 bg-[#F5F5F0]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between p-4 md:px-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-900 text-white shadow-sm">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <span className="text-xl font-bold tracking-tight">PrivaSense</span>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            {/* Backend Status Indicator */}
            <div className={`flex items-center gap-2 rounded-full bg-white px-4 py-1.5 shadow-sm ring-1 transition-all ${
              backendStatus === "online" ? "ring-emerald-200" : backendStatus === "offline" ? "ring-rose-200" : "ring-stone-200"
            }`}>
              <div className={`h-2 w-2 rounded-full ${
                backendStatus === "online" ? "bg-emerald-500 animate-pulse" : backendStatus === "offline" ? "bg-rose-500" : "bg-stone-300"
              }`} />
              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">
                Backend {backendStatus}
              </span>
            </div>

            {/* Clock */}
            <div className="hidden sm:flex items-center gap-2 rounded-full bg-white px-4 py-1.5 shadow-sm ring-1 ring-stone-200">
              <Clock className="h-4 w-4 text-stone-400" />
              <span className="font-mono text-sm font-semibold text-stone-600">{time}</span>
            </div>

            {/* Language Selector */}
            <div className="relative">
              <button
                onClick={() => setShowLanguages(!showLanguages)}
                className="flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-stone-600 shadow-sm ring-1 ring-stone-200 transition-all hover:bg-stone-50"
              >
                <Globe className="h-4 w-4 text-stone-400" />
                <span className="hidden xs:inline">{language}</span>
                <ChevronDown className={`h-3 w-3 transition-transform ${showLanguages ? "rotate-180" : ""}`} />
              </button>

              <AnimatePresence>
                {showLanguages && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 mt-2 w-40 overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-stone-200"
                  >
                    {(Object.keys(translations) as Language[]).map((lang) => (
                      <button
                        key={lang}
                        onClick={() => {
                          setLanguage(lang);
                          setShowLanguages(false);
                        }}
                        className={`block w-full px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-stone-50 ${
                          language === lang ? "bg-stone-50 text-stone-900" : "text-stone-500"
                        }`}
                      >
                        {lang}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 w-full mx-auto flex max-w-7xl flex-col items-center justify-center px-4 sm:px-6 pt-20 pb-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-xl shadow-stone-200/50">
             <Heart className="h-8 w-8 text-rose-500" />
          </div>
          <h1 className="max-w-4xl text-4xl font-medium tracking-tight text-stone-900 sm:text-5xl lg:text-7xl">
            {t.heroTitle} <span className="italic text-stone-500">{t.heroItalic}</span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg text-stone-600 sm:text-xl">
            {t.heroSub}
          </p>
        </motion.div>

        {/* Action Buttons */}
        <div className="mt-10 lg:mt-16 grid w-full max-w-4xl gap-4 sm:gap-6 sm:grid-cols-2">
          <motion.button
            id="elderly-login-btn"
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate("/elderly")}
            className="group relative flex flex-col items-start rounded-2xl sm:rounded-[32px] bg-white p-6 sm:p-8 text-left shadow-xl shadow-stone-200/50 transition-all hover:shadow-2xl hover:shadow-stone-300/60 md:p-10"
          >
            <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-50 text-stone-900 transition-colors duration-300 group-hover:bg-stone-900 group-hover:text-white">
              <UserRound className="h-7 w-7" />
            </div>
            <h2 className="text-2xl font-semibold text-stone-900 md:text-3xl">{t.elderlyTitle}</h2>
            <p className="mt-3 text-stone-500 leading-relaxed">
              {t.elderlyDesc}
            </p>
            <div className="mt-8 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-stone-900">
              {t.elderlyAction} 
              <span className="inline-block transform transition-transform group-hover:translate-x-1">→</span>
            </div>
          </motion.button>

          <motion.button
            id="caregiver-login-btn"
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate("/caregiver")}
            className="group relative flex flex-col items-start rounded-2xl sm:rounded-[32px] bg-stone-900 p-6 sm:p-8 text-left shadow-xl shadow-stone-900/10 transition-all hover:bg-stone-800 md:p-10"
          >
            <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-800 text-stone-100 transition-colors duration-300 group-hover:bg-white group-hover:text-stone-900">
              <Users className="h-7 w-7" />
            </div>
            <h2 className="text-2xl font-semibold text-white md:text-3xl">{t.caregiverTitle}</h2>
            <p className="mt-3 text-stone-400 leading-relaxed">
              {t.caregiverDesc}
            </p>
            <div className="mt-8 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-white">
              {t.caregiverAction} 
              <span className="inline-block transform transition-transform group-hover:translate-x-1">→</span>
            </div>
          </motion.button>
        </div>

        {/* Subtle Footer Link */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 1 }}
          className="mt-10 lg:mt-16 space-y-4 text-center"
        >
          <div className="flex items-center justify-center gap-4 text-stone-400">
            <span className="h-px w-8 bg-stone-200"></span>
            <p className="text-xs font-semibold uppercase tracking-widest">{t.trust}</p>
            <span className="h-px w-8 bg-stone-200"></span>
          </div>
          <p className="text-sm text-stone-500">
            {t.encryption}
          </p>
        </motion.div>
      </main>
    </div>
  );
};
