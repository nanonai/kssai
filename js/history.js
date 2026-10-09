let allSales = [];
let currentHistoryPeriod = 'day'; // 'day', 'week', 'month', 'year', 'all'
let currentHistoryDate = new Date();

function getHistoryPeriodBounds(date, period) {
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
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
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

function getHistoryPeriodLabel(date, period) {
    if (period === 'all') return `全期間`;
    if (period === 'day') return `${date.getFullYear()}年${date.getMonth()+1}月${date.getDate()}日`;
    if (period === 'week') {
        const bounds = getHistoryPeriodBounds(date, period);
        return `${bounds.start.getMonth()+1}/${bounds.start.getDate()} - ${bounds.end.getMonth()+1}/${bounds.end.getDate()}`;
    }
    if (period === 'month') return `${date.getFullYear()}年${date.getMonth()+1}月`;
    if (period === 'year') return `${date.getFullYear()}年`;
}

window.changeHistoryPeriod = function(period) {
    currentHistoryPeriod = period;
    renderHistoryCards();
};

window.navigateHistoryPeriod = function(direction) {
    if (currentHistoryPeriod === 'all') return;
    if (currentHistoryPeriod === 'day') {
        currentHistoryDate.setDate(currentHistoryDate.getDate() + direction);
    } else if (currentHistoryPeriod === 'week') {
        currentHistoryDate.setDate(currentHistoryDate.getDate() + (direction * 7));
    } else if (currentHistoryPeriod === 'month') {
        currentHistoryDate.setMonth(currentHistoryDate.getMonth() + direction);
    } else if (currentHistoryPeriod === 'year') {
        currentHistoryDate.setFullYear(currentHistoryDate.getFullYear() + direction);
    }
    renderHistoryCards();
};

async function loadHistory() {
    allSales = await db.getAll('sales');
    allSales.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const historySection = document.getElementById('history');
    historySection.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1rem;">
            <h2 style="margin: 0;">売上履歴</h2>
        </div>
        
        <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem; overflow-x: auto; white-space: nowrap; padding-bottom: 0.5rem;" id="history-period-btns">
            <!-- Buttons rendered dynamically -->
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; background: #f9f9f9; padding: 0.5rem; border-radius: 8px;" id="history-nav-bar">
            <!-- Nav rendered dynamically -->
        </div>
        
        <div id="history-summary" style="margin-bottom: 1rem;"></div>
        
        <div id="history-list"></div>
    `;
    
    renderHistoryCards();
}

async function renderHistoryCards() {
    const list = document.getElementById('history-list');
    const summaryDiv = document.getElementById('history-summary');
    const periodBtns = document.getElementById('history-period-btns');
    const navBar = document.getElementById('history-nav-bar');
    
    if (!list) return;

    // Render Buttons
    periodBtns.innerHTML = `
        <button onclick="changeHistoryPeriod('day')" style="flex:1; padding:0.5rem; border:1px solid var(--border-color); border-radius:8px; background:${currentHistoryPeriod==='day'?'var(--accent-green)':'#fff'}; color:${currentHistoryPeriod==='day'?'#fff':'#333'}">1日</button>
        <button onclick="changeHistoryPeriod('week')" style="flex:1; padding:0.5rem; border:1px solid var(--border-color); border-radius:8px; background:${currentHistoryPeriod==='week'?'var(--accent-green)':'#fff'}; color:${currentHistoryPeriod==='week'?'#fff':'#333'}">1週</button>
        <button onclick="changeHistoryPeriod('month')" style="flex:1; padding:0.5rem; border:1px solid var(--border-color); border-radius:8px; background:${currentHistoryPeriod==='month'?'var(--accent-green)':'#fff'}; color:${currentHistoryPeriod==='month'?'#fff':'#333'}">1ヶ月</button>
        <button onclick="changeHistoryPeriod('year')" style="flex:1; padding:0.5rem; border:1px solid var(--border-color); border-radius:8px; background:${currentHistoryPeriod==='year'?'var(--accent-green)':'#fff'}; color:${currentHistoryPeriod==='year'?'#fff':'#333'}">1年</button>
        <button onclick="changeHistoryPeriod('all')" style="flex:1; padding:0.5rem; border:1px solid var(--border-color); border-radius:8px; background:${currentHistoryPeriod==='all'?'var(--accent-green)':'#fff'}; color:${currentHistoryPeriod==='all'?'#fff':'#333'}">全期間</button>
    `;

    const label = getHistoryPeriodLabel(currentHistoryDate, currentHistoryPeriod);
    
    if (currentHistoryPeriod === 'all') {
        navBar.style.display = 'none';
    } else {
        navBar.style.display = 'flex';
        navBar.innerHTML = `
            <button onclick="navigateHistoryPeriod(-1)" style="padding: 0.5rem 1rem; border: none; background: transparent; font-size: 1.2rem; cursor: pointer;">◀</button>
            <div style="font-weight: bold; font-size: 1.1rem;">${label}</div>
            <button onclick="navigateHistoryPeriod(1)" style="padding: 0.5rem 1rem; border: none; background: transparent; font-size: 1.2rem; cursor: pointer;">▶</button>
        `;
    }

    const bounds = getHistoryPeriodBounds(currentHistoryDate, currentHistoryPeriod);
    
    // Filter sales by date
    const recentSales = allSales.filter(s => {
        const d = new Date(s.date);
        return d >= bounds.start && d <= bounds.end;
    });

    const allItems = await db.getAll('sale_items');
    
    // Calculate Summary
    let totalGross = 0;
    let totalRefunds = 0;
    let totalDiscounts = 0;
    let cashTotal = 0;
    let cashlessTotal = 0;
    let itemCount = 0;
    let customerCount = 0;
    
    recentSales.forEach(sale => {
        if (sale.refunded) {
            totalRefunds += sale.total;
        } else {
            totalGross += sale.total;
            totalDiscounts += sale.discount || 0;
            if (sale.method === '現金') cashTotal += sale.total;
            else cashlessTotal += sale.total;
            customerCount++;
            
            const saleItems = allItems.filter(i => i.sale_id === sale.id);
            saleItems.forEach(si => itemCount += si.quantity);
        }
    });

    // Render Summary
    if (recentSales.length > 0) {
        summaryDiv.innerHTML = `
            <div class="card" style="padding: 1rem; background: #fff; border-left: 4px solid var(--accent-green);">
                <div style="font-size: 0.9rem; color: #666; margin-bottom: 0.25rem;">純売上（${label}）</div>
                <div style="font-size: 1.8rem; font-weight: bold; color: var(--accent-green); margin-bottom: 1rem;">¥${totalGross.toLocaleString()}</div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.9rem;">
                    <div style="background: #f1f5f9; padding: 0.5rem; border-radius: 6px;">
                        <span style="color:#666; display:block; font-size:0.8rem;">現金</span>
                        <span style="font-weight:bold;">¥${cashTotal.toLocaleString()}</span>
                    </div>
                    <div style="background: #f1f5f9; padding: 0.5rem; border-radius: 6px;">
                        <span style="color:#666; display:block; font-size:0.8rem;">キャッシュレス</span>
                        <span style="font-weight:bold;">¥${cashlessTotal.toLocaleString()}</span>
                    </div>
                    <div style="background: #f1f5f9; padding: 0.5rem; border-radius: 6px;">
                        <span style="color:#666; display:block; font-size:0.8rem;">会計回数（客数）</span>
                        <span style="font-weight:bold;">${customerCount}回</span>
                    </div>
                    <div style="background: #f1f5f9; padding: 0.5rem; border-radius: 6px;">
                        <span style="color:#666; display:block; font-size:0.8rem;">販売商品数</span>
                        <span style="font-weight:bold;">${itemCount}点</span>
                    </div>
                </div>
                ${totalRefunds > 0 ? `<div style="margin-top:0.5rem; font-size:0.85rem; color:var(--accent-red);">※返金・取消総額: ¥${totalRefunds.toLocaleString()}</div>` : ''}
                ${totalDiscounts > 0 ? `<div style="margin-top:0.25rem; font-size:0.85rem; color:#888;">※値引き総額: ¥${totalDiscounts.toLocaleString()}</div>` : ''}
            </div>
        `;
    } else {
        summaryDiv.innerHTML = '';
    }
    
    // Render List
    list.innerHTML = '';
    
    if (recentSales.length === 0) {
        list.innerHTML = '<p style="color:#888;">売上データがありません</p>';
        return;
    }
    
    let lastDateLabel = '';
    
    recentSales.forEach(sale => {
        const saleItems = allItems.filter(i => i.sale_id === sale.id);
        const mainItemText = saleItems.length > 0 
            ? (saleItems[0].name + (saleItems.length > 1 ? ` 他${saleItems.length - 1}点` : ''))
            : '商品なし';
            
        const dateObj = new Date(sale.date);
        
        // Handle date grouping for Month/Year/All views
        if (currentHistoryPeriod !== 'day') {
            const dateLabel = dateObj.toLocaleDateString('ja-JP', { month:'numeric', day:'numeric', weekday:'short' });
            if (dateLabel !== lastDateLabel) {
                const sep = document.createElement('div');
                sep.style.cssText = "margin: 1rem 0 0.5rem 0; font-size: 0.9rem; font-weight: bold; color: #555; border-bottom: 1px solid #ddd; padding-bottom: 0.25rem;";
                sep.innerText = dateLabel;
                list.appendChild(sep);
                lastDateLabel = dateLabel;
            }
        }
        
        const timeStr = dateObj.toLocaleTimeString('ja-JP', { hour:'2-digit', minute:'2-digit' });
        const isRefunded = sale.refunded;
        
        const card = document.createElement('div');
        card.className = 'card';
        card.style.cssText = `margin-bottom: 0.5rem; padding: 1rem; cursor: pointer; border-left: 4px solid ${isRefunded ? 'var(--accent-red)' : 'var(--accent-green)'};`;
        
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                <span style="color: #666; font-size: 0.9rem;">${timeStr}</span>
                ${isRefunded ? '<span style="color:var(--accent-red); font-size: 0.9rem; font-weight:bold;">取消/返金済</span>' : `<span style="color:#666; font-size: 0.9rem;">${sale.method}</span>`}
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: bold; font-size: 1.05rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 60%;">${mainItemText}</span>
                <span style="font-weight: bold; font-size: 1.2rem; ${isRefunded ? 'text-decoration: line-through; color: #888;' : ''}">¥${sale.total.toLocaleString()}</span>
            </div>
            <div style="font-size: 0.8rem; color: #888; margin-top: 0.25rem;">
                ${sale.location}
            </div>
        `;
        
        card.onclick = () => viewSaleDetails(sale.id, saleItems);
        list.appendChild(card);
    });
}

async function viewSaleDetails(saleId, preloadedItems) {
    const sale = allSales.find(s => s.id === saleId);
    if (!sale) return;
    
    let saleItems = preloadedItems;
    if (!saleItems) {
        const items = await db.getAllFromIndex('sale_items', 'sale_id');
        saleItems = items.filter(i => i.sale_id === saleId);
    }
    
    const overlay = document.createElement('div');
    overlay.className = 'slide-panel-overlay';
    
    let itemsHtml = saleItems.map(si => `
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
            <div>
                <div style="font-weight: bold;">${si.name} <span style="font-weight: normal; color: #666;">x ${si.quantity}</span></div>
                ${si.toppings && si.toppings.length > 0 ? `<div style="font-size: 0.85rem; color: #666;">+ ${si.toppings.map(t=>t.name).join(', ')}</div>` : ''}
            </div>
            <div style="font-weight: bold;">
                ¥${(si.unit_price * si.quantity + (si.toppings||[]).reduce((s,t)=>s+t.price,0)*si.quantity).toLocaleString()}
            </div>
        </div>
    `).join('');
    
    overlay.innerHTML = `
        <div class="slide-panel">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem;">
                <h3 style="font-size: 1.2rem;">会計詳細</h3>
                <button id="modal-close" style="background:none; border:none; font-size: 1.5rem; color: #888;">✕</button>
            </div>
            
            <div style="margin-bottom: 1.5rem; color: #666; font-size: 0.95rem;">
                <div>日時: ${new Date(sale.date).toLocaleString('ja-JP')}</div>
                <div>場所: ${sale.location}</div>
                <div>支払: ${sale.method}</div>
                ${sale.refunded ? '<div style="color:var(--accent-red); font-weight:bold; margin-top: 0.5rem;">※この会計は取消されています</div>' : ''}
            </div>
            
            <div style="margin-bottom: 1.5rem; padding: 1rem; background: #f9f9f9; border-radius: 8px;">
                ${itemsHtml}
                <hr style="margin: 1rem 0; border: none; border-top: 1px dashed #ccc;">
                
                ${sale.discount > 0 ? `
                <div style="display: flex; justify-content: space-between; color: var(--accent-red); margin-bottom: 0.5rem;">
                    <span>値引き</span>
                    <span>-¥${sale.discount.toLocaleString()}</span>
                </div>` : ''}
                
                ${sale.containerCount > 0 ? `
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span>容器代 (x${sale.containerCount})</span>
                    <span>¥${sale.containerTotal.toLocaleString()}</span>
                </div>` : ''}
                
                <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1.2rem;">
                    <span>合計</span>
                    <span style="${sale.refunded ? 'text-decoration: line-through;' : ''}">¥${sale.total.toLocaleString()}</span>
                </div>
            </div>
            
            ${!sale.refunded ? `
                <div style="margin-bottom: 1rem;">
                    <button id="btn-refund" style="width: 100%; padding: 1rem; background: #fff; color: var(--accent-red); border: 1px solid var(--accent-red); border-radius: 8px; font-weight: bold; font-size: 1.1rem;">全額取消・返金</button>
                </div>
            ` : ''}
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    document.getElementById('modal-close').onclick = () => document.body.removeChild(overlay);
    
    const btnRefund = document.getElementById('btn-refund');
    if (btnRefund) {
        btnRefund.onclick = async () => {
            if (confirm(`合計 ¥${sale.total.toLocaleString()} を全額取消（返金）しますか？\n※この操作は元に戻せません。`)) {
                if (btnRefund.disabled) return;
                btnRefund.disabled = true;
                btnRefund.innerText = "処理中...";
                try {
                    const tx = db.transaction(['sales', 'transactions'], 'readwrite');
                    
                    const saleStore = tx.objectStore('sales');
                    const currentSale = await saleStore.get(sale.id);
                    
                    if (currentSale.refunded) {
                        alert("既に取消されています。");
                        return;
                    }
                    
                    currentSale.refunded = true;
                    saleStore.put(currentSale);
                    
                    if (currentSale.method === '現金') {
                        tx.objectStore('transactions').put({
                            id: 'tx_refund_' + Date.now(),
                            date: new Date().toISOString(),
                            type: '経費', 
                            amount: currentSale.total,
                            account: '現金',
                            ref_id: currentSale.id,
                            memo: '売上取消'
                        });
                    } else {
                        // Find original AR transaction to adjust clearance status
                        const allTxs = await tx.objectStore('transactions').getAll();
                        const originalTx = allTxs.find(t => t.ref_id === currentSale.id && t.type === '売上' && t.account === '未入金');
                        
                        let unpaidPortion = currentSale.total;
                        let clearedPortion = 0;
                        
                        if (originalTx) {
                            clearedPortion = parseFloat(originalTx.cleared_amount) || 0;
                            unpaidPortion = (parseFloat(originalTx.amount) || 0) - clearedPortion;
                            
                            originalTx.clearance_status = 'refunded';
                            tx.objectStore('transactions').put(originalTx);
                        }
                        
                        // Cancel out the unpaid AR
                        if (unpaidPortion > 0) {
                            tx.objectStore('transactions').put({
                                id: 'tx_refund_ar_' + Date.now(),
                                date: new Date().toISOString(),
                                type: '経費', 
                                amount: unpaidPortion,
                                account: '未入金',
                                ref_id: currentSale.id,
                                memo: '売上取消(未入金分): ' + currentSale.method
                            });
                        }
                        // Refund the cleared amount from the Bank
                        if (clearedPortion > 0) {
                            tx.objectStore('transactions').put({
                                id: 'tx_refund_bank_' + Date.now(),
                                date: new Date().toISOString(),
                                type: '経費', 
                                amount: clearedPortion,
                                account: '銀行A',
                                ref_id: currentSale.id,
                                memo: '売上取消(入金済分): ' + currentSale.method
                            });
                        }
                    }
                    
                    await tx.done;
                    alert('取消処理が完了しました。');
                    document.body.removeChild(overlay);
                    loadHistory();
                } catch (e) {
                    console.error("Refund failed", e);
                    alert("取消処理に失敗しました。");
                    btnRefund.disabled = false;
                    btnRefund.innerText = "全額取消・返金";
                }
            }
        };
    }
}
