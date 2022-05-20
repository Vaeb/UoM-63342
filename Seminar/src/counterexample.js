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
    // console.log('Expected pass rate:', numPass, numFail);
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
let stopAfter = Infinity;

const scriptFlags = {
    '--code-only': () => codeOnly = true,
    '--parse-only': () => parseOnly = true,
    '--log': (flag) => doLog = Number(args[args.indexOf(flag) + 1]),
    '--stop': (flag) => stopAfter = Number(args[args.indexOf(flag) + 1]),
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

let stop2 = false;
let numS = 0;
let numF = 0;
let numO = 0;
let numGenS = 0;
let numGenF = 0;
let numGenMatches = 0;
let numGenDiff = 0;
let execPromises = [];
let fileNum = 0;
const times = [];
const startF1 = +new Date();
for (const [cpDir, srcDir, file, moniker] of filesData) {
    const start1 = +new Date();
    const nowTimes = [];
    fileNum++;
    const stop = fileNum >= stopAfter;
    // if (stop) break;
    // console.log('Trying:', moniker);
    let sepDirs = cpDir !== srcDir;
    const fileLog = `${sepDirs ? 'cpDir' : 'cpDir/srcDir'}: ${cpDir}${sepDirs ? ` | srcDir: ${srcDir}` : ''} | file: ${file}`;

    // Look in java source for which varaibles have unknown values
    // Find in counterexample

    const src = fs.readFileSync(`${srcDir}/${file}.java`, { encoding: 'utf8' });
    let newSrc = src;

    const possibleVariablesRegex = /\b(\w+) (\w+) *= *Verifier\.nondet\w+/g;
    const possibleVariables = [];
    let result;
    while (result = possibleVariablesRegex.exec(src)) {
        possibleVariables.push({ varType: result[1], varName: result[2] });
    }

    const jbmcFlagsNow = combineFlags([[file], ['--cp', cpDir]], jbmcFlagsArr);
    const jbmcFlagsFlat = jbmcFlagsNow.flat(1);

    const cmd = `${jbmc} ${file} --cp ${cpDir} ${jbmcFlags}`;

    execPromises.push(new Promise((resolve) => {
        const end1 = +new Date();
        nowTimes.push(end1 - start1);

        const start2 = +new Date();
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
            const end2 = +new Date();
            nowTimes.push(end2 - start2);

            const start3 = +new Date();
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

            // const testName = srcDir.match(/(\w+)\/?$/)[1];
            const testName = moniker;
            const shouldPassNow = shouldPass[testName];

            if (svc) {
                if (shouldPassNow === undefined) {
                    console.log('MISSING TEST:', testName, moniker, srcDir);
                } else {
                    if (shouldPassNow != didPass) { // Only has false-fails
                        // console.log('Wrong test result:', testName, didPass);
                        // stopAfter = 0;
                        // stop2 = true;
                    } else {
                        // console.log('Correct test result:', testName);
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
            const nowTimesVars = [];

            for (const variable of possibleVariables) {
                const startV1 = +new Date();

                if (doLog >= 5) console.log('Variable', variable);
                const { varType, varName } = variable;
                const varNameMatch = trace.match(new RegExp(/\b_name_=/.source.replace('_name_', esc(varName))));
                if (!varNameMatch) {
                    if (doLog >= 5) console.log('Failed to find var');
                    continue;
                }

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
                });

                const endV1 = +new Date();
                nowTimesVars.push(endV1 - startV1);
            }

            nowTimes._vars = nowTimesVars;

            const end3 = +new Date();
            nowTimes.push(end3 - start3);

            const start4 = +new Date();

            if (doLog >= 3) {
                console.log('valueStack:');
                console.dir(valueStack, { depth: null });
            }

            if (!codeOnly && doLog) console.log('------');
            if (!parseOnly && doLog) {
                console.log(`------\nGenerated code:\n------`)
                console.log(newSrc);
            }

            const handleProcessEnd = () => {
                const end4 = +new Date();
                nowTimes.push(end4 - start4);
                nowTimes._total = nowTimes.reduce((acc, num) => acc + num, 0);
                times.push(nowTimes);
                resolve(true);
            };

            const genFileDir = `${genDir}${moniker !== file ? `/${moniker}` : ''}`;
            const genFilePath = `${genFileDir}/${file}.java`;
            fs.mkdir(genFileDir, () => {
                fs.writeFile(genFilePath, newSrc, (err) => {
                    if (err) {
                        console.log('FILE WRITE ERROR:', err);
                        return handleProcessEnd();
                    }
                    // console.log('Wrote file:', moniker);
                    exec(`javac ${genFilePath} ${verifierPath} -g`, (compErr, compOut, compStdErr) => {
                        // if (compErr) return console.log('JAVAC COMPILE ERROR:', compErr);
                        if (compErr) return handleProcessEnd();
                        // console.log('Compiled java class:', moniker);
                        exec(`java -cp ${genFileDir}${svc ? ':/home/vaeb/sv-benchmarks/java/common/' : ''} -ea ${file}`, (javaErr, javaOut, javaStdErr) => {
                            // console.log(javaErr);
                            // console.log(javaOut);
                            // console.log(javaStdErr);
                            // console.log(/\bjava\.lang\.AssertionError\b/.test(String(javaStdErr)));
                            const genAssertsPass = !/\bjava\.lang\.AssertionError\b/.test(String(javaStdErr));
                            if (genAssertsPass) numGenS++;
                            else numGenF++;
                            if (genAssertsPass == shouldPassNow) numGenMatches++;
                            else numGenDiff++;
                            // console.log(moniker, genAssertsPass, didPass, shouldPassNow);
                            handleProcessEnd();
                        });
                    });
                });
            });
        });
    }));
    
    if (stop) break;
}

const fixNum = (num, whole) => whole ? String(num) : num.toFixed(2);

const formatTime = (num, whole) => {
    if (num < 1000) return `${fixNum(num)}ms`;
    if (num < 1000 * 60) return `${fixNum(num / 1000)} seconds`;
    return `${fixNum(num / 1000 / 60)} minutes`;
};

Promise.all(execPromises).then(() => {
    const endF1 = +new Date();

    const fileType = svc ? 'SV-COMP tests' : 'java files';

    // console.log(times);

    let totalTime = 0;
    let totalTimeSetup = 0;
    let totalTimeJbmc = 0;
    let totalTimeGenerating = 0;
    let totalTimeWriting = 0;
    for (const nowTimes of times) {
        totalTime += nowTimes._total;
        totalTimeSetup += nowTimes[0];
        totalTimeJbmc += nowTimes[1];
        totalTimeGenerating += nowTimes[2];
        totalTimeWriting += nowTimes[3];
    }

    const elapsedTime = endF1 - startF1;
    const avgTimeTotal = totalTime / times.length;
    const avgTimeElapsed = elapsedTime / times.length;

    const avgTimeSetup = totalTimeSetup / times.length;
    const avgTimeJbmc = totalTimeJbmc / times.length;
    const avgTimeGenerating = totalTimeGenerating / times.length;
    const avgTimeWriting = totalTimeWriting / times.length;

    const percSetup = totalTimeSetup / totalTime * 100;
    const percJbmc = totalTimeJbmc / totalTime * 100;
    const percGenerating = totalTimeGenerating / totalTime * 100;
    const percWriting = totalTimeWriting / totalTime * 100;

    const totalArr = [totalTimeSetup, totalTimeJbmc, totalTimeGenerating, totalTimeWriting];
    const avgArr = [avgTimeSetup, avgTimeJbmc, avgTimeGenerating, avgTimeWriting];
    const parallelMult = totalTime / elapsedTime;
    const padTotal = Math.max(...totalArr.map(n => formatTime(n, true).length));
    const padTotalEl = Math.max(...totalArr.map(n => formatTime(n / parallelMult).length));
    const padAvg = Math.max(...avgArr.map(n => formatTime(n).length));
    const padAvgEl = Math.max(...avgArr.map(n => formatTime(n / parallelMult).length));

    console.log('');

    console.log(`Number of ${fileType} ran:`.padStart(87), filesData.length);
    console.log('---'.padStart(87))
    // console.log(`Number of ${fileType} with a result of VERIFICATION FAILED: ${numF}`);
    // console.log(`Number of ${fileType} with a result of VERIFICATION SUCCESSFUL: ${numS}`);
    console.log(`Number of ${fileType} expected to run successfully:`.padStart(87), numPass);
    console.log(`Number of ${fileType} expected to fail due to assertions:`.padStart(87), numFail);
    console.log('---'.padStart(87))
    console.log(`Number of ${fileType} for which the generated Java ran successfully:`.padStart(87), numGenS);
    console.log(`Number of ${fileType} for which the generated Java failed due to assertions:`.padStart(87), numGenF);
    console.log('---'.padStart(87))
    console.log(`Number of ${fileType} for tests with a correct outcome from generated Java files:`.padStart(87), numGenMatches);
    console.log(`Number of ${fileType} for tests with an incorrect outcome from generated Java files:`.padStart(87), numGenDiff);
    console.log('');
    console.log('---'.padStart(87))
    console.log('');
    console.log(`Total elapsed time:`.padStart(87), `${formatTime(elapsedTime, true)}`);
    console.log(`Total processing time:`.padStart(87), `${formatTime(totalTime, true)}`);
    console.log(`Average elapsed time per test:`.padStart(87), `${formatTime(avgTimeElapsed)}`);
    console.log(`Average processing time per test:`.padStart(87), `${formatTime(avgTimeTotal)}`);
    console.log('');
    console.log(`Time taken for initial setup:`.padStart(87), `\n`, `${formatTime((totalTimeSetup / parallelMult))}`.padStart(padTotalEl), `total (elapsed)`, `|`, `${formatTime(totalTimeSetup, true)}`.padStart(padTotal), `total (processing)`, `|`, `${formatTime((avgTimeSetup / parallelMult))}`.padStart(padAvgEl), `average (elapsed)`, `|`, `${formatTime(avgTimeSetup)}`.padStart(padAvg), `average (processing)`, `|`, `${percSetup.toFixed(2)}%`.padStart(6));
    console.log('');
    console.log(`Time taken for running JBMC:`.padStart(87), `\n`, `${formatTime((totalTimeJbmc / parallelMult))}`.padStart(padTotalEl), `total (elapsed)`, `|`, `${formatTime(totalTimeJbmc, true)}`.padStart(padTotal), `total (processing)`, `|`, `${formatTime((avgTimeJbmc / parallelMult))}`.padStart(padAvgEl), `average (elapsed)`, `|`, `${formatTime(avgTimeJbmc)}`.padStart(padAvg), `average (processing)`, `|`, `${percJbmc.toFixed(2)}%`.padStart(6));
    console.log('');
    console.log(`Time taken for generating a new Java solution based on the counterexample:`.padStart(87), `\n`, `${formatTime((totalTimeGenerating / parallelMult))}`.padStart(padTotalEl), `total (elapsed)`, `|`, `${formatTime(totalTimeGenerating, true)}`.padStart(padTotal), `total (processing)`, `|`, `${formatTime((avgTimeGenerating / parallelMult))}`.padStart(padAvgEl), `average (elapsed)`, `|`, `${formatTime(avgTimeGenerating)}`.padStart(padAvg), `average (processing)`, `|`, `${percGenerating.toFixed(2)}%`.padStart(6));
    console.log('');
    console.log(`Time taken for writing the new Java solution to a file, compiling it, and executing it:`.padStart(87), `\n`, `${formatTime((totalTimeWriting / parallelMult))}`.padStart(padTotalEl), `total (elapsed)`, `|`, `${formatTime(totalTimeWriting, true)}`.padStart(padTotal), `total (processing)`, `|`, `${formatTime((avgTimeWriting / parallelMult))}`.padStart(padAvgEl), `average (elapsed)`, `|`, `${formatTime(avgTimeWriting)}`.padStart(padAvg), `average (processing)`, `|`, `${percWriting.toFixed(2)}%`.padStart(6));
});