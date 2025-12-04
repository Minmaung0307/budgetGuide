// --- FIREBASE CONFIG (REPLACE YOURS) ---
const firebaseConfig = {
  apiKey: "AIzaSyB2ifrMAX8E0xzyEDxUDqeeCB7lTWTDpM8",
  authDomain: "budgetguide.firebaseapp.com",
  projectId: "budgetguide",
  storageBucket: "budgetguide.firebasestorage.app",
  messagingSenderId: "840243615240",
  appId: "1:840243615240:web:12cffb4a5bbf46ea48e3bd",
  measurementId: "G-1CXX2EJJMF",
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
let currentUser = null;
let currentMonth = new Date().toISOString().slice(0, 7);

// --- AUTH ---
function signIn() {
    auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(e => alert(e.message));
}
function logout() { auth.signOut(); location.reload(); }

auth.onAuthStateChanged(user => {
    if(user) {
        currentUser = user;
        document.getElementById('authScreen').classList.remove('active');
        document.getElementById('appScreen').classList.add('active');
        document.getElementById('monthPicker').value = currentMonth;
        loadData(); 
        filterDataByMonth(); 
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

// --- DATA & MONTHLY FILTER ---
function loadData() {
    db.collection('subscriptions').where('uid', '==', currentUser.uid).onSnapshot(snap => {
        const list = document.getElementById('subList');
        list.innerHTML = '';
        snap.forEach(doc => {
            const d = doc.data();
            const div = document.createElement('div');
            div.className = 'sub-item';
            div.innerHTML = `
                <div><b>${d.name}</b><br><small>Due Day: ${d.day}</small></div>
                <div style="text-align:right; display:flex; align-items:center; gap:10px;">
                    <div style="color:#d63031; font-weight:bold;">-$${d.cost}</div>
                    <small onclick="openEditSub('${doc.id}', '${d.name}', '${d.cost}', '${d.day}')" style="color:#2563EB; cursor:pointer;"><i class="fas fa-pen"></i></small>
                    <small onclick="deleteItem('subscriptions', '${doc.id}')" style="color:#888; cursor:pointer;"><i class="fas fa-trash"></i></small>
                </div>`;
            list.appendChild(div);
        });
    });
}

function filterDataByMonth() {
    currentMonth = document.getElementById('monthPicker').value;
    const startStr = currentMonth + "-01";
    const endStr = currentMonth + "-31";

    db.collection('transactions')
      .where('uid', '==', currentUser.uid)
      .where('date', '>=', startStr)
      .where('date', '<=', endStr)
      .orderBy('date', 'desc')
      .get()
      .then(snap => {
          let mInc = 0;
          let mExp = 0;
          const list = document.getElementById('transList');
          list.innerHTML = '';

          if(snap.empty) list.innerHTML = `<div style="text-align:center; padding:20px; color:#888;">No transactions</div>`;

          snap.forEach(doc => {
              const d = doc.data();
              if (d.type === 'income') mInc += d.amount;
              else mExp += d.amount;

              const div = document.createElement('div');
              div.className = `trans-item ${d.type}`;
              div.innerHTML = `
                <div style="flex:1;"><b>${d.note}</b><br><small>${d.date}</small></div>
                <div style="text-align:right; display:flex; align-items:center; gap:10px;">
                    <div style="font-weight:bold;">${d.type==='income'?'+':'-'}$${d.amount}</div>
                    <small onclick="openEditTrans('${doc.id}', '${d.type}', '${d.amount}', '${d.note}', '${d.date}')" style="color:#2563EB; cursor:pointer;"><i class="fas fa-pen"></i></small>
                    <small onclick="deleteItem('transactions', '${doc.id}')" style="color:#888; cursor:pointer;"><i class="fas fa-trash"></i></small>
                </div>`;
              list.appendChild(div);
          });

          db.collection('subscriptions').where('uid', '==', currentUser.uid).get().then(subSnap => {
              let subTotal = 0;
              subSnap.forEach(doc => subTotal += doc.data().cost);
              
              document.getElementById('incDisplay').innerText = `$${mInc.toFixed(2)}`;
              const totalExp = mExp + subTotal;
              document.getElementById('expDisplay').innerText = `$${totalExp.toFixed(2)}`;
              const net = mInc - totalExp;
              const balanceEl = document.getElementById('totalBalance');
              balanceEl.innerText = `$${net.toFixed(2)}`;
              balanceEl.style.color = net >= 0 ? "#10B981" : "#EF4444";
          });
      });
}

// --- YEARLY SUMMARY LOGIC (NEW) ---
function openYearModal() {
    document.getElementById('yearModal').style.display = 'flex';
    calculateYearly();
}

function calculateYearly() {
    const year = document.getElementById('yearSelect').value;
    const startStr = year + "-01-01";
    const endStr = year + "-12-31";

    // 1. Get Transactions for whole year
    db.collection('transactions')
      .where('uid', '==', currentUser.uid)
      .where('date', '>=', startStr)
      .where('date', '<=', endStr)
      .get()
      .then(snap => {
          let yInc = 0;
          let yExp = 0;

          snap.forEach(doc => {
              const d = doc.data();
              if (d.type === 'income') yInc += d.amount;
              else yExp += d.amount;
          });

          // 2. Get Subscriptions (Multiply by 12 for yearly projection)
          db.collection('subscriptions').where('uid', '==', currentUser.uid).get().then(subSnap => {
              let subTotal = 0;
              subSnap.forEach(doc => subTotal += doc.data().cost);
              const yearlySubTotal = subTotal * 12;

              const totalYearExp = yExp + yearlySubTotal;
              const net = yInc - totalYearExp;

              document.getElementById('yearInc').innerText = `$${yInc.toFixed(2)}`;
              document.getElementById('yearExp').innerText = `$${totalYearExp.toFixed(2)}`;
              
              const netEl = document.getElementById('yearNet');
              netEl.innerText = `$${net.toFixed(2)}`;
              netEl.style.color = net >= 0 ? "#10B981" : "#EF4444";
          });
      });
}

// --- MODAL & SAVE ACTIONS ---
function openTransModal(type) {
    document.getElementById('editTransId').value = "";
    document.getElementById('transType').value = type;
    document.getElementById('transTitle').innerText = type === 'income' ? 'Add Income 💰' : 'Add Expense 💸';
    document.getElementById('transAmount').value = "";
    document.getElementById('transNote').value = "";
    document.getElementById('transDate').valueAsDate = new Date();
    document.getElementById('transModal').style.display = 'flex';
}

function openEditTrans(id, type, amount, note, date) {
    document.getElementById('editTransId').value = id;
    document.getElementById('transType').value = type;
    document.getElementById('transTitle').innerText = "Edit Transaction";
    document.getElementById('transAmount').value = amount;
    document.getElementById('transNote').value = note;
    document.getElementById('transDate').value = date;
    document.getElementById('transModal').style.display = 'flex';
}

function saveTransaction() {
    const id = document.getElementById('editTransId').value;
    const type = document.getElementById('transType').value;
    const amount = parseFloat(document.getElementById('transAmount').value);
    const note = document.getElementById('transNote').value;
    const date = document.getElementById('transDate').value;

    if(!amount || !date) return alert("Please fill details");
    const data = { uid: currentUser.uid, type, amount, note, date, created: Date.now() };

    if (id) {
        db.collection('transactions').doc(id).update(data).then(() => { closeModal('transModal'); filterDataByMonth(); });
    } else {
        db.collection('transactions').add(data).then(() => { closeModal('transModal'); filterDataByMonth(); });
    }
}

function openSubModal() { 
    document.getElementById('editSubId').value = ""; 
    document.getElementById('subTitle').innerText = "Add Subscription";
    document.getElementById('subName').value = "";
    document.getElementById('subCost').value = "";
    document.getElementById('subDay').value = "";
    document.getElementById('subModal').style.display = 'flex'; 
}

function openEditSub(id, name, cost, day) {
    document.getElementById('editSubId').value = id;
    document.getElementById('subTitle').innerText = "Edit Subscription";
    document.getElementById('subName').value = name;
    document.getElementById('subCost').value = cost;
    document.getElementById('subDay').value = day;
    document.getElementById('subModal').style.display = 'flex';
}

function saveSub() {
    const id = document.getElementById('editSubId').value;
    const name = document.getElementById('subName').value;
    const cost = parseFloat(document.getElementById('subCost').value);
    const day = document.getElementById('subDay').value;

    if(!name || !cost) return alert("Please fill details");
    const data = { uid: currentUser.uid, name, cost, day, created: Date.now() };

    if (id) {
        db.collection('subscriptions').doc(id).update(data).then(() => { closeModal('subModal'); filterDataByMonth(); });
    } else {
        db.collection('subscriptions').add(data).then(() => { closeModal('subModal'); filterDataByMonth(); });
    }
}

function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function deleteItem(col, id) { if(confirm("Delete this item?")) db.collection(col).doc(id).delete().then(() => filterDataByMonth()); }

// --- DETAILED GUIDES CONTENT (Updated) ---
const guidesData = {
    id: `
        <h4>1. Social Security Number (SSN)</h4>
        <p>SSN မရှိလျှင် အမေရိကမှာ အလုပ်လုပ်လို့မရ၊ ဘဏ်ဖွင့်မရ၊ Credit ဆောက်မရပါ။ ရောက်ပြီး ၁၀ ရက်လောက်နေရင် သွားလုပ်လို့ရပါပြီ။</p>
        <ul>
            <li><b>လိုအပ်သောစာရွက်များ:</b> Passport, I-94 (အွန်လိုင်းမှ print ထုတ်ပါ), Visa။</li>
            <li><b>နေရာ:</b> Google Maps တွင် "Social Security Administration Office" ဟုရှာပြီး နီးစပ်ရာသွားပါ။</li>
            <li>စာတိုက်မှ ကဒ်ရောက်လာရန် ၂ ပတ်ခန့် ကြာတတ်သည်။</li>
        </ul>
        
        <h4>2. State ID / Driver License</h4>
        <p>Passport ကို နေ့တိုင်းမကိုင်ပါနှင့်။ ပျောက်လျှင် ဒုက္ခများပါမည်။ ထို့ကြောင့် State ID လုပ်ထားပါ။</p>
        <ul>
            <li><b>နေရာ:</b> DMV (Department of Motor Vehicles) သို့မဟုတ် BMV ရုံး။</li>
            <li><b>လိုအပ်ချက်:</b> "6 Points ID" စနစ်သုံးလေ့ရှိသည်။ (Passport, SSN Card, I-94) + အိမ်လိပ်စာပါသော စာရွက် ၂ ခု (ဥပမာ- ဘဏ်စာရွက်၊ အိမ်ငှားစာချုပ်)။</li>
        </ul>
    `,
    driving: `
        <h4>ယာဉ်မောင်းလိုင်စင် လျှောက်ခြင်း</h4>
        <p>ကားမောင်းတတ်မှ အလုပ်သွားလာရ လွယ်ကူပါမည်။ အဆင့် ၃ ဆင့် ရှိပါသည်။</p>
        
        <b>အဆင့် ၁: စာမေးပွဲ (Knowledge Test)</b>
        <ul>
            <li>သက်ဆိုင်ရာ ပြည်နယ် DMV ဝက်ဘ်ဆိုက်တွင် Driver's Manual စာအုပ်ကို ဒေါင်းလုဒ်ဆွဲပြီး ဖတ်ပါ။</li>
            <li>အမှတ်အသားများ (Signs) နှင့် စည်းကမ်းများကို ဖြေဆိုရမည်။</li>
            <li>ကွန်ပျူတာဖြင့်ဖြေရပြီး ချက်ချင်းအဖြေသိရသည်။ (တချို့ပြည်နယ်တွင် မြန်မာဘာသာဖြင့် ဖြေဆိုခွင့်ရှိသည်)။</li>
        </ul>

        <b>အဆင့် ၂: သင်မောင်းလိုင်စင် (Permit)</b>
        <ul>
            <li>စာမေးပွဲအောင်လျှင် Permit ရမည်။</li>
            <li>တစ်ယောက်တည်းမောင်းခွင့်မရှိ။ လိုင်စင်ကြီးရှိသူ တစ်ဦး ဘေးခုံတွင် လိုက်ပါရမည်။</li>
        </ul>

        <b>အဆင့် ၃: လက်တွေ့မောင်း (Road Test)</b>
        <ul>
            <li>ကိုယ့်ကားဖြင့် သွားရောက်ဖြေဆိုရမည်။ ကားမီး၊ ဘရိတ် အကုန်ကောင်းမွန်ရမည်။</li>
            <li>Parallel Parking (ကားနှစ်စီးကြားထိုးခြင်း) ကို သေချာလေ့ကျင့်ထားပါ။</li>
            <li>အောင်မြင်ပါက ယာယီလိုင်စင်ချက်ချင်းရပြီး ကဒ်အစစ် အိမ်သို့ပို့ပေးမည်။</li>
        </ul>
    `,
    housing: `
        <h4>အိမ်ငှားခြင်း (Renting)</h4>
        <p>အမေရိကမှာ အိမ်ငှားရတာ မလွယ်ကူပါ။ အောက်ပါအချက်များ ပြင်ဆင်ထားပါ:</p>
        <ul>
            <li><b>Credit Score:</b> 650 အထက်ရှိမှ အိမ်ရှင်တွေ ကြိုက်သည်။ အသစ်ရောက်သူများ Credit မရှိသေးလျှင် (Co-signer) အာမခံသူ ရှာရတတ်သည်။</li>
            <li><b>Proof of Income:</b> လစာသည် အိမ်လခ၏ ၃ ဆ ရှိကြောင်း ပြရမည် (Paystubs ပြရသည်)။</li>
            <li><b>Deposit:</b> ပုံမှန်အားဖြင့် ၁ လစာ စပေါ်ငွေ တင်ရသည်။</li>
            <li><b>Lease Agreement:</b> စာချုပ်ကို သေချာဖတ်ပါ။ စာချုပ်မပြည့်ခင် ထွက်လျှင် ဒဏ်ကြေးဆောင်ရသည်။</li>
        </ul>

        <h4>အိမ်ဝယ်ခြင်း (Buying)</h4>
        <ul>
            <li><b>Downpayment:</b> အိမ်တန်ဖိုး၏ 3% မှ 20% လက်ငင်းပေးရသည်။ (20% ပေးလျှင် လစဉ်ကြေး သက်သာသည်)။</li>
            <li><b>Closing Cost:</b> အိမ်ဝယ်စရိတ် (ရှေ့နေခ၊ စစ်ဆေးခ) သည် အိမ်တန်ဖိုး၏ 2-5% ထပ်ကုန်နိုင်သည်။</li>
            <li><b>Realtor:</b> ဝယ်သူဘက်မှ အိမ်ပွဲစားခ ပေးစရာမလိုပါ။ (ရောင်းသူက ပေးရသည်)။ ထို့ကြောင့် Realtor ခေါ်ပြီး ဝယ်တာ ပိုစိတ်ချရသည်။</li>
        </ul>
    `,
    car: `
        <h4>ကားဝယ်နည်း (Car Buying)</h4>
        <p>ကားမရှိလျှင် ခြေပြတ်သကဲ့သို့ ဖြစ်နေပါလိမ့်မည်။</p>
        
        <b>၁။ Dealer ဆီမှ ဝယ်ခြင်း (Used/New)</b>
        <ul>
            <li><b>အားသာချက်:</b> စာရွက်စာတမ်း အရှုပ်အရှင်းကင်းသည်။ အာမခံ (Warranty) ပါတတ်သည်။</li>
            <li><b>အားနည်းချက်:</b> ဈေးကြီးသည်။ Dealer Fee တွေ ပေါင်းထည့်တတ်သည်။</li>
        </ul>

        <b>၂။ Private Seller (Facebook Marketplace)</b>
        <ul>
            <li><b>အားသာချက်:</b> ဈေးသက်သာသည်။ ညှိနှိုင်းရလွယ်သည်။</li>
            <li><b>သတိပြုရန်:</b> ကားအင်ဂျင်မကောင်းလျှင် ပြန်ပြောဖို့ခက်သည်။ ကားဝပ်ရှော့ကျွမ်းကျင်သူနှင့် ပြပြီးမှ ဝယ်ပါ။ "Title" (ကားပိုင်ဆိုင်မှုစာရွက်) ရှင်းမရှင်း သေချာကြည့်ပါ။ Salvage Title (ကားပျက်ပြီး ပြန်ပြင်ထားသောကား) ဖြစ်နေလျှင် မဝယ်ပါနှင့်။</li>
        </ul>

        <b>၃။ အာမခံ (Car Insurance)</b>
        <ul>
            <li>ကားဝယ်ပြီးတာနဲ့ မောင်းမထွက်ခင် Insurance ချက်ချင်းဝယ်ရပါမယ်။ မပါရင် ရဲဖမ်းခံရနိုင်ပါသည်။</li>
            <li>Liability (သူများကို လျော်ပေးတာ) နဲ့ Full Coverage (ကိုယ့်ကားပါ လျော်ပေးတာ) ၂ မျိုးရှိသည်။</li>
        </ul>
    `,
    jobs: `
        <h4>အမေရိကတွင် အလုပ်ရှာဖွေခြင်း</h4>
        <p>အလုပ်အမျိုးအစားအလိုက် ရှာဖွေနည်း ကွာခြားပါသည်။ အရေးကြီးဆုံးမှာ SSN နှင့် Work Permit (EAD) သို့မဟုတ် Green Card ရှိရန် လိုပါသည်။</p>
        
        <hr>
        <b>၁။ စက်ရုံအလုပ် (Factory/Warehouse)</b>
        <ul>
            <li><b>အကောင်းဆုံးနည်း:</b> "Staffing Agency" (အလုပ်အကိုင်ရှာဖွေရေး အေဂျင်စီ) များကို သွားပါ။ သူတို့က အလုပ်ချက်ချင်း ရှာပေးတတ်သည်။ ပွဲခ ပေးစရာမလိုပါ။ (ကုမ္ပဏီက သူတို့ကို ပေးသည်)။</li>
            <li><b>ဘာလုပ်ရမလဲ:</b> Google Maps တွင် "Staffing Agency near me" ဟုရှာပြီး ရုံးခန်းသို့ လူကိုယ်တိုင်သွားလျှောက်ပါ။</li>
            <li><b>လစာ:</b> ပုံမှန်အားဖြင့် တစ်နာရီ $15 - $22 ဝန်းကျင် ရတတ်သည်။</li>
        </ul>

        <hr>
        <b>၂။ စားသောက်ဆိုင်/စူပါမားကတ် (Restaurant/Grocery)</b>
        <ul>
            <li><b>ရှာနည်း:</b> ဆိုင်တံခါးတွင် "Now Hiring" သို့မဟုတ် "Help Wanted" စာကပ်ထားလျှင် ချက်ချင်းဝင်မေးပါ။ Manager နှင့် တွေ့ခွင့်တောင်းပါ။</li>
            <li><b>Sushi/Asian Food:</b> မြန်မာ သို့မဟုတ် အာရှဆိုင်များတွင် အတွေ့အကြုံမရှိလည်း ခန့်လေ့ရှိသည်။ Facebook မြန်မာဂရုများတွင် ရှာပါ။</li>
            <li><b>Walmart/Target:</b> သူတို့၏ Website (Careers page) တွင် Online လျှောက်ရသည်။</li>
        </ul>

        <hr>
        <b>၃။ Software / IT / Engineer Jobs</b>
        <ul>
            <li><b>အဓိကနေရာ:</b> LinkedIn သည် အရေးကြီးဆုံးဖြစ်သည်။ Profile ကို သေသေချာချာ ပြင်ဆင်ထားပါ။</li>
            <li><b>ရှာဖွေရန် Website များ:</b> LinkedIn, Indeed, Glassdoor, Dice (IT only).</li>
            <li><b>ပြင်ဆင်ရန်:</b> Resume (ကိုယ်ရေးရာဇဝင်) ကို အမေရိကန်စတိုင်ဖြင့် ပြင်ဆင်ပါ။ Tech Interview များအတွက် LeetCode ကဲ့သို့သော website များတွင် လေ့ကျင့်ပါ။</li>
            <li><b>Networking:</b> သူငယ်ချင်းမိတ်ဆွေများ၏ ကုမ္ပဏီတွင် Referral ပေးခိုင်းခြင်းက အလုပ်ရရန် အလွယ်ဆုံးလမ်းဖြစ်သည်။</li>
        </ul>

        <hr>
        <b>၄။ အထွေထွေ အကြံပြုချက်များ</b>
        <ul>
            <li><b>Resume:</b> မည်သည့်အလုပ်လျှောက်လျှောက် Resume တစ်စောင် လိုအပ်သည်။ ရိုးရှင်းပြီး ရှင်းလင်းအောင် ရေးပါ။</li>
            <li><b>Interview:</b> အချိန်တိကျပါ (၅ မိနစ် ကြိုရောက်ပါ)။ သေသပ်စွာ ဝတ်စားပါ။</li>
            <li><b>Tax:</b> W2 (ကုမ္ပဏီဝန်ထမ်း) သို့မဟုတ် 1099 (Contractor) ခွဲခြားသိထားပါ။</li>
        </ul>
    `,
    uscis: `
        <h4>Citizenship (နိုင်ငံသားလျှောက်ခြင်း)</h4>
        <p>Green Card ရပြီး ၅ နှစ်ပြည့်လျှင် (သို့မဟုတ်) အမေရိကန်နိုင်ငံသားနှင့် လက်ထပ်ပြီး Green Card ရသူဖြစ်လျှင် ၃ နှစ်ပြည့်ပါက နိုင်ငံသားလျှောက်ခွင့်ရှိသည်။</p>
        <ul>
            <li><b>Form:</b> N-400 ဖောင်တင်ရမည်။</li>
            <li><b>English Test:</b> အခြေခံ အင်္ဂလိပ်စာ ဖတ်ခြင်း၊ ရေးခြင်း စစ်ဆေးသည်။</li>
            <li><b>Civics Test:</b> အမေရိကန် သမိုင်းနှင့် ဥပဒေဆိုင်ရာ မေးခွန်း ၁၀၀ ထဲမှ ၁၀ ခုမေးမည်။ ၆ ခုမှန်လျှင် အောင်သည်။</li>
            <li>အင်တာဗျူးအောင်ပြီးလျှင် "သစ္စာဆိုပွဲ (Oath Ceremony)" တက်ရောက်ပြီးမှ နိုင်ငံသားလက်မှတ် ရရှိမည်။</li>
        </ul>
    `,
    snap: `
        <h4>Food Stamps (SNAP)</h4>
        <p>ဝင်ငွေနည်းပါးသော မိသားစုများအတွက် အစိုးရမှ အစားအသောက်ဝယ်ရန် ထောက်ပံ့သော ကဒ် (EBT Card) ဖြစ်သည်။</p>
        <ul>
            <li><b>လျှောက်ရန်:</b> သက်ဆိုင်ရာပြည်နယ်၏ "Department of Human Services" ရုံးသို့ သွားရောက်လျှောက်ထားပါ။</li>
            <li><b>လိုအပ်ချက်:</b> ဝင်ငွေနည်းကြောင်း အထောက်အထား (Paystub), ဘဏ်စာရင်း, အိမ်လခစာချုပ်, ID, SSN။</li>
            <li><b>သုံးစွဲခြင်း:</b> Walmart, Costco အပါအဝင် ဆိုင်တော်တော်များများတွင် အစားအသောက် (ချက်ပြုတ်စားသောက်ရသော ပစ္စည်းများ) သာ ဝယ်ယူခွင့်ရှိသည်။ အရက်၊ ဆေးလိပ်၊ တစ်ရှူး၊ ဆပ်ပြာ ဝယ်မရပါ။</li>
            <li><b>သတိပြုရန်:</b> လိမ်လည်လျှောက်ထားခြင်း မပြုရ။ နောင်တွင် Immigration ကိစ္စများ၌ ပြဿနာရှိနိုင်သည်။</li>
        </ul>
    `,
    // ၁။ လူ့အခွင့်အရေးနှင့် ဥပဒေ
    rights: `
        <h4>အမေရိကန် ဥပဒေနှင့် လူ့အခွင့်အရေး</h4>
        <p>မိမိ၏ အခွင့်အရေးများကို သိထားမှ အနှိမ်ခံရခြင်းမှ ကာကွယ်နိုင်ပါမည်။</p>
        
        <hr>
        <b>၁။ လုပ်ငန်းခွင် အခွင့်အရေး</b>
        <ul>
            <li><b>Minimum Wage:</b> ပြည်နယ်အလိုက် သတ်မှတ်ထားသော အနိမ့်ဆုံးလုပ်ခ (ဥပမာ- တစ်နာရီ $10-$16) ရရှိရမည်။</li>
            <li><b>Overtime:</b> တစ်ပတ်လျှင် ၄၀ နာရီထက်ပိုလုပ်ပါက ပိုသောနာရီများအတွက် ၁.၅ ဆ (Time and a half) ရရှိရမည်။</li>
            <li><b>ခွဲခြားဆက်ဆံမှု:</b> လူမျိုး၊ ဘာသာ၊ အသားအရောင်၊ ကျား/မ ပေါ်မူတည်၍ ခွဲခြားဆက်ဆံခံရပါက တိုင်ကြားခွင့်ရှိသည်။</li>
        </ul>

        <hr>
        <b>၂။ ရဲတပ်ဖွဲ့နှင့် ဆက်ဆံခြင်း</b>
        <ul>
            <li>ရဲတားပါက လက်ကိုမြင်သာအောင်ထားပါ။ ရုတ်တရက် လှုပ်ရှားခြင်းမပြုပါနှင့်။</li>
            <li><b>အရေးကြီးသည်:</b> ရဲကို လာဘ်ထိုးရန် (ပိုက်ဆံပေးရန်) လုံးဝ မကြိုးစားပါနှင့်။ ချက်ချင်း အဖမ်းခံရပါလိမ့်မည်။</li>
            <li>မေးခွန်းမဖြေလိုပါက ရှေ့နေနှင့်မှ ပြောမည်ဟု ငြင်းဆိုခွင့် (Right to remain silent) ရှိသည်။</li>
        </ul>

        <hr>
        <b>၃။ အိမ်တွင်းအကြမ်းဖက်မှု (Domestic Violence)</b>
        <ul>
            <li>ဇနီးမောင်နှံ၊ သားသမီး ရိုက်နှက်ခြင်းသည် ကြီးလေးသော ရာဇဝတ်မှုဖြစ်သည်။ အိမ်နီးချင်းများက 911 ခေါ်တတ်သည်။</li>
        </ul>
    `,

    // ၂။ ဓလေ့စရိုက်နှင့် ယဉ်ကျေးမှု
    culture: `
        <h4>အမေရိကန် ဓလေ့စရိုက်များ (Culture)</h4>
        <p>မြန်မာပြည်နှင့်မတူသော အချက်များကို သိထားလျှင် ပေါင်းသင်းဆက်ဆံရ အဆင်ပြေပါမည်။</p>
        
        <hr>
        <b>၁။ Tipping (ဘောက်ဆူး ပေးခြင်း)</b>
        <ul>
            <li>ဆိုင်တွင်ထိုင်စားလျှင် စားပွဲထိုးကို မဖြစ်မနေ Tip ပေးရသည့် ဓလေ့ရှိသည်။ (လစာနည်းသောကြောင့် Tip ကို မှီခိုရသည်)။</li>
            <li><b>နှုန်းထား:</b> အစားအသောက်ဖိုး၏ 15% မှ 20% ပေးလေ့ရှိသည်။</li>
            <li>(Fast food ဆိုင်၊ ကိုယ်တိုင်ယူရသော ဆိုင်များတွင် မပေးလည်းရသည်)။</li>
        </ul>

        <hr>
        <b>၂။ Small Talk (ဟိုဒီမေးခြင်း)</b>
        <ul>
            <li>ဓာတ်လှေကားထဲတွင်ဖြစ်စေ၊ ငွေရှင်းကောင်တာတွင်ဖြစ်စေ သူစိမ်းများက "Hi, how are you?", "Nice weather" စသည်ဖြင့် နှုတ်ဆက်လေ့ရှိသည်။</li>
            <li>ဒါသည် ယဉ်ကျေးမှုအရ မေးခြင်းဖြစ်၍ ပြန်လည်ပြုံးပြ နှုတ်ဆက်သင့်သည်။</li>
        </ul>

        <hr>
        <b>၃။ Personal Space & Eye Contact</b>
        <ul>
            <li>စကားပြောလျှင် လူချင်း အရမ်းမကပ်ပါနှင့်။ လက်တစ်ကမ်းအကွာတွင် နေပါ။</li>
            <li>စကားပြောလျှင် မျက်လုံးကို ကြည့်ပြောခြင်းသည် ရိုးသားမှုပြယုဂ်ဖြစ်သည်။ ခေါင်းငုံ့နေလျှင် မရိုးသားဟု ထင်တတ်သည်။</li>
        </ul>

        <hr>
        <b>၄။ အချိန်တိကျခြင်း (Punctuality)</b>
        <ul>
            <li>ချိန်းထားသောအချိန်ထက် ၅ မိနစ်ခန့် စောရောက်ခြင်းသည် အကောင်းဆုံးဖြစ်သည်။ နောက်ကျခြင်းကို မကြိုက်ကြပါ။</li>
        </ul>
    `,

    // ၃။ အင်္ဂလိပ်စာ လေ့လာရန်
    english: `
        <h4>English ဘာသာစကား လေ့လာရန်</h4>
        <p>အလုပ်ကောင်းရရန်နှင့် နေ့စဉ်ဘဝ အဆင်ပြေရန် အင်္ဂလိပ်စာ မဖြစ်မနေ လိုအပ်ပါသည်။</p>
        
        <hr>
        <b>၁။ အခမဲ့ သင်တန်းများ (Free ESL Classes)</b>
        <ul>
            <li><b>Adult School:</b> မြို့တိုင်းလိုလိုတွင် လူကြီးများအတွက် အခမဲ့ ကျောင်းများရှိသည်။ Google တွင် "Free ESL classes near me" ဟု ရှာပါ။</li>
            <li><b>Public Library:</b> စာကြည့်တိုက်များတွင် အခမဲ့ စကားပြောဝိုင်းများ၊ သင်တန်းများ ရှိတတ်သည်။</li>
            <li><b>Community College:</b> Non-credit ESL တန်းများကို ဈေးသက်သက်သာသာ (သို့) အခမဲ့ တက်ရောက်နိုင်သည်။</li>
        </ul>

        <hr>
        <b>၂။ အသုံးဝင်သော Apps များ</b>
        <ul>
            <li><b>Duolingo:</b> အခြေခံကစပြီး ဂိမ်းကစားသလို လေ့လာနိုင်သည်။</li>
            <li><b>YouTube:</b> "English with Lucy", "BBC Learning English" တို့ကို ကြည့်ပါ။</li>
            <li><b>Google Translate:</b> စကားပြောလျှင် အသံဖလှယ်ပေးသည့် Conversation Mode သည် အလွန်အသုံးဝင်သည်။</li>
        </ul>

        <hr>
        <b>၃။ လေ့ကျင့်ရန် နည်းလမ်းများ</b>
        <ul>
            <li><b>Volunteer:</b> ပရဟိတ (Food bank, Church) များတွင် လုပ်အားပေးရင်း စကားပြောလေ့ကျင့်ပါ။</li>
            <li><b>TV/Movies:</b> အင်္ဂလိပ်စာတန်းထိုး (English Subtitles) ဖြင့် ကြည့်ပါ။</li>
            <li>အမှားပါမည်ကို မကြောက်ပါနှင့်။ သူတို့က နားလည်ပေးပါသည်။ ပြောမှသာ တိုးတက်ပါမည်။</li>
        </ul>
    `
};

function showGuide(key) {
    document.getElementById('guideTitle').innerText = key.toUpperCase();
    document.getElementById('guideContent').innerHTML = guidesData[key];
    document.getElementById('guideModal').style.display = 'flex';
}

function searchMap(query) {
    if(navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            const {latitude, longitude} = pos.coords;
            window.open(`https://www.google.com/maps/search/${encodeURIComponent(query)}/@${latitude},${longitude},13z`, '_blank');
        }, () => window.open(`https://www.google.com/maps/search/${encodeURIComponent(query)}`, '_blank'));
    } else {
        window.open(`https://www.google.com/maps/search/${encodeURIComponent(query)}`, '_blank');
    }
}