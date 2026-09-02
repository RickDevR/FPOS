import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, onValue, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyAIRH-6mmznVMfGIegHF7ckQXq30MFDDBw",
  authDomain: "hockey-840dd.firebaseapp.com",
  databaseURL: "https://hockey-840dd-default-rtdb.firebaseio.com",
  projectId: "hockey-840dd",
  storageBucket: "hockey-840dd.firebasestorage.app",
  messagingSenderId: "454222626197",
  appId: "1:454222626197:web:6df5eea83d3bbae0df0a9c",
  measurementId: "G-BBNC63SFHZ"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const storage = getStorage(app);

let allVersionsData = {};

// Initialize and Listen for Realtime Database Updates
const updatesRef = ref(db, 'app_updates');
onValue(updatesRef, (snapshot) => {
  const data = snapshot.val();
  allVersionsData = data || {};
  renderTable(allVersionsData);
  updateActiveBadge(allVersionsData);
});

// Render Published Versions Table
function renderTable(data) {
  const tbody = document.getElementById('versionsTableBody');
  if (!data || Object.keys(data).length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-500">No update builds published yet.</td></tr>';
    return;
  }

  const keys = Object.keys(data).reverse();
  tbody.innerHTML = keys.map(versionKey => {
    const item = data[versionKey];
    const isActive = item.isActive === true;
    
    return `
      <tr class="hover:bg-slate-800/50 transition">
        <td class="p-3 font-bold text-amber-400 font-mono">v${item.version}</td>
        <td class="p-3">
          ${isActive 
            ? '<span class="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full">ACTIVE</span>' 
            : '<span class="px-2 py-0.5 text-[10px] font-bold bg-slate-800 text-slate-400 rounded-full">INACTIVE</span>'}
        </td>
        <td class="p-3 text-slate-300 max-w-xs truncate">${item.notes || '-'}</td>
        <td class="p-3 font-mono text-slate-400 text-[11px]">${item.fileName}</td>
        <td class="p-3">
          ${!isActive 
            ? `<button onclick="window.setActiveVersion('${versionKey}')" class="px-3 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-lg transition">Set Active Target</button>`
            : '<span class="text-xs text-emerald-400 font-semibold">Active Release</span>'}
        </td>
      </tr>
    `;
  }).join('');
}

// Update Active Version UI Element
function updateActiveBadge(data) {
  let activeVersion = "None";
  for (const key in data) {
    if (data[key].isActive) {
      activeVersion = `v${data[key].version}`;
      break;
    }
  }
  document.getElementById('activeVersionText').textContent = activeVersion;
}

// Set Active Release Target
window.setActiveVersion = function(targetKey) {
  const updates = {};
  for (const key in allVersionsData) {
    updates[`app_updates/${key}/isActive`] = (key === targetKey);
  }
  update(ref(db), updates)
    .then(() => alert(`Active target version updated!`))
    .catch((err) => alert(`Error: ${err.message}`));
};

// Handle Binary Upload Form Submission
document.getElementById('uploadForm').addEventListener('submit', (e) => {
  e.preventDefault();
  
  const version = document.getElementById('inputVersion').value.trim();
  const notes = document.getElementById('inputNotes').value.trim();
  const file = document.getElementById('inputFile').files[0];
  const makeActive = document.getElementById('checkSetActive').checked;

  if (!version || !file) {
    alert("Please enter a version string and attach a file.");
    return;
  }

  const versionKey = version.replace(/\./g, '_');
  const fileStorageRef = storageRef(storage, `updates/${versionKey}/${file.name}`);
  const uploadTask = uploadBytesResumable(fileStorageRef, file);

  const progressContainer = document.getElementById('progressContainer');
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
  progressContainer.classList.remove('hidden');

  uploadTask.on('state_changed', 
    (snapshot) => {
      const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
      progressBar.style.width = `${progress}%`;
      progressText.textContent = `${Math.round(progress)}%`;
    }, 
    (error) => {
      alert(`Upload Failed: ${error.message}`);
      progressContainer.classList.add('hidden');
    }, 
    async () => {
      const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
      
      const updates = {};
      if (makeActive) {
        for (const key in allVersionsData) {
          updates[`app_updates/${key}/isActive`] = false;
        }
      }

      updates[`app_updates/${versionKey}`] = {
        version: version,
        notes: notes,
        fileName: file.name,
        downloadUrl: downloadURL,
        isActive: makeActive,
        uploadedAt: new Date().toISOString()
      };

      await update(ref(db), updates);

      progressContainer.classList.add('hidden');
      document.getElementById('uploadForm').reset();
      alert(`Version v${version} published successfully!`);
    }
  );
});