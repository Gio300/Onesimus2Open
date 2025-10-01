// JW Assistant Mobile - Main Application Logic

const APP_STATE = {
    currentTab: 'chat',
    chatMode: 'ai', // 'ai' or 'scripture'
    bibleVersion: 'nwt', // 'nwt', 'kjv', 'asv', 'eth'
    chatHistory: [],
    notes: [],
    teleprompterContent: '',
    metaSuggestions: [],
    metaLocationHistory: [], // GPS tracking
    isRecording: false,
    isScrolling: false,
    isGPSTracking: false,
    isFloatingMetaActive: false,
    currentNoteId: null,
    gpsWatchId: null,
    apiUrl: 'http://localhost:11013' // Will be updated for mobile
};

// Initialize app on load
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
    loadStoredData();
    checkConnection();
    registerServiceWorker();
    setupAutoSave();
});

// Auto-save setup - saves everything continuously
function setupAutoSave() {
    // Save every 3 seconds when anything changes
    setInterval(() => {
        saveToStorage();
    }, 3000);
    
    // Save when app loses focus
    window.addEventListener('blur', saveToStorage);
    
    // Save before page unload
    window.addEventListener('beforeunload', saveToStorage);
    
    // Save when visibility changes (app switching)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            saveToStorage();
        }
    });
    
    // Save when page goes to background (mobile)
    window.addEventListener('pagehide', saveToStorage);
    
    console.log('Auto-save enabled - everything saves automatically');
}

// Register service worker for offline support
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('Service Worker registered:', registration);
            })
            .catch(error => {
                console.log('Service Worker registration failed:', error);
            });
    }
}

// ==================== INITIALIZATION ====================

function initializeApp() {
    console.log('JW Assistant initializing...');
    
    // Set default datetime for note editor
    const datetimeInput = document.getElementById('note-datetime');
    if (datetimeInput) {
        datetimeInput.value = new Date().toISOString().slice(0, 16);
    }
    
    // Check for Web Speech API support
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        console.warn('Speech recognition not supported');
    }
    
    // Check for geolocation
    if ('geolocation' in navigator) {
        console.log('Geolocation available');
    }
    
    console.log('JW Assistant ready');
}

function setupEventListeners() {
    // Bottom navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    
    // Bible version selector
    document.getElementById('bible-version-selector').addEventListener('change', (e) => {
        setBibleVersion(e.target.value);
    });
    
    // Chat mode toggle
    document.getElementById('mode-ai').addEventListener('click', () => setChatMode('ai'));
    document.getElementById('mode-scripture').addEventListener('click', () => setChatMode('scripture'));
    
    // Chat recycle button
    document.getElementById('recycle-chat-btn').addEventListener('click', recycleChat);
    
    // Chat tab
    document.getElementById('send-btn').addEventListener('click', sendMessage);
    document.getElementById('chat-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    document.getElementById('voice-input-btn').addEventListener('click', toggleVoiceInput);
    
    // Auto-resize textarea
    document.getElementById('chat-input').addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });
    
    // Teleprompter tab
    document.getElementById('tp-edit-btn').addEventListener('click', showTeleprompterEditor);
    document.getElementById('tp-play-btn').addEventListener('click', startTeleprompterScroll);
    document.getElementById('tp-pause-btn').addEventListener('click', pauseTeleprompterScroll);
    document.getElementById('tp-backward-btn').addEventListener('click', () => jumpSentences(-5));
    document.getElementById('tp-forward-btn').addEventListener('click', () => jumpSentences(5));
    document.getElementById('tp-clear-btn').addEventListener('click', clearTeleprompter);
    document.getElementById('tp-save-btn').addEventListener('click', saveTeleprompterContent);
    document.getElementById('tp-cancel-btn').addEventListener('click', hideTeleprompterEditor);
    document.getElementById('tp-speed').addEventListener('input', updateScrollSpeed);
    
    // Notes tab
    document.getElementById('new-note-btn').addEventListener('click', showNoteEditor);
    document.getElementById('save-note-btn').addEventListener('click', saveNote);
    document.getElementById('cancel-note-btn').addEventListener('click', hideNoteEditor);
    document.getElementById('notes-search').addEventListener('input', searchNotes);
    document.getElementById('note-photo').addEventListener('change', handlePhotoUpload);
    
    // Note tag buttons
    document.querySelectorAll('.tag-btn').forEach(btn => {
        btn.addEventListener('click', () => toggleTag(btn));
    });
    
    // Meta mode
    document.getElementById('clear-meta-btn').addEventListener('click', clearMetaHistory);
    document.getElementById('convert-to-note-btn').addEventListener('click', convertMetaToNote);
    document.getElementById('auto-note-btn').addEventListener('click', generateAutoNote);
    document.getElementById('toggle-floating-meta-btn').addEventListener('click', toggleFloatingMeta);
    document.getElementById('ai-search-btn').addEventListener('click', performAISearch);
    
    // Close note editor on background click
    document.getElementById('note-editor').addEventListener('click', (e) => {
        if (e.target.id === 'note-editor') {
            hideNoteEditor();
        }
    });
}

// ==================== BIBLE VERSION SELECTOR ====================

function setBibleVersion(version) {
    APP_STATE.bibleVersion = version;
    document.getElementById('bible-version-selector').value = version;
    
    // Show notification
    const versionNames = {
        nwt: 'New World Translation',
        kjv: 'King James Version',
        asv: 'American Standard Version',
        eth: 'Ethiopian Bible'
    };
    
    console.log(`Bible version changed to: ${versionNames[version]}`);
    
    // Visual feedback
    const selector = document.getElementById('bible-version-selector');
    selector.style.transform = 'scale(1.05)';
    setTimeout(() => {
        selector.style.transform = 'scale(1)';
    }, 200);
    
    // Refresh chat display to show scriptures in new version
    if (APP_STATE.chatHistory.length > 0) {
        refreshChatDisplay();
    }
    
    saveToStorage();
}

// ==================== RECYCLE CHAT ====================

function recycleChat() {
    if (APP_STATE.chatHistory.length === 0) {
        // Already empty, no need to confirm
        return;
    }
    
    if (confirm('Clear all chat history? This cannot be undone.')) {
        // Clear chat history
        APP_STATE.chatHistory = [];
        
        // Show welcome message
        const container = document.getElementById('chat-messages');
        container.innerHTML = `
            <div class="welcome-message">
                <h2>Welcome to JW Assistant</h2>
                <p>Ask me about scriptures, Bible topics, or ministry guidance.</p>
                <div class="quick-actions">
                    <button class="quick-btn" onclick="quickAsk('What does the Bible say about love?')">Bible Topics</button>
                    <button class="quick-btn" onclick="quickAsk('Show me scriptures about faith')">Find Scriptures</button>
                    <button class="quick-btn" onclick="quickAsk('Help me prepare a talk')">Prepare Talk</button>
                </div>
            </div>
        `;
        
        // Save to storage
        saveToStorage();
        
        console.log('Chat history cleared');
    }
}

// ==================== CHAT MODE TOGGLE ====================

function setChatMode(mode, skipRefresh = false) {
    APP_STATE.chatMode = mode;
    
    // Update toggle buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    if (mode === 'ai') {
        document.getElementById('mode-ai').classList.add('active');
    } else {
        document.getElementById('mode-scripture').classList.add('active');
    }
    
    // Refresh the chat display to show the correct mode's responses
    if (!skipRefresh && APP_STATE.chatHistory.length > 0) {
        refreshChatDisplay();
    }
    
    saveToStorage();
}

function refreshChatDisplay() {
    const container = document.getElementById('chat-messages');
    container.innerHTML = ''; // Clear current display
    
    if (APP_STATE.chatHistory.length === 0) {
        // Show welcome message
        container.innerHTML = `
            <div class="welcome-message">
                <h2>Welcome to JW Assistant</h2>
                <p>Ask me about scriptures, Bible topics, or ministry guidance.</p>
                <div class="quick-actions">
                    <button class="quick-btn" onclick="quickAsk('What does the Bible say about love?')">Bible Topics</button>
                    <button class="quick-btn" onclick="quickAsk('Show me scriptures about faith')">Find Scriptures</button>
                    <button class="quick-btn" onclick="quickAsk('Help me prepare a talk')">Prepare Talk</button>
                </div>
            </div>
        `;
        return;
    }
    
    // Redisplay all messages based on current mode
    APP_STATE.chatHistory.forEach(item => {
        addMessageToChat('user', item.question);
        
        if (APP_STATE.chatMode === 'scripture') {
            // Show scripture answer
            if (item.scriptureData && item.scriptureData.length > 0) {
                // Regenerate scripture display with current Bible version
                const scriptureText = formatScripturesForStorage(item.scriptureData);
                addMessageToChat('assistant', scriptureText);
            } else if (item.scriptureAnswer) {
                addMessageToChat('assistant', item.scriptureAnswer);
            } else {
                addMessageToChat('assistant', 'No scriptures found for this question.');
            }
        } else {
            // Show AI answer
            addMessageToChat('assistant', item.aiAnswer || item.answer, item.aiSources || item.sources);
        }
    });
    
    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

// ==================== TAB SWITCHING ====================

function switchTab(tabName) {
    APP_STATE.currentTab = tabName;
    
    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    // Update tab panels
    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    
    const targetTab = document.getElementById(`${tabName}-tab`);
    if (targetTab) {
        targetTab.classList.add('active');
    }
    
    // Update header title
    const titles = {
        chat: 'JW Assistant',
        teleprompter: 'Teleprompter',
        meta: 'Meta Mode',
        notes: 'Field Service Notes'
    };
    document.getElementById('header-title').textContent = titles[tabName] || 'JW Assistant';
    
    // Start meta mode listening and GPS when switching to that tab
    if (tabName === 'meta') {
        startMetaMode();
        startGPSTracking();
    } else {
        stopMetaMode();
        stopGPSTracking();
    }
}

// ==================== CHAT FUNCTIONALITY ====================

let isSendingMessage = false;

async function sendMessage() {
    // Prevent duplicate sends
    if (isSendingMessage) {
        console.log('Already processing a message...');
        return;
    }
    
    const input = document.getElementById('chat-input');
    const question = input.value.trim();
    
    if (!question) return;
    
    isSendingMessage = true;
    
    // Clear input and reset height
    input.value = '';
    input.style.height = 'auto';
    
    // Add user message to chat (only once)
    addMessageToChat('user', question);
    
    // Show loading indicator
    const loadingId = addLoadingMessage();
    
    try {
        // Get BOTH responses: AI and Scripture-only
        const [aiResponse, scriptureResponse] = await Promise.all([
            getAIResponse(question),
            getScripturesForQuestion(question)
        ]);
        
        removeLoadingMessage(loadingId);
        
        // Display based on current mode (only once)
        if (APP_STATE.chatMode === 'scripture') {
            const scriptureText = formatScripturesForStorage(scriptureResponse);
            addMessageToChat('assistant', scriptureText);
        } else {
            addMessageToChat('assistant', aiResponse.answer, aiResponse.sources);
        }
        
        // Store BOTH in history so we can toggle between them
        APP_STATE.chatHistory.push({
            timestamp: Date.now(),
            question,
            aiAnswer: aiResponse.answer,
            aiSources: aiResponse.sources,
            scriptureAnswer: formatScripturesForStorage(scriptureResponse),
            scriptureData: scriptureResponse,
            bibleVersion: APP_STATE.bibleVersion
        });
        
        saveToStorage();
        
    } catch (error) {
        console.error('Error sending message:', error);
        removeLoadingMessage(loadingId);
        addMessageToChat('assistant', 'I apologize, but I\'m having trouble connecting right now. Please check your connection and try again.');
    } finally {
        isSendingMessage = false;
    }
}

async function getAIResponse(question) {
    try {
        const response = await fetch(`${APP_STATE.apiUrl}/ask`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question }),
            signal: AbortSignal.timeout(5000) // 5 second timeout
        });
        
        if (!response.ok) throw new Error('API request failed');
        
        const data = await response.json();
        return {
            answer: data.answer,
            sources: data.sources
        };
    } catch (error) {
        console.log('AI service offline, using local fallback');
        // Return fallback with basic JW answer
        return {
            answer: getOfflineAIResponse(question),
            sources: ['📖 JW Assistant - Offline Mode']
        };
    }
}

function getOfflineAIResponse(question) {
    // Simple offline responses for common questions
    const q = question.toLowerCase();
    
    if (q.includes('trinity') || q.includes('three persons') || q.includes('god the son')) {
        return 'The Bible does not teach the trinity. Jesus clearly stated "the Father is greater than I am" (John 14:28). The Bible shows Jesus as God\'s Son, not God Almighty. See 1 Corinthians 11:3 which says "the head of the Christ is God." For detailed scriptures, toggle to "Scriptures Only" mode.';
    }
    
    if (q.includes('soul') || q.includes('immortal')) {
        return 'The Bible teaches the soul is mortal and can die. Ezekiel 18:4 says "The soul who sins will die." Ecclesiastes 9:5 states "the dead know nothing at all." The soul is the person, not an immortal part inside us. Toggle to "Scriptures Only" mode for more verses.';
    }
    
    if (q.includes('hell') || q.includes('hellfire') || q.includes('torment')) {
        return 'The Bible does not teach hellfire. Hell (Sheol/Hades) is the common grave, not a place of torment. Ecclesiastes 9:10 says "there is no work nor planning nor knowledge nor wisdom in the Grave." The penalty for sin is death, not eternal torture. See "Scriptures Only" mode for more.';
    }
    
    if (q.includes('heaven') || q.includes('144000') || q.includes('144,000')) {
        return 'The Bible shows two hopes: 144,000 go to heaven to rule with Christ (Revelation 14:1), while the majority will live forever on a paradise earth (Psalm 37:29). Jesus said the "mild-tempered will inherit the earth" (Matthew 5:5). Check "Scriptures Only" mode for all relevant verses.';
    }
    
    if (q.includes('last days') || q.includes('end times') || q.includes('armageddon')) {
        return 'We are living in the last days. Jesus gave signs in Matthew 24: wars, earthquakes, food shortages, and the preaching work. 2 Timothy 3:1-5 describes the moral decline we see today. The preaching work (Matthew 24:14) must be completed before the end. See "Scriptures Only" mode for detailed scriptures.';
    }
    
    if (q.includes('jehovah') || q.includes('god name') || q.includes('god\'s name')) {
        return 'God\'s personal name is Jehovah, used over 7,000 times in the Bible. Psalm 83:18 says "you, whose name is Jehovah, you alone are the Most High over all the earth." Knowing and using God\'s name is essential for true worship. See "Scriptures Only" mode for more references.';
    }
    
    // Default response
    return 'I\'m currently offline and can\'t provide a detailed answer. However, you can:\n\n1. Toggle to "Scriptures Only" mode to see relevant Bible verses\n2. Use Meta Mode to get scripture suggestions\n3. Check your saved notes for similar topics\n\nOnce internet connection is restored, I\'ll be able to provide more comprehensive answers with JW.org references.';
}

function formatScripturesForStorage(scriptureData) {
    if (!scriptureData || scriptureData.length === 0) {
        return 'No relevant scriptures found.';
    }
    
    const versionNames = {
        nwt: 'New World Translation',
        kjv: 'King James Version',
        asv: 'American Standard Version',
        eth: 'Ethiopian Bible'
    };
    
    let response = `📖 Scriptures (${versionNames[APP_STATE.bibleVersion]}):\n\n`;
    
    scriptureData.forEach((data) => {
        if (data.verses && data.verses.length > 0) {
            response += `**${data.topic}**\n`;
            response += `${data.context}\n\n`;
            
            data.verses.forEach(verse => {
                const text = verse[APP_STATE.bibleVersion] || verse.text || verse.nwt;
                response += `• ${verse.ref} - ${text}\n`;
            });
            
            response += '\n';
        }
    });
    
    return response;
}

function addMessageToChat(role, text, sources = []) {
    const container = document.getElementById('chat-messages');
    
    // Remove welcome message if it exists
    const welcome = container.querySelector('.welcome-message');
    if (welcome) welcome.remove();
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = role === 'user' ? 'Y' : 'AI';
    
    const content = document.createElement('div');
    content.className = 'message-content';
    
    const messageText = document.createElement('div');
    messageText.className = 'message-text';
    messageText.textContent = text;
    
    content.appendChild(messageText);
    
    // Add scripture formatting if detected - make them clickable
    if (text.includes(':') && /\d+:\d+/.test(text)) {
        const scriptureMatches = text.match(/([1-3]?\s?[A-Za-z]+)\s+(\d+:\d+(-\d+)?)/g);
        if (scriptureMatches) {
            scriptureMatches.forEach(scripture => {
                const scriptureDiv = document.createElement('div');
                scriptureDiv.className = 'message-scripture clickable-scripture';
                scriptureDiv.textContent = scripture;
                scriptureDiv.onclick = () => showScriptureDetail(scripture);
                content.appendChild(scriptureDiv);
            });
        }
    }
    
    // Add sources if available
    if (sources && sources.length > 0) {
        const sourcesDiv = document.createElement('div');
        sourcesDiv.className = 'message-sources';
        sources.forEach(source => {
            const link = document.createElement('a');
            link.className = 'source-link';
            link.href = source;
            link.textContent = '📖 ' + (source.includes('jw.org') ? 'JW.org Reference' : 'Source');
            link.target = '_blank';
            sourcesDiv.appendChild(link);
        });
        content.appendChild(sourcesDiv);
    }
    
    // Add share button for assistant messages
    if (role === 'assistant') {
        const shareBtn = document.createElement('button');
        shareBtn.className = 'message-share-btn';
        shareBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/>
            </svg>
            Share
        `;
        shareBtn.onclick = () => shareMessage(text, sources);
        content.appendChild(shareBtn);
    }
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);
    
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

function addLoadingMessage() {
    const container = document.getElementById('chat-messages');
    const loadingDiv = document.createElement('div');
    const loadingId = 'loading-' + Date.now();
    loadingDiv.id = loadingId;
    loadingDiv.className = 'message assistant';
    
    loadingDiv.innerHTML = `
        <div class="message-avatar">AI</div>
        <div class="message-content">
            <div class="loading">
                <div class="loading-dot"></div>
                <div class="loading-dot"></div>
                <div class="loading-dot"></div>
            </div>
        </div>
    `;
    
    container.appendChild(loadingDiv);
    container.scrollTop = container.scrollHeight;
    
    return loadingId;
}

function removeLoadingMessage(loadingId) {
    const loading = document.getElementById(loadingId);
    if (loading) loading.remove();
}

function quickAsk(question) {
    document.getElementById('chat-input').value = question;
    sendMessage();
}

// ==================== VOICE INPUT ====================

let recognition = null;

function toggleVoiceInput() {
    const btn = document.getElementById('voice-input-btn');
    
    if (APP_STATE.isRecording) {
        stopVoiceInput();
        return;
    }
    
    // Initialize speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert('Voice input is not supported on this device');
        return;
    }
    
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    
    recognition.onstart = () => {
        APP_STATE.isRecording = true;
        btn.classList.add('recording');
    };
    
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        document.getElementById('chat-input').value = transcript;
        stopVoiceInput();
    };
    
    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        stopVoiceInput();
    };
    
    recognition.onend = () => {
        stopVoiceInput();
    };
    
    recognition.start();
}

function stopVoiceInput() {
    if (recognition) {
        recognition.stop();
        recognition = null;
    }
    APP_STATE.isRecording = false;
    document.getElementById('voice-input-btn').classList.remove('recording');
}

// ==================== TELEPROMPTER ====================

function showTeleprompterEditor() {
    document.getElementById('teleprompter-editor').classList.remove('hidden');
    document.getElementById('teleprompter-display').style.display = 'none';
    
    // Load current content
    document.getElementById('tp-text-input').value = APP_STATE.teleprompterContent;
}

function hideTeleprompterEditor() {
    document.getElementById('teleprompter-editor').classList.add('hidden');
    document.getElementById('teleprompter-display').style.display = 'block';
}

function saveTeleprompterContent() {
    const content = document.getElementById('tp-text-input').value;
    APP_STATE.teleprompterContent = content;
    
    const displayArea = document.getElementById('tp-content');
    if (content.trim()) {
        displayArea.innerHTML = `<p>${content.replace(/\n/g, '<br>')}</p>`;
        displayArea.classList.remove('tp-empty');
    } else {
        displayArea.innerHTML = '<p class="tp-empty">No content loaded. Click \'Edit\' to add your talk or Bible reading.</p>';
    }
    
    hideTeleprompterEditor();
    saveToStorage(); // Auto-saves immediately
}

function showTeleprompterEditor() {
    document.getElementById('teleprompter-editor').classList.remove('hidden');
    document.getElementById('teleprompter-display').style.display = 'none';
    
    // Load current content
    document.getElementById('tp-text-input').value = APP_STATE.teleprompterContent;
    
    // Auto-save teleprompter as you type
    document.getElementById('tp-text-input').addEventListener('input', function() {
        APP_STATE.teleprompterContent = this.value;
        saveToStorage(); // Auto-save draft
    });
}

function clearTeleprompter() {
    if (confirm('Clear teleprompter content?')) {
        APP_STATE.teleprompterContent = '';
        APP_STATE.isScrolling = false;
        document.getElementById('tp-content').innerHTML = '<p class="tp-empty">No content loaded. Click \'Edit\' to add your talk or Bible reading.</p>';
        document.getElementById('teleprompter-display').classList.remove('scrolling');
        updateTeleprompterButtons();
        saveToStorage();
    }
}

function startTeleprompterScroll() {
    if (!APP_STATE.teleprompterContent.trim()) {
        alert('Please add content first');
        return;
    }
    
    APP_STATE.isScrolling = true;
    document.getElementById('teleprompter-display').classList.add('scrolling');
    updateTeleprompterButtons();
    updateScrollSpeed();
}

function pauseTeleprompterScroll() {
    APP_STATE.isScrolling = false;
    document.getElementById('teleprompter-display').classList.remove('scrolling');
    updateTeleprompterButtons();
}

function updateTeleprompterButtons() {
    const playBtn = document.getElementById('tp-play-btn');
    const pauseBtn = document.getElementById('tp-pause-btn');
    
    if (APP_STATE.isScrolling) {
        playBtn.classList.add('hidden');
        pauseBtn.classList.remove('hidden');
    } else {
        playBtn.classList.remove('hidden');
        pauseBtn.classList.add('hidden');
    }
}

function jumpSentences(count) {
    const content = document.getElementById('tp-content');
    const text = APP_STATE.teleprompterContent;
    
    if (!text) return;
    
    // Split text into sentences (simple split on . ! ?)
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    
    // Calculate approximate height per sentence
    const totalHeight = content.scrollHeight;
    const sentenceHeight = totalHeight / sentences.length;
    
    // Get current scroll position of the display container
    const display = document.getElementById('teleprompter-display');
    const currentScroll = display.scrollTop;
    
    // Calculate jump amount (5 sentences worth of height)
    const jumpAmount = sentenceHeight * Math.abs(count);
    
    // Apply jump
    if (count > 0) {
        // Forward
        display.scrollTop = currentScroll + jumpAmount;
    } else {
        // Backward
        display.scrollTop = Math.max(0, currentScroll - jumpAmount);
    }
    
    console.log(`Jumped ${count} sentences`);
}

function updateScrollSpeed() {
    const speed = document.getElementById('tp-speed').value;
    const display = document.getElementById('teleprompter-display');
    const duration = 120 - (speed * 10); // 110s to 20s
    display.style.setProperty('--scroll-duration', `${duration}s`);
    
    const content = document.getElementById('tp-content');
    content.style.animationDuration = `${duration}s`;
}

// Send content to teleprompter from chat
function sendToTeleprompter(text) {
    APP_STATE.teleprompterContent = text;
    saveTeleprompterContent();
    switchTab('teleprompter');
}

// ==================== META MODE ====================

let metaRecognition = null;

function startMetaMode() {
    console.log('Meta Mode activated');
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.warn('Speech recognition not supported');
        return;
    }
    
    metaRecognition = new SpeechRecognition();
    metaRecognition.continuous = true;
    metaRecognition.interimResults = true;
    metaRecognition.lang = 'en-US';
    
    let lastTranscript = '';
    
    metaRecognition.onresult = (event) => {
        const transcript = Array.from(event.results)
            .map(result => result[0].transcript)
            .join('');
        
        // Only process when we have a final result and it's different
        if (event.results[event.results.length - 1].isFinal && transcript !== lastTranscript) {
            lastTranscript = transcript;
            analyzeConversation(transcript);
        }
    };
    
    metaRecognition.onerror = (event) => {
        console.error('Meta mode error:', event.error);
        if (event.error === 'no-speech') {
            // Restart recognition
            setTimeout(() => {
                if (APP_STATE.currentTab === 'meta') {
                    metaRecognition.start();
                }
            }, 1000);
        }
    };
    
    metaRecognition.onend = () => {
        // Auto-restart if still in meta mode
        if (APP_STATE.currentTab === 'meta') {
            setTimeout(() => metaRecognition.start(), 500);
        }
    };
    
    metaRecognition.start();
}

function stopMetaMode() {
    if (metaRecognition) {
        metaRecognition.stop();
        metaRecognition = null;
    }
}

async function analyzeConversation(transcript) {
    console.log('Analyzing:', transcript);
    
    // Simple keyword detection for common objections/topics
    const topics = detectTopics(transcript.toLowerCase());
    
    if (topics.length === 0) return;
    
    // Get scripture suggestions for detected topics
    for (const topic of topics) {
        const scriptures = getScripturesForTopic(topic);
        if (scriptures) {
            addMetaSuggestion(topic.trigger, scriptures);
        }
    }
}

function detectTopics(text) {
    const topicMap = [
        { trigger: 'soul immortal', keywords: ['soul', 'immortal', 'never die'] },
        { trigger: 'trinity', keywords: ['trinity', 'three persons', 'god the son'] },
        { trigger: 'hell fire', keywords: ['hell', 'burning forever', 'eternal torment'] },
        { trigger: 'going to heaven', keywords: ['everyone heaven', 'all good people heaven'] },
        { trigger: 'blood transfusion', keywords: ['blood transfusion', 'accept blood'] },
        { trigger: 'celebration', keywords: ['birthday', 'christmas', 'easter', 'holiday'] },
        { trigger: 'end times', keywords: ['end of world', 'armageddon', 'last days'] },
        { trigger: 'salvation', keywords: ['saved', 'salvation', 'born again'] }
    ];
    
    const detected = [];
    for (const topic of topicMap) {
        if (topic.keywords.some(keyword => text.includes(keyword))) {
            detected.push(topic);
        }
    }
    
    return detected;
}

function getScripturesForTopic(topic) {
    const scriptureMap = {
        'soul immortal': {
            jwView: [
                { ref: 'Ezekiel 18:4', text: '"The soul who sins will die"' },
                { ref: 'Ecclesiastes 9:5', text: '"The dead know nothing"' },
                { ref: 'Genesis 2:7', text: 'Adam became a living soul' }
            ],
            context: 'The soul is mortal and can die'
        },
        'trinity': {
            jwView: [
                { ref: 'John 14:28', text: '"The Father is greater than I"' },
                { ref: '1 Corinthians 11:3', text: 'The head of Christ is God' },
                { ref: 'Colossians 1:15', text: 'Firstborn of all creation' }
            ],
            context: 'Jesus is God\'s Son, not God Almighty'
        },
        'hell fire': {
            jwView: [
                { ref: 'Ecclesiastes 9:5, 10', text: 'The dead are conscious of nothing' },
                { ref: 'Psalm 146:4', text: 'Thoughts perish at death' },
                { ref: 'Romans 6:23', text: 'Wages of sin is death, not torment' }
            ],
            context: 'Hell (Sheol/Hades) is the common grave, not a place of torment'
        },
        'going to heaven': {
            jwView: [
                { ref: 'Psalm 37:29', text: '"The righteous will possess the earth"' },
                { ref: 'Matthew 5:5', text: 'Meek will inherit the earth' },
                { ref: 'Revelation 5:10', text: 'Kings and priests to rule over the earth' }
            ],
            context: 'Most will live forever on a paradise earth; only 144,000 go to heaven'
        },
        'end times': {
            jwView: [
                { ref: 'Matthew 24:3-14', text: 'Signs of the last days' },
                { ref: '2 Timothy 3:1-5', text: 'Critical times hard to deal with' },
                { ref: 'Revelation 21:3-4', text: 'God will wipe away every tear' }
            ],
            context: 'We are living in the last days; God\'s Kingdom will soon rule earth'
        }
    };
    
    return scriptureMap[topic.trigger] || null;
}

function addMetaSuggestion(trigger, data) {
    const container = document.getElementById('meta-suggestions');
    
    // Remove welcome message
    const welcome = container.querySelector('.meta-welcome');
    if (welcome) welcome.remove();
    
    const suggestionDiv = document.createElement('div');
    suggestionDiv.className = 'meta-suggestion';
    
    let scripturesHtml = '';
    data.jwView.forEach(scripture => {
        const text = scripture[APP_STATE.bibleVersion] || scripture.text || scripture.nwt;
        scripturesHtml += `
            <div class="meta-scripture">
                <strong>${scripture.ref}</strong>
                ${text}
            </div>
        `;
    });
    
    suggestionDiv.innerHTML = `
        <div class="meta-trigger">Heard: <strong>"${trigger}"</strong></div>
        <div class="meta-response">
            <h4>JW View:</h4>
            ${scripturesHtml}
            <div class="meta-context">${data.context}</div>
        </div>
    `;
    
    container.insertBefore(suggestionDiv, container.firstChild);
    
    // Also add to floating Meta if active
    if (APP_STATE.isFloatingMetaActive) {
        addMetaSuggestionToFloating(trigger, data);
    }
    
    // Store in history
    APP_STATE.metaSuggestions.push({
        timestamp: Date.now(),
        trigger,
        data
    });
    
    saveToStorage();
}

function clearMetaHistory() {
    if (confirm('Clear meta mode history? This will also clear GPS tracking data.')) {
        APP_STATE.metaSuggestions = [];
        APP_STATE.metaLocationHistory = [];
        const container = document.getElementById('meta-suggestions');
        container.innerHTML = `
            <div class="meta-welcome">
                <h3>🎯 Meta Mode Active</h3>
                <p>I'll listen to conversations and suggest scriptures showing JW views.</p>
                <p>Your route is being tracked automatically for field service records.</p>
                <p class="note">Speak naturally. I'll display relevant scriptures without interrupting.</p>
            </div>
        `;
        
        // Hide location summary
        document.getElementById('meta-location-summary').classList.add('hidden');
        document.getElementById('location-stats').textContent = '0 locations tracked';
        
        saveToStorage();
    }
}

// ==================== GPS TRACKING ====================

function startGPSTracking() {
    if (!('geolocation' in navigator)) {
        console.warn('Geolocation not supported');
        updateGPSStatus('unavailable');
        return;
    }
    
    if (APP_STATE.isGPSTracking) {
        return; // Already tracking
    }
    
    APP_STATE.isGPSTracking = true;
    updateGPSStatus('active');
    
    // Request permission and start watching position
    const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
    };
    
    APP_STATE.gpsWatchId = navigator.geolocation.watchPosition(
        handleLocationUpdate,
        handleLocationError,
        options
    );
    
    console.log('GPS tracking started');
}

function stopGPSTracking() {
    if (APP_STATE.gpsWatchId) {
        navigator.geolocation.clearWatch(APP_STATE.gpsWatchId);
        APP_STATE.gpsWatchId = null;
    }
    
    APP_STATE.isGPSTracking = false;
    updateGPSStatus('inactive');
    
    console.log('GPS tracking stopped');
}

function handleLocationUpdate(position) {
    const locationData = {
        timestamp: Date.now(),
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        altitude: position.coords.altitude,
        heading: position.coords.heading,
        speed: position.coords.speed
    };
    
    // Add to location history
    APP_STATE.metaLocationHistory.push(locationData);
    
    // Update display
    updateLocationDisplay(locationData);
    
    // Get address (reverse geocoding)
    getAddressFromCoords(locationData.latitude, locationData.longitude);
    
    // Save to storage
    saveToStorage();
    
    console.log('Location updated:', locationData);
}

function handleLocationError(error) {
    console.error('GPS error:', error.message);
    
    let message = 'GPS Error';
    switch(error.code) {
        case error.PERMISSION_DENIED:
            message = 'GPS Permission Denied';
            break;
        case error.POSITION_UNAVAILABLE:
            message = 'GPS Unavailable';
            break;
        case error.TIMEOUT:
            message = 'GPS Timeout';
            break;
    }
    
    updateGPSStatus('error', message);
}

function updateGPSStatus(status, message = '') {
    const gpsIndicator = document.getElementById('gps-status');
    const gpsText = document.getElementById('gps-text');
    
    gpsIndicator.classList.remove('inactive');
    
    switch(status) {
        case 'active':
            gpsText.textContent = 'GPS Active';
            gpsIndicator.classList.remove('inactive');
            break;
        case 'inactive':
            gpsText.textContent = 'GPS Inactive';
            gpsIndicator.classList.add('inactive');
            break;
        case 'error':
            gpsText.textContent = message || 'GPS Error';
            gpsIndicator.classList.add('inactive');
            break;
        case 'unavailable':
            gpsText.textContent = 'GPS Not Available';
            gpsIndicator.classList.add('inactive');
            break;
    }
}

function updateLocationDisplay(location) {
    const locationSummary = document.getElementById('meta-location-summary');
    const locationStats = document.getElementById('location-stats');
    
    // Show location summary
    locationSummary.classList.remove('hidden');
    
    // Update stats
    const totalLocations = APP_STATE.metaLocationHistory.length;
    const distance = calculateTotalDistance();
    
    locationStats.textContent = `${totalLocations} locations tracked • ${distance.toFixed(2)} km traveled`;
}

async function getAddressFromCoords(lat, lon) {
    try {
        // Using OpenStreetMap Nominatim for reverse geocoding (free, no API key needed)
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
            {
                headers: {
                    'User-Agent': 'JW-Assistant-Mobile'
                }
            }
        );
        
        if (!response.ok) throw new Error('Geocoding failed');
        
        const data = await response.json();
        const address = data.display_name || `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
        
        document.getElementById('current-address').textContent = address;
        
    } catch (error) {
        console.error('Reverse geocoding error:', error);
        document.getElementById('current-address').textContent = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    }
}

function calculateTotalDistance() {
    if (APP_STATE.metaLocationHistory.length < 2) {
        return 0;
    }
    
    let totalDistance = 0;
    
    for (let i = 1; i < APP_STATE.metaLocationHistory.length; i++) {
        const prev = APP_STATE.metaLocationHistory[i - 1];
        const curr = APP_STATE.metaLocationHistory[i];
        
        totalDistance += haversineDistance(
            prev.latitude, prev.longitude,
            curr.latitude, curr.longitude
        );
    }
    
    return totalDistance;
}

function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance;
}

function toRadians(degrees) {
    return degrees * (Math.PI / 180);
}

// ==================== FLOATING META MODE ====================

function toggleFloatingMeta() {
    const floating = document.getElementById('floating-meta');
    const btn = document.getElementById('toggle-floating-meta-btn');
    
    APP_STATE.isFloatingMetaActive = !APP_STATE.isFloatingMetaActive;
    
    if (APP_STATE.isFloatingMetaActive) {
        floating.classList.remove('hidden');
        btn.classList.add('active');
        
        // Start Meta Mode if not in Meta tab
        if (APP_STATE.currentTab !== 'meta') {
            startMetaMode();
            startGPSTracking();
        }
    } else {
        floating.classList.add('hidden');
        btn.classList.remove('active');
        
        // Stop Meta Mode if not in Meta tab
        if (APP_STATE.currentTab !== 'meta') {
            stopMetaMode();
            stopGPSTracking();
        }
    }
}

function addMetaSuggestionToFloating(trigger, data) {
    const container = document.getElementById('floating-meta-suggestions');
    
    // Remove hint if exists
    const hint = container.querySelector('.floating-meta-hint');
    if (hint) hint.remove();
    
    const suggestionDiv = document.createElement('div');
    suggestionDiv.className = 'floating-suggestion';
    
    const firstScripture = data.jwView[0];
    
    suggestionDiv.innerHTML = `
        <strong>${trigger}</strong>
        <div class="floating-suggestion-scripture">${firstScripture.ref}</div>
    `;
    
    container.insertBefore(suggestionDiv, container.firstChild);
    
    // Keep only last 5 suggestions in floating view
    const suggestions = container.querySelectorAll('.floating-suggestion');
    if (suggestions.length > 5) {
        suggestions[suggestions.length - 1].remove();
    }
}

// ==================== AUTO-NOTE GENERATION ====================

async function generateAutoNote() {
    if (APP_STATE.metaSuggestions.length === 0 && APP_STATE.metaLocationHistory.length === 0) {
        alert('No Meta Mode data to generate note from. Start using Meta Mode first.');
        return;
    }
    
    // Show loading
    const generating = document.createElement('div');
    generating.innerHTML = '<p style="text-align:center; padding:20px;">🤖 Generating note with AI...</p>';
    const metaSuggestions = document.getElementById('meta-suggestions');
    metaSuggestions.insertBefore(generating, metaSuggestions.firstChild);
    
    try {
        // Build AI prompt for note generation
        const prompt = buildAutoNotePrompt();
        
        // Call AI to generate note
        const aiNote = await getAIResponse(prompt);
        
        // Extract key info
        const noteData = parseAutoNoteResponse(aiNote.answer);
        
        // Create and save note automatically
        const note = {
            id: 'auto-note-' + Date.now(),
            person: noteData.person || extractLocationString(),
            datetime: new Date().toISOString().slice(0, 16),
            content: noteData.content,
            tags: noteData.tags,
            followup: noteData.followup,
            photo: null,
            created: Date.now(),
            autoGenerated: true
        };
        
        APP_STATE.notes.unshift(note);
        saveToStorage();
        
        // Remove loading
        generating.remove();
        
        // Show success and switch to notes
        alert('✅ Auto-note created successfully!');
        switchTab('notes');
        renderNotes();
        
        // Optionally clear Meta history
        if (confirm('Clear Meta Mode history?')) {
            clearMetaHistory();
        }
        
    } catch (error) {
        console.error('Auto-note error:', error);
        generating.remove();
        alert('Could not generate auto-note. Please use "Convert to Note" instead.');
    }
}

function buildAutoNotePrompt() {
    let prompt = 'Based on this field service data, create a concise note summary:\n\n';
    
    // Add conversation topics
    if (APP_STATE.metaSuggestions.length > 0) {
        prompt += 'TOPICS DISCUSSED:\n';
        APP_STATE.metaSuggestions.forEach((item, i) => {
            prompt += `${i + 1}. ${item.trigger}\n`;
            const scriptures = item.data.jwView.map(v => v.ref).join(', ');
            prompt += `   Scriptures: ${scriptures}\n`;
        });
        prompt += '\n';
    }
    
    // Add location data
    if (APP_STATE.metaLocationHistory.length > 0) {
        const distance = calculateTotalDistance();
        const duration = (APP_STATE.metaLocationHistory[APP_STATE.metaLocationHistory.length - 1].timestamp - 
                         APP_STATE.metaLocationHistory[0].timestamp) / 1000 / 60;
        prompt += `ROUTE DATA:\n`;
        prompt += `Distance: ${distance.toFixed(2)} km\n`;
        prompt += `Duration: ${Math.round(duration)} minutes\n\n`;
    }
    
    prompt += 'Generate a field service note with:\n';
    prompt += '1. Brief summary of conversation\n';
    prompt += '2. Key scriptures discussed\n';
    prompt += '3. Suggested tags (interested, return-visit, not-home, etc.)\n';
    prompt += '4. Whether to schedule follow-up\n';
    prompt += 'Keep it concise and practical for ministry records.';
    
    return prompt;
}

function parseAutoNoteResponse(aiResponse) {
    // Simple parsing of AI response
    // This will be enhanced with better AI structuring
    
    let person = '';
    let content = aiResponse;
    let tags = [];
    let followup = '';
    
    // Extract tags if AI mentions them
    if (aiResponse.toLowerCase().includes('interested')) tags.push('interested');
    if (aiResponse.toLowerCase().includes('return visit')) tags.push('return-visit');
    if (aiResponse.toLowerCase().includes('not home')) tags.push('not-home');
    if (aiResponse.toLowerCase().includes('bible study')) tags.push('study');
    
    // Extract follow-up date if suggested
    if (aiResponse.toLowerCase().includes('follow up') || aiResponse.toLowerCase().includes('follow-up')) {
        // Suggest follow-up in 1 week
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        followup = nextWeek.toISOString().slice(0, 10);
    }
    
    return {
        person,
        content,
        tags,
        followup
    };
}

function extractLocationString() {
    if (APP_STATE.metaLocationHistory.length === 0) {
        return 'Field Service';
    }
    
    const firstLoc = APP_STATE.metaLocationHistory[0];
    return `${firstLoc.latitude.toFixed(6)}, ${firstLoc.longitude.toFixed(6)}`;
}

// ==================== CONVERT META TO NOTE ====================

function convertMetaToNote() {
    if (APP_STATE.metaSuggestions.length === 0 && APP_STATE.metaLocationHistory.length === 0) {
        alert('No Meta Mode data to convert. Start using Meta Mode first.');
        return;
    }
    
    // Build note content from Meta Mode data
    let noteContent = '';
    
    // Add conversation topics
    if (APP_STATE.metaSuggestions.length > 0) {
        noteContent += '=== Conversation Topics ===\n\n';
        APP_STATE.metaSuggestions.forEach((item, index) => {
            noteContent += `${index + 1}. Discussed: "${item.trigger}"\n`;
            noteContent += `   Context: ${item.data.context}\n`;
            noteContent += `   Scriptures shared:\n`;
            item.data.jwView.forEach(scripture => {
                noteContent += `   - ${scripture.ref}\n`;
            });
            noteContent += '\n';
        });
    }
    
    // Add location data
    if (APP_STATE.metaLocationHistory.length > 0) {
        const firstLocation = APP_STATE.metaLocationHistory[0];
        const lastLocation = APP_STATE.metaLocationHistory[APP_STATE.metaLocationHistory.length - 1];
        const distance = calculateTotalDistance();
        const duration = (lastLocation.timestamp - firstLocation.timestamp) / 1000 / 60; // minutes
        
        noteContent += '\n=== Field Service Route ===\n\n';
        noteContent += `Total locations: ${APP_STATE.metaLocationHistory.length}\n`;
        noteContent += `Distance traveled: ${distance.toFixed(2)} km\n`;
        noteContent += `Duration: ${Math.round(duration)} minutes\n`;
        noteContent += `\nRoute coordinates:\n`;
        noteContent += `Start: ${firstLocation.latitude.toFixed(6)}, ${firstLocation.longitude.toFixed(6)}\n`;
        noteContent += `End: ${lastLocation.latitude.toFixed(6)}, ${lastLocation.longitude.toFixed(6)}\n`;
    }
    
    // Get first and last address for person/location field
    let personLocation = '';
    if (APP_STATE.metaLocationHistory.length > 0) {
        const firstLoc = APP_STATE.metaLocationHistory[0];
        personLocation = `${firstLoc.latitude.toFixed(6)}, ${firstLoc.longitude.toFixed(6)}`;
    }
    
    // Pre-fill note editor
    showNoteEditor();
    document.getElementById('note-person').value = personLocation;
    document.getElementById('note-content').value = noteContent;
    
    // Auto-suggest tags based on conversation
    const suggestedTags = [];
    if (APP_STATE.metaSuggestions.length > 0) {
        suggestedTags.push('return-visit');
    }
    
    // Set suggested tags
    document.querySelectorAll('.tag-btn').forEach(btn => {
        if (suggestedTags.includes(btn.dataset.tag)) {
            btn.classList.add('active');
        }
    });
    document.getElementById('note-tags').value = suggestedTags.join(', ');
    
    // Switch to Notes tab
    switchTab('notes');
}

// ==================== NOTES FUNCTIONALITY ====================

function showNoteEditor(noteId = null) {
    const editor = document.getElementById('note-editor');
    editor.classList.remove('hidden');
    
    if (noteId) {
        // Edit existing note
        const note = APP_STATE.notes.find(n => n.id === noteId);
        if (note) {
            APP_STATE.currentNoteId = noteId;
            document.getElementById('editor-title').textContent = 'Edit Note';
            document.getElementById('note-person').value = note.person || '';
            document.getElementById('note-datetime').value = note.datetime || '';
            document.getElementById('note-content').value = note.content || '';
            document.getElementById('note-tags').value = note.tags ? note.tags.join(', ') : '';
            document.getElementById('note-followup').value = note.followup || '';
            
            // Set active tags
            document.querySelectorAll('.tag-btn').forEach(btn => {
                btn.classList.toggle('active', note.tags && note.tags.includes(btn.dataset.tag));
            });
        }
    } else {
        // New note - restore draft if exists
        const draft = loadNoteDraft();
        
        APP_STATE.currentNoteId = null;
        document.getElementById('editor-title').textContent = 'New Field Service Note';
        document.getElementById('note-person').value = draft.person || '';
        document.getElementById('note-datetime').value = draft.datetime || new Date().toISOString().slice(0, 16);
        document.getElementById('note-content').value = draft.content || '';
        document.getElementById('note-tags').value = draft.tags || '';
        document.getElementById('note-followup').value = draft.followup || '';
        document.getElementById('photo-preview').innerHTML = draft.photo ? `<img src="${draft.photo}" alt="Note photo">` : '';
        
        // Clear active tags unless draft has them
        document.querySelectorAll('.tag-btn').forEach(btn => {
            btn.classList.remove('active');
        });
    }
    
    // Setup auto-save for note editor inputs
    setupNoteEditorAutoSave();
}

function setupNoteEditorAutoSave() {
    const fields = ['note-person', 'note-datetime', 'note-content', 'note-tags', 'note-followup'];
    
    fields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('input', saveNoteDraft);
        }
    });
}

function saveNoteDraft() {
    const draft = {
        person: document.getElementById('note-person').value,
        datetime: document.getElementById('note-datetime').value,
        content: document.getElementById('note-content').value,
        tags: document.getElementById('note-tags').value,
        followup: document.getElementById('note-followup').value,
        photo: document.getElementById('photo-preview').querySelector('img')?.src || '',
        timestamp: Date.now()
    };
    
    localStorage.setItem('jwassistant_note_draft', JSON.stringify(draft));
}

function loadNoteDraft() {
    try {
        const draft = localStorage.getItem('jwassistant_note_draft');
        return draft ? JSON.parse(draft) : {};
    } catch (error) {
        return {};
    }
}

function clearNoteDraft() {
    localStorage.removeItem('jwassistant_note_draft');
}

function hideNoteEditor() {
    document.getElementById('note-editor').classList.add('hidden');
    APP_STATE.currentNoteId = null;
}

function toggleTag(btn) {
    btn.classList.toggle('active');
    
    // Update tags input
    const activeTags = Array.from(document.querySelectorAll('.tag-btn.active'))
        .map(b => b.dataset.tag);
    document.getElementById('note-tags').value = activeTags.join(', ');
}

function handlePhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const preview = document.getElementById('photo-preview');
        preview.innerHTML = `<img src="${e.target.result}" alt="Note photo">`;
    };
    reader.readAsDataURL(file);
}

function saveNote() {
    const person = document.getElementById('note-person').value.trim();
    const datetime = document.getElementById('note-datetime').value;
    const content = document.getElementById('note-content').value.trim();
    const tagsInput = document.getElementById('note-tags').value;
    const followup = document.getElementById('note-followup').value;
    const photoPreview = document.getElementById('photo-preview').querySelector('img');
    
    // Allow incomplete notes - only require at least one field filled
    if (!person && !content) {
        alert('Please fill in at least person/location or notes');
        return;
    }
    
    const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()) : [];
    const photo = photoPreview ? photoPreview.src : null;
    
    const note = {
        id: APP_STATE.currentNoteId || 'note-' + Date.now(),
        person,
        datetime,
        content,
        tags,
        followup,
        photo,
        created: APP_STATE.currentNoteId ? 
            APP_STATE.notes.find(n => n.id === APP_STATE.currentNoteId).created :
            Date.now()
    };
    
    if (APP_STATE.currentNoteId) {
        // Update existing note
        const index = APP_STATE.notes.findIndex(n => n.id === APP_STATE.currentNoteId);
        APP_STATE.notes[index] = note;
    } else {
        // Add new note
        APP_STATE.notes.unshift(note);
    }
    
    // Clear draft after successful save
    clearNoteDraft();
    
    saveToStorage();
    renderNotes();
    hideNoteEditor();
}

function renderNotes(filter = '') {
    const container = document.getElementById('notes-list');
    const notes = filter ? 
        APP_STATE.notes.filter(n => 
            n.person.toLowerCase().includes(filter.toLowerCase()) ||
            n.content.toLowerCase().includes(filter.toLowerCase())
        ) : 
        APP_STATE.notes;
    
    if (notes.length === 0) {
        container.innerHTML = `
            <div class="notes-empty">
                <p>${filter ? 'No notes found' : 'No notes yet. Start recording your field service experiences!'}</p>
                ${!filter ? '<button onclick="showNoteEditor()" class="control-btn primary">Create First Note</button>' : ''}
            </div>
        `;
        return;
    }
    
    container.innerHTML = notes.map(note => {
        const date = new Date(note.datetime || note.created);
        const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        const tagsHtml = note.tags ? note.tags.map(tag => 
            `<span class="note-tag ${tag}">${tag.replace('-', ' ')}</span>`
        ).join('') : '';
        
        const followupHtml = note.followup ? 
            `<div class="note-followup">📅 Follow-up: ${new Date(note.followup).toLocaleDateString()}</div>` : '';
        
        return `
            <div class="note-card">
                <div onclick="showNoteEditor('${note.id}')">
                    <div class="note-header">
                        <div class="note-person">${note.person}</div>
                        <div class="note-date">${dateStr}</div>
                    </div>
                    <div class="note-content-preview">${note.content}</div>
                    <div class="note-tags">${tagsHtml}</div>
                    ${followupHtml}
                </div>
                <button class="note-share-btn" onclick="event.stopPropagation(); shareNoteById('${note.id}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/>
                    </svg>
                    Share
                </button>
            </div>
        `;
    }).join('');
}

function searchNotes(event) {
    const query = event.target.value;
    renderNotes(query);
}

async function performAISearch() {
    const query = document.getElementById('notes-search').value.trim();
    
    if (!query) {
        renderNotes('');
        return;
    }
    
    // AI-powered semantic search
    const matches = APP_STATE.notes.filter(note => {
        const searchableText = `${note.person} ${note.content} ${note.tags?.join(' ')}`.toLowerCase();
        const queryLower = query.toLowerCase();
        
        // Simple keyword matching (will be enhanced with AI later)
        const keywords = queryLower.split(' ');
        return keywords.some(keyword => searchableText.includes(keyword));
    });
    
    // Rank by relevance (simple scoring)
    const ranked = matches.map(note => {
        const text = `${note.person} ${note.content}`.toLowerCase();
        const score = query.toLowerCase().split(' ').reduce((acc, word) => {
            return acc + (text.includes(word) ? 1 : 0);
        }, 0);
        return { note, score };
    }).sort((a, b) => b.score - a.score);
    
    // Display results
    renderNotesFromArray(ranked.map(r => r.note));
    
    console.log(`AI Search: Found ${ranked.length} results for "${query}"`);
}

function renderNotesFromArray(notesArray) {
    const container = document.getElementById('notes-list');
    
    if (notesArray.length === 0) {
        container.innerHTML = `
            <div class="notes-empty">
                <p>No notes found matching your search</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = notesArray.map(note => {
        const date = new Date(note.datetime || note.created);
        const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        const tagsHtml = note.tags ? note.tags.map(tag => 
            `<span class="note-tag ${tag}">${tag.replace('-', ' ')}</span>`
        ).join('') : '';
        
        const followupHtml = note.followup ? 
            `<div class="note-followup">📅 Follow-up: ${new Date(note.followup).toLocaleDateString()}</div>` : '';
        
        return `
            <div class="note-card">
                <div onclick="showNoteEditor('${note.id}')">
                    <div class="note-header">
                        <div class="note-person">${note.person}</div>
                        <div class="note-date">${dateStr}</div>
                    </div>
                    <div class="note-content-preview">${note.content}</div>
                    <div class="note-tags">${tagsHtml}</div>
                    ${followupHtml}
                </div>
                <button class="note-share-btn" onclick="event.stopPropagation(); shareNoteById('${note.id}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/>
                    </svg>
                    Share
                </button>
            </div>
        `;
    }).join('');
}

// ==================== STORAGE & CONNECTION ====================

function saveToStorage() {
    try {
        // This OVERWRITES the old data - doesn't pile up
        // LocalStorage automatically replaces the key's value
        localStorage.setItem('jwassistant_state', JSON.stringify({
            chatHistory: APP_STATE.chatHistory,
            notes: APP_STATE.notes,
            teleprompterContent: APP_STATE.teleprompterContent,
            metaSuggestions: APP_STATE.metaSuggestions,
            metaLocationHistory: APP_STATE.metaLocationHistory,
            bibleVersion: APP_STATE.bibleVersion,
            chatMode: APP_STATE.chatMode
        }));
        
        // Cleanup old data if storage is getting large
        cleanupOldData();
        
    } catch (error) {
        if (error.name === 'QuotaExceededError') {
            // Storage full - cleanup old data
            console.warn('Storage full, cleaning up...');
            emergencyCleanup();
            // Try saving again
            try {
                localStorage.setItem('jwassistant_state', JSON.stringify({
                    chatHistory: APP_STATE.chatHistory.slice(-50), // Keep last 50
                    notes: APP_STATE.notes.slice(0, 100), // Keep newest 100
                    teleprompterContent: APP_STATE.teleprompterContent,
                    metaSuggestions: APP_STATE.metaSuggestions.slice(-20), // Keep last 20
                    metaLocationHistory: APP_STATE.metaLocationHistory.slice(-100), // Keep last 100 points
                    bibleVersion: APP_STATE.bibleVersion,
                    chatMode: APP_STATE.chatMode
                }));
            } catch (e) {
                console.error('Critical: Could not save even after cleanup', e);
            }
        } else {
            console.error('Error saving to storage:', error);
        }
    }
}

function cleanupOldData() {
    // Remove old chat messages if too many (keep last 100)
    if (APP_STATE.chatHistory.length > 100) {
        APP_STATE.chatHistory = APP_STATE.chatHistory.slice(-100);
    }
    
    // Remove old GPS points if too many (keep last 500)
    if (APP_STATE.metaLocationHistory.length > 500) {
        APP_STATE.metaLocationHistory = APP_STATE.metaLocationHistory.slice(-500);
    }
    
    // Remove old Meta suggestions if too many (keep last 50)
    if (APP_STATE.metaSuggestions.length > 50) {
        APP_STATE.metaSuggestions = APP_STATE.metaSuggestions.slice(-50);
    }
    
    // Notes: Keep all (user's important data)
    // But remove notes older than 1 year if more than 500
    if (APP_STATE.notes.length > 500) {
        const oneYearAgo = Date.now() - (365 * 24 * 60 * 60 * 1000);
        APP_STATE.notes = APP_STATE.notes.filter(note => 
            note.created > oneYearAgo
        ).slice(0, 500); // Keep newest 500
    }
}

function emergencyCleanup() {
    // Aggressive cleanup when storage is full
    console.log('Emergency cleanup initiated');
    
    // Clear old drafts
    localStorage.removeItem('jwassistant_note_draft');
    
    // Trim chat to last 20
    APP_STATE.chatHistory = APP_STATE.chatHistory.slice(-20);
    
    // Trim GPS to last 50 points
    APP_STATE.metaLocationHistory = APP_STATE.metaLocationHistory.slice(-50);
    
    // Trim Meta suggestions to last 10
    APP_STATE.metaSuggestions = APP_STATE.metaSuggestions.slice(-10);
    
    // Keep all notes (important!)
    
    console.log('Emergency cleanup complete');
}

function loadStoredData() {
    try {
        const stored = localStorage.getItem('jwassistant_state');
        if (stored) {
            const data = JSON.parse(stored);
            APP_STATE.chatHistory = data.chatHistory || [];
            APP_STATE.notes = data.notes || [];
            APP_STATE.teleprompterContent = data.teleprompterContent || '';
            APP_STATE.metaSuggestions = data.metaSuggestions || [];
            APP_STATE.metaLocationHistory = data.metaLocationHistory || [];
            APP_STATE.bibleVersion = data.bibleVersion || 'nwt';
            APP_STATE.chatMode = data.chatMode || 'ai';
            
            // Restore Bible version selector
            document.getElementById('bible-version-selector').value = APP_STATE.bibleVersion;
            
            // Restore chat mode buttons (but don't call refreshChatDisplay yet)
            if (APP_STATE.chatMode === 'scripture') {
                document.getElementById('mode-scripture').classList.add('active');
                document.getElementById('mode-ai').classList.remove('active');
            }
            
            // Only refresh display if there's history
            if (APP_STATE.chatHistory.length > 0) {
                refreshChatDisplay();
            }
            
            // Restore teleprompter
            if (APP_STATE.teleprompterContent) {
                saveTeleprompterContent();
            }
            
            // Restore notes
            if (APP_STATE.notes.length > 0) {
                renderNotes();
            }
            
            // Restore meta suggestions
            if (APP_STATE.metaSuggestions.length > 0) {
                APP_STATE.metaSuggestions.forEach(item => {
                    addMetaSuggestion(item.trigger, item.data);
                });
            }
        }
    } catch (error) {
        console.error('Error loading stored data:', error);
    }
}

async function checkConnection() {
    try {
        const response = await fetch(`${APP_STATE.apiUrl}/health`, { timeout: 5000 });
        if (response.ok) {
            document.getElementById('connection-status').classList.add('online');
            document.getElementById('connection-status').classList.remove('offline');
            document.getElementById('ai-status').textContent = 'AI Ready';
        } else {
            throw new Error('API not healthy');
        }
    } catch (error) {
        console.log('API not available, running in offline mode');
        document.getElementById('connection-status').classList.remove('online');
        document.getElementById('connection-status').classList.add('offline');
        document.getElementById('ai-status').textContent = 'Offline';
    }
}

// Check connection periodically
setInterval(checkConnection, 30000);

// ==================== SHARE FUNCTIONALITY ====================

async function shareMessage(text, sources = []) {
    // Build share content
    let shareText = text;
    
    // Add sources if available
    if (sources && sources.length > 0) {
        shareText += '\n\nSources:\n';
        sources.forEach(source => {
            shareText += source + '\n';
        });
    }
    
    // Add app signature
    shareText += '\n\n— Shared from JW Assistant';
    
    await shareContent(shareText, 'JW Assistant Message');
}

function shareNoteById(noteId) {
    const note = APP_STATE.notes.find(n => n.id === noteId);
    if (note) {
        shareNote(note);
    }
}

async function shareNote(note) {
    let shareText = `📝 Field Service Note\n\n`;
    
    if (note.person) {
        shareText += `Location: ${note.person}\n`;
    }
    
    if (note.datetime) {
        const date = new Date(note.datetime);
        shareText += `Date: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}\n`;
    }
    
    shareText += `\n${note.content}\n`;
    
    if (note.tags && note.tags.length > 0) {
        shareText += `\nTags: ${note.tags.join(', ')}\n`;
    }
    
    if (note.followup) {
        const followupDate = new Date(note.followup);
        shareText += `\nFollow-up: ${followupDate.toLocaleDateString()}\n`;
    }
    
    shareText += '\n— Shared from JW Assistant';
    
    await shareContent(shareText, 'Field Service Note');
}

async function shareContent(text, title = 'JW Assistant') {
    // Check if Web Share API is supported
    if (navigator.share) {
        try {
            await navigator.share({
                title: title,
                text: text
            });
            console.log('Shared successfully');
        } catch (error) {
            if (error.name !== 'AbortError') {
                // User didn't cancel, show fallback
                console.error('Share failed:', error);
                showShareFallback(text);
            }
        }
    } else {
        // Web Share API not supported, show fallback
        showShareFallback(text);
    }
}

function showShareFallback(text) {
    // Copy to clipboard as fallback
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text)
            .then(() => {
                alert('Copied to clipboard! You can now paste it in your messaging app.');
            })
            .catch(err => {
                console.error('Failed to copy:', err);
                // Last resort: show text in prompt
                prompt('Copy this text:', text);
            });
    } else {
        // Very old browser - show in prompt
        prompt('Copy this text:', text);
    }
}

// ==================== SCRIPTURE-ONLY MODE ====================

async function getScripturesForQuestion(question) {
    // Analyze question for topics
    const topics = analyzeQuestionForTopics(question.toLowerCase());
    
    if (topics.length === 0) {
        return {
            topic: 'General Question',
            scriptures: []
        };
    }
    
    // Get scriptures for each detected topic
    const allScriptures = [];
    for (const topic of topics) {
        const scriptures = getScripturesForTopic(topic);
        if (scriptures) {
            allScriptures.push({
                topic: topic.trigger,
                context: scriptures.context,
                verses: scriptures.jwView
            });
        }
    }
    
    return allScriptures;
}

function analyzeQuestionForTopics(text) {
    const topicMap = [
        // Core Beliefs
        { trigger: 'God\'s Name (Jehovah)', keywords: ['jehovah', 'god name', 'yahweh', 'gods name'] },
        { trigger: 'Trinity', keywords: ['trinity', 'three persons', 'god the son', 'godhead', 'three in one'] },
        { trigger: 'Jesus Christ', keywords: ['jesus', 'christ', 'son of god', 'messiah'] },
        { trigger: 'Holy Spirit', keywords: ['holy spirit', 'spirit of god', 'active force'] },
        
        // Soul & Death
        { trigger: 'Soul (Mortality)', keywords: ['soul', 'immortal', 'soul die', 'mortal soul'] },
        { trigger: 'Death', keywords: ['death', 'dead', 'what happens when die'] },
        { trigger: 'Hell/Sheol', keywords: ['hell', 'hellfire', 'sheol', 'hades', 'grave', 'torment'] },
        { trigger: 'Heaven', keywords: ['heaven', 'go to heaven', '144000', 'anointed'] },
        { trigger: 'Paradise Earth', keywords: ['paradise', 'earth', 'new world', 'resurrection'] },
        
        // Last Days
        { trigger: 'Last Days/End Times', keywords: ['last days', 'end times', 'end of world', 'armageddon', 'great tribulation'] },
        { trigger: 'Kingdom of God', keywords: ['kingdom', 'gods kingdom', '1914'] },
        { trigger: 'Signs of the Times', keywords: ['signs', 'prophecy', 'matthew 24'] },
        
        // Practices
        { trigger: 'Holidays/Celebrations', keywords: ['christmas', 'birthday', 'easter', 'holiday', 'celebrate'] },
        { trigger: 'Blood', keywords: ['blood', 'transfusion', 'blood fractions'] },
        { trigger: 'Neutrality', keywords: ['war', 'military', 'politics', 'voting', 'flag salute'] },
        { trigger: 'Preaching', keywords: ['preach', 'ministry', 'door to door', 'evangeliz', 'witness'] },
        
        // Salvation & Faith
        { trigger: 'Salvation', keywords: ['salvation', 'saved', 'born again'] },
        { trigger: 'Faith & Works', keywords: ['faith', 'works', 'faith alone', 'good works'] },
        { trigger: 'Baptism', keywords: ['baptism', 'baptized', 'water baptism'] },
        
        // Love & Conduct
        { trigger: 'Love', keywords: ['love', 'charity', 'loving'] },
        { trigger: 'Prayer', keywords: ['pray', 'prayer'] },
        { trigger: 'Forgiveness', keywords: ['forgive', 'forgiveness'] },
        { trigger: 'Unity', keywords: ['unity', 'united', 'one faith'] }
    ];
    
    const detected = [];
    for (const topic of topicMap) {
        if (topic.keywords.some(keyword => text.includes(keyword))) {
            detected.push(topic);
        }
    }
    
    return detected;
}

// displayScripturesOnly function removed - now using formatScripturesForStorage and refreshChatDisplay

// Helper function to get scripture text for current version
function getVerseText(verseData) {
    const version = APP_STATE.bibleVersion;
    // If version-specific text exists, use it; otherwise use NWT as fallback
    return verseData[version] || verseData.text || verseData.nwt;
}

// ==================== SCRIPTURE DETAIL MODAL ====================

let currentScriptureReference = '';

function showScriptureDetail(scriptureRef) {
    currentScriptureReference = scriptureRef;
    const modal = document.getElementById('scripture-modal');
    const titleEl = document.getElementById('scripture-modal-title');
    const textEl = document.getElementById('scripture-text');
    const crossRefList = document.getElementById('cross-references-list');
    const studyNotes = document.getElementById('study-notes-content');
    
    // Set title
    titleEl.textContent = scriptureRef;
    
    // Get scripture data
    const scriptureData = getScriptureData(scriptureRef);
    
    // Display text
    if (scriptureData.text) {
        textEl.textContent = scriptureData.text;
    } else {
        textEl.textContent = `Full text not available. Please see ${scriptureRef} in your Bible.`;
    }
    
    // Display cross-references
    crossRefList.innerHTML = '';
    if (scriptureData.crossReferences && scriptureData.crossReferences.length > 0) {
        scriptureData.crossReferences.forEach(ref => {
            const refDiv = document.createElement('div');
            refDiv.className = 'cross-reference-item';
            refDiv.onclick = () => showScriptureDetail(ref.ref);
            refDiv.innerHTML = `
                <div class="cross-reference-ref">${ref.ref}</div>
                <div class="cross-reference-text">${ref.text}</div>
            `;
            crossRefList.appendChild(refDiv);
        });
    } else {
        crossRefList.innerHTML = '<p style="color: var(--text-secondary); font-style: italic;">No cross-references available</p>';
    }
    
    // Display study notes
    studyNotes.innerHTML = '';
    if (scriptureData.studyNotes && scriptureData.studyNotes.length > 0) {
        scriptureData.studyNotes.forEach(note => {
            const noteDiv = document.createElement('div');
            noteDiv.className = 'study-note-item';
            noteDiv.textContent = note;
            studyNotes.appendChild(noteDiv);
        });
    } else {
        studyNotes.innerHTML = '<p style="color: var(--text-secondary); font-style: italic;">No study notes available</p>';
    }
    
    // Show modal
    modal.classList.remove('hidden');
}

function closeScriptureModal() {
    document.getElementById('scripture-modal').classList.add('hidden');
}

function shareScripture() {
    const scriptureData = getScriptureData(currentScriptureReference);
    let shareText = `📖 ${currentScriptureReference}\n\n`;
    shareText += `"${scriptureData.text}"\n\n`;
    
    if (scriptureData.crossReferences && scriptureData.crossReferences.length > 0) {
        shareText += 'Cross-References:\n';
        scriptureData.crossReferences.forEach(ref => {
            shareText += `• ${ref.ref}\n`;
        });
    }
    
    shareText += '\n— Shared from JW Assistant';
    
    shareContent(shareText, currentScriptureReference);
    closeScriptureModal();
}

function getScriptureData(ref) {
    // Use external Bible database loaded from bible_data.js
    const cleanRef = ref.trim();
    
    // Check if BIBLE_DATABASE is loaded
    if (typeof BIBLE_DATABASE !== 'undefined' && BIBLE_DATABASE[cleanRef]) {
        const data = BIBLE_DATABASE[cleanRef];
        
        // Get text for current Bible version
        const text = data.text[APP_STATE.bibleVersion] || data.text.nwt || data.text;
        
        return {
            text: typeof text === 'string' ? text : text.nwt || 'Text not available',
            crossReferences: data.crossReferences || [],
            studyNotes: data.studyNotes || [],
            insightReferences: data.insightReferences || []
        };
    }
    
    // Fallback if scripture not in database yet
    return {
        text: `"${cleanRef}" - Full text will be available when Bible data is loaded. Please see this scripture in your Bible.`,
        crossReferences: [],
        studyNotes: ['This scripture is not yet in the database. We\'re continuously adding more scriptures with cross-references and study notes.']
    };
}

// Expanded Scripture Database for JW Beliefs  
function getScripturesForTopic(topic) {
    const scriptureDatabase = {
        'God\'s Name (Jehovah)': {
            jwView: [
                { ref: 'Psalm 83:18', 
                  nwt: '"That people may know that you, whose name is Jehovah, you alone are the Most High over all the earth"',
                  kjv: '"That men may know that thou, whose name alone is JEHOVAH, art the most high over all the earth"',
                  asv: '"That they may know that thou alone, whose name is Jehovah, Art the Most High over all the earth"',
                  eth: '"That they may know that you alone, whose name is Jehovah, are the Most High over all the earth"'
                },
                { ref: 'Exodus 6:3', 
                  nwt: '"I used to appear to Abraham, Isaac, and Jacob as God Almighty, but with regard to my name Jehovah I did not make myself known to them"',
                  kjv: '"And I appeared unto Abraham, unto Isaac, and unto Jacob, by the name of God Almighty, but by my name JEHOVAH was I not known to them"',
                  asv: '"And I appeared unto Abraham, unto Isaac, and unto Jacob, as God Almighty; but by my name Jehovah I was not known to them"',
                  eth: '"I appeared to Abraham, to Isaac, and to Jacob as God Almighty, but by my name Jehovah I was not known to them"'
                },
                { ref: 'Isaiah 42:8', 
                  nwt: '"I am Jehovah. That is my name; I give my glory to no one else"',
                  kjv: '"I am the LORD: that is my name: and my glory will I not give to another"',
                  asv: '"I am Jehovah, that is my name; and my glory will I not give to another"',
                  eth: '"I am Jehovah. That is my name; I give my glory to no one else"'
                }
            ],
            context: 'God\'s personal name is Jehovah, used over 7,000 times in the Bible'
        },
        'Trinity': {
            jwView: [
                { ref: 'John 14:28', text: '"The Father is greater than I am"' },
                { ref: '1 Corinthians 11:3', text: '"The head of the Christ is God"' },
                { ref: 'Colossians 1:15', text: '"He is the image of the invisible God, the firstborn of all creation"' },
                { ref: 'John 17:3', text: '"This means everlasting life, their coming to know you, the only true God, and the one whom you sent, Jesus Christ"' },
                { ref: 'Proverbs 8:22', text: '"Jehovah produced me as the beginning of his way"' }
            ],
            context: 'Jesus is God\'s Son, not God Almighty; they are separate persons'
        },
        'Soul (Mortality)': {
            jwView: [
                { ref: 'Ezekiel 18:4', text: '"The soul who sins will die"' },
                { ref: 'Ecclesiastes 9:5', text: '"The living know that they will die, but the dead know nothing at all"' },
                { ref: 'Genesis 2:7', text: '"Man became a living person [soul]"' },
                { ref: 'Psalm 146:4', text: '"His spirit goes out, he returns to the ground; on that very day his thoughts perish"' }
            ],
            context: 'The soul is the person, not an immortal part that survives death'
        },
        'Hell/Sheol': {
            jwView: [
                { ref: 'Ecclesiastes 9:5, 10', text: '"The dead know nothing... there is no work nor planning nor knowledge nor wisdom in the Grave"' },
                { ref: 'Psalm 16:10', text: '"You will not leave me in the Grave [Sheol]"' },
                { ref: 'Acts 2:27', text: '"You will not leave me in the Grave [Hades]"' },
                { ref: 'Romans 6:23', text: '"The wages sin pays is death"' }
            ],
            context: 'Hell (Sheol/Hades) is the common grave of mankind, not a place of fiery torment'
        },
        'Heaven': {
            jwView: [
                { ref: 'Luke 12:32', text: '"Have no fear, little flock, for your Father has approved of giving you the Kingdom"' },
                { ref: 'Revelation 14:1, 3', text: '"I saw the Lamb standing on Mount Zion, and with him 144,000"' },
                { ref: 'Revelation 5:10', text: '"You made them to be a kingdom and priests to our God, and they are to rule as kings over the earth"' },
                { ref: '1 Corinthians 15:50', text: '"Flesh and blood cannot inherit God\'s Kingdom"' }
            ],
            context: 'A limited number (144,000) are chosen to rule with Christ in heaven'
        },
        'Paradise Earth': {
            jwView: [
                { ref: 'Psalm 37:29', text: '"The righteous will possess the earth, and they will live forever on it"' },
                { ref: 'Matthew 5:5', text: '"Happy are the mild-tempered, since they will inherit the earth"' },
                { ref: 'Revelation 21:3-4', text: '"God will wipe out every tear from their eyes, and death will be no more"' },
                { ref: 'Isaiah 65:21-22', text: '"They will build houses and live in them, and plant vineyards and eat their fruitage"' },
                { ref: 'Isaiah 11:6-9', text: '"The wolf will reside with the lamb... They will not cause any harm or any ruin"' }
            ],
            context: 'Most of mankind will live forever on a paradise earth'
        },
        'Last Days/End Times': {
            jwView: [
                { ref: 'Matthew 24:3-14', text: '"What will be the sign of your presence and of the conclusion of the system of things?"' },
                { ref: '2 Timothy 3:1-5', text: '"In the last days critical times hard to deal with will be here"' },
                { ref: 'Luke 21:10-11', text: '"Nation will rise against nation... there will be great earthquakes, and in one place after another food shortages and pestilences"' },
                { ref: 'Matthew 24:14', text: '"This good news of the Kingdom will be preached in all the inhabited earth for a witness"' }
            ],
            context: 'We are living in the last days; signs include wars, earthquakes, preaching work'
        },
        'Kingdom of God': {
            jwView: [
                { ref: 'Daniel 2:44', text: '"The God of heaven will set up a kingdom that will never be destroyed"' },
                { ref: 'Matthew 6:9-10', text: '"Let your Kingdom come. Let your will take place, as in heaven, also on earth"' },
                { ref: 'Revelation 11:15', text: '"The kingdom of the world has become the Kingdom of our Lord and of his Christ"' },
                { ref: 'Revelation 12:10', text: '"Now have come to pass the salvation and the power and the Kingdom of our God"' }
            ],
            context: 'God\'s Kingdom is a real government that will rule over the earth'
        },
        'Holidays/Celebrations': {
            jwView: [
                { ref: 'Jeremiah 10:2-4', text: '"Do not learn the way of the nations... the customs of the peoples are worthless"' },
                { ref: 'John 18:36', text: '"My Kingdom is no part of this world"' },
                { ref: 'Job 1:4; Matthew 14:6', text: '[Birthdays mentioned only in negative contexts]' },
                { ref: '2 Corinthians 6:17', text: '"Quit touching the unclean thing"' }
            ],
            context: 'Christians avoid holidays with pagan origins or that displease God'
        },
        'Blood': {
            jwView: [
                { ref: 'Acts 15:28-29', text: '"Keep abstaining from... blood"' },
                { ref: 'Genesis 9:4', text: '"You must not eat flesh with its life—its blood—in it"' },
                { ref: 'Leviticus 17:10', text: '"Any man... who eats any sort of blood, I will... cut him off from among his people"' },
                { ref: 'Acts 15:20', text: '"Abstain... from blood"' }
            ],
            context: 'Christians must abstain from blood, including blood transfusions'
        },
        'Preaching': {
            jwView: [
                { ref: 'Matthew 28:19-20', text: '"Go, therefore, and make disciples of people of all the nations"' },
                { ref: 'Matthew 24:14', text: '"This good news of the Kingdom will be preached in all the inhabited earth"' },
                { ref: 'Acts 20:20', text: '"I did not hold back from... teaching you publicly and from house to house"' },
                { ref: 'Romans 10:13-14', text: '"How will they call on him if they have not put faith in him? How will they put faith in him about whom they have not heard?"' }
            ],
            context: 'All Christians are commanded to preach the good news'
        },
        'Salvation': {
            jwView: [
                { ref: 'John 3:16', text: '"God loved the world so much that he gave his only-begotten Son, so that everyone exercising faith in him might not be destroyed but have everlasting life"' },
                { ref: 'Acts 4:12', text: '"There is no salvation in anyone else, for there is no other name under heaven... by which we must get saved"' },
                { ref: 'John 17:3', text: '"This means everlasting life, their coming to know you, the only true God, and the one whom you sent, Jesus Christ"' },
                { ref: 'Matthew 7:21', text: '"Not everyone saying to me, \'Lord, Lord,\' will enter into the Kingdom of the heavens, but only the one doing the will of my Father"' }
            ],
            context: 'Salvation comes through faith in Jesus and doing God\'s will'
        },
        'Faith & Works': {
            jwView: [
                { ref: 'James 2:26', text: '"Faith without works is dead"' },
                { ref: 'James 2:17', text: '"If it does not have works, is dead in itself"' },
                { ref: 'James 2:14', text: '"If someone says he has faith but does not have works, that faith cannot save him, can it?"' },
                { ref: 'Matthew 7:21', text: '"Not everyone saying to me, \'Lord, Lord,\' will enter... but only the one doing the will of my Father"' }
            ],
            context: 'True faith must be demonstrated by works'
        },
        'Love': {
            jwView: [
                { ref: 'John 13:34-35', text: '"I am giving you a new commandment, that you love one another... By this all will know that you are my disciples"' },
                { ref: '1 Corinthians 13:4-8', text: '"Love is patient and kind. Love is not jealous... it does not look for its own interests"' },
                { ref: '1 John 4:8', text: '"God is love"' },
                { ref: 'Matthew 22:37-39', text: '"You must love Jehovah your God... You must love your neighbor as yourself"' }
            ],
            context: 'Love for God and neighbor is the mark of true Christians'
        },
        'Prayer': {
            jwView: [
                { ref: 'Matthew 6:9', text: '"Our Father in the heavens, let your name be sanctified"' },
                { ref: 'John 14:13-14', text: '"Whatever you ask in my name, I will do this"' },
                { ref: '1 Thessalonians 5:17', text: '"Pray constantly"' },
                { ref: 'Philippians 4:6', text: '"Do not be anxious over anything, but in everything by prayer and supplication... let your petitions be made known to God"' }
            ],
            context: 'Prayer should be directed to Jehovah God through Jesus Christ'
        },
        'Unity': {
            jwView: [
                { ref: '1 Corinthians 1:10', text: '"Now I urge you, brothers, through the name of our Lord Jesus Christ, that you should all speak in agreement and that there should be no divisions among you"' },
                { ref: 'Ephesians 4:4-6', text: '"One body... one spirit... one hope... one Lord, one faith, one baptism; one God"' },
                { ref: 'John 17:21', text: '"In order that they may all be one, just as you, Father, are in union with me"' },
                { ref: 'Psalm 133:1', text: '"How good and how pleasant it is for brothers to dwell together in unity!"' }
            ],
            context: 'True Christians must be united in faith and worship'
        },
        'Neutrality': {
            jwView: [
                { ref: 'John 17:16', text: '"They are no part of the world, just as I am no part of the world"' },
                { ref: 'John 18:36', text: '"My Kingdom is no part of this world. If my Kingdom were part of this world, my attendants would have fought"' },
                { ref: 'Isaiah 2:4', text: '"They will beat their swords into plowshares... Nation will not lift up sword against nation"' },
                { ref: 'Matthew 26:52', text: '"Return your sword to its place, for all those who take up the sword will perish by the sword"' }
            ],
            context: 'Christians remain neutral in political and military conflicts'
        },
        'Jesus Christ': {
            jwView: [
                { ref: 'John 3:16', text: '"God gave his only-begotten Son"' },
                { ref: 'Colossians 1:15', text: '"He is the image of the invisible God, the firstborn of all creation"' },
                { ref: 'John 1:1', text: '"The Word was with God, and the Word was a god"' },
                { ref: 'Philippians 2:6', text: '"Although he was existing in God\'s form, gave no consideration to a seizure, namely, that he should be equal to God"' },
                { ref: 'Matthew 16:16', text: '"You are the Christ, the Son of the living God"' }
            ],
            context: 'Jesus is God\'s firstborn Son, the Messiah, but not God Almighty'
        },
        'Holy Spirit': {
            jwView: [
                { ref: 'Genesis 1:2', text: '"God\'s active force [spirit] was moving about over the surface of the waters"' },
                { ref: 'Acts 1:8', text: '"You will receive power when the holy spirit comes upon you"' },
                { ref: 'Luke 1:35', text: '"Holy spirit will come upon you, and power of the Most High will overshadow you"' },
                { ref: 'Acts 2:4', text: '"They all became filled with holy spirit"' }
            ],
            context: 'The holy spirit is God\'s active force, not a person'
        },
        'Baptism': {
            jwView: [
                { ref: 'Matthew 28:19', text: '"Go... baptizing them in the name of the Father and of the Son and of the holy spirit"' },
                { ref: 'Acts 2:38', text: '"Repent, and let each one of you be baptized"' },
                { ref: 'Romans 6:3-4', text: '"We who were baptized into Christ Jesus were baptized into his death... buried with him through our baptism"' },
                { ref: '1 Peter 3:21', text: '"Baptism is now saving you... as a request to God for a good conscience"' }
            ],
            context: 'Baptism by full immersion symbolizes dedication to God'
        },
        'Death': {
            jwView: [
                { ref: 'Ecclesiastes 9:5', text: '"The dead know nothing at all"' },
                { ref: 'Psalm 146:4', text: '"His spirit goes out... on that very day his thoughts perish"' },
                { ref: 'John 11:11-14', text: '"Lazarus our friend has fallen asleep... Jesus had spoken about his death"' },
                { ref: 'Romans 6:23', text: '"The wages sin pays is death"' }
            ],
            context: 'Death is a state of non-existence, like sleep'
        },
        'Signs of the Times': {
            jwView: [
                { ref: 'Matthew 24:7-8', text: '"Nation will rise against nation... there will be food shortages and earthquakes in one place after another. All these things are a beginning of pangs of distress"' },
                { ref: 'Luke 21:11', text: '"There will be great earthquakes, and in one place after another food shortages and pestilences"' },
                { ref: '2 Timothy 3:1-5', text: '"In the last days... men will be lovers of themselves, lovers of money... disobedient to parents... without self-control, fierce, without love of goodness"' },
                { ref: 'Matthew 24:14', text: '"This good news of the Kingdom will be preached in all the inhabited earth for a witness to all the nations, and then the end will come"' }
            ],
            context: 'Multiple signs indicate we are in the last days'
        },
        'Forgiveness': {
            jwView: [
                { ref: 'Matthew 6:14-15', text: '"If you forgive men their trespasses, your heavenly Father will also forgive you"' },
                { ref: 'Ephesians 4:32', text: '"Become kind to one another, tenderly compassionate, freely forgiving one another"' },
                { ref: 'Colossians 3:13', text: '"Continue putting up with one another and forgiving one another freely even if anyone has a cause for complaint"' },
                { ref: '1 John 1:9', text: '"If we confess our sins, he is faithful and righteous so as to forgive us our sins"' }
            ],
            context: 'Christians must freely forgive others as God forgives us'
        }
    };
    
    return scriptureDatabase[topic.trigger] || null;
}

