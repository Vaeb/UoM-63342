const fs = require('fs');
const exec = require('child_process').exec;

// ~/cbmc-git/jbmc/src/jbmc/jbmc ArithmeticExceptionTest --unwind 5 --cp ~/cbmc-git/jbmc/regression/jbmc/ArithmeticException1

const svcompFiles = fs.readdirSync('/home/vaeb/cbmc-git/jbmc/regression/jbmc').map(folder => {
    folder = `/home/vaeb/cbmc-git/jbmc/regression/jbmc/${folder}`;
    if (!fs.statSync(folder).isDirectory()) return;
    const dirCont = fs.readdirSync(folder);
    // console.log(folder);
    const files = dirCont.filter(elm => elm.match(/.*\.(java?)/ig)).map((file) => [folder, file.replace('.java', '')]);
    return files;
}).flat(1).filter(el => el != null);

let q = false;
let numF = 0;
let numS = 0;
let numO = 0;
for (const [folder, file] of svcompFiles) {
    // if (q) break;
    // console.log(folder, file);
    const jbmc = '~/cbmc-git/jbmc/src/jbmc/jbmc';
    // const program = 'Simple';
    // const program = 'NondetFloat';
    const program = file;
    // const cp = './bin';
    // const cp = '/home/vaeb/cbmc-git/jbmc/regression/jbmc/NondetFloat';
    const cp = folder;
    // const srcDir = './src'
    const srcDir = cp;
    const unwind = 5;
    // const flags = '--nondet-static --max-nondet-string-length 5';
    const flags = '';
    const doTrace = false;

    const esc = (str) => str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const args = process.argv.slice(2);
    let codeOnly = args.includes('--code-only');
    let parseOnly = args.includes('--parse-only');
    let svcomp = args.includes('--svcomp');

    // Look in java source for which varaibles have unknown values
    // Find in counterexample

    const src = fs.readFileSync(`${srcDir}/${program}.java`, { encoding: 'utf8' });
    let newSrc = src;

    const possibleVariablesRegex = /\b(\w+) (\w+) *= *[^\s=]/g;
    const possibleVariables = [];
    let result;
    while (result = possibleVariablesRegex.exec(src)) {
        possibleVariables.push({ varType: result[1], name: result[2] });
    }

    const ceToJson = (str) => JSON.parse(
        str.replace(/{/g, '[')
        .replace(/}/g, ']')
        .replace(/'/g, '"'));

    const parseByType = (varType, val) => {
        if (varType === 'String') return `"${val.join('')}"`;
    };

    const cmd = `${jbmc} ${program} --unwind ${unwind} --cp ${cp} ${flags}${doTrace ? ' --trace' : ''}`;
    // if (!q) console.log(cmd);

    exec(cmd, (error, trace, stderr) => {
        if (doTrace === false) {
            const isVer1 = /VERIFICATION SUCCES/i.test(trace);
            const isVer2 = /VERIFICATION FAILED/i.test(trace);
            // console.log('VERIFICATION', isVer ? 'SUCCESSFUL' : 'FAILED');
            if (isVer1) numS++;
            if (isVer2) numF++;
            if (!isVer1 && !isVer2) numO++;
            // if (folder.includes('ArithmeticException5')) {
            //     console.log(folder, file, isVer);
            //     console.log(trace);
            // }
            return;
        }

        for (const variable of possibleVariables) {
            const { varType, name } = variable;
            if (!codeOnly) console.log(`---\n${name} (${varType})`)
            const variableSetRegex = new RegExp(`\\b(${esc(name)}=&)(\\w+)(?![\\s\\S]*\\b\\1)`);
            const prev1 = (trace.match(variableSetRegex) || [])[2];
            if (!codeOnly) console.log(prev1, variableSetRegex);
            if (!prev1) continue;
            const variableDataRegex = new RegExp(`\\b(${esc(prev1)}\\.data=)(\\w+)(?![\\s\\S]*\\b\\1)`);
            const prev2 = (trace.match(variableDataRegex) || [])[2];
            if (!codeOnly) console.log(prev2, variableDataRegex);
            if (!prev2) continue;
            const variableSetRegex2 = new RegExp(`\\b(${esc(prev2)}=)([^\\n\\(]+)(?![\\s\\S]*\\b\\1)`);
            const prev3 = (trace.match(variableSetRegex2) || [])[2].trim();
            if (!codeOnly) console.log(prev3, variableSetRegex2);

            if (!prev3 || parseOnly) continue;
            latestValue = prev3;

            newSrc = newSrc.replace(new RegExp(`\\b(${varType} +${name} *= *)(?![=])([^;]+)(.*?)$`, 'm'), (match, oldSetter, oldValue, after) => {
                const newValue = parseByType(varType, ceToJson(latestValue));
                if (oldValue === newValue) return match;
                return `${oldSetter}${newValue}${after} // [JBMC-Changed] [Original-Value: ${oldValue}]`;
            })
        }

        if (!codeOnly) console.log('------');
        if (!parseOnly) {
            console.log(`------\nGenerated code:\n------`)
            console.log(newSrc);
        }
    });
    q = true;
}

setTimeout(() => {
    console.log(`Number of SV-COMP tests attempted:`, svcompFiles.length);
    console.log(`Number of SV-COMP tests with a result of VERIFICATION FAILED: ${numF}`);
    console.log(`Number of SV-COMP tests with a result of VERIFICATION SUCCESSFUL: ${numS}`);
    console.log(`Number of SV-COMP tests that failed on which verification failed: ${numO}`);
}, 200);
