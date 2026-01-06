
import { GoogleGenAI, Type } from "@google/genai";

export interface ReceiptData {
  senderName: string;
  amount: number;
  date: string;
  senderBankName: string;
  receiverName: string;
  transactionId: string;
  isReceipt: boolean;
  confidenceScore: number;
  reasoning?: string;
}

export interface ChatResponse {
  text: string;
  intent?: string;
}

// Retry mekanizması ile API çağrısı
const withRetry = async <T>(fn: () => Promise<T>, maxRetries: number = 3, delay: number = 1000): Promise<T> => {
  let lastError: Error | null = null;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      console.warn(`[Gemini] Deneme ${i + 1}/${maxRetries} başarısız:`, (error as Error).message);
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }
  throw lastError;
};

// Gemini ile dekont analizi
const analyzeWithGemini = async (cleanBase64: string, mimeType: string): Promise<ReceiptData | null> => {
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[Gemini] ❌ API key bulunamadı!");
    return null;
  }

  const ai = new GoogleGenAI({ apiKey });

  const analysisPrompt = `Bu ${mimeType === 'application/pdf' ? 'PDF dökümanı' : 'görseli'} analiz et.

GÖREV: Bu bir banka havale/EFT dekontu mu kontrol et.

Eğer DEKONT İSE şu bilgileri çıkar:
- Gönderen (hesap sahibi) adı
- Transfer tutarı (TL cinsinden, sadece sayı)
- Banka adı
- Alıcı adı
- İşlem tarihi
- Referans/işlem numarası

Eğer DEKONT DEĞİLSE: isReceipt: false döndür.
Güven skorunu 0-100 arasında ver.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: {
      parts: [
        { inlineData: { mimeType: mimeType, data: cleanBase64 } },
        { text: analysisPrompt }
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          isReceipt: { type: Type.BOOLEAN },
          senderName: { type: Type.STRING },
          amount: { type: Type.NUMBER },
          senderBankName: { type: Type.STRING },
          receiverName: { type: Type.STRING },
          date: { type: Type.STRING },
          transactionId: { type: Type.STRING },
          confidenceScore: { type: Type.NUMBER },
          reasoning: { type: Type.STRING }
        },
        required: ["isReceipt"]
      },
    },
  });

  const rawText = response.text;
  if (!rawText) return null;
  
  const jsonStr = rawText.replace(/```json\n?|```/g, '').trim();
  return JSON.parse(jsonStr) as ReceiptData;
};

// Ana analiz fonksiyonu - retry ile
export const analyzeReceipt = async (base64Data: string, mimeType: string = 'image/jpeg'): Promise<ReceiptData | null> => {
  const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  
  // Desteklenen MIME tipleri
  const supportedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
  const finalMimeType = supportedTypes.includes(mimeType) ? mimeType : 'image/jpeg';

  console.log(`[Gemini] 📄 Dekont analizi başlatılıyor... (${finalMimeType}, ${Math.round(cleanBase64.length / 1024)}KB)`);

  try {
    const result = await withRetry(() => analyzeWithGemini(cleanBase64, finalMimeType), 3, 1500);
    if (result) {
      console.log("[Gemini] ✅ Analiz başarılı:", { isReceipt: result.isReceipt, amount: result.amount, sender: result.senderName });
      return result;
    }
  } catch (error) {
    console.error("[Gemini] ❌ Tüm denemeler başarısız:", (error as Error).message);
  }

  return null;
};

// ==================== SOHBET (MÜŞTERİ TEMSİLCİSİ) ====================

export const generateChatResponse = async (
  userMessage: string,
  representativeName: string,
  systemInstruction: string,
  ibanInfo?: string | null
): Promise<ChatResponse> => {
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error("[Gemini] ❌ API Key bulunamadı!");
    return { text: "Merhaba! Size nasıl yardımcı olabilirim?" };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    // Çok güçlü ve detaylı prompt
    const prompt = `SEN "${representativeName}" ADINDA BİR MÜŞTERİ TEMSİLCİSİSİN.

═══════════════════════════════════════════════════════
⚠️ KRİTİK - KESİNLİKLE UYULMASI GEREKEN KURALLAR:
═══════════════════════════════════════════════════════

1. SEN BİR İNSANSIN - "CasiNO" online casino platformunda çalışan gerçek bir müşteri temsilcisi
2. ASLA şunları söyleme veya ima etme:
   - "yapay zeka", "AI", "bot", "asistan", "dil modeli", "LLM"
   - "Ben bir yapay zekayım", "Ben bir asistanım"
   - "Bana programlandı", "Eğitildim"
3. Doğal ve samimi konuş - gerçek bir Türk müşteri temsilcisi gibi
4. Kısa yanıtlar ver (1-3 cümle yeterli)
5. Emoji kullanabilirsin ama abartma (1-2 tane yeter)
6. "Hocam", "Kral", "Dostum" gibi samimi hitaplar kullanabilirsin
7. Türkçe karakterleri doğru kullan (ş, ğ, ü, ö, ç, ı)

═══════════════════════════════════════════════════════
📋 GÖREV VE YETKİLERİN:
═══════════════════════════════════════════════════════

- Yatırım işlemlerinde IBAN bilgisi paylaşmak
- Dekont gönderildiğinde finans ekibine iletmek
- Çekim talepleri almak
- Bonuslar hakkında bilgi vermek
- Teknik sorunlarda yardımcı olmak
- Hesap işlemleri için destek vermek

${systemInstruction ? `\nÖZEL TALİMATLAR:\n${systemInstruction}` : ''}

═══════════════════════════════════════════════════════
💬 MÜŞTERİ MESAJI:
═══════════════════════════════════════════════════════
"${userMessage}"

${ibanInfo ? `
═══════════════════════════════════════════════════════
💰 PAYLAŞILACAK YATIRIM BİLGİSİ:
═══════════════════════════════════════════════════════
${ibanInfo}

⚠️ Bu IBAN bilgisini müşteriye AYNEN paylaş!
` : ''}

═══════════════════════════════════════════════════════
✍️ YANITINI YAZ (kısa, samimi, doğal):`;

    const response = await ai.models.generateContent({ 
      model: 'gemini-2.0-flash', 
      contents: prompt 
    });
    
    let text = response.text || "";
    
    // Boş yanıt kontrolü
    if (!text || text.trim().length < 2) {
      text = ibanInfo 
        ? `Tabii hocam! İşte yatırım bilgilerimiz:${ibanInfo}`
        : "Merhaba! Size nasıl yardımcı olabilirim?";
    }
    
    // Yasak kelimeleri filtrele
    const forbiddenWords = [
      'yapay zeka', 'artificial intelligence', 'ai olarak', 'bot olarak', 
      'bir ai', 'language model', 'asistan olarak', 'bir yapay', 
      'dil modeli', 'büyük dil', 'llm', 'chatbot', 'ai sistemi',
      'programlandım', 'eğitildim', 'bir makine', 'bir program'
    ];
    
    const hasForbiddenWord = forbiddenWords.some(w => text.toLowerCase().includes(w));
    
    if (hasForbiddenWord) {
      console.warn("[Gemini] ⚠️ Yasak kelime tespit edildi, yanıt değiştiriliyor");
      text = ibanInfo 
        ? `Tabii hocam! İşte güncel yatırım bilgilerimiz:${ibanInfo}`
        : "Merhaba! Nasıl yardımcı olabilirim?";
    }
    
    return { text };
    
  } catch (error) {
    console.error("[Gemini] ❌ Chat yanıt hatası:", (error as Error).message);
    
    return { 
      text: ibanInfo 
        ? `Merhaba! İşte yatırım bilgilerimiz:${ibanInfo}`
        : "Merhaba! Size nasıl yardımcı olabilirim? Yatırım, çekim veya başka konularda destek verebilirim."
    };
  }
};

// ==================== MEDYA TİPİ BELİRLEME ====================

export const detectMediaType = (url: string): 'image' | 'pdf' | 'unknown' => {
  if (!url) return 'unknown';
  
  const lowerUrl = url.toLowerCase();
  
  // PDF kontrolü
  if (lowerUrl.includes('.pdf') || 
      lowerUrl.includes('application/pdf') ||
      lowerUrl.includes('type=pdf')) {
    return 'pdf';
  }
  
  // Görsel kontrolü
  if (lowerUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)/i) ||
      lowerUrl.includes('image/') ||
      lowerUrl.includes('data:image')) {
    return 'image';
  }
  
  // Base64 data URL kontrolü
  if (lowerUrl.startsWith('data:')) {
    if (lowerUrl.includes('application/pdf')) return 'pdf';
    if (lowerUrl.includes('image/')) return 'image';
  }
  
  return 'image'; // Varsayılan
};

// ==================== YATIRIM İSTEĞİ TESPİTİ ====================

export const isInvestmentRequest = (text: string): boolean => {
  const keywords = [
    'yatırım', 'yatırim', 'yatir', 'yatır',
    'iban', 'hesap', 'havale', 'eft',
    'para yatır', 'para gönder', 'para at',
    'yatırmak', 'yatırıcam', 'yatıracağım', 'yatırayım',
    'nasıl yatırırım', 'nasıl yatırabilirim',
    'deposit', 'transfer', 'gönder',
    'yatıracam', 'yatiracam', 'yatircam'
  ];
  
  const lowerText = text.toLowerCase();
  return keywords.some(k => lowerText.includes(k));
};
