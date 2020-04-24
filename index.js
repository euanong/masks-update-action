const core = require('@actions/core');
const github = require('@actions/github');
const cheerio = require('cheerio');
const rp = require('request-promise');

const url = 'https://cors-anywhere.herokuapp.com/http://covid.gov.pk/';
const epidata = 'https://storage.googleapis.com/static-covid/static/data-main-v4.json';

function getVal(cs,sel){
    var elem = cs.find(sel).next();
    if (elem.length==0){
        elem = cs.find(sel).prev();
    }
    var num = elem.text();
    return parseInt(num.replace(/,/g, ''));
}

function parseData(html){
    var $ = cheerio.load(html);
    var cs = $('.covid-statistics');

    var result = {
        cases : {},
        deaths : {},
        recovered : {},
        tests : {},
        estimated : {},
    };
    
    //elem, text, name1, name2
    var elements = [
        ["h4", "Confirmed Cases", "cases", "total"],
        ["h6", "Cases (24 HRS)", "cases", "past24hrs"],
        ["h6", "Deaths (24 HRS)", "deaths", "past24hrs"],
        ["h6", "Tests (24 HRS)", "tests", "past24hrs"],
        ["h6", "Total Tests", "tests", "total"],
        ["h4", "Deaths", "deaths", "total"],
        ["h4", "Recovered", "recovered", "total"],
        ["h4", "Sindh", "cases", "sindh"],
        ["h4", "Punjab", "cases", "punjab"],
        ["h4", "Islamabad", "cases", "islamabad"],
        ["h4", "Balochistan", "cases", "balochistan"],
        ["h4", "KP", "cases", "kp"]
    ];

    for (var elem of elements){
        result[elem[2]][elem[3]] = getVal(cs, elem[0]+':contains("'+elem[1]+'")');
    }

    //handle AJK and GB separately
    result["cases"]["ajk"]=getVal(cs,'.ajk-stats:not(:contains("AJK"))');
    result["cases"]["gb"]=getVal(cs,'.stats-gb:not(:contains("GB"))');

    var datestr = cs.find("#date").text();
    var arr = datestr.trim().match(/^LAST UPDATED AT: (\d{1,2}) (\w+), (\d{4}) - (\d{1,2}):(\d{1,2})(\w+)$/);

    if (arr[6].toLowerCase()=="am"){
        if (arr[4]=="12"){
            arr[4]="0";
        }
    } else {
        if (arr[4]!="12"){
            arr[4]=(parseInt(arr[4])+12).toString();
        }
    }
    result["lastupdated"]=(new Date(arr[1]+" "+arr[2]+" "+arr[3]+" "+arr[4]+":"+arr[5]+" UTC+05:00")).toJSON();
    
    rp({uri:epidata,gzip:true,json:true})
        .then((json) => {
            result["estimated"]["date"] = json["created"];
            result["estimated"]["cases"] = json["regions"]["PK"]["CurrentEstimate"];
            var jsonresult = JSON.stringify(result);
            console.log(jsonresult);
            core.setOutput("jsondata", jsonresult); 
        });
    return;
}

async function run() {
    /*try { 
        await puppeteer.launch().then(async browser => {
            const page = await browser.newPage();
            await page.goto(url);
            const html = await page.content();
            await browser.close();
            parseData(html);
        });
    } 
    catch (error) {
        core.setFailed(error.message);
    }*/
    try { 
        rp({
            uri:url,
            gzip:true,
            headers: {
                'x-requested-with': 'XMLHttpRequest'
            }
        }).then(parseData);
    } 
    catch (error) {
        core.setFailed(error.message);
    }
}

run();