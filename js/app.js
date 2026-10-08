let db;

async function initApp() {
    try {
        db = await initDB();
        await populateInitialData(db);
        await migrateNonCashSales(db);
        await upgradeARTransactions(db);
        
        setupNavigation();
        loadDraft();
        loadPOSProducts();
        
        const savedLoc = localStorage.getItem('kssai_current_location');
        if (savedLoc) {
            document.getElementById('current-location-display').innerText = savedLoc;
        }
        
        // 初回画面表示
        showSection('pos');
    } catch (e) {
        console.error("DB Initialization error", e);
        alert("データベースの初期化に失敗しました。\nエラー詳細: " + e.message);
    }
}

function setupNavigation() {
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const btnEl = e.currentTarget;
            const target = btnEl.getAttribute('data-target');
            showSection(target);
            
            navBtns.forEach(b => b.classList.remove('active'));
            btnEl.classList.add('active');
        });
    });
}

let previousSectionId = 'dashboard';

function showSection(id) {
    const sections = document.querySelectorAll('.page-section');
    const currentActive = document.querySelector('.page-section.active');
    
    // settingsへ移動する場合は、現在の画面を記憶しておく
    if (currentActive && currentActive.id !== 'settings' && id === 'settings') {
        previousSectionId = currentActive.id;
    }
    
    sections.forEach(sec => sec.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    
    // 特定画面表示時のリロード処理
    if (id === 'pos') loadPOSProducts();
    if (id === 'dashboard' && typeof loadDashboard === 'function') loadDashboard();
    if (id === 'history' && typeof loadHistory === 'function') loadHistory();
    if (id === 'expenses' && typeof loadExpenses === 'function') loadExpenses();
    if (id === 'products' && typeof loadProducts === 'function') loadProducts();
    if (id === 'analytics' && typeof loadAnalytics === 'function') loadAnalytics();
    if (id === 'funds' && typeof loadFunds === 'function') loadFunds();
    if (id === 'settings' && typeof loadSettings === 'function') loadSettings();
}

window.goToSettings = function() {
    showSection('settings');
    
    // 下部ナビゲーションの「その他(more)」を選択状態にする
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const moreBtn = document.querySelector('.nav-btn[data-target="more"]');
    if (moreBtn) moreBtn.classList.add('active');
    
    // Wait for the async render of settings page to finish
    setTimeout(() => {
        const target = document.querySelector('#settings h3'); // Target the "税金・資金計算モード" header
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, 150);
};

window.returnFromSettings = function() {
    const navBtn = document.querySelector(`.nav-btn[data-target="${previousSectionId}"]`);
    if (navBtn) {
        navBtn.click();
    } else {
        showSection(previousSectionId);
        // settings以外でnavBtnがないセクション（products等）は基本的に「more」配下
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        const moreBtn = document.querySelector('.nav-btn[data-target="more"]');
        if (moreBtn) moreBtn.classList.add('active');
    }
};

// --- POS Logic ---
let cart = [];
let currentProducts = [];
let selectedCategory = 'すべて';
let searchQuery = '';
let containerCount = 0;

function saveDraft() {
    localStorage.setItem('nameless_draft_cart', JSON.stringify(cart));
    localStorage.setItem('nameless_draft_containers', containerCount);
}

function loadDraft() {
    const draftCart = localStorage.getItem('nameless_draft_cart');
    const draftCont = localStorage.getItem('nameless_draft_containers');
    if (draftCart) {
        try {
            cart = JSON.parse(draftCart);
        } catch (e) {
            cart = [];
        }
    }
    if (draftCont) {
        containerCount = parseInt(draftCont) || 0;
    }
}

function clearDraft() {
    cart = [];
    containerCount = 0;
    searchQuery = '';
    localStorage.removeItem('nameless_draft_cart');
    localStorage.removeItem('nameless_draft_containers');
}

async function loadPOSProducts() {
    currentProducts = await db.getAllFromIndex('products', 'order');
    renderPOSSection();
}

function renderPOSSection() {
    const posSection = document.getElementById('pos');
    
    // Calculate totals for bottom bar
    let totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    let totalPrice = calculateCartTotal();
    
    const categories = ['すべて', 'バーガー', 'タコス', 'サラダ・サイド', 'ドリンク', 'アルコール'];
    
    posSection.innerHTML = `
        <div style="padding-bottom: 120px;">
            <input type="text" id="pos-search" placeholder="商品名を検索..." value="${searchQuery}" style="width:100%; padding: 1rem; margin-bottom: 1rem; border: 1px solid var(--border-color); border-radius: 8px; font-size: 16px;">
            
            <div style="display: flex; gap: 0.5rem; overflow-x: auto; padding-bottom: 1rem; margin-bottom: 1rem; -webkit-overflow-scrolling: touch; scrollbar-width: none;">
                <button onclick="openBulkInputModal()" style="padding: 0.5rem 1rem; border: 1px dashed var(--accent-red); background: #fff; color: var(--accent-red); border-radius: 20px; white-space: nowrap; font-weight: bold; min-height: 44px;">
                    ＋金額を手入力
                </button>
                ${categories.map(c => `
                    <button class="cat-btn" data-cat="${c}" style="padding: 0.5rem 1rem; border: 1px solid var(--accent-red); background: ${selectedCategory === c ? 'var(--accent-red)' : '#fff'}; color: ${selectedCategory === c ? '#fff' : 'var(--accent-red)'}; border-radius: 20px; white-space: nowrap; font-weight: bold; min-height: 44px;">
                        ${c}
                    </button>
                `).join('')}
            </div>
            
            <div id="pos-product-grid" class="grid grid-cols-2">
                <!-- Products -->
            </div>
        </div>
        
        <!-- Bottom Action Bar for POS (Positioned above the bottom-nav) -->
        <div style="position: fixed; bottom: calc(60px + env(safe-area-inset-bottom)); left: 0; width: 100%; background: var(--card-bg); box-shadow: 0 -2px 10px rgba(0,0,0,0.1); padding: 1rem; display: flex; justify-content: space-between; align-items: center; z-index: 800;">
            <div style="display: flex; flex-direction: column;">
                <span style="font-size: 0.9rem; color: #666;">${totalItems} 点</span>
                <span style="font-size: 1.2rem; font-weight: bold; color: var(--text-color);">¥${totalPrice.toLocaleString()}</span>
            </div>
            <div style="display: flex; gap: 0.5rem;">
                <button onclick="openCartModal()" class="btn-secondary" style="padding: 0.5rem 1rem; min-height: 48px; width: auto;">注文を見る</button>
                <button onclick="openCheckoutModal()" class="btn-primary" style="padding: 0.5rem 1.5rem; min-height: 48px; width: auto;">会計へ</button>
            </div>
        </div>
    `;
    
    document.querySelectorAll('.cat-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            selectedCategory = e.currentTarget.getAttribute('data-cat');
            renderPOSSection();
        });
    });
    
    document.getElementById('pos-search').addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        renderProducts(searchQuery);
    });
    
    renderProducts(searchQuery);
}

function renderProducts(query) {
    const grid = document.getElementById('pos-product-grid');
    grid.innerHTML = '';
    
    let filtered = currentProducts.filter(p => p.active);
    
    if (selectedCategory !== 'すべて') {
        filtered = filtered.filter(p => p.category === selectedCategory);
    }
    
    if (query) {
        filtered = filtered.filter(p => p.name.toLowerCase().includes(query));
    }
    
    filtered.forEach(p => {
        const btn = document.createElement('button');
        btn.style.cssText = 'padding: 1rem; border: 1px solid var(--border-color); background: #fff; border-radius: var(--radius); cursor: pointer; text-align: left; box-shadow: 0 1px 3px rgba(0,0,0,0.05); min-height: 80px; display: flex; flex-direction: column; justify-content: space-between;';
        btn.innerHTML = `
            <div style="font-weight: bold; font-size: 0.95rem; line-height: 1.3;">${p.name}</div>
            <div style="color: var(--accent-red); font-weight: bold; margin-top: 0.5rem;">¥${p.price.toLocaleString()}</div>
        `;
        btn.onclick = () => {
            if (p.toppingsType && p.toppingsType !== 'none') {
                openToppingModal(p);
            } else {
                addCartItem(p, [], 1);
            }
        };
        grid.appendChild(btn);
    });
}

async function openToppingModal(product) {
    const allToppings = await db.getAll('toppings');
    let validToppings = [];
    
    if (product.toppingsType === 'chips') {
        validToppings = [
            { id: 'c_salsa', name: 'サルサソース', price: 0 },
            { id: 'c_guaca', name: 'ワカモレ', price: 0 }
        ];
    } else {
        validToppings = allToppings.filter(t => t.type === product.toppingsType || (product.category === 'タコス' && t.type === 'tacos_set'));
    }
    
    const overlay = document.createElement('div');
    overlay.className = 'slide-panel-overlay';
    
    let toppingsHtml = validToppings.map(t => {
        if (product.toppingsType === 'chips') {
            return `<div style="padding: 1rem 0; border-bottom: 1px solid var(--border-color);"><label style="display:flex; align-items:center; font-size: 1.1rem;"><input type="radio" name="chips_sauce" value="${t.id}" data-name="${t.name}" data-price="${t.price}" style="margin-right: 1rem; width: 20px; height: 20px;"> ${t.name}</label></div>`;
        } else {
            return `<div style="padding: 1rem 0; border-bottom: 1px solid var(--border-color);"><label style="display:flex; align-items:center; font-size: 1.1rem; justify-content: space-between;">
                <div style="display:flex; align-items:center;"><input type="checkbox" class="topping-check" value="${t.id}" data-name="${t.name}" data-price="${t.price}" style="margin-right: 1rem; width: 20px; height: 20px;"> ${t.name}</div>
                <div style="color: var(--accent-red);">+¥${t.price}</div>
            </label></div>`;
        }
    }).join('');
    
    overlay.innerHTML = `
        <div class="slide-panel">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem;">
                <h3 style="font-size: 1.2rem;">${product.name}</h3>
                <button id="modal-cancel" style="background:none; border:none; font-size: 1.5rem; color: #888;">✕</button>
            </div>
            
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem; background: #f9f9f9; padding: 1rem; border-radius: 8px;">
                <span style="font-weight:bold;">数量</span>
                <div style="display:flex; align-items:center; gap: 1rem;">
                    <button id="qty-minus" style="width:40px; height:40px; border-radius:20px; border:1px solid #ccc; background:#fff; font-size:1.2rem;">-</button>
                    <span id="qty-display" style="font-size:1.2rem; font-weight:bold; width:30px; text-align:center;">1</span>
                    <button id="qty-plus" style="width:40px; height:40px; border-radius:20px; border:1px solid #ccc; background:#fff; font-size:1.2rem;">+</button>
                </div>
            </div>
            
            <div style="margin-bottom: 2rem; max-height: 40vh; overflow-y: auto;">
                ${toppingsHtml}
            </div>
            
            <button id="modal-add" class="btn-primary">カートに追加</button>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    let qty = 1;
    document.getElementById('qty-minus').onclick = () => { if(qty > 1) { qty--; document.getElementById('qty-display').innerText = qty; }};
    document.getElementById('qty-plus').onclick = () => { qty++; document.getElementById('qty-display').innerText = qty; };
    
    document.getElementById('modal-cancel').onclick = () => document.body.removeChild(overlay);
    
    document.getElementById('modal-add').onclick = () => {
        const selectedToppings = [];
        if (product.toppingsType === 'chips') {
            const checked = overlay.querySelector('input[name="chips_sauce"]:checked');
            if (!checked) {
                alert("ソースを選択してください。");
                return;
            }
            selectedToppings.push({
                id: checked.value,
                name: checked.getAttribute('data-name'),
                price: parseInt(checked.getAttribute('data-price'))
            });
        } else {
            const checks = overlay.querySelectorAll('.topping-check:checked');
            checks.forEach(c => {
                selectedToppings.push({
                    id: c.value,
                    name: c.getAttribute('data-name'),
                    price: parseInt(c.getAttribute('data-price'))
                });
            });
        }
        
        addCartItem(product, selectedToppings, qty);
        document.body.removeChild(overlay);
    };
}

function addCartItem(product, toppings, quantity) {
    const cartItemId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    cart.push({
        cartItemId,
        product: { ...product }, 
        toppings,
        quantity: quantity
    });
    
    saveDraft();
    renderPOSSection();
}

function calculateCartTotal() {
    let total = 0;
    cart.forEach(item => {
        let itemTotal = item.product.price;
        item.toppings.forEach(t => itemTotal += t.price);
        total += itemTotal * item.quantity;
    });
    total += containerCount * 80;
    return total;
}

function openCartModal() {
    const overlay = document.createElement('div');
    overlay.className = 'slide-panel-overlay';
    
    const renderCartItems = () => {
        let html = '';
        if (cart.length === 0 && containerCount === 0) {
            html = '<p style="text-align:center; color:#888; padding: 2rem 0;">カートは空です</p>';
        } else {
            cart.forEach((item, index) => {
                const toppingText = item.toppings.length > 0 
                    ? `<div style="font-size: 0.85rem; color: #666;">+ ${item.toppings.map(t => t.name).join(', ')}</div>` 
                    : '';
                
                let itemTotal = item.product.price;
                item.toppings.forEach(t => itemTotal += t.price);
                
                html += `
                    <div style="padding: 1rem 0; border-bottom: 1px solid var(--border-color);">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                            <div style="flex: 1;">
                                <div style="font-weight: bold; font-size: 1.1rem;">${item.product.name}</div>
                                ${toppingText}
                                <div style="margin-top: 0.5rem;">
                                    単価: ¥<input type="number" value="${item.product.price}" onchange="updateCartItemPrice(${index}, this.value)" style="width: 80px; padding: 0.25rem; font-size: 1rem; border: 1px solid #ccc; border-radius: 4px;">
                                </div>
                            </div>
                            <div style="font-weight: bold; color: var(--accent-red); font-size: 1.1rem;">
                                ¥${(itemTotal * item.quantity).toLocaleString()}
                            </div>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <button onclick="removeFromCart(${index})" style="background:none; border:none; color: #888; text-decoration: underline; padding: 0.5rem 0;">削除</button>
                            <div style="display:flex; align-items:center; gap: 1rem;">
                                <button onclick="updateCartItemQuantity(${index}, -1)" style="width:36px; height:36px; border-radius:18px; border:1px solid #ccc; background:#fff; font-size:1.2rem;">-</button>
                                <span style="font-size:1.1rem; font-weight:bold; width: 24px; text-align:center;">${item.quantity}</span>
                                <button onclick="updateCartItemQuantity(${index}, 1)" style="width:36px; height:36px; border-radius:18px; border:1px solid #ccc; background:#fff; font-size:1.2rem;">+</button>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            // Container row
            html += `
                <div style="padding: 1rem 0; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-weight: bold; font-size: 1.1rem;">持ち帰り容器代</div>
                    <div style="display:flex; align-items:center; gap: 1rem;">
                        <span style="color: var(--accent-red); font-weight: bold;">¥${(containerCount * 80).toLocaleString()}</span>
                        <div style="display:flex; align-items:center; gap: 0.5rem; margin-left: 1rem;">
                            <button onclick="updateContainerCount(-1)" style="width:36px; height:36px; border-radius:18px; border:1px solid #ccc; background:#fff; font-size:1.2rem;">-</button>
                            <span style="font-size:1.1rem; font-weight:bold; width: 24px; text-align:center;">${containerCount}</span>
                            <button onclick="updateContainerCount(1)" style="width:36px; height:36px; border-radius:18px; border:1px solid #ccc; background:#fff; font-size:1.2rem;">+</button>
                        </div>
                    </div>
                </div>
            `;
        }
        return html;
    };
    
    const updateModalContent = () => {
        const contentDiv = overlay.querySelector('.cart-content');
        if(contentDiv) contentDiv.innerHTML = renderCartItems();
        const totalDiv = overlay.querySelector('.cart-total-display');
        if(totalDiv) totalDiv.innerText = `¥${calculateCartTotal().toLocaleString()}`;
    };
    
    // Attach to window so inline onclick works
    window.updateCartItemPrice = (index, val) => { cart[index].product.price = parseInt(val) || 0; saveDraft(); updateModalContent(); renderPOSSection(); };
    window.updateCartItemQuantity = (index, delta) => { 
        if(cart[index].quantity + delta > 0) { 
            cart[index].quantity += delta; 
            saveDraft(); 
            updateModalContent(); 
            renderPOSSection();
        } 
    };
    window.removeFromCart = (index) => { 
        cart.splice(index, 1); 
        saveDraft(); 
        updateModalContent(); 
        renderPOSSection();
    };
    window.updateContainerCount = (delta) => {
        if (containerCount + delta >= 0) {
            containerCount += delta;
            saveDraft();
            updateModalContent();
            renderPOSSection();
        }
    };
    
    overlay.innerHTML = `
        <div class="slide-panel" style="max-height: 90vh;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1rem;">
                <h3 style="font-size: 1.2rem;">現在の注文</h3>
                <button id="modal-close" style="background:none; border:none; font-size: 1.5rem; color: #888;">✕</button>
            </div>
            
            <div class="cart-content" style="max-height: 50vh; overflow-y: auto; margin-bottom: 1rem;">
                ${renderCartItems()}
            </div>
            
            <div style="display:flex; justify-content:space-between; align-items:center; font-size: 1.3rem; font-weight: bold; margin-bottom: 1.5rem;">
                <span>合計</span>
                <span class="cart-total-display" style="color: var(--accent-red);">¥${calculateCartTotal().toLocaleString()}</span>
            </div>
            
            <button id="modal-checkout" class="btn-primary">会計へ進む</button>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    document.getElementById('modal-close').onclick = () => document.body.removeChild(overlay);
    document.getElementById('modal-checkout').onclick = () => {
        document.body.removeChild(overlay);
        openCheckoutModal();
    };
}

let isSubmitting = false;

function openCheckoutModal() {
    if (cart.length === 0 && containerCount === 0) {
        alert("注文がありません。");
        return;
    }
    
    const total = calculateCartTotal();
    
    const overlay = document.createElement('div');
    overlay.className = 'slide-panel-overlay';
    
    overlay.innerHTML = `
        <div class="slide-panel" style="max-height: 95vh;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1rem;">
                <h3 style="font-size: 1.2rem;">会計</h3>
                <button id="chk-cancel" style="background:none; border:none; font-size: 1.5rem; color: #888;">✕</button>
            </div>
            
            <div style="font-size: 2rem; font-weight: bold; text-align: center; color: var(--accent-red); margin-bottom: 1.5rem;">
                ¥<span id="chk-total">${total.toLocaleString()}</span>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <label style="font-weight:bold; display:block; margin-bottom:0.5rem;">販売日時</label>
                <input type="datetime-local" id="chk-datetime" style="width:100%; padding: 1rem; border: 1px solid var(--border-color); border-radius: 8px; font-size: 1.2rem;">
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <label style="font-weight:bold; display:block; margin-bottom:0.5rem;">値引き (円)</label>
                <input type="number" id="chk-discount" value="0" style="width:100%; padding: 1rem; border: 1px solid var(--border-color); border-radius: 8px; font-size: 1.2rem;">
            </div>
            
            <label style="font-weight:bold; display:block; margin-bottom:0.5rem;">支払方法</label>
            <div class="grid grid-cols-2" style="margin-bottom: 1.5rem;">
                <button class="pay-method-btn active" data-method="現金" style="padding:1rem; border:2px solid var(--accent-red); background:#fff; font-weight:bold; border-radius:8px;">現金</button>
                <button class="pay-method-btn" data-method="クレジットカード" style="padding:1rem; border:1px solid #ccc; background:#fff; font-weight:bold; border-radius:8px;">クレカ</button>
                <button class="pay-method-btn" data-method="QR決済" style="padding:1rem; border:1px solid #ccc; background:#fff; font-weight:bold; border-radius:8px;">QR決済</button>
                <button class="pay-method-btn" data-method="その他" style="padding:1rem; border:1px solid #ccc; background:#fff; font-weight:bold; border-radius:8px;">その他</button>
            </div>
            
            <div id="cash-calc-area" style="margin-bottom: 1.5rem; background: #f9f9f9; padding: 1rem; border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <label style="font-weight:bold;">預かり金</label>
                    <button id="btn-exact" style="padding: 0.25rem 0.5rem; background: var(--text-color); color: white; border: none; border-radius: 4px; font-size: 0.9rem;">ちょうど</button>
                </div>
                <input type="number" id="chk-tendered" placeholder="預かり金額を入力" style="width:100%; padding: 1rem; border: 1px solid var(--border-color); border-radius: 8px; font-size: 1.2rem; margin-bottom: 0.5rem;">
                <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1.1rem;">
                    <span>お釣り</span>
                    <span id="chk-change" style="color: var(--accent-red);">¥0</span>
                </div>
            </div>
            
            <button id="chk-submit" class="btn-primary">会計を記録</button>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Set default datetime to current local time
    const datetimeInput = document.getElementById('chk-datetime');
    if (datetimeInput) {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        datetimeInput.value = now.toISOString().slice(0, 16);
    }
    
    let selectedMethod = '現金';
    const methodBtns = overlay.querySelectorAll('.pay-method-btn');
    const cashArea = document.getElementById('cash-calc-area');
    const discountInput = document.getElementById('chk-discount');
    const tenderedInput = document.getElementById('chk-tendered');
    const changeDisplay = document.getElementById('chk-change');
    const finalTotalDisplay = document.getElementById('chk-total');
    
    const updateTotal = () => {
        let disc = parseInt(discountInput.value) || 0;
        let finalT = total - disc;
        if (finalT < 0) finalT = 0;
        finalTotalDisplay.innerText = finalT.toLocaleString();
        
        let tendered = parseInt(tenderedInput.value) || 0;
        let change = tendered - finalT;
        if (change < 0) {
            changeDisplay.innerText = "不足 ¥" + Math.abs(change).toLocaleString();
            changeDisplay.style.color = "var(--accent-mustard)";
        } else {
            changeDisplay.innerText = "¥" + change.toLocaleString();
            changeDisplay.style.color = "var(--accent-red)";
        }
    };
    
    discountInput.addEventListener('input', updateTotal);
    tenderedInput.addEventListener('input', updateTotal);
    
    document.getElementById('btn-exact').onclick = () => {
        let disc = parseInt(discountInput.value) || 0;
        let finalT = total - disc;
        tenderedInput.value = Math.max(0, finalT);
        updateTotal();
    };
    
    methodBtns.forEach(btn => {
        btn.onclick = (e) => {
            methodBtns.forEach(b => { b.style.border = '1px solid #ccc'; b.classList.remove('active'); });
            e.target.style.border = '2px solid var(--accent-red)';
            e.target.classList.add('active');
            selectedMethod = e.target.getAttribute('data-method');
            
            if (selectedMethod === '現金') cashArea.style.display = 'block';
            else cashArea.style.display = 'none';
        };
    });
    
    document.getElementById('chk-cancel').onclick = () => document.body.removeChild(overlay);
    
    document.getElementById('chk-submit').onclick = async () => {
        if (isSubmitting) return;
        
        let disc = parseInt(discountInput.value) || 0;
        let finalT = total - disc;
        if (finalT < 0) finalT = 0;
        
        if (selectedMethod === '現金') {
            let tendered = parseInt(tenderedInput.value) || 0;
            if (tendered < finalT) {
                alert("預かり金が不足しています。");
                return;
            }
        }
        
        isSubmitting = true;
        const btnSubmit = document.getElementById('chk-submit');
        btnSubmit.innerText = "保存中...";
        btnSubmit.style.opacity = "0.7";
        
        try {
            const locName = document.getElementById('current-location-display').innerText;
            
            let saleDate = new Date().toISOString();
            if (datetimeInput && datetimeInput.value) {
                const parsedDate = new Date(datetimeInput.value);
                if (!isNaN(parsedDate.getTime())) {
                    saleDate = parsedDate.toISOString();
                }
            }
            
            const sale = {
                id: 's_' + Date.now(),
                date: saleDate,
                location: locName,
                method: selectedMethod,
                discount: disc,
                total: finalT,
                containerCount: containerCount,
                containerTotal: containerCount * 80,
                memo: "", // can add field later if needed
                refunded: false
            };
            
            const saleItems = [];
            cart.forEach(item => {
                saleItems.push({
                    id: 'si_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                    sale_id: sale.id,
                    product_id: item.product.id,
                    name: item.product.name,
                    unit_price: item.product.price,
                    cost: item.product.cost,
                    quantity: item.quantity,
                    toppings: item.toppings,
                    refunded_quantity: 0
                });
            });

            const tx = db.transaction(['sales', 'sale_items', 'transactions'], 'readwrite');
            tx.objectStore('sales').put(sale);
            
            saleItems.forEach(si => tx.objectStore('sale_items').put(si));
            
            if (selectedMethod === '現金') {
                tx.objectStore('transactions').put({
                    id: 'tx_' + Date.now(),
                    date: sale.date,
                    type: '売上',
                    amount: finalT,
                    account: '現金',
                    ref_id: sale.id
                });
            } else {
                tx.objectStore('transactions').put({
                    id: 'tx_ar_' + Date.now(),
                    date: sale.date,
                    type: '売上',
                    amount: finalT,
                    account: '未入金',
                    ref_id: sale.id,
                    clearance_status: 'unpaid',
                    cleared_amount: 0
                });
            }
            
            await tx.done;
            
            clearDraft();
            renderPOSSection();
            
            // Success view
            overlay.innerHTML = `
                <div class="slide-panel" style="text-align:center; padding: 3rem 1rem;">
                    <div style="font-size: 4rem; margin-bottom: 1rem;">✅</div>
                    <h2 style="margin-bottom: 2rem;">会計を記録しました</h2>
                    <button onclick="document.body.removeChild(document.querySelector('.slide-panel-overlay'))" class="btn-primary">次の会計へ</button>
                </div>
            `;
            
        } catch (e) {
            console.error("Checkout failed", e);
            alert("会計の保存に失敗しました。入力内容は保持されています。");
            btnSubmit.innerText = "会計を記録";
            btnSubmit.style.opacity = "1";
        } finally {
            isSubmitting = false;
        }
    };
}

window.openLocationModal = function() {
    let locs = JSON.parse(localStorage.getItem('kssai_locations') || '["メインキッチン"]');
    const overlay = document.createElement('div');
    overlay.className = 'slide-panel-overlay';
    
    const renderList = () => {
        return locs.map(l => `
            <div style="padding:1rem; border-bottom:1px solid #ccc; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:1.1rem; font-weight:bold;">${l}</span>
                <button class="btn-primary select-loc-btn" data-loc="${l}" style="width:auto; padding:0.5rem 1rem;">選択</button>
            </div>
        `).join('');
    };

    overlay.innerHTML = `
        <div class="slide-panel" style="max-height: 80vh; display:flex; flex-direction:column;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1rem;">
                <h3 style="font-size: 1.2rem;">販売場所の選択</h3>
                <button id="loc-cancel" style="background:none; border:none; font-size: 1.5rem; color: #888;">✕</button>
            </div>
            <div style="flex:1; overflow-y:auto; margin-bottom:1rem; border:1px solid #eee; border-radius:8px;" id="loc-list-container">
                ${renderList()}
            </div>
            <div style="display:flex; gap:0.5rem;">
                <input type="text" id="new-loc-input" placeholder="新しい場所を追加..." style="flex:1; padding:0.75rem; border:1px solid #ccc; border-radius:4px;">
                <button id="loc-add" class="btn-primary" style="width:auto; padding:0.75rem 1rem;">追加</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    document.getElementById('loc-cancel').onclick = () => document.body.removeChild(overlay);
    
    const attachSelectEvents = () => {
        overlay.querySelectorAll('.select-loc-btn').forEach(btn => {
            btn.onclick = (e) => {
                const l = e.target.getAttribute('data-loc');
                localStorage.setItem('kssai_current_location', l);
                document.getElementById('current-location-display').innerText = l;
                document.body.removeChild(overlay);
            };
        });
    };
    attachSelectEvents();
    
    document.getElementById('loc-add').onclick = () => {
        const val = document.getElementById('new-loc-input').value.trim();
        if (val && !locs.includes(val)) {
            locs.push(val);
            localStorage.setItem('kssai_locations', JSON.stringify(locs));
            document.getElementById('loc-list-container').innerHTML = renderList();
            document.getElementById('new-loc-input').value = '';
            attachSelectEvents();
        }
    };
};

window.openBulkInputModal = function() {
    const overlay = document.createElement('div');
    overlay.className = 'slide-panel-overlay';
    
    overlay.innerHTML = `
        <div class="slide-panel" style="max-height: 95vh;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1rem;">
                <h3 style="font-size: 1.2rem;">売上金額の手入力</h3>
                <button id="bulk-cancel" style="background:none; border:none; font-size: 1.5rem; color: #888;">✕</button>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <label style="font-weight:bold; display:block; margin-bottom:0.5rem;">売上金額 (円)</label>
                <input type="number" id="bulk-amount" placeholder="例: 10000" style="width:100%; padding: 1rem; border: 1px solid var(--border-color); border-radius: 8px; font-size: 1.2rem;">
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <label style="font-weight:bold; display:block; margin-bottom:0.5rem;">販売日時</label>
                <div style="display:flex; flex-direction:column; gap:0.5rem;">
                    <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
                        <input type="checkbox" id="bulk-unknown-date" style="width:24px; height:24px;">
                        <span style="font-weight:bold;">日付・日時不明として記録する</span>
                    </label>
                    <input type="datetime-local" id="bulk-datetime" style="width:100%; padding: 1rem; border: 1px solid var(--border-color); border-radius: 8px; font-size: 1.2rem;">
                </div>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <label style="font-weight:bold; display:block; margin-bottom:0.5rem;">支払方法</label>
                <select id="bulk-method" style="width:100%; padding: 1rem; border: 1px solid var(--border-color); border-radius: 8px; font-size: 1.2rem;">
                    <option value="現金">現金</option>
                    <option value="クレジットカード">クレジットカード</option>
                    <option value="QR決済">QR決済</option>
                    <option value="その他">その他</option>
                </select>
            </div>
            
            <button id="bulk-submit" class="btn-primary">記録する</button>
        </div>
    `;
    document.body.appendChild(overlay);
    
    const datetimeInput = document.getElementById('bulk-datetime');
    const unknownChk = document.getElementById('bulk-unknown-date');
    
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    datetimeInput.value = now.toISOString().slice(0, 16);
    
    unknownChk.onchange = () => {
        datetimeInput.disabled = unknownChk.checked;
        if (unknownChk.checked) {
            datetimeInput.style.opacity = '0.5';
        } else {
            datetimeInput.style.opacity = '1';
        }
    };
    
    document.getElementById('bulk-cancel').onclick = () => document.body.removeChild(overlay);
    
    let isSubmitting = false;
    document.getElementById('bulk-submit').onclick = async () => {
        if (isSubmitting) return;
        const amount = parseInt(document.getElementById('bulk-amount').value);
        if (!amount || amount <= 0 || isNaN(amount)) {
            alert("正しい金額を入力してください。");
            return;
        }
        
        isSubmitting = true;
        const btnSubmit = document.getElementById('bulk-submit');
        btnSubmit.innerText = "保存中...";
        btnSubmit.style.opacity = "0.7";
        
        try {
            const locName = document.getElementById('current-location-display').innerText;
            const method = document.getElementById('bulk-method').value;
            
            let saleDate = new Date().toISOString();
            if (unknownChk.checked) {
                saleDate = "2000-01-01T00:00:00.000Z";
            } else if (datetimeInput.value) {
                const parsedDate = new Date(datetimeInput.value);
                if (!isNaN(parsedDate.getTime())) {
                    saleDate = parsedDate.toISOString();
                }
            }
            
            const sale = {
                id: 's_' + Date.now(),
                date: saleDate,
                location: locName,
                method: method,
                discount: 0,
                total: amount,
                containerCount: 0,
                containerTotal: 0,
                memo: "手入力売上",
                refunded: false
            };
            
            const tx = db.transaction(['sales', 'sale_items', 'transactions'], 'readwrite');
            tx.objectStore('sales').put(sale);
            
            tx.objectStore('sale_items').put({
                id: 'si_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                sale_id: sale.id,
                product_id: 'dummy_bulk',
                name: '手入力売上',
                unit_price: amount,
                cost: 0,
                quantity: 1,
                toppings: [],
                refunded_quantity: 0
            });
            
            if (method === '現金') {
                tx.objectStore('transactions').put({
                    id: 'tx_' + Date.now(),
                    date: sale.date,
                    type: '売上',
                    amount: amount,
                    account: '現金',
                    ref_id: sale.id
                });
            } else {
                tx.objectStore('transactions').put({
                    id: 'tx_ar_' + Date.now(),
                    date: sale.date,
                    type: '売上',
                    amount: amount,
                    account: '未入金',
                    ref_id: sale.id,
                    clearance_status: 'unpaid',
                    cleared_amount: 0
                });
            }
            
            await tx.done;
            document.body.removeChild(overlay);
            
            const toast = document.createElement('div');
            toast.innerText = "売上を記録しました";
            toast.style.cssText = "position:fixed; bottom:80px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.8); color:#fff; padding:10px 20px; border-radius:20px; z-index:10000; font-weight:bold;";
            document.body.appendChild(toast);
            setTimeout(() => { if (toast.parentNode) document.body.removeChild(toast); }, 2000);
            
            if (typeof renderPOSSection === 'function') renderPOSSection();
            
        } catch (e) {
            console.error(e);
            alert("保存に失敗しました。");
            btnSubmit.innerText = "記録する";
            btnSubmit.style.opacity = "1";
        } finally {
            isSubmitting = false;
        }
    };
};
