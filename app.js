const gplay = require('google-play-scraper')
const async = require('async')
const readline = require('readline')
const ora = require('ora')
const stringArgv = require('string-argv')

const chars = ['a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z','1','2','3','4','5','6','7','8','9','10']
const spinner = ora('Please Wait...')
const rl = readline.createInterface(process.stdin, process.stdout)

showPrompt()

function showPrompt() {
    process.stdout.write('\033c')
    rl.setPrompt('pskeyword> ')
    rl.prompt()
    rl.on('line', line => {
        const args = stringArgv(line)
        switch (args[0]) {
            case 'find':
                spinner.start()
                getKeywords(args[1])
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

function getKeywords(keyword) {
    const keywordList = []
    const suggestFuncList = []
    suggestFuncList.push(async.apply(getSuggests, keyword))
    for(char of chars){
        var appendKeyword = keyword + ' ' + char
        suggestFuncList.push(async.apply(getSuggests, appendKeyword))
    }

    async.series(suggestFuncList, function(err, results) {
        var result = []
        for(item of results){
            result = result.concat(item)
        }
        result = result.filter(function(elem, index, self) {
            return index == self.indexOf(elem)
        })
        for(item of result) {
            keywordList.push(item)
        }
        spinner.stop()
        keywordList.forEach((keyword) => console.log(keyword))
        rl.prompt()
    })
}

function getSuggests(keyword, callback) {
    gplay.suggest({
        term: keyword
    }).then(function(response) {
        callback(null, response)
    })
}