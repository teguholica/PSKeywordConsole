const gplay = require('google-play-scraper')
const async = require('async')
const readline = require('readline')
const ora = require('ora')
const stringArgv = require('string-argv')
const Table = require('easy-table')
const ProxyLists = require('proxy-lists')
const globalTunnel = require('global-tunnel-ng')
const publicIp = require('public-ip')

const chars = ['a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z','1','2','3','4','5','6','7','8','9','10']
let currentProxy

showPrompt()

Array.prototype.flatMap = function(selector){ 
return this.reduce((prev, next) => 
    (selector(prev) || prev).concat(selector(next))) 
}

function showPrompt() {
    const spinner = ora('Please Wait...')
    const rl = readline.createInterface(process.stdin, process.stdout)
    process.stdout.write('\033c')
    rl.setPrompt('pskeyword> ')
    rl.prompt()
    rl.on('line', line => {
        const args = stringArgv(line)
        switch (args[0]) {
            case 'find':
                spinner.start()
                getKeywords(args[1]).then(keywordList => {
                    spinner.stop()
                    keywordList.forEach((keyword) => console.log(keyword))
                    spinner.stop()
                    rl.prompt()
                })
                break
            case 'density':
                spinner.start()
                getKeywords(args[1]).then((keywordList) => calculateDensity(keywordList)).then(keywordDensityList => {
                    const t = new Table
                    keywordDensityList.forEach(item => {
                        t.cell('Keyword', item.keyword)
                        t.cell('Count', item.count)
                        t.newRow()
                    })
                    spinner.stop()
                    console.log(t.toString())
                    rl.prompt()
                }).catch(() => {
                    spinner.stop()
                    console.log('Failed to get keyword')
                    rl.prompt()
                })
                break
            case 'check':
                spinner.start()
                checkApp(args[1]).then(app => {
                    spinner.stop()
                    console.log(`Title : ${app.title}`)
                    console.log(`Title in Summary : ${app.title_in_summary}`)
                    console.log(`Title in Desc : ${app.title_in_desc}`)
                    console.log('\n')

                    const t = new Table
                    app.density.forEach(item => {
                        t.cell('Keyword', item.keyword)
                        t.cell('Count', item.count)
                        t.newRow()
                    })
                    console.log(t.toString())

                    rl.prompt()
                })
                break;
            case 'proxy':
                if (args[1] === 'set') {
                    spinner.start()
                    getProxies(args[2]).then(proxy => {
                        currentProxy = proxy

                        // globalTunnel.end()
                        globalTunnel.initialize({
                            host: currentProxy.ipAddress,
                            port: currentProxy.port,
                            connect: 'both'
                        })

                        spinner.stop()
                        console.log(`Set proxy to : ${currentProxy.protocols} ${currentProxy.ipAddress}:${currentProxy.port}`)
                        rl.prompt()
                    }).catch(err => {
                        spinner.stop()
                        console.log('Set proxy failed')
                        rl.prompt()
                    })
                } else if (args[1] === 'get') {
                    if(currentProxy) {
                        console.log(`Proxy ${currentProxy.country} ${currentProxy.protocols} ${currentProxy.ipAddress}:${currentProxy.port}`)
                    } else {
                        console.log('No Proxy')
                    }
                    rl.prompt()
                } else if (args[1] === 'clear') {
                    globalTunnel.end()
                    currentProxy = null
                    rl.prompt()
                }
                break
            case 'clear':
                process.stdout.write('\033c')
                rl.prompt()
                break
            case 'exit':
                rl.close()
                break
        
            default:
                console.log('Command Not Found')
                rl.prompt()
                break
        }
    })
    .on('close',() => process.exit(0))
}

getProxies = (country) => new Promise((resolve, reject) => {
    const gettingProxies = ProxyLists.getProxies({
        countries: [country],
        protocols: ['http', 'https'],
        sourcesWhiteList: ['hidemyname', 'blackhatworld'],
        sourcesBlackList: null
    })
    let result = []
    gettingProxies.on('data', proxies => {
        result = result.concat(proxies)
    })
    gettingProxies.on('error', error => reject(error))
    gettingProxies.once('end', function() {
        resolve(result[Math.floor(Math.random()*result.length)])
    });
})

getKeywords = (keyword) => new Promise((resolve, reject) => {
    const suggestFuncList = chars.map(char => async.apply(getSuggests, keyword + ' ' + char))
    async.series(suggestFuncList, function(err, results) {
        if (!err) {
            const result = results
                .flatMap(item => item)
                .filter((elem, index, self) => index == self.indexOf(elem))
                resolve(result)
        } else {
            reject(err)
        }
    })
})

function getSuggests(keyword, callback) {
    gplay.suggest({
        term: keyword
    }).then(function(response) {
        callback(null, response)
    })
}

calculateDensity = (keywordList) => new Promise(resolve => {
    const wordList = {}
    keywordList.forEach(keyword => {
        const words = keyword.split(' ')
        words.forEach(word => {
            wordList[word] = wordList[word] ? ++wordList[word]: 1
        })
    })
    const keysSorted = Object.keys(wordList).sort((a,b) => {return wordList[b] - wordList[a]})

    resolve(keysSorted.map(key => {
        return {keyword: key, count: wordList[key]}
    }))
})

checkApp = (packageName) => new Promise(resolve => {
    gplay.app({appId: packageName})
        .then(response => {
            const titleArr = response.title.split(' ')
            const wordList = titleArr
                .filter((word, pos) => titleArr.indexOf(word) == pos)
                .map(word => {
                    const inTitle = (response.title.match(new RegExp(word, 'gi')) || []).length
                    const inSummary = (response.summary.match(new RegExp(word, 'gi')) || []).length
                    const inDesc = (response.description.match(new RegExp(word, 'gi')) || []).length
                    return {
                        keyword: word,
                        count: inTitle + inSummary + inDesc
                    }
                })
            
            resolve({
                title: response.title,
                title_in_summary: (response.summary.match(new RegExp(response.title, 'gi')) || []).length,
                title_in_desc: (response.description.match(new RegExp(response.title, 'gi')) || []).length,
                density: wordList
            })
        })
})