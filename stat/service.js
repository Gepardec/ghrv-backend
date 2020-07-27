require('dotenv').config();

const { Octokit } = require('@octokit/rest');
const octokit = new Octokit({ auth: process.env['GH.AUTH.TOKEN'] });
const GH_ORG = process.env['GH.ORG'];
const AWS = require('aws-sdk');
const dynamoDb = new AWS.DynamoDB.DocumentClient();

function getCleanedISOString(date) {
    date.setHours(0, 0, 0, 0);
    var timezoneOffset = date.getTimezoneOffset() * 60000;
    return (new Date(date - timezoneOffset)).toISOString();
}

exports.getStatsBetweenDates = async function (minDate, maxDate) {
    return (await
        dynamoDb.scan(
            {
                TableName: 'stat',
                ExpressionAttributeValues: { ':minDate': getCleanedISOString(minDate), ':maxDate': getCleanedISOString(maxDate) },
                FilterExpression: 'statDate between :minDate and :maxDate'
            }).promise()).Items;
}

exports.getStatsBetweenDatesGroupedByRepoName = async function (minDate, maxDate) {
    let stats = await exports.getStatsBetweenDates(minDate, maxDate);

    stats = stats.reduce(function (acc, curr) {
        let repoName = curr.repoName;

        delete curr['repoName'];
        delete curr['id'];

        acc[repoName] = acc[repoName] || [];
        acc[repoName].push(curr);

        return acc;
    }, Object.create(null));

    return stats;
}

exports.refreshData = async function () {
    let today = new Date();
    today.setHours(0, 0, 0, 0);

    let repoNames = await exports.getAllPublicRepoNames();

    for (const repoName of repoNames) {
        try {
            let viewTraffic = await octokit.repos.getViews({ owner: GH_ORG, repo: repoName, per: 'day' });

            for (const view of viewTraffic.data.views) {
                let formattedDate = new Date(view.timestamp);
                let formattedDateString = getCleanedISOString(formattedDate);

                if (formattedDate < today) {
                    insert({ count: view.count, uniques: view.uniques, statDate: formattedDateString, repoName: repoName });
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
        if (!data || data.length == 0) {
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
        }
    });
}