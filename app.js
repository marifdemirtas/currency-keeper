const express = require('express');
const request = require('request');
const bodyParser = require('body-parser');
const app = express();

app.use(bodyParser.urlencoded({ extended : true }));
app.use(express.static("public"));

const serverPort = 3000;
const aDayInMilliseconds = 86400000;
const rateCheckLimit = 30;      //To prevent crashing, if the date selected is a holiday (which means the JSON file won't contain that date),
                                //accessParsedData function will look for the data that belongs to the one day prior, until the rate is found
                                //or this limit is reached.
                                
const queryCheckLimit = 104;    //While drawing a graph, graph will cut after placing this number of dots on the graph. Bigger numbers will take longer to load.


function createUrl(req)
{
    var rate = [];
    var curReq = req.query;
    var date = curReq.date ? curReq.date : 'latest';
    var base = curReq.base.toUpperCase();
    var url = 'https://api.exchangeratesapi.io/' + date + '?&base=' + base + '&symbols='

    if (typeof (curReq.rate) == 'object') {
        for (i = 0; i < curReq.rate.length; i++) {
            if (curReq.rate[i] == '') {
                break;
            }
            rate[i] = curReq.rate[i].toUpperCase();
            if (i != 0) {
                url += ',' + rate[i];
            } else {
                url += rate[i];
            }
        }
    } else {
        rate.push(curReq.rate.toUpperCase());
        url += rate[0];
    }

    var initialReq = {
        rate: rate,
        date: date,
        base: base,
        url: url
    };

    return initialReq;
}
function makeRequest(initialReq, res, filename)
{   
    request(initialReq.url, function(error, response, body) {
        if (!error) {
            var parsedBody = (JSON.parse(body));
            if (!parsedBody['error']) {
                res.render(filename, {
                    base : initialReq.base,
                    rate : initialReq.rate,
                    currencyData : parsedBody,
                    date : parsedBody['date'],
                    len : initialReq.rate.length
                });
            } else {
                res.render("notfound.ejs");
            }
        } else {
                console.log("Error while making a request to the server.");
        } 
    });
}

function epochTimeToString(epochTime)
{
    var date = new Date(epochTime);
    var month = "0" + (date.getMonth() + 1);
    month = month.substring(month.length - 2, month.length);
    var day = "0" + date.getDate();
    day = day.substring(day.length - 2, day.length);
    string = "" + date.getFullYear() + "-" + month + "-" + day;
    return string;
}

function createUrlGraph(req)
{
    var curReq = req.query;
    var startDate = curReq.startDate;
    var endDate = curReq.endDate;
    var now = new Date();
    var base = curReq.base.toUpperCase();
    var rate = curReq.rate.toUpperCase();

    if (Date.parse(startDate) > Date.parse(endDate)) {
        var temp = startDate;
        startDate = endDate;
        endDate = temp;
    }
    if (Date.parse(endDate) > Date.parse(now)) {
        endDate = epochTimeToString(now);
            } 

    var url = 'https://api.exchangeratesapi.io/history?start_at=' + startDate + '&end_at=' + endDate + '&base=' + base + '&symbols=' + rate;

    var queryNum = (Date.parse(endDate) - Date.parse(startDate)) / curReq.timeInterval;

    var initialReqGraph = {
        rate : rate,
        date : endDate,
        base : base,
        url : url,
        queryNum : queryNum,
        timeInterval : curReq.timeInterval
    };
    
    return initialReqGraph;
}

function accessParsedBody(parsedBody, initialReq, date)
{
    var i = 0;
    while (parsedBody['rates'][date] == undefined & i < 30) {
        date = epochTimeToString(Date.parse(date) - aDayInMilliseconds);
        i++;
    }
    if (i == rateCheckLimit) {
        return -1;
    }
    var ValueY = parsedBody['rates'][date][initialReq.rate];
    return ValueY;
}

function makeRequestGraph(initialReqGraph, res, xaxis, yaxis)
{
    var curDate = Date.parse(initialReqGraph.date);
    var queryNum = initialReqGraph.queryNum;
    if (queryNum => queryCheckLimit) {
        queryNum = queryCheckLimit;
    }
    request(initialReqGraph.url, function(error, response, body)
    {
        for (i = 0; i < queryNum; i++) {
            if (error) {
                console.log("Error while making a request to the server.");
                break;
            }
            var parsedBody = (JSON.parse(body));
            if (parsedBody['error']) {
                res.render("notfound.ejs");
                break;
            }
            console.log("152 ",typeof curDate,curDate,epochTimeToString(curDate));
            yaxis[i] = accessParsedBody(parsedBody, initialReqGraph, epochTimeToString(curDate));
            if (yaxis[i] == -1) {   //rateCheckLimit is reached
                yaxis.pop();
                break;
            }
            xaxis[i] = (curDate);
            curDate = curDate - initialReqGraph.timeInterval;
        }
        res.render("graph.ejs", { x : xaxis, y : yaxis, queryNum : queryNum });
        console.log(xaxis);
    });
}

// ROUTES

app.get('/', function(req, res) {
    res.render("index.ejs");
});

app.get('/ask', function(req, res) {
    initialReq = createUrl(req);
    makeRequest(initialReq, res, 'response.ejs');
});

app.get('/graph', function(req, res) {
    var xaxis = [];
    var yaxis = [];
    initialReqGraph = createUrlGraph(req);
    makeRequestGraph(initialReqGraph, res, xaxis, yaxis);
});

app.get('*', function(req, res) {
    res.render("error.ejs");
});

app.listen(serverPort, function() {
    console.log("Server is on.");
});