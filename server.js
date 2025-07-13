const express = require('express');
const multer = require('multer');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// Roboflow API configuration for Car Detection
const ROBOFLOW_API_URL = "https://serverless.roboflow.com/mobil-obfz5/5";
const ROBOFLOW_API_KEY = "hJyEjEPMYMvFlU7OkVGL";

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API Status endpoint
app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        timestamp: new Date().toISOString(),
        service: 'Car Detection API',
        version: '1.0.0'
    });
});

// Car Detection endpoint
app.post('/api/detect-car', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No image file provided'
            });
        }

        const startTime = Date.now();

        // Read the uploaded image file
        const imageBuffer = fs.readFileSync(req.file.path);
        const base64Image = imageBuffer.toString('base64');

        // Call Roboflow API
        const response = await axios({
            method: "POST",
            url: ROBOFLOW_API_URL,
            params: {
                api_key: ROBOFLOW_API_KEY
            },
            data: base64Image,
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            }
        });

        const processingTime = Date.now() - startTime;

        // Clean up uploaded file
        fs.unlinkSync(req.file.path);

        // Process and format the response
        const result = {
            success: true,
            predictions: response.data.predictions || [],
            time: processingTime,
            image: {
                width: response.data.image?.width || 0,
                height: response.data.image?.height || 0
            },
            timestamp: new Date().toISOString()
        };

        res.json(result);

    } catch (error) {
        console.error('Error detecting cars:', error.message);

        // Clean up uploaded file if it exists
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({
            success: false,
            error: error.message || 'Failed to detect cars'
        });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({
        success: false,
        error: error.message || 'Internal server error'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Car Detection Server running on port ${PORT}`);
    console.log(`📱 Open http://localhost:${PORT} to access the application`);
    console.log(`🔍 API Status: http://localhost:${PORT}/api/status`);
    console.log(`🚗 Car Detection API: http://localhost:${PORT}/api/detect-car`);
});

module.exports = app; 