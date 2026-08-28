import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBQpZosIqlg1lc5dT5UWgBHAMxzrcje6S4",
  authDomain: "chat-3d356.firebaseapp.com",
  projectId: "chat-3d356",
  storageBucket: "chat-3d356.firebasestorage.app",
  messagingSenderId: "750976196666",
  appId: "1:750976196666:web:4dc9a71b8253c3cad45503",
  measurementId: "G-CW820HNMB2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// COLLECTIONS
const playersRef = collection(db, "players");
const itemsRef = collection(db, "items");
const purchasesRef = collection(db, "purchases");

// APP STATE
let playersData = [];
let itemsData = [];
let cart = [];
let activeDiscount = 0;

// TAB NAVIGATION ENGINE
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

function switchTab(tabId) {
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-view').forEach(t => t.classList.remove('active'));
  
  const targetBtn = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
  if (targetBtn) targetBtn.classList.add('active');
  document.getElementById(`${tabId}-tab`).classList.add('active');
}

// REALTIME LISTENERS
onSnapshot(playersRef, (snapshot) => {
  playersData = [];
  const playersGrid = document.getElementById('players-grid');
  const posSelect = document.getElementById('pos-player-select');
  const currentSelected = posSelect.value;
  
  playersGrid.innerHTML = '';
  posSelect.innerHTML = '<option value="">Select a Family Member...</option>';

  snapshot.forEach(docSnap => {
    const p = { id: docSnap.id, ...docSnap.data() };
    playersData.push(p);

    posSelect.innerHTML += `<option value="${p.id}" ${currentSelected === p.id ? 'selected' : ''}>${p.firstName} ${p.lastName} (${p.points} pts)</option>`;

    const avatar = p.image || 'https://via.placeholder.com/150/1e293b/94a3b8?text=User';
    const tier = p.points > 500 ? 'GOLD' : p.points > 200 ? 'SILVER' : 'BRONZE';

    playersGrid.innerHTML += `
      <div class="card">
        <span class="tier-badge">${tier}</span>
        <img class="card-avatar" src="${avatar}">
        <h3 style="font-size:1.1rem; font-weight:700;">${p.firstName} ${p.lastName}</h3>
        <div class="badge-points">${p.points} Points</div>
        <div class="card-actions-row">
          <button class="btn btn-success" style="flex:1;" onclick="openPlayerAccountTerminal('${p.id}')">Open Account</button>
          <button class="btn btn-secondary" onclick="editPlayer('${p.id}')">Edit</button>
          <button class="btn btn-danger" onclick="deleteRecord('players', '${p.id}')">&times;</button>
        </div>
      </div>
    `;
  });
});

onSnapshot(itemsRef, (snapshot) => {
  itemsData = [];
  const itemsGrid = document.getElementById('items-grid');
  const posItemsGrid = document.getElementById('pos-items-grid');
  
  itemsGrid.innerHTML = '';
  posItemsGrid.innerHTML = '';

  snapshot.forEach(docSnap => {
    const item = { id: docSnap.id, ...docSnap.data() };
    itemsData.push(item);

    const img = item.image || 'https://via.placeholder.com/150/1e293b/94a3b8?text=Item';
    const stock = item.stock !== undefined ? item.stock : 99;

    itemsGrid.innerHTML += `
      <div class="card">
        <img class="card-avatar" style="border-radius:12px;" src="${img}">
        <h3>${item.name}</h3>
        <div class="badge-points">${item.cost} Points</div>
        <p style="font-size:0.75rem; color:var(--text-muted);">Stock: ${stock}</p>
        <div class="card-actions-row" style="margin-top:8px;">
          <button class="btn btn-secondary" style="flex:1;" onclick="editItem('${item.id}')">Edit</button>
          <button class="btn btn-danger" onclick="deleteRecord('items', '${item.id}')">Delete</button>
        </div>
      </div>
    `;

    posItemsGrid.innerHTML += `
      <div class="card" style="${stock <= 0 ? 'opacity:0.4; pointer-events:none;' : ''}" onclick="addToCart('${item.id}')">
        <img class="card-avatar" style="border-radius:12px;" src="${img}">
        <h3>${item.name}</h3>
        <div class="badge-points">${item.cost} Points</div>
        <p style="font-size:0.7rem; color:var(--text-muted);">${stock <= 0 ? 'Out of Stock' : stock + ' available'}</p>
      </div>
    `;
  });
});

onSnapshot(purchasesRef, (snapshot) => {
  const tbody = document.getElementById('history-tbody');
  tbody.innerHTML = '';
  snapshot.forEach(docSnap => {
    const r = { id: docSnap.id, ...docSnap.data() };
    const dateStr = r.timestamp ? new Date(r.timestamp.toDate()).toLocaleString() : 'Recent';
    
    tbody.innerHTML += `
      <tr>
        <td style="font-family:monospace; font-size:0.75rem;">${r.id.substring(0,8)}</td>
        <td>${dateStr}</td>
        <td>${r.playerName}</td>
        <td>${r.itemNames.join(', ')}</td>
        <td>${r.totalPoints} pts</td>
        <td><span style="color:${r.returned ? 'var(--accent-red)' : 'var(--accent-green)'}">${r.returned ? 'Returned' : 'Paid'}</span></td>
        <td>
          ${!r.returned ? `<button class="btn btn-secondary" style="padding:4px 10px; font-size:0.75rem;" onclick="returnPurchase('${r.id}', '${r.playerId}', ${r.totalPoints})">Return</button>` : '—'}
        </td>
      </tr>
    `;
  });
});

// OPEN ACCOUNT TERMINAL DIRECT ACTION
window.openPlayerAccountTerminal = (playerId) => {
  document.getElementById('pos-player-select').value = playerId;
  switchTab('pos');
  renderCart();
};

window.syncCartUser = () => renderCart();

// CART POS ENGINE
window.addToCart = (itemId) => {
  const item = itemsData.find(i => i.id === itemId);
  if (!item) return;

  const existing = cart.find(c => c.id === itemId);
  if (existing) {
    if (existing.qty + 1 > (item.stock || 99)) return alert("Not enough stock!");
    existing.qty += 1;
  } else {
    cart.push({ ...item, qty: 1 });
  }
  renderCart();
};

window.updateQty = (itemId, delta) => {
  const target = cart.find(c => c.id === itemId);
  if (!target) return;
  target.qty += delta;
  if (target.qty <= 0) cart = cart.filter(c => c.id !== itemId);
  renderCart();
};

window.clearCart = () => { cart = []; renderCart(); };
window.applyDiscount = (rate) => { activeDiscount = rate; renderCart(); };

function renderCart() {
  const list = document.getElementById('cart-items-list');
  const playerId = document.getElementById('pos-player-select').value;
  const player = playersData.find(p => p.id === playerId);

  if (cart.length === 0) {
    list.innerHTML = `<div class="empty-state">${player ? 'Cart is empty for ' + player.firstName : 'Select an account to load cart'}</div>`;
  } else {
    list.innerHTML = '';
    cart.forEach(c => {
      list.innerHTML += `
        <div class="cart-item-row">
          <div>
            <div style="font-weight:700;">${c.name}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">${c.cost} pts each</div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <button class="item-qty-btn" onclick="updateQty('${c.id}', -1)">-</button>
            <span style="font-weight:700;">${c.qty}</span>
            <button class="item-qty-btn" onclick="updateQty('${c.id}', 1)">+</button>
          </div>
        </div>
      `;
    });
  }

  const subtotal = cart.reduce((sum, item) => sum + (item.cost * item.qty), 0);
  const discountVal = Math.round(subtotal * activeDiscount);
  const total = subtotal - discountVal;

  document.getElementById('cart-subtotal').innerText = `${subtotal} Points`;
  document.getElementById('cart-discount').innerText = `-${discountVal} Points`;
  document.getElementById('cart-total').innerText = `${total} Points`;
}

window.checkoutCart = async () => {
  const playerId = document.getElementById('pos-player-select').value;
  if (!playerId) return alert("Select an account first!");
  if (cart.length === 0) return alert("Cart is empty!");

  const player = playersData.find(p => p.id === playerId);
  const subtotal = cart.reduce((sum, item) => sum + (item.cost * item.qty), 0);
  const totalDue = subtotal - Math.round(subtotal * activeDiscount);

  if (player.points < totalDue) return alert(`Insufficient points balance (${player.points} available)`);

  // Deduct Player Balance
  await updateDoc(doc(db, "players", playerId), { points: player.points - totalDue });

  // Update Stock Quantities
  for (const item of cart) {
    const realItem = itemsData.find(i => i.id === item.id);
    if (realItem && realItem.stock !== undefined) {
      await updateDoc(doc(db, "items", item.id), { stock: Math.max(0, realItem.stock - item.qty) });
    }
  }

  // Create Transaction
  const txRef = await addDoc(purchasesRef, {
    playerId: player.id,
    playerName: `${player.firstName} ${player.lastName}`,
    itemNames: cart.map(i => `${i.name} (x${i.qty})`),
    totalPoints: totalDue,
    returned: false,
    timestamp: serverTimestamp()
  });

  // Display Receipt Modal
  document.getElementById('receipt-tx-id').innerText = `Tx Hash: ${txRef.id}`;
  document.getElementById('receipt-details').innerHTML = `
    <p><strong>Member:</strong> ${player.firstName} ${player.lastName}</p>
    <p><strong>Items:</strong> ${cart.map(i => `${i.name} x${i.qty}`).join(', ')}</p>
    <p><strong>Points Spent:</strong> ${totalDue} pts</p>
    <p><strong>Remaining Balance:</strong> ${player.points - totalDue} pts</p>
  `;
  openModal('receipt-modal');

  cart = [];
  renderCart();
};

window.returnPurchase = async (purchaseId, playerId, pointsToRefund) => {
  if (!confirm("Confirm refund for this order?")) return;
  const player = playersData.find(p => p.id === playerId);
  
  if (player) {
    await updateDoc(doc(db, "players", playerId), { points: player.points + pointsToRefund });
  }
  await updateDoc(doc(db, "purchases", purchaseId), { returned: true });
};

// MODAL EDIT HELPERS
window.modifyModalPoints = (amount) => {
  const input = document.getElementById('player-points');
  input.value = Math.max(0, parseInt(input.value || 0, 10) + amount);
};

window.editPlayer = (id) => {
  const p = playersData.find(x => x.id === id);
  if (!p) return;
  document.getElementById('player-id').value = p.id;
  document.getElementById('player-firstname').value = p.firstName;
  document.getElementById('player-lastname').value = p.lastName;
  document.getElementById('player-points').value = p.points;
  document.getElementById('quick-adjusters').style.display = 'flex';
  document.getElementById('player-modal-title').innerText = "Edit Member Account";
  openModal('player-modal');
};

window.editItem = (id) => {
  const item = itemsData.find(x => x.id === id);
  if (!item) return;
  document.getElementById('item-id').value = item.id;
  document.getElementById('item-name').value = item.name;
  document.getElementById('item-cost').value = item.cost;
  document.getElementById('item-stock').value = item.stock !== undefined ? item.stock : 99;
  document.getElementById('item-modal-title').innerText = "Edit Catalog Item";
  openModal('item-modal');
};

// GREEN SCREEN REMOVAL CANVAS TOOL
function processGreenScreen(file, removeBG) {
  return new Promise((resolve) => {
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      if (!removeBG) return resolve(e.target.result);
      const img = new Image();
      img.onload = () => {
        const canvas = document.getElementById('chroma-canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width; canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i+1] > 90 && d[i+1] > d[i] * 1.35 && d[i+1] > d[i+2] * 1.35) {
            d[i + 3] = 0;
          }
        }
        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL());
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// SAVE HANDLERS
document.getElementById('player-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('player-id').value;
  const firstName = document.getElementById('player-firstname').value;
  const lastName = document.getElementById('player-lastname').value;
  const points = parseInt(document.getElementById('player-points').value, 10);
  const file = document.getElementById('player-image').files[0];
  const removeBG = document.getElementById('player-green-screen').checked;

  const image = await processGreenScreen(file, removeBG);
  const payload = { firstName, lastName, points };
  if (image) payload.image = image;

  if (id) {
    await updateDoc(doc(db, "players", id), payload);
  } else {
    payload.createdAt = serverTimestamp();
    await addDoc(playersRef, payload);
  }
  closeModal('player-modal');
});

document.getElementById('item-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('item-id').value;
  const name = document.getElementById('item-name').value;
  const cost = parseInt(document.getElementById('item-cost').value, 10);
  const stock = parseInt(document.getElementById('item-stock').value, 10);
  const file = document.getElementById('item-image').files[0];
  const removeBG = document.getElementById('item-green-screen').checked;

  const image = await processGreenScreen(file, removeBG);
  const payload = { name, cost, stock };
  if (image) payload.image = image;

  if (id) {
    await updateDoc(doc(db, "items", id), payload);
  } else {
    await addDoc(itemsRef, payload);
  }
  closeModal('item-modal');
});

// UTILS & MODALS
window.previewFile = (input, labelId) => {
  if (input.files && input.files[0]) {
    document.getElementById(labelId).innerText = `Selected: ${input.files[0].name}`;
  }
};

window.deleteRecord = async (col, id) => {
  if (confirm("Delete this entry permanently?")) await deleteDoc(doc(db, col, id));
};

window.openPlayerModal = () => {
  document.getElementById('quick-adjusters').style.display = 'none';
  document.getElementById('player-modal-title').innerText = "Create Account";
  openModal('player-modal');
};

window.openItemModal = () => {
  document.getElementById('item-modal-title').innerText = "Add Reward Item";
  openModal('item-modal');
};

window.openModal = (id) => document.getElementById(id).classList.add('active');
window.closeModal = (id) => {
  document.getElementById(id).classList.remove('active');
  const form = document.getElementById(id).querySelector('form');
  if(form) form.reset();
  document.getElementById('player-id').value = '';
  document.getElementById('item-id').value = '';
};