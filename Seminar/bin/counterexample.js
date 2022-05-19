const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');

// ~/cbmc-git/jbmc/src/jbmc/jbmc ArithmeticExceptionTest --unwind 5 --cp ~/cbmc-git/jbmc/regression/jbmc/ArithmeticException1
// ~/cbmc-git/jbmc/src/jbmc/jbmc Main --unwind 5 --cp ~/sv-benchmarks/java/jbmc-regression/array1:~/sv-benchmarks/java/common/org/sosy_lab/sv_benchmarks
// ~/cbmc-git/jbmc/src/jbmc/jbmc Main --unwind 5 --cp ~/sv-benchmarks/java/jbmc-regression/array1
// node src/counterexample.js --unwind 5 --path src/Simple
// ~/cbmc-git/jbmc/src/jbmc/jbmc Main --unwind 5 --cp ~/sv-benchmarks/java/jbmc-regression/synchronized
// ~/cbmc-git/jbmc/src/jbmc/jbmc Simple --nondet-static --max-nondet-string-length 5 --unwind 5 --cp ./bin --trace

// javac /home/vaeb/sv-benchmarks/java/jbmc-regression/ArrayIndexOutOfBoundsException1/Main.java /home/vaeb/sv-benchmarks/java/common/org/sosy_lab/sv_benchmarks/Verifier.java -g
// java -cp /home/vaeb/sv-benchmarks/java/jbmc-regression/ArrayIndexOutOfBoundsException1:/home/vaeb/sv-benchmarks/java/common/ Main

const jbmc = '/home/vaeb/cbmc-git/jbmc/src/jbmc/jbmc';

const esc = (str) => str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
const args = process.argv.slice(2);

const testDir = '/home/vaeb/sv-benchmarks/java/jbmc-regression';
const verifierPath = '/home/vaeb/sv-benchmarks/java/common/org/sosy_lab/sv_benchmarks/Verifier.java';
const genDir = './gen';

const getSvcompFiles = () =>
    fs.readdirSync(testDir).map(folder => {
        const dir = `${testDir}/${folder}`;
        if (!fs.statSync(dir).isDirectory()) return;
        const dirFiles = fs.readdirSync(dir);
        // console.log(dir);
        const files = dirFiles.filter(elm => elm.match(/.*Main\.(java?)/ig)).map((file) => [dir, dir, file.replace('.java', ''), folder]);
        return files;
    }).flat(1).filter(el => el != null);

let numPass = 0;
let numFail = 0;
let shouldPass = {};

const getSvcompExpected = () => {
    fs.readdirSync(testDir).forEach(file => {
        if (!/.yml$/.test(file)) return undefined;
        const path = `${testDir}/${file}`;
        const resultRaw = fs.readFileSync(path, { encoding: 'utf8' });
        const testName = file.replace('.yml', '');
        const saysPass = /\bexpected_verdict: true/i.test(resultRaw);
        const saysFail = /\bexpected_verdict: false/i.test(resultRaw);
        if (saysPass == saysFail) {
            console.log(`Weird pass/fail result (${saysPass}):`, testName);
        }
        if (saysPass) numPass++;
        if (saysFail) numFail++;
        shouldPass[testName] = saysPass;
    });
    console.log('Expected pass rate:', numPass, numFail);
}

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

let doLog = 2;

const scriptFlags = {
    '--code-only': () => codeOnly = true,
    '--parse-only': () => parseOnly = true,
    '--log': (flag) => doLog = Number(args[args.indexOf(flag) + 1]),
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
            filesData = [[cpDir, srcDirReal, file, file]];
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

if (!parseOnly && assumeFlags.length) assumeFlags.push(['--trace']);
jbmcFlagsArr = combineFlags(assumeFlags, jbmcFlagsArr);
const hasTrace = hasFlag(jbmcFlagsArr, '--trace');
const jbmcFlags = flagsToStr(jbmcFlagsArr);

console.log('JBMC Flags:', jbmcFlags);

if (svc) getSvcompExpected();

/*

    * TODO:
    * 1. Figure out successful starting-point entry of .java files
    * 2. (?) Figure out if nondet methods can actually be used, and if so then how.
    * 3. Get the trace-checker properly working

*/

let stop = false;
let stop2 = false;
let numF = 0;
let numS = 0;
let numO = 0;
let execPromises = [];
for (const [cpDir, srcDir, file, moniker] of filesData) {
    // if (stop) break;
    // console.log('Trying:', moniker);
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
        possibleVariables.push({ varType: result[1], varName: result[2] });
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

            if (stop2) return;
            if (stop && doLog) console.log(fileLog);

            const didPass = /VERIFICATION SUCCES/i.test(trace);
            const didFail = /VERIFICATION FAILED/i.test(trace);
            // console.log('VERIFICATION', isVer ? 'SUCCESSFUL' : 'FAILED');
            if (didPass) numS++;
            if (didFail) numF++;

            if (didPass == didFail) {
                console.log(trace, cmd);
                numO++;
                console.log('Weird fail at:', fileLog);
            }

            const testName = srcDir.match(/(\w+)\/?$/)[1];
            const shouldPassNow = shouldPass[testName];

            if (svc) {
                if (shouldPassNow === undefined) {
                    console.log('MISSING TEST:', testName);
                } else {
                    if (shouldPassNow != didPass) { // Only has false-fails
                        console.log('Wrong test result:', testName, didPass);
                        // stop = true;
                        // stop2 = true;
                    } else {
                        console.log('Correct test result:', testName);
                    }
                }
            }

            // if (folder.includes('ArithmeticException5')) {
            //     console.log(folder, file, isVer);
            //     console.log(trace);
            // }

            if (hasTrace === false) return resolve(true);

            /*

                Priority:
                    1) .data=
                    2) = OR =&

                If higher priority: exclude lower priority results from same-level in tree

                For every variable:
                    Collect its tree of values at every state
                    E.g.
                        0
                                5 <------ CORRECT
                            elderInt
                        oldInt
                        7
                            5
                        newerInt
                    someInt
                            ___
                        empty_str
                                5, 6, 7 <------ CORRECT
                            olderDyStr
                        dynamicStr
                    someStr

            */

            const regexLookup = { // (?![\s\S]*\b\1)
                setData: { reg: /\b(_name_\.data=)(\w+)/.source, lookup: true, priority: 3 },
                equalsWithComment: { reg: /\b(_name_=)[^\n\(]+ \/\* (.*?) \*\/ /.source, lookup: false, priority: 2 },
                equals: { reg: /\b(_name_)=(?!&|\1\b)([^\n\(]+)/.source, lookup: false, priority: 1 }, // May need to be global?
                equalsPointer: { reg: /\b(_name_=&)([^\n\(]+)/.source, lookup: true, priority: 1 },
                // /\b(_name_=&)(\w+)/.source,
            };

            const regexKeys = Object.keys(regexLookup);
            const valueStack = [];
            const posToValue = {};

            for (const variable of possibleVariables) {
                const { varType, varName } = variable;
                const varNameMatch = trace.match(new RegExp(/\b_name_=/.source.replace('_name_', esc(varName))));
                if (!varNameMatch) continue;

                const varStack = [varName, varNameMatch ? varNameMatch.index : -1];
                valueStack.push(varStack);
                lookupVariables = [[varStack, varName]];
                if (doLog >= 5) console.log(`\n---\nSEARCHING FOR: ${varName} (${varType})`);
                while (lookupVariables.length) {
                    const [nowStack, name] = lookupVariables.shift();
                    if (doLog >= 5) console.log('Checking:', name);
                    let futureStacks = [];
                    let childrenObj = {};
                    let currentPrio = 1;

                    for (const regexKey of regexKeys) {
                        const { reg: regexStr, lookup, priority } = regexLookup[regexKey];
                        if (priority < currentPrio) continue;
                        const regex = new RegExp(regexStr.replace('_name_', esc(name)), 'g');

                        let result;
                        while ((result = regex.exec(trace)) !== null) {
                            if (priority > currentPrio) {
                                futureStacks = [];
                                childrenObj = {};
                                if (doLog >= 5) console.log('reset for prio', priority);
                            }
                            currentPrio = priority;
                            const newValue = result[2].trim();
                            // if (newValue === 'null') continue;
                            const newIndex = result.index;
                            posToValue[newIndex] = newValue;
                            if (childrenObj[newIndex]) {
                                console.log('FOUND REGEX CONFLICT:');
                                console.log('CURR:', childrenObj[newIndex]);
                                console.log('NEW:', newValue);
                            }
                            // console.log(name, newValue);
                            if (lookup) {
                                const child = [newValue, newIndex];
                                // console.log(444, child);
                                childrenObj[newIndex] = child;
                                futureStacks.push([child, newValue]);
                            } else {
                                childrenObj[newIndex] = newValue;
                            }
                        }
                    }

                    lookupVariables.push(...futureStacks);
                    nowStack.push(...Object.values(childrenObj)); // You have to push the found arrays onto parentStack in the block, and include the _name on them
                    // console.log(999, childrenObj, Object.values(childrenObj));
                    // console.log(9999, valueStack);
                }

                const deepDelve = (arr) => {
                    if (!Array.isArray(arr)) return arr;
                    return deepDelve(arr[2]);
                }

                const pickValueByType = (varType, varStack) => {
                    let value;
                    if (varType === 'int') {
                        value = varStack[3];
                    } else if (varType === 'float') {
                        value = varStack[2];
                    } else if (varType === 'double') {
                        value = varStack[2];
                    } else if (varType === 'String') {
                        if (Array.isArray(varStack[3]) && Array.isArray(varStack[3][2]) && varStack[3][2][0] === 'null') { // is non_det
                            value = varStack[3][3];
                        } else {
                            value = varStack[3];
                        } 
                    }
                    return deepDelve(value);
                }

                const formatValueByType = (varType, rawValue) => {
                    if (rawValue == 'null') return 'null';
                    if (varType === 'String') {
                        const value = JSON.parse(
                            rawValue.replace(/{/g, '[')
                                .replace(/}/g, ']')
                                .replace(/'/g, '"')
                        );
                        return `"${value.join('')}"`;
                    }
                    if (varType === 'float') return `${rawValue}f`;
                    if (varType === 'double') return `${rawValue}d`;
                    return rawValue;
                }

                // console.log(varStack);
                // console.log('pick', pickValueByType(varType, varStack));

                // console.log(newSrc);
                newSrc = newSrc.replace(new RegExp(`\\b(${varType} +${varName} *= *)(?![=])([^;]+)(.*?)$`, 'm'), (match, oldSetter, oldValue, after) => {
                    const rawValue = pickValueByType(varType, varStack);
                    const value = formatValueByType(varType, rawValue);

                    if (oldValue == value) return match;
                    return `${oldSetter}${value}${after} // [JBMC Changed] [Original: ${oldValue}]`;
                })
            }

            if (doLog >= 3) {
                console.log('valueStack:');
                console.dir(valueStack, { depth: null });
            }

            if (!codeOnly && doLog) console.log('------');
            if (!parseOnly && doLog) {
                console.log(`------\nGenerated code:\n------`)
                console.log(newSrc);
            }

            const genFileDir = `${genDir}${moniker !== file ? `/${moniker}` : ''}`;
            const genFilePath = `${genFileDir}/${file}.java`;
            fs.mkdir(genFileDir, () => {
                fs.writeFile(genFilePath, newSrc, (err) => {
                    if (err) return console.log('FILE WRITE ERROR:', err);
                    console.log('Wrote file');
                    exec(`javac ${genFilePath} ${verifierPath} -g`, (compErr, compOut, compStdErr) => {
                        if (compErr) return console.log('JAVAC COMPILE ERROR:', javacErr);
                        console.log('Compiled java class');
                        exec(`java -cp ${genDir} -ea ${file}`, (javaErr, javaOut, javaStdErr) => {
                            const genAssertsPass = !/\bjava\.lang\.AssertionError\b/.test(String(javaStdErr));
                            console.log(moniker, genAssertsPass, didPass, shouldPassNow);
                            resolve(true);
                        });
                    });
                });
            });
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