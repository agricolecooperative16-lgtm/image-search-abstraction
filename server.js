const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the frontend folder
app.use(express.static(path.join(__dirname, 'frontend')));

// Your API routes here...
app.get('/api/query/:searchTerm', (req, res) => {
  // Your search logic
});

app.get('/api/recent', (req, res) => {
  // Your recent searches logic
});

// Handle all other routes by serving index.html (for client-side routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 API: http://localhost:${PORT}/api`);
  console.log(`🌐 Web: http://localhost:${PORT}`);
});
