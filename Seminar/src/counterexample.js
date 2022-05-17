const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// ~/cbmc-git/jbmc/src/jbmc/jbmc ArithmeticExceptionTest --unwind 5 --cp ~/cbmc-git/jbmc/regression/jbmc/ArithmeticException1
// ~/cbmc-git/jbmc/src/jbmc/jbmc Main --unwind 5 --cp ~/sv-benchmarks/java/jbmc-regression/array1:~/sv-benchmarks/java/common/org/sosy_lab/sv_benchmarks
// ~/cbmc-git/jbmc/src/jbmc/jbmc Main --unwind 5 --cp ~/sv-benchmarks/java/jbmc-regression/array1
// node src/counterexample.js --unwind 5 --path ~/sv-benchmarks/java/jbmc-regression/array1/Main --trace

const jbmc = '/home/vaeb/cbmc-git/jbmc/src/jbmc/jbmc';

const esc = (str) => str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
const args = process.argv.slice(2);

const testDir = '/home/vaeb/sv-benchmarks/java/jbmc-regression';
const getSvcompFiles = () =>
    fs.readdirSync(testDir).map(folder => {
        const dir = `${testDir}/${folder}`;
        if (!fs.statSync(dir).isDirectory()) return;
        const dirFiles = fs.readdirSync(dir);
        // console.log(dir);
        const files = dirFiles.filter(elm => elm.match(/.*Main\.(java?)/ig)).map((file) => [dir, dir, file.replace('.java', '')]);
        return files;
    }).flat(1).filter(el => el != null);

const hasFlag = (flags, flag) => {
    flag = flag.toLowerCase();
    return flags.some(flagParts => flag === flagParts[0].toLowerCase());
};

let codeOnly = false;
let parseOnly = false;
let assumeFlags = [['--nondet-static'], ['--max-nondet-string-length', '5']];
let jbmcFlagsArr = [];
let svc = false;
let filesData;

const combineFlags = (...allFlags) => {
    const flagIndexes = {};
    const flags = [];
    for (const nowFlags of allFlags) {
        for (const flagParts of nowFlags) {
            const flagName = flagParts[0];
            if (flagIndexes[flagName]) {
                flags.splice(flagIndexes[flagName], 1);
            }
            flagIndexes[flagName] = flags.push(flagParts) - 1;
        }
    }
    return flags;
};

const flagsToStr = (flags) => flags.flat(1).join(' ');

const scriptFlags = {
    '--code-only': () => codeOnly = true,
    '--parse-only': () => parseOnly = true,
    '--path': (flag) => {
        const flagIdx = args.indexOf(flag);
        const cpFull = args[flagIdx + 1];
        if (cpFull === 'svc') {
            svc = true;
            filesData = getSvcompFiles();
        } else {
            let [srcPath, otherDirs] = cpFull.split(/(?<!:.*):/);
            const srcParts = srcPath.split(path.sep);
            const srcDir = srcParts.slice(0, -1).join(path.sep);
            const cpDir = otherDirs ? `${srcDir}:${otherDirs}` : srcDir;
            const srcDirReal = srcDir.replace(/\bbin\b/, 'src');
            const file = srcParts[srcParts.length - 1];
            filesData = [[cpDir, srcDirReal, file]];
        }
    },
    '<add-jbmc-flag>': (flag) => { // --unwind 5 --nondet-static --max-nondet-string-length 5 --trace
        const nextArg = args[args.indexOf(flag) + 1];
        if (nextArg && !nextArg.startsWith('-')) {
            jbmcFlagsArr.push([flag, nextArg]);
        } else {
            jbmcFlagsArr.push([flag]);
        }
    },
    '--raw': () => assumeFlags = [],
}

for (const flag of args) {
    let callback = scriptFlags[flag];
    if (callback) {
        callback(flag);
    } else if (flag.startsWith('-')) {
        callback = scriptFlags['<add-jbmc-flag>'];
        callback(flag);
    }
}

if (filesData === undefined) throw new Error('must include --path [path]');

jbmcFlagsArr = combineFlags(assumeFlags, jbmcFlagsArr);
const hasTrace = hasFlag(jbmcFlagsArr, '--trace');
const jbmcFlags = flagsToStr(jbmcFlagsArr);

console.log('JBMC Flags:', jbmcFlags);

const ceToJson = (str) => JSON.parse(
    str.replace(/{/g, '[')
    .replace(/}/g, ']')
    .replace(/'/g, '"'));

const parseByType = (varType, val) => {
    if (varType === 'String') return `"${val.join('')}"`;
};

/*

    * TODO:
    * 1. Figure out successful starting-point entry of .java files
    * 2. (?) Figure out if nondet methods can actually be used, and if so then how.
    * 3. Get the trace-checker properly working

*/

let stop = false;
let numF = 0;
let numS = 0;
let numO = 0;
let execPromises = [];
const doLog = false;
for (const [cpDir, srcDir, file] of filesData) {
    // if (stop) break;
    let sepDirs = cpDir !== srcDir;
    const fileLog = `${sepDirs ? 'cpDir' : 'cpDir/srcDir'}: ${cpDir}${sepDirs ? ` | srcDir: ${srcDir}` : ''} | file: ${file}`;

    // Look in java source for which varaibles have unknown values
    // Find in counterexample

    const src = fs.readFileSync(`${srcDir}/${file}.java`, { encoding: 'utf8' });
    let newSrc = src;

    const possibleVariablesRegex = /\b(\w+) (\w+) *= *[^\s=]/g;
    const possibleVariables = [];
    let result;
    while (result = possibleVariablesRegex.exec(src)) {
        possibleVariables.push({ varType: result[1], name: result[2] });
    }

    const jbmcFlagsNow = combineFlags([[file], ['--cp', cpDir]], jbmcFlagsArr);
    const jbmcFlagsFlat = jbmcFlagsNow.flat(1);

    const cmd = `${jbmc} ${file} --cp ${cpDir} ${jbmcFlags}`;

    execPromises.push(new Promise((resolve) => {
        const spawnCmd = spawn(jbmc, jbmcFlagsFlat); // spawn(jbmc, jbmcFlagsFlat);
        let trace = '';
        
        spawnCmd.stdout.setEncoding('utf8');
        spawnCmd.stdout.on('data', (data) => {
            trace = `${trace}${data.toString()}`;
        });

        spawnCmd.stderr.setEncoding('utf8');
        spawnCmd.stderr.on('data', (data) => {
            // console.log('ERROR:', data);
        });

        spawnCmd.on('close', (code) => {
            // console.log('Closing code:', code);

            if (stop && doLog) console.log(fileLog);

            const isVer1 = /VERIFICATION SUCCES/i.test(trace);
            const isVer2 = /VERIFICATION FAILED/i.test(trace);
            // console.log('VERIFICATION', isVer ? 'SUCCESSFUL' : 'FAILED');
            if (isVer1) numS++;
            if (isVer2) numF++;

            if (!isVer1 && !isVer2) {
                console.log(trace, cmd);
                numO++;
                console.log('Weird fail at:', fileLog);
            }
            // if (folder.includes('ArithmeticException5')) {
            //     console.log(folder, file, isVer);
            //     console.log(trace);
            // }

            if (hasTrace === false) return resolve(true);

            for (const variable of possibleVariables) {
                const { varType, name } = variable;
                if (!codeOnly && doLog) console.log(`---\n${name} (${varType})`)
                const variableSetRegex = new RegExp(`\\b(${esc(name)}=&)(\\w+)(?![\\s\\S]*\\b\\1)`);
                const prev1 = (trace.match(variableSetRegex) || [])[2];
                if (!codeOnly && doLog) console.log(prev1, variableSetRegex);
                if (!prev1) continue;
                const variableDataRegex = new RegExp(`\\b(${esc(prev1)}\\.data=)(\\w+)(?![\\s\\S]*\\b\\1)`);
                const prev2 = (trace.match(variableDataRegex) || [])[2];
                if (!codeOnly && doLog) console.log(prev2, variableDataRegex);
                if (!prev2) continue;
                const variableSetRegex2 = new RegExp(`\\b(${esc(prev2)}=)([^\\n\\(]+)(?![\\s\\S]*\\b\\1)`);
                const prev3 = (trace.match(variableSetRegex2) || [])[2].trim();
                if (!codeOnly && doLog) console.log(prev3, variableSetRegex2);

                if (!prev3 || parseOnly) continue;
                latestValue = prev3;

                newSrc = newSrc.replace(new RegExp(`\\b(${varType} +${name} *= *)(?![=])([^;]+)(.*?)$`, 'm'), (match, oldSetter, oldValue, after) => {
                    const newValue = parseByType(varType, ceToJson(latestValue));
                    if (oldValue === newValue) return match;
                    return `${oldSetter}${newValue}${after} // [JBMC-Changed] [Original-Value: ${oldValue}]`;
                })
            }

            if (!codeOnly && doLog) console.log('------');
            if (!parseOnly && doLog) {
                console.log(`------\nGenerated code:\n------`)
                console.log(newSrc);
            }

            return resolve(true);
        });
    }));
    
    if (stop) break;
}

Promise.all(execPromises).then(() => {
    const fileType = svc ? 'SV-COMP tests' : 'java files';
    console.log(`Number of ${fileType} ran:`, filesData.length);
    console.log(`Number of ${fileType} with a result of VERIFICATION FAILED: ${numF}`);
    console.log(`Number of ${fileType} with a result of VERIFICATION SUCCESSFUL: ${numS}`);
    console.log(`Number of ${fileType} on which verification failed: ${numO}`);
});