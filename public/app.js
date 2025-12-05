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
  auth
    .signInWithPopup(new firebase.auth.GoogleAuthProvider())
    .catch((e) => alert(e.message));
}
function logout() {
  auth.signOut();
  location.reload();
}

// --- AUTH STATE LISTENER (WHITELIST PROTECTION) ---
auth.onAuthStateChanged((user) => {
  if (user) {
    // Login ဝင်ဝင်ချင်း Loading ပြထားမယ် (Optional UX improvement)
    document.body.style.cursor = "wait";

    // Whitelist ထဲမှာ ဒီ Email ရှိမရှိ စစ်မယ်
    const userEmail = user.email;

    db.collection("whitelist")
      .doc(userEmail)
      .get()
      .then((doc) => {
        document.body.style.cursor = "default";

        if (doc.exists) {
          // (က) ခွင့်ပြုထားသူ ဖြစ်လျှင် -> App ကို ဖွင့်ပေးမယ်
          currentUser = user;
          document.getElementById("authScreen").classList.remove("active");
          document.getElementById("appScreen").classList.add("active");

          // Set Month & Load Data
          document.getElementById("monthPicker").value = currentMonth;
          loadData();
          filterDataByMonth();
        } else {
          // (ခ) ခွင့်မပြုထားသူ ဖြစ်လျှင် -> သတိပေးပြီး Logout လုပ်မယ်
          alert(
            "Access Denied!\nAdmin ခွင့်ပြုချက်မရသေးပါ။\n(Email: " +
              userEmail +
              ")"
          );
          auth.signOut(); // ချက်ချင်း ပြန်ထွက်
        }
      })
      .catch((error) => {
        console.error("Error checking whitelist:", error);
        alert("Connection Error or Permission Denied");
        auth.signOut();
      });
  } else {
    // Logout ဖြစ်နေရင် Login Screen ပြမယ်
    document.getElementById("authScreen").classList.add("active");
    document.getElementById("appScreen").classList.remove("active");
    currentUser = null;
    document.body.style.cursor = "default";
  }
});

// --- TABS ---
function switchTab(tabName) {
  document
    .querySelectorAll(".tab-content")
    .forEach((el) => el.classList.remove("active"));
  document.getElementById(`tab-${tabName}`).classList.add("active");
  document
    .querySelectorAll(".nav-item")
    .forEach((el) => el.classList.remove("active"));
  event.currentTarget.classList.add("active");
}

// --- NEW HELPER: GET ICON ---
function getCategoryIcon(cat) {
  const icons = {
    Food: "🍔",
    Rent: "🏠",
    Utilities: "💡",
    Transport: "🚗",
    Insurance: "🛡️",
    Shopping: "🛍️",
    Salary: "💰",
    Other: "📦",
  };
  return icons[cat] || "📝";
}

// --- UPDATED LOAD DATA (For Subscriptions) ---
function loadData() {
  // 1. Subscriptions Load
  db.collection("subscriptions")
    .where("uid", "==", currentUser.uid)
    .onSnapshot((snap) => {
      const list = document.getElementById("subList");
      list.innerHTML = "";

      // --- SHOW SAMPLE IF EMPTY ---
      if (snap.empty) {
        list.innerHTML = `
                <div style="text-align:center; padding:5px; color:#aaa; font-size:11px;">နမူနာ (Samples)</div>
                <!-- Sample 1 -->
                <div class="sub-card" style="opacity: 0.6; pointer-events: none;">
                    <div style="display:flex; justify-content:space-between;"><b>Netflix</b></div>
                    <div style="font-size:12px; color:#666; margin:3px 0;">Due: 15</div>
                    <div style="color:#d63031; font-weight:bold;">$15.99</div>
                </div>
                <!-- Sample 2 -->
                <div class="sub-card" style="opacity: 0.6; pointer-events: none;">
                    <div style="display:flex; justify-content:space-between;"><b>Gym</b></div>
                    <div style="font-size:12px; color:#666; margin:3px 0;">Due: 1</div>
                    <div style="color:#d63031; font-weight:bold;">$30.00</div>
                </div>
            `;
        // Don't return here so we can still calculate balance (which will be 0)
      } else {
        snap.forEach((doc) => {
          const d = doc.data();
          const div = document.createElement("div");
          div.className = "sub-card";
          div.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <b style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:85px;">${d.name}</b>
                        <div style="display:flex; gap:5px;">
                            <small onclick="openEditSub('${doc.id}', '${d.name}', '${d.cost}', '${d.day}')" style="color:#2563EB; cursor:pointer;"><i class="fas fa-pen"></i></small>
                            <small onclick="deleteItem('subscriptions', '${doc.id}')" style="color:#EF4444; cursor:pointer;"><i class="fas fa-trash"></i></small>
                        </div>
                    </div>
                    <div style="font-size:12px; color:#666; margin:3px 0;">Due: ${d.day}</div>
                    <div style="color:#d63031; font-weight:bold;">$${d.cost}</div>
                `;
          list.appendChild(div);
        });
      }
      filterDataByMonth(); // Recalculate balance
    });

  // 2. Transactions Load (Last 50)
  db.collection("transactions")
    .where("uid", "==", currentUser.uid)
    .orderBy("date", "desc")
    .limit(50)
    .onSnapshot((snap) => {
      const list = document.getElementById("transList");
      list.innerHTML = "";

      // --- SHOW SAMPLE IF EMPTY ---
      if (snap.empty) {
        list.innerHTML = `
                <div style="text-align:center; padding:10px; color:#aaa; font-size:11px;">နမူနာ (Samples)</div>
                
                <!-- Sample Income -->
                <div class="trans-item" style="opacity: 0.6; pointer-events: none;">
                    <div class="t-icon income">💰</div>
                    <div class="t-info">
                        <span class="t-title">Salary (လစာ)</span>
                        <span class="t-date">2025-01-01</span>
                    </div>
                    <div style="text-align:right;">
                        <div class="t-amount income">+$3000.00</div>
                    </div>
                </div>

                <!-- Sample Expense -->
                <div class="trans-item" style="opacity: 0.6; pointer-events: none;">
                    <div class="t-icon expense">🍔</div>
                    <div class="t-info">
                        <span class="t-title">Walmart / ဈေးဝယ်</span>
                        <span class="t-date">2025-01-02</span>
                    </div>
                    <div style="text-align:right;">
                        <div class="t-amount expense">-$150.00</div>
                    </div>
                </div>
             `;
      } else {
        snap.forEach((doc) => {
          const d = doc.data();
          const div = document.createElement("div");
          div.className = "trans-item";
          div.innerHTML = `
                    <div class="t-icon ${d.type}">${getCategoryIcon(
            d.category || "Other"
          )}</div>
                    <div class="t-info">
                        <span class="t-title">${d.note || d.category}</span>
                        <span class="t-date">${d.date}</span>
                    </div>
                    <div style="text-align:right;">
                        <div class="t-amount ${d.type}">${
            d.type === "income" ? "+" : "-"
          }$${d.amount}</div>
                        <div style="margin-top:5px;">
                            <small onclick="openEditTrans('${doc.id}', '${
            d.type
          }', '${d.amount}', '${d.note}', '${
            d.date
          }')" style="color:#2563EB; margin-right:8px; cursor:pointer;"><i class="fas fa-pen"></i></small>
                            <small onclick="deleteItem('transactions', '${
                              doc.id
                            }')" style="color:#888; cursor:pointer;"><i class="fas fa-trash"></i></small>
                        </div>
                    </div>`;
          list.appendChild(div);
        });
      }
    });
}

// --- UPDATED MONTHLY FILTER (For List, Balance & Budget Bar) ---
function filterDataByMonth() {
  currentMonth = document.getElementById("monthPicker").value;
  const startStr = currentMonth + "-01";
  const endStr = currentMonth + "-31";

  db.collection("transactions")
    .where("uid", "==", currentUser.uid)
    .where("date", ">=", startStr)
    .where("date", "<=", endStr)
    .orderBy("date", "desc")
    .get()
    .then((snap) => {
      let mInc = 0;
      let mExp = 0;
      const list = document.getElementById("transList");
      list.innerHTML = "";

      if (snap.empty)
        list.innerHTML = `<div style="text-align:center; padding:20px; color:#888;">No transactions</div>`;

      snap.forEach((doc) => {
        const d = doc.data();
        if (d.type === "income") mInc += d.amount;
        else mExp += d.amount;

        // NEW: Better List Design with Icons
        const div = document.createElement("div");
        div.className = "trans-item";
        div.innerHTML = `
                <div class="t-icon ${d.type}">${getCategoryIcon(
          d.category || "Other"
        )}</div>
                <div class="t-info">
                    <span class="t-title">${d.note || d.category}</span>
                    <span class="t-date">${d.date}</span>
                </div>
                <div style="text-align:right;">
                    <div class="t-amount ${d.type}">${
          d.type === "income" ? "+" : "-"
        }$${d.amount}</div>
                    <div style="margin-top:5px;">
                        <small onclick="openEditTrans('${doc.id}', '${
          d.type
        }', '${d.amount}', '${d.note}', '${
          d.date
        }')" style="color:#2563EB; margin-right:8px;"><i class="fas fa-pen"></i></small>
                        <small onclick="deleteItem('transactions', '${
                          doc.id
                        }')" style="color:#888;"><i class="fas fa-trash"></i></small>
                    </div>
                </div>`;
        list.appendChild(div);
      });

      // Calculate with Subscriptions
      db.collection("subscriptions")
        .where("uid", "==", currentUser.uid)
        .get()
        .then((subSnap) => {
          let subTotal = 0;
          subSnap.forEach((doc) => (subTotal += doc.data().cost));

          const totalExp = mExp + subTotal;
          const net = mInc - totalExp;

          // 1. Update Cards
          document.getElementById("incDisplay").innerText = `$${mInc.toFixed(
            2
          )}`;
          document.getElementById(
            "expDisplay"
          ).innerText = `$${totalExp.toFixed(2)}`;
          document.getElementById("totalBalance").innerText = `$${net.toFixed(
            2
          )}`;

          // 2. Update Budget Health Bar
          // Logic: If Income is 0, bar is 100% red. Else, calculate % of income spent.
          const bar = document.getElementById("progressBar");
          const percentText = document.getElementById("budgetPercent");

          if (mInc === 0 && totalExp > 0) {
            bar.style.width = "100%";
            bar.style.backgroundColor = "#EF4444"; // Red
            percentText.innerText = "Over Budget";
          } else if (mInc === 0) {
            bar.style.width = "0%";
            percentText.innerText = "0%";
          } else {
            let percent = (totalExp / mInc) * 100;
            if (percent > 100) percent = 100; // Cap at 100 visually

            bar.style.width = `${percent}%`;
            percentText.innerText = `${Math.round(percent)}%`;

            // Color changes based on health
            if (percent < 50) bar.style.backgroundColor = "#10B981"; // Green
            else if (percent < 80)
              bar.style.backgroundColor = "#F59E0B"; // Orange
            else bar.style.backgroundColor = "#EF4444"; // Red
          }
        });
    });
}

// --- YEARLY SUMMARY LOGIC (NEW) ---
function openYearModal() {
  document.getElementById("yearModal").style.display = "flex";
  calculateYearly();
}

function calculateYearly() {
  const year = document.getElementById("yearSelect").value;
  const startStr = year + "-01-01";
  const endStr = year + "-12-31";

  // 1. Get Transactions for whole year
  db.collection("transactions")
    .where("uid", "==", currentUser.uid)
    .where("date", ">=", startStr)
    .where("date", "<=", endStr)
    .get()
    .then((snap) => {
      let yInc = 0;
      let yExp = 0;

      snap.forEach((doc) => {
        const d = doc.data();
        if (d.type === "income") yInc += d.amount;
        else yExp += d.amount;
      });

      // 2. Get Subscriptions (Multiply by 12 for yearly projection)
      db.collection("subscriptions")
        .where("uid", "==", currentUser.uid)
        .get()
        .then((subSnap) => {
          let subTotal = 0;
          subSnap.forEach((doc) => (subTotal += doc.data().cost));
          const yearlySubTotal = subTotal * 12;

          const totalYearExp = yExp + yearlySubTotal;
          const net = yInc - totalYearExp;

          document.getElementById("yearInc").innerText = `$${yInc.toFixed(2)}`;
          document.getElementById(
            "yearExp"
          ).innerText = `$${totalYearExp.toFixed(2)}`;

          const netEl = document.getElementById("yearNet");
          netEl.innerText = `$${net.toFixed(2)}`;
          netEl.style.color = net >= 0 ? "#10B981" : "#EF4444";
        });
    });
}

// --- MODAL & SAVE ACTIONS ---
function openTransModal(type) {
  document.getElementById("editTransId").value = "";
  document.getElementById("transType").value = type;
  document.getElementById("transTitle").innerText =
    type === "income" ? "Add Income 💰" : "Add Expense 💸";
  document.getElementById("transAmount").value = "";
  document.getElementById("transNote").value = "";
  document.getElementById("transDate").valueAsDate = new Date();
  document.getElementById("transModal").style.display = "flex";
}

function openEditTrans(id, type, amount, note, date) {
  document.getElementById("editTransId").value = id;
  document.getElementById("transType").value = type;
  document.getElementById("transTitle").innerText = "Edit Transaction";
  document.getElementById("transAmount").value = amount;
  document.getElementById("transNote").value = note;
  document.getElementById("transDate").value = date;
  document.getElementById("transModal").style.display = "flex";
}

function saveTransaction() {
  const id = document.getElementById("editTransId").value;
  const type = document.getElementById("transType").value;
  const amount = parseFloat(document.getElementById("transAmount").value);
  const note = document.getElementById("transNote").value;
  const date = document.getElementById("transDate").value;

  if (!amount || !date) return alert("Please fill details");
  const data = {
    uid: currentUser.uid,
    type,
    amount,
    note,
    date,
    created: Date.now(),
  };

  if (id) {
    db.collection("transactions")
      .doc(id)
      .update(data)
      .then(() => {
        closeModal("transModal");
        filterDataByMonth();
      });
  } else {
    db.collection("transactions")
      .add(data)
      .then(() => {
        closeModal("transModal");
        filterDataByMonth();
      });
  }
}

function openSubModal() {
  document.getElementById("editSubId").value = "";
  document.getElementById("subTitle").innerText = "Add Subscription";
  document.getElementById("subName").value = "";
  document.getElementById("subCost").value = "";
  document.getElementById("subDay").value = "";
  document.getElementById("subModal").style.display = "flex";
}

function openEditSub(id, name, cost, day) {
  document.getElementById("editSubId").value = id;
  document.getElementById("subTitle").innerText = "Edit Subscription";
  document.getElementById("subName").value = name;
  document.getElementById("subCost").value = cost;
  document.getElementById("subDay").value = day;
  document.getElementById("subModal").style.display = "flex";
}

function saveSub() {
  const id = document.getElementById("editSubId").value;
  const name = document.getElementById("subName").value;
  const cost = parseFloat(document.getElementById("subCost").value);
  const day = document.getElementById("subDay").value;

  if (!name || !cost) return alert("Please fill details");
  const data = { uid: currentUser.uid, name, cost, day, created: Date.now() };

  if (id) {
    db.collection("subscriptions")
      .doc(id)
      .update(data)
      .then(() => {
        closeModal("subModal");
        filterDataByMonth();
      });
  } else {
    db.collection("subscriptions")
      .add(data)
      .then(() => {
        closeModal("subModal");
        filterDataByMonth();
      });
  }
}

function closeModal(id) {
  document.getElementById(id).style.display = "none";
}
function deleteItem(col, id) {
  if (confirm("Delete this item?"))
    db.collection(col)
      .doc(id)
      .delete()
      .then(() => filterDataByMonth());
}

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
    `,
  school: `
        <h4>🇺🇸 အမေရိကန် ပညာရေးစနစ် (K-12)</h4>
        <p>အမေရိကတွင် အစိုးရကျောင်း (Public School) များသည် အခမဲ့ဖြစ်သည်။ အသက် ၅ နှစ်မှ ၁၈ နှစ်အထိ မဖြစ်မနေ ကျောင်းတက်ရသည်။</p>
        
        <hr>
        <b>၁။ ကျောင်းအပ်နှံခြင်း (Enrollment)</b>
        <ul>
            <li><b>School District:</b> မိမိနေထိုင်ရာ မြို့နယ် (Zip code) ပေါ်မူတည်ပြီး တက်ရမည့်ကျောင်း သတ်မှတ်ထားသည်။ တခြားမြို့နယ် သွားတက်၍မရပါ။</li>
            <li><b>လိုအပ်သောစာရွက်များ:</b>
                <ul>
                    <li>ငှားရမ်းစာချုပ် (Lease Agreement) သို့မဟုတ် ရေမီးဘေလ် (လိပ်စာအတည်ပြုရန်)။</li>
                    <li>ကလေး၏ မွေးစာရင်း (Birth Certificate/Passport)။</li>
                    <li>ကာကွယ်ဆေး စာအုပ် (Immunization Records) - *ဒါမရှိရင် ကျောင်းလက်မခံပါ*။ (Health Department တွင် ဘာသာပြန်/ဆေးထိုး နိုင်သည်။)</li>
                </ul>
            </li>
        </ul>

        <hr>
        <b>၂။ ကျောင်းပြောင်းခြင်း (Transfer)</b>
        <ul>
            <li>အိမ်ပြောင်းလျှင် ကျောင်းပါ ပြောင်းရတတ်သည်။ ကျောင်းဟောင်းမှ "Transfer Packet" တောင်းယူပြီး ကျောင်းသစ်တွင် ပေးရမည်။</li>
        </ul>

        <hr>
        <b>၃။ အထူးအစီအစဉ်များ</b>
        <ul>
            <li><b>ESL (English as Second Language):</b> အင်္ဂလိပ်စကား မကျွမ်းကျင်သော ကလေးများအတွက် သီးသန့် အတန်းများရှိသည်။ အခမဲ့ဖြစ်သည်။</li>
            <li><b>School Bus:</b> ကျောင်းနှင့် အိမ်ဝေးလျှင် အဝါရောင်ကျောင်းကား အခမဲ့ စီးနိုင်သည်။</li>
            <li><b>Lunch:</b> ဝင်ငွေနည်းပါးလျှင် ကျောင်းတွင် အခမဲ့ (သို့) သက်သာသောနှုန်းဖြင့် နေ့လည်စာ လျှောက်ထားနိုင်သည်။</li>
        </ul>
    `,

  parenting: `
        <h4>👨‍👩‍👧‍👦 မိသားစု၊ ယဉ်ကျေးမှုနှင့် Culture Shock</h4>
        
        <div style="background:#ffebee; padding:10px; border-radius:5px; margin-bottom:15px; border-left: 4px solid red;">
            <b>⚠️ အထူးသတိပြုရန် (CPS)</b><br>
            အမေရိကတွင် ကလေးကို ရိုက်နှက်ဆုံးမခြင်း၊ အိမ်မှာ တစ်ယောက်တည်း ထားခဲ့ခြင်း (အသက် ၁၂ နှစ်အောက်) တို့သည် ဥပဒေနှင့် ငြိစွန်းပါသည်။ 
            ကျောင်းဆရာ/ဆရာမများက ကလေးတွင် ဒဏ်ရာတွေ့ပါက <b>Child Protective Services (CPS)</b> သို့ တိုင်ကြားရမည့် တာဝန်ရှိသည်။ မိဘနှင့် ကလေး ခွဲထားခံရနိုင်သည်။
        </div>

        <b>၁။ မိဘနှင့် သားသမီး ဆက်ဆံရေး</b>
        <ul>
            <li><b>အရှေ့တိုင်း:</b> မိဘစကား နားထောင်ခြင်း၊ ရိုသေခြင်းကို အဓိကထားသည်။</li>
            <li><b>အနောက်တိုင်း:</b> ကိုယ်ပိုင်လွတ်လပ်ခွင့် (Independence) နှင့် ကိုယ့်ယုံကြည်ချက်ကို ထုတ်ဖော်ပြောဆိုခြင်း (Critical Thinking) ကို ကျောင်းက သင်ပေးသည်။</li>
            <li><b>အကြံပြုချက်:</b> ကလေးက ပြန်ပြောလျှင် "ခွာပြဲသည်" ဟု မယူဆဘဲ သူတို့၏ အမြင်ကို နားထောင်ပေးပါ။ သူငယ်ချင်းလို ဆွေးနွေးသည့် ပုံစံဖြင့် ဆက်ဆံပါ။</li>
        </ul>

        <hr>
        <b>၂။ Culture Shock (အစားအသောက်/ကျန်းမာရေး)</b>
        <ul>
            <li><b>ကျန်းမာရေး:</b> မြန်မာပြည်လို ဖျားမှ ဆေးခန်းပြေးလို့ မရပါ။ Family Doctor (မိသားစုဆရာဝန်) ထံတွင် Appointment ယူရသည်။ အရေးပေါ်မှသာ ER သွားပါ။</li>
            <li><b>အစားအသောက်:</b> Portion (ပမာဏ) ကြီးသည်။ အချိုကဲသည်။ ကျောင်းမုန့်များတွင် Cheese နှင့် အဆီများတတ်သည်။ အိမ်တွင် ကျန်းမာရေးနှင့်ညီညွတ်အောင် ချက်ပြုတ်ကျွေးမွေးပါ။</li>
        </ul>

        <hr>
        <b>၃။ လူမှုဆက်ဆံရေး</b>
        <ul>
            <li><b>Privacy:</b> အမေရိကန်များသည် ကိုယ်ရေးကိုယ်တာကို အလွန်တန်ဖိုးထားသည်။ "လစာဘယ်လောက်ရလဲ"၊ "ဝလာတယ်နော်" စသည့် မေးခွန်းများကို ရှောင်ပါ။</li>
            <li><b>Eye Contact:</b> စကားပြောလျှင် မျက်လုံးချင်းဆုံ ကြည့်ခြင်းသည် ယုံကြည်မှုရှိခြင်း ဖြစ်သည်။ ခေါင်းငုံ့နေခြင်းသည် မရိုသေခြင်း မဟုတ်ဘဲ၊ မလုံခြုံဟု ထင်မြင်စေသည်။</li>
        </ul>
    `,
  tax_info: `
        <h4>🇺🇸 အခွန်စနစ် (Tax System)</h4>
        <p>အမေရိကတွင် ဧပြီလ ၁၅ ရက်နေ့သည် Tax Day ဖြစ်သည်။ အခွန်ဆောင်ခြင်းသည် ဥပဒေဖြစ်သည်။</p>
        
        <hr>
        <b>၁။ W2 နှင့် 1099 ကွာခြားချက်</b>
        <ul>
            <li><b>W-2 (ဝန်ထမ်း):</b> ကုမ္ပဏီက လစာထဲမှ အခွန်ကို ကြိုဖြတ်ထားပေးသည်။ နှစ်ကုန်လျှင် W-2 စာရွက်ပို့ပေးသည်။ အခွန်ပြန်ရ (Refund) နိုင်ချေများသည်။</li>
            <li><b>1099 (ကန်ထရိုက်/Uber/DoorDash):</b> ကုမ္ပဏီက အခွန်မဖြတ်ပေးပါ။ ရသမျှငွေ အကုန်ရသည်။ သို့သော် နှစ်ကုန်လျှင် မိမိဘာသာ အခွန်ပြန်ဆောင်ရသည်။ (ပိုက်ဆံကြိုစုထားဖို့ လိုသည်)။</li>
        </ul>

        <hr>
        <b>၂။ Tax Refund (အခွန်ပြန်ရခြင်း)</b>
        <ul>
            <li>အစိုးရက သတ်မှတ်ထားသည်ထက် ပိုဆောင်မိလျှင် ပြန်အမ်းငွေ ရတတ်သည်။</li>
            <li><b>Child Tax Credit:</b> ၁၇ နှစ်အောက် ကလေးရှိလျှင် တစ်ယောက်ကို $2,000 ခန့် အခွန်သက်သာခွင့် (သို့) ငွေပြန်ရနိုင်သည်။</li>
            <li><b>EITC:</b> ဝင်ငွေနည်းပါးသူများအတွက် အစိုးရမှ ထောက်ပံ့သော အခွန်အမ်းငွေဖြစ်သည်။</li>
        </ul>
    `,

  insurance_all: `
        <h4>🛡️ အာမခံ (Insurance) လက်စွဲ</h4>
        <p>အမေရိကတွင် "မဖြစ်မနေထားရမည့်အရာ" ဖြစ်သည်။ မရှိလျှင် ဒေဝါလီခံရနိုင်သည်။</p>
        
        <b>၁။ အရေးကြီး ဝေါဟာရများ</b>
        <ul>
            <li><b>Premium:</b> လစဉ် ပေးရသောကြေး။</li>
            <li><b>Deductible:</b> ပြဿနာဖြစ်လျှင် အာမခံက မလျော်ပေးခင် ကိုယ့်အိတ်စိုက် ပေးရမည့်ငွေ။ (Deductible များလျှင် လစဉ်ကြေး သက်သာသည်)။</li>
        </ul>

        <hr>
        <b>၂။ အမျိုးအစားများ</b>
        <ul>
            <li><b>Auto Insurance:</b> ကားတိုက်လျှင် သူများကို လျော်ပေးရန် (Liability) နှင့် ကိုယ့်ကား ပြင်ရန် (Full Coverage)။</li>
            <li><b>Home/Renters Insurance:</b> မီးလောင်၊ ရေကြီး၊ ခိုးခံရလျှင် ပစ္စည်းများအတွက် လျော်ကြေးရသည်။ အိမ်ငှားနေသူများ Renters Insurance ($15/လ ခန့်) ထားသင့်သည်။</li>
            <li><b>Life Insurance:</b> မိမိကွယ်လွန်လျှင် ကျန်ရစ်သူမိသားစု ဒုက္ခမရောက်အောင် ထားခြင်း။ (Term Life က ဈေးသက်သာသည်)။</li>
        </ul>

        <hr>
        <b>၃။ Insurance Claim (လျော်ကြေးတောင်းနည်း)</b>
        <ul>
            <li><b>ကားတိုက်လျှင်:</b> ဓာတ်ပုံရိုက်ပါ၊ ရဲခေါ်ပါ (Police Report ယူပါ)၊ တစ်ဖက်လူရဲ့ Insurance ကဒ်ကို ဓာတ်ပုံရိုက်ပါ။ ပြီးမှ ကိုယ့် Agent ကို ဖုန်းဆက်ပါ။</li>
            <li><b>အိမ်ကိစ္စ:</b> ပျက်စီးသွားသော ပစ္စည်းများကို ဓာတ်ပုံရိုက်ပြီး စာရင်းလုပ်ထားပါ။</li>
        </ul>
    `,

  retirement: `
        <h4>👴👵 အိုမင်းရေးရာနှင့် ပင်စင် (Retirement)</h4>
        <p>အမေရိကတွင် သားသမီးက ပြန်ကျွေးမွေးသော ဓလေ့နည်းပါးသဖြင့် ကိုယ့်အားကိုယ်ကိုးရန် ပြင်ဆင်ရမည်။</p>
        
        <b>၁။ Social Security (အစိုးရပင်စင်)</b>
        <ul>
            <li>အလုပ်လုပ်ပြီး အခွန်ဆောင်ခဲ့သူများ အသက် ၆၂ နှစ် (သို့) ၆၇ နှစ်တွင် စတင်ခံစားခွင့်ရှိသည်။</li>
            <li>၁၀ နှစ် (Credit 40) ပြည့်အောင် အခွန်ဆောင်ထားမှ ရရှိမည်။</li>
        </ul>

        <b>၂။ 401(k) နှင့် IRA (စုဘူး)</b>
        <ul>
            <li><b>401(k):</b> ကုမ္ပဏီက လုပ်ပေးသော စုငွေ။ တချို့ကုမ္ပဏီများက ကိုယ်ထည့်သလောက် ထပ်ဆောင်းထည့်ပေးသည် (Company Match - ဒါသည် အလကားရသော ပိုက်ဆံဖြစ်၍ ယူသင့်သည်)။</li>
            <li><b>IRA:</b> မိမိဘာသာ သီးသန့်ဖွင့်သော ပင်စင်စုငွေစာရင်း။</li>
        </ul>

        <b>၃။ နေထိုင်မှုပုံစံများ</b>
        <ul>
            <li><b>Independent Living:</b> ကျန်းမာနေသရွေ့ ကိုယ့်အိမ် (သို့) Senior Apartment တွင် နေထိုင်ခြင်း။</li>
            <li><b>Nursing Home:</b> ကျန်းမာရေးစောင့်ရှောက်မှု လိုအပ်လာလျှင် သွားရောက်နေထိုင်ခြင်း (ကုန်ကျစရိတ်ကြီးမားသဖြင့် Long-term care insurance ထားသင့်သည်)။</li>
        </ul>
    `,

  marriage: `
        <h4>💍 အိမ်ထောင်ပြုခြင်းနှင့် ဘဏ္ဍာရေး</h4>
        
        <b>၁။ ဥပဒေပိုင်းဆိုင်ရာ</b>
        <ul>
            <li><b>Marriage License:</b> လက်မထပ်မီ တရားရုံးတွင် လိုင်စင်အရင်လျှောက်ရသည်။</li>
            <li><b>Green Card:</b> နိုင်ငံသားနှင့် လက်ထပ်လျှင် Green Card လျှောက်ခွင့်ရှိသည်။ (အိမ်ထောင်ရေး အစစ်ဖြစ်ကြောင်း သက်သေပြရမည်)။</li>
        </ul>

        <b>၂။ ငွေကြေးဆိုင်ရာ အကျိုးကျေးဇူးများ</b>
        <ul>
            <li><b>Joint Tax Filing:</b> လင်မယား နှစ်ယောက်ပေါင်းပြီး အခွန်ဆောင်လျှင် (Married Filing Jointly) အခွန်သက်သာခွင့် ပိုရတတ်သည်။</li>
            <li><b>Health Insurance:</b> တစ်ယောက်က အလုပ်ကောင်းလျှင် ကျန်တစ်ယောက်ကိုပါ အာမခံထဲ ထည့်သွင်းနိုင်သည်။</li>
            <li><b>Bank Accounts:</b> Joint Account ဖွင့်ပြီး အိမ်လခ၊ စားစရိတ်များကို အတူမျှဝေသုံးစွဲနိုင်သည်။</li>
        </ul>

        <b>၃။ Prenuptial Agreement (Prenup)</b>
        <ul>
            <li>ကွာရှင်းခဲ့လျှင် ပိုင်ဆိုင်မှု မည်သို့ခွဲဝေမည်ကို ကြိုတင်သဘောတူညီသော စာချုပ်ဖြစ်သည်။ (ပိုင်ဆိုင်မှု ကွာခြားလွန်းသူများအတွက် အရေးကြီးသည်)။</li>
        </ul>
    `,
  credit: `
        <h4>💳 Credit Score (အကြွေးအမှတ်)</h4>
        <p>အမေရိကတွင် "Credit Score မရှိလျှင် လူရာမဝင်" ဟု ဆိုနိုင်ပါသည်။ အိမ်ငှား၊ ကားဝယ်၊ ဖုန်းလိုင်းလျှောက်လျှင် Credit စစ်သည်။</p>
        
        <b>၁။ Credit စတင်တည်ဆောက်နည်း</b>
        <ul>
            <li><b>Secured Credit Card:</b> ဘဏ်တွင် ကိုယ့်ပိုက်ဆံ $200/$500 ကာမ (Deposit) တင်ပြီး ကဒ်လျှောက်ပါ။ (Discover, Capital One တို့ လွယ်သည်)။</li>
            <li>၆ လခန့် ပုံမှန်သုံးပြီး ပုံမှန်ပြန်ဆပ်လျှင် ရိုးရိုးကဒ် ပြောင်းပေးပြီး Score တက်လာမည်။</li>
        </ul>

        <b>၂။ အမှတ်တက်အောင် ဘယ်လိုနေမလဲ</b>
        <ul>
            <li><b>On Time Payment:</b> လစဉ် ဘေလ်ကို ရက်မကျော်စေပါနှင့်။ (Auto Pay လုပ်ထားပါ)။</li>
            <li><b>Utilization:</b> ကဒ်ပါမစ်၏ 30% ထက်ကျော်ပြီး မသုံးပါနှင့်။ (ဥပမာ - $1000 ပါမစ်ရှိလျှင် $300 ထက်ပိုမသုံးပါနှင့်)။</li>
        </ul>
    `,

  scams: `
        <h4>⚠️ သတိထားရမည့် လိမ်နည်းများ (Scams)</h4>
        <p>အမေရိကတွင် Phone/Email မှတဆင့် လိမ်လည်မှု အလွန်များပါသည်။</p>
        
        <b>၁။ IRS / Social Security Scam</b>
        <ul>
            <li>"အခွန်မဆောင်လို့ ဖမ်းတော့မယ်"၊ "SSN အပိတ်ခံရမယ်" ဟု ဖုန်းဆက်ခြိမ်းခြောက်လျှင် <b>ချက်ချင်းဖုန်းချပါ</b>။</li>
            <li>အစိုးရဌာနများသည် ဖုန်းဆက်ပြီး ပိုက်ဆံ/Gift Card ဘယ်တော့မှ မတောင်းပါ။ စာတိုက်မှ စာပဲ ပို့ပါသည်။</li>
        </ul>

        <b>၂။ Job Offer Scam</b>
        <ul>
            <li>အိမ်ကနေလုပ်ရမယ်၊ တစ်နာရီ $50 ပေးမယ်၊ ဒါပေမယ့် ပစ္စည်းဖိုး Check လက်မှတ် အရင်သွင်းပေးမယ် ဆိုလျှင် လိမ်နည်းဖြစ်သည်။ (Check အတု ဖြစ်နေတတ်သည်)။</li>
        </ul>
    `,

  money_transfer: `
        <h4>💸 မြန်မာပြည် ငွေလွှဲခြင်း</h4>
        
        <b>၁။ တရားဝင် နည်းလမ်းများ</b>
        <ul>
            <li><b>Western Union / MoneyGram:</b> Walmart သို့မဟုတ် ဆိုင်များတွင် သွားလွှဲနိုင်သည်။ (Fee ပေးရသည်)။</li>
            <li><b>Remitly / Wise:</b> ဖုန်း App မှတဆင့် ဘဏ်အကောင့်ချိတ်ပြီး လွှဲနိုင်သည်။ (အိမ်အရောက်ပို့ စနစ်များလည်း ရှိသည်)။</li>
        </ul>

        <b>၂။ Hundi (ဟွန်ဒီ)</b>
        <ul>
            <li>မြန်မာအသိုင်းအဝိုင်းကြားတွင် အသုံးများသည်။ ယုံကြည်စိတ်ချရသူကို ရှာဖွေပြီး လွှဲနိုင်သည်။</li>
            <li>Facebook Group များတွင် မေးမြန်းစုံစမ်းနိုင်သည်။</li>
        </ul>
    `,

  travel_transport: `
        <h4>✈️ ခရီးသွားလာရေး (Transport)</h4>
        
        <b>၁။ လေယာဉ်စီးခြင်း (Domestic Flight)</b>
        <ul>
            <li>ID သို့မဟုတ် Passport မပါလျှင် စီးခွင့်မပြုပါ။ (Real ID လိုအပ်လာမည်)။</li>
            <li><b>TSA Rules:</b> လက်ဆွဲအိတ်ထဲတွင် အရည် (Liquid) 3.4oz (100ml) ထက်ပိုမထည့်ရ။ ဓား၊ ကပ်ကြေး မပါရ။</li>
        </ul>

        <b>၂။ အများပြည်သူသုံး ယာဉ်များ</b>
        <ul>
            <li><b>Uber / Lyft:</b> တက္ကစီခေါ်သည့် App များဖြစ်သည်။ ကားမရှိခင် အလွန်အသုံးဝင်သည်။</li>
            <li><b>Bus / Subway:</b> မြို့ကြီးများ (NY, SF) တွင် "Transit Card" ဝယ်ပြီး စီးရသည်။ Google Maps တွင် Bus လာမည့်အချိန်ကို ကြည့်နိုင်သည်။</li>
            <li><b>Amtrak / Greyhound:</b> မြို့နယ်ကျော် ခရီးသွားရန် ရထားနှင့် ဘတ်စ်ကားများ။</li>
        </ul>
    `,
  healthcare: `
        <h4>1. Medicaid (ဝင်ငွေနည်းသူများအတွက်)</h4>
        <p>အစိုးရမှ ထောက်ပံ့သော အခမဲ့ သို့မဟုတ် တန်ဖိုးနည်း ကျန်းမာရေးအာမခံဖြစ်သည်။</p>
        <ul>
            <li><b>ဘယ်သူတွေရနိုင်လဲ:</b> ဝင်ငွေနည်းသော မိသားစုများ၊ ကိုယ်ဝန်ဆောင်များ၊ ကလေးများ၊ မသန်စွမ်းသူများ။</li>
            <li><b>လျှောက်ရန်:</b> သက်ဆိုင်ရာပြည်နယ်၏ "Health Marketplace" (သို့) "Department of Human Services" တွင် လျှောက်ပါ။</li>
            <li><b>မှတ်ချက်:</b> ဆေးခန်းပြလျှင် ပိုက်ဆံမကုန်ပါ။</li>
        </ul>

        <hr>
        <h4>2. Medicare (သက်ကြီးရွယ်အိုများအတွက်)</h4>
        <p>အသက် ၆၅ နှစ်နှင့်အထက် လူကြီးများအတွက် Federal အစိုးရ အစီအစဉ်ဖြစ်သည်။</p>
        <ul>
            <li>အမေရိကတွင် ၁၀ နှစ်ခန့် အခွန်ဆောင်ထားသူများ ရရှိသည်။</li>
            <li>မသန်စွမ်းသူ (Disability) များလည်း ရနိုင်သည်။</li>
        </ul>

        <hr>
        <h4>3. Private Insurance (အလုပ်မှပေးသော အာမခံ)</h4>
        <p>ကုမ္ပဏီဝန်ထမ်းများသည် ကုမ္ပဏီမှပေးသော အာမခံကို ယူရလေ့ရှိသည်။ လစာထဲမှ တစ်စိတ်တစ်ပိုင်း ဖြတ်တောက်သည်။</p>
    `,

  urgent: `
        <h4>Urgent Care vs Emergency Room (ER)</h4>
        <p>အမေရိကတွင် ဆေးရုံမှားသွားလျှင် ဒေါ်လာ ထောင်ချီ ကုန်နိုင်သည်။</p>

        <div style="background:#e3f2fd; padding:10px; border-radius:5px; margin-bottom:10px;">
            <b>🏥 Urgent Care (သာမန် ဆေးခန်း)</b>
            <ul>
                <li><b>သွားသင့်သည့်အခြေအနေ:</b> ဖျားနာခြင်း၊ တုပ်ကွေး၊ အသေးစား ဓားရှခြင်း၊ အရိုးအက်ခြင်း၊ ယားနာ၊ ဗိုက်အောင့်ခြင်း။</li>
                <li><b>ကုန်ကျစရိတ်:</b> သက်သာသည်။ ($100 - $200 ဝန်းကျင်၊ အာမခံရှိရင် ပိုသက်သာ)။</li>
                <li>Appointment မလိုဘဲ ဝင်ပြနိုင်သည်။</li>
            </ul>
        </div>

        <div style="background:#ffebee; padding:10px; border-radius:5px;">
            <b>🚑 Emergency Room / ER (အရေးပေါ်ဌာန)</b>
            <ul>
                <li><b>သွားသင့်သည့်အခြေအနေ:</b> ရင်ဘတ်အောင့်ခြင်း (Heart attack)၊ လေဖြတ်ခြင်း (Stroke)၊ သွေးအလွန်အကျွံထွက်ခြင်း၊ သတိလစ်ခြင်း၊ အသက်ရှုမရခြင်း။</li>
                <li><b>ကုန်ကျစရိတ်:</b> အလွန်ကြီးသည်။ ($1,000 မှ $10,000 ကျော်ထိ ကျနိုင်သည်)။</li>
                <li>အသက်အန္တရာယ် စိုးရိမ်ရမှသာ သွားပါ။</li>
            </ul>
        </div>
    `,

  safety: `
        <h4>၁။ ရဲဌာန (Police Department)</h4>
        <ul>
            <li><b>Emergency (911):</b> လူသတ်မှု၊ ဓားပြတိုက်မှု၊ မီးလောင်မှု၊ အသက်အန္တရာယ်ရှိချိန်မှသာ ခေါ်ပါ။ မြန်မာလို စကားပြန်တောင်းဆိုနိုင်သည် ("Burmese Interpreter please" ဟုပြောပါ)။</li>
            <li><b>Non-Emergency (311):</b> ဆူညံမှု၊ လမ်းပိတ်မှု၊ ခွေးဟောင်သံ အနှောင့်အယှက်များအတွက် 311 ကိုခေါ်ပါ (သို့) Google တွင် "Non-emergency police number near me" ဟုရှာပါ။</li>
        </ul>

        <h4>၂။ အမျိုးသမီးရေးရာနှင့် အိမ်တွင်းအကြမ်းဖက်မှု</h4>
        <ul>
            <li>အိမ်တွင်းအကြမ်းဖက်ခံရပါက (Domestic Violence) ရဲတိုင်ခွင့်ရှိသည်။</li>
            <li><b>National Hotline:</b> 1-800-799-7233 (၂၄ နာရီ ခေါ်ဆိုနိုင်သည်)။</li>
            <li>Shelter (ခိုလှုံရာစခန်း) များတွင် အခမဲ့ နေထိုင်စားသောက်ခွင့် ပေးတတ်သည်။</li>
        </ul>

        <h4>၃။ တောရိုင်းတိရစ္ဆာန် ထိန်းသိမ်းရေး (Animal Control)</h4>
        <ul>
            <li>အိမ်ထဲသို့ မြွေ၊ ရက်ကွန်း (Raccoon)၊ တောခွေး ဝင်လာပါက ကိုယ်တိုင်မဖမ်းပါနှင့်။</li>
            <li>Google တွင် <b>"Animal Control near me"</b> ဟုရှာပြီး ဖုန်းဆက်ပါ။</li>
            <li>လမ်းဘေးခွေးလေခွေးလွင့် တွေ့လျှင်လည်း တိုင်ကြားနိုင်သည်။</li>
        </ul>
    `,
};

function showGuide(key) {
  document.getElementById("guideTitle").innerText = key.toUpperCase();
  document.getElementById("guideContent").innerHTML = guidesData[key];
  document.getElementById("guideModal").style.display = "flex";
}

function searchMap(query) {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        window.open(
          `https://www.google.com/maps/search/${encodeURIComponent(
            query
          )}/@${latitude},${longitude},13z`,
          "_blank"
        );
      },
      () =>
        window.open(
          `https://www.google.com/maps/search/${encodeURIComponent(query)}`,
          "_blank"
        )
    );
  } else {
    window.open(
      `https://www.google.com/maps/search/${encodeURIComponent(query)}`,
      "_blank"
    );
  }
}

// --- PWA SERVICE WORKER REGISTRATION ---
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./service-worker.js")
      .then((reg) => console.log("Service Worker registered", reg))
      .catch((err) => console.log("Service Worker failed", err));
  });
}

// --- PWA INSTALL LOGIC ---
let deferredPrompt;

// 1. Capture the install prompt
window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    console.log("Install prompt captured");
});

// 2. Install Function (Called by button)
async function installApp() {
    // Android / Chrome / Edge (Supported Browsers)
    if (deferredPrompt) {
        // Show the install prompt
        deferredPrompt.prompt();
        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        // We've used the prompt, can't use it again
        deferredPrompt = null;
    } 
    // iOS / Already Installed / Not Supported
    else {
        // ဖုန်းမှာ Hover မရလို့ နှိပ်ရင် စာပေါ်အောင် လုပ်မယ်
        const tip = document.querySelector('.install-tip');
        if (tip) {
            tip.classList.toggle('show-mobile');
            
            // ၃ စက္ကန့်နေရင် ပြန်ပျောက်မယ်
            setTimeout(() => {
                tip.classList.remove('show-mobile');
            }, 5000);
        } else {
            alert("To install:\n\niOS: Share -> Add to Home Screen\nAndroid: Menu -> Install App");
        }
    }
}