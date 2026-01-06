
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    downloadMediaMessage 
} = require("@whiskeysockets/baileys");
const { createClient } = require("@supabase/supabase-js");
const { GoogleGenAI, Type } = require("@google/genai");
const pino = require("pino");
const fs = require("fs");
const crypto = require("crypto");

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://refpktvwsmvqxpeupkbj.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlZnBrdHZ3c212cXhwZXVwa2JqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjEzMTg2NSwiZXhwIjoyMDgxNzA3ODY1fQ.CxyrNGC52tczqZkcfi7fZeRKwKvMqzlF5j7ShW4asMc';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const activeSockets = {}; 
const lastSentIban = {}; // Kullanıcı bazlı son gönderilen IBAN'ı takip eder

// İnsan gibi metin düzenleme
const humanizeText = (text) => {
    let result = text;
    if (Math.random() > 0.7) result = result.charAt(0).toLowerCase() + result.slice(1);
    if (Math.random() > 0.6) result = result.replace(/[.!?]$/, '');
    return result;
};

// Supabase Storage'a dosya yükleme
async function uploadToStorage(buffer, mimeType, senderPhone) {
    try {
        const ext = mimeType.includes('pdf') ? 'pdf' : mimeType.includes('png') ? 'png' : 'jpg';
        const fileName = `receipts/${senderPhone}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
        
        const { data, error } = await supabase.storage
            .from('media')
            .upload(fileName, buffer, {
                contentType: mimeType,
                upsert: false
            });
        
        if (error) {
            console.error('[Storage] Yükleme hatası:', error.message);
            // Storage bucket yoksa oluşturmaya çalış
            if (error.message.includes('not found')) {
                console.log('[Storage] Bucket oluşturuluyor...');
                await supabase.storage.createBucket('media', { public: true });
                // Tekrar dene
                const retry = await supabase.storage.from('media').upload(fileName, buffer, { contentType: mimeType });
                if (retry.error) throw retry.error;
                const { data: urlData } = supabase.storage.from('media').getPublicUrl(fileName);
                return urlData.publicUrl;
            }
            throw error;
        }
        
        const { data: urlData } = supabase.storage.from('media').getPublicUrl(fileName);
        console.log('[Storage] ✅ Dosya yüklendi:', urlData.publicUrl);
        return urlData.publicUrl;
    } catch (err) {
        console.error('[Storage] ❌ Hata:', err.message);
        // Hata durumunda base64 data URL döndür (fallback)
        return `data:${mimeType};base64,${buffer.toString('base64')}`;
    }
}

async function analyzeAndReply(connectionId, senderJid, fullMsg, representativeName, sockRef) {
    const sock = sockRef || activeSockets[connectionId];
    
    // GRUP ve BROADCAST mesajlarını ATLA
    if (senderJid?.endsWith('@g.us') || senderJid?.endsWith('@broadcast') || senderJid === 'status@broadcast') {
        console.log(`[${connectionId}] ⚠️ Grup/Broadcast atlandı: ${senderJid}`);
        return;
    }
    
    // NUMARA ÇIKARMA - TÜM FORMATLARI DESTEKLE
    let senderPhone = '';
    let phonePart = (senderJid || '').split('@')[0] || '';
    
    // Eğer : varsa, öncesini al (device id'yi at)
    if (phonePart.includes(':')) {
        phonePart = phonePart.split(':')[0];
    }
    
    // Sadece rakamları al
    senderPhone = phonePart.replace(/\D/g, '');
    
    // message içeriğini al
    const message = fullMsg?.message || fullMsg;
    
    if (!sock) {
        console.error(`[${connectionId}] ❌ Socket bulunamadı!`);
        return;
    }
    
    // Telefon numarası validasyonu - TÜM ÜLKELER İÇİN (7-20 hane)
    if (!senderPhone || senderPhone.length < 7 || senderPhone.length > 20) {
        console.error(`[${connectionId}] ❌ Geçersiz numara formatı: ${senderJid} -> ${senderPhone}`);
        return;
    }

    console.log(`[${connectionId}] ========== YENİ MESAJ ==========`);
    console.log(`[${connectionId}] Gönderen: +${senderPhone}`);
    console.log(`[${connectionId}] fullMsg.key:`, JSON.stringify(fullMsg?.key || 'YOK'));

    let finalResponse = "";
    
    try {
        const { data: settings } = await supabase.from('ai_settings').select('*').eq('id', 1).single();
        const { data: ibans } = await supabase.from('ibans').select('*').eq('is_active', true).order('priority', { ascending: false });
        
        const availableIbans = (ibans || []).filter(i => (Number(i.current_total) || 0) < (Number(i.limit_amount) || Infinity));
        
        // API Key kontrolü
        const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
        if (!apiKey) {
            console.error(`[${connectionId}] ❌ GEMINI API KEY BULUNAMADI!`);
            finalResponse = "Merhaba! Size nasıl yardımcı olabilirim?";
            await sendResponse(sock, senderJid, finalResponse, connectionId, senderPhone, settings);
            return;
        }
        
        const ai = new GoogleGenAI({ apiKey });

        // Medya kontrolü - hem görsel hem PDF
        const imgMsg = message?.imageMessage || fullMsg?.message?.imageMessage;
        const docMsg = message?.documentMessage || fullMsg?.message?.documentMessage;
        const hasImage = !!imgMsg;
        const hasDocument = !!docMsg;
        const isMedia = hasImage || hasDocument;

        console.log(`[${connectionId}] Medya durumu: Image=${hasImage}, Document=${hasDocument}`);

        if (isMedia) {
            console.log(`[${connectionId}] 📷 MEDYA TESPİT EDİLDİ - Tür: ${hasImage ? 'GÖRSEL' : 'DÖKÜMAN'}`);
            
            // MIME type belirleme
            let mimeType = 'image/jpeg';
            if (hasDocument && docMsg) {
                const docMime = docMsg.mimetype || '';
                console.log(`[${connectionId}] Döküman orijinal MIME: "${docMime}"`);
                if (docMime.includes('pdf')) {
                    mimeType = 'application/pdf';
                } else if (docMime.includes('png')) {
                    mimeType = 'image/png';
                } else if (docMime.includes('jpeg') || docMime.includes('jpg')) {
                    mimeType = 'image/jpeg';
                } else {
                    mimeType = docMime || 'image/jpeg';
                }
            } else if (hasImage && imgMsg) {
                mimeType = imgMsg.mimetype || 'image/jpeg';
            }
            console.log(`[${connectionId}] Kullanılacak MIME: ${mimeType}`);
            
            // Buffer'ı indir
            let buffer = null;
            
            // YÖNTEM 1: downloadMediaMessage ile
            try {
                console.log(`[${connectionId}] 📥 Yöntem 1: downloadMediaMessage...`);
                buffer = await downloadMediaMessage(fullMsg, 'buffer', {}, {
                    logger: pino({ level: 'silent' }),
                    reuploadRequest: sock.updateMediaMessage
                });
                console.log(`[${connectionId}] ✅ Yöntem 1 başarılı: ${buffer?.length || 0} bytes`);
            } catch (err1) {
                console.error(`[${connectionId}] ❌ Yöntem 1 başarısız:`, err1.message);
                
                // YÖNTEM 2: stream ile
                try {
                    console.log(`[${connectionId}] 📥 Yöntem 2: stream...`);
                    const stream = await downloadMediaMessage(fullMsg, 'stream', {});
                    const chunks = [];
                    for await (const chunk of stream) {
                        chunks.push(chunk);
                    }
                    buffer = Buffer.concat(chunks);
                    console.log(`[${connectionId}] ✅ Yöntem 2 başarılı: ${buffer?.length || 0} bytes`);
                } catch (err2) {
                    console.error(`[${connectionId}] ❌ Yöntem 2 başarısız:`, err2.message);
                }
            }
            
            // Buffer kontrolü
            if (!buffer || buffer.length === 0) {
                console.error(`[${connectionId}] ❌ BUFFER BOŞ - Medya indirilemedi!`);
                finalResponse = "Dosyayı alamadım, tekrar gönderir misin lütfen? 🙏";
                await sendResponse(sock, senderJid, finalResponse, connectionId, senderPhone, settings);
                return;
            }
            
            console.log(`[${connectionId}] ✅ Buffer hazır: ${buffer.length} bytes`);
            
            // Storage'a yükle
            let receiptUrl = null;
            try {
                receiptUrl = await uploadToStorage(buffer, mimeType, senderPhone);
                console.log(`[${connectionId}] ✅ Storage URL:`, receiptUrl?.substring(0, 80));
            } catch (uploadErr) {
                console.error(`[${connectionId}] ⚠️ Storage hatası:`, uploadErr.message);
                receiptUrl = `data:${mimeType};base64,${buffer.toString('base64').substring(0, 100)}...`;
            }
            
            // GEMINI ANALİZ
            let analysisResult = { isReceipt: false, amount: 0, senderName: '', bankName: '' };
            
            try {
                console.log(`[${connectionId}] 🤖 Gemini'ye gönderiliyor...`);
                
                const base64Data = buffer.toString('base64');
                console.log(`[${connectionId}] Base64 boyutu: ${base64Data.length} karakter`);
                
                const prompt = `Bu ${mimeType.includes('pdf') ? 'PDF' : 'görsel'} bir banka dekontu mu analiz et.

DEKONT İSE bu JSON'u döndür:
{"isReceipt": true, "amount": TUTAR_SAYI, "senderName": "AD_SOYAD", "bankName": "BANKA_ADI"}

DEKONT DEĞİLSE:
{"isReceipt": false}

SADECE JSON döndür, başka bir şey yazma.`;

                const response = await ai.models.generateContent({
                    model: 'gemini-2.0-flash',
                    contents: [{
                        role: 'user',
                        parts: [
                            { inlineData: { mimeType: mimeType, data: base64Data } },
                            { text: prompt }
                        ]
                    }]
                });
                
                const responseText = response.text || '';
                console.log(`[${connectionId}] Gemini yanıtı: "${responseText.substring(0, 200)}"`);
                
                // JSON parse
                try {
                    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        analysisResult = JSON.parse(jsonMatch[0]);
                        console.log(`[${connectionId}] ✅ JSON parse başarılı:`, JSON.stringify(analysisResult));
                    }
                } catch (jsonErr) {
                    console.error(`[${connectionId}] ⚠️ JSON parse hatası:`, jsonErr.message);
                    // Manuel tutar arama
                    const amountMatch = responseText.match(/(\d+[.,]?\d*)\s*(TL|₺|tl)/i);
                    if (amountMatch) {
                        analysisResult = { isReceipt: true, amount: parseFloat(amountMatch[1].replace(',', '.')) };
                        console.log(`[${connectionId}] Manuel tutar bulundu: ${analysisResult.amount}`);
                    }
                }
                
            } catch (geminiErr) {
                console.error(`[${connectionId}] ❌ Gemini hatası:`, geminiErr.message);
                // Gemini hatası olsa bile devam et
                analysisResult = { isReceipt: true, amount: 0, senderName: 'Manuel Kontrol', bankName: '' };
            }
            
            // ================ TRANSACTION KAYIT ================
            // HER DURUMDA KAYIT YAP - çok önemli!
            console.log(`[${connectionId}] 💾 TRANSACTION KAYDI BAŞLIYOR...`);
            
            const timestamp = Date.now();
            const randomStr = Math.random().toString(36).substring(2, 10);
            const uniqueId = `${fullMsg?.key?.id || 'manual'}_${timestamp}_${randomStr}`;
            
            const transactionData = {
                connection_id: connectionId,
                iban_id: lastSentIban[senderPhone] || availableIbans[0]?.id || null,
                sender_name: analysisResult.senderName || 'Belirtilmemiş',
                username: '---',
                amount: analysisResult.amount || 0,
                bank_name: analysisResult.bankName || 'Belirtilmemiş',
                customer_phone: senderPhone,
                wa_message_id: uniqueId,
                receipt_url: receiptUrl,
                status: 'PENDING'
            };
            
            console.log(`[${connectionId}] Transaction data:`, JSON.stringify(transactionData, null, 2));
            
            // INSERT DENEMESI 1
            const { data: insertData, error: insertError } = await supabase
                .from('transactions')
                .insert([transactionData])
                .select();
            
            if (insertError) {
                console.error(`[${connectionId}] ❌ INSERT HATA 1:`, insertError.message, insertError.code, insertError.details);
                
                // INSERT DENEMESI 2 - farklı ID ile
                const retryData = { ...transactionData, wa_message_id: `retry_${timestamp}_${randomStr}` };
                const { data: retryInsert, error: retryError } = await supabase
                    .from('transactions')
                    .insert([retryData])
                    .select();
                
                if (retryError) {
                    console.error(`[${connectionId}] ❌ INSERT HATA 2:`, retryError.message);
                    
                    // INSERT DENEMESI 3 - minimal data
                    const minimalData = {
                        connection_id: connectionId,
                        customer_phone: senderPhone,
                        amount: analysisResult.amount || 0,
                        status: 'PENDING',
                        wa_message_id: `min_${timestamp}`
                    };
                    const { error: minError } = await supabase.from('transactions').insert([minimalData]);
                    
                    if (minError) {
                        console.error(`[${connectionId}] ❌❌❌ TÜM INSERT DENEMELERİ BAŞARISIZ!`, minError.message);
                    } else {
                        console.log(`[${connectionId}] ✅ Minimal kayıt başarılı!`);
                    }
                } else {
                    console.log(`[${connectionId}] ✅ Retry kayıt başarılı! ID:`, retryInsert?.[0]?.id);
                }
            } else {
                console.log(`[${connectionId}] ✅✅✅ TRANSACTION KAYDEDİLDİ! ID:`, insertData?.[0]?.id);
            }
            
            // YANIT OLUŞTUR
            if (analysisResult.isReceipt && analysisResult.amount > 0) {
                const amt = analysisResult.amount.toLocaleString('tr-TR');
                const responses = [
                    `Teşekkürler hocam! ${amt} TL'lik dekontu aldım, finans ekibine ilettim. 1-2 dk içinde bakiyen yüklenecek. 🎰`,
                    `Süper! ${amt} TL dekont geldi, finansa gönderdim. Birazdan bakiye hesabında olur. 🍀`,
                    `Aldım hocam ${amt} TL'yi! Finans ekibi hemen işleme alacak. 💰`
                ];
                finalResponse = responses[Math.floor(Math.random() * responses.length)];
            } else if (analysisResult.isReceipt) {
                finalResponse = "Dekontu aldım, finans ekibine ilettim. Kısa süre içinde bakiyen yüklenecek. 🎰";
            } else {
                finalResponse = "Dosyayı aldım ama dekont olarak algılayamadım. Havale/EFT dekontunun ekran görüntüsünü gönderebilir misin?";
            }
            
            console.log(`[${connectionId}] ========== MEDYA İŞLEME TAMAMLANDI ==========`);
            
        } else {
            // TEXT MESAJI
            const text = message.conversation || message.extendedTextMessage?.text || "";
            if (!text) return;
            
            console.log(`[${connectionId}] 💬 Mesaj: "${text.substring(0, 80)}"`);

            // Yatırım/IBAN isteği kontrolü
            const isInvestmentRequest = /yatırım|iban|para yatır|hesap|yatırmak|yatırıcam|yatıracağım|yatırayım|nasıl yatırırım|para göndermek|para atmak|havale|eft|yatirmak|yatirim|yatır|deposit|transfer|gönder|yatıracam|yatiracam/i.test(text);
            let ibansStr = "";
            
            if (isInvestmentRequest) {
                if (availableIbans.length > 0) {
                    const target = availableIbans[0];
                    lastSentIban[senderPhone] = target.id;
                    ibansStr = `

━━━━━━━━━━━━━━━━━━━━
📌 *YATIRIM BİLGİLERİ*
━━━━━━━━━━━━━━━━━━━━
🏦 *Banka:* ${target.bank_name}
👤 *Alıcı:* ${target.account_holder}
💳 *IBAN:* ${target.iban_number}
━━━━━━━━━━━━━━━━━━━━

✅ Yatırım sonrası dekont ekran görüntüsünü bu sohbete gönder, anında işleme alıyoruz!`;
                    console.log(`[${connectionId}] 💰 IBAN paylaşılacak: ${target.bank_name}`);
                } else {
                    console.log(`[${connectionId}] ⚠️ Aktif IBAN yok!`);
                    ibansStr = "\n\nŞu an sistemde aktif hesap bulunmuyor, birazdan tekrar dener misin?";
                }
            }

            const systemInstruction = settings?.ai_instruction || '';
            const tone = settings?.tone || 'SAMIMI';
            
            // TONE'a göre hitap ve üslup belirleme
            let toneInstructions = '';
            switch(tone) {
                case 'KURUMSAL':
                    toneInstructions = `
ÜSLUP: KURUMSAL / RESMİ
- "Efendim", "Sayın Müşterimiz", "Değerli Müşterimiz" gibi resmi hitaplar kullan
- Kesinlikle "hocam", "kral", "dostum" gibi samimi ifadeler KULLANMA
- Cümleleri "Rica ederim", "Yardımcı olabilir miyim?" şeklinde bitir
- Her zaman nazik ve profesyonel ol
- Emoji kullanma veya çok az kullan (maksimum 1)
- "Size nasıl yardımcı olabilirim?" tarzı resmi cümleler kur`;
                    break;
                case 'PRO':
                    toneInstructions = `
ÜSLUP: PROFESYONELs
- Net ve kısa cümleler kur
- Gereksiz kelimelerden kaçın
- "Merhaba", "İyi günler" gibi profesyonel selamlaşmalar kullan
- İşe odaklan, fazla sohbet etme
- 1-2 emoji kullanabilirsin`;
                    break;
                case 'AGRESIF':
                    toneInstructions = `
ÜSLUP: AGRESİF / SATIŞÇI
- Satış odaklı konuş, fırsatları vurgula
- "Kaçırma!", "Hemen yatır!", "Şansını dene!" gibi teşvik edici ifadeler kullan
- Bonusları ve avantajları öne çıkar
- Heyecan ver, aciliyet hissi yarat
- Emoji kullanabilirsin 🔥💰🎰`;
                    break;
                default: // SAMIMI
                    toneInstructions = `
ÜSLUP: SAMİMİ
- "Hocam", "Kral", "Dostum", "Kardeşim" gibi samimi hitaplar kullan
- Arkadaşça ve rahat konuş
- Emoji kullanabilirsin 😊🎰💰
- Kısa ve öz cevaplar ver`;
            }
            
            // Çok güçlü prompt - AI kesinlikle insan gibi davranmalı
            const prompt = `SEN "${representativeName}" ADINDA BİR MÜŞTERİ TEMSİLCİSİSİN.

═══════════════════════════════════════════════════════
⚠️ KRİTİK KURALLAR - KESİNLİKLE UYGULANMALI:
═══════════════════════════════════════════════════════

1. SEN BİR İNSANSIN - Gerçek bir müşteri temsilcisi olarak davran
2. ASLA şunları söyleme veya ima etme:
   - "yapay zeka", "AI", "bot", "asistan", "dil modeli", "LLM"
   - "Ben bir yapay zekayım", "Ben bir asistanım"
   - "Bana programlandı", "Eğitildim"
3. Kısa yanıtlar ver (1-3 cümle yeterli)
4. Türkçe karakterleri doğru kullan

${toneInstructions}

═══════════════════════════════════════════════════════
📋 GÖREV VE YETKİLERİN:
═══════════════════════════════════════════════════════

- Yatırım işlemlerinde IBAN bilgisi paylaşmak
- Dekont gönderildiğinde finans ekibine iletmek
- Çekim talepleri almak
- Bonuslar hakkında bilgi vermek
- Teknik sorunlarda yardımcı olmak

${systemInstruction ? `\n🔧 ÖZEL TALİMATLAR (ÇOK ÖNEMLİ - MUTLAKA UYGULA): ${systemInstruction}` : ''}

═══════════════════════════════════════════════════════
💬 MÜŞTERİ MESAJI: "${text}"
═══════════════════════════════════════════════════════

${ibansStr ? `
💰 PAYLAŞILACAK YATIRIM BİLGİSİ (AYNEN VER):
${ibansStr}
` : ''}

✍️ YANITINI YAZ:`;
            
            try {
                const chatRes = await ai.models.generateContent({ 
                    model: 'gemini-2.0-flash', 
                    contents: prompt 
                });
                
                finalResponse = chatRes.text || "";
                
                // Boş yanıt kontrolü
                if (!finalResponse || finalResponse.trim().length < 2) {
                    finalResponse = ibansStr 
                        ? `Tabii hocam! İşte güncel yatırım bilgilerimiz:${ibansStr}`
                        : "Merhaba! Size nasıl yardımcı olabilirim?";
                }
                
                // Yapay zeka ifadelerini filtrele
                const badWords = ['yapay zeka', 'ai olarak', 'bot olarak', 'bir ai', 'language model', 'asistan olarak', 'bir yapay', 'dil modeli', 'büyük dil', 'llm', 'chatbot', 'programlandım', 'eğitildim'];
                const hasBadWord = badWords.some(w => finalResponse.toLowerCase().includes(w));
                
                if (hasBadWord) {
                    console.log(`[${connectionId}] ⚠️ AI ifadesi tespit edildi, değiştiriliyor`);
                    finalResponse = ibansStr 
                        ? `Tabii hocam! Güncel yatırım bilgilerimiz:${ibansStr}`
                        : "Merhaba! Nasıl yardımcı olabilirim?";
                }
                
                // IBAN istediyse ama yanıtta IBAN yoksa ekle
                if (isInvestmentRequest && availableIbans.length > 0 && !finalResponse.includes('IBAN')) {
                    finalResponse = finalResponse.replace(/[.!?]?\s*$/, '') + ibansStr;
                }
                
            } catch (chatErr) {
                console.error(`[${connectionId}] ❌ Gemini Chat hatası:`, chatErr.message);
                // Hata durumunda düzgün yanıt ver
                if (ibansStr && availableIbans.length > 0) {
                    finalResponse = `Merhaba hocam! İşte güncel yatırım bilgilerimiz:${ibansStr}`;
                } else {
                    finalResponse = "Merhaba! Size nasıl yardımcı olabilirim? Yatırım, çekim veya başka konularda destek verebilirim.";
                }
            }
        }

        await sendResponse(sock, senderJid, finalResponse, connectionId, senderPhone, settings);
        
    } catch (e) { 
        console.error(`[${connectionId}] analyzeAndReply HATA:`, e.message, e.stack);
        // Hata durumunda bile düzgün yanıt ver
        try {
            await sock.sendMessage(senderJid, { text: "Merhaba! Nasıl yardımcı olabilirim?" });
        } catch (sendErr) {}
    }
}

async function sendResponse(sock, senderJid, text, connectionId, senderPhone, settings) {
    if (!text) return;
    
    try {
        let finalText = text;
        if (settings?.human_simulation) {
            finalText = humanizeText(text);
        }
        
        await sock.sendPresenceUpdate('composing', senderJid);
        await new Promise(r => setTimeout(r, (settings?.delay_seconds || 2) * 1000));
        await sock.sendMessage(senderJid, { text: finalText });
        
        await supabase.from('whatsapp_messages').insert([{ 
            connection_id: connectionId, 
            sender_phone: senderPhone, 
            message_text: finalText, 
            is_from_me: true 
        }]);
        
        console.log(`[${connectionId}] ✅ Yanıt gönderildi: "${finalText.substring(0, 50)}..."`);
    } catch (err) {
        console.error(`[${connectionId}] Mesaj gönderme hatası:`, err.message);
    }
}

async function startWhatsApp(connectionId, repName, phone = null) {
    if (activeSockets[connectionId]) {
        console.log(`[${connectionId}] Socket zaten aktif, atlanıyor`);
        return;
    }
    
    const authFolder = `./auth_sessions/${connectionId}`;
    if (!fs.existsSync(authFolder)) fs.mkdirSync(authFolder, { recursive: true });
    
    console.log(`[${connectionId}] Auth state yükleniyor...`);
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);
    const { version } = await fetchLatestBaileysVersion();
    console.log(`[${connectionId}] Baileys version: ${version.join('.')}`);

    // Telefon numarası temizle - sadece rakamlar
    const cleanPhone = phone ? phone.replace(/\D/g, '') : null;
    const usePairingCode = cleanPhone && cleanPhone.length >= 10 && !state.creds.registered;
    
    console.log(`[${connectionId}] Pairing mode: ${usePairingCode ? 'TELEFON NUMARASI' : 'QR KOD'}`);

    const sock = makeWASocket({
        version,
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })) },
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        browser: ["CasiNO AI", "Chrome", "1.0.0"],
        mobile: false,
        syncFullHistory: false
    });

    activeSockets[connectionId] = sock;
    
    // Pairing code flag'i - connection.update içinden erişilebilir
    let pairingCodeRequested = false;

    sock.ev.on("connection.update", async (update) => {
        const { connection, qr, lastDisconnect } = update;
        
        console.log(`[${connectionId}] Bağlantı durumu:`, connection || 'update', qr ? '(QR var)' : '');
        
        // Pairing code kullanılacaksa ve henüz istenmemişse
        if (usePairingCode && !pairingCodeRequested && !sock.authState.creds.registered) {
            pairingCodeRequested = true;
            console.log(`[${connectionId}] 📱 Pairing code isteniyor... Numara: ${cleanPhone}`);
            
            try {
                // Biraz bekle socket hazır olsun
                await new Promise(r => setTimeout(r, 2000));
                
                const code = await sock.requestPairingCode(cleanPhone);
                
                if (code) {
                    // Kodu formatla: XXXX-XXXX
                    const formattedCode = code.match(/.{1,4}/g)?.join('-') || code;
                    console.log(`[${connectionId}] ✅ Pairing code oluşturuldu: ${formattedCode}`);
                    
                    await supabase.from('whatsapp_connections').update({ 
                        pairing_code: formattedCode, 
                        status: 'PAIRING_READY',
                        qr_code: null 
                    }).eq('id', connectionId);
                } else {
                    console.error(`[${connectionId}] ❌ Pairing code boş döndü`);
                }
            } catch (pairErr) {
                console.error(`[${connectionId}] Pairing code hatası:`, pairErr.message);
                pairingCodeRequested = false; // Tekrar denenebilir
                
                // Hata bildir
                await supabase.from('whatsapp_connections').update({ 
                    status: 'ERROR',
                    pairing_code: null 
                }).eq('id', connectionId);
            }
        }
        
        // QR kod oluşturulduğunda (pairing mode DEĞİLSE)
        if (qr && !usePairingCode) {
            console.log(`[${connectionId}] ✅ QR kod oluşturuldu`);
            await supabase.from('whatsapp_connections').update({ 
                qr_code: qr, 
                status: 'QR_READY',
                pairing_code: null 
            }).eq('id', connectionId);
        }
        
        if (connection === "open") {
            const phoneNumber = sock.user?.id?.split(':')[0] || sock.user?.id?.split('@')[0];
            console.log(`[${connectionId}] 🎉 BAĞLANTI BAŞARILI! Numara: ${phoneNumber}`);
            await supabase.from('whatsapp_connections').update({ 
                status: 'CONNECTED', 
                phone_number: phoneNumber, 
                qr_code: null, 
                pairing_code: null,
                last_seen: new Date().toISOString()
            }).eq('id', connectionId);
        }
        
        if (connection === "close") {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const reason = DisconnectReason[statusCode] || statusCode;
            console.log(`[${connectionId}] Bağlantı kapandı. Sebep: ${reason} (${statusCode})`);
            
            // Socket'i temizle
            delete activeSockets[connectionId];
            
            // Logout değilse yeniden bağlanmayı dene
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== 401;
            
            if (shouldReconnect) {
                console.log(`[${connectionId}] Yeniden bağlanılıyor...`);
                await supabase.from('whatsapp_connections').update({ status: 'RECONNECTING' }).eq('id', connectionId);
                // Kısa bir gecikme ile yeniden başlat
                setTimeout(() => startWhatsApp(connectionId, repName, phone), 3000);
            } else {
                console.log(`[${connectionId}] Oturum kapatıldı, yeniden bağlanma yapılmayacak.`);
                await supabase.from('whatsapp_connections').update({ status: 'DISCONNECTED', qr_code: null, pairing_code: null }).eq('id', connectionId);
                // Auth klasörünü temizle
                try {
                    fs.rmSync(authFolder, { recursive: true, force: true });
                } catch (e) {}
            }
        }
    });

    // Kimlik bilgilerini kaydet - ÇOK ÖNEMLİ!
    sock.ev.on("creds.update", async () => {
        await saveCreds();
        console.log(`[${connectionId}] Kimlik bilgileri kaydedildi`);
    });
    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;
        
        const rawJid = msg.key.remoteJid || '';
        
        console.log(`[${connectionId}] 🔍 RAW JID: "${rawJid}"`);
        console.log(`[${connectionId}] 🔍 MSG KEY:`, JSON.stringify(msg.key));
        
        // GRUP ve BROADCAST mesajlarını ATLA - bunlar gerçek müşteri değil
        if (rawJid.endsWith('@g.us') || rawJid.endsWith('@broadcast') || rawJid === 'status@broadcast') {
            console.log(`[${connectionId}] ⚠️ Grup/Broadcast mesajı atlandı: ${rawJid}`);
            return;
        }
        
        // NUMARA ÇIKARMA - TÜM FORMATLARI DESTEKLE
        // Formatlar: 
        // - 905551234567@s.whatsapp.net
        // - 995551234567:12@s.whatsapp.net (device id ile)
        // - +905551234567@s.whatsapp.net (+ ile)
        let senderPhone = '';
        
        // Önce @ öncesini al
        let phonePart = rawJid.split('@')[0] || '';
        
        // Eğer : varsa, öncesini al (device id'yi at)
        if (phonePart.includes(':')) {
            phonePart = phonePart.split(':')[0];
        }
        
        // Sadece rakamları al
        senderPhone = phonePart.replace(/\D/g, '');
        
        console.log(`[${connectionId}] 📱 Çıkarılan numara: phonePart="${phonePart}" -> senderPhone="${senderPhone}"`);
        
        // Telefon numarası validasyonu - TÜM ÜLKELER İÇİN (7-20 hane)
        if (!senderPhone || senderPhone.length < 7 || senderPhone.length > 20) {
            console.log(`[${connectionId}] ⚠️ Geçersiz numara formatı: ${rawJid} -> ${senderPhone} (${senderPhone.length} hane)`);
            return;
        }
        
        console.log(`[${connectionId}] ✅ KAYIT EDİLECEK NUMARA: +${senderPhone}`);
        
        const msgText = msg.message.conversation || msg.message.extendedTextMessage?.text || "[Medya]";

        await supabase.from('whatsapp_messages').insert([{ connection_id: connectionId, wa_message_id: msg.key.id, sender_phone: senderPhone, message_text: msgText, is_from_me: false, is_media: !!(msg.message.imageMessage || msg.message.documentMessage) }]);
        
        // TÜM msg objesi gönderiliyor - downloadMediaMessage için gerekli
        analyzeAndReply(connectionId, msg.key.remoteJid, msg, repName, sock);
    });
}

async function run() {
    console.log('=== WhatsApp Worker Başlatılıyor ===');
    
    const { data: conns, error } = await supabase.from('whatsapp_connections').select('*');
    
    if (error) {
        console.error('Bağlantılar alınamadı:', error.message);
        return;
    }
    
    console.log(`${conns?.length || 0} mevcut bağlantı bulundu`);
    
    // Mevcut bağlantıları başlat
    for (const c of (conns || [])) {
        console.log(`[${c.id}] ${c.name} başlatılıyor... (Durum: ${c.status})`);
        await startWhatsApp(c.id, c.representative_name, c.phone_number);
    }
    
    // Yeni bağlantıları dinle
    supabase.channel('conns_realtime')
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'whatsapp_connections' 
        }, (payload) => {
            console.log(`[YENİ BAĞLANTI] ${payload.new.name} (${payload.new.id})`);
            startWhatsApp(payload.new.id, payload.new.representative_name, payload.new.phone_number);
        })
        .on('postgres_changes', { 
            event: 'DELETE', 
            schema: 'public', 
            table: 'whatsapp_connections' 
        }, (payload) => {
            const connId = payload.old.id;
            console.log(`[BAĞLANTI SİLİNDİ] ${connId}`);
            if (activeSockets[connId]) {
                try {
                    activeSockets[connId].logout();
                } catch(e) {}
                delete activeSockets[connId];
            }
            // Auth klasörünü temizle
            try {
                fs.rmSync(`./auth_sessions/${connId}`, { recursive: true, force: true });
            } catch (e) {}
        })
        .subscribe((status) => {
            console.log('Realtime bağlantı dinleme durumu:', status);
        });

    // Manuel mesaj gönderimlerini dinle (ChatSimulator'dan gelen)
    supabase.channel('manual_messages_realtime')
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'whatsapp_messages' 
        }, async (payload) => {
            const msg = payload.new;
            
            // is_from_me=true ve is_outgoing=true olan mesajları WhatsApp'a gönder
            // sender_phone/target_phone = hedef numara
            if (msg.is_from_me && msg.is_outgoing) {
                const sock = activeSockets[msg.connection_id];
                const targetPhone = msg.target_phone || msg.sender_phone;
                
                if (!targetPhone || targetPhone.length < 10) {
                    console.log(`[MANUEL] ⚠️ Geçersiz hedef numara: ${targetPhone}`);
                    return;
                }
                
                if (sock) {
                    try {
                        const jid = `${targetPhone}@s.whatsapp.net`;
                        console.log(`[MANUEL] 📤 ${msg.connection_id} -> ${jid}: ${msg.message_text.substring(0, 50)}...`);
                        
                        await sock.sendPresenceUpdate('composing', jid);
                        await new Promise(r => setTimeout(r, 1500));
                        await sock.sendMessage(jid, { text: msg.message_text });
                        
                        // Mesajı gönderildi olarak işaretle
                        await supabase.from('whatsapp_messages')
                            .update({ is_outgoing: false })
                            .eq('id', msg.id);
                            
                        console.log(`[MANUEL] ✅ Mesaj gönderildi: ${targetPhone}`);
                    } catch (e) {
                        console.error(`[MANUEL] ❌ Gönderim hatası:`, e.message);
                    }
                } else {
                    console.log(`[MANUEL] ⚠️ Socket aktif değil: ${msg.connection_id}`);
                }
            }
        })
        .subscribe((status) => {
            console.log('Realtime mesaj dinleme durumu:', status);
        });
    
    console.log('=== Worker Hazır - Realtime Dinleniyor ===');
}

run();
