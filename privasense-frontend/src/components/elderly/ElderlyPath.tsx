import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router-dom";
import { 
  History, 
  ArrowRight, 
  ClipboardCheck, 
  LayoutDashboard, 
  Upload, 
  ChevronRight,
  Sparkles,
  FileText,
  ArrowLeft,
  Mic,
  MicOff,
  User,
  Loader2,
  CheckCircle2,
  Info,
  X,
  ShieldAlert,
  Stethoscope,
  Heart,
  Activity,
  Lock
} from "lucide-react";
import { customAlphabet } from "nanoid";
import { analyzeMedicalHistory, Task, getTaskGuidance, processSpeech } from "../../services/aiService";
import { getTranslation, AppLanguage } from "../../lib/translations";
import { apiService } from "../../services/apiService";

// Generate a 6-digit numeric code
const generateShortCode = customAlphabet("0123456789", 6);

type Step = "PROFILE_SETUP" | "CODE_DISPLAY" | "HISTORY_GATE" | "ASSESSMENT" | "MULTI_MODAL_TEST" | "PROCESSING" | "DASHBOARD";

export const ElderlyPath = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("PROFILE_SETUP");
  const [uniqueCode, setUniqueCode] = useState<string>("");
  const [hasUploadedHistory, setHasUploadedHistory] = useState(false);
  const [isInAssessment, setIsInAssessment] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [listeningField, setListeningField] = useState<string | null>(null);
  const [detectedSpeech, setDetectedSpeech] = useState("");
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [profile, setProfile] = useState({ 
    name: "", 
    age: "", 
    gender: "Male",
    lifestyle: {
      smoke: "No",
      drink: "No",
      activityLevel: "Moderate"
    },
    vitals: {
      systolicBP: "",
      diastolicBP: "",
      heartRate: "",
      spo2: "",
      weight: "",
      respirationRate: "",
      temperature: "",
      supplementalOxygen: "No",
      consciousness: "Alert"
    }
  });
  
  // Lock to prevent concurrent AI generation calls
  const isGeneratingRef = useRef(false);

  // Multi-modal Test State
  const [testStage, setTestStage] = useState<"SPEECH" | "MOTOR" | "MEMORY">("SPEECH");
  const [testResults, setTestResults] = useState<any>({});
  const [motorScore, setMotorScore] = useState(0);
  const [motorTimeLeft, setMotorTimeLeft] = useState(10);
  const [isMotorTestActive, setIsMotorTestActive] = useState(false);
  const [memoryWords] = useState(["Apple", "River", "Watch", "Smile"]);
  const [memoryInput, setMemoryInput] = useState("");
  const [isRecordingTest, setIsRecordingTest] = useState(false);
  const [appLanguage, setAppLanguage] = useState<AppLanguage>((localStorage.getItem("appLanguage") as AppLanguage) || "English");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [analysisStatus, setAnalysisStatus] = useState("");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskGuidance, setTaskGuidance] = useState<string>("");
  const [isLoadingGuidance, setIsLoadingGuidance] = useState(false);
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [questionnaireCompleted, setQuestionnaireCompleted] = useState(false);
  const [isVitalsModalOpen, setIsVitalsModalOpen] = useState(false);
  const [profileCreatedAt, setProfileCreatedAt] = useState<string | null>(localStorage.getItem("profileCreatedAt"));

  // Assessment State
  const [assessmentStep, setAssessmentStep] = useState(0);
  const [assessmentAnswers, setAssessmentAnswers] = useState<string[]>([]);
  
  const getAssessmentQuestions = (lang: AppLanguage) => {
    const q: Record<AppLanguage, { domain: string; question: string; options: string[] }[]> = {
      English: [
        { domain: "Memory", question: "How often have you forgotten names or appointments in the last week?", options: ["Never", "Once or twice", "Frequently"] },
        { domain: "Attention", question: "Do you find it difficult to follow a TV show or a conversation?", options: ["Not at all", "Sometimes", "Very difficult"] },
        { domain: "Language", question: "Are you experiencing 'tip-of-the-tongue' moments more often?", options: ["No", "Occasionally", "Yes, daily"] },
        { domain: "Motor", question: "Have you noticed any change in your typing speed or handwriting?", options: ["No change", "Slightly slower", "Significantly slower"] },
        { domain: "Mood", question: "How often have you felt down, depressed, or hopeless lately?", options: ["Not at all", "Several days", "Nearly every day"] },
        { domain: "Sleep", question: "How would you rate the quality of your sleep?", options: ["Good", "Fair", "Poor"] },
        { domain: "Orientation", question: "Do you sometimes lose track of the day of the week or the date?", options: ["Never", "Rarely", "Often"] },
        { domain: "Social", question: "Have you felt less interested in social activities or hobbies recently?", options: ["No change", "A little less", "Much less"] },
        { domain: "Physical", question: "Do you experience any dizziness or loss of balance when walking?", options: ["Never", "Sometimes", "Frequently"] },
        { domain: "Executive", question: "Do you find it harder to manage daily tasks like bills or cooking?", options: ["Not at all", "A bit harder", "Much harder"] }
      ],
      Hindi: [
        { domain: "Memory", question: "पिछले हफ्ते आप कितनी बार नाम या अपॉइंटमेंट भूले?", options: ["कभी नहीं", "एक-दो बार", "अक्सर"] },
        { domain: "Attention", question: "क्या आपको टीवी शो या बातचीत को समझने में कठिनाई होती है?", options: ["बिल्कुल नहीं", "कभी-कभी", "बहुत कठिन"] },
        { domain: "Language", question: "क्या आपको शब्द याद आने में पहले से ज़्यादा समय लगता है?", options: ["नहीं", "कभी-कभी", "हाँ, रोज़"] },
        { domain: "Motor", question: "क्या आपने लिखावट या टाइपिंग की गति में कोई बदलाव देखा है?", options: ["कोई बदलाव नहीं", "थोड़ा धीमा", "काफ़ी धीमा"] },
        { domain: "Mood", question: "हाल ही में आप कितनी बार उदास या निराश महसूस करते हैं?", options: ["बिल्कुल नहीं", "कुछ दिन", "लगभग हर दिन"] },
        { domain: "Sleep", question: "आपकी नींद की गुणवत्ता कैसी है?", options: ["अच्छी", "ठीक-ठाक", "ख़राब"] },
        { domain: "Orientation", question: "क्या आप कभी-कभी दिन या तारीख भूल जाते हैं?", options: ["कभी नहीं", "कभी-कभी", "अक्सर"] },
        { domain: "Social", question: "क्या आपकी सामाजिक गतिविधियों या शौक में रुचि कम हुई है?", options: ["कोई बदलाव नहीं", "थोड़ी कम", "बहुत कम"] },
        { domain: "Physical", question: "क्या चलते समय आपको चक्कर आता है या संतुलन बिगड़ता है?", options: ["कभी नहीं", "कभी-कभी", "अक्सर"] },
        { domain: "Executive", question: "क्या बिल भरने या खाना बनाने जैसे रोज़मर्रा के काम कठिन हो गए हैं?", options: ["बिल्कुल नहीं", "थोड़ा कठिन", "बहुत कठिन"] }
      ],
      Tamil: [
        { domain: "Memory", question: "கடந்த வாரத்தில் நீங்கள் எத்தனை முறை பெயர்கள் அல்லது சந்திப்புகளை மறந்தீர்கள்?", options: ["ஒருபோதும் இல்லை", "ஒன்று இரண்டு முறை", "அடிக்கடி"] },
        { domain: "Attention", question: "டிவி நிகழ்ச்சி அல்லது உரையாடலைப் புரிந்துகொள்வதில் சிரமம் உள்ளதா?", options: ["இல்லவே இல்லை", "சில நேரம்", "மிகவும் கடினம்"] },
        { domain: "Language", question: "வார்த்தைகள் நாவின் நுனியில் வருவதை அதிகம் உணர்கிறீர்களா?", options: ["இல்லை", "எப்போதாவது", "ஆம், தினமும்"] },
        { domain: "Motor", question: "உங்கள் எழுத்து வேகம் அல்லது கைப்பேசி பயன்பாட்டில் மாற்றம் தெரிகிறதா?", options: ["மாற்றம் இல்லை", "சிறிது மெதுவாக", "மிகவும் மெதுவாக"] },
        { domain: "Mood", question: "சமீபத்தில் நீங்கள் எத்தனை அடிக்கடி சோகமாக உணர்கிறீர்கள்?", options: ["இல்லவே இல்லை", "சில நாட்கள்", "கிட்டத்தட்ட ஒவ்வொரு நாளும்"] },
        { domain: "Sleep", question: "உங்கள் தூக்கத்தின் தரம் எப்படி?", options: ["நன்றாக", "சரியாக", "மோசமாக"] },
        { domain: "Orientation", question: "சில சமயம் கிழமை அல்லது தேதி மறந்து போகிறதா?", options: ["ஒருபோதும் இல்லை", "அரிதாக", "அடிக்கடி"] },
        { domain: "Social", question: "சமூக நடவடிக்கைகள் அல்லது பொழுதுபோக்குகளில் ஆர்வம் குறைந்துள்ளதா?", options: ["மாற்றம் இல்லை", "சிறிது குறைவு", "மிகவும் குறைவு"] },
        { domain: "Physical", question: "நடக்கும் போது தலைச்சுற்றல் அல்லது சமநிலை பிரச்சினை உள்ளதா?", options: ["ஒருபோதும் இல்லை", "சில நேரம்", "அடிக்கடி"] },
        { domain: "Executive", question: "பில் செலுத்துவது அல்லது சமையல் போன்ற அன்றாட பணிகள் கடினமாகிவிட்டதா?", options: ["இல்லவே இல்லை", "சிறிது கடினம்", "மிகவும் கடினம்"] }
      ],
      Telugu: [
        { domain: "Memory", question: "గత వారంలో మీరు ఎన్నిసార్లు పేర్లు లేదా అపాయింట్‌మెంట్‌లు మర్చిపోయారు?", options: ["ఎప్పుడూ లేదు", "ఒకటి రెండుసార్లు", "తరచుగా"] },
        { domain: "Attention", question: "టీవీ షో లేదా సంభాషణను అనుసరించడం కష్టంగా ఉందా?", options: ["అస్సలు కాదు", "కొన్నిసార్లు", "చాలా కష్టం"] },
        { domain: "Language", question: "మాటలు నాలుక చివరన ఆగిపోతున్న అనుభవం ఎక్కువగా ఉందా?", options: ["లేదు", "అప్పుడప్పుడు", "అవును, రోజూ"] },
        { domain: "Motor", question: "మీ చేతి రాత లేదా టైపింగ్ వేగంలో ఏదైనా మార్పు గమనించారా?", options: ["మార్పు లేదు", "కొంచెం నెమ్మదిగా", "చాలా నెమ్మదిగా"] },
        { domain: "Mood", question: "ఇటీవల మీరు ఎంత తరచుగా నిరాశగా లేదా దిగులుగా భావిస్తున్నారు?", options: ["అస్సలు కాదు", "కొన్ని రోజులు", "దాదాపు ప్రతి రోజు"] },
        { domain: "Sleep", question: "మీ నిద్ర నాణ్యత ఎలా ఉంది?", options: ["బాగుంది", "ఫర్వాలేదు", "చెడ్డది"] },
        { domain: "Orientation", question: "కొన్నిసార్లు వారంలో ఏ రోజు లేదా తేదీ మర్చిపోతారా?", options: ["ఎప్పుడూ లేదు", "అరుదుగా", "తరచుగా"] },
        { domain: "Social", question: "సామాజిక కార్యకలాపాలు లేదా అభిరుచులపై ఆసక్తి తగ్గిందా?", options: ["మార్పు లేదు", "కొంచెం తక్కువ", "చాలా తక్కువ"] },
        { domain: "Physical", question: "నడిచేటప్పుడు తలతిరగడం లేదా సమతౌల్యం కోల్పోవడం జరుగుతుందా?", options: ["ఎప్పుడూ లేదు", "కొన్నిసార్లు", "తరచుగా"] },
        { domain: "Executive", question: "బిల్లులు చెల్లించడం లేదా వంట చేయడం వంటి రోజువారీ పనులు కష్టంగా ఉన్నాయా?", options: ["అస్సలు కాదు", "కొంచెం కష్టం", "చాలా కష్టం"] }
      ],
      Bengali: [
        { domain: "Memory", question: "গত সপ্তাহে আপনি কতবার নাম বা অ্যাপয়েন্টমেন্ট ভুলে গেছেন?", options: ["কখনোই না", "একবার বা দুবার", "ঘন ঘন"] },
        { domain: "Attention", question: "টিভি শো বা কথোপকথন অনুসরণ করতে কি অসুবিধা হয়?", options: ["একদম না", "মাঝে মাঝে", "খুব কঠিন"] },
        { domain: "Language", question: "শব্দ জিহ্বার ডগায় এসে আটকে যায় এমন অভিজ্ঞতা কি বেশি হচ্ছে?", options: ["না", "মাঝে মাঝে", "হ্যাঁ, প্রতিদিন"] },
        { domain: "Motor", question: "আপনার হাতের লেখা বা টাইপিংয়ের গতিতে কোনো পরিবর্তন লক্ষ্য করেছেন?", options: ["কোনো পরিবর্তন নেই", "সামান্য ধীর", "অনেক ধীর"] },
        { domain: "Mood", question: "সম্প্রতি আপনি কতবার বিষণ্ণ বা হতাশ বোধ করেছেন?", options: ["একদম না", "কয়েকদিন", "প্রায় প্রতিদিন"] },
        { domain: "Sleep", question: "আপনার ঘুমের মান কেমন?", options: ["ভালো", "মোটামুটি", "খারাপ"] },
        { domain: "Orientation", question: "কখনো কি সপ্তাহের দিন বা তারিখ ভুলে যান?", options: ["কখনোই না", "কদাচিৎ", "প্রায়ই"] },
        { domain: "Social", question: "সামাজিক কার্যকলাপ বা শখের প্রতি আগ্রহ কমে গেছে কি?", options: ["কোনো পরিবর্তন নেই", "একটু কম", "অনেক কম"] },
        { domain: "Physical", question: "হাঁটার সময় মাথা ঘোরা বা ভারসাম্যহীনতা অনুভব হয় কি?", options: ["কখনোই না", "মাঝে মাঝে", "ঘন ঘন"] },
        { domain: "Executive", question: "বিল পরিশোধ বা রান্না করার মতো দৈনন্দিন কাজ কি কঠিন হয়ে গেছে?", options: ["একদম না", "একটু কঠিন", "অনেক কঠিন"] }
      ],
      Kannada: [
        { domain: "Memory", question: "ಕಳೆದ ವಾರದಲ್ಲಿ ನೀವು ಎಷ್ಟು ಬಾರಿ ಹೆಸರುಗಳು ಅಥವಾ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್‌ಗಳನ್ನು ಮರೆತಿದ್ದೀರಿ?", options: ["ಎಂದಿಗೂ ಇಲ್ಲ", "ಒಂದು ಅಥವಾ ಎರಡು ಬಾರಿ", "ಆಗಾಗ್ಗೆ"] },
        { domain: "Attention", question: "ಟಿವಿ ಕಾರ್ಯಕ್ರಮಗಳು ಅಥವಾ ಸಂಭಾಷಣೆಗಳನ್ನು ಅನುಸರಿಸಲು ಕಷ್ಟವಾಗುತ್ತಿದೆಯೇ?", options: ["ಇಲ್ಲ", "ಕೆಲವೊಮ್ಮೆ", "ತುಂಬಾ ಕಷ್ಟ"] },
        { domain: "Language", question: "ಪದಗಳು ನಾಲಿಗೆಯ ತುದಿಯಲ್ಲಿ ಸಿಕ್ಕಿಹಾಕಿಕೊಳ್ಳುವ ಅನುಭವ ಹೆಚ್ಚಾಗಿದೆಯೇ?", options: ["ಇಲ್ಲ", "ಕೆಲವೊಮ್ಮೆ", "ಹೌದು, ಪ್ರತಿದಿನ"] },
        { domain: "Motor", question: "ನಿಮ್ಮ ಕೈಬರಹ ಅಥವಾ ಟೈಪಿಂಗ್ ವೇಗದಲ್ಲಿ ಯಾವುದೇ ಬದಲಾವಣೆಯನ್ನು ಗಮನಿಸಿದ್ದೀರಾ?", options: ["ಯಾವುದೇ ಬದಲಾವಣೆ ಇಲ್ಲ", "ಸ್ವಲ್ಪ ನಿಧಾನ", "ತುಂಬಾ ನಿಧಾನ"] },
        { domain: "Mood", question: "ಇತ್ತೀಚೆಗೆ ನೀವು ಎಷ್ಟು ಬಾರಿ ಖಿನ್ನತೆ ಅಥವಾ ನಿರಾಶೆಯನ್ನು ಅನುಭವಿಸಿದ್ದೀರಿ?", options: ["ಎಂದಿಗೂ ಇಲ್ಲ", "ಕೆಲವು ದಿನಗಳು", "ಬಹುತೇಕ ಪ್ರತಿದಿನ"] },
        { domain: "Sleep", question: "ನಿಮ್ಮ ನಿದ್ರೆಯ ಗುಣಮಟ್ಟ ಹೇಗಿದೆ?", options: ["ಉತ್ತಮ", "ಪರವಾಗಿಲ್ಲ", "ಕೆಟ್ಟದಾಗಿದೆ"] },
        { domain: "Orientation", question: "ವಾರದ ದಿನ ಅಥವಾ ದಿನಾಂಕವನ್ನು ನೀವು ಎಂದಾದರೂ ಮರೆಯುತ್ತೀರಾ?", options: ["ಎಂದಿಗೂ ಇಲ್ಲ", "ಅಪರೂಪವಾಗಿ", "ಆಗಾಗ್ಗೆ"] },
        { domain: "Social", question: "ಸಾಮಾಜಿಕ ಚಟುವಟಿಕೆಗಳು ಅಥವಾ ಹವ್ಯಾಸಗಳಲ್ಲಿ ಆಸಕ್ತಿ ಕಡಿಮೆಯಾಗಿದೆಯೇ?", options: ["ಬದಲಾವಣೆ ಇಲ್ಲ", "ಸ್ವಲ್ಪ ಕಡಿಮೆ", "ತುಂಬಾ ಕಡಿಮೆ"] },
        { domain: "Physical", question: "ನಡೆಯುವಾಗ ತಲೆತಿರುಗುವಿಕೆ ಅಥವಾ ಅಸಮತೋಲನವನ್ನು ಅನುಭವಿಸುತ್ತೀರಾ?", options: ["ಎಂದಿಗೂ ಇಲ್ಲ", "ಕೆಲವೊಮ್ಮೆ", "ಆಗಾಗ್ಗೆ"] },
        { domain: "Executive", question: "ಬಿಲ್‌ಗಳನ್ನು ಪಾವತಿಸುವ ಅಥವಾ ಅಡುಗೆ ಮಾಡುವಂತಹ ದೈನಂದಿನ ಕಾರ್ಯಗಳು ಕಷ್ಟವಾಗಿದೆಯೇ?", options: ["ಇಲ್ಲ", "ಸ್ವಲ್ಪ ಕಷ್ಟ", "ತುಂಬಾ ಕಷ್ಟ"] }
      ]
    };
    return q[lang] || q.English;
  };

  const assessmentQuestions = getAssessmentQuestions(appLanguage);

  useEffect(() => {
    // Load state from local storage
    const savedProgress = localStorage.getItem("completedTaskIds");
    if (savedProgress) setCompletedTaskIds(JSON.parse(savedProgress));

    const savedStep = localStorage.getItem("elderlyStep");
    const savedProfile = localStorage.getItem("patientProfile");
    if (savedProfile) {
      const p = JSON.parse(savedProfile);
      setProfile(p);
      if (savedStep && p.name) setStep(savedStep as Step);
      else setStep("PROFILE_SETUP");
    } else {
      setStep("PROFILE_SETUP");
    }

    const savedTasks = localStorage.getItem("patientTasks");
    if (savedTasks) setTasks(JSON.parse(savedTasks));

    const savedHistoryFlag = localStorage.getItem("hasUploadedHistory");
    if (savedHistoryFlag) setHasUploadedHistory(JSON.parse(savedHistoryFlag));

    const savedLanguage = localStorage.getItem("appLanguage");
    if (savedLanguage) setAppLanguage(savedLanguage as AppLanguage);
    
    const savedCode = localStorage.getItem("patientCode");
    if (savedCode) setUniqueCode(savedCode);

    const savedCreatedAt = localStorage.getItem("profileCreatedAt");
    if (savedCreatedAt) setProfileCreatedAt(savedCreatedAt);

    // On reload: if we have tasks but haven't generated all 14 days, queue background generation
    const lastGenDay = parseInt(localStorage.getItem("lastGeneratedDay") || "0");
    if (savedTasks && lastGenDay > 0 && lastGenDay < 14) {
      const context = localStorage.getItem("aiContext") || "";
      const lang = savedLanguage || "English";
      const nextStart = lastGenDay + 1;
      const nextEnd = Math.min(nextStart + 4, 14);
      // Delay to avoid firing alongside any other init calls
      setTimeout(() => {
        if (!isGeneratingRef.current) {
          generateMoreDays(nextStart, nextEnd, lang, context);
        }
      }, 8000);
    }
  }, []);

  const getCurrentDay = () => {
    if (!profileCreatedAt) return 1;
    const start = new Date(profileCreatedAt).getTime();
    const now = new Date().getTime();
    const diffDays = Math.floor((now - start) / (1000 * 60 * 60 * 24)) + 1;
    return Math.min(Math.max(diffDays, 1), 14);
  };

  useEffect(() => {
    localStorage.setItem("elderlyStep", step);
  }, [step]);

  useEffect(() => {
    localStorage.setItem("appLanguage", appLanguage);
  }, [appLanguage]);

  useEffect(() => {
    localStorage.setItem("patientProfile", JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    localStorage.setItem("hasUploadedHistory", JSON.stringify(hasUploadedHistory));
  }, [hasUploadedHistory]);

  useEffect(() => {
    // Check if ALL 14 days worth of tasks are complete
    const totalExpectedTasks = tasks.length;
    if (totalExpectedTasks > 0 && completedTaskIds.length === totalExpectedTasks && totalExpectedTasks >= 56) {
      const timer = setTimeout(() => {
        alert("Congratulations! You've completed your 14-day plan.");
        localStorage.removeItem("completedTaskIds");
        localStorage.removeItem("elderlyStep");
        localStorage.removeItem("patientTasks");
        localStorage.removeItem("lastGeneratedDay");
        localStorage.removeItem("aiContext");
        navigate("/");
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [completedTaskIds, tasks, navigate]);

  const toggleTaskCompletion = (taskId: string) => {
    setCompletedTaskIds(prev => {
      const next = prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId];
      localStorage.setItem("completedTaskIds", JSON.stringify(next));
      localStorage.setItem("completedTasksCount", next.length.toString());

      // Check if we need to pre-generate more days
      const lastGenerated = parseInt(localStorage.getItem("lastGeneratedDay") || "5");
      if (lastGenerated < 14) {
        // Find the highest completed day
        const allTasks: Task[] = JSON.parse(localStorage.getItem("patientTasks") || "[]");
        const completedDays = new Set(allTasks.filter(t => next.includes(t.id)).map(t => t.day));
        const highestCompletedDay = Math.max(0, ...completedDays);
        
        // If user is within 2 days of the last generated batch, pre-generate next batch
        if (highestCompletedDay >= lastGenerated - 2 && !isGeneratingRef.current) {
          const nextStart = lastGenerated + 1;
          const nextEnd = Math.min(nextStart + 4, 14);
          const language = localStorage.getItem("appLanguage") || "English";
          const context = localStorage.getItem("aiContext") || "";
          // Delay to debounce rapid task completions
          setTimeout(() => {
            if (!isGeneratingRef.current) {
              generateMoreDays(nextStart, nextEnd, language, context);
            }
          }, 2000);
        }
      }

      return next;
    });
  };


  const handleTaskClick = async (task: Task) => {
    setSelectedTask(task);
    setUserAnswers({});
    setQuestionnaireCompleted(false);
    setIsLoadingGuidance(true);
    setTaskGuidance("");
    
    try {
      // Use profile data or fallback
      const patientName = profile.name || "Patient";
      const context = hasUploadedHistory ? "Document history" : "Initial survey";
      const language = localStorage.getItem("appLanguage") || "English";
      const guidance = await getTaskGuidance(patientName, context, task, language);
      setTaskGuidance(guidance);
    } catch (error) {
      setTaskGuidance("Error loading guidance. Please try again.");
    } finally {
      setIsLoadingGuidance(false);
    }
  };

  const handleNextTask = () => {
    if (!selectedTask) return;
    const taskIndex = tasks.findIndex(t => t.id === selectedTask.id);
    if (taskIndex !== -1 && taskIndex < tasks.length - 1) {
      handleTaskClick(tasks[taskIndex + 1]);
    } else {
      setSelectedTask(null);
    }
  };

  const handleAnswerSelect = (qIdx: number, option: string) => {
    const nextAnswers = { ...userAnswers, [qIdx]: option };
    setUserAnswers(nextAnswers);
    if (selectedTask && Object.keys(nextAnswers).length === selectedTask.questionnaire.length) {
      setQuestionnaireCompleted(true);
    }
  };

  const handleBack = () => {
    if (step === "PROFILE_SETUP") navigate("/");
    else if (step === "CODE_DISPLAY") setStep("PROFILE_SETUP");
    else if (step === "HISTORY_GATE") setStep("CODE_DISPLAY");
    else if (step === "ASSESSMENT") setStep("HISTORY_GATE");
    else if (step === "MULTI_MODAL_TEST") setStep("ASSESSMENT");
    else if (step === "PROCESSING") setStep("MULTI_MODAL_TEST");
    else if (step === "DASHBOARD") setStep("MULTI_MODAL_TEST");
  };

  const startVoiceFill = (specificField?: "name" | "age" | "gender" | "smoke" | "drink") => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = appLanguage === "Hindi" ? "hi-IN" : 
                      appLanguage === "Tamil" ? "ta-IN" : 
                      appLanguage === "Telugu" ? "te-IN" :
                      appLanguage === "Bengali" ? "bn-IN" : 
                      appLanguage === "Kannada" ? "kn-IN" : "en-US";
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      if (specificField) setListeningField(specificField);
      setDetectedSpeech(getTranslation(appLanguage, "listening"));
    };

    recognition.onend = () => {
      setIsListening(false);
      setListeningField(null);
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      setListeningField(null);
      setDetectedSpeech(getTranslation(appLanguage, "errorVoice") + " " + (event.error || ""));
      setTimeout(() => setDetectedSpeech(""), 3000);
    };

    recognition.onresult = async (event: any) => {
      const transcript = event.results[event.results.length - 1][0].transcript;
      setDetectedSpeech(transcript);

      // Interim results: update the input field as the user speaks
      if (specificField && !event.results[event.results.length - 1].isFinal) {
        let value = transcript;
        if (specificField === "age") {
          value = transcript.replace(/\D/g, "");
        }
        if (specificField === "gender") {
          const match = ["Male", "Female", "Other"].find(g => transcript.toLowerCase().includes(g.toLowerCase()));
          if (match) value = match;
        }
        if (specificField === "smoke" || specificField === "drink") {
          const match = ["Yes", "No", "Occasionally"].find(v => transcript.toLowerCase().includes(v.toLowerCase()));
          if (match) {
            setProfile(p => ({ ...p, lifestyle: { ...p.lifestyle, [specificField]: match } }));
            return;
          }
        } else {
          setProfile(p => ({ ...p, [specificField]: value }));
        }
      }

      if (event.results[event.results.length - 1].isFinal) {
        if (step === "ASSESSMENT") {
           // Direct answer logic for assessment
           const currentQ = assessmentQuestions[assessmentStep];
           setIsProcessingVoice(true);
           try {
             const data = await processSpeech(
               transcript, 
               `Answering this question: "${currentQ.question}" with these options: ${currentQ.options.join(", ")}. Pick one option.`,
               appLanguage
             );
             // Find best matching option
             const bestMatch = currentQ.options.find(opt => 
               data.answer === opt || 
               transcript.toLowerCase().includes(opt.toLowerCase())
             ) || currentQ.options[0];
             
             handleAssessmentAnswer(bestMatch);
             setDetectedSpeech(getTranslation(appLanguage, "successVoice"));
           } catch (e) {
             console.error(e);
             setDetectedSpeech(getTranslation(appLanguage, "errorVoice"));
           } finally {
             setIsProcessingVoice(false);
             setTimeout(() => setDetectedSpeech(""), 2000);
           }
           return;
        }

        setIsProcessingVoice(true);
        try {
          const contextPrompt = specificField 
            ? `Extract ONLY the ${specificField} from: "${transcript}"`
            : "General profile setup (name, age, gender, lifestyle habits)";

          const data = await processSpeech(transcript, contextPrompt, appLanguage);
          
          if (data) {
            if (specificField === "name") setProfile(p => ({ ...p, name: data.name || data.value || transcript }));
            else if (specificField === "age") setProfile(p => ({ ...p, age: String(data.age || data.value || transcript.match(/\d+/)?.[0] || p.age) }));
            else if (specificField === "gender") setProfile(p => ({ ...p, gender: data.gender || data.value || p.gender }));
            else if (specificField === "smoke") setProfile(p => ({ ...p, lifestyle: { ...p.lifestyle, smoke: data.smoke || data.value || p.lifestyle.smoke } }));
            else if (specificField === "drink") setProfile(p => ({ ...p, lifestyle: { ...p.lifestyle, drink: data.drink || data.value || p.lifestyle.drink } }));
            else if (!specificField) {
              setProfile(prev => ({
                ...prev,
                name: data.name || data.fullName || prev.name,
                age: data.age ? String(data.age) : prev.age,
                gender: data.gender || prev.gender,
                lifestyle: {
                  ...prev.lifestyle,
                  smoke: data.smoke || prev.lifestyle.smoke,
                  drink: data.drink || prev.lifestyle.drink
                }
              }));
            }
            setDetectedSpeech(getTranslation(appLanguage, "successVoice"));
          } else {
            // Fallback: Use transcript directly if it's a specific field
            if (specificField === "name") setProfile(p => ({ ...p, name: transcript }));
            else if (specificField === "age") { 
              const m = transcript.match(/\d+/); 
              if (m) setProfile(p => ({ ...p, age: m[0] })); 
            }
          }
        } catch (error) {
          console.error("Voice processing error:", error);
          if (specificField) setProfile(p => ({ ...p, [specificField]: transcript }));
        } finally {
          setIsProcessingVoice(false);
          setTimeout(() => setDetectedSpeech(""), 3000);
        }
      }
    };

    recognition.start();
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessingVoice(true); // Show loader while generating code
    
    if (profile.name.toLowerCase() === "demo") {
        console.log("Loading Demo Elderly Data...");
        localStorage.setItem("patientUserId", "ayush_demo");
        localStorage.setItem("patientCode", "123456");
        localStorage.setItem("patientProfile", JSON.stringify({ name: "Demo Patient", age: "41", dob: "18/11/1983", gender: "Male", ailments: "Mild Hypertension" }));
        
        const demoTasks = [];
        const demoVitals = [];
        const completedIds = [];
        for (let d = 1; d <= 14; d++) {
          demoTasks.push({ id: `t_${d}_1`, title: `Morning BP Check - Day ${d}`, day: d, category: "motor" });
          demoTasks.push({ id: `t_${d}_2`, title: `Cognitive Word Match - Day ${d}`, day: d, category: "cognitive" });
          demoTasks.push({ id: `t_${d}_3`, title: `Call Family - Day ${d}`, day: d, category: "social" });
          if (d <= 13) { 
            completedIds.push(`t_${d}_1`, `t_${d}_2`, `t_${d}_3`);
          }
          // Generate daily vitals
          demoVitals.push({
            day: d,
            bp: `${120 + Math.floor(Math.random() * 10 - 5)}/${80 + Math.floor(Math.random() * 6 - 3)}`,
            hr: 72 + Math.floor(Math.random() * 10 - 5),
            spo2: 98 - Math.floor(Math.random() * 2),
            temp: (98.6 + (Math.random() * 0.4 - 0.2)).toFixed(1)
          });
        }
        localStorage.setItem("patientTasks", JSON.stringify(demoTasks));
        localStorage.setItem("completedTaskIds", JSON.stringify(completedIds));
        localStorage.setItem("patientVitalsHistory", JSON.stringify(demoVitals));
        localStorage.setItem("lastGeneratedDay", "14");
        
        setIsProcessingVoice(false);
        setStep("DASHBOARD");
        return;
    }

    localStorage.setItem("patientName", profile.name);
    localStorage.setItem("patientAge", profile.age);
    
    try {
      // Create a sanitized user ID for the backend
      const userId = profile.name.toLowerCase().replace(/[^a-z0-9_-]/g, "_") || "user_" + Math.floor(Math.random() * 1000);
      localStorage.setItem("patientUserId", userId);
      
      const response = await apiService.generateJoinCode(userId);
      setUniqueCode(response.code);
      localStorage.setItem("patientCode", response.code);
      setStep("CODE_DISPLAY");
    } catch (error) {
      console.error("Failed to generate join code from backend:", error);
      // Fallback to local code if backend fails
      const code = generateShortCode();
      setUniqueCode(code);
      localStorage.setItem("patientCode", code);
      setStep("CODE_DISPLAY");
    } finally {
      setIsProcessingVoice(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setHasUploadedHistory(true);
      setStep("ASSESSMENT");
      setAssessmentStep(0);
      setAssessmentAnswers([]);
      // Store the upload context somewhere or just let assessment start
    }
  };

  const [assessmentSummary, setAssessmentSummary] = useState("");

  const handleAssessmentAnswer = (answer: string) => {
    const newAnswers = [...assessmentAnswers, answer];
    setAssessmentAnswers(newAnswers);
    
    if (assessmentStep < assessmentQuestions.length - 1) {
      setAssessmentStep(assessmentStep + 1);
    } else {
      // Final step: store answers and proceed to multi-modal test
      const summary = "Initial Health Assessment:\n" + 
        assessmentQuestions.map((q, i) => `- ${q.domain}: ${newAnswers[i]}`).join("\n");
      setAssessmentSummary(summary);
      handleCompleteAssessment();
    }
  };

  const triggerAIAnalysis = async (context: string) => {
    setStep("PROCESSING");
    setAnalysisStatus("Generating your personalized Day 1-5 wellness plan...");
    const language = localStorage.getItem("appLanguage") || "English";
    
    // Store context for future batch generation
    localStorage.setItem("aiContext", context);
    
    try {
      // Generate only days 1-5 initially (20 tasks instead of 56)
      const generatedTasks = await analyzeMedicalHistory(profile.name || "Patient", context, language, profile, 1, 5);
      const tasksWithIds = generatedTasks.map((t, idx) => ({
        ...t,
        id: t.id || `task-${t.day}-${idx}`
      }));
      setTasks(tasksWithIds);
      localStorage.setItem("patientTasks", JSON.stringify(tasksWithIds));
      localStorage.setItem("hasUploadedHistory", JSON.stringify(true));
      localStorage.setItem("lastGeneratedDay", "5");
      setHasUploadedHistory(true);
      localStorage.setItem("completedTasksCount", "0");
      localStorage.setItem("completedTaskIds", "[]");
      
      // Synchronize with backend
      try {
        const storedUserId = localStorage.getItem("patientUserId");
        if (storedUserId) {
          await apiService.analyzeDemo(storedUserId, testResults.motor, testResults.speech);
        }
      } catch (backendError) {
        console.warn("Could not sync with backend history:", backendError);
      }
      
      const createdAt = new Date().toISOString();
      setProfileCreatedAt(createdAt);
      localStorage.setItem("profileCreatedAt", createdAt);

      setStep("DASHBOARD");

      // Background pre-generation: queue days 6-10 after delay (wait for API cooldown)
      setTimeout(() => {
        if (!isGeneratingRef.current) {
          generateMoreDays(6, 10, language, context);
        }
      }, 8000);
    } catch (error: any) {
      console.error("AI Analysis critical failure:", error);
      if (tasks.length === 0) {
        setStep("HISTORY_GATE");
        setAnalysisStatus("Analysis failed. Please check your internet connection and try again.");
      } else {
        setStep("DASHBOARD");
      }
    }
  };

  // Progressive batch generation with mutex lock
  const generateMoreDays = async (startDay: number, endDay: number, language: string, context: string) => {
    const lastGenerated = parseInt(localStorage.getItem("lastGeneratedDay") || "5");
    if (startDay <= lastGenerated) return; // Already generated
    if (isGeneratingRef.current) {
      console.log(`[PrivaSense] Skipping days ${startDay}-${endDay}: generation already in progress.`);
      return;
    }

    isGeneratingRef.current = true;
    try {
      console.log(`[PrivaSense] Background generating days ${startDay}-${endDay}...`);
      const newTasks = await analyzeMedicalHistory(profile.name || "Patient", context, language, profile, startDay, endDay);
      const newTasksWithIds = newTasks.map((t, idx) => ({
        ...t,
        id: t.id || `task-${t.day}-${idx}`
      }));

      // Merge with existing tasks
      const existingTasks: Task[] = JSON.parse(localStorage.getItem("patientTasks") || "[]");
      const merged = [...existingTasks, ...newTasksWithIds];
      localStorage.setItem("patientTasks", JSON.stringify(merged));
      localStorage.setItem("lastGeneratedDay", String(endDay));
      setTasks(merged);
      console.log(`[PrivaSense] Days ${startDay}-${endDay} generated successfully (${newTasksWithIds.length} tasks).`);

      // If there are still more days to generate, queue the next batch with a delay
      if (endDay < 14) {
        const nextStart = endDay + 1;
        const nextEnd = Math.min(nextStart + 4, 14);
        isGeneratingRef.current = false; // Release lock before scheduling next
        setTimeout(() => generateMoreDays(nextStart, nextEnd, language, context), 10000);
        return;
      }
    } catch (err) {
      console.warn(`[PrivaSense] Background generation for days ${startDay}-${endDay} failed, will retry later.`, err);
    } finally {
      isGeneratingRef.current = false;
    }
  };


  const handleUploadHistory = () => {
    // This is now triggered via handleFileChange
    handleUploadClick();
  };

  const handleSkipToAssessment = () => {
    setHasUploadedHistory(false);
    setStep("ASSESSMENT");
    setAssessmentStep(0);
    setAssessmentAnswers([]);
  };

  const handleSaveDailyVitals = async () => {
    // Save to local storage for now, could be an API call
    const history = JSON.parse(localStorage.getItem("dailyVitalsHistory") || "[]");
    history.push({
      date: new Date().toISOString(),
      vitals: profile.vitals
    });
    localStorage.setItem("dailyVitalsHistory", JSON.stringify(history));
    localStorage.setItem("patientProfile", JSON.stringify(profile));
    setIsVitalsModalOpen(false);
  };

  const calculateNEWS2 = () => {
    let score = 0;
    const v = profile.vitals;
    
    // Respiration
    const rr = parseInt(v.respirationRate);
    if (rr >= 25 || rr <= 8) score += 3;
    else if (rr >= 21) score += 2;
    else if (rr >= 9 && rr <= 11) score += 1;

    // SpO2
    const spo2 = parseInt(v.spo2);
    if (spo2 <= 91) score += 3;
    else if (spo2 <= 93) score += 2;
    else if (spo2 <= 95) score += 1;

    // Supplemental Oxygen
    if (v.supplementalOxygen === "Oxygen") score += 2;

    // Systolic BP
    const sbp = parseInt(v.systolicBP);
    if (sbp >= 220 || sbp <= 90) score += 3;
    else if (sbp <= 100) score += 2;
    else if (sbp <= 110) score += 1;

    // Heart Rate
    const hr = parseInt(v.heartRate);
    if (hr >= 131 || hr <= 40) score += 3;
    else if (hr >= 111) score += 2;
    else if (hr <= 50 || hr >= 91) score += 1;

    // Consciousness
    if (v.consciousness !== "Alert") score += 3;

    // Temperature
    const temp = parseFloat(v.temperature);
    if (temp <= 35.0) score += 3;
    else if (temp >= 39.1) score += 2;
    else if (temp <= 36.0 || temp >= 38.1) score += 1;

    return score;
  };

  const handleCompleteAssessment = () => {
    setStep("MULTI_MODAL_TEST");
  };

  const finishMultiModalTest = () => {
    const testContext = `
      Speech Test: ${testResults.speech || "Sample captured and analyzed."}
      Motor Test: ${testResults.motor} taps in 10 seconds.
      Memory Test: Recalled words "${testResults.memory}".
    `;
    triggerAIAnalysis(`Baseline Profile + ${assessmentSummary}\n\nMulti-Modal Active Testing:\n${testContext}`);
  };

  const handleMotorTestTap = () => {
    if (motorTimeLeft === 0) return;
    if (!isMotorTestActive && motorTimeLeft === 10) {
      setIsMotorTestActive(true);
    }
    setMotorScore(prev => prev + 1);
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isMotorTestActive && motorTimeLeft > 0) {
      timer = setInterval(() => {
        setMotorTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (isMotorTestActive && motorTimeLeft === 0) {
      setIsMotorTestActive(false);
      setTestResults(prev => ({ ...prev, motor: motorScore }));
      setTestStage("MEMORY");
    }
    return () => clearInterval(timer);
  }, [isMotorTestActive, motorTimeLeft, motorScore]);

  return (
    <div className="relative min-h-screen bg-[#FDFDFC] font-sans selection:bg-stone-200">
      {/* Top Navigation / Toolbar */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between p-3 sm:p-6 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          {step && (
            <button 
              onClick={handleBack}
              className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-stone-600 shadow-sm ring-1 ring-stone-200 transition-all hover:bg-stone-50 hover:text-stone-900"
            >
              <ArrowLeft className="h-4 w-4" />
              {getTranslation(appLanguage, "back")}
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 pointer-events-auto">
        </div>
      </div>

      <AnimatePresence mode="wait">
        {step === "PROFILE_SETUP" && (
          <motion.div
            key="profile-setup"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6"
          >
            <div className="w-full max-w-lg rounded-3xl sm:rounded-[40px] bg-white p-6 sm:p-10 shadow-2xl shadow-stone-200/50 ring-1 ring-stone-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-stone-400">
                  <User className="h-5 w-5" />
                  <span className="text-xs font-bold uppercase tracking-widest">{getTranslation(appLanguage, "patientDetails")}</span>
                </div>
                <button 
                  onClick={() => {
                    localStorage.clear();
                    window.location.reload();
                  }}
                  className="text-xs text-rose-400 hover:underline"
                >
                  Reset All
                </button>
              </div>

              <h2 className="mt-4 sm:mt-6 text-2xl sm:text-3xl font-medium tracking-tight text-stone-900">{getTranslation(appLanguage, "welcome")}</h2>
              <p className="mt-1 sm:mt-2 text-sm sm:text-base text-stone-500">{getTranslation(appLanguage, "provideDetails")}</p>
              
              <AnimatePresence>
                {detectedSpeech && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mt-6 flex items-center gap-3 rounded-2xl bg-rose-50 p-4 ring-1 ring-rose-100"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500 text-white shadow-lg shadow-rose-200">
                      <Mic className={`h-4 w-4 ${isListening ? 'animate-pulse' : ''}`} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-rose-400">{getTranslation(appLanguage, "heardSpeech")}</p>
                      <p className="text-sm font-medium text-rose-700 italic">"{detectedSpeech}"</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleProfileSubmit} className="mt-10 space-y-6">
                <div className="space-y-2 text-left">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-stone-700">{getTranslation(appLanguage, "fullName")}</label>
                    <button
                      type="button"
                      disabled={isListening && listeningField !== "name"}
                      onClick={() => startVoiceFill("name")}
                      className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${
                        isListening && listeningField === "name" 
                          ? "bg-rose-500 text-white animate-pulse" 
                          : isListening 
                            ? "bg-stone-50 text-stone-300 cursor-not-allowed"
                            : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                      }`}
                    >
                      <Mic className="h-4 w-4" />
                    </button>
                  </div>
                  <input
                    required
                    type="text"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    className="w-full rounded-xl bg-stone-50 p-4 text-stone-900 ring-1 ring-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-900"
                    placeholder="Enter your name"
                  />
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2 text-left">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold text-stone-700">{getTranslation(appLanguage, "age")}</label>
                      <button
                        type="button"
                        disabled={isListening && listeningField !== "age"}
                        onClick={() => startVoiceFill("age")}
                        className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${
                          isListening && listeningField === "age" 
                            ? "bg-rose-500 text-white animate-pulse" 
                            : isListening 
                              ? "bg-stone-50 text-stone-300 cursor-not-allowed"
                              : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                        }`}
                      >
                        <Mic className="h-4 w-4" />
                      </button>
                    </div>
                    <input
                      required
                      type="number"
                      value={profile.age}
                      onChange={(e) => setProfile({ ...profile, age: e.target.value })}
                      className="w-full rounded-xl bg-stone-50 p-4 text-stone-900 ring-1 ring-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-900"
                      placeholder="e.g. 75"
                    />
                  </div>
                  <div className="space-y-2 text-left">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold text-stone-700">{getTranslation(appLanguage, "gender")}</label>
                      <button
                        type="button"
                        disabled={isListening && listeningField !== "gender"}
                        onClick={() => startVoiceFill("gender")}
                        className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${
                          isListening && listeningField === "gender" 
                            ? "bg-rose-500 text-white animate-pulse" 
                            : isListening 
                              ? "bg-stone-50 text-stone-300 cursor-not-allowed"
                              : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                        }`}
                      >
                        <Mic className="h-4 w-4" />
                      </button>
                    </div>
                    <select
                      value={profile.gender}
                      onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
                      className="w-full rounded-xl bg-stone-50 p-4 text-stone-900 ring-1 ring-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-900 appearance-none"
                    >
                      <option value="Male">{getTranslation(appLanguage, "male")}</option>
                      <option value="Female">{getTranslation(appLanguage, "female")}</option>
                      <option value="Other">{getTranslation(appLanguage, "other")}</option>
                    </select>
                  </div>
                </div>

                {/* Lifestyle Section */}
                <div className="rounded-3xl bg-stone-50 p-6 ring-1 ring-stone-200">
                  <div className="flex items-center gap-2 text-stone-900 mb-4">
                    <Activity className="h-5 w-5 text-rose-500" />
                    <h3 className="font-semibold">{getTranslation(appLanguage, "lifestyle")}</h3>
                  </div>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2 text-left">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold uppercase tracking-wider text-stone-500">{getTranslation(appLanguage, "smoke")}</label>
                        <button
                          type="button"
                          disabled={isListening && listeningField !== "smoke"}
                          onClick={() => startVoiceFill("smoke")}
                          className={`flex h-6 w-6 items-center justify-center rounded-full transition-all ${
                            isListening && listeningField === "smoke" ? "bg-rose-500 text-white animate-pulse" : "bg-stone-200 text-stone-600"
                          }`}
                        >
                          <Mic className="h-3 w-3" />
                        </button>
                      </div>
                      <select
                        value={profile.lifestyle.smoke}
                        onChange={(e) => setProfile({ ...profile, lifestyle: { ...profile.lifestyle, smoke: e.target.value } })}
                        className="w-full rounded-xl bg-white p-3 text-sm text-stone-900 ring-1 ring-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-900 appearance-none"
                      >
                        <option value="No">{getTranslation(appLanguage, "no")}</option>
                        <option value="Yes">{getTranslation(appLanguage, "yes")}</option>
                        <option value="Occasionally">{getTranslation(appLanguage, "occasional")}</option>
                      </select>
                    </div>
                    <div className="space-y-2 text-left">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold uppercase tracking-wider text-stone-500">{getTranslation(appLanguage, "drink")}</label>
                        <button
                          type="button"
                          disabled={isListening && listeningField !== "drink"}
                          onClick={() => startVoiceFill("drink")}
                          className={`flex h-6 w-6 items-center justify-center rounded-full transition-all ${
                            isListening && listeningField === "drink" ? "bg-rose-500 text-white animate-pulse" : "bg-stone-200 text-stone-600"
                          }`}
                        >
                          <Mic className="h-3 w-3" />
                        </button>
                      </div>
                      <select
                        value={profile.lifestyle.drink}
                        onChange={(e) => setProfile({ ...profile, lifestyle: { ...profile.lifestyle, drink: e.target.value } })}
                        className="w-full rounded-xl bg-white p-3 text-sm text-stone-900 ring-1 ring-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-900 appearance-none"
                      >
                        <option value="No">{getTranslation(appLanguage, "no")}</option>
                        <option value="Yes">{getTranslation(appLanguage, "yes")}</option>
                        <option value="Occasionally">{getTranslation(appLanguage, "occasional")}</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Vitals Section - Nurse Only */}
                <div className="rounded-3xl bg-rose-50/50 p-6 ring-1 ring-rose-100">
                  <div className="flex items-center gap-2 text-rose-900 mb-4">
                    <Stethoscope className="h-5 w-5" />
                    <h3 className="font-semibold">{getTranslation(appLanguage, "vitalsTitle")}</h3>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-rose-400">{getTranslation(appLanguage, "bp")}</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          placeholder="Sys"
                          value={profile.vitals.systolicBP}
                          onChange={(e) => setProfile({ ...profile, vitals: { ...profile.vitals, systolicBP: e.target.value } })}
                          className="w-full rounded-lg bg-white p-2 text-center text-xs ring-1 ring-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                        />
                        <span className="text-stone-300">/</span>
                        <input
                          type="number"
                          placeholder="Dia"
                          value={profile.vitals.diastolicBP}
                          onChange={(e) => setProfile({ ...profile, vitals: { ...profile.vitals, diastolicBP: e.target.value } })}
                          className="w-full rounded-lg bg-white p-2 text-center text-xs ring-1 ring-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-rose-400">{getTranslation(appLanguage, "hr")}</label>
                      <input
                        type="number"
                        placeholder="72"
                        value={profile.vitals.heartRate}
                        onChange={(e) => setProfile({ ...profile, vitals: { ...profile.vitals, heartRate: e.target.value } })}
                        className="w-full rounded-lg bg-white p-2 text-center text-xs ring-1 ring-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-rose-400">{getTranslation(appLanguage, "spo2")}</label>
                      <input
                        type="number"
                        placeholder="98"
                        value={profile.vitals.spo2}
                        onChange={(e) => setProfile({ ...profile, vitals: { ...profile.vitals, spo2: e.target.value } })}
                        className="w-full rounded-lg bg-white p-2 text-center text-xs ring-1 ring-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-rose-400">{getTranslation(appLanguage, "weight")}</label>
                      <input
                        type="number"
                        placeholder="70"
                        value={profile.vitals.weight}
                        onChange={(e) => setProfile({ ...profile, vitals: { ...profile.vitals, weight: e.target.value } })}
                        className="w-full rounded-lg bg-white p-2 text-center text-xs ring-1 ring-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                      />
                    </div>
                  </div>
                </div>

                <button
                  id="submit-profile-btn"
                  type="submit"
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-stone-900 py-5 text-lg font-semibold text-white transition-all hover:bg-stone-800"
                >
                  {getTranslation(appLanguage, "submit")}
                  <ArrowRight className="h-5 w-5" />
                </button>
              </form>
            </div>
          </motion.div>
        )}

        {step === "CODE_DISPLAY" && (
          <motion.div
            key="code"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="flex min-h-screen flex-col items-center justify-center p-6"
          >
            <div className="w-full max-w-md rounded-[40px] bg-white p-10 text-center shadow-2xl shadow-stone-200/50">
              <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-stone-900 text-white shadow-xl shadow-stone-900/20">
                <Sparkles className="h-10 w-10" />
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-stone-900">Your Pairing Code</h1>
              <p className="mt-4 text-lg text-stone-500">Share this with your caregiver to connect.</p>
              
              <div className="mt-10 flex items-center justify-center gap-3">
                {uniqueCode.split("").map((digit, idx) => (
                  <div 
                    key={idx}
                    className="flex h-12 w-10 items-center justify-center rounded-xl bg-stone-50 text-2xl font-bold text-stone-900 ring-1 ring-stone-200"
                  >
                    {digit}
                  </div>
                ))}
              </div>

              <button
                id="continue-to-gate-btn"
                onClick={() => setStep("HISTORY_GATE")}
                className="group mt-12 flex w-full items-center justify-center gap-2 rounded-2xl bg-stone-900 py-5 text-lg font-semibold text-white transition-all hover:bg-stone-800 active:scale-95"
              >
                Continue Setup
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </motion.div>
        )}

        {step === "HISTORY_GATE" && (
          <motion.div
            key="gate"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center p-6"
          >
            <div className="mb-12 text-center">
              <h2 className="text-4xl font-medium tracking-tight text-stone-900 md:text-5xl">Medical Information</h2>
              <p className="mt-4 text-lg text-stone-600">Help us understand your health better for a personalized plan.</p>
            </div>

            <div className="grid w-full gap-6 md:grid-cols-2">
              <input 
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.jpg,.png"
              />
              <button
                id="upload-history-btn"
                onClick={handleUploadClick}
                className="group relative flex flex-col items-start rounded-[32px] bg-white p-8 text-left shadow-xl shadow-stone-200/50 transition-all hover:shadow-2xl hover:shadow-stone-300/60 ring-1 ring-stone-100"
              >
                <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-stone-50 text-stone-900 group-hover:bg-stone-900 group-hover:text-white transition-all">
                  <Upload className="h-8 w-8" />
                </div>
                <h3 className="text-2xl font-semibold text-stone-900">Upload History</h3>
                <p className="mt-3 text-stone-500 leading-relaxed">
                  Securely upload your existing medical documents to skip the survey.
                </p>
                <div className="mt-8 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-stone-900">
                  Select Files <ChevronRight className="h-4 w-4" />
                </div>
              </button>

              <button
                id="skip-to-assessment-btn"
                onClick={handleSkipToAssessment}
                className="group relative flex flex-col items-start rounded-[32px] bg-white p-8 text-left shadow-xl shadow-stone-200/50 transition-all hover:shadow-2xl hover:shadow-stone-300/60 ring-1 ring-stone-100"
              >
                <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-stone-50 text-stone-900 group-hover:bg-amber-100 group-hover:text-amber-900 transition-all">
                  <ClipboardCheck className="h-8 w-8" />
                </div>
                <h3 className="text-2xl font-semibold text-stone-900">Health Survey</h3>
                <p className="mt-3 text-stone-500 leading-relaxed">
                  Answer a few simple questions instead to setup your 14-day health goals.
                </p>
                <div className="mt-8 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-stone-900">
                  Start Assessment <ChevronRight className="h-4 w-4" />
                </div>
              </button>
            </div>
          </motion.div>
        )}

        {step === "ASSESSMENT" && (
          <motion.div
            key="assessment"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6 text-center"
          >
            <div className="mb-6 sm:mb-12 flex items-center justify-center gap-1 sm:gap-2 flex-wrap">
              {assessmentQuestions.map((_, i) => (
                <div 
                  key={i} 
                  className={`h-2 w-12 rounded-full transition-all duration-500 ${
                    i === assessmentStep ? "bg-stone-900 w-20" : i < assessmentStep ? "bg-emerald-500" : "bg-stone-200"
                  }`} 
                />
              ))}
            </div>

            <motion.div
              key={assessmentStep}
              className="w-full max-w-2xl px-2 sm:px-4"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
            >
              <h2 className="text-xl sm:text-3xl md:text-5xl font-medium tracking-tight text-stone-900">
                {assessmentQuestions[assessmentStep].question}
              </h2>
              
              <div className="mt-6 sm:mt-12 grid grid-cols-1 gap-3 sm:gap-4">
                {assessmentQuestions[assessmentStep].options.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => handleAssessmentAnswer(opt)}
                    className="flex items-center justify-between rounded-2xl sm:rounded-[32px] bg-white p-5 sm:p-8 text-left text-base sm:text-xl font-medium text-stone-900 shadow-xl shadow-stone-200/50 ring-1 ring-stone-100 transition-all hover:bg-stone-900 hover:text-white"
                  >
                    {opt}
                    <ArrowRight className="h-6 w-6 opacity-40" />
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}

        {step === "PROCESSING" && (
          <motion.div
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex min-h-screen flex-col items-center justify-center p-6 text-center"
          >
            <div className="relative">
              <div className="h-32 w-32 rounded-full border-4 border-stone-100" />
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 h-32 w-32 rounded-full border-t-4 border-stone-900" 
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-stone-900" />
              </div>
            </div>
            <h2 className="mt-10 text-2xl font-medium text-stone-900">{getTranslation(appLanguage, "consultingAI")}</h2>
            <p className="mt-4 max-w-xs text-stone-500 leading-relaxed">
              {analysisStatus}
            </p>
            <div className="mt-8 flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                  className="h-1.5 w-1.5 rounded-full bg-stone-400"
                />
              ))}
            </div>
          </motion.div>
        )}
        {step === "MULTI_MODAL_TEST" && (
          <motion.div
            key="multi-modal"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex min-h-screen flex-col items-center justify-center bg-[#F5F5F0] p-4 sm:p-6"
          >
            <div className="w-full max-w-md space-y-6 sm:space-y-8 text-center">
              <div className="flex justify-center gap-4">
                {["SPEECH", "MOTOR", "MEMORY"].map((s) => (
                  <div 
                    key={s} 
                    className={`h-2 w-16 rounded-full transition-all ${
                      testStage === s ? "bg-rose-500" : "bg-stone-200"
                    }`} 
                  />
                ))}
              </div>

              {testStage === "SPEECH" && (
                <div className="space-y-6">
                  <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-rose-100 text-rose-500 shadow-inner">
                    <Mic className={`h-10 w-10 ${isRecordingTest ? "animate-pulse" : ""}`} />
                  </div>
                  <h2 className="text-3xl font-medium text-stone-900">{appLanguage === "Hindi" ? "वाणी जाँच" : appLanguage === "Tamil" ? "பேச்சு சோதனை" : appLanguage === "Telugu" ? "వాక్ పరీక్ష" : appLanguage === "Bengali" ? "বাক্ পরীক্ষা" : appLanguage === "Kannada" ? "ವಾಕ್ ಪರಿಶೀಲನೆ" : "Speech Check"}</h2>
                  <p className="text-stone-500">{appLanguage === "Hindi" ? "कृपया इस वाक्य को ज़ोर से पढ़ें:" : appLanguage === "Tamil" ? "இந்த வாக்கியத்தை சத்தமாக படியுங்கள்:" : appLanguage === "Telugu" ? "దయచేసి ఈ వాక్యాన్ని బిగ్గరగా చదవండి:" : appLanguage === "Bengali" ? "দয়া করে এই বাক্যটি জোরে পড়ুন:" : appLanguage === "Kannada" ? "ದಯವಿಟ್ಟು ಈ ವಾಕ್ಯವನ್ನು ಜೋರಾಗಿ ಓದಿ:" : "Please read this sentence aloud:"}</p>
                  <p className="rounded-2xl bg-white p-6 text-xl font-medium italic shadow-sm ring-1 ring-stone-200">
                    {appLanguage === "Hindi" ? "\"सुबह की सैर शरीर और मन दोनों के लिए अच्छी होती है।\"" : appLanguage === "Tamil" ? "\"காலை நடை உடலுக்கும் மனதுக்கும் நல்லது.\"" : appLanguage === "Telugu" ? "\"ఉదయం నడక శరీరానికి మనసుకు మంచిది.\"" : appLanguage === "Bengali" ? "\"সকালের হাঁটা শরীর ও মনের জন্য উপকারী।\"" : appLanguage === "Kannada" ? "\"ಮುಂಜಾನೆಯ ನಡಿಗೆ ದೇಹ ಮತ್ತು ಮನಸ್ಸಿಗೆ ಒಳ್ಳೆಯದು.\"" : "\"The early bird catches the worm and finds peace in the morning.\""}
                  </p>
                  <button
                    onClick={() => {
                      if (isRecordingTest) {
                        setIsRecordingTest(false);
                        setTestResults({ ...testResults, speech: "Sample captured" });
                        setTestStage("MOTOR");
                      } else {
                        setIsRecordingTest(true);
                      }
                    }}
                    className={`w-full rounded-2xl py-5 text-lg font-bold transition-all ${isRecordingTest ? "bg-rose-500 text-white" : "bg-stone-900 text-white hover:bg-stone-800"}`}
                  >
                    {isRecordingTest ? (appLanguage === "Hindi" ? "रुकें और आगे बढ़ें" : appLanguage === "Kannada" ? "ನಿಲ್ಲಿಸಿ ಮತ್ತು ಮುಂದುವರಿಯಿರಿ" : "Stop & Continue") : (appLanguage === "Hindi" ? "बोलना शुरू करें" : appLanguage === "Kannada" ? "ಮಾತನಾಡಲು ಪ್ರಾರಂಭಿಸಿ" : "Tap to Start Speaking")}
                  </button>
                </div>
              )}

              {testStage === "MOTOR" && (
                <div className="space-y-6">
                  <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-orange-100 text-orange-500 shadow-inner">
                    <Activity className="h-10 w-10" />
                  </div>
                  <h2 className="text-3xl font-medium text-stone-900">{appLanguage === "Hindi" ? "मोटर जाँच" : appLanguage === "Tamil" ? "இயக்கச் சோதனை" : appLanguage === "Telugu" ? "మోటార్ పరీక్ష" : appLanguage === "Bengali" ? "মোটর পরীক্ষা" : appLanguage === "Kannada" ? "ಮೋಟಾರ್ ಪರಿಶೀಲನೆ" : "Motor Check"}</h2>
                  <p className="text-stone-500">{appLanguage === "Hindi" ? "10 सेकंड में जितनी बार हो सके बटन दबाएं।" : appLanguage === "Kannada" ? "10 ಸೆಕೆಂಡುಗಳಲ್ಲಿ ಎಷ್ಟು ಬಾರಿ ಸಾಧ್ಯವೋ ಅಷ್ಟು ಬಾರಿ ಟ್ಯಾಪ್ ಮಾಡಿ." : "Tap the button as many times as you can in 10 seconds."}</p>
                  
                  <div className="flex items-center justify-center gap-8">
                    <div className="text-center">
                      <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Score</p>
                      <div className="text-5xl font-mono font-bold text-rose-500">{motorScore}</div>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Time</p>
                      <div className={`text-5xl font-mono font-bold ${motorTimeLeft <= 3 ? "text-red-500" : "text-stone-900"}`}>{motorTimeLeft}s</div>
                    </div>
                  </div>

                  <button
                    onMouseDown={handleMotorTestTap}
                    onTouchStart={handleMotorTestTap}
                    disabled={motorTimeLeft === 0}
                    className={`h-32 w-32 rounded-full shadow-xl ring-4 transition-all active:scale-90 ${
                      motorTimeLeft === 0 
                        ? "bg-stone-100 ring-stone-200 text-stone-400" 
                        : "bg-white ring-rose-500/20"
                    }`}
                  >
                    {motorTimeLeft === 0 
                      ? (appLanguage === "Hindi" ? "समय समाप्त" : appLanguage === "Kannada" ? "ಸಮಯ ಮುಗಿದಿದೆ" : "TIME UP") 
                      : (appLanguage === "Hindi" ? "यहाँ दबाएं" : appLanguage === "Kannada" ? "ಇಲ್ಲಿ ಟ್ಯಾಪ್ ಮಾಡಿ" : "TAP HERE")}
                  </button>
                  {motorTimeLeft === 10 && !isMotorTestActive && (
                    <p className="text-sm text-stone-400 animate-pulse mt-4">Timer starts on first tap</p>
                  )}
                </div>
              )}

              {testStage === "MEMORY" && (
                <div className="space-y-6">
                  <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-purple-100 text-purple-500 shadow-inner">
                    <History className="h-10 w-10" />
                  </div>
                  <h2 className="text-3xl font-medium text-stone-900">{appLanguage === "Hindi" ? "स्मृति जाँच" : appLanguage === "Tamil" ? "நினைவாற்றல் சோதனை" : appLanguage === "Telugu" ? "జ్ఞాపకశక్తి పరీక్ష" : appLanguage === "Bengali" ? "স্মৃতি পরীক্ষা" : appLanguage === "Kannada" ? "ಸ್ಮರಣೆ ಪರಿಶೀಲನೆ" : "Memory Check"}</h2>
                  <p className="text-stone-500">{appLanguage === "Hindi" ? "पहले के शब्द याद करें और नीचे लिखें।" : appLanguage === "Tamil" ? "முன்பு காட்டிய வார்த்தைகளை நினைவு கூர்ந்து எழுதுங்கள்." : appLanguage === "Kannada" ? "ಮೊದಲಿನ ಪದಗಳು ನೆನಪಿದೆಯೇ? ನೆನಪಿರುವ ಪದಗಳನ್ನು ಟೈಪ್ ಮಾಡಿ." : "Do you remember the words from earlier? Type any you recall."}</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {memoryWords.map(w => (
                      <span key={w} className="rounded-full bg-stone-100 px-4 py-2 text-xs font-bold uppercase text-stone-400 blur-[2px]">XXXX</span>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={memoryInput}
                    onChange={(e) => setMemoryInput(e.target.value)}
                    placeholder={appLanguage === "Hindi" ? "शब्द यहाँ लिखें..." : appLanguage === "Kannada" ? "ಪದಗಳನ್ನು ಇಲ್ಲಿ ನಮೂದಿಸಿ..." : "Enter words here..."}
                    className="w-full rounded-2xl bg-white p-5 text-center text-xl shadow-sm ring-1 ring-stone-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  <button
                    onClick={() => {
                      setTestResults({ ...testResults, memory: memoryInput });
                      finishMultiModalTest();
                    }}
                    className="w-full rounded-2xl bg-stone-900 py-5 text-lg font-bold text-white transition-all hover:bg-stone-800"
                  >
                    {appLanguage === "Hindi" ? "परीक्षण पूरा करें" : appLanguage === "Tamil" ? "சோதனையை முடிக்கவும்" : appLanguage === "Kannada" ? "ಪರೀಕ್ಷೆಯನ್ನು ಪೂರ್ಣಗೊಳಿಸಿ" : "Complete Test"}

                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {step === "DASHBOARD" && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="min-h-screen w-full overflow-x-hidden bg-[#F5F5F0] p-4 sm:p-6 lg:p-12"
          >
            <div className="mx-auto max-w-7xl pt-12 sm:pt-0">
              <header className="mb-6 sm:mb-12 flex flex-col justify-between gap-4 sm:gap-6 md:flex-row md:items-end">
                <div>
                  <div className="flex items-center gap-2 text-rose-500">
                    <LayoutDashboard className="h-5 w-5" />
                    <span className="text-xs font-bold uppercase tracking-widest">{getTranslation(appLanguage, "wellnessHub")}</span>
                  </div>
                  <h1 className="mt-2 sm:mt-4 text-2xl sm:text-4xl md:text-5xl font-medium tracking-tight text-stone-900">
                    {profile.name || "Patient"}.
                  </h1>
                  <p className="mt-2 text-lg text-stone-500">
                    {getTranslation(appLanguage, "monitoringMsg")}
                  </p>
                </div>
                
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-4 rounded-3xl bg-white p-2 pr-6 shadow-sm ring-1 ring-stone-200">
                     <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-900 text-white font-mono text-xs">
                       PDI
                     </div>
                      <div className="text-left">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 leading-none">{getTranslation(appLanguage, "pdiFull")}</p>
                        <p className="font-mono text-sm font-semibold text-stone-900">0.12 (Optimal)</p>
                      </div>
                  </div>
                  <p className="text-[10px] text-right text-stone-400 italic">{getTranslation(appLanguage, "aiGuidance")}: Normal speech pause rate</p>
                </div>
              </header>

              {/* Summary Section */}
              <section className="mb-6 sm:mb-12">
                   <div className="rounded-2xl sm:rounded-[32px] bg-stone-900 p-5 sm:p-8 text-white shadow-xl shadow-stone-900/10">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <h1 className="text-xl sm:text-2xl lg:text-4xl font-medium tracking-tight text-white">{getTranslation(appLanguage, "wellnessJourney")}</h1>
                          <p className="mt-2 text-stone-400">Day {getCurrentDay()} of 14</p>
                        </div>
                        <div className="flex flex-wrap gap-2 sm:gap-4">
                          <button 
                            onClick={() => setIsVitalsModalOpen(true)}
                            className="flex items-center gap-2 sm:gap-3 rounded-full bg-rose-500 px-4 sm:px-8 py-3 sm:py-4 text-sm sm:text-base font-bold text-white shadow-lg shadow-rose-900/20 transition-all hover:bg-rose-600 active:scale-95"
                          >
                            <Stethoscope className="h-5 w-5" />
                            {getTranslation(appLanguage, "vitalsEntryTitle")}
                          </button>
                        </div>
                      </div>
                      <div className="mt-6 sm:mt-10 flex gap-0.5 sm:gap-1">
                         {Array.from({ length: 14 }).map((_, i) => {
                           const day = i + 1;
                           const currentDayVal = getCurrentDay();
                           const dayTasks = tasks.filter(t => t.day === day);
                           const isDayComplete = dayTasks.length > 0 && dayTasks.every(t => completedTaskIds.includes(t.id));
                           const isLocked = day > currentDayVal;
                           return (
                             <div 
                               key={i} 
                               className={`h-8 sm:h-12 flex-1 rounded-md sm:rounded-lg transition-all ${
                                 isLocked ? 'bg-stone-800/30' :
                                 isDayComplete ? 'bg-rose-500' : 'bg-stone-800'
                               }`}
                             />
                           );
                         })}
                      </div>
                      <div className="mt-6 flex justify-between items-center">
                        <p className="text-sm text-stone-400 italic">{completedTaskIds.length} of {tasks.length} Activities Completed</p>
                        <button 
                          onClick={() => {
                            if(window.confirm("Are you sure you want to reset your entire progress?")) {
                              localStorage.clear();
                              window.location.reload();
                            }
                          }}
                          className="text-[10px] uppercase tracking-widest text-stone-600 hover:text-stone-300 underline underline-offset-4"
                        >
                          Reset Journey
                        </button>
                      </div>
                   </div>
              </section>

              {/* Today's Activities Section */}
              <section className="mb-6 sm:mb-12">
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500 text-white shadow-lg shadow-rose-500/20">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-medium text-stone-900">Today's Activities</h2>
                </div>
                
                <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
                  {tasks.filter(t => t.day === getCurrentDay()).map((task) => {
                    const isTaskDone = completedTaskIds.includes(task.id);
                    return (
                      <button
                        key={task.id}
                        onClick={() => handleTaskClick(task)}
                        className={`group relative flex w-full flex-col items-start gap-4 rounded-3xl sm:rounded-[40px] p-6 sm:p-8 text-left transition-all ${
                          isTaskDone 
                            ? "bg-emerald-50 ring-2 ring-emerald-500/20" 
                            : "bg-white shadow-xl shadow-stone-200/50 ring-1 ring-stone-100 hover:shadow-2xl hover:-translate-y-1"
                        }`}
                      >
                        <div className="flex w-full items-start justify-between gap-4">
                          <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl shadow-inner ${
                            task.category === 'cognitive' ? 'bg-purple-100 text-purple-600' : 'bg-orange-100 text-orange-600'
                          }`}>
                            {isTaskDone ? <CheckCircle2 className="h-8 w-8 text-emerald-500" /> : <ClipboardCheck className="h-8 w-8" />}
                          </div>
                          <div className="flex flex-col items-end">
                            <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-widest ${isTaskDone ? "text-emerald-500" : "text-stone-400"}`}>
                              {isTaskDone ? "Completed" : "Pending"}
                            </span>
                          </div>
                        </div>
                        <div className="mt-2 w-full">
                          <h3 className={`text-xl sm:text-2xl font-semibold ${isTaskDone ? "text-emerald-900" : "text-stone-900"}`}>{task.title}</h3>
                          <p className="mt-3 text-base sm:text-lg text-stone-500 leading-relaxed line-clamp-2">{task.description}</p>
                        </div>
                        {!isTaskDone && (
                          <div className="mt-4 flex w-full items-center justify-center rounded-2xl bg-stone-900 py-4 text-base font-bold text-white transition-all shadow-lg shadow-stone-900/20 group-hover:bg-stone-800">
                            START ACTIVITY
                          </div>
                        )}
                        {isTaskDone && (
                          <div className="mt-4 flex w-full items-center justify-center rounded-2xl bg-emerald-100 py-4 text-base font-bold text-emerald-700 transition-all">
                            REVIEW ACTIVITY
                          </div>
                        )}
                      </button>
                    );
                  })}
                  
                  {tasks.filter(t => t.day === getCurrentDay()).length === 0 && (
                    <div className="col-span-full rounded-[40px] bg-stone-50 p-10 text-center ring-1 ring-stone-200">
                      <ClipboardCheck className="mx-auto h-12 w-12 text-stone-300 mb-4" />
                      <p className="text-xl text-stone-500">No activities scheduled for today yet.</p>
                      <p className="text-sm text-stone-400 mt-2">Please check your internet connection or try reloading.</p>
                    </div>
                  )}
                </div>
              </section>
            </div>

              {/* Daily Vitals Entry Modal (Nurse) */}
              <AnimatePresence>
                {isVitalsModalOpen && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-900/60 p-4 sm:p-6 backdrop-blur-md"
                  >
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0, y: 20 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.9, opacity: 0, y: 20 }}
                      className="w-full max-w-lg overflow-hidden rounded-t-3xl sm:rounded-[40px] bg-white shadow-2xl max-h-[95vh] sm:max-h-none"
                    >
                      <div className="bg-rose-500 p-5 sm:p-8 text-white text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20">
                          <Stethoscope className="h-8 w-8" />
                        </div>
                        <h2 className="text-2xl font-semibold">{getTranslation(appLanguage, "vitalsEntryTitle")}</h2>
                        <div className="mt-2 flex items-center justify-center gap-2">
                           <span className="text-rose-100 text-sm">Day {getCurrentDay()}</span>
                           <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                             calculateNEWS2() >= 5 ? "bg-red-500 text-white" : 
                             calculateNEWS2() >= 3 ? "bg-orange-400 text-white" : "bg-white/20 text-white"
                           }`}>
                             NEWS2: {calculateNEWS2()}
                           </span>
                        </div>
                      </div>

                      <div className="p-4 sm:p-8 space-y-4 sm:space-y-6 max-h-[60vh] overflow-y-auto">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-xs font-bold uppercase tracking-widest text-stone-400">{getTranslation(appLanguage, "bp")}</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                placeholder="Sys"
                                value={profile.vitals.systolicBP}
                                onChange={(e) => setProfile({ ...profile, vitals: { ...profile.vitals, systolicBP: e.target.value } })}
                                className="w-full rounded-xl bg-stone-50 p-3 text-center ring-1 ring-stone-200 focus:ring-2 focus:ring-rose-500"
                              />
                              <span className="text-stone-300">/</span>
                              <input
                                type="number"
                                placeholder="Dia"
                                value={profile.vitals.diastolicBP}
                                onChange={(e) => setProfile({ ...profile, vitals: { ...profile.vitals, diastolicBP: e.target.value } })}
                                className="w-full rounded-xl bg-stone-50 p-3 text-center ring-1 ring-stone-200 focus:ring-2 focus:ring-rose-500"
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold uppercase tracking-widest text-stone-400">{getTranslation(appLanguage, "hr")}</label>
                            <input
                              type="number"
                              placeholder="72"
                              value={profile.vitals.heartRate}
                              onChange={(e) => setProfile({ ...profile, vitals: { ...profile.vitals, heartRate: e.target.value } })}
                              className="w-full rounded-xl bg-stone-50 p-3 text-center ring-1 ring-stone-200 focus:ring-2 focus:ring-rose-500"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-xs font-bold uppercase tracking-widest text-stone-400">{getTranslation(appLanguage, "spo2")}</label>
                            <input
                              type="number"
                              placeholder="98"
                              value={profile.vitals.spo2}
                              onChange={(e) => setProfile({ ...profile, vitals: { ...profile.vitals, spo2: e.target.value } })}
                              className="w-full rounded-xl bg-stone-50 p-3 text-center ring-1 ring-stone-200 focus:ring-2 focus:ring-rose-500"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold uppercase tracking-widest text-stone-400">{getTranslation(appLanguage, "weight")}</label>
                            <input
                              type="number"
                              placeholder="70"
                              value={profile.vitals.weight}
                              onChange={(e) => setProfile({ ...profile, vitals: { ...profile.vitals, weight: e.target.value } })}
                              className="w-full rounded-xl bg-stone-50 p-3 text-center ring-1 ring-stone-200 focus:ring-2 focus:ring-rose-500"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-xs font-bold uppercase tracking-widest text-stone-400">Respiration Rate</label>
                            <input
                              type="number"
                              placeholder="12-20"
                              value={profile.vitals.respirationRate}
                              onChange={(e) => setProfile({ ...profile, vitals: { ...profile.vitals, respirationRate: e.target.value } })}
                              className="w-full rounded-xl bg-stone-50 p-3 text-center ring-1 ring-stone-200 focus:ring-2 focus:ring-rose-500"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold uppercase tracking-widest text-stone-400">Temperature (°C)</label>
                            <input
                              type="number"
                              placeholder="37"
                              value={profile.vitals.temperature}
                              onChange={(e) => setProfile({ ...profile, vitals: { ...profile.vitals, temperature: e.target.value } })}
                              className="w-full rounded-xl bg-stone-50 p-3 text-center ring-1 ring-stone-200 focus:ring-2 focus:ring-rose-500"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-xs font-bold uppercase tracking-widest text-stone-400">Air/Oxygen</label>
                            <select
                              value={profile.vitals.supplementalOxygen}
                              onChange={(e) => setProfile({ ...profile, vitals: { ...profile.vitals, supplementalOxygen: e.target.value } })}
                              className="w-full rounded-xl bg-stone-50 p-3 ring-1 ring-stone-200 focus:ring-2 focus:ring-rose-500"
                            >
                              <option value="Air">Air</option>
                              <option value="Oxygen">Oxygen</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold uppercase tracking-widest text-stone-400">Consciousness</label>
                            <select
                              value={profile.vitals.consciousness}
                              onChange={(e) => setProfile({ ...profile, vitals: { ...profile.vitals, consciousness: e.target.value } })}
                              className="w-full rounded-xl bg-stone-50 p-3 ring-1 ring-stone-200 focus:ring-2 focus:ring-rose-500"
                            >
                              <option value="Alert">Alert (A)</option>
                              <option value="Confusion">New Confusion (C)</option>
                              <option value="Voice">Voice (V)</option>
                              <option value="Pain">Pain (P)</option>
                              <option value="Unresponsive">Unresponsive (U)</option>
                            </select>
                          </div>
                        </div>

                        <div className="flex gap-4 pt-4">
                          <button 
                            onClick={() => setIsVitalsModalOpen(false)}
                            className="flex-1 rounded-2xl bg-stone-100 py-4 font-semibold text-stone-600 transition-all hover:bg-stone-200"
                          >
                            {getTranslation(appLanguage, "back")}
                          </button>
                          <button 
                            onClick={handleSaveDailyVitals}
                            className="flex-1 rounded-2xl bg-stone-900 py-4 font-semibold text-white transition-all hover:bg-stone-800"
                          >
                            {getTranslation(appLanguage, "saveVitals")}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Task Guidance Modal */}
              <AnimatePresence>
                {selectedTask && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/40 p-0 sm:p-6 backdrop-blur-sm"
                  >
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0, y: 20 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.9, opacity: 0, y: 20 }}
                      className="w-full max-w-xl overflow-hidden rounded-t-3xl sm:rounded-[40px] bg-white shadow-2xl max-h-[95vh] sm:max-h-none"
                    >
                      <div className="relative h-auto sm:h-40 bg-stone-900 p-6 sm:p-10 text-white">
                        <button 
                          onClick={() => setSelectedTask(null)}
                          className="absolute right-4 sm:right-6 top-4 sm:top-6 rounded-full bg-white/10 p-2 text-white transition-all hover:bg-white/20"
                        >
                          <X className="h-5 w-5" />
                        </button>
                        <span className="text-xs font-bold uppercase tracking-widest text-stone-400">Day {selectedTask.day}</span>
                        <h2 className="mt-2 text-xl sm:text-3xl font-medium">{selectedTask.title}</h2>
                        <p className="mt-1 sm:mt-2 text-sm text-stone-400 line-clamp-2">{selectedTask.description}</p>
                      </div>

                      <div className="max-h-[55vh] sm:max-h-[60vh] overflow-y-auto p-5 sm:p-10">
                        <div className="flex items-center gap-2 text-rose-500">
                          <Sparkles className="h-4 w-4" />
                          <span className="text-xs font-bold uppercase tracking-widest">{getTranslation(appLanguage, "aiGuidance")}</span>
                        </div>
                        
                        <div className="mt-6 min-h-[120px] rounded-3xl bg-stone-50 p-6">
                          {isLoadingGuidance ? (
                            <div className="flex h-full flex-col items-center justify-center gap-4 py-8">
                              <Loader2 className="h-8 w-8 animate-spin text-stone-300" />
                              <p className="text-sm font-medium text-stone-400">{getTranslation(appLanguage, "consultingAI")}</p>
                            </div>
                          ) : (
                            <div className="prose prose-sm text-stone-600">
                               <p className="whitespace-pre-line leading-relaxed">{taskGuidance}</p>
                            </div>
                          )}
                        </div>

                        {/* Questionnaire Section */}
                        <div className="mt-10">
                          <div className="flex items-center gap-2 text-stone-400">
                            <ClipboardCheck className="h-4 w-4" />
                            <span className="text-xs font-bold uppercase tracking-widest">{getTranslation(appLanguage, "wellnessCheckin")}</span>
                          </div>
                          <div className="mt-6 space-y-8">
                            {selectedTask.questionnaire.map((q, qIdx) => (
                              <div key={qIdx} className="space-y-4">
                                <p className="text-sm font-semibold text-stone-800">{q.question}</p>
                                <div className="grid grid-cols-1 gap-2">
                                  {q.options.map((opt) => (
                                    <button
                                      key={opt}
                                      onClick={() => handleAnswerSelect(qIdx, opt)}
                                      className={`flex items-center justify-between rounded-xl px-5 py-3 text-sm transition-all ${
                                        userAnswers[qIdx] === opt 
                                          ? "bg-stone-900 font-bold text-white shadow-lg ring-2 ring-stone-900" 
                                          : "bg-stone-50 text-stone-600 hover:bg-stone-100 ring-1 ring-stone-200"
                                      }`}
                                    >
                                      {opt}
                                      {userAnswers[qIdx] === opt && <CheckCircle2 className="h-4 w-4" />}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="mt-12 flex flex-col gap-4">
                          <button
                            onClick={() => {
                              toggleTaskCompletion(selectedTask.id);
                              setSelectedTask(null);
                            }}
                            className={`flex items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold uppercase tracking-widest transition-all ${
                              completedTaskIds.includes(selectedTask.id) 
                                ? "bg-stone-100 text-stone-500" 
                                : "bg-stone-900 text-white hover:bg-stone-800"
                            }`}
                          >
                            {completedTaskIds.includes(selectedTask.id) 
                              ? getTranslation(appLanguage, "done") 
                              : getTranslation(appLanguage, "markCompleted")}
                          </button>

                          {questionnaireCompleted && (
                            <motion.button
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              onClick={() => {
                                if (!completedTaskIds.includes(selectedTask.id)) {
                                  toggleTaskCompletion(selectedTask.id);
                                }
                                handleNextTask();
                              }}
                              className="flex items-center justify-center gap-2 rounded-2xl bg-stone-900 py-5 text-sm font-bold uppercase tracking-widest text-white shadow-xl shadow-stone-900/20 transition-all hover:bg-stone-800"
                            >
                              {getTranslation(appLanguage, "saveNext")}
                              <ArrowRight className="h-4 w-4" />
                            </motion.button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
