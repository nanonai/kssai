// Firebase is loaded via CDN globally in index.html

let firestore;

class DBWrapper {
    constructor() {
        this.cache = {};
        this.listeners = {};
        this.initialLoadPromises = {};
    }

    _ensureListener(storeName) {
        if (!this.listeners[storeName]) {
            this.cache[storeName] = {};
            this.initialLoadPromises[storeName] = new Promise((resolve) => {
                let isFirstLoad = true;
                this.listeners[storeName] = firestore.collection(storeName).onSnapshot(snapshot => {
                    snapshot.docChanges().forEach(change => {
                        if (change.type === 'removed') {
                            delete this.cache[storeName][change.doc.id];
                        } else {
                            this.cache[storeName][change.doc.id] = change.doc.data();
                        }
                    });
                    if (isFirstLoad) {
                        isFirstLoad = false;
                        resolve();
                    }
                }, err => {
                    console.error("Firestore listener error for " + storeName, err);
                    if (isFirstLoad) resolve(); // Resolve to not block app
                });
            });
        }
        return this.initialLoadPromises[storeName];
    }

    async getAll(storeName) {
        await this._ensureListener(storeName);
        return Object.values(this.cache[storeName]);
    }

    async get(storeName, id) {
        await this._ensureListener(storeName);
        return this.cache[storeName][String(id)];
    }

    async getAllFromIndex(storeName, indexName, key = null) {
        await this._ensureListener(storeName);
        const all = Object.values(this.cache[storeName]);
        if (key) {
            return all.filter(item => item[indexName] === key);
        }
        return all;
    }
    
    async count(storeName) {
        await this._ensureListener(storeName);
        return Object.keys(this.cache[storeName]).length;
    }

    async put(storeName, data) {
        let id = data.id || data.key;
        if (!id) {
            id = firestore.collection(storeName).doc().id;
            if (storeName === 'settings') data.key = id;
            else data.id = id;
        }
        await firestore.collection(storeName).doc(String(id)).set(data);
    }

    async delete(storeName, id) {
        await firestore.collection(storeName).doc(String(id)).delete();
    }

    transaction(storeNames, mode) {
        const batch = firestore.batch();
        let committed = false;
        const tx = {
            objectStore: (storeName) => {
                return {
                    put: (data) => {
                        let id = data.id || data.key;
                        const docRef = firestore.collection(storeName).doc(String(id));
                        batch.set(docRef, data);
                    },
                    delete: (id) => {
                        const docRef = firestore.collection(storeName).doc(String(id));
                        batch.delete(docRef);
                    },
                    get: async (id) => {
                        return this.get(storeName, id);
                    },
                    getAll: async () => {
                        return this.getAll(storeName);
                    },
                    count: async () => {
                        return this.count(storeName);
                    }
                };
            }
        };
        Object.defineProperty(tx, 'done', {
            get: function() {
                if (!committed) {
                    committed = true;
                    return batch.commit();
                }
                return Promise.resolve();
            }
        });
        return tx;
    }
}

async function initDB() {
    const firebaseConfig = {
      apiKey: "AIzaSyCukSVaQOXQbQsFjrd87RdceZOwMKwDb7Q",
      authDomain: "kssai-app.firebaseapp.com",
      projectId: "kssai-app",
      storageBucket: "kssai-app.firebasestorage.app",
      messagingSenderId: "138198632868",
      appId: "1:138198632868:web:c3ef3a960341721eaf9931"
    };

    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    firestore = firebase.firestore();

    try {
        await firestore.enablePersistence();
    } catch (err) {
        console.warn("Firebase offline persistence failed:", err);
    }

    return new DBWrapper();
}

// Initial Data Population
async function populateInitialData(db) {
    const tx = db.transaction(['products', 'toppings', 'settings'], 'readwrite');
    
    // Check if products exist
    const count = await tx.objectStore('products').count();
    if (count > 0) return;

    const initialProducts = [
        { id: 'p1', name: 'チーズバーガー', price: 1350, cost: null, category: 'バーガー', toppingsType: 'burger', active: true, order: 1 },
        { id: 'p2', name: 'テリヤキバーガー', price: 1300, cost: null, category: 'バーガー', toppingsType: 'burger', active: true, order: 2 },
        { id: 'p3', name: 'BBQバーガー', price: 1400, cost: null, category: 'バーガー', toppingsType: 'burger', active: true, order: 3 },
        { id: 'p4', name: 'カルニタス', price: 600, unit: '1P', cost: null, category: 'タコス', toppingsType: 'tacos', active: true, order: 4 },
        { id: 'p5', name: 'ファヒータ', price: 600, unit: '1P', cost: null, category: 'タコス', toppingsType: 'tacos', active: true, order: 5 },
        { id: 'p6', name: 'セビーチェ', price: 600, unit: '1P', cost: null, category: 'タコス', toppingsType: 'tacos', active: true, order: 6 },
        { id: 'p7', name: 'ケサビリア', price: 650, unit: '1P', cost: null, category: 'タコス', toppingsType: 'tacos', active: true, order: 7 },
        { id: 'p8', name: 'タコサラダ', price: 900, cost: null, category: 'サラダ・サイド', toppingsType: 'none', active: true, order: 8 },
        { id: 'p9', name: 'ワカモレクリームチーズ ～セビーチェのせ～', price: 700, cost: null, category: 'サラダ・サイド', toppingsType: 'none', active: true, order: 9 },
        { id: 'p10', name: 'チップス', price: 500, cost: null, category: 'サラダ・サイド', toppingsType: 'chips', active: true, order: 10 },
        { id: 'p11', name: 'アイスコーヒー', price: 350, cost: null, category: 'ドリンク', toppingsType: 'none', active: true, order: 11 },
        { id: 'p12', name: 'コーラ', price: 350, cost: null, category: 'ドリンク', toppingsType: 'none', active: true, order: 12 },
        { id: 'p13', name: 'オレンジジュース', price: 350, cost: null, category: 'ドリンク', toppingsType: 'none', active: true, order: 13 },
        { id: 'p14', name: 'アップルジュース', price: 350, cost: null, category: 'ドリンク', toppingsType: 'none', active: true, order: 14 },
        { id: 'p15', name: 'バドワイザー', price: 600, cost: null, category: 'アルコール', toppingsType: 'none', active: true, order: 15 },
        { id: 'p16', name: 'ハイボール', price: 500, cost: null, category: 'アルコール', toppingsType: 'none', active: true, order: 16 }
    ];

    const initialToppings = [
        // Burger toppings
        { id: 'tb1', name: 'ハラペーニョ', price: 100, type: 'burger' },
        { id: 'tb2', name: 'チーズ', price: 200, type: 'burger' },
        { id: 'tb3', name: 'パティ（肉）', price: 400, type: 'burger' },
        { id: 'tb4', name: 'アボカド', price: 200, type: 'burger' },
        { id: 'tb5', name: '目玉焼き', price: 150, type: 'burger' },
        { id: 'tb6', name: 'プルドポーク', price: 300, type: 'burger' },
        { id: 'tb7', name: 'トマト', price: 100, type: 'burger' },
        // Tacos toppings
        { id: 'tt1', name: 'クリームチーズ', price: 100, type: 'tacos' },
        { id: 'tt2', name: 'パクチー', price: 100, type: 'tacos' },
        { id: 'tt3', name: 'ハラペーニョ', price: 100, type: 'tacos' },
        { id: 'tt4', name: '肉', price: 100, type: 'tacos' },
        { id: 'tt5', name: 'ワカモレ', price: 100, type: 'tacos' },
        // Special Sets/Options
        { id: 'ts1', name: 'サラダセット', price: 50, type: 'tacos_set' }
    ];

    for (const p of initialProducts) {
        tx.objectStore('products').put(p);
    }
    for (const t of initialToppings) {
        tx.objectStore('toppings').put(t);
    }
    
    // Default Settings
    tx.objectStore('settings').put({ key: 'locations', value: ['メインキッチン', 'イベントA'] });
    tx.objectStore('settings').put({ key: 'tax_rate', value: '' }); // 納税用の積立率（例：20）未設定は空文字

    await tx.done;
}

// --- Helper Functions (JST Timezone & Tax) ---

/**
 * Returns a new Date object representing the JST time of the given UTC ISO string.
 * This ensures that regardless of the browser's local timezone, 
 * the date is evaluated as Asia/Tokyo.
 */
function getJSTDate(dateString) {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return new Date(); // fallback
    const jstString = d.toLocaleString('en-US', { timeZone: 'Asia/Tokyo', hour12: false });
    const [datePart, timePart] = jstString.split(', ');
    const [m, day, y] = datePart.split('/');
    const [h, min, s] = (timePart || '00:00:00').split(':');
    return new Date(y, m - 1, day, h, min, s);
}

/**
 * Format Date as YYYY-MM-DD
 */
function formatYMD(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Common tax and profit calculator
 */
async function calculateTaxReserve(dbInstance, targetYear = null, useAnnualProjection = false) {
    const sales = await dbInstance.getAll('sales');
    const expenses = await dbInstance.getAll('expenses');
    const settings = await dbInstance.getAll('settings');
    
    // Get Settings
    const getSet = (k, def) => {
        const s = settings.find(x => x.key === k);
        return s ? s.value : def;
    };

    const taxMode = getSet('tax_calc_mode', 'manual'); // 'manual' or 'auto'
    
    // --- Manual Calculation Setup ---
    const taxRateObj = settings.find(s => s.key === 'tax_rate');
    const taxRateVersionObj = settings.find(s => s.key === 'tax_rate_version');
    const isConfiguredVal = getSet('tax_rate_configured', false);
    let isConfigured = isConfiguredVal;
    
    let manualTaxRate = 0;
    let manualTaxRateStr = '未設定';
    
    if (taxRateObj && taxRateObj.value !== '' && taxRateObj.value !== null) {
        let val = parseFloat(taxRateObj.value);
        if (!isNaN(val)) {
            if (val === 0 && !isConfigured) {
                manualTaxRateStr = '未設定';
            } else {
                const ver = taxRateVersionObj ? parseInt(taxRateVersionObj.value) : 1;
                if (ver === 1 && val > 0 && val <= 1) {
                    // Old fractional format is ambiguous (did they mean 0.2% or 20%?). Force reconfiguration.
                    manualTaxRate = 0;
                    manualTaxRateStr = '再設定が必要';
                    isConfigured = false;
                } else if (ver === 1 && val > 1) {
                    // Old format but inputted as percentage (e.g. 20)
                    manualTaxRate = val / 100;
                    manualTaxRateStr = val + '%';
                } else {
                    // Version 2 strictly uses percentage (0-100)
                    manualTaxRate = val / 100;
                    manualTaxRateStr = val + '%';
                }
            }
        }
    }
    
    // --- Auto Tax Config Setup ---
    const autoConfig = {
        businessType: getSet('tax_business_type', '個人事業主'),
        declarationType: getSet('tax_declaration', '青色申告'),
        blueDeduction: getSet('tax_blue_deduction', 650000),
        otherDeductions: getSet('tax_other_deductions', 480000),
        hasOtherIncome: getSet('tax_has_other_income', false),
        consumptionTaxType: getSet('tax_consumption', '免税'),
        estimatedExpenses: 0
    };
    
    let validSales = sales.filter(s => !s.refunded);
    let allExpensesForProfit = expenses; 
    
    if (targetYear) {
        validSales = validSales.filter(s => formatYMD(getJSTDate(s.date)).startsWith(targetYear));
        allExpensesForProfit = allExpensesForProfit.filter(e => {
            return e.date.startsWith(targetYear);
        });
    }
    
    const totalSales = validSales.reduce((sum, s) => sum + s.total, 0);
    const totalExpenses = allExpensesForProfit.reduce((sum, e) => sum + e.amount, 0);
    const actualProfit = totalSales - totalExpenses;
    
    autoConfig.estimatedExpenses = totalExpenses;
    
    // Annual Projection Logic
    let projectedProfit = actualProfit;
    let projectedSales = totalSales;
    if (useAnnualProjection && targetYear) {
        const today = getJSTDate(new Date().toISOString());
        let daysPassed = 365;
        if (targetYear === String(today.getFullYear())) {
            const startOfYear = new Date(today.getFullYear(), 0, 1);
            daysPassed = Math.max(1, Math.floor((today - startOfYear) / (1000 * 60 * 60 * 24)) + 1);
        }
        
        if (daysPassed < 365) {
            projectedProfit = Math.floor(actualProfit * (365 / daysPassed));
            projectedSales = Math.floor(totalSales * (365 / daysPassed));
            autoConfig.estimatedExpenses = Math.floor(totalExpenses * (365 / daysPassed));
        }
    }
    
    // Manual calculation
    let manualReserve = 0;
    if (isConfigured) {
        manualReserve = Math.floor(Math.max(0, projectedProfit) * manualTaxRate);
    }
    
    // Auto Tax Simulation
    let autoSim = null;
    const isAutoConfigured = getSet('tax_auto_configured', false);
    
    if (taxMode === 'auto' && isAutoConfigured && typeof simulateTaxes !== 'undefined') {
        autoSim = simulateTaxes(projectedProfit, autoConfig, targetYear || String(new Date().getFullYear()));
    }
    
    const isConfiguredNow = (taxMode === 'auto') ? isAutoConfigured : isConfigured;
    const reserveToUse = (taxMode === 'auto' && autoSim) ? autoSim.totalTax : manualReserve;
    
    // Tax Paid deduction
    const transactions = await dbInstance.getAll('transactions');
    let taxPaid = 0;
    
    if (targetYear) {
        taxPaid = transactions.filter(t => {
            if (t.type !== '税金') return false;
            // 優先的に tax_year を確認。無ければ過去データ用として date を見る
            if (t.tax_year) {
                return t.tax_year === targetYear;
            } else {
                if (t.date.includes('T')) return formatYMD(getJSTDate(t.date)).startsWith(targetYear);
                return t.date.startsWith(targetYear);
            }
        }).reduce((sum, t) => sum + t.amount, 0);
    } else {
        taxPaid = transactions.filter(t => t.type === '税金').reduce((sum, t) => sum + t.amount, 0);
    }
    
    let remainingReserve = Math.max(0, reserveToUse - taxPaid);
    
    return {
        profit: actualProfit,
        totalSales,
        totalExpenses,
        projectedProfit,
        projectedSales,
        taxMode, // 'manual' or 'auto'
        isConfigured: isConfiguredNow,
        taxRateStr: manualTaxRateStr,
        totalReserveNeeded: reserveToUse,
        taxPaid,
        remainingReserve,
        autoSim,
        autoConfig,
        daysPassedCalc: useAnnualProjection
    };
}

// --- Financial Summaries ---

/**
 * 資金残高の集計 (現預金、未入金売掛金、未払経費)
 */
async function getBalanceSummary(dbInstance) {
    const transactions = await dbInstance.getAll('transactions');
    const expenses = await dbInstance.getAll('expenses');
    
    let cash = 0;
    let bank = 0;
    let accountsReceivable = 0;
    
    transactions.forEach(t => {
        const amount = parseFloat(t.amount) || 0;
        
        if (t.account === '現金') {
            if (t.type === '売上' || t.type === '振替入金' || t.type === '自己資金' || t.type === '返金受取') cash += amount;
            if (t.type === '経費' || t.type === '振替出金' || t.type === '税金' || t.type === '生活費') cash -= amount;
        } else if (t.account && t.account.startsWith('銀行')) {
            if (t.type === '売上' || t.type === '振替入金' || t.type === '自己資金' || t.type === '返金受取') bank += amount;
            if (t.type === '経費' || t.type === '振替出金' || t.type === '税金' || t.type === '生活費') bank -= amount;
        } else if (t.account === '未入金') {
            if (t.type === '売上') accountsReceivable += amount; 
            if (t.type === '振替出金' || t.type === '経費') accountsReceivable -= amount; 
        }
    });
    
    const unpaidExpenses = expenses.filter(e => !e.is_paid).reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    
    return {
        cash,
        bank,
        currentFunds: cash + bank,
        accountsReceivable,
        unpaidExpenses
    };
}

/**
 * 全年度の未納税金残高を計算
 */
async function getTotalUnpaidTaxReserve(dbInstance) {
    const sales = await dbInstance.getAll('sales');
    const transactions = await dbInstance.getAll('transactions');
    
    const years = new Set();
    const currentYear = formatYMD(getJSTDate(new Date().toISOString())).substring(0, 4);
    years.add(currentYear); // Always include current year
    
    sales.forEach(s => {
        if (!s.refunded) years.add(formatYMD(getJSTDate(s.date)).substring(0, 4));
    });
    
    let totalNeeded = 0;
    for (const year of years) {
        const res = await calculateTaxReserve(dbInstance, year, false);
        totalNeeded += res.totalReserveNeeded;
    }
    
    const totalPaid = transactions.filter(t => t.type === '税金').reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    return Math.max(0, totalNeeded - totalPaid);
}

// --- Data Migration & Import ---

async function migrateNonCashSales(dbInstance) {
    const sales = await dbInstance.getAll('sales');
    const transactions = await dbInstance.getAll('transactions');
    
    const tx = dbInstance.transaction('transactions', 'readwrite');
    const store = tx.objectStore('transactions');
    let migratedCount = 0;

    for (const sale of sales) {
        if (sale.method !== '現金' && !sale.refunded) {
            // Check if transaction exists for this sale
            const hasTx = transactions.some(t => t.ref_id === sale.id);
            if (!hasTx) {
                store.put({
                    id: 'tx_ar_' + sale.id, // Ensure uniqueness
                    date: sale.date, // Preserve original date
                    type: '売上',
                    amount: sale.total,
                    account: '未入金', // Accounts Receivable
                    ref_id: sale.id,
                    memo: 'データ移行: ' + sale.method,
                    clearance_status: 'unpaid',
                    cleared_amount: 0
                });
                migratedCount++;
            }
        }
    }
    await tx.done;
    if (migratedCount > 0) {
        console.log(`Migrated ${migratedCount} non-cash sales to Accounts Receivable (未入金)`);
    }
}

/**
 * 過去の未入金(どんぶり勘定)を、個別のトランザクション消込状態に変換する
 */
async function upgradeARTransactions(dbInstance) {
    const transactions = await dbInstance.getAll('transactions');
    let totalARGenerated = 0;
    let totalARCleared = 0;
    
    const arTransactions = [];
    
    // 集計と分類
    transactions.forEach(t => {
        if (t.account === '未入金') {
            const amount = parseFloat(t.amount) || 0;
            if (t.type === '売上') {
                totalARGenerated += amount;
                if (!t.clearance_status) {
                    arTransactions.push(t);
                }
            } else if (t.type === '振替出金' || t.type === '経費') {
                totalARCleared += amount; // 過去のどんぶり消込や返金
            }
        }
    });
    
    if (arTransactions.length === 0) return; // すでにマイグレーション済み、または対象なし
    
    // 古い順にソートして、消込済み金額を充当していく
    arTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    const tx = dbInstance.transaction('transactions', 'readwrite');
    const store = tx.objectStore('transactions');
    
    let remainingClearedToAllocate = totalARCleared;
    
    for (const t of arTransactions) {
        const amount = parseFloat(t.amount) || 0;
        if (remainingClearedToAllocate >= amount) {
            t.clearance_status = 'paid';
            t.cleared_amount = amount;
            remainingClearedToAllocate -= amount;
        } else if (remainingClearedToAllocate > 0) {
            t.clearance_status = 'partially_paid';
            t.cleared_amount = remainingClearedToAllocate;
            remainingClearedToAllocate = 0;
        } else {
            t.clearance_status = 'unpaid';
            t.cleared_amount = 0;
        }
        store.put(t);
    }
    
    await tx.done;
    console.log("Upgraded AR Transactions with clearance statuses.");
}

async function importJSON(dbInstance, jsonString) {
    try {
        const data = JSON.parse(jsonString);
        const stores = ['products', 'toppings', 'sales', 'sale_items', 'expenses', 'transactions', 'settings'];
        const tx = dbInstance.transaction(stores, 'readwrite');
        
        for (const storeName of stores) {
            if (data[storeName]) {
                const store = tx.objectStore(storeName);
                for (const item of data[storeName]) {
                    store.put(item); // Overwrites duplicates by ID
                }
            }
        }
        await tx.done;
        return true;
    } catch (e) {
        console.error("Import failed:", e);
        return false;
    }
}

