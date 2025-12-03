// --- FIREBASE CONFIG (REPLACE YOURS) ---
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "SENDER_ID",
    appId: "APP_ID"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
let currentUser = null;

// --- AUTH ---
function signIn() {
    auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(e => alert(e.message));
}
function logout() { auth.signOut(); }

auth.onAuthStateChanged(user => {
    if(user) {
        currentUser = user;
        document.getElementById('authScreen').classList.remove('active');
        document.getElementById('appScreen').classList.add('active');
        loadSubscriptions();
    } else {
        document.getElementById('authScreen').classList.add('active');
        document.getElementById('appScreen').classList.remove('active');
    }
});

// --- TABS ---
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    event.currentTarget.classList.add('active');
}

// --- SUBSCRIPTIONS ---
function openSubModal() { document.getElementById('subModal').style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

function saveSub() {
    const name = document.getElementById('subName').value;
    const cost = parseFloat(document.getElementById('subCost').value);
    const date = document.getElementById('subDate').value;

    if(!name || !cost) return alert("Please fill info");

    db.collection('subscriptions').add({
        uid: currentUser.uid, name, cost, date, created: Date.now()
    }).then(() => {
        closeModal('subModal');
        // Clear inputs
        document.getElementById('subName').value = '';
        document.getElementById('subCost').value = '';
    });
}

function loadSubscriptions() {
    db.collection('subscriptions').where('uid', '==', currentUser.uid).onSnapshot(snap => {
        const list = document.getElementById('subList');
        list.innerHTML = '';
        let total = 0;

        snap.forEach(doc => {
            const d = doc.data();
            total += d.cost;
            const div = document.createElement('div');
            div.className = 'sub-item';
            div.innerHTML = `
                <div>
                    <b>${d.name}</b><br>
                    <small>Due: ${d.date || 'Monthly'}</small>
                </div>
                <div style="text-align:right;">
                    <div style="color:#d63031; font-weight:bold;">-$${d.cost}</div>
                    <small onclick="deleteSub('${doc.id}')" style="color:red; cursor:pointer;">Cancel/Delete</small>
                </div>
            `;
            list.appendChild(div);
        });
        
        // Update Dashboard (Simplified for demo)
        document.getElementById('expDisplay').innerText = `$${total.toFixed(2)}`;
        document.getElementById('totalBalance').innerText = `-$${total.toFixed(2)}`;
    });
}

function deleteSub(id) {
    if(confirm("Stop tracking this subscription?")) db.collection('subscriptions').doc(id).delete();
}

// --- MAP SEARCH ---
function searchMap(query) {
    if(navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            // Open Google Maps with query near user location
            const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}/@${lat},${lon},13z`;
            window.open(url, '_blank');
        }, () => {
            // Fallback if no location permission
            window.open(`https://www.google.com/maps/search/${encodeURIComponent(query)}`, '_blank');
        });
    } else {
        window.open(`https://www.google.com/maps/search/${encodeURIComponent(query)}`, '_blank');
    }
}

// --- GUIDES CONTENT ---
const guidesData = {
    id: `
        <h4>1. Social Security Number (SSN)</h4>
        <p>အမေရိကရောက်ရောက်ချင်း အရေးအကြီးဆုံးပါ။ အလုပ်လုပ်ဖို့၊ ဘဏ်ဖွင့်ဖို့ လိုပါတယ်။</p>
        <ul><li>SSA ရုံးသို့ Passport, I-94, Visa ယူသွားပြီး လျှောက်ပါ။</li></ul>
        
        <h4>2. State ID / Driver License</h4>
        <p>Passport ကို နေ့တိုင်းမကိုင်ချင်ရင် State ID လုပ်ပါ။</p>
        <ul><li>DMV (Department of Motor Vehicles) မှာ လျှောက်ရပါမယ်။</li><li>လိပ်စာအထောက်အထား (Proof of Address) ၂ ခု လိုပါတယ်။</li></ul>
        
        <h4>3. EAD (Work Permit)</h4>
        <p>USCIS တွင် Form I-765 တင်ပြီး လျှောက်ရပါမယ်။</p>
    `,
    driving: `
        <h4>1. Knowledge Test (စာမေးပွဲ)</h4>
        <p>သက်ဆိုင်ရာပြည်နယ် DMV ဝက်ဘ်ဆိုက်တွင် Driver's Manual ဖတ်ပါ။ မြန်မာလိုမေးခွန်းများ တချို့ပြည်နယ်တွင် ရနိုင်ပါသည်။</p>
        
        <h4>2. Permit ရယူခြင်း</h4>
        <p>စာမေးပွဲအောင်ပါက ကားမောင်းသင်ရန် Permit ရပါမယ်။ (တစ်ယောက်တည်း မောင်းခွင့်မရှိပါ၊ လိုင်စင်ရှိသူဘေးမှာ ပါရမည်)။</p>
        
        <h4>3. Road Test (လက်တွေ့မောင်း)</h4>
        <p>ကားမောင်းကျွမ်းကျင်ပါက Road Test ဖြေဆိုပြီး လိုင်စင်ရယူနိုင်ပါသည်။</p>
    `,
    housing: `
        <h4>အိမ်ငှားခြင်း (Renting)</h4>
        <ul>
            <li><b>Credit Score:</b> အိမ်ရှင်အများစုက Credit ကောင်းမှ ငှားလေ့ရှိသည်။</li>
            <li><b>Lease:</b> စာချုပ်ကို သေချာဖတ်ပါ။ (၁ နှစ်ချုပ်လေ့ရှိသည်)။</li>
            <li><b>Deposit:</b> ၁ လစာ စပေါ်ငွေ တင်ရတတ်သည်။</li>
        </ul>
        <h4>အိမ်ဝယ်ခြင်း (Buying)</h4>
        <p>Downpayment (၂၀% ခန့်) နှင့် Credit Score 700+ ရှိလျှင် အတိုးနှုန်းသက်သာစွာဖြင့် ဝယ်ယူနိုင်ပါသည်။ Realtor (အိမ်ပွဲစား) ခေါ်ပါက ဝယ်သူဘက်မှ ပွဲခပေးစရာမလိုပါ။</p>
    `,
    car: `
        <h4>ကားဝယ်နည်း</h4>
        <ul>
            <li><b>Dealer:</b> ယုံကြည်စိတ်ချရသော်လည်း ဈေးပိုကြီးနိုင်သည် (အာမခံပါသည်)။</li>
            <li><b>Private Seller:</b> Facebook Marketplace/Craigslist မှ ဝယ်လျှင် ဈေးသက်သာသော်လည်း ကားအခြေအနေကို ကိုယ်တိုင်စစ်ရမည်။</li>
            <li><b>Insurance:</b> ကားဝယ်ပြီးတာနဲ့ အာမခံချက်ချင်းဝယ်ရပါမယ်။ မပါရင် တရားမဝင်ပါ။</li>
        </ul>
    `,
    uscis: `
        <h4>Citizenship Interview</h4>
        <p>Green Card ရပြီး ၅ နှစ် (သို့) အိမ်ထောင်ဖက်နိုင်ငံသားဖြစ်လျှင် ၃ နှစ်အကြာတွင် လျှောက်နိုင်သည်။</p>
        <ul>
            <li>Form N-400 တင်ရမည်။</li>
            <li>Civics Test (မေးခွန်း ၁၀၀ ထဲမှ ၁၀ ခုမေးမည်၊ ၆ ခုဖြေနိုင်ရမည်)။</li>
            <li>English Reading/Writing Test ဖြေရမည်။</li>
        </ul>
    `,
    snap: `
        <h4>Food Stamps (SNAP)</h4>
        <p>ဝင်ငွေနည်းပါးသော မိသားစုများအတွက် အစားအသောက်ထောက်ပံ့ကြေး ဖြစ်သည်။</p>
        <ul>
            <li>သက်ဆိုင်ရာပြည်နယ်၏ Human Services ရုံးတွင် လျှောက်ပါ။</li>
            <li>Green Card မရသေးသူများ (Asylum seekers) လည်း ပြည်နယ်အလိုက် ရနိုင်ချေရှိသည်။</li>
            <li>လိမ်လည်လျှောက်ထားခြင်း မပြုရ (Immigration တွင် ပြဿနာတက်နိုင်သည်)။</li>
        </ul>
    `
};

function showGuide(key) {
    document.getElementById('guideTitle').innerText = key.toUpperCase() + " GUIDE";
    document.getElementById('guideContent').innerHTML = guidesData[key];
    document.getElementById('guideModal').style.display = 'flex';
}