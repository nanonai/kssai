let allSales = [];

async function loadHistory() {
    allSales = await db.getAll('sales');
    allSales.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const historySection = document.getElementById('history');
    historySection.innerHTML = `
        <h2 style="margin-bottom: 1rem;">売上履歴</h2>
        <div id="history-list"></div>
    `;
    
    renderHistoryCards();
}

async function renderHistoryCards() {
    const list = document.getElementById('history-list');
    list.innerHTML = '';
    
    if (allSales.length === 0) {
        list.innerHTML = '<p style="color:#888;">売上データがありません</p>';
        return;
    }
    
    // We fetch items so we can show "Main products" on the card
    const allItems = await db.getAll('sale_items');
    
    // Remove limit to show all history
    const recentSales = allSales;
    
    recentSales.forEach(sale => {
        const saleItems = allItems.filter(i => i.sale_id === sale.id);
        const mainItemText = saleItems.length > 0 
            ? (saleItems[0].name + (saleItems.length > 1 ? ` 他${saleItems.length - 1}点` : ''))
            : '商品なし';
            
        const dateObj = new Date(sale.date);
        let dateStr = dateObj.toLocaleDateString('ja-JP', { month:'numeric', day:'numeric' }) + ' ' + dateObj.toLocaleTimeString('ja-JP', { hour:'2-digit', minute:'2-digit' });
        
        if (sale.date.startsWith("2000-01-01")) {
            dateStr = "日時不明";
        }
        
        const isRefunded = sale.refunded;
        
        const card = document.createElement('div');
        card.className = 'card';
        card.style.cssText = `margin-bottom: 0.5rem; padding: 1rem; cursor: pointer; border-left: 4px solid ${isRefunded ? 'var(--accent-red)' : 'var(--accent-green)'};`;
        
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                <span style="color: #666; font-size: 0.9rem;">${dateStr}</span>
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
