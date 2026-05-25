document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const modeSelection = document.getElementById('mode-selection');
    const pcView = document.getElementById('pc-view');
    const mobileView = document.getElementById('mobile-view');
    
    // Buttons
    const btnPcMode = document.getElementById('btn-pc-mode');
    const btnMobileMode = document.getElementById('btn-mobile-mode');
    const backBtns = document.querySelectorAll('.back-btn');
    
    // PC View Elements
    const myPcIdSpan = document.getElementById('my-pc-id');
    const copyBtn = document.getElementById('copy-btn');
    const remoteVideo = document.getElementById('remote-video');
    const waitingOverlay = document.getElementById('waiting-overlay');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    
    // Mobile View Elements
    const targetIdInput = document.getElementById('target-id');
    const connectBtn = document.getElementById('connect-btn');
    const localVideoContainer = document.getElementById('local-video-container');
    const localVideo = document.getElementById('local-video');
    const mobileControls = document.getElementById('mobile-controls');
    const switchCameraBtn = document.getElementById('switch-camera-btn');
    const stopStreamBtn = document.getElementById('stop-stream-btn');
    const connectForm = document.getElementById('connect-form');
    
    // State
    let peer = null;
    let localStream = null;
    let currentCall = null;
    let isFrontCamera = false;
    
    // Navigation
    function showView(viewToShow) {
        [modeSelection, pcView, mobileView].forEach(view => {
            view.classList.remove('active-view');
            view.classList.add('hidden-view');
        });
        viewToShow.classList.remove('hidden-view');
        viewToShow.classList.add('active-view');
    }
    
    btnPcMode.addEventListener('click', () => {
        showView(pcView);
        initPCMode();
    });
    
    btnMobileMode.addEventListener('click', () => {
        showView(mobileView);
    });
    
    backBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            stopEverything();
            showView(modeSelection);
        });
    });
    
    function stopEverything() {
        if (peer) {
            peer.destroy();
            peer = null;
        }
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }
        if (currentCall) {
            currentCall.close();
            currentCall = null;
        }
        
        // Reset UI
        if(remoteVideo) remoteVideo.srcObject = null;
        if(localVideo) localVideo.srcObject = null;
        waitingOverlay.style.opacity = '1';
        localVideoContainer.style.display = 'none';
        mobileControls.classList.add('hidden');
        connectForm.style.display = 'flex';
        myPcIdSpan.textContent = 'Generating...';
        connectBtn.disabled = false;
        connectBtn.textContent = 'Connect & Stream';
    }
    
    // --- PC Mode Logic ---
    function initPCMode() {
        peer = new Peer(); // Auto-generate ID
        
        peer.on('open', (id) => {
            myPcIdSpan.textContent = id;
        });
        
        peer.on('call', (call) => {
            // Answer automatically without sending a stream back
            call.answer();
            currentCall = call;
            
            call.on('stream', (remoteStream) => {
                remoteVideo.srcObject = remoteStream;
                waitingOverlay.style.opacity = '0';
            });
            
            call.on('close', () => {
                remoteVideo.srcObject = null;
                waitingOverlay.style.opacity = '1';
                waitingOverlay.textContent = 'Stream disconnected. Waiting...';
            });
        });
        
        peer.on('error', (err) => {
            console.error('Peer error:', err);
            alert('Connection error: ' + err.type);
        });
    }
    
    copyBtn.addEventListener('click', () => {
        const id = myPcIdSpan.textContent;
        if (id && id !== 'Generating...') {
            navigator.clipboard.writeText(id).then(() => {
                const originalText = copyBtn.textContent;
                copyBtn.textContent = '✅';
                setTimeout(() => copyBtn.textContent = originalText, 2000);
            });
        }
    });
    
    fullscreenBtn.addEventListener('click', () => {
        if (remoteVideo.requestFullscreen) {
            remoteVideo.requestFullscreen();
        } else if (remoteVideo.webkitRequestFullscreen) { /* Safari */
            remoteVideo.webkitRequestFullscreen();
        } else if (remoteVideo.msRequestFullscreen) { /* IE11 */
            remoteVideo.msRequestFullscreen();
        }
    });
    
    // --- Mobile Mode Logic ---
    async function startCamera() {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        
        const constraints = {
            video: {
                facingMode: isFrontCamera ? 'user' : 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false // Set to true if microphone is needed
        };
        
        try {
            localStream = await navigator.mediaDevices.getUserMedia(constraints);
            localVideo.srcObject = localStream;
            return true;
        } catch (err) {
            console.error('Error accessing camera:', err);
            alert('Failed to access camera. Please ensure you have granted permission.');
            return false;
        }
    }
    
    connectBtn.addEventListener('click', async () => {
        const targetId = targetIdInput.value.trim();
        if (!targetId) {
            alert('Please enter a PC Connection ID');
            return;
        }
        
        connectBtn.disabled = true;
        connectBtn.textContent = 'Connecting...';
        
        const camStarted = await startCamera();
        if (!camStarted) {
            connectBtn.disabled = false;
            connectBtn.textContent = 'Connect & Stream';
            return;
        }
        
        peer = new Peer();
        
        peer.on('open', (id) => {
            // Call the PC
            const call = peer.call(targetId, localStream);
            currentCall = call;
            
            connectForm.style.display = 'none';
            localVideoContainer.style.display = 'block';
            mobileControls.classList.remove('hidden');
            
            call.on('error', (err) => {
                alert('Call error: ' + err);
                stopEverything();
                showView(mobileView);
            });
        });
        
        peer.on('error', (err) => {
            console.error('Peer error:', err);
            alert('Connection failed: ' + err.type);
            connectBtn.disabled = false;
            connectBtn.textContent = 'Connect & Stream';
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
            }
        });
    });
    
    switchCameraBtn.addEventListener('click', async () => {
        isFrontCamera = !isFrontCamera;
        await startCamera();
        
        // If we are currently in a call, we need to replace the video track
        if (currentCall && currentCall.peerConnection) {
            const videoTrack = localStream.getVideoTracks()[0];
            const sender = currentCall.peerConnection.getSenders().find(s => s.track.kind === 'video');
            if (sender) {
                sender.replaceTrack(videoTrack);
            }
        }
    });
    
    stopStreamBtn.addEventListener('click', () => {
        stopEverything();
        showView(mobileView);
    });
});
