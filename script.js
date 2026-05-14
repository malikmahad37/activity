// Global Error Handler
window.onerror = function(msg, url, lineNo, columnNo, error) {
    console.error('Global Error:', msg, url, lineNo, error);
    // Don't alert for every small thing, but log to console
    return false;
};

// Initialize Supabase
const SUPABASE_URL = 'https://rmjulmgszlogdpclldhp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_pPcJqEpi7E6sigaCeV2JSQ_huoT_MRL';

let _supabase = null;
function getClient() {
    if (_supabase) return _supabase;
    if (window.supabase) {
        try {
            _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            console.log("Supabase client initialized.");
        } catch(e) {
            console.error("Supabase creation failed:", e);
        }
    }
    return _supabase;
}

class SupabaseDB {
    async get(table) {
        const client = getClient();
        if (!client) return [];
        try {
            const { data, error } = await client.from(table).select('*');
            if (error) throw error;
            return data || [];
        } catch(e) {
            console.error(`Get ${table} failed:`, e);
            return [];
        }
    }
    async insert(table, item) {
        const client = getClient();
        if (!client) return item;
        try {
            const { data, error } = await client.from(table).insert([item]).select();
            if (error) throw error;
            return data ? data[0] : item;
        } catch(e) {
            console.error(`Insert ${table} failed:`, e);
            return item;
        }
    }
    async getProfile() {
        const client = getClient();
        if (!client) {
            alert("Database not connected. Please check your internet or Supabase settings.");
            return null;
        }
        try {
            const { data, error } = await client.from('profiles').select('*').eq('id', 'ayesha').single();
            if (error) {
                console.warn("Profile fetch issue:", error);
                const def = { 
                    id: 'ayesha', xp: 0, points: 0, level: 1, streak: 0, 
                    lastLogin: null, lastJourneyDate: null, 
                    currentJourneyStep: 1, journeyData: {} 
                };
                // If not found, try to create it
                if (error.code === 'PGRST116' || (error.message && error.message.includes('found'))) {
                    console.log("Creating new profile...");
                    const { error: insErr } = await client.from('profiles').insert([def]);
                    if (insErr) console.error("Could not create profile:", insErr);
                }
                return def;
            }
            return data;
        } catch(e) {
            console.error("Profile exception:", e);
            return null;
        }
    }
    async setProfile(p) {
        const client = getClient();
        if (!client) return;
        const { error } = await client.from('profiles').update(p).eq('id', 'ayesha');
        if (error) console.error('Update profile failed:', error);
    }
    async clear() {
        const client = getClient();
        if (!client) return;
        const tables = ['activityLog', 'memories', 'blessings', 'dailyJourneys'];
        for (const t of tables) {
            await client.from(t).delete().neq('id', '0'); 
        }
        await this.setProfile({ 
            xp: 0, points: 0, level: 1, streak: 0, 
            lastLogin: null, lastJourneyDate: null, 
            currentJourneyStep: 1, journeyData: {} 
        });
    }
}

const db = new SupabaseDB();

const POINT_VALUES = {
    mood: 5, breathe: 10, mission: 20, journal: 15, photo: 10,
    old_memory: 20, blessing: 10, affirmation: 5, journey_complete: 50
};

const DATA = {
    missions: [
        "Kisi aesi cheez ki tasweer lein jo apko smile karwaye.",
        "Apne qareeb kisi phool ya poudhay ki tasweer lein.",
        "Apne baray mein 3 achi batein likhein.",
        "5 gehri saansein lein.",
        "Apne kamray ka ek chota sa kona saaf karein aur uski 'Pehle aur Baad' ki tasweer lein.",
        "Sukoon ke liye dua karein.",
        "10 minute ke liye overthinking se door rahein.",
        "Ghar par koi ek madadgaar kaam karein aur uski tasweer lein.",
        "Mustaqbil ka ek khawab likhein.",
        "Pani piyein aur 5 minute relax karein.",
        "Apni pasandeeda kitaab ya cheez ki tasweer lein.",
        "Khud se kahein 'Mujhe tum par fakhar hai'."
    ],
    affirmations: [
        "Aapka maazi aapki qadar tay nahi karta.", 
        "Aap theek ho rahi hain, tooti hui nahi.", 
        "Aap izzat, sukoon, aur narmi ki haqdar hain.", 
        "Ek bura waqt aapki poori zindagi nahi hai.", 
        "Aap jaisi hain, bilkul theek aur mukammal hain.", 
        "Aap apne waqt ke mutabiq aage barh rahi hain."
    ],
    activities: [
        "Is waqt asmaan ki tasweer lein.", 
        "Ek chota kona saaf karein.", 
        "Pura ek glass pani piyein.",
        "Ghar mein apne pasandeeda konay ki tasweer lein.", 
        "Kisi aur ke liye dua karein.",
        "Ghar par kisi ki madad karein.", 
        "Apne khane ya kisi healthy snack ki tasweer lein.",
        "5 minute dhoop mein baithein.", 
        "Kagaz par apna ek khawab likhein aur tasweer lein."
    ],
    quotes: {
        'Sad': "Udaas hona theek hai. Phool khilne ke liye barish zaroori hai.",
        'Lonely': "Aap kabhi akele nahi hain; Khuda hamesha aapke sath hai.",
        'Angry': "Lambi saans lein. Ghusse ko thanda hone dein. Aap control mein hain.",
        'Confused': "Waqt ke sath sab saaf ho jayega. Hausla rakhein.",
        'Peaceful': "Alhamdulillah is pur-sukoon lamhay ke liye.",
        'Happy': "Aapki khushi ek khoobsurat roshni hai. Isay mehsoos karein!",
        'Grateful': "Shukar guzari hi barkat ki chabi hai."
    }
};

const app = {
    state: { currentUser: null, journeyStep: 1, journeyData: {}, breatheTimer: null, tempImages: [] },

    async init() {
        console.log("App init...");
        this.setupEventListeners();
        this.checkAuth();
        await this.updateMainScreenState();
    },

    setupEventListeners() {
        const btnAyesha = document.getElementById('btnAyeshaLogin');
        if(btnAyesha) btnAyesha.onclick = async () => {
            btnAyesha.innerText = "Loading...";
            btnAyesha.disabled = true;
            try {
                await this.login('ayesha');
            } catch(e) {
                alert("Login failed: " + e.message);
                btnAyesha.innerText = "I am Ayesha";
                btnAyesha.disabled = false;
            }
        };
        
        const btnAdmin = document.getElementById('btnAdminLogin');
        if(btnAdmin) btnAdmin.onclick = () => {
            const u = document.getElementById('adminUsername').value;
            const p = document.getElementById('adminPassword').value;
            if(u === 'admin' && p === 'admin123') this.login('admin');
            else alert('Invalid admin credentials.');
        };

        const btnLogout = document.getElementById('btnLogout');
        if(btnLogout) btnLogout.onclick = () => this.logout();

        document.querySelectorAll('#journeyMoodGrid .mood-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                document.querySelectorAll('#journeyMoodGrid .mood-btn').forEach(b => b.classList.remove('selected'));
                e.currentTarget.classList.add('selected');
                this.state.journeyData.mood = e.currentTarget.getAttribute('data-mood');
                await this.logAction('mood', 'Mood Submitted', `Mood: ${this.state.journeyData.mood}`);
                await this.addPoints(POINT_VALUES.mood);
                document.getElementById('btnNext1')?.classList.remove('hidden');
            });
        });
    },

    checkAuth() {
        const session = sessionStorage.getItem('bloom_session');
        if(session) this.login(session);
        else {
            if (document.getElementById('adminAuthPanel')) {
                this.showPanel('adminAuthPanel');
            } else {
                this.showPanel('authPanel');
            }
        }
    },

    async login(role) {
        console.log("Logging in:", role);
        this.state.currentUser = role;
        sessionStorage.setItem('bloom_session', role);
        if(role === 'ayesha') {
            this.showPanel('userPanel');
            this.showScreen('welcomeScreen');
            await this.updateStats();
        } else {
            this.showPanel('adminPanel');
            await this.renderAdmin();
        }
    },

    logout() {
        sessionStorage.removeItem('bloom_session');
        window.location.reload();
    },

    showPanel(id) {
        document.querySelectorAll('.auth-wrapper, #userPanel, #adminPanel').forEach(p => p.classList.add('hidden'));
        document.getElementById(id)?.classList.remove('hidden');
    },

    async showScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        document.getElementById(id)?.classList.remove('hidden');
        if(id === 'memoryBookScreen') await this.renderMemoryBook();
        if(id === 'timelineScreen') await this.renderTimeline();
        if(id === 'dashboardScreen') await this.renderDashboard();
        if(id === 'logScreen') await this.renderLog();
    },

    async addPoints(pts) {
        const p = await db.getProfile();
        if(!p) return;
        p.points += pts;
        p.xp += pts;
        if(p.xp >= p.level * 200) { p.xp = 0; p.level++; alert(`🎉 Level Up! Level ${p.level}!`); }
        await db.setProfile(p);
        await this.updateStats();
    },

    async logAction(type, title, details) {
        const entry = { type, title, details, points: POINT_VALUES[type] || 0, date: new Date().toLocaleDateString(), time: new Date().toLocaleTimeString() };
        await db.insert('activityLog', entry);
    },

    async updateMainScreenState() {
        const p = await db.getProfile();
        if(!p) return;
        const today = new Date().toDateString();
        const btnStart = document.getElementById('btnMainStartJourney');
        const btnCont = document.getElementById('btnMainContinueJourney');
        const msgComp = document.getElementById('todayCompletedMsg');

        if(p.currentJourneyStep > 1) {
            btnStart?.classList.add('hidden');
            btnCont?.classList.remove('hidden');
        } else {
            if(btnStart) {
                btnStart.classList.remove('hidden');
                btnCont?.classList.add('hidden');
                if(p.lastJourneyDate === today) {
                    btnStart.innerText = "Start Another Journey 🌸";
                    if(msgComp) { msgComp.classList.remove('hidden'); msgComp.innerText = "Journey completed today! You can start another."; }
                }
            }
        }
    },

    async startJourney() {
        const p = await db.getProfile();
        if(!p) return;
        p.currentJourneyStep = 1; p.journeyData = {};
        await db.setProfile(p);
        this.state.journeyStep = 1; this.state.journeyData = {};
        await this.showScreen('journeyScreen');
        this.renderStep();
    },

    async continueJourney() {
        const p = await db.getProfile();
        if(!p) return;
        this.state.journeyStep = p.currentJourneyStep; this.state.journeyData = p.journeyData;
        await this.showScreen('journeyScreen');
        this.renderStep();
    },

    renderStep() {
        const s = this.state.journeyStep;
        document.querySelectorAll('.journey-step').forEach(step => step.classList.add('hidden'));
        document.getElementById(`step${s}`)?.classList.remove('hidden');
        const titleEl = document.getElementById('journeyTitle');
        if(titleEl) titleEl.innerText = `Step ${s}: ${this.getStepTitle(s)}`;
        const progEl = document.getElementById('journeyProgress');
        if(progEl) progEl.style.width = `${(s / 11) * 100}%`;

        if(s === 2) {
            const mood = this.state.journeyData.mood;
            const quoteEl = document.getElementById('journeyQuote');
            if(quoteEl) quoteEl.innerText = DATA.quotes[mood] || "Believe in yourself.";
        }
        if(s === 3) this.startBreatheExercise();
        if(s === 4) {
            const m = DATA.missions[Math.floor(Math.random() * DATA.missions.length)];
            const misEl = document.getElementById('journeyMissionText');
            if(misEl) misEl.innerText = m;
        }
        if(s === 9) {
            const a = DATA.activities[Math.floor(Math.random() * DATA.activities.length)];
            const actEl = document.getElementById('journeyActivityText');
            if(actEl) actEl.innerText = a;
        }
        this.checkStepCompletionUI();
    },

    getStepTitle(s) {
        return ["Mood", "Affirmation", "Breathe", "Mission", "Journal", "Photo", "Self Love", "Blessings", "Activity", "Memories", "Completion"][s-1];
    },

    checkStepCompletionUI() {
        const s = this.state.journeyStep; const d = this.state.journeyData;
        if(s === 1 && d.mood) document.getElementById('btnNext1')?.classList.remove('hidden');
        if(s === 4 && d.missionCompleted) document.getElementById('btnNext4')?.classList.remove('hidden');
        if(s === 5 && d.journal) document.getElementById('btnNext5')?.classList.remove('hidden');
        if(s === 6 && d.photo) document.getElementById('btnNext6')?.classList.remove('hidden');
        if(s === 7 && d.affirmationDone) document.getElementById('btnNext7')?.classList.remove('hidden');
        if(s === 8 && d.blessing) document.getElementById('btnNext8')?.classList.remove('hidden');
        if(s === 9 && d.activityDone) document.getElementById('btnNext9')?.classList.remove('hidden');
        if(s === 10 && d.oldMemoryDone) document.getElementById('btnNext10')?.classList.remove('hidden');
    },

    async nextStep() {
        if(this.state.journeyStep < 11) {
            this.state.journeyStep++;
            const p = await db.getProfile();
            if(!p) return;
            p.currentJourneyStep = this.state.journeyStep; p.journeyData = this.state.journeyData;
            await db.setProfile(p);
            this.renderStep();
        }
    },

    async prevStep() {
        if(this.state.journeyStep > 1) {
            this.state.journeyStep--;
            const p = await db.getProfile();
            if(p) {
                p.currentJourneyStep = this.state.journeyStep;
                await db.setProfile(p);
            }
            this.renderStep();
        }
    },

    skipBreathe() {
        if(this.state.breatheTimer) clearInterval(this.state.breatheTimer);
        document.getElementById('btnNext3')?.classList.remove('hidden');
        this.nextStep();
    },

    refreshTask(type) {
        if(type === 'mission') {
            const m = DATA.missions[Math.floor(Math.random() * DATA.missions.length)];
            const misEl = document.getElementById('journeyMissionText');
            if(misEl) misEl.innerText = m;
        } else if(type === 'activity') {
            const a = DATA.activities[Math.floor(Math.random() * DATA.activities.length)];
            const actEl = document.getElementById('journeyActivityText');
            if(actEl) actEl.innerText = a;
        }
    },

    async completeStepAction(type) {
        if(type === 'mission') {
            const notes = document.getElementById('missionNotesJ').value;
            const file = document.getElementById('missionPhotoJ').files[0];
            const missionText = document.getElementById('journeyMissionText').innerText;
            const finalize = async (photo = null) => {
                this.state.journeyData.mission = { text: missionText, notes, photo };
                this.state.journeyData.missionCompleted = true;
                await this.logAction('mission', 'Mission Done', missionText);
                await this.addPoints(POINT_VALUES.mission);
                document.getElementById('btnNext4')?.classList.remove('hidden');
                alert("Saved! ✨");
            };
            if(file) { const reader = new FileReader(); reader.onload = async (e) => await finalize(e.target.result); reader.readAsDataURL(file); }
            else await finalize();
        }
        if(type === 'journal') {
            this.state.journeyData.journal = { feeling: document.getElementById('jFeelingJ').value, reason: document.getElementById('jReasonJ').value, gratitude: document.getElementById('jGratitudeJ').value, improve: document.getElementById('jImproveJ').value };
            await this.logAction('journal', 'Journal Saved', 'Step 5');
            await this.addPoints(POINT_VALUES.journal);
            document.getElementById('btnNext5')?.classList.remove('hidden');
        }
        if(type === 'affirmation') { this.state.journeyData.affirmationDone = true; await this.logAction('affirmation', 'Affirmation Done', 'Step 7'); await this.addPoints(POINT_VALUES.affirmation); document.getElementById('btnNext7')?.classList.remove('hidden'); }
        if(type === 'blessing') {
            const b = document.getElementById('blessingJ').value; if(!b) return;
            this.state.journeyData.blessing = b; await this.logAction('blessing', 'Blessing Added', 'Step 8'); await this.addPoints(POINT_VALUES.blessing);
            await db.insert('blessings', { text: b }); document.getElementById('btnNext8')?.classList.remove('hidden');
        }
        if(type === 'activity') {
            const file = document.getElementById('activityPhotoJ').files[0];
            const activityText = document.getElementById('journeyActivityText').innerText;
            const finalize = async (photo = null) => {
                this.state.journeyData.activity = { text: activityText, photo };
                this.state.journeyData.activityDone = true;
                await this.logAction('activity', 'Activity Done', activityText);
                await this.addPoints(POINT_VALUES.breathe);
                document.getElementById('btnNext9')?.classList.remove('hidden');
            };
            if(file) { const reader = new FileReader(); reader.onload = async (e) => await finalize(e.target.result); reader.readAsDataURL(file); }
            else await finalize();
        }
        
        if(type === 'photo') {
            const file = document.getElementById('imgUploadJ').files[0];
            const caption = document.getElementById('imgCaptionJ').value;
            const finalize = async (photoData = null) => {
                this.state.journeyData.photo = { caption, photo: photoData };
                await this.logAction('photo', 'Daily Photo Saved', caption || 'No caption');
                await this.addPoints(POINT_VALUES.photo);
                document.getElementById('btnNext6')?.classList.remove('hidden');
            };
            if(file) { const reader = new FileReader(); reader.onload = async (e) => await finalize(e.target.result); reader.readAsDataURL(file); }
            else await finalize();
        }
        
        if(type === 'oldMemory') {
            const title = document.getElementById('omTitleJ').value || 'Memory';
            const desc = document.getElementById('omDescJ').value;
            const special = document.getElementById('omSpecialJ').value;
            const file = document.getElementById('omImageJ').files[0];
            const finalize = async (photoData = null) => {
                this.state.journeyData.oldMemoryDone = true;
                this.state.journeyData.oldMemory = { title, desc, special, photo: photoData };
                await this.logAction('old_memory', 'Memory Saved', title);
                await this.addPoints(POINT_VALUES.old_memory);
                
                const memoryEntry = {
                    title: title,
                    description: desc + (special ? `\nWhy it's special: ${special}` : ''),
                    date: new Date().toLocaleDateString(),
                    images: photoData ? [photoData] : []
                };
                await db.insert('memories', memoryEntry);
                
                document.getElementById('btnNext10')?.classList.remove('hidden');
            };
            if(file) { const reader = new FileReader(); reader.onload = async (e) => await finalize(e.target.result); reader.readAsDataURL(file); }
            else await finalize();
        }
    },

    async startBreatheExercise() {
        let sec = 60; const text = document.getElementById('journeyBreatheTimer'); const circle = document.getElementById('journeyBreatheCircle');
        if(this.state.breatheTimer) clearInterval(this.state.breatheTimer);
        this.state.breatheTimer = setInterval(async () => {
            sec--; if(text) text.innerText = `${sec} seconds`; if(circle) circle.innerText = sec % 8 < 4 ? "Inhale..." : "Exhale...";
            if(sec <= 0) { clearInterval(this.state.breatheTimer); await this.logAction('breathe', 'Breathe Done', 'Step 3'); await this.addPoints(POINT_VALUES.breathe); document.getElementById('btnNext3')?.classList.remove('hidden'); }
        }, 1000);
    },

    async finishJourney() {
        const p = await db.getProfile(); if(!p) return;
        const today = new Date().toDateString(); if(p.lastJourneyDate !== today) p.streak++;
        p.lastJourneyDate = today; p.currentJourneyStep = 1; await db.setProfile(p);
        await this.addPoints(POINT_VALUES.journey_complete);
        await db.insert('dailyJourneys', { date: p.lastJourneyDate, data: this.state.journeyData });
        await this.showScreen('welcomeScreen'); await this.updateMainScreenState();
    },

    async updateStats() {
        const p = await db.getProfile(); if(!p) return;
        ['uiLevel', 'dashLevel', 'adminLevel'].forEach(id => { const el = document.getElementById(id); if(el) el.innerText = p.level; });
        ['uiStreak', 'dashStreak', 'adminStreak'].forEach(id => { const el = document.getElementById(id); if(el) el.innerText = p.streak; });
        ['uiPoints', 'dashPoints', 'adminTotalPoints'].forEach(id => { const el = document.getElementById(id); if(el) el.innerText = p.points; });
        const bar = document.getElementById('uiXpBar'); if(bar) bar.style.width = `${(p.xp / (p.level * 200)) * 100}%`;
    },

    async renderAdmin() {
        try {
            const p = await db.getProfile(); 
            if(!p) return;
            
            await this.updateStats();
            
            // 1. Logs
            const logs = await db.get('activityLog');
            if (logs.length === 0) {
                alert("Database connected, but 0 logs found. Are you sure data was saved?");
            }
            logs.reverse();
            const tbodyL = document.querySelector('#adminLogTable tbody');
            if(tbodyL) tbodyL.innerHTML = logs.map(l => `<tr><td>${l.date} ${l.time}</td><td>${l.title}</td><td>${l.details}</td><td>${l.points}</td></tr>`).join('');
            
            // 2. Daily Journeys
            const journeys = await db.get('dailyJourneys');
            const dailyReport = document.getElementById('adminDailyReportList');
            if(dailyReport) {
                dailyReport.innerHTML = journeys.length === 0 ? '<p>No journeys completed yet.</p>' : journeys.map(j => {
                    const d = j.data || {};
                    
                    let imgsHtml = '';
                    if(d.mission && d.mission.photo) imgsHtml += `<img src="${d.mission.photo}" class="zoomable-img" onclick="app.openImageModal(this.src, 'Mission Photo - ${j.date}')" style="width:100px; height:100px; object-fit:cover; border-radius:10px; border: 1px solid #eee;">`;
                    if(d.activity && d.activity.photo) imgsHtml += `<img src="${d.activity.photo}" class="zoomable-img" onclick="app.openImageModal(this.src, 'Activity Photo - ${j.date}')" style="width:100px; height:100px; object-fit:cover; border-radius:10px; border: 1px solid #eee;">`;
                    if(d.photo && d.photo.photo) imgsHtml += `<img src="${d.photo.photo}" class="zoomable-img" onclick="app.openImageModal(this.src, '${d.photo.caption || 'Daily Photo'} - ${j.date}')" style="width:100px; height:100px; object-fit:cover; border-radius:10px; border: 1px solid #eee;">`;

                    return `<div class="daily-row" style="flex-direction: column; align-items: flex-start; gap: 10px;">
                        <div style="width: 100%; display: flex; justify-content: space-between;">
                            <div>
                                <strong>${j.date || 'Unknown Date'}</strong><br>
                                <span class="mood-tag" style="background:#eef0f7; color:black;">Mood: ${d.mood || 'N/A'}</span>
                            </div>
                            <div style="font-size:0.9rem; text-align: right;">
                                ${d.missionCompleted ? '✅ Mission <br>' : ''}
                                ${d.journal ? '📝 Journal <br>' : ''}
                                ${d.activityDone ? '🏃 Activity <br>' : ''}
                                ${d.photo ? '📸 Photo' : ''}
                            </div>
                        </div>
                        ${imgsHtml ? `<div style="display:flex; flex-wrap:wrap; gap:10px; margin-top:10px;">${imgsHtml}</div>` : ''}
                    </div>`;
                }).join('');
            }

            // 3. Journals
            const tbodyJ = document.querySelector('#adminJournalTable tbody');
            if(tbodyJ) {
                const jrnls = journeys.filter(j => j.data && j.data.journal);
                tbodyJ.innerHTML = jrnls.length === 0 ? '<tr><td colspan="4" style="text-align:center;">No journals yet.</td></tr>' : jrnls.map(j => {
                    const jrnl = j.data.journal;
                    return `<tr>
                        <td>${j.date || 'Unknown Date'}</td>
                        <td>${j.data.mood || 'N/A'}</td>
                        <td><strong>Feeling:</strong> ${jrnl.feeling || ''}<br><strong>Reason:</strong> ${jrnl.reason || ''}</td>
                        <td>${jrnl.gratitude || ''}</td>
                    </tr>`;
                }).join('');
            }

            // 4. Memories
            const mems = await db.get('memories');
            const memGrid = document.getElementById('adminMemoriesGrid');
            if(memGrid) {
                memGrid.innerHTML = mems.length === 0 ? '<p>No memories saved.</p>' : mems.map(m => `
                    <div class="glass-card stat-card admin-card" style="padding:15px; text-align:left;">
                        <h4 style="margin:0 0 5px;">${m.title || 'Memory'}</h4>
                        <p style="font-size:0.8rem; margin:0 0 10px; color:gray;">${m.date || ''}</p>
                        <p style="font-size:0.9rem;">${m.description || ''}</p>
                        ${m.images && m.images.length ? `<img src="${m.images[0]}" class="zoomable-img" onclick="app.openImageModal(this.src, '${m.title}')" style="width:100%; border-radius:10px; margin-top:10px; border: 1px solid #eee;">` : ''}
                    </div>
                `).join('');
            }
        } catch(e) {
            console.error("Admin render failed", e);
        }
    },

    showAdminTab(e, tabId) {
        document.querySelectorAll('.admin-nav-item').forEach(item => item.classList.remove('active'));
        e.currentTarget.classList.add('active');
        document.querySelectorAll('.admin-tab').forEach(tab => tab.classList.add('hidden'));
        
        // capitalize first letter
        const formattedTabId = 'adminTab' + tabId.charAt(0).toUpperCase() + tabId.slice(1);
        const targetTab = document.getElementById(formattedTabId);
        if(targetTab) targetTab.classList.remove('hidden');
    },

    openImageModal(src, caption) {
        const modal = document.getElementById('imageViewerModal');
        const img = document.getElementById('fullSizeImage');
        const cap = document.getElementById('imageCaption');
        const downBtn = document.getElementById('downloadImageBtn');
        
        if (modal && img && downBtn) {
            img.src = src;
            if (cap) cap.innerText = caption || '';
            downBtn.href = src;
            downBtn.download = (caption ? caption.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'everglow_image') + '.png';
            modal.classList.remove('hidden');
        }
    },

    closeImageModal() {
        const modal = document.getElementById('imageViewerModal');
        if (modal) modal.classList.add('hidden');
    },

    async resetUserStats() {
        if(!confirm("Are you sure you want to reset user stats (Level, Points, Streak)? This cannot be undone.")) return;
        const p = await db.getProfile();
        if(p) {
            p.xp = 0; p.points = 0; p.level = 1; p.streak = 0; p.currentJourneyStep = 1; p.journeyData = {};
            await db.setProfile(p);
            await this.updateStats();
            alert("User stats have been reset to 0.");
        }
    },

    async resetFullUser() {
        if(!confirm("DANGER! This will delete ALL user history, journals, memories, and logs. Are you absolutely sure?")) return;
        if(!confirm("Are you REALLY sure? This is a permanent wipe.")) return;
        
        const client = getClient();
        if(client) {
            try {
                // Delete from all tables using gte('id', 0) to target all rows
                await client.from('activityLog').delete().gte('id', 0);
                await client.from('dailyJourneys').delete().gte('id', 0);
                await client.from('memories').delete().gte('id', 0);
                await client.from('blessings').delete().gte('id', 0);
                
                const p = await db.getProfile();
                if(p) {
                    p.xp = 0; p.points = 0; p.level = 1; p.streak = 0; 
                    p.lastJourneyDate = null; p.currentJourneyStep = 1; p.journeyData = {};
                    await db.setProfile(p);
                }
                await this.renderAdmin();
                alert("Entire database has been wiped clean. Fresh start ready.");
            } catch(e) {
                console.error("Failed to wipe database:", e);
                alert("Error wiping database. Check console.");
            }
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    let check = setInterval(() => {
        if(window.supabase) { clearInterval(check); app.init(); }
    }, 200);
    setTimeout(() => { clearInterval(check); if(!_supabase) app.init(); }, 5000);
});
