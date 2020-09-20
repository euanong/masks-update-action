const core = require('@actions/core');
const github = require('@actions/github');
const cheerio = require('cheerio');
const rp = require('request-promise');

const url = 'https://cors-anywhere.herokuapp.com/http://covid.gov.pk/';
const epidata = 'https://storage.googleapis.com/static-covid/static/v4/main/data-v4.json';
const epidata_pk = 'https://storage.googleapis.com/static-covid/static/v4/main/extdata-PK.json';

const group = "2W_Moderate";
const key = "EXPECTED_WEAK";

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
    var cs = $('.status');

    var result = {
        cases : {},
        deaths : {},
        recovered : {},
        tests : {},
        estimated : {},
    };
    
    //elem, text, name1, name2
    var elements = [
        ["label", "Confirmed Cases", "cases", "total"],
        //["h6", "Cases (24 HRS)", "cases", "past24hrs"],
        //["h6", "Deaths (24 HRS)", "deaths", "past24hrs"],
        //["h6", "Tests (24 HRS)", "tests", "past24hrs"],
        ["label", "Total Tests", "tests", "total"],
        ["label", "Deaths", "deaths", "total"],
        ["label", "Recovered", "recovered", "total"],
        ["h6", "SINDH", "cases", "sindh"],
        ["h6", "PUNJAB", "cases", "punjab"],
        ["h6", "ISLAMABAD", "cases", "islamabad"],
        ["h6", "BALOCHISTAN", "cases", "balochistan"],
        ["h6", "KPK", "cases", "kp"]
    ];

    for (var elem of elements){
        result[elem[2]][elem[3]] = getVal(cs, elem[0]+':contains("'+elem[1]+'")');
    }

    //handle AJK and GB separately
    var ajkgb = cs.find('h6:contains("AJK/GB")').prev().text().split("/");

    result["cases"]["ajk"] = parseInt(ajkgb[0].replace(/,/g, ''));
    result["cases"]["gb"] = parseInt(ajkgb[1].replace(/,/g, ''));

    var datestr = cs.find("#last-update").text();
    var arr = datestr.trim().match(/^(\d{1,2}) (\w+), (\d{4}) - (\d{1,2}):(\d{1,2})(\w+) (\w+)\/(\w+)$/);

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
            rp({uri:epidata_pk,gzip:true,json:true})
                .then((json_pk) => {
                    var date = new Date();
                    result["estimated"]["date"] = json["created"];
                    result["estimated"]["predicted-date"] = date;
                    var traceind = json_pk["models"]["date_index"].indexOf(date.toISOString().slice(0, 10))+1; //TODO this +1 is dodgy...
                    var traces = json_pk["models"]["traces"];
                    for (var i = 0; i<traces.length; i++){
                        if (traces[i]["group"]==group && traces[i]["key"]==key){
                            result["estimated"]["cases"] = Math.round(json["regions"]["PK"]["Population"]*traces[i]["active"][traceind]);
                            break;
                        }
                    }
                    var jsonresult = JSON.stringify(result);
                    console.log(jsonresult);
                    core.setOutput("jsondata", jsonresult); 
                });
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