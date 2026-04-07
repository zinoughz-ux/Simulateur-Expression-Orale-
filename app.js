/* ================================================
   TCF CANADA — Expression Orale Simulator
   Core Application Logic
   ================================================ */

(function () {
    'use strict';

    // 🔬 Contrôle de compatibilité du navigateur
    const checkCompatibility = () => {
        const isIE = /*@cc_on!@*/false || !!document.documentMode;
        if (isIE) {
            alert("❌ Erreur : Internet Explorer n'est pas supporté.\nVeuillez utiliser Google Chrome, Microsoft Edge ou Firefox.");
            return false;
        }

        const missing = [];
        if (!window.fetch) missing.push("Fetch API (Communication Serveur)");
        if (!window.MediaRecorder) missing.push("MediaRecorder (Enregistrement Audio)");
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) missing.push("Microphone Access (Accès Micro)");
        
        if (missing.length > 0) {
            alert("⚠️ Votre navigateur est trop ancien !\n\nLe simulateur risque de ne pas fonctionner car les fonctions suivantes manquent :\n- " + missing.join("\n- ") + "\n\nCONSEIL : Installez Google Chrome ou Firefox sur ce PC.");
            return false;
        }
        return true;
    };

    if (!checkCompatibility()) {
        const body = document.querySelector('body');
        if (body) body.innerHTML = '<div style="color:white; background:#1e293b; height:100vh; display:flex; align-items:center; justify-content:center; text-align:center; padding:20px; font-family:sans-serif;"><div><h1 style="color:#ef4444;">Navigateur non supporté</h1><p>Veuillez utiliser un navigateur moderne (Chrome, Edge, Firefox) pour faire tourner ce simulateur.</p></div></div>';
        return;
    }

    const CONFIG = {
        // L'URL pointe maintenant vers votre backend local pour plus de sécurité
        API_URL: '/api/chat',
        DEFAULT_MODEL: 'github',
        STORAGE_KEY: 'tcf_simulator_data',
        SETTINGS_KEY: 'tcf_simulator_settings',
        // Modèles supportés via votre proxy Node.js
        SUPPORTED_MODELS: [
            { id: 'github', name: 'GitHub AI - GPT-4o mini (Stable ⭐)' },
            { id: 'nvidia', name: 'NVIDIA Llama 3.1 (Haut de gamme)' }
        ],
    };

    // ========== TASK DEFINITIONS ==========
    const TASKS = {
        1: {
            id: 1,
            name: 'Entretien dirigé',
            fullName: 'Tâche 1 — Entretien dirigé',
            totalSeconds: 120, // 2 minutes
            prepSeconds: 0,
            speakSeconds: 120,
            hasPrep: false,
            description: 'Échange simple avec l\'examinateur pour se présenter.',
        },
        2: {
            id: 2,
            name: 'Exercice en interaction',
            fullName: 'Tâche 2 — Exercice en interaction',
            totalSeconds: 330, // 5 min 30
            prepSeconds: 120,  // 2 minutes prep incluses
            speakSeconds: 210, // 3 min 30
            hasPrep: true,
            description: 'Le candidat pose des questions à l\'examinateur sur un sujet de la vie quotidienne.',
        },
        3: {
            id: 3,
            name: 'Expression d\'un point de vue',
            fullName: 'Tâche 3 — Expression d\'un point de vue',
            totalSeconds: 270, // 4 min 30
            prepSeconds: 0,
            speakSeconds: 270,
            hasPrep: false,
            description: 'Le candidat donne son opinion sur un sujet, en argumentant pour convaincre.',
        },
    };

    // ========== STATE ==========
    const state = {
        currentScreen: 'landing',
        currentTask: null,
        currentPhase: null, // 'prep' or 'speak'
        promptSource: 'ai',
        isFullExam: false,
        fullExamQueue: [],

        // Timer
        timerInterval: null,
        timerStartTime: null,
        timerDuration: 0,
        timerRemaining: 0,

        // Audio recording
        mediaRecorder: null,
        audioChunks: [],
        audioBlob: null,
        audioUrl: null,
        audioStream: null,
        audioContext: null,
        analyser: null,
        animFrameId: null,

        // Playback
        audioElement: null,

        // Streaming
        abortController: null,

        // Session
        sessionStart: null,
        sessionData: null,
        transcript: '',
        currentTurnTranscript: '',
        conversation: [],
        silenceTimer: null,
        recognition: null,
    };

    // ========== DOM REFERENCES ==========
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const DOM = {
        // Screens
        screenLanding: $('#screen-landing'),
        screenSetup: $('#screen-setup'),
        screenExam: $('#screen-exam'),
        screenResults: $('#screen-results'),
        screenHistory: $('#screen-history'),

        // Header
        btnTheme: $('#btn-theme'),
        iconSun: $('#icon-sun'),
        iconMoon: $('#icon-moon'),

        // Landing
        btnFullExam: $('#btn-full-exam'),

        // Setup
        btnBackLanding: $('#btn-back-landing'),
        setupTaskBadge: $('#setup-task-badge'),
        setupTaskTitle: $('#setup-task-title'),
        toggleAi: $('#toggle-ai'),
        toggleCustom: $('#toggle-custom'),
        aiTopicGroup: $('#ai-topic-group'),
        customPromptGroup: $('#custom-prompt-group'),
        aiTopicInput: $('#ai-topic-input'),
        btnRandomSubject: $('#btn-random-subject'),
        customPromptInput: $('#custom-prompt-input'),
        btnBeginTask: $('#btn-begin-task'),

        // Exam
        examTaskBadge: $('#exam-task-badge'),
        examTaskName: $('#exam-task-name'),
        examPhaseIndicator: $('#exam-phase-indicator'),
        phaseLabel: $('#phase-label'),
        timerRingProgress: $('#timer-ring-progress'),
        timerTime: $('#timer-time'),
        timerPhaseLabel: $('#timer-phase-label'),
        promptCard: $('#prompt-card'),
        promptText: $('#prompt-text'),
        recordingSection: $('#recording-section'),
        recordingIndicator: $('#recording-indicator'),
        audioVisualizer: $('#audio-visualizer'),
        btnStopExam: $('#btn-stop-exam'),

        // Results
        resultsSubtitle: $('#results-subtitle'),
        feedbackSection: $('#feedback-section'),
        feedbackStreamingBadge: $('#feedback-streaming-badge'),
        feedbackContent: $('#feedback-content'),
        playbackSection: $('#playback-section'),
        btnPlayPause: $('#btn-play-pause'),
        iconPlay: $('#icon-play'),
        iconPause: $('#icon-pause'),
        playerBarFill: $('#player-bar-fill'),
        playerBar: $('.player-bar'),
        playerCurrent: $('#player-current'),
        playerDuration: $('#player-duration'),
        btnDownload: $('#btn-download'),
        btnRetry: $('#btn-retry'),
        btnNextTask: $('#btn-next-task'),
        btnHome: $('#btn-home'),

        // History
        btnHistory: $('#btn-history'),
        btnBackHistory: $('#btn-back-history'),
        historyStats: $('#history-stats'),
        historyList: $('#history-list'),
        btnClearHistory: $('#btn-clear-history'),

        // Settings
        btnSettings: $('#btn-settings'),
        btnCloseSettings: $('#btn-close-settings'),
        modalSettings: $('#modal-settings'),
        settingModel: $('#setting-model'),
        settingSounds: $('#setting-sounds'),
        btnSyncSubjects: $('#btn-sync-subjects'),
        syncIcon: $('#sync-icon'),
        btnSaveSettings: $('#btn-save-settings'),
    };

    // ========== SOUNDS (Web Audio API synthesized) ==========
    const Sounds = {
        _ctx: null,
        _enabled: true,

        _getCtx() {
            if (!this._ctx) {
                this._ctx = new (window.AudioContext || window.webkitAudioContext)();
            }
            return this._ctx;
        },

        play(type) {
            if (!this._enabled) return;
            try {
                const ctx = this._getCtx();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);

                switch (type) {
                    case 'start':
                        osc.frequency.value = 660;
                        gain.gain.setValueAtTime(0.15, ctx.currentTime);
                        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
                        osc.start(ctx.currentTime);
                        osc.stop(ctx.currentTime + 0.4);
                        break;
                    case 'transition':
                        osc.frequency.value = 880;
                        gain.gain.setValueAtTime(0.12, ctx.currentTime);
                        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
                        osc.start(ctx.currentTime);
                        osc.stop(ctx.currentTime + 0.6);
                        // Second tone
                        setTimeout(() => {
                            const osc2 = ctx.createOscillator();
                            const gain2 = ctx.createGain();
                            osc2.connect(gain2);
                            gain2.connect(ctx.destination);
                            osc2.frequency.value = 1046;
                            gain2.gain.setValueAtTime(0.12, ctx.currentTime);
                            gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
                            osc2.start(ctx.currentTime);
                            osc2.stop(ctx.currentTime + 0.4);
                        }, 200);
                        break;
                    case 'end':
                        osc.frequency.value = 523;
                        osc.type = 'sine';
                        gain.gain.setValueAtTime(0.15, ctx.currentTime);
                        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
                        osc.start(ctx.currentTime);
                        osc.stop(ctx.currentTime + 0.8);
                        setTimeout(() => {
                            const osc2 = ctx.createOscillator();
                            const gain2 = ctx.createGain();
                            osc2.connect(gain2);
                            gain2.connect(ctx.destination);
                            osc2.frequency.value = 392;
                            gain2.gain.setValueAtTime(0.12, ctx.currentTime);
                            gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
                            osc2.start(ctx.currentTime);
                            osc2.stop(ctx.currentTime + 0.6);
                        }, 300);
                        break;
                    case 'tick':
                        osc.frequency.value = 1000;
                        osc.type = 'sine';
                        gain.gain.setValueAtTime(0.08, ctx.currentTime);
                        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
                        osc.start(ctx.currentTime);
                        osc.stop(ctx.currentTime + 0.08);
                        break;
                }
            } catch (e) {
                // Silent fail for audio
            }
        },
    };

    // ========== UTILITY FUNCTIONS ==========
    function formatTime(totalSeconds) {
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    function formatTimeShort(totalSeconds) {
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        return s === 0 ? `${m}:00` : `${m}:${String(s).padStart(2, '0')}`;
    }

    function formatDate(dateStr) {
        const d = new Date(dateStr);
        return d.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    function speakText(text, cancelPrevious = true) {
        if (!window.speechSynthesis || !Sounds._enabled) return;
        if (cancelPrevious) window.speechSynthesis.cancel();

        // Nettoyage sommaire du markdown pour la lecture
        let cleanText = text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/<[^>]*>?/gm, '').replace(/###/g, '');

        // Découpage par ponctuation pour une lecture fluide
        let parts = cleanText.split(/([.!?\n]+)/);
        let sentences = [];
        for (let i = 0; i < parts.length; i += 2) {
            let s = parts[i] + (parts[i + 1] || '');
            if (s.trim()) sentences.push(s.trim());
        }

        sentences.forEach(sentence => {
            const utterance = new SpeechSynthesisUtterance(sentence);
            utterance.lang = 'fr-FR';
            utterance.rate = 1.05; // Très légèrement plus rapide pour le naturel
            window.speechSynthesis.speak(utterance);
        });
    }

    // ========== STORAGE ==========
    const Storage = {
        getSessions() {
            try {
                const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
                return raw ? JSON.parse(raw) : [];
            } catch {
                return [];
            }
        },

        saveSession(session) {
            const sessions = this.getSessions();
            sessions.unshift(session);
            // Keep last 100
            if (sessions.length > 100) sessions.length = 100;
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(sessions));
        },

        clearSessions() {
            localStorage.removeItem(CONFIG.STORAGE_KEY);
        },

        getSettings() {
            try {
                const raw = localStorage.getItem(CONFIG.SETTINGS_KEY);
                return raw ? JSON.parse(raw) : {};
            } catch {
                return {};
            }
        },

        saveSettings(settings) {
            localStorage.setItem(CONFIG.SETTINGS_KEY, JSON.stringify(settings));
        },
    };

    // ========== BACKEND API ==========
    const API = {
        getModel() {
            const settings = Storage.getSettings();
            return settings.model || CONFIG.DEFAULT_MODEL;
        },

        _getSystemPrompt(taskId) {
            switch (taskId) {
                case 1:
                    return `Tu es un examinateur du TCF Canada pour l'épreuve d'expression orale, Tâche 1 (Entretien dirigé).
Génère EXACTEMENT 2 questions d'entretien pertinentes et variées en français pour un échange simple où le candidat se présente.
Les questions doivent être claires et laisser au candidat le temps de développer son propos.
Numérote les questions. Ne donne pas de réponses, seulement les questions.
Commence directement par les questions sans introduction superflue.`;

                case 2:
                    return `Tu es un examinateur du TCF Canada pour l'épreuve d'expression orale, Tâche 2 (Interaction).
Ta mission est de générer un sujet à partir de cette LISTE DE SUJETS RÉELS ou de t'en inspirer fortement :
- Invitation concert, atelier cuisine, restaurant Toronto, école Edmonton, transports ville, mariage Québec, garde chien, stage pro Québec, sorties quartier, location appart, baby-sitting, randonnée forêt, colocation, installation Canada, location vélos, festival musique, Nouvel An Canada, musée Vancouver, vêtements enfant, croisière.

Le scénario doit :
1. Présenter une situation de la vie quotidienne au Canada ou en pays francophone.
2. Expliquer que le candidat doit te poser des questions (tu joues le rôle de l'ami, voisin ou employé).
3. Être court, clair et motivant.
Commence directement par le scénario.`;

                case 3:
                    return `Tu es un examinateur du TCF Canada pour l'épreuve d'expression orale, Tâche 3 (Point de vue).
Ta mission est de proposer un sujet de débat à partir de cette LISTE DE SUJETS RÉELS ou de t'en inspirer fortement :
- Technologie (vivre sans), chirurgie esthétique, emploi des jeunes, sport obligatoire, impact du tourisme, téléphone aux enfants, gratuité transports, travailler moins pour vivre mieux, campagne vs ville, voyage pour riches, reconversion pro, langue du pays, environnement vs tourisme, surveillance des enfants, jeux vidéo, culture d'origine, télétravail, autorité parentale, parité politique, alimentation bio.

Le sujet doit appeler une réponse argumentée pour CONVAINCRE.
Commence directement par le sujet.`;
            }
        },

        async _callBackend(payload, onChunk, onDone, onError) {
            state.abortController = new AbortController();
            const signal = state.abortController.signal;

            try {
                const response = await fetch(CONFIG.API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        ...payload,
                        stream: !!onChunk
                    }),
                    signal: signal,
                });

                if (!response.ok) {
                    const errBody = await response.json().catch(() => ({ error: 'Erreur inconnue' }));
                    throw new Error(errBody.error || `Erreur serveur: ${response.status}`);
                }

                if (onChunk) {
                    const reader = response.body.getReader();
                    const decoder = new TextDecoder();
                    let buffer = '';
                    let fullText = '';

                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split('\n');
                        buffer = lines.pop() || '';

                        for (const line of lines) {
                            const trimmed = line.trim();
                            if (!trimmed || !trimmed.startsWith('data: ')) continue;
                            const data = trimmed.slice(6);
                            if (data === '[DONE]') continue;

                            try {
                                const parsed = JSON.parse(data);
                                const content = parsed.choices?.[0]?.delta?.content;
                                if (content) {
                                    fullText += content;
                                    onChunk(content, fullText);
                                }
                            } catch { }
                        }
                    }
                    if (onDone) onDone(fullText);
                } else {
                    const result = await response.json();
                    return result;
                }

            } catch (err) {
                if (err.name === 'AbortError') return;
                console.error("Erreur Backend:", err);
                if (onError) onError(err);
                else throw err;
            }
        },

        async streamPrompt(taskId, topic, onChunk, onDone, onError) {
            const model = this.getModel();
            const systemPrompt = this._getSystemPrompt(taskId);

            let userMessage = 'Génère un sujet d\'examen.';
            if (topic && topic.trim()) {
                userMessage = `Génère un sujet d'examen sur le thème suivant : "${topic.trim()}"`;
            }

            await this._callBackend({
                model: model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessage },
                ],
                max_tokens: 500,
                temperature: 0.8,
            }, onChunk, onDone, onError);
        },

        async streamFeedback(taskId, prompt, transcript, onChunk, onDone, onError) {
            const model = this.getModel();

            const taskPrompts = {
                1: "Critères : Aisance et fluidité (répondre sans hésitations), Précision des informations (détails sur parcours, goûts, projets), Correction grammaticale (temps de base).",
                2: "Critères : Capacité d'interaction (engager et réagir), Variété des questions (structures interrogatives), Pertinence des relances (demander des précisions).",
                3: "Critères : Organisation du discours (intro, développement, conclusion), Argumentation (arguments logiques et exemples), Richesse lexicale et syntaxique (vocabulaire précis, connecteurs logiques)."
            };

            const systemPrompt = `Tu es un examinateur expert du TCF Canada. Tu dois évaluer et faire une correction réelle de la performance du candidat à l'épreuve d'expression orale.
Tâche : ${taskId === 1 ? 'Tâche 1 (Entretien dirigé)' : taskId === 2 ? 'Tâche 2 (Exercice en interaction)' : 'Tâche 3 (Expression d\'un point de vue)'}.

CRITÈRES SPÉCIFIQUES À CETTE TÂCHE :
${taskPrompts[taskId]}

CRITÈRES GÉNÉRAUX D'ÉVALUATION (Transversaux) :
- Respecter les consignes : Répondre précisément au sujet et respecter le temps imparti.
- Prononciation et intonation : Le rythme doit être intelligible et naturel.
- Communiquer clairement : Transmettre un message compréhensible.
- Structurer le discours : Utiliser des connecteurs logiques (donc, par contre, de plus).
- Utiliser un lexique varié : Employer un vocabulaire précis, éviter les répétitions.
- Maîtriser la grammaire : Utiliser des structures complexes et différents temps.
- Argumenter et convaincre : Développer des points de vue, justifier.

MODALITÉS DE CORRECTION :
- Fais une CORRECTION RÉELLE et détaillée de la transcription fournie. Relève avec précision les erreurs de grammaire, de vocabulaire et de syntaxe, et propose la version corrigée de ses phrases. Si le texte semble avoir des fautes de transcription audio, fais preuve de discernement.
- Évalue l'ensemble des critères.
- Attribue un "Score /20" et donne le "Niveau CECRL" et le "Niveau NCLC" correspondants (très important pour les dossiers d'immigration canadien) :
  16 à 20 = C1 - C2 / NCLC 10 et plus
  14 à 15 = C1 / NCLC 9
  12 à 13 = B2 / NCLC 8
  10 à 11 = B2 / NCLC 7
  7 à 9 = B1 / NCLC 6
  6 = B1 / NCLC 5
  4 à 5 = A2 / NCLC 4

Structure ta réponse clairement :
1. **Commentaires généraux**
2. **Correction détaillée de la transcription**
3. **Analyse selon les critères (spécifiques et généraux)**
4. **Note globale (Score /20, Niveau CECRL, Niveau NCLC)**`;

            let userMessage = `Le sujet donné au candidat était :\n"${prompt}"\n\n`;

            const cleanTranscript = transcript ? transcript.trim() : "";

            if (cleanTranscript.length > 0) {
                userMessage += `Transcription brute de la réponse du candidat (obtenue par reconnaissance vocale) :\n« ${cleanTranscript} »\n\n`;

                if (cleanTranscript.split(' ').length < 10) {
                    userMessage += `⚠️ ATTENTION : Le candidat a parlé très brièvement (${cleanTranscript.split(' ').length} mots). \n`;
                    userMessage += `Ta mission est de l'évaluer STRICTEMENT sur ces quelques mots. Ne complète pas sa pensée. Ne dis pas ce qu'il aurait dû dire à ce stade. \n`;
                    userMessage += `Relève les erreurs dans ces quelques mots, donne une note TRÈS FAIBLE (ex: 2/20 ou 4/20) car la production est insuffisante pour le test, et explique que la réponse est trop courte pour être évaluée positivement selon les critères du TCF.\n`;
                } else {
                    userMessage += `IMPORTANT: Ta SEULE mission est d'évaluer et corriger cette transcription avec précision. Analyse ce qui a été prononcé, relève les erreurs, donne le score réel, point final.`;
                }

                userMessage += `\n\nINTERDICTION ABSOLUE : ne fournis AUCUN exemple de réponse idéale, aucun "modèle" et ne suggère pas qu'il y a un problème technique. Si le texte est court, note-le sévèrement mais évalue-le tel quel.`;
            } else {
                userMessage += `Le candidat n'a pas du tout parlé (transcription vide). \n`;
                userMessage += `1. Attribue la note de 0/20 (Niveau < A1 / NCLC 0).\n`;
                userMessage += `2. Explique que sans production orale, aucune évaluation n'est possible.\n`;
                userMessage += `3. SEULEMENT ENSUITE, donne un exemple de ce qu'il aurait pu dire pour ce sujet à titre pédagogique.`;
            }

            await this._callBackend({
                model: model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessage },
                ],
                max_tokens: 1500,
                temperature: 0.3,
            }, onChunk, onDone, onError);
        },

        abortStream() {
            if (state.abortController) {
                state.abortController.abort();
                state.abortController = null;
            }
        },
    };

    // ========== AUDIO RECORDING ==========
    const Recorder = {
        async requestPermission() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        sampleRate: 44100,
                    },
                });
                return stream;
            } catch (err) {
                console.error('Mic error:', err);
                throw new Error(`Accès au microphone impossible. Raison: ${err.message || 'Permission refusée'}.\n\nSi vous êtes sur Chrome avec un fichier local, vérifiez que le micro n'est pas bloqué en haut à droite de l'URL, ou utilisez un serveur local.`);
            }
        },

        async start() {
            const stream = await this.requestPermission();
            state.audioStream = stream;
            state.audioChunks = [];

            // Setup analyser for visualization
            state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = state.audioContext.createMediaStreamSource(stream);
            state.analyser = state.audioContext.createAnalyser();
            state.analyser.fftSize = 64;
            source.connect(state.analyser);

            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : MediaRecorder.isTypeSupported('audio/webm')
                    ? 'audio/webm'
                    : 'audio/mp4';

            state.mediaRecorder = new MediaRecorder(stream, { mimeType });

            state.mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    state.audioChunks.push(e.data);
                }
            };

            state.mediaRecorder.onstop = () => {
                state.audioBlob = new Blob(state.audioChunks, { type: mimeType });
                state.audioUrl = URL.createObjectURL(state.audioBlob);
            };

            state.mediaRecorder.start(100); // Collect data every 100ms
            this._startVisualization();
        },

        pause() {
            if (state.mediaRecorder && state.mediaRecorder.state === 'recording') {
                state.mediaRecorder.pause();
            }
            this._stopVisualization();
        },

        resume() {
            if (state.mediaRecorder && state.mediaRecorder.state === 'paused') {
                state.mediaRecorder.resume();
            }
            this._startVisualization();
        },

        stop() {
            return new Promise((resolve) => {
                if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
                    state.mediaRecorder.onstop = () => {
                        const mimeType = state.mediaRecorder.mimeType;
                        state.audioBlob = new Blob(state.audioChunks, { type: mimeType });
                        state.audioUrl = URL.createObjectURL(state.audioBlob);
                        resolve();
                    };
                    state.mediaRecorder.stop();
                } else {
                    resolve();
                }

                this._stopVisualization();

                if (state.audioStream) {
                    state.audioStream.getTracks().forEach((t) => t.stop());
                    state.audioStream = null;
                }

                if (state.audioContext) {
                    state.audioContext.close().catch(() => { });
                    state.audioContext = null;
                }
            });
        },

        _startVisualization() {
            if (!state.analyser) return;
            const bars = DOM.audioVisualizer.querySelectorAll('.viz-bar');
            const bufferLength = state.analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            const draw = () => {
                state.animFrameId = requestAnimationFrame(draw);
                state.analyser.getByteFrequencyData(dataArray);

                bars.forEach((bar, i) => {
                    const idx = Math.floor((i / bars.length) * bufferLength);
                    const val = dataArray[idx] / 255;
                    const height = Math.max(4, val * 36);
                    bar.style.height = `${height}px`;
                    bar.style.opacity = 0.4 + val * 0.6;
                });
            };
            draw();
        },

        _stopVisualization() {
            if (state.animFrameId) {
                cancelAnimationFrame(state.animFrameId);
                state.animFrameId = null;
            }
            // Reset bars
            DOM.audioVisualizer.querySelectorAll('.viz-bar').forEach((bar) => {
                bar.style.height = '4px';
                bar.style.opacity = '0.3';
            });
        },
    };

    // ========== TIMER ENGINE ==========
    const Timer = {
        start(durationSeconds, onTick, onComplete) {
            this.stop();
            state.timerDuration = durationSeconds;
            state.timerRemaining = durationSeconds;
            state.timerStartTime = performance.now();

            const circumference = 2 * Math.PI * 90; // r=90
            DOM.timerRingProgress.style.strokeDasharray = circumference;

            // Add gradient def if not present
            this._ensureGradient();

            const tick = () => {
                const elapsed = (performance.now() - state.timerStartTime) / 1000;
                const remaining = Math.max(0, durationSeconds - elapsed);
                const remainingInt = Math.ceil(remaining);

                if (remainingInt !== state.timerRemaining) {
                    state.timerRemaining = remainingInt;

                    // Tick sound for last 5 seconds
                    if (remainingInt <= 5 && remainingInt > 0) {
                        Sounds.play('tick');
                    }
                }

                // Update timer display
                DOM.timerTime.textContent = formatTime(remainingInt);

                // Update ring
                const progress = remaining / durationSeconds;
                const offset = circumference * (1 - progress);
                DOM.timerRingProgress.style.strokeDashoffset = offset;

                // Color changes
                const pct = remaining / durationSeconds;
                DOM.timerTime.classList.remove('warning', 'danger');
                DOM.timerRingProgress.classList.remove('warning', 'danger');

                if (pct <= 0.1) {
                    DOM.timerTime.classList.add('danger');
                    DOM.timerRingProgress.classList.add('danger');
                } else if (pct <= 0.25) {
                    DOM.timerTime.classList.add('warning');
                    DOM.timerRingProgress.classList.add('warning');
                }

                if (onTick) onTick(remainingInt, durationSeconds);

                if (remaining <= 0) {
                    this.stop();
                    if (onComplete) onComplete();
                    return;
                }

                state.timerInterval = requestAnimationFrame(tick);
            };

            state.timerInterval = requestAnimationFrame(tick);
        },

        stop() {
            if (state.timerInterval) {
                cancelAnimationFrame(state.timerInterval);
                state.timerInterval = null;
            }
        },

        _ensureGradient() {
            const svg = document.querySelector('.timer-ring');
            if (!svg.querySelector('#timer-gradient')) {
                const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
                const grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
                grad.id = 'timer-gradient';
                grad.setAttribute('x1', '0%');
                grad.setAttribute('y1', '0%');
                grad.setAttribute('x2', '100%');
                grad.setAttribute('y2', '100%');

                const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
                stop1.setAttribute('offset', '0%');
                stop1.setAttribute('stop-color', '#6366f1');

                const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
                stop2.setAttribute('offset', '100%');
                stop2.setAttribute('stop-color', '#8b5cf6');

                grad.appendChild(stop1);
                grad.appendChild(stop2);
                defs.appendChild(grad);
                svg.insertBefore(defs, svg.firstChild);
            }
        },
    };

    // ========== SCREEN NAVIGATION ==========
    function showScreen(screenId) {
        $$('.screen').forEach((s) => s.classList.remove('active'));
        const target = $(`#screen-${screenId}`);
        if (target) {
            target.classList.add('active');
            state.currentScreen = screenId;
        }
    }

    // ========== SETUP SCREEN ==========
    function openSetup(taskId) {
        state.currentTask = TASKS[taskId];
        const task = state.currentTask;

        DOM.setupTaskBadge.textContent = `Tâche ${task.id}`;
        DOM.setupTaskTitle.textContent = task.name;

        // Reset inputs
        DOM.aiTopicInput.value = '';
        DOM.customPromptInput.value = '';
        const hintElement = document.querySelector('#ai-topic-group .setting-hint');
        if (hintElement) hintElement.textContent = "Laissez vide pour un sujet aléatoire général.";

        state.promptSource = 'ai';
        DOM.toggleAi.classList.add('active');
        DOM.toggleCustom.classList.remove('active');
        DOM.aiTopicGroup.classList.remove('hidden');
        DOM.customPromptGroup.classList.add('hidden');

        // Auto-select random subject for Full Exam (Tasks 2 and 3)
        if (state.isFullExam && taskId > 1) {
            fetchRandomSubject(taskId);
        }

        showScreen('setup');
    }

    // ========== EXAM ENGINE ==========
    async function startExam() {
        const task = state.currentTask;
        if (!task) return;

        state.sessionStart = new Date().toISOString();
        state.audioChunks = [];
        state.audioBlob = null;
        state.audioUrl = null;

        // Setup exam screen
        DOM.examTaskBadge.textContent = `Tâche ${task.id}`;
        DOM.examTaskName.textContent = task.name;

        // Create visualizer bars
        DOM.audioVisualizer.innerHTML = '';
        for (let i = 0; i < 32; i++) {
            const bar = document.createElement('div');
            bar.className = 'viz-bar';
            bar.style.height = '4px';
            bar.style.opacity = '0.3';
            DOM.audioVisualizer.appendChild(bar);
        }

        // Initialize session data with placeholders
        state.sessionData = {
            taskId: task.id,
            taskName: task.name,
            prompt: 'Génération du sujet...',
            date: state.sessionStart,
            totalDuration: task.totalSeconds,
            transcript: '',
            feedback: null
        };

        showScreen('exam');
        Sounds.play('start');

        // Generate or set prompt
        if (state.promptSource === 'custom') {
            const customPrompt = DOM.customPromptInput.value.trim() || 'Sujet personnalisé non spécifié.';
            state.sessionData.prompt = customPrompt;
            DOM.promptText.textContent = customPrompt;
            speakText(customPrompt);
        } else {
            // Stream the prompt
            const topic = DOM.aiTopicInput.value.trim();
            API.streamPrompt(
                task.id,
                topic,
                (chunk, fullText) => {
                    DOM.promptText.innerHTML = fullText.replace(/\n/g, '<br>') + '<span class="streaming-cursor"></span>';
                },
                (fullText) => {
                    DOM.promptText.innerHTML = fullText.replace(/\n/g, '<br>');
                    state.sessionData.prompt = fullText;
                    speakText(fullText);
                },
                (err) => {
                    // Fallback
                    const fallbacks = {
                        1: "1. Parlez-moi de votre parcours professionnel (études, travail).\n2. Quels sont vos projets ou aspirations pour l'avenir ?",
                        2: "Vous êtes locataire d'un appartement. Depuis une semaine, le chauffage ne fonctionne plus et votre propriétaire ne répond pas à vos appels. Vous décidez de vous rendre à l'agence immobilière pour résoudre ce problème. Expliquez votre situation à l'agent et trouvez une solution ensemble.",
                        3: "« Le télétravail devrait devenir la norme plutôt que l'exception dans le monde professionnel. »\n\nÊtes-vous d'accord avec cette affirmation ? Développez votre point de vue en donnant des arguments structurés, des exemples concrets, et en considérant les objections possibles.",
                    };
                    const fallbackText = fallbacks[task.id] || 'Sujet non disponible.';
                    state.sessionData.prompt = fallbackText;
                    DOM.promptText.innerHTML = fallbackText.replace(/\n/g, '<br>');
                    speakText(fallbackText);
                }
            );
        }

        // Start the appropriate phase
        if (task.hasPrep) {
            await startPrepPhase(task);
        } else {
            await startSpeakPhase(task);
        }
    }

    async function startPrepPhase(task) {
        state.currentPhase = 'prep';

        // Update UI for preparation
        DOM.examPhaseIndicator.classList.add('prep');
        DOM.examPhaseIndicator.classList.remove('speak');
        DOM.phaseLabel.textContent = 'Préparation';
        DOM.timerPhaseLabel.textContent = 'Préparation';

        // Recording section - show idle
        DOM.recordingIndicator.classList.add('idle');
        DOM.recordingIndicator.querySelector('.rec-label').textContent = 'En attente';

        // Start prep timer
        Timer.start(task.prepSeconds, null, async () => {
            // Prep done, transition to speech
            Sounds.play('transition');
            await startSpeakPhase(task);
        });
    }

    async function startSpeakPhase(task) {
        state.currentPhase = 'speak';

        // Update UI for speaking
        DOM.examPhaseIndicator.classList.remove('prep');
        DOM.phaseLabel.textContent = 'Parole';
        DOM.timerPhaseLabel.textContent = 'Temps de parole';

        // Start recording
        DOM.recordingIndicator.classList.remove('idle');
        DOM.recordingIndicator.querySelector('.rec-label').textContent = 'Enregistrement en cours';

        try {
            await Recorder.start();
        } catch (err) {
            alert(err.message);
            endExam();
            return;
        }

        // Set up Speech Recognition for transcript
        state.transcript = '';
        state.currentTurnTranscript = '';
        state._lastResultTime = null;
        state.conversation = [];
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        let lastError = null;
        if (SpeechRecognition) {
            state.recognition = new SpeechRecognition();
            state.recognition.lang = 'fr-FR';
            state.recognition.continuous = true;
            state.recognition.interimResults = true;

            state.recognition.onresult = (event) => {
                let currentInterim = '';
                let finalChunk = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcriptPart = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalChunk += transcriptPart + ' ';
                    } else {
                        currentInterim += transcriptPart;
                    }
                }

                const now = Date.now();
                if (finalChunk) {
                    if (state._lastResultTime) {
                        const gap = now - state._lastResultTime;
                        // Insertion de ponctuation basée sur le silence entre deux prises de parole finales
                        if (gap > 600 && gap < 2000) {
                            state.transcript = state.transcript.trim() + ", ";
                        } else if (gap >= 2000) {
                            state.transcript = state.transcript.trim() + ". ";
                        }
                    }
                    state._lastResultTime = now;
                    state.transcript += finalChunk;
                    state.currentTurnTranscript += finalChunk;
                }

                // Détection de silence pour déclencher l'interaction AI (toutes les tâches)
                if (currentInterim || finalChunk) {
                    clearTimeout(state.silenceTimer);
                    
                    // Définition de la latence de réaction selon la tâche
                    let reactionDelay = 1000; // Tâche 2 (Interaction) : 1s
                    if (task.id === 1) reactionDelay = 3500; // Tâche 1 (Entretien) : 3.5s (laisser le candidat parler)
                    if (task.id === 3) reactionDelay = 7000; // Tâche 3 (Exposé) : 7s (n'intervenir qu'en cas de blocage)

                    state.silenceTimer = setTimeout(() => {
                        const tr = state.currentTurnTranscript.trim() || currentInterim.trim();
                        if (tr && (!window.speechSynthesis || !window.speechSynthesis.speaking)) {
                            // Validation forcée des résultats partiels si le silence persiste
                            if (!finalChunk && state.recognition) {
                                try { state.recognition.stop(); } catch(e) {}
                            }
                            handleAiInteraction();
                        }
                    }, reactionDelay);
                }

                // Optional: Update UI to show we are hearing something
                if (currentInterim || finalChunk) {
                    const recLabel = DOM.recordingIndicator.querySelector('.rec-label');
                    if (recLabel) recLabel.textContent = 'Voix détectée...';

                    // Reset to normal after 2s of silence
                    clearTimeout(state._voiceResetTimer);
                    state._voiceResetTimer = setTimeout(() => {
                        if (state.currentPhase === 'speak') {
                            recLabel.textContent = 'Enregistrement en cours';
                        }
                    }, 2000);
                }
            };

            state.recognition.onend = () => {
                // Restart if still in speaking phase and no fatal error
                if (state.currentPhase === 'speak' && state.recognition) {
                    if (lastError === 'aborted' || lastError === 'not-allowed') {
                        return; // do not restart on fatal errors
                    }
                    setTimeout(() => {
                        if (state.currentPhase === 'speak' && state.recognition) {
                            try {
                                state.recognition.start();
                            } catch (e) { }
                        }
                    }, 50);
                }
            };

            state.recognition.onerror = (e) => {
                lastError = e.error;
                console.log('Speech recognition error:', e.error);

                if (e.error === 'not-allowed') {
                    const recLabel = DOM.recordingIndicator.querySelector('.rec-label');
                    if (recLabel) {
                        recLabel.textContent = 'Micro bloqué';
                        recLabel.style.color = 'var(--color-danger)';
                    }
                }
            };

            // Start after a slight delay so it doesn't conflict with Recorder initialization
            setTimeout(() => {
                try {
                    if (state.currentPhase === 'speak') {
                        state.recognition.start();
                    }
                } catch (e) {
                    console.log('Speech recognition start error:', e);
                }
            }, 500);
        }

        // Start speaking timer
        Timer.start(task.speakSeconds, null, async () => {
            // Time's up
            Sounds.play('end');
            await endExam();
        });
    }

    async function handleAiInteraction() {
        const userText = (state.currentTurnTranscript || "").trim();
        if (!userText || state._aiIsProcessing) return;
        
        state._aiIsProcessing = true;
        state.currentTurnTranscript = '';

        let sysPrompt = "";
        if (state.currentTask.id === 1) {
            sysPrompt = `Tu es l'examinateur du TCF Canada (Tâche 1 : Entretien dirigé). Le candidat a déjà les questions. Écoute-le attentivement. S'il s'arrête de parler trop longtemps, encourage-le très brièvement ("Je vous écoute", "Continuez s'il vous plaît"). Ne pose pas de nouvelles questions.`;
        } else if (state.currentTask.id === 2) {
            sysPrompt = `Tu es l'interlocuteur du candidat dans un jeu de rôle du TCF Canada (Tâche 2 : Interaction).
            
            LOGIQUE DE DISCUSSION RÉELLE :
            - INTERACTION DÈS LE DÉBUT : Réagis naturellement.
            - DIALOGUE VIVANT : Comporte-toi comme une personne réelle.
            - RÉACTION ET ÉCOUTE : Sois un partenaire actif.
            - NON-PROACTIVITÉ : C'est le candidat qui doit poser les questions. Ne prends pas le lead.
            - BRIÈVETÉ ABSOLUE : Une phrase courte (max 15 mots).`;
        } else if (state.currentTask.id === 3) {
            sysPrompt = `Tu es l'examinateur du TCF Canada (Tâche 3 : Expression d'un point de vue). Le candidat argumente seul. Ne l'interromps pas. N'interviens QUE si le silence est très long (blocage). 
            Réponses autorisées : Encouragement très bref ("Je vous écoute", "Continuez", "D'accord, je vois"). BRIÈVETÉ ABSOLUE : 1 phrase courte.`;
        } else {
            state._aiIsProcessing = false;
            return;
        }

        if (state.conversation.length === 0) {
            state.conversation.push({ role: 'assistant', content: state.sessionData.prompt });
        }
        state.conversation.push({ role: 'user', content: userText });

        // UI indicateur de réflexion
        const spinnerId = 'spinner-' + Date.now();
        DOM.promptText.innerHTML += `<br><br><span id="${spinnerId}" class="interaction-spinner" style="font-size:0.85em; color:var(--text-tertiary);"><span class="spinner" style="display:inline-block; width:12px; height:12px; border-width:2px; vertical-align:middle; margin-right:5px;"></span> <em>L'examinateur répond...</em></span>`;

        try {
            const model = API.getModel();
            let fullAiReply = "";
            let lastSpokenIndex = 0;

            await API._callBackend({
                model: model,
                messages: [
                    { role: 'system', content: sysPrompt },
                    ...state.conversation
                ],
                max_tokens: 150,
                temperature: 0.7
            }, (chunk, currentFull) => {
                // Streaming UI
                const spinner = document.getElementById(spinnerId);
                if (spinner) spinner.innerHTML = `<span class="streaming-cursor"></span> <em>${currentFull}</em>`;
                
                fullAiReply = currentFull;

                // Optionnel : on pourrait déclencher speakText sur les phrases complètes ici
                // Mais pour des réponses d'une seule phrase, on attend la fin pour la pureté du TTS
            }, (finalText) => {
                state._aiIsProcessing = false;
                const spinner = document.getElementById(spinnerId);
                if (spinner) spinner.remove();

                state.conversation.push({ role: 'assistant', content: finalText });
                state.sessionData.prompt += `\n\n**Examinateur** : ${finalText}`;

                const userPart = `<div class="speech-bubble user-bubble"><strong>Candidat :</strong><br>${userText}</div>`;
                const aiPart = `<div class="speech-bubble ai-bubble"><strong>Examinateur :</strong><br>${finalText}</div>`;

                if (!DOM.promptText.querySelector('.speech-bubbles-container')) {
                    const originalPrompt = DOM.promptText.innerHTML;
                    DOM.promptText.innerHTML = `<div class="original-subject">${originalPrompt}</div><div class="speech-bubbles-container"></div>`;
                }

                const container = DOM.promptText.querySelector('.speech-bubbles-container');
                container.innerHTML += userPart + aiPart;
                DOM.promptCard.scrollTop = DOM.promptCard.scrollHeight;

                speakText(finalText, true);
            }, (err) => {
                state._aiIsProcessing = false;
                throw err;
            });

        } catch (e) {
            state._aiIsProcessing = false;
            console.error("Erreur d'interaction:", e);
            const spinner = document.getElementById(spinnerId);
            if (spinner) spinner.remove();
            
            const errorPart = `<div class="speech-bubble ai-bubble" style="border-color:var(--danger); color:var(--danger);"><strong>Erreur :</strong> ${e.message}</div>`;
            const container = DOM.promptText.querySelector('.speech-bubbles-container');
            if (container) container.innerHTML += errorPart;
            
            speakText("Une erreur s'est produite.", true);
        }
    }

    async function endExam() {
        state.currentPhase = null;
        Timer.stop();
        API.abortStream();
        await Recorder.stop();
        if (window.speechSynthesis) window.speechSynthesis.cancel();

        if (state.recognition) {
            try {
                // Force a final check of the results before stopping
                state.recognition.stop();
            } catch (e) { }
        }

        // Final check of transcript
        const finalTranscript = state.transcript.trim();

        // Save session
        if (state.sessionData) {
            state.sessionData.transcript = finalTranscript;
            Storage.saveSession(state.sessionData);
        }

        showResults();
    }

    function showResults() {
        const task = state.currentTask;
        DOM.resultsSubtitle.textContent = `${task.name} — ${formatTimeShort(task.totalSeconds)}`;

        // Update Next Task button for Full Exam
        if (state.isFullExam) {
            DOM.btnNextTask.classList.remove('hidden');
            if (state.fullExamQueue.length > 0) {
                const nextTaskId = state.fullExamQueue[0];
                DOM.btnNextTask.innerHTML = `Lancer la Tâche ${nextTaskId} <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>`;
            } else {
                DOM.btnNextTask.innerHTML = `Terminer l'examen <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
            }
        } else {
            // If not full exam, maybe hide it or show numerical next task
            if (task.id < 3) {
                DOM.btnNextTask.classList.remove('hidden');
                DOM.btnNextTask.innerHTML = `Tâche ${task.id + 1} <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>`;
            } else {
                DOM.btnNextTask.classList.add('hidden');
            }
        }

        // Setup audio playback
        if (state.audioUrl) {
            DOM.playbackSection.classList.remove('hidden');
            if (state.audioElement) {
                state.audioElement.pause();
                state.audioElement = null;
            }
            state.audioElement = new Audio(state.audioUrl);
            state.audioElement.addEventListener('loadedmetadata', () => {
                DOM.playerDuration.textContent = formatTimeShort(Math.floor(state.audioElement.duration));
            });
            state.audioElement.addEventListener('timeupdate', () => {
                const ct = state.audioElement.currentTime;
                const dur = state.audioElement.duration || 1;
                DOM.playerBarFill.style.width = `${(ct / dur) * 100}%`;
                DOM.playerCurrent.textContent = formatTimeShort(Math.floor(ct));
            });
            state.audioElement.addEventListener('ended', () => {
                DOM.iconPlay.classList.remove('hidden');
                DOM.iconPause.classList.add('hidden');
            });

            // Download link
            DOM.btnDownload.href = state.audioUrl;
            DOM.btnDownload.download = `tcf_tache${task.id}_${new Date().toISOString().slice(0, 10)}.webm`;
        } else {
            DOM.playbackSection.classList.add('hidden');
        }

        // Check if next task available (full exam mode)
        if (state.isFullExam && state.fullExamQueue.length > 0) {
            DOM.btnNextTask.classList.remove('hidden');
            DOM.btnNextTask.textContent = `Tâche ${state.fullExamQueue[0]} →`;
        } else if (state.isFullExam && state.fullExamQueue.length === 0) {
            DOM.btnNextTask.classList.remove('hidden');
            DOM.btnNextTask.textContent = 'Examen terminé ✓';
            DOM.btnNextTask.disabled = true;
        } else {
            DOM.btnNextTask.classList.add('hidden');
        }

        showScreen('results');

        // Stream feedback
        streamFeedback();
    }

    function streamFeedback() {
        DOM.feedbackContent.innerHTML = '';
        DOM.feedbackStreamingBadge.classList.remove('hidden');

        const prompt = state.sessionData?.prompt || '';
        const transcript = state.sessionData?.transcript || '';

        let initialBox = '';
        if (transcript && transcript.trim().length > 0) {
            initialBox = `<div style="background:var(--bg-secondary); padding:1rem; border-radius:0.5rem; margin-bottom:1.5rem; border-left: 4px solid var(--accent-primary);">
                <strong style="color:var(--text-secondary); display:block; margin-bottom:0.5rem; font-size:0.9em;">Votre transcription détectée :</strong>
                <em>"${transcript.trim()}"</em>
            </div>\n`;
            DOM.feedbackContent.innerHTML = initialBox;
        } else {
            initialBox = `<div style="background:var(--bg-secondary); padding:1rem; border-radius:0.5rem; margin-bottom:1.5rem; border-left: 4px solid var(--danger);">
                <strong style="color:var(--text-secondary); display:block; margin-bottom:0.5rem; font-size:0.9em;">Aucune voix détectée</strong>
                <em style="color:var(--text-tertiary);">Le navigateur web n'a pas pu reconnaître ou transcrire votre voix (aucune donnée texte générée).</em>
            </div>\n`;
            DOM.feedbackContent.innerHTML = initialBox;
        }

        API.streamFeedback(
            state.currentTask.id,
            prompt,
            transcript,
            (chunk, fullText) => {
                let formatted = fullText.replace(/\n/g, '<br>');
                formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                DOM.feedbackContent.innerHTML = initialBox + formatted + '<span class="streaming-cursor"></span>';
            },
            (fullText) => {
                let formatted = fullText.replace(/\n/g, '<br>');
                formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                DOM.feedbackContent.innerHTML = initialBox + formatted;
                DOM.feedbackStreamingBadge.classList.add('hidden');

                // Extract score and grade if possible for history display
                let score = '';
                const scoreMatch = fullText.match(/Score\s*[:\/]\s*(\d+(\.\d+)?)\/20/i);
                if (scoreMatch) score = scoreMatch[1];

                let level = '';
                const levelMatch = fullText.match(/Niveau\s*CECRL\s*[:]\s*([A-C][1-2])/i);
                if (levelMatch) level = levelMatch[1];

                // Update session with feedback and save
                if (state.sessionData) {
                    state.sessionData.feedback = fullText;
                    state.sessionData.score = score;
                    state.sessionData.level = level;

                    // Update in storage (find existing and replace)
                    const sessions = Storage.getSessions();
                    const index = sessions.findIndex(s => s.date === state.sessionData.date);
                    if (index !== -1) {
                        sessions[index] = state.sessionData;
                        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(sessions));
                    }
                }

                speakText(fullText);
            },
            (err) => {
                const modelUsed = API.getModel();

                DOM.feedbackContent.innerHTML = initialBox + `
                    <div style="padding: 1.5rem; background: rgba(239, 68, 68, 0.05); border-radius: 0.75rem; border: 1px solid rgba(239, 68, 68, 0.2);">
                        <p style="color: var(--danger); font-weight: 600; margin-bottom: 0.5rem;">Feedback non disponible</p>
                        <p style="font-size: 0.9em; margin-bottom: 1rem;">L'IA n'a pas pu générer de correction avec le modèle <strong>${modelUsed}</strong>.</p>
                        <p style="font-size: 0.85em; color: var(--text-tertiary); margin-bottom: 1rem; font-family: monospace;">Détail : ${err.message}</p>
                        
                        <div style="background: var(--bg-primary); padding: 1rem; border-radius: 0.5rem; border: 1px solid var(--border-color); margin-bottom: 1rem;">
                            <strong style="display: block; font-size: 0.85em; margin-bottom: 0.5rem; color: var(--accent-primary);">💡 Solutions suggérées :</strong>
                            <ul style="font-size: 0.85em; color: var(--text-secondary); padding-left: 1.25rem; margin-bottom: 0;">
                                <li>Vérifiez vos clés API dans le fichier <strong>envi.js</strong> du backend.</li>
                                <li>Assurez-vous que le <strong>serveur backend</strong> est lancé (<code>npm start</code>).</li>
                                <li>Assurez-vous d'avoir une <strong>connexion internet</strong> active.</li>
                            </ul>
                        </div>
                        <p style="font-size: 0.8em; text-align: center; color: var(--text-tertiary);">Vous pouvez copier votre transcription ci-dessus pour ne pas la perdre.</p>
                    </div>`;
                DOM.feedbackStreamingBadge.classList.add('hidden');
            }
        );
    }

    // ========== HISTORY ==========
    function showHistory() {
        const sessions = Storage.getSessions();

        // Stats
        const totalSessions = sessions.length;
        const task1Count = sessions.filter((s) => s.taskId === 1).length;
        const task2Count = sessions.filter((s) => s.taskId === 2).length;
        const task3Count = sessions.filter((s) => s.taskId === 3).length;
        const totalMinutes = Math.round(sessions.reduce((sum, s) => sum + (s.totalDuration || 0), 0) / 60);

        DOM.historyStats.innerHTML = `
            <div class="stat-card">
                <div class="stat-value">${totalSessions}</div>
                <div class="stat-label">Sessions</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${totalMinutes}</div>
                <div class="stat-label">Minutes</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${task1Count}</div>
                <div class="stat-label">Tâche 1</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${task2Count}</div>
                <div class="stat-label">Tâche 2</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${task3Count}</div>
                <div class="stat-label">Tâche 3</div>
            </div>
        `;

        // List
        if (sessions.length === 0) {
            DOM.historyList.innerHTML = '<p class="empty-state">Aucune session enregistrée pour le moment.</p>';
        } else {
            DOM.historyList.innerHTML = sessions
                .map(
                    (s) => `
                <div class="history-item">
                    <div class="history-item-left">
                        <span class="history-task-badge">Tâche ${s.taskId}</span>
                        <div class="history-item-info">
                            <h4>${s.taskName}</h4>
                            <p>${formatDate(s.date)}</p>
                        </div>
                    </div>
                    <div class="history-item-right">
                        ${s.score ? `<span class="history-score">${s.score}/20</span>` : ''}
                        ${s.level ? `<span class="history-level">${s.level}</span>` : ''}
                        <span class="history-item-duration">${formatTimeShort(s.totalDuration)}</span>
                    </div>
                </div>
            `
                )
                .join('');
        }

        showScreen('history');
    }

    // ========== SETTINGS ==========
    function openSettings() {
        const settings = Storage.getSettings();
        DOM.settingModel.value = settings.model || CONFIG.DEFAULT_MODEL;
        DOM.settingSounds.checked = settings.sounds !== false;
        DOM.modalSettings.classList.remove('hidden');
    }

    function closeSettings() {
        DOM.modalSettings.classList.add('hidden');
    }

    function saveSettings() {
        const settings = {
            model: DOM.settingModel.value,
            sounds: DOM.settingSounds.checked,
            theme: Storage.getSettings().theme || 'dark'
        };
        Storage.saveSettings(settings);
        Sounds._enabled = settings.sounds;
        closeSettings();
    }

    async function fetchRandomSubject(taskId) {
        if (taskId === 1) return;
        try {
            const response = await fetch('/api/subjects');
            const data = await response.json();
            
            const taskKey = taskId === 2 ? 'task2' : 'task3';
            let subjects = [];
            let selectedMonth = null;

            if (data.byMonth) {
                const monthsOrder = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
                const now = new Date();
                
                const monthsToTest = [];
                for (let i = 0; i < 12; i++) {
                    const d = new Date();
                    d.setMonth(now.getMonth() - i);
                    const mName = monthsOrder[d.getMonth()];
                    const yName = d.getFullYear();
                    monthsToTest.push(`${mName} ${yName}`);
                }

                for (const monthName of monthsToTest) {
                    if (data.byMonth[monthName] && data.byMonth[monthName][taskKey]?.length > 0) {
                        subjects = data.byMonth[monthName][taskKey];
                        selectedMonth = monthName;
                        break;
                    }
                }
            }

            const hintElement = document.querySelector('#ai-topic-group .setting-hint');
            if (subjects.length === 0) {
                subjects = data[taskKey] || [];
                if (hintElement) hintElement.textContent = "Sujet tiré de la base générale.";
            } else if (selectedMonth) {
                if (hintElement) {
                    hintElement.innerHTML = `Sujet officiel de <strong style="color: var(--primary);">${selectedMonth}</strong>`;
                }
            }

            if (subjects && subjects.length > 0) {
                const random = subjects[Math.floor(Math.random() * subjects.length)];
                DOM.aiTopicInput.value = random;
                DOM.btnRandomSubject.classList.add('pulse');
                setTimeout(() => DOM.btnRandomSubject.classList.remove('pulse'), 500);
            }
        } catch (err) {
            console.error("Erreur sujets:", err);
        }
    }

    // ========== EVENT LISTENERS ==========
    function bindEvents() {
        // Task card buttons
        $$('.btn-start-task').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const taskId = parseInt(e.target.dataset.task);
                state.isFullExam = false;
                state.fullExamQueue = [];
                openSetup(taskId);
            });
        });

        // Full exam
        DOM.btnFullExam.addEventListener('click', () => {
            state.isFullExam = true;
            state.fullExamQueue = [2, 3]; // Queue tasks 2 and 3 after task 1
            state.currentTask = TASKS[1];
            openSetup(1);
        });

        DOM.btnSaveSettings.addEventListener('click', () => {
            const settings = {
                model: DOM.settingModel.value,
                sounds: DOM.settingSounds.checked,
            };
            Storage.saveSettings(settings);
            DOM.modalSettings.classList.add('hidden');
            Sounds.play('success');
        });

        // Sync subjects from web
        DOM.btnSyncSubjects.addEventListener('click', async () => {
            DOM.btnSyncSubjects.disabled = true;
            DOM.syncIcon.style.display = 'inline-block';
            DOM.syncIcon.style.animation = 'spin 1s linear infinite';

            try {
                const response = await fetch('/api/update-subjects', { method: 'POST' });
                const data = await response.json();
                if (data.success) {
                    alert(`✅ Super ! ${data.count} nouveaux sujets ont été ajoutés (${data.lastUpdateInfo || '2026'}).`);
                } else {
                    alert('⚠️ Aucun nouveau sujet trouvé sur le Web.');
                }
            } catch (err) {
                alert('❌ Erreur de connexion au serveur backend.');
            } finally {
                DOM.btnSyncSubjects.disabled = false;
                DOM.syncIcon.style.animation = 'none';
            }
        });

        // Setup - back
        DOM.btnBackLanding.addEventListener('click', () => showScreen('landing'));

        // Theme
        DOM.btnTheme.addEventListener('click', () => {
            const settings = Storage.getSettings();
            const newTheme = (settings.theme === 'light') ? 'dark' : 'light';
            Storage.saveSettings({ ...settings, theme: newTheme });
            applyTheme(newTheme);
        });

        // Setup - toggle source
        DOM.toggleAi.addEventListener('click', () => {
            state.promptSource = 'ai';
            DOM.toggleAi.classList.add('active');
            DOM.toggleCustom.classList.remove('active');
            DOM.aiTopicGroup.classList.remove('hidden');
            DOM.customPromptGroup.classList.add('hidden');
        });

        DOM.toggleCustom.addEventListener('click', () => {
            state.promptSource = 'custom';
            DOM.toggleCustom.classList.add('active');
            DOM.toggleAi.classList.remove('active');
            DOM.customPromptGroup.classList.remove('hidden');
            DOM.aiTopicGroup.classList.add('hidden');
        });

        // Setup - begin
        DOM.btnBeginTask.addEventListener('click', () => startExam());

        DOM.btnRandomSubject.addEventListener('click', () => {
            const taskId = state.currentTask?.id;
            if (taskId === 1) {
                alert("La Tâche 1 ne nécessite pas de thème spécifique.");
                return;
            }
            fetchRandomSubject(taskId);
        });

        // Exam - stop
        DOM.btnStopExam.addEventListener('click', () => {
            if (confirm('Êtes-vous sûr de vouloir arrêter la tâche en cours ?')) {
                Sounds.play('end');
                endExam();
            }
        });

        // Results - play/pause
        DOM.btnPlayPause.addEventListener('click', () => {
            if (!state.audioElement) return;
            if (state.audioElement.paused) {
                state.audioElement.play();
                DOM.iconPlay.classList.add('hidden');
                DOM.iconPause.classList.remove('hidden');
            } else {
                state.audioElement.pause();
                DOM.iconPlay.classList.remove('hidden');
                DOM.iconPause.classList.add('hidden');
            }
        });

        // Results - seek
        DOM.playerBar.addEventListener('click', (e) => {
            if (!state.audioElement || !state.audioElement.duration) return;
            const rect = DOM.playerBar.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            state.audioElement.currentTime = pct * state.audioElement.duration;
        });

        // Results - retry
        DOM.btnRetry.addEventListener('click', () => {
            API.abortStream();
            if (state.audioElement) {
                state.audioElement.pause();
                state.audioElement = null;
            }
            openSetup(state.currentTask.id);
        });

        // Results - next task
        DOM.btnNextTask.addEventListener('click', () => {
            if (state.isFullExam && state.fullExamQueue.length > 0) {
                const nextTaskId = state.fullExamQueue.shift();
                if (state.audioElement) {
                    state.audioElement.pause();
                    state.audioElement = null;
                }
                API.abortStream();
                state.currentTask = TASKS[nextTaskId];
                openSetup(nextTaskId);
            } else if (state.isFullExam && state.fullExamQueue.length === 0) {
                // End of full exam
                state.isFullExam = false;
                showScreen('landing');
                API.abortStream();
                if (state.audioElement) {
                    state.audioElement.pause();
                    state.audioElement = null;
                }
            } else {
                // Individual task
                const currentId = state.currentTask.id;
                if (currentId < 3) {
                    openSetup(currentId + 1);
                } else {
                    showScreen('landing');
                }
            }
        });

        // Results - home
        DOM.btnHome.addEventListener('click', () => {
            API.abortStream();
            if (state.audioElement) {
                state.audioElement.pause();
                state.audioElement = null;
            }
            state.isFullExam = false;
            state.fullExamQueue = [];
            showScreen('landing');
        });

        // History
        DOM.btnHistory.addEventListener('click', () => showHistory());
        DOM.btnBackHistory.addEventListener('click', () => showScreen('landing'));
        DOM.btnClearHistory.addEventListener('click', () => {
            if (confirm('Supprimer tout l\'historique des sessions ?')) {
                Storage.clearSessions();
                showHistory();
            }
        });

        // Settings
        DOM.btnSettings.addEventListener('click', () => openSettings());
        DOM.btnCloseSettings.addEventListener('click', () => closeSettings());
        DOM.btnSaveSettings.addEventListener('click', () => saveSettings());

        // Close modal on overlay click
        DOM.modalSettings.addEventListener('click', (e) => {
            if (e.target === DOM.modalSettings) closeSettings();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (!DOM.modalSettings.classList.contains('hidden')) {
                    closeSettings();
                }
            }
        });
    }

    function applyTheme(theme) {
        if (theme === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
            document.body.setAttribute('data-theme', 'light');
            DOM.iconSun.classList.add('hidden');
            DOM.iconMoon.classList.remove('hidden');
        } else {
            document.documentElement.removeAttribute('data-theme');
            document.body.removeAttribute('data-theme');
            DOM.iconMoon.classList.add('hidden');
            DOM.iconSun.classList.remove('hidden');
        }
    }

    // ========== INITIALIZATION ==========
    function init() {
        // Load settings
        const settings = Storage.getSettings();
        Sounds._enabled = settings.sounds !== false;
        applyTheme(settings.theme || 'dark');

        // Initialisation par défaut si nécessaire
        if (!settings.model) {
            Storage.saveSettings({
                ...settings,
                model: CONFIG.DEFAULT_MODEL,
                sounds: true,
            });
        }

        bindEvents();
        showScreen('landing');
    }

    // Boot
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
