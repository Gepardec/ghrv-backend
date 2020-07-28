require('dotenv').config();

const {getStatsBetweenDatesGroupedByRepoName} = require('./service');
const moment = require('moment');

const serverless = require('serverless-http');
const bodyParser = require('body-parser');
const express = require('express');
const cors = require('cors');
const app = express();

app.use(bodyParser.json({strict: false}));
app.use(cors());

app.get('/allStatsGrouped', async (req, res) => {
    let yesterday = moment().subtract(1, 'day');

    let fromDate = req.query.fromDate ? moment(req.query.fromDate, DATE_FORMAT, true) : moment().startOf('month');
    let toDate = req.query.toDate ? moment(req.query.toDate, DATE_FORMAT, true) : yesterday;

    if (!fromDate.isValid() || !toDate.isValid()) {
        return res.status(400).json({error: `provide correct date values in ${DATE_FORMAT}`});
    }

    if (fromDate.isAfter(yesterday, 'day') || toDate.isAfter(yesterday, 'day')) {
        return res.status(400).json({error: 'fromDate and toDate can be max yesterday'});
    }

    if (fromDate.isAfter(toDate, 'day')) {
        return res.status(400).json({error: 'fromDate must be less than or equal to toDate'});
    }

    let stats = await getStatsBetweenDatesGroupedByRepoName(fromDate, toDate);
    return res.json(stats);
});

exports.apiProxyHandler = serverless(app);
