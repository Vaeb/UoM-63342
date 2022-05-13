const fs = require('fs');
const exec = require('child_process').exec;

// ~/cbmc-git/jbmc/src/jbmc/jbmc ArithmeticExceptionTest --unwind 5 --cp ~/cbmc-git/jbmc/regression/jbmc/ArithmeticException1

const jbmc = '~/cbmc-git/jbmc/src/jbmc/jbmc';
// const program = 'Simple';
const program = 'ArithmeticExceptionTest';
// const cp = './bin';
const cp = '~/cbmc-git/jbmc/regression/jbmc/ArithmeticException1';
// const srcDir = './src'
const srcDir = cp;
const unwind = 5;
// const flags = '--nondet-static --max-nondet-string-length 5';
const flags = '';

const esc = (str) => str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
const args = process.argv.slice(2);
let codeOnly = args.includes('--code-only');
let parseOnly = args.includes('--parse-only');

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

exec(`${jbmc} ${program} --unwind ${unwind} --cp ${cp} ${flags} --trace`, (error, trace, stderr) => {
    for (const variable of possibleVariables) {
        const { varType, name } = variable;
        if (!codeOnly) console.log(`---\n${name} (${varType})`)
        const variableSetRegex = new RegExp(`\\b(${esc(name)}=&)(\\w+)(?![\\s\\S]*\\b\\1)`);
        const prev1 = trace.match(variableSetRegex)[2];
        if (!codeOnly) console.log(prev1, variableSetRegex);
        const variableDataRegex = new RegExp(`\\b(${esc(prev1)}\\.data=)(\\w+)(?![\\s\\S]*\\b\\1)`);
        const prev2 = trace.match(variableDataRegex)[2];
        if (!codeOnly) console.log(prev2, variableDataRegex);
        const variableSetRegex2 = new RegExp(`\\b(${esc(prev2)}=)([^\\n\\(]+)(?![\\s\\S]*\\b\\1)`);
        const prev3 = trace.match(variableSetRegex2)[2].trim();
        if (!codeOnly) console.log(prev3, variableSetRegex2);

        if (parseOnly) continue;
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