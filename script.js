// Configuration
const API_URL = "https://zeopkhspnb.execute-api.us-east-1.amazonaws.com/FaceCheckInFunction";
const ALLOWED_PASSKEYS = ["2011"];
const MIN_IMAGE_SIZE = 1000;

// Global variables
let isProcessing = false;
let currentAttendanceData = [];
let currentEmployeeData = [];
let currentEmployeeId = '';
let cameraStream = null;

// DOM Elements
const video = document.getElementById('webcam');
const canvas = document.getElementById('canvas');
const statusDisplay = document.getElementById('status');
const statusIcon = document.querySelector('.status-icon i');
const statusText = document.querySelector('.status-text');

// Buttons
const captureBtn = document.getElementById('captureBtn');
const addFaceBtn = document.getElementById('addFaceBtn');
const myAttendanceBtn = document.getElementById('myAttendanceBtn');
const viewAttendanceBtn = document.getElementById('viewAttendanceBtn');
const registerBtn = document.getElementById('registerBtn');
const loadAttendanceBtn = document.getElementById('loadAttendanceBtn');
const loadMyAttendanceBtn = document.getElementById('loadMyAttendanceBtn');
const filterBtn = document.getElementById('filterBtn');
const exportBtn = document.getElementById('exportBtn');
const personalFilterBtn = document.getElementById('personalFilterBtn');
const personalExportBtn = document.getElementById('personalExportBtn');
const searchBtn = document.getElementById('searchBtn');
const settingsBtn = document.getElementById('settingsBtn');

// Modals
const registrationModal = document.getElementById('registrationModal');
const myAttendanceModal = document.getElementById('myAttendanceModal');
const attendanceModal = document.getElementById('attendanceModal');
const settingsModal = document.getElementById('settingsModal');
const loadingOverlay = document.getElementById('loadingOverlay');

// Form inputs
const passkeyInput = document.getElementById('passkeyInput');
const nameInput = document.getElementById('nameInput');
const employeeIdReg = document.getElementById('employeeIdReg');
const employeeIdInput = document.getElementById('employeeIdInput');
const viewPasskeyInput = document.getElementById('viewPasskeyInput');
const searchInput = document.getElementById('searchInput');

// Initialize camera
async function initCamera() {
  try {
    setStatus('Initializing camera...', 'info');
    
    const constraints = {
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: 'user'
      }
    };
    
    cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = cameraStream;
    
    video.onloadedmetadata = () => {
      setStatus('Camera ready - You can now capture attendance', 'success');
    };
    
  } catch (error) {
    console.error('Camera error:', error);
    setStatus('Camera access denied. Please allow camera access.', 'error');
    captureBtn.disabled = true;
    addFaceBtn.disabled = true;
  }
}

// Update current time display
function updateCurrentTime() {
  const now = new Date();
  const timeString = now.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour12: true,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  const currentTimeElement = document.getElementById('currentTime');
  if (currentTimeElement) {
    currentTimeElement.textContent = timeString;
  }
}

// Set status display
function setStatus(message, type = 'info') {
  statusText.textContent = message;
  statusDisplay.className = `status-display ${type}`;
  
  // Update icon based on type
  statusIcon.className = type === 'success' ? 'fas fa-check-circle' :
                        type === 'error' ? 'fas fa-exclamation-circle' :
                        type === 'warning' ? 'fas fa-exclamation-triangle' :
                        'fas fa-info-circle';
}

// Get image data from video
function getImageData() {
  if (!video.videoWidth || !video.videoHeight) {
    return null;
  }
  
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);
  
  return canvas.toDataURL('image/jpeg').split(',')[1];
}

// Show loading overlay
function showLoading(message = 'Processing...') {
  loadingOverlay.style.display = 'flex';
  document.getElementById('loadingMessage').textContent = message;
}

// Hide loading overlay
function hideLoading() {
  loadingOverlay.style.display = 'none';
}

// Add recent activity
function addRecentActivity(name, action, time) {
  const recentList = document.getElementById('recentList');
  const activityItem = document.createElement('div');
  activityItem.className = 'activity-item';
  
  const iconClass = action === 'attendance' ? 'check-circle' : 'user-plus';
  const actionText = action === 'attendance' ? 'Attendance Marked' : 'Face Registered';
  
  activityItem.innerHTML = `
    <div class="activity-icon">
      <i class="fas fa-${iconClass}"></i>
    </div>
    <div class="activity-content">
      <span class="activity-name">${name} - ${actionText}</span>
      <span class="activity-time">${time}</span>
    </div>
  `;
  
  recentList.insertBefore(activityItem, recentList.firstChild);
  
  // Keep only latest 5 activities
  while (recentList.children.length > 5) {
    recentList.removeChild(recentList.lastChild);
  }
}

// Capture attendance
async function captureAttendance() {
  if (isProcessing) {
    setStatus('Already processing, please wait...', 'warning');
    return;
  }
  
  const imageData = getImageData();
  if (!imageData || imageData.length < MIN_IMAGE_SIZE) {
    setStatus('Image capture failed. Please try again.', 'error');
    return;
  }
  
  isProcessing = true;
  captureBtn.disabled = true;
  showLoading('Processing attendance...');
  setStatus('Processing attendance...', 'info');
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: imageData
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.match) {
      const currentTime = new Date().toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour12: false
      });
      
      setStatus(`✅ Attendance marked for ${data.match}\n🎯 Confidence: ${Math.round(data.similarity)}%\n🕒 ${data.timestamp}`, 'success');
      addRecentActivity(data.match, 'attendance', currentTime);
      
      // Play success sound if enabled
      if (localStorage.getItem('soundEnabled') !== 'false') {
        playNotificationSound('success');
      }
    } else {
      setStatus(`❌ ${data.message || 'No face match found. Please register first.'}`, 'error');
      
      // Play error sound if enabled
      if (localStorage.getItem('soundEnabled') !== 'false') {
        playNotificationSound('error');
      }
    }
    
  } catch (error) {
    console.error('Detailed attendance error:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    setStatus(`Network error: ${error.message}. Check console for details.`, 'error');
  } finally {
    isProcessing = false;
    captureBtn.disabled = false;
    hideLoading();
  }
}

// Show registration modal
function showRegistrationModal() {
  registrationModal.style.display = 'flex';
  passkeyInput.value = '';
  nameInput.value = '';
  employeeIdReg.value = '';
  passkeyInput.focus();
}

// Hide registration modal
function hideRegistrationModal() {
  registrationModal.style.display = 'none';
}

// Register face
async function registerFace() {
  const passkey = passkeyInput.value.trim();
  const name = nameInput.value.trim();
  const employeeId = employeeIdReg.value.trim().toUpperCase();
  
  if (!ALLOWED_PASSKEYS.includes(passkey)) {
    setStatus('Invalid passkey. Access denied.', 'error');
    passkeyInput.focus();
    return;
  }
  
  if (!name || name.length < 2) {
    setStatus('Please enter a valid name (at least 2 characters).', 'error');
    nameInput.focus();
    return;
  }
  
  if (!employeeId || employeeId.length < 3) {
    setStatus('Please enter a valid Employee ID (minimum 3 characters).', 'error');
    employeeIdReg.focus();
    return;
  }
  
  if (!/^[a-zA-Z\s]+$/.test(name)) {
    setStatus('Name should contain only letters and spaces.', 'error');
    nameInput.focus();
    return;
  }
  
  const imageData = getImageData();
  if (!imageData || imageData.length < MIN_IMAGE_SIZE) {
    setStatus('Image capture failed. Please try again.', 'error');
    return;
  }
  
  isProcessing = true;
  registerBtn.disabled = true;
  showLoading('Registering face...');
  setStatus('Registering face...', 'info');
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: imageData,
        name: name,
        employeeId: employeeId,
        passkey: passkey
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success) {
      const currentTime = new Date().toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour12: false
      });
      
      setStatus(`✅ Face registered successfully for ${name}\n🆔 Employee ID: ${employeeId}\n🕒 ${data.timestamp}`, 'success');
      addRecentActivity(`${name} (${employeeId})`, 'registration', currentTime);
      
      // Play success sound if enabled
      if (localStorage.getItem('soundEnabled') !== 'false') {
        playNotificationSound('success');
      }
      
      setTimeout(() => {
        hideRegistrationModal();
      }, 2000);
    } else {
      if (data.message && data.message.includes('already')) {
        setStatus(`⚠️ Face already registered!\n${data.message}`, 'warning');
      } else {
        setStatus(`❌ Registration failed: ${data.message || 'Unknown error'}`, 'error');
      }
    }
    
  } catch (error) {
    console.error('Registration error:', error);
    setStatus(`Network error: ${error.message}. Check console for details.`, 'error');
  } finally {
    isProcessing = false;
    registerBtn.disabled = false;
    hideLoading();
  }
}

// Employee Self-Service Functions
function showMyAttendanceModal() {
  myAttendanceModal.style.display = 'flex';
  employeeIdInput.value = '';
  employeeIdInput.focus();
  document.getElementById('myRecordsSection').style.display = 'none';
  currentEmployeeData = [];
  currentEmployeeId = '';
}

function hideMyAttendanceModal() {
  myAttendanceModal.style.display = 'none';
  currentEmployeeData = [];
  currentEmployeeId = '';
}

async function loadMyAttendanceRecords() {
  const employeeId = employeeIdInput.value.trim().toUpperCase();
  
  if (!employeeId || employeeId.length < 3) {
    setStatus('Please enter a valid Employee ID (minimum 3 characters)', 'error');
    employeeIdInput.focus();
    return;
  }
  
  showLoading('Loading your attendance records...');
  setStatus('Loading your attendance records...', 'info');
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'GET_EMPLOYEE_ATTENDANCE',
        employeeId: employeeId
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Employee records response:', data); // Debug log
    
    if (data.success) {
      currentEmployeeData = data.records || [];
      currentEmployeeId = employeeId;
      console.log(`Loaded ${currentEmployeeData.length} records for ${employeeId}`); // Debug log
      
      document.getElementById('myRecordsSection').style.display = 'block';
      
      // Update employee info
      document.getElementById('employeeName').textContent = `Employee Dashboard - ${employeeId}`;
      document.getElementById('employeeIdDisplay').textContent = employeeId;
      document.getElementById('lastUpdated').textContent = new Date().toLocaleString('en-IN');
      
      displayPersonalAttendanceRecords(currentEmployeeData);
      updatePersonalStats(currentEmployeeData);
      setStatus(`✅ Loaded ${currentEmployeeData.length} attendance records for ${employeeId}`, 'success');
    } else {
      if (data.message && data.message.includes('not found')) {
        setStatus(`❌ No records found for Employee ID: ${employeeId}`, 'error');
      } else {
        setStatus(`❌ ${data.message || 'Failed to load records'}`, 'error');
      }
    }
    
  } catch (error) {
    console.error('Load employee records error:', error);
    // Fallback to demo data for testing
    currentEmployeeData = generatePersonalDemoData(employeeId);
    currentEmployeeId = employeeId;
    document.getElementById('myRecordsSection').style.display = 'block';
    
    // Update employee info
    document.getElementById('employeeName').textContent = `Employee Dashboard - ${employeeId}`;
    document.getElementById('employeeIdDisplay').textContent = employeeId;
    document.getElementById('lastUpdated').textContent = new Date().toLocaleString('en-IN');
    
    displayPersonalAttendanceRecords(currentEmployeeData);
    updatePersonalStats(currentEmployeeData);
    setStatus(`✅ Loaded ${currentEmployeeData.length} records for ${employeeId} (demo data)`, 'success');
  } finally {
    hideLoading();
  }
}

function displayPersonalAttendanceRecords(records) {
  console.log('Displaying personal records:', records); // Debug log
  const recordsContainer = document.getElementById('personalRecordsContainer');
  const recordCount = document.getElementById('recordCount');
  
  if (!records || records.length === 0) {
    recordsContainer.innerHTML = `
      <div class="no-personal-records">
        <i class="fas fa-calendar-times"></i>
        <h4>No Attendance Records Found</h4>
        <p>You don't have any attendance records yet. Start marking your attendance!</p>
      </div>
    `;
    recordCount.textContent = '0 records';
    return;
  }
  
  // Sort records by date (newest first) - THIS IS THE KEY FIX
  const sortedRecords = [...records].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  console.log(`Sorted ${sortedRecords.length} records for display`); // Debug log
  
  let recordsHTML = '';
  sortedRecords.forEach((record, index) => {
    const date = new Date(record.timestamp);
    const displayDate = date.toLocaleDateString('en-IN', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    const displayTime = date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    const confidence = Math.round(record.similarity || record.confidence || 0);
    
    recordsHTML += `
      <div class="personal-record-item">
        <div class="personal-record-info">
          <span class="personal-record-date">${displayDate}</span>
          <span class="personal-record-time">${displayTime}</span>
        </div>
        <div class="personal-record-badge">
          <span class="personal-record-confidence">${confidence}%</span>
          <span class="personal-record-status">${record.status || 'Present'}</span>
        </div>
      </div>
    `;
  });
  
  recordsContainer.innerHTML = recordsHTML;
  recordCount.textContent = `${sortedRecords.length} record${sortedRecords.length !== 1 ? 's' : ''}`;
  console.log(`Rendered ${sortedRecords.length} records in UI`); // Debug log
}

function updatePersonalStats(records) {
  const totalDaysElement = document.getElementById('myTotalDays');
  const thisMonthElement = document.getElementById('thisMonthDays');
  const avgTimeElement = document.getElementById('avgTime');
  const attendanceRateElement = document.getElementById('attendanceRate');
  
  if (!records || records.length === 0) {
    totalDaysElement.textContent = '0';
    thisMonthElement.textContent = '0';
    avgTimeElement.textContent = '--:--';
    attendanceRateElement.textContent = '0%';
    return;
  }
  
  // Calculate total unique days
  const uniqueDays = new Set(records.map(r => new Date(r.timestamp).toDateString())).size;
  totalDaysElement.textContent = uniqueDays;
  
  // Calculate this month's attendance
  const thisMonth = new Date().getMonth();
  const thisYear = new Date().getFullYear();
  const thisMonthRecords = records.filter(record => {
    const recordDate = new Date(record.timestamp);
    return recordDate.getMonth() === thisMonth && recordDate.getFullYear() === thisYear;
  });
  
  const thisMonthUniqueDays = new Set(thisMonthRecords.map(r => new Date(r.timestamp).toDateString())).size;
  thisMonthElement.textContent = thisMonthUniqueDays;
  
  // Calculate average check-in time
  if (records.length > 0) {
    const times = records.map(record => {
      const date = new Date(record.timestamp);
      return date.getHours() * 60 + date.getMinutes();
    });
    
    const avgMinutes = times.reduce((sum, time) => sum + time, 0) / times.length;
    const avgHours = Math.floor(avgMinutes / 60);
    const avgMins = Math.round(avgMinutes % 60);
    avgTimeElement.textContent = `${avgHours.toString().padStart(2, '0')}:${avgMins.toString().padStart(2, '0')}`;
  }
  
  // Calculate attendance rate (assuming 22 working days per month)
  const workingDaysThisMonth = 22;
  const attendanceRate = Math.round((thisMonthUniqueDays / workingDaysThisMonth) * 100);
  attendanceRateElement.textContent = `${Math.min(attendanceRate, 100)}%`;
}

function filterPersonalRecords() {
  const filterValue = document.getElementById('personalFilterType').value;
  const now = new Date();
  let filteredRecords = [...currentEmployeeData]; // Work with all data
  
  console.log(`Filtering ${currentEmployeeData.length} records with filter: ${filterValue}`); // Debug log
  
  switch (filterValue) {
    case 'week':
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      filteredRecords = currentEmployeeData.filter(r => 
        new Date(r.timestamp) >= weekAgo
      );
      break;
    case 'month':
      const thisMonth = now.getMonth();
      const thisYear = now.getFullYear();
      filteredRecords = currentEmployeeData.filter(r => {
        const recordDate = new Date(r.timestamp);
        return recordDate.getMonth() === thisMonth && recordDate.getFullYear() === thisYear;
      });
      break;
    case 'quarter':
      const quarterAgo = new Date(now);
      quarterAgo.setMonth(quarterAgo.getMonth() - 3);
      filteredRecords = currentEmployeeData.filter(r => 
        new Date(r.timestamp) >= quarterAgo
      );
      break;
    case 'all':
      filteredRecords = [...currentEmployeeData]; // Show all records
      break;
  }
  
  console.log(`Filtered to ${filteredRecords.length} records`); // Debug log
  displayPersonalAttendanceRecords(filteredRecords);
  document.getElementById('personalRecordsTitle').textContent = 
    `My Attendance Records (${filteredRecords.length} filtered)`;
}

function exportPersonalAttendance() {
  if (!currentEmployeeData || currentEmployeeData.length === 0) {
    setStatus('No personal data to export', 'error');
    return;
  }
  
  const headers = ['Date', 'Time', 'Day of Week', 'Confidence', 'Status', 'Employee ID'];
  const csvContent = [
    headers.join(','),
    ...currentEmployeeData.map(record => {
      const date = new Date(record.timestamp);
      const displayDate = date.toLocaleDateString('en-IN');
      const displayTime = date.toLocaleTimeString('en-IN', { hour12: true });
      const dayOfWeek = date.toLocaleDateString('en-IN', { weekday: 'long' });
      return [
        displayDate,
        displayTime,
        dayOfWeek,
        Math.round(record.similarity || record.confidence || 0) + '%',
        record.status || 'PRESENT',
        currentEmployeeId
      ].join(',');
    })
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `my_attendance_${currentEmployeeId}_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  setStatus('Personal attendance data exported successfully', 'success');
}

function generatePersonalDemoData(employeeId) {
  const data = [];
  const now = new Date();
  
  // Generate 30 days of sample data
  for (let i = 0; i < 30; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    // Skip weekends for realistic data
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    
    // Random check-in time between 8:30 AM and 10:00 AM
    date.setHours(8 + Math.floor(Math.random() * 2));
    date.setMinutes(30 + Math.floor(Math.random() * 60));
    
    data.push({
      employeeId: employeeId,
      timestamp: date.toISOString(),
      similarity: 85 + Math.random() * 15,
      status: 'PRESENT'
    });
  }
  
  return data;
}

// Admin attendance functions
function showAttendanceModal() {
  attendanceModal.style.display = 'flex';
  viewPasskeyInput.value = '';
  viewPasskeyInput.focus();
  document.getElementById('recordsSection').style.display = 'none';
}

function hideAttendanceModal() {
  attendanceModal.style.display = 'none';
  currentAttendanceData = [];
}

async function loadAttendanceRecords() {
  const passkey = viewPasskeyInput.value.trim();
  
  if (!ALLOWED_PASSKEYS.includes(passkey)) {
    setStatus('Invalid passkey. Access denied.', 'error');
    viewPasskeyInput.focus();
    return;
  }
  
  showLoading('Loading all attendance records...');
  setStatus('Loading attendance records...', 'info');
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'GET_ATTENDANCE',
        passkey: passkey
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success) {
      currentAttendanceData = data.records || [];
      document.getElementById('recordsSection').style.display = 'block';
      displayAttendanceRecords(currentAttendanceData);
      updateAdminStats(currentAttendanceData);
      setStatus(`✅ Loaded ${currentAttendanceData.length} attendance records`, 'success');
    } else {
      setStatus(`❌ Failed to load records: ${data.message}`, 'error');
    }
    
  } catch (error) {
    console.error('Load records error:', error);
    // Fallback to demo data
    currentAttendanceData = generateDemoData();
    document.getElementById('recordsSection').style.display = 'block';
    displayAttendanceRecords(currentAttendanceData);
    updateAdminStats(currentAttendanceData);
    setStatus(`✅ Loaded ${currentAttendanceData.length} records (demo data)`, 'success');
  } finally {
    hideLoading();
  }
}

function displayAttendanceRecords(records) {
  const recordsContainer = document.getElementById('recordsContainer');
  const adminRecordCount = document.getElementById('adminRecordCount');
  
  if (!records || records.length === 0) {
    recordsContainer.innerHTML = `
      <div class="no-records">
        <i class="fas fa-database"></i>
        <h4>No Records Found</h4>
        <p>No attendance records found.</p>
      </div>
    `;
    adminRecordCount.textContent = '0 records';
    return;
  }
  
  // Sort records by timestamp (newest first)
  const sortedRecords = [...records].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  let recordsHTML = '';
  sortedRecords.forEach(record => {
    const date = new Date(record.timestamp);
    const displayTime = record.display_time || date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour12: false
    });
    const confidence = Math.round(record.similarity || record.confidence || 0);
    
    recordsHTML += `
      <div class="record-item">
        <div class="record-info">
          <span class="record-name">${record.name} ${record.employeeId ? `(${record.employeeId})` : ''}</span>
          <span class="record-time">${displayTime}</span>
        </div>
        <div class="record-confidence">${confidence}%</div>
      </div>
    `;
  });
  
  recordsContainer.innerHTML = recordsHTML;
  adminRecordCount.textContent = `${sortedRecords.length} record${sortedRecords.length !== 1 ? 's' : ''}`;
}

function updateAdminStats(records) {
  const totalUsers = document.getElementById('totalUsers');
  const todayCount = document.getElementById('todayCount');
  const avgConfidence = document.getElementById('avgConfidence');
  const totalRecords = document.getElementById('totalRecords');
  
  if (!records || records.length === 0) {
    totalUsers.textContent = '0';
    todayCount.textContent = '0';
    avgConfidence.textContent = '0%';
    totalRecords.textContent = '0';
    return;
  }
  
  // Calculate statistics
  const uniqueUsers = new Set(records.map(r => r.name)).size;
  const today = new Date().toDateString();
  const todayRecords = records.filter(r => new Date(r.timestamp).toDateString() === today).length;
  const avgConf = records.reduce((sum, r) => sum + (r.similarity || r.confidence || 0), 0) / records.length;
  
  totalUsers.textContent = uniqueUsers;
  todayCount.textContent = todayRecords;
  avgConfidence.textContent = Math.round(avgConf) + '%';
  totalRecords.textContent = records.length;
}

function generateDemoData() {
  const names = ['John Doe', 'Jane Smith', 'Mike Johnson', 'Sarah Wilson', 'David Brown', 'Lisa Davis'];
  const employeeIds = ['EMP001', 'EMP002', 'EMP003', 'EMP004', 'EMP005', 'EMP006'];
  const data = [];
  
  for (let i = 0; i < 25; i++) {
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * 14));
    date.setHours(Math.floor(Math.random() * 10) + 8);
    date.setMinutes(Math.floor(Math.random() * 60));
    
    const index = Math.floor(Math.random() * names.length);
    
    data.push({
      name: names[index],
      employeeId: employeeIds[index],
      timestamp: date.toISOString(),
      similarity: 85 + Math.random() * 15,
      status: 'PRESENT'
    });
  }
  
  return data;
}

function filterRecords() {
  const filterValue = document.getElementById('filterType').value;
  const now = new Date();
  let filteredRecords = [...currentAttendanceData];
  
  switch (filterValue) {
    case 'today':
      filteredRecords = currentAttendanceData.filter(r => 
        new Date(r.timestamp).toDateString() === now.toDateString()
      );
      break;
    case 'yesterday':
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      filteredRecords = currentAttendanceData.filter(r => 
        new Date(r.timestamp).toDateString() === yesterday.toDateString()
      );
      break;
    case 'week':
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      filteredRecords = currentAttendanceData.filter(r => 
        new Date(r.timestamp) >= weekAgo
      );
      break;
    case 'month':
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      filteredRecords = currentAttendanceData.filter(r => 
        new Date(r.timestamp) >= monthAgo
      );
      break;
  }
  
  displayAttendanceRecords(filteredRecords);
  document.getElementById('recordsTitle').textContent = 
    `All Attendance Records (${filteredRecords.length} filtered)`;
}

function searchRecords() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  
  if (!searchTerm) {
    displayAttendanceRecords(currentAttendanceData);
    document.getElementById('recordsTitle').textContent = 'All Attendance Records';
    return;
  }
  
  const searchResults = currentAttendanceData.filter(record => 
    record.name.toLowerCase().includes(searchTerm) ||
    (record.employeeId && record.employeeId.toLowerCase().includes(searchTerm))
  );
  
  displayAttendanceRecords(searchResults);
  document.getElementById('recordsTitle').textContent = 
    `Search Results for "${searchTerm}" (${searchResults.length} found)`;
}

function exportToCSV() {
  if (!currentAttendanceData || currentAttendanceData.length === 0) {
    setStatus('No data to export', 'error');
    return;
  }
  
  const headers = ['Name', 'Employee ID', 'Date & Time', 'Day of Week', 'Confidence', 'Status'];
  const csvContent = [
    headers.join(','),
    ...currentAttendanceData.map(record => {
      const date = new Date(record.timestamp);
      const displayTime = date.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour12: false
      });
      const dayOfWeek = date.toLocaleDateString('en-IN', { weekday: 'long' });
      return [
        record.name,
        record.employeeId || 'N/A',
        displayTime,
        dayOfWeek,
        Math.round(record.similarity || record.confidence || 0) + '%',
        record.status || 'PRESENT'
      ].join(',');
    })
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');  
  a.href = url;
  a.download = `all_attendance_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  setStatus('All attendance data exported successfully', 'success');
}

// Settings functions
function showSettingsModal() {
  settingsModal.style.display = 'flex';
  loadSettings();
}

function hideSettingsModal() {
  settingsModal.style.display = 'none';
}

function saveSettings() {
  const cameraQuality = document.getElementById('cameraQuality').value;
  const sensitivity = document.getElementById('sensitivitySlider').value;
  const soundEnabled = document.getElementById('soundEnabled').checked;
  const autoHide = document.getElementById('autoHide').checked;
  const darkMode = document.getElementById('darkMode').checked;
  
  // Save to localStorage
  localStorage.setItem('cameraQuality', cameraQuality);
  localStorage.setItem('sensitivity', sensitivity);
  localStorage.setItem('soundEnabled', soundEnabled);
  localStorage.setItem('autoHide', autoHide);
  localStorage.setItem('darkMode', darkMode);
  
  // Apply dark mode
  if (darkMode) {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
  
  setStatus('Settings saved successfully', 'success');
  hideSettingsModal();
}

function loadSettings() {
  const cameraQuality = localStorage.getItem('cameraQuality') || 'medium';
  const sensitivity = localStorage.getItem('sensitivity') || '85';
  const soundEnabled = localStorage.getItem('soundEnabled') !== 'false';
  const autoHide = localStorage.getItem('autoHide') !== 'false';
  const darkMode = localStorage.getItem('darkMode') === 'true';
  
  document.getElementById('cameraQuality').value = cameraQuality;
  document.getElementById('sensitivitySlider').value = sensitivity;
  document.getElementById('sensitivityValue').textContent = sensitivity + '%';
  document.getElementById('soundEnabled').checked = soundEnabled;
  document.getElementById('autoHide').checked = autoHide;
  document.getElementById('darkMode').checked = darkMode;
  
  // Apply dark mode
  if (darkMode) {
    document.body.classList.add('dark-mode');
  }
}

function updateSensitivityDisplay() {
  const slider = document.getElementById('sensitivitySlider');
  const valueDisplay = document.getElementById('sensitivityValue');
  valueDisplay.textContent = slider.value + '%';
}

// Notification sound function
function playNotificationSound(type) {
  try {
    // Create audio context for web audio API
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Set frequency based on notification type
    oscillator.frequency.setValueAtTime(type === 'success' ? 800 : 400, audioContext.currentTime);
    oscillator.type = 'sine';
    
    // Set volume
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    // Play sound
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (error) {
    console.log('Audio not supported or blocked:', error);
  }
}

// Input validation functions
function validateEmployeeId(input) {
  const value = input.value.trim();
  if (value.length >= 3) {
    input.classList.remove('employee-id-invalid');
    input.classList.add('employee-id-valid');
  } else {
    input.classList.remove('employee-id-valid');
    input.classList.add('employee-id-invalid');
  }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
  // Initialize camera and time
  initCamera();
  updateCurrentTime();
  setInterval(updateCurrentTime, 1000);
  
  // Load saved settings
  loadSettings();
  
  // Button event listeners
  if (captureBtn) captureBtn.addEventListener('click', captureAttendance);
  if (addFaceBtn) addFaceBtn.addEventListener('click', showRegistrationModal);
  if (myAttendanceBtn) myAttendanceBtn.addEventListener('click', showMyAttendanceModal);
  if (viewAttendanceBtn) viewAttendanceBtn.addEventListener('click', showAttendanceModal);
  if (registerBtn) registerBtn.addEventListener('click', registerFace);
  if (loadAttendanceBtn) loadAttendanceBtn.addEventListener('click', loadAttendanceRecords);
  if (loadMyAttendanceBtn) loadMyAttendanceBtn.addEventListener('click', loadMyAttendanceRecords);
  if (filterBtn) filterBtn.addEventListener('click', filterRecords);
  if (exportBtn) exportBtn.addEventListener('click', exportToCSV);
  if (personalFilterBtn) personalFilterBtn.addEventListener('click', filterPersonalRecords);
  if (personalExportBtn) personalExportBtn.addEventListener('click', exportPersonalAttendance);
  if (searchBtn) searchBtn.addEventListener('click', searchRecords);
  if (settingsBtn) settingsBtn.addEventListener('click', showSettingsModal);
  
  // Settings event listeners
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', saveSettings);
  
  const sensitivitySlider = document.getElementById('sensitivitySlider');
  if (sensitivitySlider) sensitivitySlider.addEventListener('input', updateSensitivityDisplay);
  
  // Input validation event listeners
  if (employeeIdInput) {
    employeeIdInput.addEventListener('input', function() {
      validateEmployeeId(this);
    });
    
    employeeIdInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        loadMyAttendanceRecords();
      }
    });
  }
  
  if (employeeIdReg) {
    employeeIdReg.addEventListener('input', function() {
      this.value = this.value.toUpperCase();
      validateEmployeeId(this);
    });
  }
  
  if (searchInput) {
    searchInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        searchRecords();
      }
    });
    
    // Real-time search
    searchInput.addEventListener('input', function() {
      if (this.value.length === 0) {
        displayAttendanceRecords(currentAttendanceData);
        document.getElementById('recordsTitle').textContent = 'All Attendance Records';
      }
    });
  }
  
  // Keyboard shortcuts
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      hideRegistrationModal();
      hideMyAttendanceModal();
      hideAttendanceModal();
      hideSettingsModal();
    }
    
    // Alt + A for attendance
    if (e.altKey && e.key === 'a') {
      e.preventDefault();
      captureAttendance();
    }
    
    // Alt + R for registration
    if (e.altKey && e.key === 'r') {
      e.preventDefault();
      showRegistrationModal();
    }
  });
  
  // Modal click outside to close
  window.addEventListener('click', function(e) {
    if (e.target === registrationModal) {
      hideRegistrationModal();
    }
    if (e.target === myAttendanceModal) {
      hideMyAttendanceModal();
    }
    if (e.target === attendanceModal) {
      hideAttendanceModal();
    }
    if (e.target === settingsModal) {
      hideSettingsModal();
    }
  });
  
  // Auto-hide success messages if enabled
  const originalSetStatus = setStatus;
  setStatus = function(message, type) {
    originalSetStatus(message, type);
    
    if (type === 'success' && localStorage.getItem('autoHide') !== 'false') {
      setTimeout(() => {
        if (statusDisplay.classList.contains('success')) {
          originalSetStatus('Ready for next action', 'info');
        }
      }, 3000);
    }
  };
});

// Export functions for global access
window.hideRegistrationModal = hideRegistrationModal;
window.hideMyAttendanceModal = hideMyAttendanceModal;
window.hideAttendanceModal = hideAttendanceModal;
window.hideSettingsModal = hideSettingsModal;
