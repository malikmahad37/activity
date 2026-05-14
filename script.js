// Global Error Handler for Debugging
window.onerror = function(msg, url, lineNo, columnNo, error) {
    console.error('Global Error:', msg, url, lineNo, error);
    alert('Error: ' + msg + '\nLine: ' + lineNo);
    return false;
};

// Initialize Supabase
const SUPABASE_URL = 'https://rmjulmgszlogdpclldhp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_pPcJqEpi7E6sigaCeV2JSQ_huoT_MRL';

let _supabase = null;
function getClient() {
    if (!_supabase && window.supabase) {
        try {
            _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            console.log("Supabase client initialized successfully.");
        } catch(e) {
            console.error("Failed to create Supabase client:", e);
        }
    }
    return _supabase;
}

class SupabaseDB {
    async get(table) {
        const client = getClient();
        if (!client) return [];
        const { data, error } = await client.from(table).select('*');
        if (error) console.error(`Error fetching ${table}:`, error);
        return data || [];
    }
    async insert(table, item) {
        const client = getClient();
        if (!client) return item;
        const { data, error } = await client.from(table).insert([item]).select();
        if (error) console.error(`Error inserting into ${table}:`, error);
        return data ? data[0] : item;
    }
    async getProfile() {
        const client = getClient();
        if (!client) {
            console.error("Supabase client not initialized.");
            return null;
        }
        console.log("Requesting profile for ayesha...");
        try {
            const { data, error } = await client.from('profiles').select('*').eq('id', 'ayesha').single();
            if (error) {
                console.warn("Profile fetch error/missing:", error);
                const def = { 
                    id: 'ayesha',
                    xp: 0, 
                    points: 0,
                    level: 1, 
                    streak: 0, 
                    lastLogin: null, 
                    lastJourneyDate: null, 
                    currentJourneyStep: 1, 
                    journeyData: {} 
                };
                if (error.code === 'PGRST116' || error.message.includes('JSON')) { 
                    console.log("Creating fresh profile for ayesha...");
                    await client.from('profiles').insert([def]);
                    return def;
                }
                return def;
            }
            return data;
        } catch(e) {
            console.error("Exception in getProfile:", e);
            return null;
        }
    }
    async setProfile(p) {
        const client = getClient();
        if (!client) return;
        const { error } = await client.from('profiles').update(p).eq('id', 'ayesha');
        if (error) console.error('Error updating profile:', error);
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
    mood: 5,
    breathe: 10,
    mission: 20,
    journal: 15,
    photo: 10,
    old_memory: 20,
    blessing: 10,
    affirmation: 5,
    journey_complete: 50
};

const DATA = {
    missions: [
        "Take a photo of something that makes you smile.",
        "Take a picture of a flower or a plant nearby.",
        "Write 3 things you like about yourself.",
        "Take 5 deep breaths.",
        "Clean one small corner of your room and take a 'Before & After' photo.",
        "Make dua for peace.",
        "Spend 10 minutes away from overthinking.",
        "Do one helpful thing at home and take a photo of it.",
        "Write one future dream.",
        "Drink water and relax for 5 minutes.",
        "Take a photo of your favorite book or object.",
        "Tell yourself 'I am proud of you'."
    ],
    affirmations: ["Your past does not define your worth.", "You are healing, not broken.", "You deserve respect, peace, and kindness.", "One bad chapter is not your whole story.", "You are enough exactly as you are.", "You are growing in your own time."],
    activities: [
        "Take a photo of the sky right now.",
        "Clean one small corner",
        "Drink a full glass of water",
        "Take a picture of your favorite corner at home",
        "Make dua for someone else",
        "Help someone at home",
        "Take a photo of your meal or a healthy snack",
        "Sit in sunlight for 5 mins",
        "Write one dream on paper and take a photo of it"
    ],
    quotes: {
        'Sad': "It's okay to feel sad. Rain is needed for flowers to grow.",
        'Lonely': "You are never alone; the Almighty is always with you.",
        'Angry': "Take a breath. Let the fire cool. You are in control.",
        'Confused': "Clarity will come in time. Trust the process.",
        'Peaceful': "Alhamdulillah for this moment of calm.",
        'Happy': "Your happiness is a beautiful light. Cherish it!",
        'Grateful': "Gratitude is the key to abundance."
    }
};

const app = {
    state: {
        currentUser: null,
        journeyStep: 1,
        journeyData: {},
        breatheTimer: null,
        tempImages: []
    },

    async init() {
        console.log("App init started...");
        this.checkAuth();
        this.setupEventListeners();
        await this.updateMainScreenState();
        console.log("App init finished.");
    },

    setupEventListeners() {
        const btnAyesha = document.getElementById('btnAyeshaLogin');
        if(btnAyesha) btnAyesha.onclick = () => {
            console.log("Login button clicked for Ayesha");
            this.login('ayesha');
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

        const moodBtns = document.querySelectorAll('#journeyMoodGrid .mood-btn');
        moodBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                document.querySelectorAll('#journeyMoodGrid .mood-btn').forEach(b => b.classList.remove('selected'));
                e.target.classList.add('selected');
                this.state.journeyData.mood = e.target.getAttribute('data-mood');
                await this.logAction('mood', 'Mood Submitted', `Mood: ${this.state.journeyData.mood}`);
                await this.addPoints(POINT_VALUES.mood);
                const nextBtn = document.getElementById('btnNext1');
                if(nextBtn) nextBtn.classList.remove('hidden');
            });
        });
    },

    checkAuth() {
        const session = sessionStorage.getItem('bloom_session');
        if(session) {
            console.log("Session found:", session);
            this.login(session);
        } else {
            this.showPanel('authPanel');
        }
    },

    async login(role) {
        console.log("Logging in as:", role);
        this.state.currentUser = role;
        sessionStorage.setItem('bloom_session', role);
        if(role === 'ayesha') {
            this.showPanel('userPanel');
            this.showScreen('welcomeScreen');
            console.log("Panel and Screen shown, updating stats...");
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
        const target = document.getElementById(id);
        if(target) target.classList.remove('hidden');
        else console.error("Panel not found:", id);
    },

    async showScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        const target = document.getElementById(id);
        if(target) target.classList.remove('hidden');
        
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
        if(p.xp >= p.level * 200) {
            p.xp = 0;
            p.level++;
            alert(`🎉 Level Up! You are now Level ${p.level}!`);
        }
        await db.setProfile(p);
        await this.updateStats();
    },

    async logAction(type, title, details) {
        const entry = {
            type,
            title,
            details,
            points: POINT_VALUES[type] || 0,
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString()
        };
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
            if(btnStart) btnStart.classList.add('hidden');
            if(btnCont) btnCont.classList.remove('hidden');
        } else {
            if(btnStart) {
                btnStart.classList.remove('hidden');
                if(btnCont) btnCont.classList.add('hidden');
                if(p.lastJourneyDate === today) {
                    btnStart.innerText = "Start Another Journey 🌸";
                    if(msgComp) {
                        msgComp.classList.remove('hidden');
                        msgComp.innerText = "You've already completed a journey today, but you can start another one if you'd like!";
                    }
                } else {
                    btnStart.innerText = "Start Today's Journey";
                    if(msgComp) msgComp.classList.add('hidden');
                }
            }
        }
    },

    async startJourney() {
        const p = await db.getProfile();
        if(!p) return;
        p.currentJourneyStep = 1;
        p.journeyData = {};
        await db.setProfile(p);
        this.state.journeyStep = 1;
        this.state.journeyData = {};
        await this.showScreen('journeyScreen');
        this.renderStep();
    },

    async continueJourney() {
        const p = await db.getProfile();
        if(!p) return;
        this.state.journeyStep = p.currentJourneyStep;
        this.state.journeyData = p.journeyData;
        await this.showScreen('journeyScreen');
        this.renderStep();
    },

    renderStep() {
        const s = this.state.journeyStep;
        document.querySelectorAll('.journey-step').forEach(step => step.classList.add('hidden'));
        const currentStepEl = document.getElementById(`step${s}`);
        if(currentStepEl) currentStepEl.classList.remove('hidden');
        
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
        const titles = ["Check-in Mood", "Positive Affirmation", "Breathing Exercise", "Daily Mission", "Journal Entry", "Daily Photo", "Self Love Affirmation", "Counting Blessings", "Mindful Activity", "Purani Achi Yaadein", "Completion"];
        return titles[s-1];
    },

    checkStepCompletionUI() {
        const s = this.state.journeyStep;
        const d = this.state.journeyData;
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
            p.currentJourneyStep = this.state.journeyStep;
            p.journeyData = this.state.journeyData;
            await db.setProfile(p);
            this.renderStep();
        }
    },

    cancelJourney() {
        if(confirm("Are you sure you want to cancel today's journey? Your progress will be saved.")) {
            this.showScreen('welcomeScreen');
        }
    },

    async completeStepAction(type) {
        if(type === 'mission') {
            const notes = document.getElementById('missionNotesJ').value;
            const file = document.getElementById('missionPhotoJ').files[0];
            const missionText = document.getElementById('journeyMissionText').innerText;

            const finalizeMission = async (photoBase64 = null) => {
                this.state.journeyData.mission = { text: missionText, notes: notes, photo: photoBase64 };
                this.state.journeyData.missionCompleted = true;
                await this.logAction('mission', 'Daily Mission Completed', `Task: ${missionText}`);
                await this.addPoints(POINT_VALUES.mission);
                document.getElementById('btnNext4')?.classList.remove('hidden');
                alert("Mission details saved! ✨");
            };

            if(file) {
                const reader = new FileReader();
                reader.onload = async (e) => await finalizeMission(e.target.result);
                reader.readAsDataURL(file);
            } else await finalizeMission();
        }
        if(type === 'journal') {
            this.state.journeyData.journal = {
                feeling: document.getElementById('jFeelingJ').value,
                reason: document.getElementById('jReasonJ').value,
                gratitude: document.getElementById('jGratitudeJ').value,
                improve: document.getElementById('jImproveJ').value
            };
            await this.logAction('journal', 'Journal Saved', 'Step 5 complete');
            await this.addPoints(POINT_VALUES.journal);
            document.getElementById('btnNext5')?.classList.remove('hidden');
        }
        if(type === 'photo') {
            const file = document.getElementById('imgUploadJ').files[0];
            if(file) {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    this.state.journeyData.photo = { base64: e.target.result, caption: document.getElementById('imgCaptionJ').value };
                    await this.logAction('photo', 'Daily Photo Uploaded', 'Step 6 complete');
                    await this.addPoints(POINT_VALUES.photo);
                    alert("Photo uploaded!");
                };
                reader.readAsDataURL(file);
            }
        }
        if(type === 'affirmation') {
            this.state.journeyData.affirmationDone = true;
            await this.logAction('affirmation', 'Affirmation Completed', 'Step 7 complete');
            await this.addPoints(POINT_VALUES.affirmation);
            document.getElementById('btnNext7')?.classList.remove('hidden');
        }
        if(type === 'blessing') {
            const b = document.getElementById('blessingJ').value;
            if(!b) return;
            this.state.journeyData.blessing = b;
            await this.logAction('blessing', 'Blessing Added', 'Step 8 complete');
            await this.addPoints(POINT_VALUES.blessing);
            await db.insert('blessings', { text: b });
            document.getElementById('btnNext8')?.classList.remove('hidden');
        }
        if(type === 'activity') {
            const file = document.getElementById('activityPhotoJ').files[0];
            const activityText = document.getElementById('journeyActivityText').innerText;

            const finalizeActivity = async (photoBase64 = null) => {
                this.state.journeyData.activity = { text: activityText, photo: photoBase64 };
                this.state.journeyData.activityDone = true;
                await this.logAction('activity', 'Activity Completed', `Task: ${activityText}`);
                await this.addPoints(POINT_VALUES.breathe);
                document.getElementById('btnNext9')?.classList.remove('hidden');
                alert("Activity saved! ✨");
            };

            if(file) {
                const reader = new FileReader();
                reader.onload = async (e) => await finalizeActivity(e.target.result);
                reader.readAsDataURL(file);
            } else await finalizeActivity();
        }
        if(type === 'oldMemory') {
            const m = {
                title: document.getElementById('omTitleJ').value,
                description: document.getElementById('omDescJ').value,
                specialWhy: document.getElementById('omSpecialJ').value,
                images: this.state.tempImagesJ || [],
                type: 'Old Memory Step'
            };
            if(!m.title) return alert("Title is required.");
            await db.insert('memories', m);
            this.state.journeyData.oldMemoryDone = true;
            await this.logAction('old_memory', 'Old Memory Added', `Step 10: ${m.title}`);
            await this.addPoints(POINT_VALUES.old_memory);
            document.getElementById('btnNext10')?.classList.remove('hidden');
            this.state.tempImagesJ = [];
        }
    },

    async startBreatheExercise() {
        let sec = 60;
        const text = document.getElementById('journeyBreatheTimer');
        const circle = document.getElementById('journeyBreatheCircle');
        if(this.state.breatheTimer) clearInterval(this.state.breatheTimer);
        this.state.breatheTimer = setInterval(async () => {
            sec--;
            if(text) text.innerText = `${sec} seconds`;
            if(circle) circle.innerText = sec % 8 < 4 ? "Inhale..." : "Exhale...";
            if(sec <= 0) {
                clearInterval(this.state.breatheTimer);
                await this.logAction('breathe', 'Breathing Completed', 'Step 3 complete');
                await this.addPoints(POINT_VALUES.breathe);
                document.getElementById('btnNext3')?.classList.remove('hidden');
            }
        }, 1000);
    },

    async finishJourney() {
        const p = await db.getProfile();
        if(!p) return;
        const today = new Date().toDateString();
        if(p.lastJourneyDate !== today) p.streak++;
        p.lastJourneyDate = today;
        p.currentJourneyStep = 1;
        await db.setProfile(p);
        await this.addPoints(POINT_VALUES.journey_complete);
        await this.logAction('journey_complete', 'Daily Journey Completed', 'Full 11 steps finished');
        await db.insert('dailyJourneys', { date: p.lastJourneyDate, data: this.state.journeyData });
        await this.showScreen('welcomeScreen');
        await this.updateMainScreenState();
    },

    handleImageSelection(id, context = 'memory') {
        const files = document.getElementById(id).files;
        const imgList = [];
        for(let i=0; i<files.length; i++) {
            const reader = new FileReader();
            reader.onload = (e) => imgList.push(e.target.result);
            reader.readAsDataURL(files[i]);
        }
        if(context === 'journey') this.state.tempImagesJ = imgList;
        else this.state.tempImages = imgList;
    },

    async saveMemory() {
        const m = {
            title: document.getElementById('mTitle').value,
            date: document.getElementById('mDate').value,
            description: document.getElementById('mDesc').value,
            specialWhy: document.getElementById('mSpecial').value,
            people: document.getElementById('mPeople').value,
            location: document.getElementById('mLocation').value,
            mood: document.getElementById('mMood').value,
            tags: document.getElementById('mTags').value.split(',').map(t => t.trim()),
            images: this.state.tempImages
        };
        await db.insert('memories', m);
        await this.logAction('old_memory', 'New Memory Added', m.title);
        await this.addPoints(POINT_VALUES.old_memory);
        this.closeModal('memoryModal');
        await this.renderMemoryBook();
    },

    async renderMemoryBook() {
        const grid = document.getElementById('memoryBookGrid');
        if(!grid) return;
        grid.innerHTML = '';
        const memories = await db.get('memories');
        memories.reverse().forEach(m => {
            const div = document.createElement('div');
            div.className = 'memory-card paper-texture tape-effect';
            div.innerHTML = `
                ${m.images[0] ? `<img src="${m.images[0]}">` : ''}
                <h3>${m.title}</h3>
                <p style="font-size:0.8rem; color:var(--lavender-dark);">${m.date || 'Sometime ago'}</p>
                <p style="margin:10px 0;">${m.description}</p>
                <p style="font-size:0.8rem;"><strong>People:</strong> ${m.people || 'Me'}</p>
                <p style="font-size:0.8rem;"><strong>Location:</strong> ${m.location || 'Home'}</p>
                <div style="margin-top:10px;">${m.tags.map(t => `<span class="memory-tag">${t}</span>`).join('')}</div>
            `;
            grid.appendChild(div);
        });
    },

    async openRandomMemory() {
        const list = await db.get('memories');
        if(!list.length) return alert("No memories yet!");
        const m = list[Math.floor(Math.random() * list.length)];
        const cont = document.getElementById('randomMemoryContent');
        if(cont) cont.innerHTML = `
            ${m.images[0] ? `<img src="${m.images[0]}" style="width:100%; border-radius:10px;">` : ''}
            <h2 style="margin-top:15px;">${m.title}</h2>
            <p>${m.description}</p>
            <p style="margin-top:10px; font-weight:bold; color:var(--blush-pink);">Special because: ${m.specialWhy}</p>
        `;
        this.openModal('randomMemoryModal');
    },

    async updateStats() {
        const p = await db.getProfile();
        if(!p) return;
        ['uiLevel', 'dashLevel', 'adminLevel'].forEach(id => { const el = document.getElementById(id); if(el) el.innerText = p.level; });
        ['uiStreak', 'dashStreak', 'adminStreak'].forEach(id => { const el = document.getElementById(id); if(el) el.innerText = p.streak; });
        ['uiPoints', 'dashPoints', 'adminTotalPoints'].forEach(id => { const el = document.getElementById(id); if(el) el.innerText = p.points; });
        
        const xpBar = document.getElementById('uiXpBar');
        if(xpBar) xpBar.style.width = `${(p.xp / (p.level * 200)) * 100}%`;
        
        const dashPtsEl = document.getElementById('dashTodayPoints');
        if(dashPtsEl) {
            const today = new Date().toLocaleDateString();
            const logs = await db.get('activityLog');
            const todayPts = logs.filter(l => l.date === today).reduce((sum, l) => sum + l.points, 0);
            dashPtsEl.innerText = todayPts;
        }
    },

    async renderDashboard() {
        await this.updateStats();
        const logsAll = await db.get('activityLog');
        const logs = logsAll.reverse().slice(0, 5);
        const cont = document.getElementById('dashRecentLog');
        if(cont) cont.innerHTML = logs.map(l => `<p style="font-size:0.8rem; border-bottom:1px solid #eee; padding:5px 0;">[${l.time}] ${l.title} (+${l.points} pts)</p>`).join('');
        
        const memories = await db.get('memories');
        const latestM = memories.slice(-1)[0];
        const latestEl = document.getElementById('dashLatestMemory');
        if(latestEl && latestM) latestEl.innerText = latestM.title;
    },

    async renderLog() {
        const logs = await db.get('activityLog');
        logs.reverse();
        const totalEl = document.getElementById('totalActions');
        if(totalEl) totalEl.innerText = logs.length;
        const listEl = document.getElementById('fullLogList');
        if(listEl) listEl.innerHTML = logs.map(l => `
            <div style="background:white; padding:10px; border-radius:10px; margin-bottom:10px; border-left:4px solid var(--blush-pink);">
                <strong>${l.date} ${l.time}</strong><br>${l.title}: ${l.details} (+${l.points} pts)
            </div>
        `).join('');
    },

    async showAdminTab(e, tabId) {
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.add('hidden'));
        document.querySelectorAll('.admin-nav-item').forEach(b => b.classList.remove('active'));
        const tabEl = document.getElementById(`adminTab${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`);
        if(tabEl) tabEl.classList.remove('hidden');
        if(e && e.currentTarget) e.currentTarget.classList.add('active');
        await this.renderAdmin();
    },

    async renderAdmin() {
        const p = await db.getProfile();
        if(!p) return;
        const logs = await db.get('activityLog');
        logs.reverse();
        const journeys = await db.get('dailyJourneys');
        journeys.reverse();
        const memories = await db.get('memories');
        memories.reverse();

        await this.updateStats();

        const reportList = document.getElementById('adminDailyReportList');
        if(reportList) {
            reportList.innerHTML = '';
            const groupedLogs = {};
            logs.forEach(l => { if(!groupedLogs[l.date]) groupedLogs[l.date] = []; groupedLogs[l.date].push(l); });

            Object.keys(groupedLogs).forEach(date => {
                const dayLogs = groupedLogs[date];
                const dayJourneys = journeys.filter(j => j.date === date);
                const dayPoints = dayLogs.reduce((s, l) => s + l.points, 0);
                const dayDiv = document.createElement('div');
                dayDiv.className = 'glass-card admin-card';
                dayDiv.style.borderLeft = '6px solid var(--blush-pink)';
                
                const missionData = dayJourneys.length > 0 && dayJourneys[0].data.mission ? dayJourneys[0].data.mission : null;
                const activityData = dayJourneys.length > 0 && dayJourneys[0].data.activity ? dayJourneys[0].data.activity : null;

                const missionHtml = missionData ? `<div style="margin-top: 15px; padding: 10px; background: #fff; border-radius: 10px; border: 1px dashed var(--lavender);"><p style="font-size: 0.8rem; margin-bottom: 5px; color: var(--lavender-dark);"><strong>🎯 Mission:</strong> ${missionData.text}</p>${missionData.notes ? `<p style="font-size: 0.85rem; background: #fdfdfd; padding: 5px; border-radius: 5px;"><strong>Notes:</strong> ${missionData.notes}</p>` : ''}${missionData.photo ? `<div style="margin-top:10px;"><img src="${missionData.photo}" style="max-width: 150px; border-radius: 8px; cursor: pointer;" onclick="app.downloadImage('${missionData.photo}', 'mission_${date}.png')"><br><small style="color: var(--text-light)">Click to download</small></div>` : ''}</div>` : '';
                const activityHtml = activityData ? `<div style="margin-top: 10px; padding: 10px; background: #fff; border-radius: 10px; border: 1px dashed var(--sky-blue);"><p style="font-size: 0.8rem; margin-bottom: 5px; color: var(--sky-blue-dark);"><strong>🏃 Activity:</strong> ${activityData.text}</p>${activityData.photo ? `<div style="margin-top:10px;"><img src="${activityData.photo}" style="max-width: 150px; border-radius: 8px; cursor: pointer;" onclick="app.downloadImage('${activityData.photo}', 'activity_${date}.png')"><br><small style="color: var(--text-light)">Click to download</small></div>` : ''}</div>` : '';

                dayDiv.innerHTML = `<div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 10px;"><h4 style="margin:0;">📅 ${date}</h4><span style="font-weight:bold; color: var(--lavender-dark);">+${dayPoints} Points</span></div><div style="font-size: 0.9rem;"><p><strong>Journeys:</strong> ${dayJourneys.length}</p><p><strong>Actions:</strong> ${dayLogs.length}</p><p><strong>Moods:</strong> ${dayJourneys.map(j => `<span class="memory-tag">${j.data.mood}</span>`).join('') || 'None'}</p>${missionHtml}${activityHtml}</div>`;
                reportList.appendChild(dayDiv);
            });
            if(Object.keys(groupedLogs).length === 0) reportList.innerHTML = '<p>No activity recorded yet.</p>';
        }

        const tbodyL = document.querySelector('#adminLogTable tbody');
        if(tbodyL) tbodyL.innerHTML = logs.map(l => `<tr><td>${l.date} ${l.time}</td><td>${l.title}</td><td>${l.details}</td><td>${l.points}</td></tr>`).join('');

        const grid = document.getElementById('adminMemoriesGrid');
        if(grid) {
            grid.innerHTML = memories.map(m => `
                <div class="memory-card paper-texture tape-effect">
                    ${m.images && m.images[0] ? `<img src="${m.images[0]}" style="width:100%; height:120px; object-fit:cover; border-radius:10px;">` : ''}
                    <strong>${m.title}</strong><br><small>${m.date || ''}</small>
                </div>
            `).join('');
        }
    },

    downloadImage(base64, filename) { const a = document.createElement('a'); a.href = base64; a.download = filename; a.click(); },
    openModal(id) { document.getElementById(id)?.classList.remove('hidden'); },
    closeModal(id) { document.getElementById(id)?.classList.add('hidden'); },
    
    async openRandomBlessing() {
        const b = await db.get('blessings');
        const el = document.getElementById('randomBlessingDisplay');
        if(el && b.length) el.innerText = `"${b[Math.floor(Math.random() * b.length)].text}"`;
        else if(el) el.innerText = "Jar is empty!";
    },

    async renderTimeline() {
        const logs = await db.get('activityLog');
        logs.reverse();
        const cont = document.getElementById('timelineContainer');
        if(!cont) return;
        cont.innerHTML = logs.map(l => `
            <div class="timeline-item glass-card" style="border-left: 4px solid var(--blush-pink); margin-bottom: 15px; padding: 15px;">
                <div style="display:flex; justify-content:space-between;"><small>${l.date} ${l.time}</small><span>+${l.points}</span></div>
                <strong>${l.title}</strong><p>${l.details}</p>
            </div>
        `).join('') || '<p>No records found.</p>';
    },

    async startCalmMode() {
        await this.showScreen('calmModeScreen');
        let sec = 60;
        const text = document.getElementById('calmBreatheTimer');
        const circle = document.getElementById('calmBreatheCircle');
        if(this.state.calmTimer) clearInterval(this.state.calmTimer);
        this.state.calmTimer = setInterval(async () => {
            sec--;
            if(text) text.innerText = `${sec} seconds`;
            if(circle) circle.innerText = sec % 8 < 4 ? "Inhale..." : "Exhale...";
            if(sec <= 0) { clearInterval(this.state.calmTimer); alert("Calm Mode Finished. ✨"); await this.showScreen('welcomeScreen'); }
        }, 1000);
    },

    async resetFullUser() { if(confirm("Are you sure? EVERYTHING will be deleted.")) { await db.clear(); alert("Database Wiped!"); window.location.reload(); } },
    async resetUserStats() {
        if(confirm("Reset Stats but keep Memories?")) {
            const p = await db.getProfile();
            if(!p) return;
            p.points = 0; p.xp = 0; p.level = 1; p.streak = 0; p.lastJourneyDate = null; p.currentJourneyStep = 1;
            await db.setProfile(p);
            alert("Stats reset!");
            await this.renderAdmin();
        }
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM loaded, waiting for Supabase...");
    let retries = 0;
    const checkSupabase = setInterval(async () => {
        if (window.supabase || retries > 10) {
            clearInterval(checkSupabase);
            console.log("Supabase ready, initializing app...");
            await app.init();
        }
        retries++;
    }, 500);
});
