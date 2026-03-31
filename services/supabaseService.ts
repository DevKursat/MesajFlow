import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot
} from "firebase/firestore";
import { Transaction, Iban, AiSettings, WhatsAppConnection, WhatsAppMessage, BusinessType } from '../types';

const firebaseConfig = {
  apiKey: "AIzaSyAMAc_ianZwaPOrM1ZmzpLvCRq7ZjEoarE",
  authDomain: "mesaj-flow.firebaseapp.com",
  projectId: "mesaj-flow",
  storageBucket: "mesaj-flow.firebasestorage.app",
  messagingSenderId: "307489243875",
  appId: "1:307489243875:web:23b774a1d3a343135a3bd6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export const SUPABASE_SQL_SETUP = `-- Firebase is used instead of Supabase --`;

class SupabaseQueryBuilder {
  tableName: string;
  isSelect: boolean = false;
  isInsert: boolean = false;
  isUpdate: boolean = false;
  isDelete: boolean = false;

  selectCols: string = '';
  eqFilters: {field: string, val: any}[] = [];
  orderFilters: {column: string, ascending: boolean}[] = [];
  limitVal: number | null = null;
  updateData: any = null;
  insertData: any = null;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  select(cols: string = '*') {
    this.isSelect = true;
    this.selectCols = cols;
    return this;
  }

  insert(data: any | any[]) {
    this.isInsert = true;
    this.insertData = data;
    return this;
  }

  update(data: any) {
    this.isUpdate = true;
    this.updateData = data;
    return this;
  }

  delete() {
    this.isDelete = true;
    return this;
  }

  eq(column: string, value: any) {
    this.eqFilters.push({ field: column, val: value });
    return this;
  }

  lt(column: string, value: any) {
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderFilters.push({ column, ascending: options?.ascending !== false });
    return this;
  }

  limit(count: number) {
    this.limitVal = count;
    return this;
  }

  single() {
    return this.maybeSingle();
  }

  async maybeSingle() {
    const res = await this.execute();
    if (res.error) return res;
    return { data: res.data && res.data.length > 0 ? res.data[0] : null, error: null };
  }

  then(onfulfilled: (value: any) => any, onrejected?: (reason: any) => any) {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute() {
    try {
      const colRef = collection(db, this.tableName);

      if (this.isSelect) {
        let q = query(colRef);

        for (const filter of this.eqFilters) {
          if (filter.field === 'id') {
             const docRef = doc(db, this.tableName, filter.val);
             const docSnap = await getDoc(docRef);
             if (docSnap.exists()) {
               return { data: [{ id: docSnap.id, ...docSnap.data() }], error: null };
             } else {
               return { data: [], error: null };
             }
          } else {
            q = query(q, where(filter.field, "==", filter.val));
          }
        }

        if (this.orderFilters.length > 0 && this.eqFilters.length === 0) {
            for (const order of this.orderFilters) {
               q = query(q, orderBy(order.column, order.ascending ? 'asc' : 'desc'));
            }
        }

        if (this.limitVal !== null) {
          q = query(q, limit(this.limitVal));
        }

        const snapshot = await getDocs(q);
        let docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        if (this.orderFilters.length > 0 && this.eqFilters.length > 0) {
            const order = this.orderFilters[0];
            docs.sort((a: any, b: any) => {
               if (a[order.column] < b[order.column]) return order.ascending ? -1 : 1;
               if (a[order.column] > b[order.column]) return order.ascending ? 1 : -1;
               return 0;
            });
        }

        return { data: docs, error: null };
      }

      if (this.isInsert) {
        let inserted = [];
        const isArray = Array.isArray(this.insertData);
        const dataArr = isArray ? this.insertData : [this.insertData];

        for (const item of dataArr) {
          const itemToInsert = { ...item, created_at: item.created_at || new Date().toISOString() };
          if (itemToInsert.id) delete itemToInsert.id;
          const docRef = await addDoc(colRef, itemToInsert);
          inserted.push({ id: docRef.id, ...itemToInsert });
        }

        return { data: isArray ? inserted : inserted[0], error: null };
      }

      if (this.isUpdate) {
        let q = query(colRef);
        for (const filter of this.eqFilters) {
            if (filter.field === 'id') {
               const docRef = doc(db, this.tableName, filter.val);
               await updateDoc(docRef, this.updateData);
               return { data: null, error: null };
            }
            q = query(q, where(filter.field, "==", filter.val));
        }

        const snapshot = await getDocs(q);
        for (const docSnap of snapshot.docs) {
           await updateDoc(docSnap.ref, this.updateData);
        }
        return { data: null, error: null };
      }

      if (this.isDelete) {
        let q = query(colRef);
        for (const filter of this.eqFilters) {
            if (filter.field === 'id') {
               const docRef = doc(db, this.tableName, filter.val);
               await deleteDoc(docRef);
               return { data: null, error: null };
            }
            q = query(q, where(filter.field, "==", filter.val));
        }

        const snapshot = await getDocs(q);
        for (const docSnap of snapshot.docs) {
           await deleteDoc(docSnap.ref);
        }
        return { data: null, error: null };
      }

      return { data: null, error: new Error("Unsupported query") };

    } catch (e: any) {
       console.error("Firestore Mock Error:", e);
       if (e.message && e.message.includes('Missing or insufficient permissions')) {
          return { data: null, error: { message: e.message, code: 'PGRST116' } };
       }
       return { data: null, error: e };
    }
  }
}

export const supabase = {
  from: (tableName: string) => {
    return new SupabaseQueryBuilder(tableName);
  },
  channel: (name: string) => {
    return {
      on: (event: string, config: any, callback: (payload: any) => void) => {
        return {
          subscribe: () => {
             const tableName = config.table;
             const q = query(collection(db, tableName));
             const unsubscribe = onSnapshot(q, (snapshot) => {
                 snapshot.docChanges().forEach((change) => {
                     callback({ type: change.type, new: {id: change.doc.id, ...change.doc.data()} });
                 });
             });
             return { unsubscribe };
          }
        };
      }
    };
  }
};


export const loginBusiness = async (businessName: string, password: string): Promise<AiSettings | null> => {
  try {
    const q = query(collection(db, 'ai_settings'), where('business_name', '==', businessName));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        const err = new Error("DB_TABLE_MISSING");
        (err as any).code = 'DB_TABLE_MISSING';
        throw err;
    }

    const docSnap = snapshot.docs[0];
    const data = { id: docSnap.id, ...docSnap.data() } as AiSettings;

    if (data.system_password !== password) return null;

    if (data.subscription_end_date) {
      const endDate = new Date(data.subscription_end_date);
      const now = new Date();
      if (endDate < now && !data.is_frozen) {
        await updateDoc(docSnap.ref, { is_frozen: true });
        data.is_frozen = true;
      }
    }

    return data;
  } catch (err: any) {
    if (err.code === 'DB_TABLE_MISSING') throw err;
    return null;
  }
};

export const registerBusiness = async (
  businessName: string,
  password: string,
  businessType: BusinessType,
  useWhatsapp: boolean = true,
  useTelegram: boolean = false,
  subscriptionDays: number = 30
): Promise<AiSettings> => {
  try {
    const defaultInstruction = businessType === 'RESTAURANT'
      ? 'Sen bir restoran müşteri destek asistanısın. Menü, sipariş ve rezervasyon konularında yardımcı ol. Samimi ve çözüm odaklı ol.'
      : 'Sen bir e-ticaret müşteri destek asistanısın. Ürün, sipariş takibi ve iade konularında yardımcı ol. Profesyonel ve hızlı yanıt ver.';

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + subscriptionDays);

    const docRef = await addDoc(collection(db, 'ai_settings'), {
        business_name: businessName,
        business_type: businessType,
        system_password: password,
        tone: 'SAMIMI',
        ai_instruction: defaultInstruction,
        human_simulation: true,
        delay_seconds: 3,
        use_whatsapp: useWhatsapp,
        use_telegram: useTelegram,
        is_frozen: false,
        subscription_days: subscriptionDays,
        subscription_end_date: endDate.toISOString(),
        created_at: new Date().toISOString()
    });

    const docSnap = await getDoc(docRef);
    return { id: docRef.id, ...docSnap.data() } as AiSettings;
  } catch (err: any) {
    logError('Register', 'İşletme kaydı başarısız', err);
    throw err;
  }
};

export const updateBusiness = async (businessId: string, updates: Partial<AiSettings>) => {
  try {
    if (updates.subscription_days) {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + updates.subscription_days);
      updates.subscription_end_date = endDate.toISOString();
    }

    await updateDoc(doc(db, 'ai_settings', businessId), updates as any);
  } catch (err) {
    logError('Admin', 'İşletme güncellenemedi', err);
    throw err;
  }
};

export const toggleFreezeBusiness = async (businessId: string, freeze: boolean) => {
  try {
    await updateDoc(doc(db, 'ai_settings', businessId), { is_frozen: freeze });
  } catch (err) {
    logError('Admin', 'Hesap dondurma/çözme başarısız', err);
    throw err;
  }
};

export const checkAndFreezeExpired = async (): Promise<number> => {
  try {
    const now = new Date().toISOString();
    const snapshot = await getDocs(collection(db, 'ai_settings'));
    let count = 0;

    for (const d of snapshot.docs) {
        const data = d.data();
        if (data.subscription_end_date < now && data.is_frozen === false) {
             await updateDoc(d.ref, { is_frozen: true });
             count++;
        }
    }
    return count;
  } catch (err) {
    logError('Admin', 'Süresi dolan hesaplar kontrol edilemedi', err);
    return 0;
  }
};

export const initializeSettings = async () => {
  try {
    const q = query(collection(db, 'ai_settings'), where('business_name', '==', 'Demo Restoran'));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        await addDoc(collection(db, 'ai_settings'), {
          business_name: 'Demo Restoran',
          business_type: 'RESTAURANT',
          system_password: '122112',
          tone: 'SAMIMI',
          ai_instruction: 'Sen bir restoran müşteri destek asistanısın.',
          created_at: new Date().toISOString()
        });
    }
    return true;
  } catch (err) {
    console.error("Initialization failed:", err);
    throw err;
  }
};

export const logError = async (module: string, message: string, error?: any, severity: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL' = 'ERROR') => {
  let errorDetails = error ? (typeof error === 'object' ? JSON.stringify(error, Object.getOwnPropertyNames(error)) : String(error)) : '';
  try {
    await addDoc(collection(db, 'system_logs'), { severity, module, message, stack_trace: errorDetails, created_at: new Date().toISOString() });
  } catch (e) { }
};

export const fetchAiSettings = async (businessId?: string): Promise<AiSettings | null> => {
  try {
    if (businessId) {
       const docSnap = await getDoc(doc(db, 'ai_settings', businessId));
       if (docSnap.exists()) {
           return { id: docSnap.id, ...docSnap.data() } as AiSettings;
       }
       return null;
    } else {
       const q = query(collection(db, 'ai_settings'), limit(1));
       const snapshot = await getDocs(q);
       if (!snapshot.empty) {
          const d = snapshot.docs[0];
          return { id: d.id, ...d.data() } as AiSettings;
       }

       const err = new Error("DB_TABLE_MISSING");
       (err as any).code = 'DB_TABLE_MISSING';
       throw err;
    }
  } catch (err: any) {
    if (err.code === 'DB_TABLE_MISSING') throw err;
    return null;
  }
};

export const updateAiSettings = async (businessId: string, settings: Partial<AiSettings>) => {
  try {
    await updateDoc(doc(db, 'ai_settings', businessId), settings as any);
  } catch (err) {
    logError('Settings', 'AI ayarları güncellenemedi', err);
    throw err;
  }
};

export const fetchAllBusinesses = async (): Promise<AiSettings[]> => {
  try {
    const q = query(collection(db, 'ai_settings'), orderBy('created_at', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AiSettings));
  } catch (err) {
    logError('Admin', 'İşletmeler getirilemedi', err);
    return [];
  }
};

export const deleteBusiness = async (businessId: string) => {
  try {
    await deleteDoc(doc(db, 'ai_settings', businessId));
  } catch (err) {
    logError('Admin', 'İşletme silinemedi', err);
    throw err;
  }
};

export const fetchTransactions = async (): Promise<Transaction[]> => {
  try {
    const q = query(collection(db, 'transactions'), orderBy('created_at', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
  } catch (err) {
    logError('Transactions', 'İşlemler çekilemedi', err);
    return [];
  }
};

export const updateTransactionStatus = async (id: string, status: string) => {
  try {
    const txRef = doc(db, 'transactions', id);
    const txSnap = await getDoc(txRef);
    if (!txSnap.exists()) throw new Error("Transaction not found");
    const tx = txSnap.data();

    await updateDoc(txRef, { status });

    if (status === 'CREDITED' && tx.iban_id) {
      const ibanRef = doc(db, 'ibans', tx.iban_id);
      const ibanSnap = await getDoc(ibanRef);
      if (ibanSnap.exists()) {
         const iban = ibanSnap.data();
         await updateDoc(ibanRef, {
            current_total: (Number(iban.current_total) || 0) + (Number(tx.amount) || 0),
            usage_count: (Number(iban.usage_count) || 0) + 1
         });
      }
    }
  } catch (err) {
    logError('Transactions', `İşlem durumu güncellenemedi (ID: ${id})`, err);
    throw err;
  }
};

export const fetchIbans = async (): Promise<Iban[]> => {
  try {
    const q = query(collection(db, 'ibans'), orderBy('priority', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => {
       const data = d.data();
       return {
         id: d.id,
         ...data,
         limit: data.limit_amount || 0,
         current_total: data.current_total || 0,
         usage_count: data.usage_count || 0
       } as Iban;
    });
  } catch (err) {
    return [];
  }
};

export const addIban = async (iban: Partial<Iban>) => {
  try {
    const docRef = await addDoc(collection(db, 'ibans'), {
      bank_name: iban.bank_name,
      account_holder: iban.account_holder,
      iban_number: iban.iban_number,
      limit_amount: iban.limit,
      priority: iban.priority,
      description: iban.description,
      is_active: true,
      created_at: new Date().toISOString()
    });
    const docSnap = await getDoc(docRef);
    return { id: docRef.id, ...docSnap.data() };
  } catch (err) {
    throw err;
  }
};

export const updateIban = async (id: string, updates: Partial<Iban>) => {
  try {
    const dbUpdates: any = { ...updates };
    if (updates.limit !== undefined) {
      dbUpdates.limit_amount = updates.limit;
      delete dbUpdates.limit;
    }
    await updateDoc(doc(db, 'ibans', id), dbUpdates);
  } catch (err) {
    throw err;
  }
};

export const deleteIban = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'ibans', id));
  } catch (err) {
    throw err;
  }
};

export const fetchConnections = async (): Promise<WhatsAppConnection[]> => {
  try {
    const q = query(collection(db, 'whatsapp_connections'), orderBy('created_at', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as WhatsAppConnection));
  } catch (err) {
    return [];
  }
};

export const createConnection = async (name: string, representative: string, phone?: string) => {
  try {
    const docRef = await addDoc(collection(db, 'whatsapp_connections'), {
      name,
      representative_name: representative,
      phone_number: phone,
      status: 'INITIALIZING',
      created_at: new Date().toISOString()
    });
    const docSnap = await getDoc(docRef);
    return { id: docRef.id, ...docSnap.data() };
  } catch (err) {
    throw err;
  }
};

export const deleteConnection = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'whatsapp_connections', id));
  } catch (err) {
    throw err;
  }
};

export const fetchMessages = async (connectionId: string) => {
  try {
    const q = query(collection(db, 'whatsapp_messages'), where('connection_id', '==', connectionId));
    const snapshot = await getDocs(q);
    const messages = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    messages.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return messages;
  } catch (err) {
    return [];
  }
};

export const sendMessageToDb = async (message: Partial<WhatsAppMessage>) => {
  try {
    await addDoc(collection(db, 'whatsapp_messages'), { ...message, created_at: new Date().toISOString() });
  } catch (err) {
    throw err;
  }
};

export const subscribeToTable = (table: string, onEvent: (payload: any) => void) => {
  const q = query(collection(db, table));
  const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
          onEvent({ type: change.type, new: {id: change.doc.id, ...change.doc.data()} });
      });
  });
  return { unsubscribe };
};