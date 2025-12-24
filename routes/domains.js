const express = require('express');
const router = express.Router();
const twentyiClient = require('../twentyi-client');
const logger = require('../logger');

/**
 * GET /api/domains
 * Get all domains from 20i with hosting status
 */
router.get('/', async (req, res) => {
  try {
    const data = await twentyiClient.getDomains();
    res.json(data);
  } catch (error) {
    logger.error('Failed to fetch domains', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch domains from 20i' });
  }
});

module.exports = router;
