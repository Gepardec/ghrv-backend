require('dotenv').config();

const { Octokit } = require('@octokit/rest');
const octokit = new Octokit({ auth: process.env['GH.AUTH.TOKEN'] });
const GH_ORG = process.env['GH.ORG'];
const AWS = require('aws-sdk');
const dynamoDb = new AWS.DynamoDB.DocumentClient();
const moment = require('moment');

global.DATE_FORMAT = 'YYYY-MM-DD';

exports.getStatsBetweenDates = async function (minDate, maxDate) {
    return (await
        dynamoDb.scan(
            {
                TableName: 'stat',
                ExpressionAttributeValues: { ':minDate': minDate.format(DATE_FORMAT), ':maxDate': maxDate.format(DATE_FORMAT) },
                FilterExpression: 'statDate between :minDate and :maxDate'
            }).promise()).Items;
}

exports.getStatsBetweenDatesGroupedByRepoName = async function (minDate, maxDate) {
    let stats = await exports.getStatsBetweenDates(minDate, maxDate);
    stats = stats.reduce(function (acc, curr) {
        let repoName = curr.repoName;
        delete curr['repoName'];
        acc[repoName] = acc[repoName] || [];
        acc[repoName].push(curr);
        return acc;
    }, Object.create(null));
    return stats;
}

exports.refreshData = async function () {
    let today = moment();
    let repoNames = await exports.getAllPublicRepoNames();

    for (const repoName of repoNames) {
        try {
            let viewTraffic = await octokit.repos.getViews({ owner: GH_ORG, repo: repoName, per: 'day' });

            for (const view of viewTraffic.data.views) {
                let timestamp = moment(view.timestamp);
                if (timestamp.isBefore(today, 'day')) {
                    insert({ count: view.count, uniques: view.uniques, statDate: timestamp.format(DATE_FORMAT), repoName: repoName });
                }
            }

        } catch (error) { // Push access errors catched here
            console.log(error);
        }
    }
}

exports.getAllPublicRepoNames = async function () {
    let repoNames = [];
    let page = 1;

    do {
        let ghResponse = await
            octokit.repos.listForOrg({
                org: GH_ORG,
                type: 'public',
                per_page: 100,
                page: page
            });

        let data = ghResponse.data;
        if (!data || data.length === 0) {
            break;
        } else {
            page++;
            repoNames = repoNames.concat(data.map(data => data.name));
        }
    } while (true);

    return repoNames;
}

function insert(item) {
    dynamoDb.put({ TableName: 'stat', Item: item }, (err, data) => {
        if (err) {
            console.log('an error occured while inserting: ', err);
        } else {
            console.log('inserting new record...');
        }
    });
}
