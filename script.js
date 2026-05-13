// Global Error Handler for Debugging
window.onerror = function(msg, url, lineNo, columnNo, error) {
    alert('Error: ' + msg + '\nScript: ' + url + '\nLine: ' + lineNo + '\nColumn: ' + columnNo + '\nStackTrace: ' + (error ? error.stack : 'No stack available'));
    return false;
};

// Initialize Supabase
const SUPABASE_URL = 'https://rmjulmgszlogdpclldhp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_pPcJqEpi7E6sigaCeV2JSQ_huoT_MRL';
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

class SupabaseDB {
    async get(table) {
        if (!supabaseClient) return [];
        const { data, error } = await supabaseClient.from(table).select('*');
        if (error) console.error(`Error fetching ${table}:`, error);
        return data || [];
    }
    async insert(table, item) {
        if (!supabaseClient) return item;
        const { data, error } = await supabaseClient.from(table).insert([item]).select();
        if (error) console.error(`Error inserting into ${table}:`, error);
        return data ? data[0] : item;
    }
    async getProfile() {
        if (!supabaseClient) return null;
        const { data, error } = await supabaseClient.from('profiles').select('*').eq('id', 'ayesha').single();
        if (error || !data) {
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
            if (error && error.code === 'PGRST116') { // Not found
                await supabaseClient.from('profiles').insert([def]);
            }
            return def;
        }
        return data;
    }
    async setProfile(p) {
        if (!supabaseClient) return;
        const { error } = await supabaseClient.from('profiles').update(p).eq('id', 'ayesha');
        if (error) console.error('Error updating profile:', error);
    }
    async clear() {
        if (!supabaseClient) return;
        const tables = ['activityLog', 'memories', 'blessings', 'dailyJourneys'];
        for (const t of tables) {
            await supabaseClient.from(t).delete().neq('id', '0'); // Delete all rows
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
        this.checkAuth();
        this.setupEventListeners();
        await this.updateMainScreenState();
    },

    setupEventListeners() {
        const btnAyesha = document.getElementById('btnAyeshaLogin');
        if(btnAyesha) btnAyesha.onclick = () => this.login('ayesha');
        
        const btnAdmin = document.getElementById('btnAdminLogin');
        if(btnAdmin) btnAdmin.onclick = () => {
            const u = document.getElementById('adminUsername').value;
            const p = document.getElementById('adminPassword').value;
            if(u === 'admin' && p === 'admin123') this.login('admin');
            else alert('Invalid admin credentials.');
        };

        const btnLogout = document.getElementById('btnLogout');
        if(btnLogout) btnLogout.onclick = () => this.logout();

        // Journey Mood Selection
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
        if(session) this.login(session);
        else this.showPanel('authPanel');
    },

    async login(role) {
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
        const target = document.getElementById(id);
        if(target) target.classList.remove('hidden');
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

    // Points & Log System
    async addPoints(pts) {
        const p = await db.getProfile();
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

    // Journey Flow (11 Steps)
    async updateMainScreenState() {
        const p = await db.getProfile();
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
        
        document.getElementById('journeyTitle').innerText = `Step ${s}: ${this.getStepTitle(s)}`;
        document.getElementById('journeyProgress').style.width = `${(s / 11) * 100}%`;

        if(s === 1) {
            // Mood selection logic handled in setupEventListeners
        }
        if(s === 2) {
            const mood = this.state.journeyData.mood;
            document.getElementById('journeyQuote').innerText = DATA.quotes[mood] || "Believe in yourself.";
        }
        if(s === 3) {
            // Breathing exercise
            this.startBreatheExercise();
        }
        if(s === 4) {
            const m = DATA.missions[Math.floor(Math.random() * DATA.missions.length)];
            document.getElementById('journeyMissionText').innerText = m;
        }
        if(s === 9) {
            const a = DATA.activities[Math.floor(Math.random() * DATA.activities.length)];
            document.getElementById('journeyActivityText').innerText = a;
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
        if(s === 1 && d.mood) document.getElementById('btnNext1').classList.remove('hidden');
        if(s === 4 && d.missionCompleted) document.getElementById('btnNext4').classList.remove('hidden');
        if(s === 5 && d.journal) document.getElementById('btnNext5').classList.remove('hidden');
        if(s === 6 && d.photo) document.getElementById('btnNext6').classList.remove('hidden');
        if(s === 7 && d.affirmationDone) document.getElementById('btnNext7').classList.remove('hidden');
        if(s === 8 && d.blessing) document.getElementById('btnNext8').classList.remove('hidden');
        if(s === 9 && d.activityDone) document.getElementById('btnNext9').classList.remove('hidden');
        if(s === 10 && d.oldMemoryDone) document.getElementById('btnNext10').classList.remove('hidden');
    },

    async nextStep() {
        if(this.state.journeyStep < 11) {
            this.state.journeyStep++;
            const p = await db.getProfile();
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
                this.state.journeyData.mission = {
                    text: missionText,
                    notes: notes,
                    photo: photoBase64
                };
                this.state.journeyData.missionCompleted = true;
                await this.logAction('mission', 'Daily Mission Completed', `Task: ${missionText}`);
                await this.addPoints(POINT_VALUES.mission);
                document.getElementById('btnNext4').classList.remove('hidden');
                alert("Mission details saved! ✨");
            };

            if(file) {
                const reader = new FileReader();
                reader.onload = async (e) => await finalizeMission(e.target.result);
                reader.readAsDataURL(file);
            } else {
                await finalizeMission();
            }
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
            document.getElementById('btnNext5').classList.remove('hidden');
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
            document.getElementById('btnNext7').classList.remove('hidden');
        }
        if(type === 'blessing') {
            const b = document.getElementById('blessingJ').value;
            if(!b) return;
            this.state.journeyData.blessing = b;
            await this.logAction('blessing', 'Blessing Added', 'Step 8 complete');
            await this.addPoints(POINT_VALUES.blessing);
            await db.insert('blessings', { text: b });
            document.getElementById('btnNext8').classList.remove('hidden');
        }
        if(type === 'activity') {
            const file = document.getElementById('activityPhotoJ').files[0];
            const activityText = document.getElementById('journeyActivityText').innerText;

            const finalizeActivity = async (photoBase64 = null) => {
                this.state.journeyData.activity = {
                    text: activityText,
                    photo: photoBase64
                };
                this.state.journeyData.activityDone = true;
                await this.logAction('activity', 'Activity Completed', `Task: ${activityText}`);
                await this.addPoints(POINT_VALUES.breathe); // Activity points
                const nextBtn = document.getElementById('btnNext9');
                if(nextBtn) nextBtn.classList.remove('hidden');
                alert("Activity saved! ✨");
            };

            if(file) {
                const reader = new FileReader();
                reader.onload = async (e) => await finalizeActivity(e.target.result);
                reader.readAsDataURL(file);
            } else {
                await finalizeActivity();
            }
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
            document.getElementById('btnNext10').classList.remove('hidden');
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
            text.innerText = `${sec} seconds`;
            circle.innerText = sec % 8 < 4 ? "Inhale..." : "Exhale...";
            if(sec <= 0) {
                clearInterval(this.state.breatheTimer);
                await this.logAction('breathe', 'Breathing Completed', 'Step 3 complete');
                await this.addPoints(POINT_VALUES.breathe);
                document.getElementById('btnNext3').classList.remove('hidden');
            }
        }, 1000);
    },

    async finishJourney() {
        const p = await db.getProfile();
        const today = new Date().toDateString();
        
        // Only increment streak once per day
        if(p.lastJourneyDate !== today) {
            p.streak++;
        }
        
        p.lastJourneyDate = today;
        p.currentJourneyStep = 1;
        await db.setProfile(p);

        await this.addPoints(POINT_VALUES.journey_complete);
        await this.logAction('journey_complete', 'Daily Journey Completed', 'Full 11 steps finished');
        await db.insert('dailyJourneys', { date: p.lastJourneyDate, data: this.state.journeyData });
        
        await this.showScreen('welcomeScreen');
        await this.updateMainScreenState();
    },

    // Memories
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
        document.getElementById('randomMemoryContent').innerHTML = `
            ${m.images[0] ? `<img src="${m.images[0]}" style="width:100%; border-radius:10px;">` : ''}
            <h2 style="margin-top:15px;">${m.title}</h2>
            <p>${m.description}</p>
            <p style="margin-top:10px; font-weight:bold; color:var(--blush-pink);">Special because: ${m.specialWhy}</p>
        `;
        this.openModal('randomMemoryModal');
    },

    // Dashboards
    async updateStats() {
        const p = await db.getProfile();
        if(!p) return;
        ['uiLevel', 'dashLevel'].forEach(id => { if(document.getElementById(id)) document.getElementById(id).innerText = p.level; });
        ['uiStreak', 'dashStreak'].forEach(id => { if(document.getElementById(id)) document.getElementById(id).innerText = p.streak; });
        ['uiPoints', 'dashPoints'].forEach(id => { if(document.getElementById(id)) document.getElementById(id).innerText = p.points; });
        
        if(document.getElementById('uiXpBar')) document.getElementById('uiXpBar').style.width = `${(p.xp / (p.level * 200)) * 100}%`;
        
        if(document.getElementById('dashTodayPoints')) {
            const today = new Date().toLocaleDateString();
            const logs = await db.get('activityLog');
            const todayPts = logs.filter(l => l.date === today).reduce((sum, l) => sum + l.points, 0);
            document.getElementById('dashTodayPoints').innerText = todayPts;
        }
    },

    async renderDashboard() {
        await this.updateStats();
        const logsAll = await db.get('activityLog');
        const logs = logsAll.reverse().slice(0, 5);
        const cont = document.getElementById('dashRecentLog');
        cont.innerHTML = logs.map(l => `<p style="font-size:0.8rem; border-bottom:1px solid #eee; padding:5px 0;">[${l.time}] ${l.title} (+${l.points} pts)</p>`).join('');
        
        const memories = await db.get('memories');
        const latestM = memories.slice(-1)[0];
        if(latestM) document.getElementById('dashLatestMemory').innerText = latestM.title;
    },

    async renderLog() {
        const logs = await db.get('activityLog');
        logs.reverse();
        document.getElementById('totalActions').innerText = logs.length;
        document.getElementById('fullLogList').innerHTML = logs.map(l => `
            <div style="background:white; padding:10px; border-radius:10px; margin-bottom:10px; border-left:4px solid var(--blush-pink);">
                <strong>${l.date} ${l.time}</strong><br>${l.title}: ${l.details} (+${l.points} pts)
            </div>
        `).join('');
    },

    // Admin Panel Logic
    async showAdminTab(e, tabId) {
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.add('hidden'));
        document.querySelectorAll('.admin-nav-item').forEach(b => b.classList.remove('active'));
        const tabEl = document.getElementById(`adminTab${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`);
        if(tabEl) tabEl.classList.remove('hidden');
        if(e && e.target) e.target.classList.add('active');
        await this.renderAdmin();
    },

    async renderAdmin() {
        const p = await db.getProfile();
        const logs = await db.get('activityLog');
        logs.reverse();
        const journeys = await db.get('dailyJourneys');
        journeys.reverse();
        const memories = await db.get('memories');
        memories.reverse();

        // Update Stats
        if(document.getElementById('adminTotalPoints')) document.getElementById('adminTotalPoints').innerText = p.points;
        if(document.getElementById('adminStreak')) document.getElementById('adminStreak').innerText = p.streak;
        if(document.getElementById('adminLevel')) document.getElementById('adminLevel').innerText = p.level;

        // Daily Report (Grouped by Date)
        const reportList = document.getElementById('adminDailyReportList');
        if(reportList) {
            reportList.innerHTML = '';
            const groupedLogs = {};
            logs.forEach(l => {
                if(!groupedLogs[l.date]) groupedLogs[l.date] = [];
                groupedLogs[l.date].push(l);
            });

            Object.keys(groupedLogs).forEach(date => {
                const dayLogs = groupedLogs[date];
                const dayJourneys = journeys.filter(j => j.date === date);
                const dayPoints = dayLogs.reduce((s, l) => s + l.points, 0);
                
                const dayDiv = document.createElement('div');
                dayDiv.className = 'glass-card admin-card';
                dayDiv.style.borderLeft = '6px solid var(--blush-pink)';
                
                const missionData = dayJourneys.length > 0 && dayJourneys[0].data.mission ? dayJourneys[0].data.mission : null;
                const activityData = dayJourneys.length > 0 && dayJourneys[0].data.activity ? dayJourneys[0].data.activity : null;

                const missionHtml = missionData ? `
                    <div style="margin-top: 15px; padding: 10px; background: #fff; border-radius: 10px; border: 1px dashed var(--lavender);">
                        <p style="font-size: 0.8rem; margin-bottom: 5px; color: var(--lavender-dark);"><strong>🎯 Mission:</strong> ${missionData.text}</p>
                        ${missionData.notes ? `<p style="font-size: 0.85rem; background: #fdfdfd; padding: 5px; border-radius: 5px;"><strong>Notes:</strong> ${missionData.notes}</p>` : ''}
                        ${missionData.photo ? `
                            <div style="margin-top:10px;">
                                <img src="${missionData.photo}" style="max-width: 150px; border-radius: 8px; cursor: pointer;" onclick="app.downloadImage('${missionData.photo}', 'mission_${date}.png')">
                                <br><small style="color: var(--text-light)">Click to download</small>
                            </div>` : ''}
                    </div>
                ` : '';

                const activityHtml = activityData ? `
                    <div style="margin-top: 10px; padding: 10px; background: #fff; border-radius: 10px; border: 1px dashed var(--sky-blue);">
                        <p style="font-size: 0.8rem; margin-bottom: 5px; color: var(--sky-blue-dark);"><strong>🏃 Activity:</strong> ${activityData.text}</p>
                        ${activityData.photo ? `
                            <div style="margin-top:10px;">
                                <img src="${activityData.photo}" style="max-width: 150px; border-radius: 8px; cursor: pointer;" onclick="app.downloadImage('${activityData.photo}', 'activity_${date}.png')">
                                <br><small style="color: var(--text-light)">Click to download</small>
                            </div>` : ''}
                    </div>
                ` : '';

                dayDiv.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 10px;">
                        <h4 style="margin:0;">📅 ${date}</h4>
                        <span style="font-weight:bold; color: var(--lavender-dark);">+${dayPoints} Points Earned</span>
                    </div>
                    <div style="font-size: 0.9rem;">
                        <p><strong>Journeys Completed:</strong> ${dayJourneys.length}</p>
                        <p><strong>Total Actions:</strong> ${dayLogs.length}</p>
                        <p><strong>Daily Moods:</strong> ${dayJourneys.map(j => `<span class="mood-tag" style="background:var(--lavender); margin-right:5px;">${j.data.mood}</span>`).join('') || 'No journey started'}</p>
                        ${missionHtml}
                        ${activityHtml}
                    </div>
                    <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #eee;">
                        <details>
                            <summary style="cursor:pointer; font-size: 0.8rem; color: var(--text-light);">View Day Timeline</summary>
                            <div style="margin-top:10px; font-size: 0.8rem;">
                                ${dayLogs.map(l => `<div style="margin-bottom:5px;">[${l.time}] ${l.title} (+${l.points} pts)</div>`).join('')}
                            </div>
                        </details>
                    </div>
                `;
                reportList.appendChild(dayDiv);
            });
            if(Object.keys(groupedLogs).length === 0) reportList.innerHTML = '<p>No activity recorded yet.</p>';
        }

        const tbodyL = document.querySelector('#adminLogTable tbody');
        if(tbodyL) {
            tbodyL.innerHTML = logs.map(l => `
                <tr><td>${l.date} ${l.time}</td><td>${l.title}</td><td>${l.details}</td><td>${l.points}</td></tr>
            `).join('');
        }

        const tbodyJ = document.querySelector('#adminJournalTable tbody');
        if(tbodyJ) {
            const journalsList = journeys.filter(j => j.data && j.data.journal).map(j => ({
                date: j.date,
                mood: j.data.mood,
                feeling: j.data.journal.feeling,
                reason: j.data.journal.reason,
                gratitude: j.data.journal.gratitude
            }));
            
            tbodyJ.innerHTML = journalsList.map(j => `
                <tr>
                    <td>${j.date}</td>
                    <td><span class="mood-tag" style="background:var(--lavender);">${j.mood}</span></td>
                    <td><strong>Feelings:</strong> ${j.feeling}<br><strong>Reason:</strong> ${j.reason}</td>
                    <td>${j.gratitude}</td>
                </tr>
            `).join('');
        }

        const grid = document.getElementById('adminMemoriesGrid');
        if(grid) {
            grid.innerHTML = '';
            memories.forEach(m => {
                const div = document.createElement('div');
                div.className = 'memory-card paper-texture tape-effect';
                const desc = m.description || '';
                const hasImg = m.images && m.images[0];
                div.innerHTML = `
                    ${hasImg ? `<img src="${m.images[0]}" style="width:100%; height:150px; object-fit:cover; border-radius:10px; margin-bottom:10px;">` : ''}
                    <div style="padding: 5px;">
                        <div style="display:flex; justify-content:space-between;">
                            <strong>${m.title}</strong>
                            ${hasImg ? `<button style="font-size:0.7rem; padding:2px 5px;" onclick="app.downloadImage('${m.images[0]}', '${m.title}.png')">Download</button>` : ''}
                        </div>
                        <small style="color:var(--text-light)">${m.date || 'Old Yaad'}</small><br>
                        <p style="font-size:0.75rem; margin-top:10px;">${desc.substring(0, 80)}...</p>
                        <div style="margin-top:10px; font-size:0.7rem; color:var(--lavender-dark);">
                            👤 ${m.people || 'Self'} | 📍 ${m.location || 'Unknown'}
                        </div>
                    </div>
                `;
                grid.appendChild(div);
            });
            if(memories.length === 0) grid.innerHTML = '<p>No memories added yet.</p>';
        }
    },

    downloadImage(base64, filename) {
        const a = document.createElement('a');
        a.href = base64; a.download = filename; a.click();
    },

    openModal(id) { document.getElementById(id).classList.remove('hidden'); },
    closeModal(id) { document.getElementById(id).classList.add('hidden'); },
    
    async openRandomBlessing() {
        const b = await db.get('blessings');
        if(!b.length) return alert("Jar is empty!");
        document.getElementById('randomBlessingDisplay').innerText = `"${b[Math.floor(Math.random() * b.length)].text}"`;
    },

    async renderTimeline() {
        const logs = await db.get('activityLog');
        logs.reverse();
        const cont = document.getElementById('timelineContainer');
        if(!cont) return;
        cont.innerHTML = '';
        
        if(logs.length === 0) {
            cont.innerHTML = '<p style="text-align:center; padding: 20px;">No journey records yet. Start your first journey today! 🌸</p>';
            return;
        }

        logs.forEach(l => {
            const div = document.createElement('div');
            div.className = 'timeline-item glass-card';
            div.style.padding = '20px';
            div.style.marginBottom = '15px';
            div.style.borderLeft = '4px solid var(--blush-pink)';
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                    <strong style="color:var(--lavender-dark)">${l.date} ${l.time}</strong>
                    <span style="font-size:0.8rem; background:var(--lavender); padding:2px 8px; border-radius:10px;">+${l.points} pts</span>
                </div>
                <h4 style="margin:0;">${l.title}</h4>
                <p style="font-size:0.9rem; margin-top:5px;">${l.details}</p>
            `;
            cont.appendChild(div);
        });
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
            
            if(sec <= 0) {
                clearInterval(this.state.calmTimer);
                alert("Calm Mode Finished. Alhamdulillah. ✨");
                await this.showScreen('welcomeScreen');
            }
        }, 1000);
    },

    async resetFullUser() {
        if(confirm("Are you sure? This will delete EVERYTHING (Memories, Journals, Stats). The user will get a completely fresh start.")) {
            await db.clear();
            alert("Database Wiped! User will have a fresh start next time they log in.");
            window.location.reload();
        }
    },

    async resetUserStats() {
        if(confirm("Are you sure? This will reset Points, Level, and Streak but KEEP Memories and Journals.")) {
            const p = await db.getProfile();
            p.points = 0;
            p.xp = 0;
            p.level = 1;
            p.streak = 0;
            p.lastJourneyDate = null;
            p.currentJourneyStep = 1;
            await db.setProfile(p);
            alert("User stats reset! Interface will be fresh for stats.");
            await this.renderAdmin();
        }
    }
};

document.addEventListener('DOMContentLoaded', async () => await app.init());
