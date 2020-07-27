require('dotenv').config();

const serverless = require('serverless-http');
const bodyParser = require('body-parser');
const express = require('express');
const { getStatsBetweenDatesGroupedByRepoName } = require('./service');
const cors = require('cors');
const app = express();

app.use(bodyParser.json({ strict: false }));
app.use(cors());

app.get('/allStatsGrouped', async (req, res) => {
    let today = new Date();
    today.setHours(0, 0, 0, 0);
    if (today.getDate() === 1) {
        today.setDate(today.getDate() - 1);
    }

    let firstDayOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    let fromDate;
    let toDate;

    fromDate = req.query.fromDate ? Date.parse(req.query.fromDate) : firstDayOfCurrentMonth;
    toDate = req.query.toDate ? Date.parse(req.query.toDate) : today;

    if (isNaN(fromDate) || isNaN(toDate)) {
        return res.status(400).json({ error: 'provide correct date values' });
    }

    fromDate = new Date(fromDate);
    toDate = new Date(toDate);
    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(0, 0, 0, 0);

    if (fromDate > toDate) {
        res.status(400).json({ error: 'fromDate must be less than or equal to toDate. If toDate is not provided, it will be today' });
    }

    if (fromDate > today) {
        fromDate = new Date(firstDayOfCurrentMonth);
    }

    if (toDate > today) {
        toDate = new Date(today);
    }

    let stats = await getStatsBetweenDatesGroupedByRepoName(fromDate, toDate);
    return res.json(stats);
});

exports.apiProxyHandler = serverless(app);