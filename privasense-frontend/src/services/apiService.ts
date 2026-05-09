const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export const apiService = {
  async healthCheck() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(`${API_BASE_URL}/health`, { signal: controller.signal });
      clearTimeout(timeoutId);
      return await response.json();
    } catch (e) {
      return { status: "offline" };
    }
  },

  async generateJoinCode(userId: string) {
    const response = await fetch(`${API_BASE_URL}/generate_join_code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
    if (!response.ok) throw new Error("Failed to generate join code");
    return response.json();
  },

  async verifyJoinCode(code: string, caregiverChatId: number = 1) {
    const response = await fetch(`${API_BASE_URL}/verify_join_code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, caregiver_chat_id: caregiverChatId }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Invalid join code");
    }
    return response.json();
  },

  async analyzeDemo(userId: string, motorScore?: number, speechText?: string) {
    const formData = new FormData();
    formData.append("user_id", userId);
    if (motorScore !== undefined) formData.append("motor_score", motorScore.toString());
    if (speechText !== undefined) formData.append("speech_text", speechText);
    
    const response = await fetch(`${API_BASE_URL}/demo`, {
      method: "POST",
      body: formData,
    });
    if (!response.ok) throw new Error("Analysis failed");
    return response.json();
  },

  async getHistory(userId: string) {
    const response = await fetch(`${API_BASE_URL}/history/${userId}`);
    if (!response.ok) throw new Error("Failed to fetch history");
    return response.json();
  },

  async getStatus(userId: string) {
    const response = await fetch(`${API_BASE_URL}/status/${userId}`);
    if (!response.ok) throw new Error("Failed to fetch status");
    return response.json();
  },

  async getPlan(userId: string) {
    const response = await fetch(`${API_BASE_URL}/plan/${userId}`);
    if (!response.ok) throw new Error("Failed to fetch plan");
    return response.json();
  }
};
