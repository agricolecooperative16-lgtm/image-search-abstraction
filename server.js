require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const { MongoClient } = require('mongodb');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  optionsSuccessStatus: 200
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json());
app.use(express.static('frontend'));

// MongoDB connection
let db;
const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017/image-search');

async function connectDB() {
  try {
    await client.connect();
    db = client.db('image-search');
    console.log('✅ Connected to MongoDB');
    
    // Create index for faster queries
    await db.collection('searches').createIndex({ timeSearched: -1 });
    await db.collection('searches').createIndex({ searchQuery: 'text' });
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

// Search endpoint
app.get('/api/query/:searchTerm', async (req, res) => {
  try {
    const searchTerm = decodeURIComponent(req.params.searchTerm);
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;

    if (!searchTerm || searchTerm.trim().length < 1) {
      return res.status(400).json({ error: 'Search term is required' });
    }

    // Save search to history
    await saveSearchHistory(searchTerm);

    // Fetch images
    const images = await fetchImages(searchTerm, offset);
    
    // Track unique search for analytics
    await trackSearchAnalytics(searchTerm);

    res.json({
      query: searchTerm,
      page: page,
      limit: limit,
      totalResults: images.totalResults || 0,
      totalPages: Math.ceil((images.totalResults || 0) / limit),
      images: images.results || []
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch images',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Recent searches endpoint
app.get('/api/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    
    const searches = await db.collection('searches')
      .find({}, { projection: { _id: 1, searchQuery: 1, timeSearched: 1 } })
      .sort({ timeSearched: -1 })
      .limit(limit)
      .toArray();

    res.json(searches);
  } catch (error) {
    console.error('Recent searches error:', error);
    res.status(500).json({ error: 'Failed to fetch recent searches' });
  }
});

// Analytics endpoint
app.get('/api/analytics', async (req, res) => {
  try {
    const totalSearches = await db.collection('searches').countDocuments();
    const uniqueTerms = await db.collection('searches').distinct('searchQuery');
    const mostPopular = await db.collection('searches')
      .aggregate([
        { $group: { _id: '$searchQuery', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ])
      .toArray();

    res.json({
      totalSearches,
      uniqueSearchTerms: uniqueTerms.length,
      mostPopularQueries: mostPopular
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Fetch images using SerpAPI with fallback
async function fetchImages(query, offset) {
  try {
    const response = await axios.get('https://serpapi.com/search', {
      params: {
        engine: process.env.SEARCH_ENGINE || 'google_images',
        q: query,
        start: offset,
        api_key: process.env.SEARCH_API_KEY,
        num: 10,
        ijn: Math.floor(offset / 10)
      },
      timeout: 10000
    });

    const results = response.data.images_results || [];
    const totalResults = response.data.search_information?.total_results || 0;

    return {
      totalResults: totalResults,
      results: results.map(img => ({
        url: img.original || img.thumbnail || '#',
        thumbnail: img.thumbnail || img.original || '#',
        description: img.title || query,
        parentPage: img.link || '#',
        width: img.original_width || 0,
        height: img.original_height || 0,
        size: img.original_size || 0,
        source: img.source || 'SerpAPI'
      }))
    };
  } catch (error) {
    console.error('SerpAPI error:', error.message);
    // Fallback to mock data
    return getMockImages(query, offset);
  }
}

// Mock data for fallback
function getMockImages(query, offset) {
  const mockImages = [
    {
      url: `https://via.placeholder.com/400x300/9146FF/FFFFFF?text=${encodeURIComponent(query)}`,
      thumbnail: `https://via.placeholder.com/150x120/9146FF/FFFFFF?text=${encodeURIComponent(query)}`,
      description: `${query} - Image 1 (Mock)`,
      parentPage: 'https://example.com/1',
      width: 400,
      height: 300,
      size: 45000,
      source: 'Mock'
    },
    {
      url: `https://via.placeholder.com/400x300/FF6B6B/FFFFFF?text=${encodeURIComponent(query)}`,
      thumbnail: `https://via.placeholder.com/150x120/FF6B6B/FFFFFF?text=${encodeURIComponent(query)}`,
      description: `${query} - Image 2 (Mock)`,
      parentPage: 'https://example.com/2',
      width: 400,
      height: 300,
      size: 42000,
      source: 'Mock'
    }
  ];

  // Generate more mock images if needed
  while (mockImages.length < 10) {
    const colors = ['4ECDC4', 'FFE66D', 'A8E6CF', 'FF8A5C', '6C5CE7'];
    const color = colors[mockImages.length % colors.length];
    mockImages.push({
      url: `https://via.placeholder.com/400x300/${color}/FFFFFF?text=${encodeURIComponent(query)}`,
      thumbnail: `https://via.placeholder.com/150x120/${color}/FFFFFF?text=${encodeURIComponent(query)}`,
      description: `${query} - Image ${mockImages.length + 1} (Mock)`,
      parentPage: `https://example.com/${mockImages.length + 1}`,
      width: 400,
      height: 300,
      size: 35000 + (mockImages.length * 1000),
      source: 'Mock'
    });
  }

  return {
    totalResults: 100,
    results: mockImages.slice(offset % 10, (offset % 10) + 10)
  };
}

// Save search to history
async function saveSearchHistory(searchTerm) {
  try {
    await db.collection('searches').insertOne({
      searchQuery: searchTerm,
      timeSearched: new Date().toLocaleString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }),
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error saving search history:', error);
  }
}

// Track search analytics
async function trackSearchAnalytics(searchTerm) {
  try {
    await db.collection('analytics').updateOne(
      { searchQuery: searchTerm },
      { 
        $inc: { count: 1 },
        $setOnInsert: { firstSearched: new Date() },
        $set: { lastSearched: new Date() }
      },
      { upsert: true }
    );
  } catch (error) {
    console.error('Error tracking analytics:', error);
  }
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 API: http://localhost:${PORT}/api`);
    console.log(`🌐 Web: http://localhost:${PORT}`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing server...');
  await client.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing server...');
  await client.close();
  process.exit(0);
});
