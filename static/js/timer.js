// Dark mode functionality
function initializeTheme() {
  const themeToggle = document.getElementById('theme-toggle');
  if (!themeToggle) return;
  
  const sunIcon = themeToggle.querySelector('.sun-icon');
  const moonIcon = themeToggle.querySelector('.moon-icon');
  
  // Check for saved theme preference or default to light mode
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  
  // Update icon based on current theme
  updateThemeIcon(savedTheme, sunIcon, moonIcon);
  
  // Add click event listener
  themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme, sunIcon, moonIcon);
  });
}

function updateThemeIcon(theme, sunIcon, moonIcon) {
  if (theme === 'dark') {
    sunIcon.style.display = 'none';
    moonIcon.style.display = 'block';
  } else {
    sunIcon.style.display = 'block';
    moonIcon.style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', function() {
  // Initialize theme first
  initializeTheme();
  
  // Get timer ID from the page
  const timerId = document.getElementById('timer-container').dataset.timerId;
  const isController = document.getElementById('timer-container').dataset.isController === 'True';
  
  // Socket.io connection
  const socket = io();
  let timerInterval;
  let remainingTime = 0;
  let timerStatus = 'paused';
  
  // Connect to socket and join timer room
  socket.on('connect', function() {
    socket.emit('join', {timer_id: timerId});
  });
  
  // Listen for timer updates from the server
  socket.on('timer_update', function(data) {
    if (data.timer_id === timerId) {
      // Refresh the timer data
      fetchTimerData();
      
      if (data.status) {
        updateTimerStatus(data.status);
      }
      
      if (data.reset) {
        resetTimerDisplay();
      }
    }
  });
  
  // Initial timer data fetch
  fetchTimerData();
  
  // Set up control buttons if this is a controller
  if (isController || window.location.pathname.includes('/control/')) {
    setupControlButtons();
  }
  
  // Set up copy link buttons
  setupCopyButtons();
  
  // Function to fetch the current timer data
  function fetchTimerData() {
    fetch(`/api/timer/${timerId}`)
      .then(response => response.json())
      .then(data => {
        // Update local variables
        remainingTime = data.remaining;
        timerStatus = data.status;
        
        // Update the display
        updateTimerDisplay(remainingTime);
        updateTimerStatus(timerStatus);
        
        // Handle timer interval
        if (timerStatus === 'running') {
          startTimerInterval();
        } else {
          clearInterval(timerInterval);
        }
      })
      .catch(error => console.error('Error fetching timer data:', error));
  }
  
  // Function to update the timer display
  function updateTimerDisplay(seconds) {
    const timeElement = document.getElementById('time');
    
    // Calculate hours, minutes, and seconds
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    // Format the time: HH:MM:SS
    const formattedTime = [
      hours.toString().padStart(2, '0'),
      minutes.toString().padStart(2, '0'),
      secs.toString().padStart(2, '0')
    ].join(':');
    
    timeElement.textContent = formattedTime;
    
    // Update title for better UX
    document.title = `${formattedTime} - Remote Timer Control`;
  }
  
  // Function to update timer status display
  function updateTimerStatus(status) {
    const statusElement = document.getElementById('timer-status');
    
    // Remove all status classes
    statusElement.classList.remove('running', 'paused', 'finished');
    
    if (status === 'running') {
      statusElement.textContent = 'Running';
      statusElement.classList.add('running');
      
      // Update button states
      const startBtn = document.getElementById('start-btn');
      const pauseBtn = document.getElementById('pause-btn');
      
      if (startBtn && pauseBtn) {
        startBtn.disabled = true;
        pauseBtn.disabled = false;
      }
    } 
    else if (status === 'paused') {
      statusElement.textContent = 'Paused';
      statusElement.classList.add('paused');
      
      // Update button states
      const startBtn = document.getElementById('start-btn');
      const pauseBtn = document.getElementById('pause-btn');
      
      if (startBtn && pauseBtn) {
        startBtn.disabled = false;
        pauseBtn.disabled = true;
      }
    } 
    else if (status === 'finished') {
      statusElement.textContent = 'Finished!';
      statusElement.classList.add('finished');
      document.title = 'Time\'s Up! - Remote Timer Control';
      
      // Update button states
      const startBtn = document.getElementById('start-btn');
      const pauseBtn = document.getElementById('pause-btn');
      
      if (startBtn && pauseBtn) {
        startBtn.disabled = true;
        pauseBtn.disabled = true;
      }
    }
  }
  
  // Function to start the timer interval for local updates
  function startTimerInterval() {
    clearInterval(timerInterval);
    
    const startTime = Date.now();
    const initialRemaining = remainingTime;
    
    timerInterval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const current = Math.max(initialRemaining - elapsed, 0);
      
      updateTimerDisplay(current);
      
      // Check if timer is finished
      if (current <= 0) {
        clearInterval(timerInterval);
        updateTimerStatus('finished');
      }
    }, 100); // Update more frequently for smoother countdown
  }
  
  // Function to reset the timer display
  function resetTimerDisplay() {
    fetchTimerData();
  }
  
  // Function to set up timer control buttons
  function setupControlButtons() {
    const startBtn = document.getElementById('start-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const resetBtn = document.getElementById('reset-btn');
    const durationForm = document.getElementById('duration-form');
    
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        fetch(`/api/timer/${timerId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            command: 'start'
          }),
        })
        .then(response => response.json())
        .then(data => {
          updateTimerStatus('running');
          startTimerInterval();
        })
        .catch(error => console.error('Error starting timer:', error));
      });
    }
    
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        fetch(`/api/timer/${timerId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            command: 'pause'
          }),
        })
        .then(response => response.json())
        .then(data => {
          updateTimerStatus('paused');
          clearInterval(timerInterval);
        })
        .catch(error => console.error('Error pausing timer:', error));
      });
    }
    
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        fetch(`/api/timer/${timerId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            command: 'reset'
          }),
        })
        .then(response => response.json())
        .then(data => {
          resetTimerDisplay();
        })
        .catch(error => console.error('Error resetting timer:', error));
      });
    }
    
    if (durationForm) {
      durationForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const durationInput = document.getElementById('duration-input');
        const durationValue = durationInput.value.trim();
        
        // Parse duration string (format: HH:MM:SS or MM:SS)
        let seconds = 0;
        
        if (durationValue.includes(':')) {
          const parts = durationValue.split(':').map(part => parseInt(part, 10) || 0);
          
          if (parts.length === 3) {
            // HH:MM:SS format
            seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
          } else if (parts.length === 2) {
            // MM:SS format
            seconds = parts[0] * 60 + parts[1];
          }
        } else {
          // Just seconds
          seconds = parseInt(durationValue, 10) || 0;
        }
        
        if (seconds > 0) {
          fetch(`/api/timer/${timerId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              duration: seconds,
              command: 'reset'
            }),
          })
          .then(response => response.json())
          .then(data => {
            resetTimerDisplay();
          })
          .catch(error => console.error('Error updating duration:', error));
        }
      });
    }
  }
  
  // Function to set up copy link buttons
  function setupCopyButtons() {
    const copyButtons = document.querySelectorAll('.copy-btn');
    
    copyButtons.forEach(button => {
      button.addEventListener('click', () => {
        const linkInput = button.closest('.link-item').querySelector('.link-input');
        linkInput.select();
        document.execCommand('copy');
        
        // Show feedback
        const originalText = button.textContent;
        button.textContent = 'Copied';
        button.style.background = 'var(--success)';
        button.style.color = 'white';
        
        setTimeout(() => {
          button.textContent = originalText;
          button.style.background = '';
          button.style.color = '';
        }, 2000);
      });
    });
  }
});