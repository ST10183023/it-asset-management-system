
require('dotenv').config();

const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI);

async function startServer() {
  try {
    await client.connect();

    const database = client.db('asset_management');
    const assets = database.collection('assets');

    console.log('Connected to MongoDB Atlas successfully!');

    app.get('/', (req, res) => {
      res.json({ message: 'IT Asset Management API is running' });
    });

    // Retrieve all assets
    app.get('/api/assets', async (req, res) => {
      try {
        const results = await assets.find({}).toArray();
        res.json(results);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to retrieve assets' });
      }
    });

    // Register a new asset
    app.post('/api/assets', async (req, res) => {
      try {
        const { name, category, assignedTo, location, status } = req.body;

        if (!name || !category || !location || !status) {
          return res.status(400).json({
            error: 'Name, category, location and status are required',
          });
        }

        const newAsset = {
          assetTag: `AST-${Date.now()}`,
          name: String(name).trim(),
          category: String(category).trim(),
          assignedTo: String(assignedTo || '').trim(),
          location: String(location).trim(),
          status: String(status).trim(),
          createdAt: new Date(),
        };

        const result = await assets.insertOne(newAsset);

        res.status(201).json({
          message: 'Asset registered successfully',
          asset: { ...newAsset, _id: result.insertedId },
        });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to register asset' });
      }
    });

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Could not connect to MongoDB:', error.message);
    process.exit(1);
  }
}

startServer();
