var observer;

const observerConfig = { attributes: false, childList: true, subtree: true };
const colorMap = {
    "plant": "rgb(108, 192, 0)",
    "reptile": "rgb(200, 138, 224)",
    "beast": "rgb(255, 184, 18)",
    "aquatic": "rgb(0, 184, 206)",
    "bird": "rgb(255, 139, 189)",
    "bug": "rgb(255, 83, 65)"
}
const classGeneMap = {
    "00000":"beast",
    "00001":"bug",
    "00010":"bird",
    "00011":"plant",
    "00100":"aquatic",
    "00101":"reptile",
    "10000":"mech",
    "10001":"dawn",
    "10010":"dusk"
};
const typeOrder = {"patternColor": 1, "eyes": 2, "mouth": 3, "ears": 4, "horn": 5, "back": 6, "tail": 7};
const geneColorMap = {
    "00000": {"000010": "ffec51", "000011": "ffa12a", "000100": "f0c66e", "000110": "60afce"},
    "00001": {"000010": "ff7183", "000011": "ff6d61", "000100": "f74e4e"},
    "00010": {"000010": "ff9ab8", "000011": "ffb4bb", "000100": "ff778e"},
    "00011": {"000010": "ccef5e", "000011": "efd636", "000100": "c5ffd9"},
    "00100": {"000010": "4cffdf", "000011": "2de8f2", "000100": "759edb", "000110": "ff5a71"},
    "00101": {"000010": "fdbcff", "000011": "ef93ff", "000100": "f5e1ff", "000110": "43e27d"},
    "10000": {"000010": "d0dada", "000011": "d4a69e", "000100": "93828a"},
    "10001": {"000010": "d7ccfe", "000011": "fefda0", "000100": "c0fcfe"},
    "10010": {"000010": "62c5c3", "000011": "389ec6", "000100": "1bc4c4"}
};
const PROBABILITIES = {d: 0.375, r1: 0.09375, r2: 0.03125};
const parts = ["eyes", "mouth" ,"ears", "horn", "back", "tail"];
const MAX_QUALITY = 6 * (PROBABILITIES.d + PROBABILITIES.r1 + PROBABILITIES.r2);
const MAX_RUN_RETRIES = 30;
const OPTIONS_MAP = {
    "class": "classes",
    "part": "parts",
    "bodyShape": "bodyShapes",
    "stage": "stages",
    "mystic": "numMystic",
    "excludeParts": "parts",
    "japan": "numJapan",
    "xmas": "numXmas",
    "shiny": "numShiny",
    "summer": "numSummer"
};
const SEARCH_PARAMS = ["class", "stage", "breedCount", "mystic", "pureness", "region", "title", "part", "bodyShape", "hp", "speed", "skill", "morale", "excludeParts", "purity", "japan", "xmas", "shiny", "summer", "ppBeast", "ppAquatic", "ppPlant", "ppBug", "ppBird", "ppReptile", "ppMech", "ppDawn", "ppDusk"];
var notReadyCount = 0;
var currentURL = window.location.href;
var axies = {};
var initObserver = true;

var debug = false;

function debugLog(msg, ...extra) {
    if (debug) {
        if (extra.length > 0)
            console.log(msg, extra);
        else
            console.log(msg);
    }
}

function loadComplete(mutationsList) {
    for (let i = 0; i < mutationsList.length; i++) {

        for (let j = 0; j < mutationsList[i].removedNodes.length; j++) {
            //if the spinning puff is removed then we are loaded
            if ("innerHTML" in mutationsList[i].removedNodes[j] && mutationsList[i].removedNodes[j].innerHTML.includes("puff-loading.png")) {
                debugLog("loadComplete true", mutationsList[i].removedNodes[j]);
                return true;
            }
        }

        for (let j = 0; j < mutationsList[i].addedNodes.length; j++) {
            if ("innerHTML" in mutationsList[i].addedNodes[j] && mutationsList[i].addedNodes[j].innerHTML.includes("<div class=\"AxieCard_") || (mutationsList[i].addedNodes[j].nodeName == "SPAN" && mutationsList[i].addedNodes[j].innerText.match(/\d+ Axies$/))) {
                debugLog("loadComplete true", mutationsList[i].addedNodes[j]);
                return true;
            }
        }
    }
    debugLog("loadComplete false");
    return false;
}

async function init() {
    debugLog("init");
    await getBodyParts();

    /*
    supported pages
    https://marketplace.axieinfinity.com/profile/inventory/axie(?page=N)
    https://marketplace.axieinfinity.com/profile/[ADDRESS]/axie(?page=N)
    https://marketplace.axieinfinity.com/axie
    https://marketplace.axieinfinity.com/axie/17469
    */

    let callback = function (mutationsList, observer) {
        debugLog("mutationsList", mutationsList);

        //ignore if not a supported page
        if (!window.location.href.match(/https:\/\/marketplace\.axieinfinity\.com\/profile\/(inventory|(0x|ronin:)\w+)\/axie/) && !window.location.href.startsWith("https://marketplace.axieinfinity.com/axie")) {
            debugLog("ignoring");
            return;
        }

        if (window.location.href == currentURL && !window.location.href.match(ID_PATTERN)) { //ignore details page
            //fix Order By drop down z-index
            if (mutationsList.length == 1 && mutationsList[0].target.children.length == 2) {
                var mutated = mutationsList[0];
                if (mutated.target.children[1].children[0].nodeName == "DIV" && mutated.target.children[1].children[0].textContent.search(/Highest Price|Not for sale/)) {
                    mutated.target.children[1].children[0].style["zIndex"] = 9998;
                }
                //what was this for?
                /*else if (mutated.target.children[1].className.includes("transition-opacity")) {
                    mutated.target.children[1].style["zIndex"] = 99998;
                }*/
            }

        }
        if (window.location.href != currentURL) {
            currentURL = window.location.href;
            debugLog('New URI detected.');
        }
        //Only call run() if we find certain conditions in the mutation list
        if (loadComplete(mutationsList)) {
            //if you browses quickly, run() won't clearInterval before the page is ready
            if (intID != -1) {
                clearInterval(intID);
            }
            intID = setInterval(run, 1000);
        }
    };
    observer = new MutationObserver(callback);
}

var bodyPartsMap = {};
async function getBodyParts() {
    //TODO: find the new way parts are listed
    let parts = await fetch(chrome.runtime.getURL('body-parts.json')).then(res => res.json());
    for (let i in parts) {
        bodyPartsMap[parts[i].partId] = parts[i];
    }
}

function getQualityAndPureness(traits, cls) {
    let quality = 0;
    let dPureness = 0;
    for (let i in parts) {
        if (traits[parts[i]].d.class == cls) {
            quality += PROBABILITIES.d;
            dPureness++;
        }
        if (traits[parts[i]].r1.class == cls) {
            quality += PROBABILITIES.r1;
        }
        if (traits[parts[i]].r2.class == cls) {
            quality += PROBABILITIES.r2;
        }
    }
    return {quality: quality / MAX_QUALITY, pureness: dPureness};
}

function genesToBin(genes) {
    var genesString = genes.toString(2);
    genesString = "0".repeat(512 - genesString.length) + genesString
    return genesString;
}

const regionGeneMap = {
    "0000": "global",
    "0001": "mystic",
    "0011": "japan",
    "0101": "xmas",
    "0110": "summer",
    "0111": "strawberrySummer",
    "1000": "vanillaSummer",
    "1001": "shiny",
    "1010": "strawberryShiny",
    "1011": "vanillaShiny"
};
function getRegionFromGroup(group) {
    let regionBin = group.substring(21, 25);
    if (regionBin in regionGeneMap) {
        return regionGeneMap[regionBin];
    }
    return "Unknown Region";
}

function getClassFromGroup(group) {
    let bin = group.substring(0, 5);
    if (!(bin in classGeneMap)) {
        return "Unknown Class";
    }
    return classGeneMap[bin];
}

function getPatternsFromGroup(group) {
    return {d: group.substring(65, 74), r1: group.substring(74, 83), r2: group.substring(83, 92)};
}

function getColor(bin, cls) {
    let color;
    if (bin == "000000") {
        color = "ffffff";
    } else if (bin == "000001") {
        color = "7a6767";
    } else {
        color = geneColorMap[cls][bin];
    }
    return color;
}

function getColorsFromGroup(group, cls) {
    return {
        d: getColor(group.substring(92, 98), cls),
        r1: getColor(group.substring(98, 104), cls),
        r2: getColor(group.substring(104, 110), cls)
    };
}

function getPartName(cls, part, region, binary) {
    let trait;
    if (binary in binarytraits[cls][part]) {
        if (region in binarytraits[cls][part][binary]) {
            trait = binarytraits[cls][part][binary][region]
        } else if ("global" in binarytraits[cls][part][binary]) {
            trait = binarytraits[cls][part][binary]["global"]
        } else {
            trait = "UNKNOWN Regional " + cls + " " + part;
        }
    } else {
        trait = "UNKNOWN " + cls + " " + part;
    }
    return trait;
}

function getPartsFromGroup(part, group) {
    let region = getRegionFromGroup(group);
    let mystic
    if (region == "mystic") {
        mystic = true
    }
    let dClass = classGeneMap[group.substring(25, 30)];
    let dBin = group.substring(30, 38);
    let dName = getPartName(dClass, part, region, dBin);

    let r1Class = classGeneMap[group.substring(38, 43)];
    let r1Bin = group.substring(43, 51);
    let r1Name = getPartName(r1Class, part, "global", r1Bin);

    let r2Class = classGeneMap[group.substring(51, 56)];
    let r2Bin = group.substring(56, 64);
    let r2Name = getPartName(r2Class, part, "global", r2Bin);

    return {
        d: getPartFromName(part, dName),
        r1: getPartFromName(part, r1Name),
        r2: getPartFromName(part, r2Name),
        mystic: mystic
    };
}

function getTraits(genes) {
    var groups = [
        genes.substring(0, 128),
        genes.substring(128, 192),
        genes.substring(192, 256),
        genes.substring(256, 320),
        genes.substring(320, 384),
        genes.substring(384, 448),
        genes.substring(448, 512),
    ];
    let cls = getClassFromGroup(groups[0]);
    let pattern = getPatternsFromGroup(groups[0]);
    let color = getColorsFromGroup(groups[0], groups[0].substring(0, 5));
    let eyes = getPartsFromGroup("eyes", groups[1]);
    let mouth = getPartsFromGroup("mouth", groups[2]);
    let ears = getPartsFromGroup("ears", groups[3]);
    let horn = getPartsFromGroup("horn", groups[4]);
    let back = getPartsFromGroup("back", groups[5]);
    let tail = getPartsFromGroup("tail", groups[6]);

    return {
        cls: cls,
        pattern: pattern,
        color: color,
        eyes: eyes,
        mouth: mouth,
        ears: ears,
        horn: horn,
        back: back,
        tail: tail
    };
}

function getPartFromName(traitType, partName) {
    let traitId = traitType.toLowerCase() + "-" + partName.toLowerCase().replace(/\s/g, "-").replace(/[\?'\.]/g, "");
    return bodyPartsMap[traitId];
}

function checkStatus(res) {
    if (res.ok) {
        return res;
    } else {
        throw "Failed to get axie details: " + res;
    }
}

const ID_PATTERN = /\/axie\/(\d+)/;
function getAxieIdFromURL(url) {
    let m = url.match(ID_PATTERN);
    if (m) {
        return parseInt(m[1]);
    }
    return -1;
}

//Assume we are on https://marketplace.axieinfinity.com/profile/inventory/axie
async function getAccountFromProfile() {
    let axieAnchors = document.querySelectorAll("a[href^='/axie/']");
    if (axieAnchors.length > 0) {
        for (let i = 0; i < axieAnchors.length; i++) {
            let anc = axieAnchors[i];
            let axieId = getAxieIdFromURL(anc.href);
            if (axieId == -1) continue;
            let axie = await getAxieInfoMarket(axieId);
            //this will return the 0x formatted ronin address
            return axie.owner;
        }
    }
    return null;
}

function getAccount() {
    //https://marketplace.axieinfinity.com/profile/0x.../axie
    //https://marketplace.axieinfinity.com/profile/ronin:.../axie
    let checkIndex = "https://marketplace.axieinfinity.com/profile/".length;
    let start = window.location.href.substring("https://marketplace.axieinfinity.com/profile/".length);
    let account = start.substring(0, start.indexOf("/"));
    if (account.startsWith("ronin:")) {
        account = account.replace("ronin:", "0x");
    } else {
        //0xaddress. TODO: get ronin address from eth addr
    }
    //TODO: validate address
    if (account !== "") {
        return account;
    }
    return null;
}

function getQueryParameters(name) {
    let query = window.location.search.substring(1);
    let vars = query.split("&");
    let result = [];
    for (var i = 0; i < vars.length; i++) {
        let pair = vars[i].split("=");
        if (pair[0] == name) {
            result.push(pair[1]);
        }
    }
    return result;
}

function getAxieInfoMarket(id) {
    debugLog("getAxieInfoMarket", id);
    return new Promise((resolve, reject) => {
        if (id in axies) {
            resolve(axies[id]);
        } else {
            axies[id] = {}; //kind of mutex
            chrome.runtime.sendMessage({contentScriptQuery: "getAxieInfoMarket", axieId: id}, function (result) {
                axies[id] = result;
                if (result.stage > 2) {
                    axies[id].genes = genesToBin(BigInt(axies[id].newGenes));
                    let traits = getTraits(axies[id].genes);
                    let qp = getQualityAndPureness(traits, axies[id].class.toLowerCase());
                    axies[id].traits = traits;
                    axies[id].quality = qp.quality;
                    axies[id].pureness = qp.pureness;
                }
                resolve(result);
            });
        }
    });
}

async function getAxieBriefList() {
    debugLog("getAxieBriefList");
    let sort = "PriceAsc";
    let auctionType = "Sale";
    let address = null; //if marketplace page. default
    //if self profile page
    if (window.location.href.startsWith("https://marketplace.axieinfinity.com/profile/inventory/axie")) {
        address = await getAccountFromProfile();
        sort = "IdDesc";
        auctionType = "All";
    } else if (window.location.href.startsWith("https://marketplace.axieinfinity.com/profile/ronin:")) { // || window.location.href.startsWith("https://marketplace.axieinfinity.com/profile/0x")) {
        address = getAccount();
        sort = "IdDesc";
        auctionType = "All";
    }
    debugLog("Account: " + address);
    let page = 1;
    let p = getQueryParameters("page");
    if (p.length > 0) {
        page = parseInt(p[0]);  //assume only 1 page
    }

    let s = getQueryParameters("sort");
    if (s.length > 0) {
        sort = s[0];
    }
    let a = getQueryParameters("auctionType");
    if (a.length > 0) {
        auctionType = a[0];
    }

    excludedParts = [];
    let criteria = {
        "region": null,
        "parts": null,
        "bodyShapes": null,
        "classes": null,
        "stages": null,
        "numMystic": null,
        "pureness": null,
        "purity": null,
        "title": null,
        "breedCount": null,
        "hp": [],
        "skill": [],
        "speed": [],
        "morale": []
    }; //"breedable":null,
    for (let sIdx = 0; sIdx < SEARCH_PARAMS.length; sIdx++) {
        let option = SEARCH_PARAMS[sIdx];
        let opts = getQueryParameters(option);
        if (opts.length > 0) {
            if ("region" == option) {
                criteria.region = opts[0];
                continue;
            }
            let opt = [];
            if (["stage", "breedCount", "mystic", "pureness", "hp", "speed", "skill", "morale", "purity", "japan", "xmas", "shiny", "summer", "ppBeast", "ppAquatic", "ppPlant", "ppBug", "ppBird", "ppReptile", "ppMech", "ppDawn", "ppDusk"].indexOf(option) != -1) {
                for (let i = 0; i < opts.length; i++) {
                    opt.push(parseInt(opts[i]));
                }
                opt.sort((a, b) => a - b);
            } else {
                for (let i = 0; i < opts.length; i++) {
                    if ("title" == option) {
                        opt.push(opts[i].replace(/-/g, " "));
                    } else {
                        if (option == "excludeParts") {
                            opt.push("!" + opts[i]);
                            excludedParts.push(opts[i]);
                        } else {
                            opt.push(opts[i]);
                        }
                    }
                }
            }
            if (option in OPTIONS_MAP) {
                if (["part", "excludeParts"].includes(option)) {
                    if (criteria[OPTIONS_MAP[option]]) {
                        combined = [...criteria[OPTIONS_MAP[option]], ...opt];
                        for (let i = 0; i < excludedParts.length; i++) {
                            combined = combined.filter(e => e !== excludedParts[i]);
                        }
                        criteria[OPTIONS_MAP[option]] = combined;
                    } else {
                        criteria[OPTIONS_MAP[option]] = opt;
                    }
                } else {
                    criteria[OPTIONS_MAP[option]] = opt;
                }
            } else {
                criteria[option] = opt;
            }
        }
    }

    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
            contentScriptQuery: "getAxieBriefList",
            address: address,
            page: page,
            sort: sort,
            auctionType: auctionType,
            criteria: criteria
        }, function (results) {
            for (let i = 0; i < results.length; i++) {
                let axie = results[i];
                let id = axie.id;
                debugLog("got axie " + id);
                axies[id] = axie;
                if (axie.stage > 2) {
                    axies[id].genes = genesToBin(BigInt(axies[id].newGenes));
                    let traits = getTraits(axies[id].genes);
                    let qp = getQualityAndPureness(traits, axies[id].class.toLowerCase());
                    axies[id].traits = traits;
                    axies[id].quality = qp.quality;
                    axies[id].pureness = qp.pureness;
                }
            }
            resolve(results);
        });
    });
}

function appendTrait(table, trait) {
    let row = document.createElement("tr");
    let mystic = trait["mystic"];
    for (let position in trait) {
        if (position == "mystic") continue;
        let data = document.createElement("td");
        let span = document.createElement("span");
        if (trait[position].hasOwnProperty("class")) {
            span.style.color = colorMap[trait[position].class];
        }
        span.textContent = trait[position].name;
        if (position == "d" && mystic) {
            span.textContent += "*";
        }
        data.style["padding-right"] = "5px";
        data.appendChild(span);
        row.appendChild(data);
    }
    table.appendChild(row);

}

function genGenesDiv(axie, mouseOverNode, type="list") {
    let traits = document.createElement("div");
    let table = document.createElement("table");
    appendTrait(table, {d: {name: "D"}, r1: {name: "R1"}, r2: {name: "R2"}});
    appendTrait(table, axie.traits.eyes);
    appendTrait(table, axie.traits.ears);
    appendTrait(table, axie.traits.mouth);
    appendTrait(table, axie.traits.horn);
    appendTrait(table, axie.traits.back);
    appendTrait(table, axie.traits.tail);
    traits.appendChild(table);
    traits.style.display = "none";
    traits.style.position = "absolute";
    traits.style["z-index"] = "9999";
    traits.style.border = "grey";
    traits.style["border-style"] = "solid";
    traits.style["border-width"] = "1px";
    traits.style["border-radius"] = "20px";
    traits.style["white-space"] = "nowrap";
    traits.style["padding-left"] = "10px"
    traits.style["padding-top"] = "10px";
    traits.style["padding-bottom"] = "10px";
    traits.style["padding-right"] = "10px";

    if (currentURL.startsWith("https://marketplace.axieinfinity.com/")) {
        traits.style.background = "var(--color-gray-5)";
        traits.style.top = "-85px";
        if (type == "list") {
            if (axie.stage == 3) {
                traits.style.top = "-85px";
            }
            traits.style.left = "0px";
            mouseOverNode.addEventListener("mouseover", function() {
                traits.style.display = "block";
                traits.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.style.zIndex = 9999;
            });
            mouseOverNode.addEventListener("mouseout", function() {
                traits.style.display = "none";
                traits.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.style.zIndex = '';
            });
        } else if (type == "details") {
            traits.style.left = "auto";
            traits.style.top = "auto";
            traits.style.position = "relative";
            mouseOverNode.addEventListener("mouseover", function() {
                traits.style.display = "block";
            });
            mouseOverNode.addEventListener("mouseout", function() {
                traits.style.display = "none";
            });
        }
    } else {
        traits.style.background = "white";
        //traits.style.background = window.getComputedStyle(document.getRootNode().body, null).getPropertyValue("background-color");
        traits.style.top = "-90px";
        if (type == "list") {
            if (axie.stage == 3) {
                traits.style.top = "-90px";
            }
            traits.style.left = "-18px";
        } else if (type == "details") {
            traits.style.left = "0px";
        }
    }
    return traits;
}

function insertAfter(newNode, referenceNode) {
    referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
}

async function run() {
    debugLog("run");
    let dbg;
    try {
        let axieAnchors = document.querySelectorAll("a[href^='/axie/']");
debugLog(axieAnchors);
        if (axieAnchors.length > 0 && observer != null) {
            clearInterval(intID);
            intID = -1;
            notReadyCount = 0;
debugLog("run ready");
        } else {
            notReadyCount++;
debugLog("not ready");
            if (notReadyCount > MAX_RUN_RETRIES) {
                clearInterval(intID);
                console.log("Page took too long to load. Bailing");
            }
            return;
        }
debugLog(window.location.href);
        if (initObserver) {
            let targetNode = document.body;

            observer.observe(targetNode, observerConfig);
            initObserver = false;

/*
TODO: add support for breeding window
            if (window.location.href.includes("/axie/")) {
                let breedButton = document.evaluate("//span[text()='Breed' or text()='繁殖']", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                //if (breedButton && getComputedStyle(breedButton.parentNode.parentNode).backgroundColor != "rgb(203, 203, 203)") {
                if (breedButton) {
    //debugLog("observing breed button ", getComputedStyle(breedButton.parentNode.parentNode).backgroundColor, breedButton);
                    //find the X button in the breeder window
                    let xpath = "//svg:path[@d='M2 12L12 2M12 12L2 2']";
                    let pathNode = document.evaluate(xpath, document, function(prefix) { if (prefix === 'svg') { return 'http://www.w3.org/2000/svg'; }}, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                    let breedTarget = pathNode.parentNode.parentNode.parentNode.parentNode;
                    observer.observe(breedTarget, observerConfig);
                } else {
    //debugLog("ignoring breed");
                }
            }
*/
        }

        //single axie (axieDetail page). Added mouseover handler to Body parts text
        if (currentURL.match(/https:\/\/marketplace\.axieinfinity\.com\/axie\/\d+/)) {
            let axieId = getAxieIdFromURL(currentURL);
            if (axieId == -1) throw "Bad Axie ID";
            let axie;
            axie = await getAxieInfoMarket(axieId);

            if (axie.stage > 2) {
                let xpath = "(//svg:svg[@viewBox='681 3039 12 11'])[2]";
                let pathNode;
                let detailsNode;
                //this will break when localization is implemented on the site
                xpath = "//div[text()='Body parts']";
                pathNode = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                detailsNode = pathNode;
                let traits = genGenesDiv(axie, detailsNode, "details");
                if (detailsNode.childElementCount == 0 && currentURL.startsWith("https://marketplace.axieinfinity.com/axie/")) {
                    detailsNode.appendChild(traits);
                } else if (!currentURL.startsWith("https://marketplace.axieinfinity.com/axie/")) {
                    detailsNode.appendChild(traits);
                }
            }
        }
        // else {


        //Poll getAxieBriefList if we are on a profile listing page or market listing page, but not axieDetails or ListView
        if ( (currentURL.match(/https:\/\/marketplace\.axieinfinity\.com\/(profile|axie)/) && !currentURL.match(/\/axie\/\d+/))
                 && currentURL.lastIndexOf("view=ListView") == -1) {

            let pageAxies = [];
            for (let i = 0; i < axieAnchors.length; i++) {
                let anc = axieAnchors[i];
                let div = anc.firstElementChild;
                let axieId = getAxieIdFromURL(anc.href);
                if (axieId == -1) continue;

                if (!(axieId in axies)) {
                    //get all axies on the page and break
debugLog("getting axies");
                    var results = await getAxieBriefList();
debugLog(axies);
                    break;
                }
            }
        }

        //limit to listing pages and details page, but not in ListView
        if ( (currentURL.startsWith("https://marketplace.axieinfinity.com/profile/") || currentURL.startsWith("https://marketplace.axieinfinity.com/axie"))
                 && currentURL.lastIndexOf("view=ListView") == -1) {

            for (let i = 0; i < axieAnchors.length; i++) {
                let anc = axieAnchors[i];
                let div = anc.firstElementChild;
                let axieId = getAxieIdFromURL(anc.href);
                if (axieId == -1) continue;
                let axie;
                if (!(axieId in axies)) {
                    axie = await getAxieInfoMarket(axieId);
                } else {
                    axie = axies[axieId];
                }
                let card = anc.firstElementChild.firstElementChild.firstElementChild;
                if (axie.stage > 2) {
                    if (options[SHOW_BREEDS_STATS_OPTION]) {
                        dbg = anc;
                        if (!card.children || (card.children && card.children.length < 2)) {
                            //igoring showing stats on children for now
                            continue;
                        }
                        let content = card.children[2];
                        let statsDiv = document.createElement("div");
                        let stats = "H: " + axie.stats.hp + ", S: " + axie.stats.speed + ", M: " + axie.stats.morale + ", P: " + Math.round(axie.quality * 100) + "%";
                        content.className = card.children[2].className;
                        if (axie.stage == 3) {
                            statsDiv.textContent = stats;
                            content.className = content.className.replace("invisible", "visible");
                        } else if (axie.stage > 3) {
                            content.childNodes.forEach(n => {
                                if (n.nodeType == Node.TEXT_NODE) {
                                    n.textContent = "";
                                    //n.remove() doesn't work. probably because removing during iteration is not supported.
                                }
                            });
                            statsDiv.textContent = "🐣: " + axie.breedCount + ", " + stats;
                        }
                        //prevent dupes
                        if ((content.childElementCount == 0)) {
                            let traits = genGenesDiv(axie, statsDiv);
                            content.appendChild(statsDiv);
                            content.appendChild(traits);
                            //remove part's box margin to prevent overlap with price
                            content.style["margin-top"] = "0px";
                            card.style["position"] = "relative";    //will this mess shit up?
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.log("ERROR: " + e);
        console.log(e.stack);
        console.log(dbg);
        throw(e);
    } finally {
        rescanning = false;
    }
}

var intID;
var options = {};
//currently, the extension will keep running if the page was previously loaded while enabled...need to reload page to disable inflight extension.
getOptions((response) => {
    options[ENABLE_OPTION] = response[ENABLE_OPTION];
    options[SHOW_BREEDS_STATS_OPTION] = response[SHOW_BREEDS_STATS_OPTION];
    if (options[ENABLE_OPTION]) {
        init();
        intID = setInterval(run, 1000);
    }
});
