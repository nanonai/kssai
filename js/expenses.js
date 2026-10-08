let expensesCategories = [
    '食材仕入れ', '包装資材・容器仕入れ', 'キッチン利用料・出店料', 
    '交通費', '駐車場代', '人件費', '広告宣伝費', '決済手数料', '通信費', '消耗品費', 'その他'
];

let currentExpensePeriod = 'month'; // 'day', 'week', 'month', 'year'
let currentExpenseDate = new Date();

function getExpensePeriodBounds(date, period) {
    if (period === 'all') {
        return { start: new Date(2000, 0, 1), end: new Date(2100, 11, 31) };
    }
    const d = new Date(date);
    d.setHours(0,0,0,0);
    let start, end;
    
    if (period === 'day') {
        start = new Date(d);
        end = new Date(d);
        end.setHours(23,59,59,999);
    } else if (period === 'week') {
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
        start = new Date(d.setDate(diff));
        start.setHours(0,0,0,0);
        end = new Date(start);
        end.setDate(end.getDate() + 6);
        end.setHours(23,59,59,999);
    } else if (period === 'month') {
        start = new Date(d.getFullYear(), d.getMonth(), 1);
        end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        end.setHours(23,59,59,999);
    } else if (period === 'year') {
        start = new Date(d.getFullYear(), 0, 1);
        end = new Date(d.getFullYear(), 11, 31);
        end.setHours(23,59,59,999);
    }
    
    return { start, end };
}

function getExpensePeriodLabel(date, period) {
    if (period === 'all') {
        return `全期間`;
    } else if (period === 'day') {
        return `${date.getFullYear()}年${date.getMonth()+1}月${date.getDate()}日`;
    } else if (period === 'week') {
        const bounds = getExpensePeriodBounds(date, period);
        return `${bounds.start.getMonth()+1}/${bounds.start.getDate()} - ${bounds.end.getMonth()+1}/${bounds.end.getDate()}`;
    } else if (period === 'month') {
        return `${date.getFullYear()}年${date.getMonth()+1}月`;
    } else if (period === 'year') {
        return `${date.getFullYear()}年`;
    }
}

window.changeExpensePeriod = function(period) {
    currentExpensePeriod = period;
    loadExpenses();
};

window.navigateExpensePeriod = function(direction) {
    if (currentExpensePeriod === 'all') return;
    if (currentExpensePeriod === 'day') {
        currentExpenseDate.setDate(currentExpenseDate.getDate() + direction);
    } else if (currentExpensePeriod === 'week') {
        currentExpenseDate.setDate(currentExpenseDate.getDate() + (direction * 7));
    } else if (currentExpensePeriod === 'month') {
        currentExpenseDate.setMonth(currentExpenseDate.getMonth() + direction);
    } else if (currentExpensePeriod === 'year') {
        currentExpenseDate.setFullYear(currentExpenseDate.getFullYear() + direction);
    }
    loadExpenses();
};

function formatDateToYMD(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

async function loadExpenses() {
    const expenses = await db.getAll('expenses');
    expenses.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const bounds = getExpensePeriodBounds(currentExpenseDate, currentExpensePeriod);
    const startStr = formatDateToYMD(bounds.start);
    const endStr = formatDateToYMD(bounds.end);
    
    // Some expenses only have YYYY-MM-DD
    const filteredExpenses = expenses.filter(e => {
        const eDate = e.date.split('T')[0];
        return eDate >= startStr && eDate <= endStr;
    });
    
    const totalAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    const label = getExpensePeriodLabel(currentExpenseDate, currentExpensePeriod);
    
    const expensesSection = document.getElementById('expenses');
    expensesSection.innerHTML = `
        <h2 style="margin-bottom: 1rem;">経費入力</h2>
        <div class="card" style="margin-bottom: 2rem;">
            <form id="expense-form" onsubmit="saveExpense(event)">
                <div style="margin-bottom: 1.5rem;">
                    <label style="display:block; margin-bottom: 0.5rem; font-weight: bold;">金額 (円)</label>
                    <input type="number" id="exp-amount" min="1" required style="width:100%; padding: 1rem; font-size: 1.5rem; border: 1px solid var(--border-color); border-radius: 8px;" placeholder="0">
                </div>
                
                <div style="margin-bottom: 1.5rem;">
                    <label style="display:block; margin-bottom: 0.5rem; font-weight: bold;">カテゴリー</label>
                    <select id="exp-category" required style="width:100%; padding: 1rem; font-size: 1.1rem; border: 1px solid var(--border-color); border-radius: 8px;">
                        ${expensesCategories.map(c => `<option value="${c}">${c}</option>`).join('')}
                    </select>
                </div>
                
                <details style="margin-bottom: 1.5rem; border: 1px solid var(--border-color); border-radius: 8px; padding: 0.5rem 1rem;">
                    <summary style="font-weight: bold; padding: 0.5rem 0; cursor: pointer;">詳細設定 (日付・支払元・メモ)</summary>
                    <div style="margin-top: 1rem; border-top: 1px solid #eee; padding-top: 1rem;">
                        <div style="margin-bottom: 1rem;">
                            <label style="display:block; margin-bottom: 0.5rem;">発生日</label>
                            <input type="date" id="exp-date" required style="width:100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 4px; font-size: 1rem;">
                        </div>
                        
                        <div style="margin-bottom: 1rem;">
                            <label style="display:flex; align-items:center; font-weight:bold; font-size:1.1rem;">
                                <input type="checkbox" id="exp-paid" checked onchange="document.getElementById('exp-account-div').style.display = this.checked ? 'block' : 'none'" style="width: 24px; height: 24px; margin-right: 0.5rem;">
                                支払済み
                            </label>
                        </div>
                        
                        <div id="exp-account-div" style="margin-bottom: 1rem;">
                            <label style="display:block; margin-bottom: 0.5rem;">支払元口座</label>
                            <select id="exp-account" style="width:100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 4px; font-size: 1rem;">
                                <option value="現金">現金</option>
                                <option value="銀行A">銀行A</option>
                                <option value="個人の立替">個人の立替</option>
                            </select>
                        </div>
                        
                        <div style="margin-bottom: 1rem;">
                            <label style="display:block; margin-bottom: 0.5rem;">内容・メモ</label>
                            <input type="text" id="exp-memo" placeholder="購入した店舗名など" style="width:100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 4px; font-size: 1rem;">
                        </div>
                    </div>
                </details>
                
                <button type="submit" class="btn-primary">経費を保存</button>
            </form>
        </div>
        
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1rem;">
            <h2 style="margin: 0;">経費履歴</h2>
        </div>
        
        <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem; overflow-x: auto; white-space: nowrap; padding-bottom: 0.5rem;">
            <button onclick="changeExpensePeriod('day')" style="flex:1; padding:0.5rem; border:1px solid var(--border-color); border-radius:8px; background:${currentExpensePeriod==='day'?'var(--accent-red)':'#fff'}; color:${currentExpensePeriod==='day'?'#fff':'#333'}">1日</button>
            <button onclick="changeExpensePeriod('week')" style="flex:1; padding:0.5rem; border:1px solid var(--border-color); border-radius:8px; background:${currentExpensePeriod==='week'?'var(--accent-red)':'#fff'}; color:${currentExpensePeriod==='week'?'#fff':'#333'}">1週</button>
            <button onclick="changeExpensePeriod('month')" style="flex:1; padding:0.5rem; border:1px solid var(--border-color); border-radius:8px; background:${currentExpensePeriod==='month'?'var(--accent-red)':'#fff'}; color:${currentExpensePeriod==='month'?'#fff':'#333'}">1ヶ月</button>
            <button onclick="changeExpensePeriod('year')" style="flex:1; padding:0.5rem; border:1px solid var(--border-color); border-radius:8px; background:${currentExpensePeriod==='year'?'var(--accent-red)':'#fff'}; color:${currentExpensePeriod==='year'?'#fff':'#333'}">1年</button>
            <button onclick="changeExpensePeriod('all')" style="flex:1; padding:0.5rem; border:1px solid var(--border-color); border-radius:8px; background:${currentExpensePeriod==='all'?'var(--accent-red)':'#fff'}; color:${currentExpensePeriod==='all'?'#fff':'#333'}">全期間</button>
        </div>
        
        <div style="display: ${currentExpensePeriod === 'all' ? 'none' : 'flex'}; justify-content: space-between; align-items: center; margin-bottom: 1rem; background: #f9f9f9; padding: 0.5rem; border-radius: 8px;">
            <button onclick="navigateExpensePeriod(-1)" style="padding: 0.5rem 1rem; border: none; background: transparent; font-size: 1.2rem; cursor: pointer;">◀</button>
            <div style="font-weight: bold; font-size: 1.1rem;">${label}</div>
            <button onclick="navigateExpensePeriod(1)" style="padding: 0.5rem 1rem; border: none; background: transparent; font-size: 1.2rem; cursor: pointer;">▶</button>
        </div>
        
        <div class="card" style="margin-bottom: 1rem;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="color:#666; font-weight:bold;">${label} の経費合計</span>
                <span style="font-weight:bold; font-size:1.3rem; color:var(--accent-red);">¥${totalAmount.toLocaleString()}</span>
            </div>
        </div>

        <div>
            ${filteredExpenses.map(e => `
                <div class="card" style="margin-bottom: 0.5rem; padding: 1rem;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span style="color: #666; font-size: 0.9rem;">${e.date}</span>
                        ${e.is_paid ? '<span style="color:var(--text-color); font-size: 0.9rem;">支払済</span>' : `<button onclick="markExpensePaid('${e.id}', ${e.amount})" style="padding: 0.25rem 0.5rem; background: var(--accent-red); color: white; border: none; border-radius: 4px; font-size: 0.8rem; cursor: pointer;">未払い (支払う)</button>`}
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: bold; font-size: 1.1rem;">${e.category}</span>
                        <span style="font-weight: bold; font-size: 1.2rem; color: var(--accent-red);">¥${e.amount.toLocaleString()}</span>
                    </div>
                    ${e.memo ? `<div style="font-size: 0.9rem; margin-top: 0.5rem; color: #555;">${e.memo}</div>` : ''}
                </div>
            `).join('')}
            ${filteredExpenses.length === 0 ? '<p style="color:#888;">この期間の経費データがありません</p>' : ''}
        </div>
    `;
    
    // Set today as default for new expense
    const todayStr = formatDateToYMD(new Date());
    const expDateInput = document.getElementById('exp-date');
    if (expDateInput && !expDateInput.value) {
        expDateInput.value = todayStr;
    }
}

let expIsSubmitting = false;

async function saveExpense(e) {
    e.preventDefault();
    if (expIsSubmitting) return;
    expIsSubmitting = true;
    
    const btnSubmit = e.target.querySelector('button[type="submit"]');
    if (btnSubmit) {
        btnSubmit.innerText = "保存中...";
        btnSubmit.disabled = true;
    }
    
    const is_paid = document.getElementById('exp-paid').checked;
    
    const locName = document.getElementById('current-location-display') 
                    ? document.getElementById('current-location-display').innerText 
                    : 'メインキッチン';
                    
    const expense = {
        id: 'e_' + Date.now(),
        date: document.getElementById('exp-date').value,
        category: document.getElementById('exp-category').value,
        amount: parseInt(document.getElementById('exp-amount').value),
        is_paid: is_paid,
        account: is_paid ? document.getElementById('exp-account').value : null,
        memo: document.getElementById('exp-memo').value,
        location: locName
    };
    
    try {
        const tx = db.transaction(['expenses', 'transactions'], 'readwrite');
        tx.objectStore('expenses').put(expense);
        
        if (is_paid) {
            tx.objectStore('transactions').put({
                id: 'tx_exp_' + Date.now(),
                date: new Date().toISOString(),
                type: '経費',
                amount: expense.amount,
                account: expense.account,
                ref_id: expense.id,
                memo: expense.memo
            });
        }
        
        await tx.done;
        // alert('経費を登録しました。'); // Removed alert to make it faster to save
        loadExpenses();
    } catch (err) {
        console.error(err);
        alert('エラーが発生しました。入力内容は保持されています。');
    } finally {
        expIsSubmitting = false;
        if (btnSubmit) {
            btnSubmit.innerText = "経費を保存";
            btnSubmit.disabled = false;
        }
    }
}

async function markExpensePaid(id, amount) {
    const account = prompt(`未払経費 (¥${amount.toLocaleString()}) を支払います。\n支払元を入力してください（現金 / 銀行A / 個人の立替 など）`, '現金');
    if (!account) return;
    
    try {
        const tx = db.transaction(['expenses', 'transactions'], 'readwrite');
        
        const expStore = tx.objectStore('expenses');
        const expense = await expStore.get(id);
        
        if (!expense || expense.is_paid) return;
        
        expense.is_paid = true;
        expense.account = account;
        expStore.put(expense);
        
        tx.objectStore('transactions').put({
            id: 'tx_exp_late_' + Date.now(),
            date: new Date().toISOString(),
            type: '経費',
            amount: expense.amount,
            account: account,
            ref_id: expense.id,
            memo: expense.memo + ' (後日支払)'
        });
        
        await tx.done;
        loadExpenses();
    } catch (err) {
        console.error(err);
        alert("支払処理に失敗しました。");
    }
}
