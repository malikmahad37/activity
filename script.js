// Global Error Handler for Debugging
window.onerror = function(msg, url, lineNo, columnNo, error) {
    alert('Error: ' + msg + '\nScript: ' + url + '\nLine: ' + lineNo + '\nColumn: ' + columnNo + '\nStackTrace: ' + (error ? error.stack : 'No stack available'));
    return false;
};


class LocalDB {
    constructor(prefix = 'bloom_') {
        this.prefix = prefix;
    }
    _getKey(c) { return this.prefix + c; }
    get(c) {
        const d = localStorage.getItem(this._getKey(c));
        return d ? JSON.parse(d) : [];
    }
    insert(c, item) {
        const d = this.get(c);
        item.id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
        item.createdAt = new Date().toISOString();
        d.push(item);
        localStorage.setItem(this._getKey(c), JSON.stringify(d));
        return item;
    }
    getProfile() {
        const p = localStorage.getItem(this.prefix + 'profile');
        if (!p) {
            const def = { 
                xp: 0, 
                points: 0,
                level: 1, 
                streak: 0, 
                lastLogin: null, 
                lastJourneyDate: null, 
                currentJourneyStep: 1, 
                journeyData: {} 
            };
            this.setProfile(def);
            return def;
        }
        return JSON.parse(p);
    }
    setProfile(p) { localStorage.setItem(this.prefix + 'profile', JSON.stringify(p)); }
    clear() {
        Object.keys(localStorage).forEach(k => { if(k.startsWith(this.prefix)) localStorage.removeItem(k); });
    }
}

const db = new LocalDB();

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

    init() {
        this.checkAuth();
        this.setupEventListeners();
        this.updateMainScreenState();
    },

    setupEventListeners() {
        // Auth
        const btnAyesha = document.getElementById('btnAyeshaLogin');
        if(btnAyesha) btnAyesha.addEventListener('click', () => this.login('ayesha'));

        const secretTrigger = document.getElementById('secretAdminTrigger');
        if(secretTrigger) {
            secretTrigger.addEventListener('click', () => {
                document.getElementById('adminLoginSection').classList.toggle('hidden');
            });
        }

        const btnAdmin = document.getElementById('btnAdminLogin');
        if(btnAdmin) {
            btnAdmin.addEventListener('click', () => {
                const u = document.getElementById('adminUsername').value;
                const p = document.getElementById('adminPassword').value;
                if(u === 'admin' && p === '12345') this.login('admin');
                else document.getElementById('authError').classList.remove('hidden');
            });
        }

        // Journey Mood Selection
        const moodBtns = document.querySelectorAll('#journeyMoodGrid .mood-btn');
        moodBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('#journeyMoodGrid .mood-btn').forEach(b => b.classList.remove('selected'));
                e.target.classList.add('selected');
                this.state.journeyData.mood = e.target.getAttribute('data-mood');
                this.logAction('mood', 'Mood Submitted', `Mood: ${this.state.journeyData.mood}`);
                this.addPoints(POINT_VALUES.mood);
                const nextBtn = document.getElementById('btnNext1');
                if(nextBtn) nextBtn.classList.remove('hidden');
            });
        });
    },

    // Auth & Basic UI
    checkAuth() {
        const isAdminPage = window.location.pathname.includes('admin.html');
        const s = sessionStorage.getItem('bloom_session');
        
        if(s) {
            if(isAdminPage && s !== 'admin') {
                this.showPanel('adminAuthPanel');
            } else {
                this.login(s);
            }
        } else {
            if(isAdminPage) this.showPanel('adminAuthPanel');
            else this.showPanel('authPanel');
        }
    },

    login(role) {
        this.state.currentUser = role;
        sessionStorage.setItem('bloom_session', role);
        if(role === 'ayesha') {
            this.showPanel('userPanel');
            this.showScreen('welcomeScreen');
            this.updateStats();
        } else {
            this.showPanel('adminPanel');
            this.renderAdmin();
        }
    },

    logout() {
        sessionStorage.removeItem('bloom_session');
        window.location.reload();
    },

    showPanel(id) {
        ['authPanel', 'userPanel', 'adminPanel', 'adminAuthPanel'].forEach(p => {
            const el = document.getElementById(p);
            if(el) el.classList.add('hidden');
        });
        const target = document.getElementById(id);
        if(target) target.classList.remove('hidden');
    },

    showScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        const target = document.getElementById(id);
        if(target) target.classList.remove('hidden');
        
        if(id === 'memoryBookScreen') this.renderMemoryBook();
        if(id === 'timelineScreen') this.renderTimeline();
        if(id === 'dashboardScreen') this.renderDashboard();
        if(id === 'logScreen') this.renderLog();
    },

    // Points & Log System
    addPoints(pts) {
        const p = db.getProfile();
        p.points += pts;
        p.xp += pts;
        if(p.xp >= p.level * 200) {
            p.xp = 0;
            p.level++;
            alert(`🎉 Level Up! You are now Level ${p.level}!`);
        }
        db.setProfile(p);
        this.updateStats();
    },

    logAction(type, title, details) {
        const entry = {
            type,
            title,
            details,
            points: POINT_VALUES[type] || 0,
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString()
        };
        db.insert('activityLog', entry);
    },

    // Journey Flow (11 Steps)
    updateMainScreenState() {
        const p = db.getProfile();
        const today = new Date().toDateString();
        const btnStart = document.getElementById('btnMainStartJourney');
        const btnCont = document.getElementById('btnMainContinueJourney');
        const msgComp = document.getElementById('todayCompletedMsg');

        if(btnStart) btnStart.classList.add('hidden');
        if(btnCont) btnCont.classList.add('hidden');
        if(msgComp) msgComp.classList.add('hidden');

        if(p.currentJourneyStep > 1) {
            if(btnCont) btnCont.classList.remove('hidden');
        } else {
            if(btnStart) {
                btnStart.classList.remove('hidden');
                if(p.lastJourneyDate === today) {
                    btnStart.innerText = "Start Another Journey 🌸";
                    if(msgComp) {
                        msgComp.classList.remove('hidden');
                        msgComp.innerText = "You've already completed a journey today, but you can start another one if you'd like!";
                    }
                } else {
                    btnStart.innerText = "Start Today's Journey";
                }
            }
        }
    },

    startJourney() {
        const p = db.getProfile();
        p.currentJourneyStep = 1;
        p.journeyData = {};
        db.setProfile(p);
        this.state.journeyStep = 1;
        this.state.journeyData = {};
        this.showScreen('journeyScreen');
        this.renderStep();
    },

    continueJourney() {
        const p = db.getProfile();
        this.state.journeyStep = p.currentJourneyStep;
        this.state.journeyData = p.journeyData;
        this.showScreen('journeyScreen');
        this.renderStep();
    },

    renderStep() {
        document.querySelectorAll('.journey-step').forEach(s => s.classList.add('hidden'));
        document.getElementById(`step${this.state.journeyStep}`).classList.remove('hidden');
        document.getElementById('currentStepNum').innerText = this.state.journeyStep;
        document.getElementById('journeyProgressBar').style.width = `${(this.state.journeyStep / 11) * 100}%`;

        // Reset step-specific next buttons if already completed in state
        this.checkStepCompletionUI();

        if(this.state.journeyStep === 2) document.getElementById('journeyMoodMsg').innerText = DATA.quotes[this.state.journeyData.mood] || "Breathe and relax.";
        if(this.state.journeyStep === 3) this.startBreatheExercise();
        if(this.state.journeyStep === 4) {
            const list = DATA.missions;
            document.getElementById('journeyMissionText').innerText = list[Math.floor(Math.random() * list.length)];
        }
        if(this.state.journeyStep === 7) {
            const list = DATA.affirmations;
            document.getElementById('journeyAffirmationText').innerText = list[Math.floor(Math.random() * list.length)];
        }
        if(this.state.journeyStep === 9) {
            const list = DATA.activities;
            document.getElementById('journeyActivityText').innerText = list[Math.floor(Math.random() * list.length)];
        }
    },

    checkStepCompletionUI() {
        // Logic to show Next button if step was previously completed (for Continue flow)
        const s = this.state.journeyStep;
        const d = this.state.journeyData;
        if(s === 1 && d.mood) document.getElementById('btnNext1').classList.remove('hidden');
        if(s === 4 && d.missionCompleted) document.getElementById('btnNext4').classList.remove('hidden');
        if(s === 5 && d.journal) document.getElementById('btnNext5').classList.remove('hidden');
        if(s === 7 && d.affirmationDone) document.getElementById('btnNext7').classList.remove('hidden');
        if(s === 8 && d.blessing) document.getElementById('btnNext8').classList.remove('hidden');
        if(s === 9 && d.activityDone) document.getElementById('btnNext9').classList.remove('hidden');
        if(s === 10 && d.oldMemoryDone) document.getElementById('btnNext10').classList.remove('hidden');
    },

    nextStep() {
        if(this.state.journeyStep < 11) {
            this.state.journeyStep++;
            const p = db.getProfile();
            p.currentJourneyStep = this.state.journeyStep;
            p.journeyData = this.state.journeyData;
            db.setProfile(p);
            this.renderStep();
        }
    },

    prevStep() {
        if(this.state.journeyStep > 1) {
            this.state.journeyStep--;
            this.renderStep();
        }
    },

    completeStepAction(type) {
        if(type === 'mission') {
            const notes = document.getElementById('missionNotesJ').value;
            const file = document.getElementById('missionPhotoJ').files[0];
            const missionText = document.getElementById('journeyMissionText').innerText;

            const finalizeMission = (photoBase64 = null) => {
                this.state.journeyData.mission = {
                    text: missionText,
                    notes: notes,
                    photo: photoBase64
                };
                this.state.journeyData.missionCompleted = true;
                this.logAction('mission', 'Daily Mission Completed', `Task: ${missionText}`);
                this.addPoints(POINT_VALUES.mission);
                document.getElementById('btnNext4').classList.remove('hidden');
                alert("Mission details saved! ✨");
            };

            if(file) {
                const reader = new FileReader();
                reader.onload = (e) => finalizeMission(e.target.result);
                reader.readAsDataURL(file);
            } else {
                finalizeMission();
            }
        }
        if(type === 'journal') {
            this.state.journeyData.journal = {
                feeling: document.getElementById('jFeelingJ').value,
                reason: document.getElementById('jReasonJ').value,
                gratitude: document.getElementById('jGratitudeJ').value,
                improve: document.getElementById('jImproveJ').value
            };
            this.logAction('journal', 'Journal Saved', 'Step 5 complete');
            this.addPoints(POINT_VALUES.journal);
            document.getElementById('btnNext5').classList.remove('hidden');
        }
        if(type === 'photo') {
            const file = document.getElementById('imgUploadJ').files[0];
            if(file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.state.journeyData.photo = { base64: e.target.result, caption: document.getElementById('imgCaptionJ').value };
                    this.logAction('photo', 'Daily Photo Uploaded', 'Step 6 complete');
                    this.addPoints(POINT_VALUES.photo);
                    alert("Photo uploaded!");
                };
                reader.readAsDataURL(file);
            }
        }
        if(type === 'affirmation') {
            this.state.journeyData.affirmationDone = true;
            this.logAction('affirmation', 'Affirmation Completed', 'Step 7 complete');
            this.addPoints(POINT_VALUES.affirmation);
            document.getElementById('btnNext7').classList.remove('hidden');
        }
        if(type === 'blessing') {
            const b = document.getElementById('blessingJ').value;
            if(!b) return;
            this.state.journeyData.blessing = b;
            this.logAction('blessing', 'Blessing Added', 'Step 8 complete');
            this.addPoints(POINT_VALUES.blessing);
            db.insert('blessings', { text: b });
            document.getElementById('btnNext8').classList.remove('hidden');
        }
        if(type === 'activity') {
            const file = document.getElementById('activityPhotoJ').files[0];
            const activityText = document.getElementById('journeyActivityText').innerText;

            const finalizeActivity = (photoBase64 = null) => {
                this.state.journeyData.activity = {
                    text: activityText,
                    photo: photoBase64
                };
                this.state.journeyData.activityDone = true;
                this.logAction('activity', 'Activity Completed', `Task: ${activityText}`);
                this.addPoints(POINT_VALUES.breathe); // Activity points
                const nextBtn = document.getElementById('btnNext9');
                if(nextBtn) nextBtn.classList.remove('hidden');
                alert("Activity saved! ✨");
            };

            if(file) {
                const reader = new FileReader();
                reader.onload = (e) => finalizeActivity(e.target.result);
                reader.readAsDataURL(file);
            } else {
                finalizeActivity();
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
            db.insert('memories', m);
            this.state.journeyData.oldMemoryDone = true;
            this.logAction('old_memory', 'Old Memory Added', `Step 10: ${m.title}`);
            this.addPoints(POINT_VALUES.old_memory);
            document.getElementById('btnNext10').classList.remove('hidden');
            this.state.tempImagesJ = [];
        }
    },

    startBreatheExercise() {
        let sec = 60;
        const text = document.getElementById('journeyBreatheTimer');
        const circle = document.getElementById('journeyBreatheCircle');
        if(this.state.breatheTimer) clearInterval(this.state.breatheTimer);
        this.state.breatheTimer = setInterval(() => {
            sec--;
            text.innerText = `${sec} seconds`;
            circle.innerText = sec % 8 < 4 ? "Inhale..." : "Exhale...";
            if(sec <= 0) {
                clearInterval(this.state.breatheTimer);
                this.logAction('breathe', 'Breathing Completed', 'Step 3 complete');
                this.addPoints(POINT_VALUES.breathe);
                document.getElementById('btnNext3').classList.remove('hidden');
            }
        }, 1000);
    },

    finishJourney() {
        const p = db.getProfile();
        const today = new Date().toDateString();
        
        // Only increment streak once per day
        if(p.lastJourneyDate !== today) {
            p.streak++;
        }
        
        p.lastJourneyDate = today;
        p.currentJourneyStep = 1;
        db.setProfile(p);

        this.addPoints(POINT_VALUES.journey_complete);
        this.logAction('journey_complete', 'Daily Journey Completed', 'Full 11 steps finished');
        db.insert('dailyJourneys', { date: p.lastJourneyDate, data: this.state.journeyData });
        
        this.showScreen('welcomeScreen');
        this.updateMainScreenState();
    },

    // Memories
    previewImages(e, target) {
        const files = e.target.files;
        const prev = document.getElementById(target);
        prev.innerHTML = '';
        const imgList = [];
        Array.from(files).forEach(f => {
            const r = new FileReader();
            r.onload = (ev) => {
                const img = document.createElement('img');
                img.src = ev.target.result;
                img.className = 'preview-img';
                prev.appendChild(img);
                imgList.push(ev.target.result);
            };
            r.readAsDataURL(f);
        });
        if(target === 'mPreviewJ') this.state.tempImagesJ = imgList;
        else this.state.tempImages = imgList;
    },

    saveMemory() {
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
        db.insert('memories', m);
        this.logAction('old_memory', 'New Memory Added', m.title);
        this.addPoints(POINT_VALUES.old_memory);
        this.closeModal('memoryModal');
        this.renderMemoryBook();
    },

    renderMemoryBook() {
        const grid = document.getElementById('memoryBookGrid');
        grid.innerHTML = '';
        db.get('memories').reverse().forEach(m => {
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

    openRandomMemory() {
        const list = db.get('memories');
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
    updateStats() {
        const p = db.getProfile();
        ['uiLevel', 'dashLevel'].forEach(id => { if(document.getElementById(id)) document.getElementById(id).innerText = p.level; });
        ['uiStreak', 'dashStreak'].forEach(id => { if(document.getElementById(id)) document.getElementById(id).innerText = p.streak; });
        ['uiPoints', 'dashPoints'].forEach(id => { if(document.getElementById(id)) document.getElementById(id).innerText = p.points; });
        
        if(document.getElementById('uiXpBar')) document.getElementById('uiXpBar').style.width = `${(p.xp / (p.level * 200)) * 100}%`;
        
        if(document.getElementById('dashTodayPoints')) {
            const today = new Date().toLocaleDateString();
            const todayPts = db.get('activityLog').filter(l => l.date === today).reduce((sum, l) => sum + l.points, 0);
            document.getElementById('dashTodayPoints').innerText = todayPts;
        }
    },

    renderDashboard() {
        this.updateStats();
        const logs = db.get('activityLog').reverse().slice(0, 5);
        const cont = document.getElementById('dashRecentLog');
        cont.innerHTML = logs.map(l => `<p style="font-size:0.8rem; border-bottom:1px solid #eee; padding:5px 0;">[${l.time}] ${l.title} (+${l.points} pts)</p>`).join('');
        
        const latestM = db.get('memories').slice(-1)[0];
        if(latestM) document.getElementById('dashLatestMemory').innerText = latestM.title;
    },

    renderLog() {
        const logs = db.get('activityLog').reverse();
        document.getElementById('totalActions').innerText = logs.length;
        document.getElementById('fullLogList').innerHTML = logs.map(l => `
            <div style="background:white; padding:10px; border-radius:10px; margin-bottom:10px; border-left:4px solid var(--blush-pink);">
                <strong>${l.date} ${l.time}</strong><br>${l.title}: ${l.details} (+${l.points} pts)
            </div>
        `).join('');
    },

    // Admin Panel Logic
    showAdminTab(e, tabId) {
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.add('hidden'));
        document.querySelectorAll('.admin-nav-item').forEach(b => b.classList.remove('active'));
        const tabEl = document.getElementById(`adminTab${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`);
        if(tabEl) tabEl.classList.remove('hidden');
        if(e && e.target) e.target.classList.add('active');
        this.renderAdmin();
    },

    startJourney() {
        this.state.journeyStep = 1;
        this.state.journeyData = { mood: '', mission: null, activity: null, journal: null, oldMemoryDone: false };
        
        // Reset Inputs
        if(document.getElementById('missionNotesJ')) document.getElementById('missionNotesJ').value = '';
        if(document.getElementById('missionPhotoJ')) document.getElementById('missionPhotoJ').value = '';
        if(document.getElementById('activityPhotoJ')) document.getElementById('activityPhotoJ').value = '';
        
        document.getElementById('journeySteps').classList.remove('hidden');
        this.renderStep();
    },

    skipBreathe() {
        if(this.state.breatheTimer) clearInterval(this.state.breatheTimer);
        this.logAction('breathe', 'Breathing Skipped', 'Step 3 skipped by user');
        document.getElementById('btnNext3').classList.remove('hidden');
        alert("It's okay to skip! Take a deep breath whenever you are ready. ✨");
    },

    refreshTask(type) {
        if(type === 'mission') {
            const list = DATA.missions;
            const current = document.getElementById('journeyMissionText').innerText;
            let next = list[Math.floor(Math.random() * list.length)];
            while(next === current) next = list[Math.floor(Math.random() * list.length)];
            document.getElementById('journeyMissionText').innerText = next;
        }
        if(type === 'activity') {
            const list = DATA.activities;
            const current = document.getElementById('journeyActivityText').innerText;
            let next = list[Math.floor(Math.random() * list.length)];
            while(next === current) next = list[Math.floor(Math.random() * list.length)];
            document.getElementById('journeyActivityText').innerText = next;
        }
    },

    downloadImage(base64, filename) {
        const a = document.createElement('a');
        a.href = base64;
        a.download = filename || 'bloom_image.png';
        a.click();
    },

    renderAdmin() {
        const p = db.getProfile();
        const logs = db.get('activityLog').reverse();
        const journeys = db.get('dailyJourneys').reverse();
        const memories = db.get('memories').reverse();

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
                
                // Extract mission details from the first journey of the day if exists
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

        // Logs
        const tbodyL = document.querySelector('#adminLogTable tbody');
        if(tbodyL) {
            tbodyL.innerHTML = logs.map(l => `
                <tr><td>${l.date} ${l.time}</td><td>${l.title}</td><td>${l.details}</td><td>${l.points}</td></tr>
            `).join('');
        }

        // Journals (Extracted from Daily Journeys)
        const tbodyJ = document.querySelector('#adminJournalTable tbody');
        if(tbodyJ) {
            const journals = journeys.filter(j => j.data && j.data.journal).map(j => ({
                date: j.date,
                mood: j.data.mood,
                feeling: j.data.journal.feeling,
                reason: j.data.journal.reason,
                gratitude: j.data.journal.gratitude
            }));
            
            tbodyJ.innerHTML = journals.map(j => `
                <tr>
                    <td>${j.date}</td>
                    <td><span class="mood-tag" style="background:var(--lavender);">${j.mood}</span></td>
                    <td><strong>Feelings:</strong> ${j.feeling}<br><strong>Reason:</strong> ${j.reason}</td>
                    <td>${j.gratitude}</td>
                </tr>
            `).join('');
        }

        // Memories
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

    exportData() {
        const data = {
            profile: db.getProfile(),
            journals: db.get('journals'),
            memories: db.get('memories'),
            dailyJourneys: db.get('dailyJourneys'),
            activityLog: db.get('activityLog'),
            blessings: db.get('blessings'),
            affirmations: db.get('affirmations')
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `ayesha_bloom_backup_${new Date().getTime()}.json`; a.click();
    },

    resetFullUser() {
        if(confirm("Are you sure? This will delete EVERYTHING (Memories, Journals, Stats). The user will get a completely fresh start.")) {
            db.clear();
            alert("Database Wiped! User will have a fresh start next time they log in.");
            window.location.reload();
        }
    },

    resetUserStats() {
        if(confirm("Are you sure? This will reset Points, Level, and Streak but KEEP Memories and Journals.")) {
            const p = db.getProfile();
            p.points = 0;
            p.xp = 0;
            p.level = 1;
            p.streak = 0;
            p.lastJourneyDate = null;
            p.currentJourneyStep = 1;
            db.setProfile(p);
            alert("User stats reset! Interface will be fresh for stats.");
            this.renderAdmin();
        }
    },

    openModal(id) { document.getElementById(id).classList.remove('hidden'); },
    closeModal(id) { document.getElementById(id).classList.add('hidden'); },
    openRandomBlessing() {
        const b = db.get('blessings');
        if(!b.length) return alert("Jar is empty!");
        document.getElementById('randomBlessingDisplay').innerText = `"${b[Math.floor(Math.random() * b.length)].text}"`;
    },

    renderTimeline() {
        const logs = db.get('activityLog').reverse();
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

    startCalmMode() {
        this.showScreen('calmModeScreen');
        let sec = 60;
        const text = document.getElementById('calmBreatheTimer');
        const circle = document.getElementById('calmBreatheCircle');
        if(this.state.calmTimer) clearInterval(this.state.calmTimer);
        
        this.state.calmTimer = setInterval(() => {
            sec--;
            if(text) text.innerText = `${sec} seconds`;
            if(circle) circle.innerText = sec % 8 < 4 ? "Inhale..." : "Exhale...";
            
            if(sec <= 0) {
                clearInterval(this.state.calmTimer);
                alert("Calm Mode Finished. Alhamdulillah. ✨");
                this.showScreen('welcomeScreen');
            }
        }, 1000);
    }
};

document.addEventListener('DOMContentLoaded', () => app.init());
