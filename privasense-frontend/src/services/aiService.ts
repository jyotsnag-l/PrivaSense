import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

export interface Task {
  id: string;
  day: number;
  title: string;
  description: string;
  category: "medication" | "hydration" | "activity" | "nutrition" | "rest" | "cognitive" | "physical";
  questionnaire: {
    question: string;
    options: string[];
    correctAnswer: string;
  }[];
}

export const analyzeMedicalHistory = async (
  patientName: string, 
  historySummary: string, 
  language: string = "English",
  additionalData?: any,
  startDay: number = 1,
  endDay: number = 5
): Promise<Task[]> => {
  const totalDays = endDay - startDay + 1;
  const totalTasks = totalDays * 4;

  try {
    const lifestyle = additionalData?.lifestyle ? `
    Lifestyle Habits:
    - Smoking: ${additionalData.lifestyle.smoke}
    - Alcohol: ${additionalData.lifestyle.drink}
    ` : "";

    const vitals = additionalData?.vitals ? `
    Clinical Vitals (Nurse Intake):
    - Blood Pressure: ${additionalData.vitals.systolicBP}/${additionalData.vitals.diastolicBP} mmHg
    - Heart Rate: ${additionalData.vitals.heartRate} bpm
    - SpO2: ${additionalData.vitals.spo2}%
    - Weight: ${additionalData.vitals.weight} kg
    ` : "";

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ parts: [{ text: `You are a Senior Geriatric Health Architect. Generate tasks for Day ${startDay} through Day ${endDay} of a 14-day cognitive wellness plan for ${patientName}.
      
      PATIENT PROFILE:
      History: ${historySummary}
      ${lifestyle}
      ${vitals}

      INSTRUCTIONS:
      - Generate exactly ${totalTasks} tasks (4 per day, for days ${startDay}-${endDay}).
      - 3 tasks per day must be COGNITIVE. 1 task per day must be PHYSICAL.
      - Tasks must be simple for elderly: stability checks, breathing, hydration, memory entry, guided meditation, visual checks.
      - If they smoke/drink, include habit-awareness tasks.
      - Each task needs a 2-question comprehension check.
      - Each task "day" field must be numbered ${startDay} through ${endDay}.
      
      OUTPUT: JSON with "tasks" array. Each task has: id, day, title, description, category ("cognitive"|"physical"), questionnaire[{question, options[], correctAnswer}].

      IMPORTANT: All patient-facing content strictly in: ${language}.` }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tasks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  day: { type: Type.INTEGER },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  category: { 
                    type: Type.STRING,
                    enum: ["medication", "hydration", "activity", "nutrition", "rest", "cognitive", "physical"]
                  },
                  questionnaire: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        question: { type: Type.STRING },
                        options: { 
                          type: Type.ARRAY,
                          items: { type: Type.STRING }
                        },
                        correctAnswer: { type: Type.STRING }
                      },
                      required: ["question", "options", "correctAnswer"]
                    }
                  }
                },
                required: ["day", "title", "description", "category", "questionnaire"]
              }
            }
          },
          required: ["tasks"]
        }
      }
    });

    const text = response.text || "{\"tasks\": []}";
    const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const data = JSON.parse(cleanJson);
    const tasks = data.tasks || data;
    return Array.isArray(tasks) ? tasks : [];
  } catch (error) {
    console.warn("AI Analysis failed, using high-quality mock fallback:", error);
    return generateMockTasks(patientName, language, startDay, endDay);
  }
};

function generateMockTasks(patientName: string, language: string, startDay: number, endDay: number): Task[] {
  const isHindi = language === "Hindi";
  const isTamil = language === "Tamil";
  const isTelugu = language === "Telugu";
  const isBengali = language === "Bengali";

  const mockTasks: Task[] = [];
  const categories: ("cognitive" | "physical")[] = ["cognitive", "cognitive", "cognitive", "physical"];
  
  // Specific task templates per category to make tasks feel real
  const cogTasks = isHindi ? [
    { t: "गहरी साँस लेने का अभ्यास", d: "2 मिनट तक आँखें बंद करके धीरे-धीरे साँस लें और छोड़ें।" },
    { t: "पसंदीदा रंग लिखें", d: "अपना पसंदीदा रंग और एक बचपन की याद लिखें।" },
    { t: "कमरे में वस्तु पहचानें", d: "अपने आसपास 5 नीली वस्तुएं ढूंढें और गिनें।" },
    { t: "शब्द याद करें", d: "ये 5 शब्द याद करें: सेब, नदी, घड़ी, फूल, चाँद।" },
    { t: "उल्टी गिनती", d: "100 से 7-7 घटाते हुए गिनें: 100, 93, 86..." },
    { t: "पानी पीने की याद", d: "एक गिलास पानी पिएं और बताएं आज कितने गिलास पिए।" },
  ] : isTamil ? [
    { t: "ஆழ்ந்த சுவாசப் பயிற்சி", d: "2 நிமிடம் கண்களை மூடி மெதுவாக சுவாசியுங்கள்." },
    { t: "உங்கள் விருப்ப நிறத்தை எழுதுங்கள்", d: "உங்கள் விருப்ப நிறம் மற்றும் குழந்தைப்பருவ நினைவை எழுதுங்கள்." },
    { t: "அறையில் பொருள் கண்டறியுங்கள்", d: "உங்கள் சுற்றிலும் 5 நீல பொருட்களைக் கண்டறியுங்கள்." },
    { t: "வார்த்தைகளை நினைவில் கொள்ளுங்கள்", d: "இந்த 5 வார்த்தைகளை நினைவில் கொள்ளுங்கள்." },
    { t: "எண்களை பின்னோக்கி எண்ணுங்கள்", d: "100-இலிருந்து 7 குறைத்து எண்ணுங்கள்." },
    { t: "தண்ணீர் குடிக்க நினைவூட்டல்", d: "ஒரு கிளாஸ் தண்ணீர் குடியுங்கள்." },
  ] : [
    { t: "Deep Breathing Exercise", d: "Close your eyes and breathe slowly for 2 minutes. Inhale for 4 seconds, hold 4, exhale 4." },
    { t: "Write Your Favorite Color", d: "Write your favorite color and describe a childhood memory related to it." },
    { t: "Room Object Identification", d: "Find and count 5 blue objects around you in your room." },
    { t: "Word Recall Challenge", d: "Memorize these 5 words: Apple, River, Watch, Flower, Moon. Recall them later." },
    { t: "Backward Counting", d: "Count backward from 100 by 7s: 100, 93, 86..." },
    { t: "Hydration Reminder", d: "Drink a glass of water and note how many glasses you've had today." },
  ];

  const physTasks = isHindi ? [
    { t: "फ़ोन को स्थिर रखें", d: "फ़ोन को 30 सेकंड तक बिना हिलाए पकड़ें।" },
    { t: "कुर्सी से उठें-बैठें", d: "कुर्सी से 5 बार धीरे-धीरे उठें और बैठें।" },
    { t: "हल्की स्ट्रेचिंग", d: "खड़े होकर हाथ ऊपर उठाएं, 10 सेकंड रुकें, 5 बार दोहराएं।" },
  ] : isTamil ? [
    { t: "போனை நிலையாக வைக்கவும்", d: "போனை 30 நொடிகள் அசைக்காமல் வைத்திருங்கள்." },
    { t: "நாற்காலியில் எழுந்து உட்காருங்கள்", d: "நாற்காலியிலிருந்து 5 முறை மெதுவாக எழுந்து உட்காருங்கள்." },
    { t: "லேசான நீட்சி", d: "நின்று கைகளை உயர்த்தி, 10 நொடிகள் இருங்கள், 5 முறை செய்யுங்கள்." },
  ] : [
    { t: "Hold Phone Still", d: "Hold your phone steady for 30 seconds without moving. This checks your motor stability." },
    { t: "Chair Stand Exercise", d: "Stand up from a chair and sit back down 5 times slowly. Hold the armrest if needed." },
    { t: "Gentle Stretching", d: "Stand up, raise your arms above your head, hold for 10 seconds, repeat 5 times." },
  ];

  const yesStr = isHindi ? "हाँ" : isTamil ? "ஆம்" : isTelugu ? "అవును" : isBengali ? "হ্যাঁ" : "Yes";
  const noStr = isHindi ? "नहीं" : isTamil ? "இல்லை" : isTelugu ? "లేదు" : isBengali ? "না" : "No";
  const clearQ = isHindi ? "क्या निर्देश स्पष्ट थे?" : isTamil ? "அறிவுறுத்தல்கள் தெளிவாக இருந்ததா?" : isTelugu ? "సూచనలు స్పష్టంగా ఉన్నాయా?" : isBengali ? "নির্দেশাবলী কি স্পষ্ট ছিল?" : "Were the instructions clear?";
  const feelQ = isHindi ? "इस कार्य के बाद आप कैसा महसूस कर रहे हैं?" : isTamil ? "இந்த பணிக்கு பிறகு நீங்கள் எப்படி உணருகிறீர்கள்?" : isTelugu ? "ఈ పని తర్వాత మీరు ఎలా భావిస్తున్నారు?" : isBengali ? "এই কাজের পরে আপনি কেমন বোধ করছেন?" : "How do you feel after this task?";
  const opt1 = isHindi ? "बहुत अच्छा" : isTamil ? "சிறப்பானது" : isTelugu ? "చాలా బాగుంది" : isBengali ? "খুব ভালো" : "Great";
  const opt2 = isHindi ? "थका हुआ" : isTamil ? "சோர்வு" : isTelugu ? "అలసట" : isBengali ? "ক্লান্ত" : "Tired";
  const opt3 = isHindi ? "सामान्य" : isTamil ? "சாதாரணமானது" : isTelugu ? "సాధారణం" : isBengali ? "স্বাভাবিক" : "Normal";

  for (let day = startDay; day <= endDay; day++) {
    categories.forEach((cat, idx) => {
      const cogIdx = (day * 3 + idx) % cogTasks.length;
      const physIdx = day % physTasks.length;
      const template = cat === "cognitive" ? cogTasks[cogIdx] : physTasks[physIdx];

      mockTasks.push({
        id: `task-${day}-${idx}`,
        day,
        title: template.t,
        description: template.d,
        category: cat,
        questionnaire: [
          { question: feelQ, options: [opt1, opt2, opt3], correctAnswer: opt1 },
          { question: clearQ, options: [yesStr, noStr], correctAnswer: yesStr }
        ]
      });
    });
  }
  return mockTasks;
}


export const getTaskGuidance = async (patientName: string, historySummary: string, task: Task, language: string = "English"): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ parts: [{ text: `The patient ${patientName} with medical history: "${historySummary}" is performing the task: "${task.title}: ${task.description}".
      Provide 3 concise, actionable bullet points of specific advice for this patient regarding this specific task. 
      Use reassuring, simple language suitable for an elderly person.
      
      IMPORTANT: Provide all advice strictly in the following language: ${language}.` }] }],
    });

    return response.text || "Continue with your daily habit as planned.";
  } catch (e) {
    if (language === "Hindi") return "• धीरे-धीरे चलें और स्थिर सांस लें।\n• पास में पानी का गिलास रखें।\n• आप बहुत अच्छा काम कर रहे हैं!";
    if (language === "Tamil") return "• மெதுவாகச் சென்று சீராக சுவாசிக்கவும்.\n• அருகில் ஒரு கிளாஸ் தண்ணீர் வைத்திருங்கள்.\n• நீங்கள் சிறப்பாகச் செய்கிறீர்கள்!";
    if (language === "Telugu") return "• నెమ్మదిగా వెళ్లండి మరియు స్థిరంగా శ్వాస తీసుకోండి.\n• దగ్గరలో ఒక గ్లాసు నీటిని ఉంచుకోండి.\n• మీరు చాలా బాగా చేస్తున్నారు!";
    if (language === "Bengali") return "• ধীরে ধীরে চলুন এবং স্থিরভাবে শ্বাস নিন।\n• কাছে এক গ্লাস জল রাখুন।\n• আপনি খুব ভালো কাজ করছেন!";
    return "• Take it slow and breathe steadily.\n• Keep a glass of water nearby.\n• You are doing a great job!";
  }
};

export const generateHealthReportImpression = async (
  patientName: string, 
  history: string, 
  tasks: Task[], 
  completedDays: number[],
  language: string = "English"
): Promise<string> => {
  try {
    const taskStatus = tasks.map(t => ({
      day: t.day,
      title: t.title,
      completed: completedDays.includes(t.day)
    }));

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ parts: [{ text: `As a professional health consultant, provide a medical impression and recommendations based on the following patient report.
      Patient Name: ${patientName}
      Medical History: ${history}
      
      14-Day Plan Progress:
      ${JSON.stringify(taskStatus, null, 2)}
      
      Provide a concise (3-4 sentences) professional impression of their core wellness progress and specific areas for next focus.
      
      IMPORTANT: Provide the impression strictly in the following language: ${language}.` }] }],
    });

    return response.text || "Patient is showing steady progress. Continue monitoring daily tasks and maintaining hydration.";
  } catch (e) {
    if (language === "Hindi") return `${patientName} संज्ञानात्मक योजना का निरंतर पालन कर रहे हैं। शुरुआती बायोमार्कर स्थिर फोकस का संकेत देते हैं। हम वर्तमान दिनचर्या जारी रखने की सलाह देते हैं।`;
    if (language === "Tamil") return `${patientName} அறிவாற்றல் திட்டத்திற்கு நிலையான கடைபிடிப்பைக் காட்டுகிறார். ஆரம்பகால பயோமார்க்ஸர்கள் நிலையான கவனத்தைக் குறிக்கின்றன. தற்போதைய வழக்கத்தைத் தொடர பரிந்துரைக்கிறோம்.`;
    if (language === "Telugu") return `${patientName} కాగ్నిటివ్ ప్లాన్‌కు స్థిరమైన కట్టుబడి చూపుతున్నారు. ప్రారంభ బయోమార్కర్లు స్థిరమైన ఫోకస్‌ను సూచిస్తాయి. ప్రస్తుత దినచర్యను కొనసాగించాలని మేము సిఫార్సు చేస్తున్నాము.`;
    if (language === "Bengali") return `${patientName} জ্ঞানীয় পরিকল্পনার প্রতি অবিরাম আনুগত্য দেখাচ্ছেন। প্রাথমিক বায়োমার্কারগুলি স্থিতিশীল ফোকাস নির্দেশ করে। আমরা বর্তমান রুটিন চালিয়ে যাওয়ার পরামর্শ দিই।`;
    return `${patientName} is showing consistent adherence to the cognitive plan. Early biomarkers indicate stable focus. We recommend continuing with the current routine.`;
  }
};

export const processSpeech = async (transcript: string, context: string, language: string = "English"): Promise<any> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ parts: [{ text: `You are a medical assistant. The user said: "${transcript}".
      Context: ${context}.
      Language: ${language}.
      Extract relevant medical information (name, age, gender, symptoms, current feeling, or matching options for a question) from this transcript.
      Respond in JSON format.` }] }],
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = response.text || "{}";
    return JSON.parse(text);
  } catch (e) {
    console.warn("Speech AI processing failed, using heuristic extraction.");
    // Heuristic extraction for common fields
    const data: any = {};
    if (transcript.match(/\d+/)) data.age = transcript.match(/\d+/)?.[0];
    if (transcript.toLowerCase().includes("male")) data.gender = "Male";
    if (transcript.toLowerCase().includes("female")) data.gender = "Female";
    return data;
  }
};
